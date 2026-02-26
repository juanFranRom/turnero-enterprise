export type AppointmentStatus = 'BOOKED' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW';

export function assertCanCancel(status: AppointmentStatus) {
  if (status === 'CANCELLED') return; // idempotente
  if (status !== 'BOOKED' && status !== 'CONFIRMED') {
    throw new DomainError('APPOINTMENT_INVALID_TRANSITION', `Cannot cancel from ${status}`);
  }
}

export function assertCanReschedule(status: AppointmentStatus) {
  if (status !== 'BOOKED' && status !== 'CONFIRMED') {
    throw new DomainError('APPOINTMENT_INVALID_TRANSITION', `Cannot reschedule from ${status}`);
  }
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}