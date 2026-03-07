export const APPOINTMENT_HISTORY_PORT = Symbol('APPOINTMENT_HISTORY_PORT');

export type AuditActor =
	| { type: 'USER'; userId: string }
	| { type: 'SYSTEM' };

export type AppointmentAuditEvent =
	| {
			kind: 'APPOINTMENT_CREATED';
			tenantId: string;
			appointmentId: string;
			locationId: string;
			resourceId: string;
			serviceId?: string | null;
			startsAt: Date;
			endsAt: Date;
	  }
	| {
			kind: 'APPOINTMENT_CANCELLED';
			tenantId: string;
			appointmentId: string;
			locationId: string;
			resourceId: string;
			serviceId?: string | null;
			startsAt: Date;
			endsAt: Date;
			reason?: string | null;
			idempotencyKey?: string | null;
	  }
	| {
			kind: 'APPOINTMENT_RESCHEDULED';
			tenantId: string;
			appointmentId: string;
			locationId: string;
			resourceId: string;
			serviceId?: string | null;
			prevStartsAt: Date;
			prevEndsAt: Date;
			newStartsAt: Date;
			newEndsAt: Date;
			reason?: string | null;
			idempotencyKey?: string | null;
	  };

export interface AppointmentHistoryPort<Tx = unknown> {
	recordAppointmentEvent(
		tx: Tx,
		actor: AuditActor,
		event: AppointmentAuditEvent,
	): Promise<void>;
}