import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TenantCtx } from '../../common/types/request-context';
import { BookingPolicy } from '../../domain/appointments/booking.policy';
import { DomainError, assertCanCancel, assertCanReschedule } from '../../domain/appointments/appointment.lifecycle';
import { PrismaAvailabilityReadAdapter } from '../../infrastructure/adapters/availability/prisma-availability-read.adapter';
import { mapBusy, mapOverrides, mapWeeklySchedule } from '../../infrastructure/adapters/availability/availability.mapper';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { CancelAppointmentDto } from './dtos/cancel-appointment.dto';
import { RescheduleAppointmentDto } from './dtos/reschedule-appointment.dto';

function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

@Injectable()
export class AppointmentsService {
  private readonly bookingPolicy = new BookingPolicy();
  private readonly availabilityPort: PrismaAvailabilityReadAdapter;

  constructor(private readonly prisma: PrismaService) {
    this.availabilityPort = new PrismaAvailabilityReadAdapter(prisma);
  }

  private mapDomainError(e: unknown): never {
    if (isDomainError(e)) {
      if (e.code === 'APPOINTMENT_INVALID_TRANSITION') {
        throw new ConflictException({ code: e.code, message: e.message, details: e.details });
      }
      throw new BadRequestException({ code: e.code, message: e.message, details: e.details });
    }
    throw e;
  }

  async create(ctx: TenantCtx, userId: string, dto: CreateAppointmentDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    // tenant-safe resource/location/service existence (resource también)
    const resource = await this.prisma.resource.findFirst({
      where: { id: dto.resourceId, tenantId: ctx.id, locationId: dto.locationId, isActive: true },
      select: { id: true },
    });
    if (!resource) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND' });

    const tz = await this.availabilityPort.getLocationTZ({ tenantId: ctx.id, locationId: dto.locationId });
    const service = await this.availabilityPort.getServiceCfg({ tenantId: ctx.id, locationId: dto.locationId, serviceId: dto.serviceId! });
    await this.availabilityPort.assertResourceServiceAllowed({ tenantId: ctx.id, resourceId: dto.resourceId, serviceId: dto.serviceId! });

    const bookingCtx = await this.buildBookingContext({
      tenantId: ctx.id,
      locationId: dto.locationId,
      resourceId: dto.resourceId,
      tz,
      service,
      startsAt,
      excludeAppointmentId: undefined,
    });

    try {
      this.bookingPolicy.assertBookable(bookingCtx, { startsAt, endsAt });
    } catch (e) {
      this.mapDomainError(e);
    }

    return this.prisma.appointment.create({
      data: {
        tenantId: ctx.id,
        locationId: dto.locationId,
        resourceId: dto.resourceId,
        serviceId: dto.serviceId ?? null,
        status: 'BOOKED',
        startsAt,
        endsAt,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerEmail: dto.customerEmail ?? null,
        notes: dto.notes ?? null,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  async cancel(ctx: TenantCtx, userId: string, id: string, dto: CancelAppointmentDto) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id, tenantId: ctx.id },
      select: { id: true, status: true, cancelIdempotencyKey: true },
    });
    if (!appt) throw new NotFoundException({ code: 'APPOINTMENT_NOT_FOUND' });

    // idempotencia simple
    if (dto.idempotencyKey && appt.cancelIdempotencyKey === dto.idempotencyKey) {
      return this.prisma.appointment.findFirst({ where: { id, tenantId: ctx.id } });
    }

    try {
      assertCanCancel(appt.status as any);
    } catch (e) {
      this.mapDomainError(e);
    }

    // CANCELLED idempotente (si ya lo estaba)
    if (appt.status === 'CANCELLED') {
      return this.prisma.appointment.findFirst({ where: { id, tenantId: ctx.id } });
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: dto.reason ?? null,
        cancelIdempotencyKey: dto.idempotencyKey ?? null,
        updatedByUserId: userId,
      },
    });
  }

  async reschedule(ctx: TenantCtx, userId: string, id: string, dto: RescheduleAppointmentDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    const appt = await this.prisma.appointment.findFirst({
      where: { id, tenantId: ctx.id },
      select: { id: true, status: true, locationId: true, resourceId: true, serviceId: true, rescheduleIdempotencyKey: true },
    });
    if (!appt) throw new NotFoundException({ code: 'APPOINTMENT_NOT_FOUND' });

    if (dto.idempotencyKey && appt.rescheduleIdempotencyKey === dto.idempotencyKey) {
      return this.prisma.appointment.findFirst({ where: { id, tenantId: ctx.id } });
    }

    try {
      assertCanReschedule(appt.status as any);
    } catch (e) {
      this.mapDomainError(e);
    }

    if (!appt.serviceId) throw new BadRequestException({ code: 'SERVICE_REQUIRED' });

    const tz = await this.availabilityPort.getLocationTZ({ tenantId: ctx.id, locationId: appt.locationId });
    const service = await this.availabilityPort.getServiceCfg({ tenantId: ctx.id, locationId: appt.locationId, serviceId: appt.serviceId });
    await this.availabilityPort.assertResourceServiceAllowed({ tenantId: ctx.id, resourceId: appt.resourceId, serviceId: appt.serviceId });

    const bookingCtx = await this.buildBookingContext({
      tenantId: ctx.id,
      locationId: appt.locationId,
      resourceId: appt.resourceId,
      tz,
      service,
      startsAt,
      excludeAppointmentId: appt.id,
    });

    try {
      this.bookingPolicy.assertBookable(bookingCtx, { startsAt, endsAt });
    } catch (e) {
      this.mapDomainError(e);
    }

    return this.prisma.appointment.update({
      where: { id: appt.id },
      data: {
        startsAt,
        endsAt,
        rescheduledAt: new Date(),
        rescheduleReason: dto.reason ?? null,
        rescheduleIdempotencyKey: dto.idempotencyKey ?? null,
        updatedByUserId: userId,
      },
    });
  }

  private async buildBookingContext(args: {
    tenantId: string;
    locationId: string;
    resourceId: string;
    tz: string;
    service: { durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number };
    startsAt: Date; // para definir el día local
    excludeAppointmentId?: string;
  }) {
    const reqStartUtc = DateTime.fromJSDate(args.startsAt, { zone: 'utc' });
    const localDayStart = reqStartUtc.setZone(args.tz).startOf('day');
    const fromIso = localDayStart.toISO()!;
    const toIso = localDayStart.endOf('day').plus({ millisecond: 1 }).toISO()!;

    const from = new Date(fromIso);
    const to = new Date(toIso);

    const [weeklyRows, overrideRows, busyRows] = await Promise.all([
      this.availabilityPort.getWeekly({
        tenantId: args.tenantId,
        locationId: args.locationId,
        resourceId: args.resourceId,
        dayOfWeek: localDayStart.weekday,
        from,
        to,
      }),
      this.availabilityPort.getOverrides({ tenantId: args.tenantId, locationId: args.locationId, resourceId: args.resourceId, from, to }),
      this.availabilityPort.getBusy({
        tenantId: args.tenantId,
        locationId: args.locationId,
        resourceId: args.resourceId,
        from,
        to,
        excludeAppointmentId: args.excludeAppointmentId,
      }),
    ]);

    return {
      timezone: args.tz,
      range: { from: fromIso, to: toIso },
      weekly: mapWeeklySchedule(weeklyRows, args.tz),
      overrides: mapOverrides(overrideRows as any),
      busy: mapBusy(busyRows),
      service: args.service,
      stepMinutes: args.service.durationMinutes,
    };
  }
}