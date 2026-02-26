import { AvailabilityEngine } from './availability.engine';

function makeWeekly(day: 1|2|3|4|5|6|7, start: string, end: string) {
  return {
    timezone: 'America/Argentina/San_Luis',
    days: { [day]: [{ start, end }] },
  } as any;
}

describe('AvailabilityEngine', () => {
  const tz = 'America/Argentina/San_Luis';

  it('generates slots for a simple weekly interval (30m)', () => {
    const engine = new AvailabilityEngine();

    // 2026-02-23 fue lunes (weekday=1 en Luxon)
    const res = engine.compute({
      timezone: tz,
      range: { from: '2026-02-23T00:00:00', to: '2026-02-24T00:00:00' },
      weekly: makeWeekly(1, '09:00', '10:00'),
      overrides: [],
      busy: [],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      stepMinutes: 30,
    });

    expect(res.slots).toHaveLength(2);
  });

  it('removes a slot when there is a busy appointment overlapping it', () => {
    const engine = new AvailabilityEngine();

    const res = engine.compute({
      timezone: tz,
      range: { from: '2026-02-23T00:00:00', to: '2026-02-24T00:00:00' },
      weekly: makeWeekly(1, '09:00', '10:00'),
      overrides: [],
      busy: [
        // busy 09:00-09:30 UTC? ojo: el engine interpreta busy en UTC y lo pasa a tz.
        // Para evitar confusión, usamos el mismo ISO que te devuelve el sistema (UTC ISO).
        { startsAt: '2026-02-23T12:00:00.000Z', endsAt: '2026-02-23T12:30:00.000Z' },
      ],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      stepMinutes: 30,
    });

    // Si tu 09:00 local equivale a 12:00Z (UTC-3), debería desaparecer ese slot.
    // Queda solo 09:30-10:00 local => 12:30Z-13:00Z
    expect(res.slots).toHaveLength(1);
    expect(res.slots[0].startsAt).toBe('2026-02-23T12:30:00.000Z');
  });

  it('BLOCK override closes availability inside the open interval', () => {
    const engine = new AvailabilityEngine();

    const res = engine.compute({
      timezone: tz,
      range: { from: '2026-02-23T00:00:00', to: '2026-02-24T00:00:00' },
      weekly: makeWeekly(1, '09:00', '10:00'),
      overrides: [
        // bloquea 09:30-10:00 local => 12:30Z-13:00Z
        { type: 'CLOSED', startsAt: '2026-02-23T12:30:00.000Z', endsAt: '2026-02-23T13:00:00.000Z' },
      ],
      busy: [],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      stepMinutes: 30,
    });

    expect(res.slots).toHaveLength(1);
    expect(res.slots[0].startsAt).toBe('2026-02-23T12:00:00.000Z');
  });

  it('EXTRA override opens availability even if weekly schedule is empty', () => {
    const engine = new AvailabilityEngine();

    const res = engine.compute({
      timezone: tz,
      range: { from: '2026-02-23T00:00:00', to: '2026-02-24T00:00:00' },
      weekly: { timezone: tz, days: {} },
      overrides: [
        // abre 09:00-10:00 local
        { type: 'OPEN', startsAt: '2026-02-23T12:00:00.000Z', endsAt: '2026-02-23T13:00:00.000Z' },
      ],
      busy: [],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      stepMinutes: 30,
    });

    expect(res.slots).toHaveLength(2);
  });

  it('buffers: busy interval is expanded so next slot is pushed (5m/5m)', () => {
    const engine = new AvailabilityEngine();

    const res = engine.compute({
      timezone: tz,
      range: { from: '2026-02-23T00:00:00', to: '2026-02-24T00:00:00' },
      weekly: makeWeekly(1, '09:00', '11:00'),
      overrides: [],
      busy: [
        // turno real 09:00-09:30 local (12:00Z-12:30Z)
        { startsAt: '2026-02-23T12:00:00.000Z', endsAt: '2026-02-23T12:30:00.000Z' },
      ],
      service: { durationMinutes: 30, bufferBeforeMinutes: 5, bufferAfterMinutes: 5 },
      stepMinutes: 30,
    });

    // Con buffers, el bloque ocupado es 08:55-09:35 local
    // El siguiente slot real debería arrancar 09:40 local (12:40Z) si la lógica empuja por buffers + step=30.
    // Ojo: si tu step es duration, el engine genera candidatos cada 30m de base
    // y aplica bufBefore al output. Entonces lo esperable es:
    // candidatos: 09:00, 09:30, 10:00...
    // slot real = candidato + 5m => 09:05, 09:35, 10:05...
    // El de 09:35 debería ser inválido por busy extendido hasta 09:35 (border), y el próximo será 10:05.
    // Este test valida que NO aparezca 09:35-10:05.
    const has0935 = res.slots.some(s => s.startsAt === '2026-02-23T12:35:00.000Z');
    expect(has0935).toBe(false);
  });

  it('returns sorted unique slots', () => {
    const engine = new AvailabilityEngine();

    const res = engine.compute({
      timezone: tz,
      range: { from: '2026-02-23T00:00:00', to: '2026-02-24T00:00:00' },
      weekly: makeWeekly(1, '09:00', '10:00'),
      overrides: [
        // agrega el mismo intervalo abierto (podría duplicar si no se uniqea)
        { type: 'OPEN', startsAt: '2026-02-23T12:00:00.000Z', endsAt: '2026-02-23T13:00:00.000Z' },
      ],
      busy: [],
      service: { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
      stepMinutes: 30,
    });

    // debería seguir siendo 2, no 4
    expect(res.slots).toHaveLength(2);
    expect([...res.slots].sort((a,b)=>a.startsAt.localeCompare(b.startsAt))).toEqual(res.slots);
  });
});