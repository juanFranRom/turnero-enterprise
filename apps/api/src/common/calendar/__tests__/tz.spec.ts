import { assertIanaTimeZone } from '../tz';

describe('calendar/tz', () => {
  it('accepts valid IANA zones', () => {
    expect(() => assertIanaTimeZone('UTC')).not.toThrow();
    expect(() => assertIanaTimeZone('America/Argentina/San_Luis')).not.toThrow();
    expect(() => assertIanaTimeZone('Europe/London')).not.toThrow();
  });

  it('rejects invalid zones', () => {
    expect(() => assertIanaTimeZone('Mars/Olympus')).toThrow('INVALID_TIMEZONE');
    expect(() => assertIanaTimeZone('')).toThrow('INVALID_TIMEZONE');
    expect(() => assertIanaTimeZone('UTC+3')).toThrow('INVALID_TIMEZONE'); // no es IANA
  });
});