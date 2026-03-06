import { dbTimeToHHmm, hhmmToDbTime, parseHHmm } from '../time-of-day';

describe('calendar/time-of-day', () => {
  describe('parseHHmm', () => {
    it('parses valid HH:mm', () => {
      expect(parseHHmm('00:00')).toEqual({ hh: 0, mm: 0 });
      expect(parseHHmm('09:05')).toEqual({ hh: 9, mm: 5 });
      expect(parseHHmm('23:59')).toEqual({ hh: 23, mm: 59 });
    });

    it('rejects invalid formats', () => {
      const bad = [
        '',
        '9:00',     // must be 2 digits
        '09:0',
        '24:00',
        '23:60',
        'aa:bb',
        '12-30',
        '1234',
      ];
      for (const v of bad) {
        expect(() => parseHHmm(v)).toThrow('INVALID_TIME_HHMM');
      }
    });
  });

  describe('hhmmToDbTime', () => {
    it('converts HH:mm to UTC Date at 1970-01-01', () => {
      expect(hhmmToDbTime('09:30').toISOString()).toBe('1970-01-01T09:30:00.000Z');
      expect(hhmmToDbTime('00:00').toISOString()).toBe('1970-01-01T00:00:00.000Z');
      expect(hhmmToDbTime('23:59').toISOString()).toBe('1970-01-01T23:59:00.000Z');
    });

    it('rejects invalid HH:mm', () => {
      expect(() => hhmmToDbTime('99:99')).toThrow('INVALID_TIME_HHMM');
      expect(() => hhmmToDbTime('9:00')).toThrow('INVALID_TIME_HHMM');
    });
  });

  describe('dbTimeToHHmm', () => {
    it('formats UTC Date as HH:mm (UTC)', () => {
      expect(dbTimeToHHmm(new Date('1970-01-01T09:30:00.000Z'))).toBe('09:30');
      expect(dbTimeToHHmm(new Date('1970-01-01T00:00:00.000Z'))).toBe('00:00');
      expect(dbTimeToHHmm(new Date('1970-01-01T23:59:00.000Z'))).toBe('23:59');
    });

    it('round-trips HH:mm -> dbTime -> HH:mm', () => {
      const times = ['00:00', '01:05', '09:30', '12:00', '23:59'];
      for (const t of times) {
        const d = hhmmToDbTime(t);
        expect(dbTimeToHHmm(d)).toBe(t);
      }
    });
  });
});