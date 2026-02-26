import { DateTime, Interval } from 'luxon';

export function isWithinSlots(args: {
  startsAtUtc: string;
  endsAtUtc: string;
  slots: Array<{ startsAt: string; endsAt: string }>; // UTC ISO
}): boolean {
  const req = Interval.fromDateTimes(
    DateTime.fromISO(args.startsAtUtc, { zone: 'utc' }),
    DateTime.fromISO(args.endsAtUtc, { zone: 'utc' }),
  );
  if (!req.isValid || req.length('minutes') <= 0) return false;

  return args.slots.some((s) => {
    const it = Interval.fromDateTimes(
      DateTime.fromISO(s.startsAt, { zone: 'utc' }),
      DateTime.fromISO(s.endsAt, { zone: 'utc' }),
    );
    // req debe estar contenido en un slot exacto (igual) o dentro
    // como tus slots son exactos duración, lo normal es igualdad:
    return it.isValid && it.equals(req);
  });
}