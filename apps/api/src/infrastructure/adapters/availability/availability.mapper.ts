import { DateTime } from 'luxon';
import type { WeeklySchedule, AvailabilityOverride, BusyInterval, Weekday, TimeRange } from '../../../domain/availability/availability.types';

function toHHmm(date: Date): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat('HH:mm');
}

export function mapWeeklySchedule(
  rows: Array<{ dayOfWeek: number; startTime: Date; endTime: Date }>,
  timezone: string,
): WeeklySchedule {
  const days: Partial<Record<Weekday, TimeRange[]>> = {};

  for (const r of rows) {
    const wd = r.dayOfWeek as Weekday;
    (days[wd] ??= []).push({
      start: toHHmm(r.startTime),
      end: toHHmm(r.endTime),
    });
  }

  return { timezone, days };
}

export function mapOverrides(prismaOverrides: any[]): AvailabilityOverride[] {
  return prismaOverrides.map(o => ({
    type: o.type, // 'OPEN' | 'CLOSED'
    startsAt: o.startsAt.toISOString(),
    endsAt: o.endsAt.toISOString(),
    ranges: o.ranges ?? undefined,
  }));
}

export function mapBusy(prismaAppointments: any[]): BusyInterval[] {
  return prismaAppointments.map(a => ({
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
  }));
}