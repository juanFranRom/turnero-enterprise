export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Luxon DateTime.weekday => 1..7 (Mon..Sun). */
export function assertIsoWeekday(x: number): asserts x is IsoWeekday {
  if (!Number.isInteger(x) || x < 1 || x > 7) {
    throw new Error('INVALID_ISO_WEEKDAY');
  }
}

/** JS Date.getDay() => 0..6 (Sun..Sat)  -> ISO 1..7 (Mon..Sun) */
export function jsDayToIsoWeekday(jsDay: number): IsoWeekday {
  if (!Number.isInteger(jsDay) || jsDay < 0 || jsDay > 6) {
    throw new Error('INVALID_JS_WEEKDAY');
  }
  return (jsDay === 0 ? 7 : jsDay) as IsoWeekday;
}

/** ISO 1..7 (Mon..Sun) -> JS 0..6 (Sun..Sat) */
export function isoWeekdayToJsDay(iso: IsoWeekday): number {
  return iso === 7 ? 0 : iso;
}