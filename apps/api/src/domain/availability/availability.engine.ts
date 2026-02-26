// src/domain/availability/availability.engine.ts
import { DateTime, Interval } from 'luxon';
import type {
  AvailabilityInput,
  AvailabilityResult,
  Weekday,
  TimeRange,
  AvailabilityOverride,
} from './availability.types';

function parseHm(time: string) {
  const [hh, mm] = time.split(':').map(Number);
  return { hh, mm };
}

function dayRangesToIntervals(dayStart: DateTime, ranges: TimeRange[]) {
    if (!Array.isArray(ranges)) return [];
    return ranges.map((r) => {
        const s = parseHm(r.start);
        const e = parseHm(r.end);
        const start = dayStart.set({ hour: s.hh, minute: s.mm, second: 0, millisecond: 0 });
        const end = dayStart.set({ hour: e.hh, minute: e.mm, second: 0, millisecond: 0 });
        return Interval.fromDateTimes(start, end);
    }).filter(i => i.isValid && i.length('minutes') > 0);
}

function subtractIntervals(base: Interval[], blocks: Interval[]) {
  // resta naive: se puede optimizar, pero es simple y testeable
  let result = base.slice();
  for (const b of blocks) {
    const next: Interval[] = [];
    for (const r of result) {
      if (!r.overlaps(b)) next.push(r);
      else {
        const parts = r.difference(b);
        for (const p of parts) if (p.length('minutes') > 0) next.push(p);
      }
    }
    result = next;
  }
  return result;
}

function normalizeOverrideIntervals(
  tz: string,
  overrides: AvailabilityOverride[],
  from: DateTime,
  to: DateTime,
) {
  const closed: Interval[] = [];
  const open: { interval: Interval; ranges?: TimeRange[] }[] = [];

  for (const o of overrides) {
    const s = DateTime.fromISO(o.startsAt, { zone: tz });
    const e = DateTime.fromISO(o.endsAt, { zone: tz });
    const it = Interval.fromDateTimes(s, e).intersection(Interval.fromDateTimes(from, to));
    if (!it || !it.isValid || it.length('minutes') <= 0) continue;

    if (o.type === 'CLOSED') closed.push(it);
    else open.push({ interval: it, ranges: o.ranges });
  }
  return { closed, open };
}

/**
 * Devuelve slots en UTC ISO.
 * Regla: armamos intervalos "open" por schedule semanal + overrides OPEN,
 * restamos overrides CLOSED y busy, y luego generamos slots discretos.
 */
export class AvailabilityEngine {
  compute(input: AvailabilityInput): AvailabilityResult {
    const tz = input.timezone;
    const from = DateTime.fromISO(input.range.from, { zone: tz });
    const to = DateTime.fromISO(input.range.to, { zone: tz });
    
    if (!from.isValid || !to.isValid || to <= from) return { slots: [] };

    const step = input.stepMinutes ?? input.service.durationMinutes;

    const dur = input.service.durationMinutes;
    const bufBefore = input.service.bufferBeforeMinutes ?? 0;
    const bufAfter = input.service.bufferAfterMinutes ?? 0;
    const effectiveDur = dur + bufBefore + bufAfter;

    // busy (appointments) viene en ISO UTC -> lo pasamos a tz para operar
    const busyIntervals: Interval[] = input.busy
      .map(b => {
        const s = DateTime.fromISO(b.startsAt, { zone: 'utc' }).setZone(tz).minus({ minutes: bufBefore });
        const e = DateTime.fromISO(b.endsAt, { zone: 'utc' }).setZone(tz).plus({ minutes: bufAfter });
        return Interval.fromDateTimes(s, e)
      })
      .filter(i => i.isValid && i.length('minutes') > 0);

    const { closed: closedOverrides, open: openOverrides } =
      normalizeOverrideIntervals(tz, input.overrides, from, to);

    // 1) Base intervals desde weekly schedule
    const baseIntervals: Interval[] = [];
    for (let day = from.startOf('day'); day < to; day = day.plus({ days: 1 })) {
        const weekday = day.weekday as Weekday;
        const rangesRaw = (input.weekly.days as any)[weekday];
        const ranges = Array.isArray(rangesRaw) ? rangesRaw : [];
        baseIntervals.push(
            ...dayRangesToIntervals(day, ranges).map(i => i.intersection(Interval.fromDateTimes(from, to))).filter(Boolean) as Interval[]
        );
    }

    // 2) Sumamos overrides OPEN (si vienen rangos, se aplican dentro del intervalo)
    for (const oo of openOverrides) {
      if (!oo.ranges || oo.ranges.length === 0) {
        baseIntervals.push(oo.interval);
      } else {
        // rangos relativos al día del startsAt del override (y sucesivos si abarca varios días)
        const startDay = oo.interval.start!.startOf('day');
        const endDay = oo.interval.end!.startOf('day');
        for (let day = startDay; day <= endDay; day = day.plus({ days: 1 })) {
          const ranges = dayRangesToIntervals(day, oo.ranges);
          for (const r of ranges) {
            const inter = r.intersection(oo.interval);
            if (inter && inter.isValid && inter.length('minutes') > 0) baseIntervals.push(inter);
          }
        }
      }
    }

    // 3) Restamos CLOSED + busy
    const openMinusClosed = subtractIntervals(baseIntervals, closedOverrides);
    const freeIntervals = subtractIntervals(openMinusClosed, busyIntervals);

    // 4) Generamos slots discretos
    const slots: { startsAt: string; endsAt: string }[] = [];
    for (const it of freeIntervals) {
      const start = it.start!;
      const end = it.end!;
      // avanzar por step
      for (let t = start; t.plus({ minutes: effectiveDur }) <= end; t = t.plus({ minutes: step })) {
        const apptStart = t.plus({ minutes: bufBefore });
        const apptEnd = apptStart.plus({ minutes: dur });

        const sUtc = apptStart.toUTC().toISO();
        const eUtc = apptEnd.toUTC().toISO();
        if (sUtc && eUtc) slots.push({ startsAt: sUtc, endsAt: eUtc });
      }
    }

    // opcional: orden y unique (por si se solapan intervalos open)
    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const uniq: typeof slots = [];
    const seen = new Set<string>();
    for (const s of slots) {
      const key = `${s.startsAt}|${s.endsAt}`;
      if (!seen.has(key)) { seen.add(key); uniq.push(s); }
    }

    return { slots: uniq };
  }
}