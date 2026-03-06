import { encodeCursor, decodeCursor } from './cursor.codec';

describe('cursor.codec', () => {
  it('roundtrips encode/decode', () => {
    const raw = encodeCursor({
      v: 1,
      tenantId: 't1',
      scope: { appointmentId: 'a1' },
      at: '2026-02-23T12:00:00.000Z',
      id: 'h1',
    });

    const decoded = decodeCursor<{ appointmentId: string }>(raw);
    expect(decoded.v).toBe(1);
    expect(decoded.tenantId).toBe('t1');
    expect(decoded.scope.appointmentId).toBe('a1');
    expect(decoded.at).toBe('2026-02-23T12:00:00.000Z');
    expect(decoded.id).toBe('h1');
  });

  it('rejects invalid cursor (not base64/json)', () => {
    expect(() => decodeCursor<any>('not-a-cursor')).toThrow();
  });

  it('rejects invalid cursor shape', () => {
    const bad = Buffer.from(JSON.stringify({ v: 1 }), 'utf8').toString('base64url');
    expect(() => decodeCursor<any>(bad)).toThrow();
  });
});