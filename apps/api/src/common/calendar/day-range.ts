import { DateTime } from 'luxon';

export function buildLocalDayRange(args: { dateISO: string; tz: string }) {
  const day = DateTime.fromISO(args.dateISO, { zone: args.tz });
  if (!day.isValid) throw new Error('INVALID_DATE');

  const fromDT = day.startOf('day');
  const toDT = day.endOf('day').plus({ millisecond: 1 });

  return {
    day,
    fromDT,
    toDT,
    // para engine
    fromIso: fromDT.toISO()!,
    toIso: toDT.toISO()!,
    // para queries
    fromUtc: fromDT.toUTC().toJSDate(),
    toUtc: toDT.toUTC().toJSDate(),
    dateOnly: day.toISODate()!,
  };
}