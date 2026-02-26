import { DateTime, Interval } from 'luxon';

type WeeklyRow = { dayOfWeek: number; startTime: Date; endTime: Date };

function toHHmm(date: Date): string {
  // startTime/endTime son "Time" en DB pero llegan como Date -> tomamos HH:mm en UTC
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat('HH:mm');
}

function parseHm(hm: string) {
  const [hh, mm] = hm.split(':').map(Number);
  return { hh, mm };
}

/**
 * Devuelve intervalos abiertos del día (schedule puro + effectiveFrom/To lo filtra Prisma)
 * en ISO UTC.
 */
export function buildOpenIntervalsForDate(args: {
  timezone: string;
  dateISO: string; // el mismo q.date
  weeklyRows: WeeklyRow[];
}): Array<{ startsAt: string; endsAt: string }> {
  const { timezone: tz, dateISO, weeklyRows } = args;

  const day = DateTime.fromISO(dateISO, { zone: tz }).startOf('day');
  const out: Array<{ startsAt: string; endsAt: string }> = [];

  for (const r of weeklyRows) {
    const s = parseHm(toHHmm(r.startTime));
    const e = parseHm(toHHmm(r.endTime));

    const startLocal = day.set({ hour: s.hh, minute: s.mm, second: 0, millisecond: 0 });
    const endLocal = day.set({ hour: e.hh, minute: e.mm, second: 0, millisecond: 0 });

    const it = Interval.fromDateTimes(startLocal, endLocal);
    if (!it.isValid || it.length('minutes') <= 0) continue;

    out.push({
      startsAt: startLocal.toUTC().toISO()!,
      endsAt: endLocal.toUTC().toISO()!,
    });
  }

  // orden
  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}