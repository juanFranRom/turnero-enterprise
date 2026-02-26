export class OutsideAvailabilityError extends Error {
  code = 'OUTSIDE_AVAILABILITY' as const;
  constructor(message = 'Requested time is outside availability') {
    super(message);
  }
}