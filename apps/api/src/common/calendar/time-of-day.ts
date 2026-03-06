export type TimeHHmm = string;

export type TimeOfDay = { hh: number; mm: number };

export function parseHHmm(value: string): TimeOfDay {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error('INVALID_TIME_HHMM');

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error('INVALID_TIME_HHMM');
  }
  return { hh, mm };
}

/** Representación compatible con Prisma @db.Time(0): Date fija en UTC */
export function hhmmToDbTime(value: string): Date {
  const { hh, mm } = parseHHmm(value);
  return new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
}

export function dbTimeToHHmm(d: Date): string {
  // d es Date, pero representa solo tiempo (UTC)
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}