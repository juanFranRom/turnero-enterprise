import { assertIntervalValid, overlaps } from '../intervals';

describe('calendar/intervals', () => {
  describe('assertIntervalValid', () => {
    it('accepts end > start', () => {
      const start = new Date('2026-02-23T10:00:00.000Z');
      const end = new Date('2026-02-23T10:30:00.000Z');
      expect(() => assertIntervalValid({ start, end })).not.toThrow();
    });

    it('rejects end == start', () => {
      const start = new Date('2026-02-23T10:00:00.000Z');
      const end = new Date('2026-02-23T10:00:00.000Z');
      expect(() => assertIntervalValid({ start, end })).toThrow('INVALID_INTERVAL');
    });

    it('rejects end < start', () => {
      const start = new Date('2026-02-23T10:00:00.000Z');
      const end = new Date('2026-02-23T09:59:00.000Z');
      expect(() => assertIntervalValid({ start, end })).toThrow('INVALID_INTERVAL');
    });
  });

  describe('overlaps [start,end) semantics', () => {
    it('overlaps when intervals intersect', () => {
      const a = { start: new Date('2026-02-23T10:00:00.000Z'), end: new Date('2026-02-23T10:30:00.000Z') };
      const b = { start: new Date('2026-02-23T10:15:00.000Z'), end: new Date('2026-02-23T10:45:00.000Z') };
      expect(overlaps(a, b)).toBe(true);
      expect(overlaps(b, a)).toBe(true);
    });

    it('does not overlap when one ends exactly at the other start', () => {
      // [10:00,10:30) and [10:30,11:00) do NOT overlap
      const a = { start: new Date('2026-02-23T10:00:00.000Z'), end: new Date('2026-02-23T10:30:00.000Z') };
      const b = { start: new Date('2026-02-23T10:30:00.000Z'), end: new Date('2026-02-23T11:00:00.000Z') };
      expect(overlaps(a, b)).toBe(false);
      expect(overlaps(b, a)).toBe(false);
    });

    it('does not overlap when separated', () => {
      const a = { start: new Date('2026-02-23T10:00:00.000Z'), end: new Date('2026-02-23T10:30:00.000Z') };
      const b = { start: new Date('2026-02-23T11:00:00.000Z'), end: new Date('2026-02-23T11:30:00.000Z') };
      expect(overlaps(a, b)).toBe(false);
    });

    it('overlap when b fully contained in a', () => {
      const a = { start: new Date('2026-02-23T10:00:00.000Z'), end: new Date('2026-02-23T11:00:00.000Z') };
      const b = { start: new Date('2026-02-23T10:15:00.000Z'), end: new Date('2026-02-23T10:45:00.000Z') };
      expect(overlaps(a, b)).toBe(true);
    });
  });
});