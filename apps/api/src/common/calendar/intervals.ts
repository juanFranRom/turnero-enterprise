export type TimeInterval = { start: Date; end: Date };

export function assertIntervalValid(i: TimeInterval) {
  if (i.end.getTime() <= i.start.getTime()) {
    throw new Error('INVALID_INTERVAL');
  }
}

/** Overlap con semántica [start,end) como usás en Appointment */
export function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}