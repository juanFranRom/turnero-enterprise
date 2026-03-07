export const AUDIT_LOG_PORT = Symbol('AUDIT_LOG_PORT');

export type GenericAuditActor =
	| { type: 'USER'; userId: string }
	| { type: 'SYSTEM' };

export type AuditEntity =
	| 'LOCATION'
	| 'RESOURCE'
	| 'SERVICE'
	| 'WEEKLY_SCHEDULE'
	| 'RESOURCE_SERVICE'
	| 'AVAILABILITY_OVERRIDE';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditLogEvent = {
	tenantId: string;
	entity: AuditEntity;
	entityId: string;
	action: AuditAction;
	before?: unknown | null;
	after?: unknown | null;
	metadata?: unknown | null;
};

export interface AuditLogPort<Tx = unknown> {
	record(tx: Tx, actor: GenericAuditActor, event: AuditLogEvent): Promise<void>;
}