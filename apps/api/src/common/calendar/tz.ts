import { IANAZone } from 'luxon';

export function assertIanaTimeZone(tz: string) {
  if (!IANAZone.isValidZone(tz)) {
    throw new Error('INVALID_TIMEZONE');
  }
}