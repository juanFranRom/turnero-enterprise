import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AvailabilityEngine } from '../../domain/availability/availability.engine';
import { mapBusy, mapOverrides, mapWeeklySchedule } from '../../infrastructure/adapters/availability/availability.mapper';
import { buildOpenIntervalsForDate } from './availability.intervals';
import type { GetAvailabilityResponse } from './dtos/get-availability.response';

@Injectable()
export class AvailabilityService {
  private readonly engine = new AvailabilityEngine();

  constructor(private readonly prisma: PrismaService) {}


  async getAvailability(args: {
    tenantId: string;
    locationId: string;
    resourceId: string;
    serviceId: string;
    date: string;
  }): Promise<GetAvailabilityResponse> {
    const { tenantId, locationId, resourceId, serviceId, date } = args;

    const location = await this.prisma.location.findFirstOrThrow({
      where: { tenantId, id: locationId },
      select: { timeZone: true },
    });

    const tz = location.timeZone;

    const day = DateTime.fromISO(date, { zone: tz });
    const from = day.startOf('day').toISO()!;
    const to = day.endOf('day').plus({ millisecond: 1 }).toISO()!;

    const [weeklyRows, overrideRows, busyRows, svc] = await Promise.all([
      this.prisma.weeklySchedule.findMany({
        where: {
          tenantId,
          locationId,
          resourceId,
          // (opcional pero recomendado) vigencia:
          effectiveFrom: { lte: new Date(to) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(from) } }],
          // y día:
          dayOfWeek: day.weekday, // Luxon: 1..7
        },
        select: { dayOfWeek: true, startTime: true, endTime: true },
        orderBy: [{ startTime: 'asc' }],
      }),

      this.prisma.availabilityOverride.findMany({
        where: {
          tenantId,
          locationId,
          resourceId,
          startsAt: { lt: new Date(to) },
          endsAt: { gt: new Date(from) },
        },
        select: { kind: true, startsAt: true, endsAt: true },
      }),

      this.prisma.appointment.findMany({
        where: {
          tenantId,
          locationId,
          resourceId,
          status: { in: ['BOOKED', 'CONFIRMED'] },
          startsAt: { lt: new Date(to) },
          endsAt: { gt: new Date(from) },
        },
        select: { startsAt: true, endsAt: true },
      }),

      this.prisma.service.findFirstOrThrow({
        where: { tenantId, id: serviceId, locationId },
        select: { durationMinutes: true, bufferBeforeMinutes: true, bufferAfterMinutes: true },
      }),
    ]);

    const stepMinutes = svc.durationMinutes; // o 15 si querés granularidad fija

    const input = {
      timezone: tz,
      range: { from, to },
      weekly: mapWeeklySchedule(weeklyRows, tz),
      overrides: mapOverrides(overrideRows as any),
      busy: mapBusy(busyRows),
      service: {
        durationMinutes: svc.durationMinutes,
        bufferBeforeMinutes: svc.bufferBeforeMinutes,
        bufferAfterMinutes: svc.bufferAfterMinutes,
      },
      stepMinutes,
    };

    const computed = this.engine.compute(input);

    const openIntervals = buildOpenIntervalsForDate({
      timezone: tz,
      dateISO: date,
      weeklyRows,
    });

    const busyIntervals = mapBusy(busyRows);

    const dateOnly = DateTime.fromISO(date, { zone: tz }).toISODate()!;

    return {
      meta: {
        date: dateOnly,
        timezone: tz,
        service: {
          id: serviceId,
          durationMinutes: svc.durationMinutes,
          bufferBeforeMinutes: svc.bufferBeforeMinutes,
          bufferAfterMinutes: svc.bufferAfterMinutes,
        },
        stepMinutes,
      },
      openIntervals,
      busyIntervals,
      slots: computed.slots,
      counts: {
        openIntervals: openIntervals.length,
        busyIntervals: busyIntervals.length,
        slots: computed.slots.length,
      },
    };
  }
}