import {
  assertIsoWeekday,
  isoWeekdayToJsDay,
  jsDayToIsoWeekday,
} from '../weekday';

describe('calendar/weekday', () => {
  describe('assertIsoWeekday', () => {
    it('accepts 1..7', () => {
      for (let i = 1; i <= 7; i++) {
        expect(() => assertIsoWeekday(i)).not.toThrow();
      }
    });

    it('rejects 0, 8, negatives, non-integers', () => {
      const bad = [0, 8, -1, 1.2, NaN, Infinity] as any[];
      for (const v of bad) {
        expect(() => assertIsoWeekday(v)).toThrow('INVALID_ISO_WEEKDAY');
      }
    });
  });

  describe('jsDayToIsoWeekday', () => {
    it('maps JS getDay() to ISO weekday', () => {
      // JS: 0=Sun..6=Sat  => ISO: 7=Sun, 1=Mon..6=Sat
      expect(jsDayToIsoWeekday(0)).toBe(7);
      expect(jsDayToIsoWeekday(1)).toBe(1);
      expect(jsDayToIsoWeekday(2)).toBe(2);
      expect(jsDayToIsoWeekday(3)).toBe(3);
      expect(jsDayToIsoWeekday(4)).toBe(4);
      expect(jsDayToIsoWeekday(5)).toBe(5);
      expect(jsDayToIsoWeekday(6)).toBe(6);
    });

    it('rejects values outside 0..6', () => {
      const bad = [-1, 7, 999, 1.1, NaN] as any[];
      for (const v of bad) {
        expect(() => jsDayToIsoWeekday(v)).toThrow('INVALID_JS_WEEKDAY');
      }
    });
  });

  describe('isoWeekdayToJsDay', () => {
    it('maps ISO weekday to JS getDay()', () => {
      // ISO: 1=Mon..7=Sun => JS: 1=Mon..6=Sat, 0=Sun
      expect(isoWeekdayToJsDay(1)).toBe(1);
      expect(isoWeekdayToJsDay(2)).toBe(2);
      expect(isoWeekdayToJsDay(3)).toBe(3);
      expect(isoWeekdayToJsDay(4)).toBe(4);
      expect(isoWeekdayToJsDay(5)).toBe(5);
      expect(isoWeekdayToJsDay(6)).toBe(6);
      expect(isoWeekdayToJsDay(7)).toBe(0);
    });

    it('round-trips jsDay <-> isoWeekday for all days', () => {
      for (let js = 0; js <= 6; js++) {
        const iso = jsDayToIsoWeekday(js);
        const js2 = isoWeekdayToJsDay(iso);
        expect(js2).toBe(js);
      }
    });
  });
});