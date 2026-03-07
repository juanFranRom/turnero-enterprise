import { BadRequestException, ConflictException, Injectable, NotFoundException, Inject } from '@nestjs/common';
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
import { APPOINTMENT_HISTORY_PORT, AppointmentHistoryPort } from '../../infrastructure/adapters/audit/appointment-history.port';
import { toAppointmentResponse, type AppointmentResponseDto } from './dtos/appointment-response.dto';
import { Prisma } from '@prisma/client';
import { encodeCursor, decodeCursor } from '../../common/pagination/cursor.codec';
import { keysetAscCreatedAtId, keysetDescCreatedAtId } from '../../common/pagination/keyset';
import type { AppointmentHistoryScope } from './cursors/appointment-history.scope';
import type { AppointmentsHistoryGlobalScope } from './cursors/appointments-history-global.scope';
import type { GetAppointmentHistoryResponseDto } from './dtos/get-appointment-history.dto';
import { GetAppointmentsHistoryGlobalResponseDto } from './dtos/get-appointments-history-global.dto';
import { MetricsService } from '../metrics/metrics.service';
import { buildLocalDayRange } from '../../common/calendar/day-range';
import { listWithCreatedAtCursor } from '../../common/pagination/list-with-cursor';

function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

@Injectable()
export class AppointmentsService {
  private readonly bookingPolicy = new BookingPolicy();
  private readonly availabilityPort: PrismaAvailabilityReadAdapter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @Inject(APPOINTMENT_HISTORY_PORT) private readonly audit: AppointmentHistoryPort<Prisma.TransactionClient>,
  ) {
    this.availabilityPort = new PrismaAvailabilityReadAdapter(prisma);
  }

  private omitUndefined<T extends Record<string, unknown>>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined),
    ) as T;
  }

  private mapDomainError(e: unknown): never {
    if (!isDomainError(e)) throw e;

    const payload = {
      code: e.code,
      message: e.message,
      details: e.details,
    };

    if (e.code === 'APPOINTMENT_INVALID_TRANSITION') {
      throw new ConflictException(payload);
    }

    throw new BadRequestException(payload);
  }

  async create(ctx: TenantCtx, userId: string, dto: CreateAppointmentDto): Promise<AppointmentResponseDto>  {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    // tenant-safe resource/location/service existence (resource también)
    const resource = await this.prisma.resource.findFirst({
      where: { id: dto.resourceId, tenantId: ctx.id, locationId: dto.locationId, isActive: true },
      select: { id: true },
    });
    if (!resource) throw new NotFoundException({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
    });

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

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
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

      await this.audit.recordAppointmentEvent(tx, { type: 'USER', userId }, {
        kind: 'APPOINTMENT_CREATED',
        tenantId: ctx.id,
        appointmentId: created.id,
        locationId: created.locationId,
        resourceId: created.resourceId,
        serviceId: created.serviceId ?? null,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
      });

      this.metrics.appointmentsCreatedTotal.inc({ tenant: ctx.slug });
      return toAppointmentResponse(created);
    });
  }

  async cancel(ctx: TenantCtx, userId: string, id: string, dto: CancelAppointmentDto): Promise<AppointmentResponseDto>  {
    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: { id, tenantId: ctx.id },
        select: {
          id: true,
          status: true,
          cancelIdempotencyKey: true,
          locationId: true,
          resourceId: true,
          serviceId: true,
          startsAt: true,
          endsAt: true,
        },
      });
      if (!appt) 
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Appointment not found',
        });

      if (dto.idempotencyKey && appt.cancelIdempotencyKey === dto.idempotencyKey) {
        const existing = await tx.appointment.findFirstOrThrow({
          where: { id, tenantId: ctx.id },
          select: {
            id: true,
            locationId: true,
            resourceId: true,
            serviceId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            notes: true,
            cancelledAt: true,
            cancellationReason: true,
            rescheduledAt: true,
            rescheduleReason: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return toAppointmentResponse(existing);
      }

      try { assertCanCancel(appt.status as any); } catch (e) { this.mapDomainError(e); }

      if (appt.status === 'CANCELLED') {
        const existing = await tx.appointment.findFirstOrThrow({
          where: { id, tenantId: ctx.id },
          select: {
            id: true,
            locationId: true,
            resourceId: true,
            serviceId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            notes: true,
            cancelledAt: true,
            cancellationReason: true,
            rescheduledAt: true,
            rescheduleReason: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return toAppointmentResponse(existing);
      }

      const r = await tx.appointment.updateMany({
        where: { id: appt.id, tenantId: ctx.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: dto.reason ?? null,
          cancelIdempotencyKey: dto.idempotencyKey ?? null,
          updatedByUserId: userId,
        },
      });
      this.metrics.appointmentsCancelledTotal.inc({ tenant: ctx.slug });
      if (r.count !== 1) 
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Appointment not found',
        });

      const updated = await tx.appointment.findFirstOrThrow({ where: { id: appt.id, tenantId: ctx.id } });

      await this.audit.recordAppointmentEvent(tx, { type: 'USER', userId }, {
        kind: 'APPOINTMENT_CANCELLED',
        tenantId: ctx.id,
        appointmentId: updated.id,
        locationId: updated.locationId,
        resourceId: updated.resourceId,
        serviceId: updated.serviceId ?? null,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        reason: dto.reason ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
      });

      return toAppointmentResponse(updated);
    });
  }

  async reschedule(ctx: TenantCtx, userId: string, id: string, dto: RescheduleAppointmentDto): Promise<AppointmentResponseDto>  {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    // Traigo también startsAt/endsAt para snapshot "prev"
    const appt = await this.prisma.appointment.findFirst({
      where: { id, tenantId: ctx.id },
      select: {
        id: true,
        status: true,
        locationId: true,
        resourceId: true,
        serviceId: true,
        rescheduleIdempotencyKey: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!appt) 
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found',
      });

    // idempotencia simple (si ya se procesó con esa key, NO auditamos de nuevo)
    if (dto.idempotencyKey && appt.rescheduleIdempotencyKey === dto.idempotencyKey) {
        const existing = await this.prisma.appointment.findFirstOrThrow({
          where: { id, tenantId: ctx.id },
          select: {
            id: true,
            locationId: true,
            resourceId: true,
            serviceId: true,
            status: true,
            startsAt: true,
            endsAt: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            notes: true,
            cancelledAt: true,
            cancellationReason: true,
            rescheduledAt: true,
            rescheduleReason: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return toAppointmentResponse(existing);
    }

    try {
      assertCanReschedule(appt.status as any);
    } catch (e) {
      this.mapDomainError(e);
    }

    if (!appt.serviceId) 
      throw new BadRequestException({
        code: 'SERVICE_REQUIRED',
        message: 'Service required.',
      });

    const tz = await this.availabilityPort.getLocationTZ({ tenantId: ctx.id, locationId: appt.locationId });
    const service = await this.availabilityPort.getServiceCfg({
      tenantId: ctx.id,
      locationId: appt.locationId,
      serviceId: appt.serviceId,
    });
    await this.availabilityPort.assertResourceServiceAllowed({
      tenantId: ctx.id,
      resourceId: appt.resourceId,
      serviceId: appt.serviceId,
    });

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

    // Update + history en la MISMA transacción
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
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
      this.metrics.appointmentsRescheduledTotal.inc({ tenant: ctx.slug });

      await this.audit.recordAppointmentEvent(tx, { type: 'USER', userId }, {
        kind: 'APPOINTMENT_RESCHEDULED',
        tenantId: ctx.id,
        appointmentId: updated.id,
        locationId: updated.locationId,
        resourceId: updated.resourceId,
        serviceId: updated.serviceId ?? null,
        prevStartsAt: appt.startsAt,
        prevEndsAt: appt.endsAt,
        newStartsAt: updated.startsAt,
        newEndsAt: updated.endsAt,
        reason: dto.reason ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
      });

      return toAppointmentResponse(updated);
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
    const localDate = DateTime.fromJSDate(args.startsAt, { zone: 'utc' })
      .setZone(args.tz)
      .toISODate()!;

    const r = buildLocalDayRange({ dateISO: localDate, tz: args.tz });

    const fromIso = r.fromIso;
    const toIso = r.toIso;
    const from = r.fromUtc;
    const to = r.toUtc;

    const [weeklyRows, overrideRows, busyRows] = await Promise.all([
      this.availabilityPort.getWeekly({
        tenantId: args.tenantId,
        locationId: args.locationId,
        resourceId: args.resourceId,
        dayOfWeek: r.day.weekday,
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

  async getAppointmentHistory(args: {
    tenantId: string;
    appointmentId: string;
    limit?: number;
    cursor?: string;
  }): Promise<GetAppointmentHistoryResponseDto> {
    const limit = args.limit ?? 50;

    // Multi-tenant safe: validar que el appointment exista en el tenant
    const appt = await this.prisma.appointment.findFirst({
      where: { id: args.appointmentId, tenantId: args.tenantId },
      select: { id: true },
    });
    if (!appt) 
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found',
      });

    // Cursor keyset (ASC)
    let cursorWhere: any = undefined;

    if (args.cursor) {
      let c;
      try {
        c = decodeCursor<AppointmentHistoryScope>(args.cursor);
      } catch {
        throw new BadRequestException({
          code: 'INVALID_CURSOR',
          message: 'Invalid cursor',
        });
      }

      if (c.tenantId !== args.tenantId) 
        throw new BadRequestException({
          code: 'INVALID_CURSOR',
          message: 'Invalid cursor',
        });
      if (c.scope.appointmentId !== args.appointmentId) 
        throw new BadRequestException({
          code: 'INVALID_CURSOR',
          message: 'Invalid cursor',
        });

      cursorWhere = keysetAscCreatedAtId(new Date(c.at), c.id);
    }

    const rows = await this.prisma.appointmentHistory.findMany({
      where: {
        tenantId: args.tenantId,
        appointmentId: args.appointmentId,
        ...(cursorWhere ?? {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorType: true,
        actorUserId: true,
        resourceId: true,
        serviceId: true,
        locationId: true,
        prevStartsAt: true,
        prevEndsAt: true,
        newStartsAt: true,
        newEndsAt: true,
        idempotencyKey: true,
        reason: true,
        metadata: true,
      },
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const items = slice.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      action: r.action,
      actor: { type: r.actorType, userId: r.actorUserId ?? null },
      resourceId: r.resourceId,
      serviceId: r.serviceId ?? null,
      locationId: r.locationId,
      prev: {
        startsAt: r.prevStartsAt ? r.prevStartsAt.toISOString() : null,
        endsAt: r.prevEndsAt ? r.prevEndsAt.toISOString() : null,
      },
      next: {
        startsAt: r.newStartsAt ? r.newStartsAt.toISOString() : null,
        endsAt: r.newEndsAt ? r.newEndsAt.toISOString() : null,
      },
      reason: r.reason ?? null,
      idempotencyKey: r.idempotencyKey ?? null,
      metadata: r.metadata ?? null,
    }));

    const last = slice[slice.length - 1];

    const nextCursor =
      hasMore && last
        ? encodeCursor<AppointmentHistoryScope>({
            v: 1,
            tenantId: args.tenantId,
            scope: { appointmentId: args.appointmentId },
            at: last.createdAt.toISOString(),
            id: last.id,
          })
        : undefined;

    return { items, nextCursor };
  }

  async getAppointmentsHistoryGlobal(args: {
    tenantId: string;
    limit?: number;
    cursor?: string;
    direction?: 'asc' | 'desc';
    action?: any;
    actorUserId?: string;
    appointmentId?: string;
    resourceId?: string;
    locationId?: string;
    from?: string;
    to?: string;
  }): Promise<GetAppointmentsHistoryGlobalResponseDto> {
    const createdAtRange: any = {};
    if (args.from) createdAtRange.gte = new Date(args.from);
    if (args.to) createdAtRange.lte = new Date(args.to);

    const whereBase = {
      tenantId: args.tenantId,
      ...(args.action ? { action: args.action } : {}),
      ...(args.actorUserId ? { actorUserId: args.actorUserId } : {}),
      ...(args.appointmentId ? { appointmentId: args.appointmentId } : {}),
      ...(args.resourceId ? { resourceId: args.resourceId } : {}),
      ...(args.locationId ? { locationId: args.locationId } : {}),
      ...(args.from || args.to ? { createdAt: createdAtRange } : {}),
    };

    const scope = this.omitUndefined({
      feed: 'appointments-history',
      action: args.action,
      actorUserId: args.actorUserId,
      appointmentId: args.appointmentId,
      resourceId: args.resourceId,
      locationId: args.locationId,
      from: args.from,
      to: args.to,
      direction: args.direction ?? 'desc',
    });

    const result = await listWithCreatedAtCursor({
      tenantId: args.tenantId,
      query: {
        limit: args.limit,
        cursor: args.cursor,
        direction: args.direction ?? 'desc',
      },
      scope,
      whereBase,
      delegate: this.prisma.appointmentHistory,
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorType: true,
        actorUserId: true,
        appointmentId: true,
        resourceId: true,
        serviceId: true,
        locationId: true,
        reason: true,
        metadata: true,
      },
    });

    return {
      items: result.items.map((r: any) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        action: r.action,
        actorType: r.actorType,
        actorUserId: r.actorUserId ?? null,
        appointmentId: r.appointmentId,
        resourceId: r.resourceId,
        serviceId: r.serviceId ?? null,
        locationId: r.locationId,
        reason: r.reason ?? null,
        metadata: r.metadata ?? null,
      })),
      nextCursor: result.nextCursor ?? null,
    };
  }

}