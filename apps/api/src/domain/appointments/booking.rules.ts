import { DateTime } from 'luxon';
import { DomainError } from './appointment.lifecycle';

export function assertValidTimeRange(startsAt: Date, endsAt: Date) {
  if (!(endsAt > startsAt)) {
    throw new DomainError('INVALID_TIME_RANGE', 'endsAt must be after startsAt');
  }
}

export function assertDurationMatchesService(
  startsAtUtc: DateTime,
  endsAtUtc: DateTime,
  expectedMinutes: number,
) {
  const minutes = Math.round(endsAtUtc.diff(startsAtUtc, 'minutes').minutes);
  if (minutes !== expectedMinutes) {
    throw new DomainError('INVALID_DURATION', `Duration must be ${expectedMinutes} minutes`, {
      durationMinutes: minutes,
      expected: expectedMinutes,
    });
  }
}