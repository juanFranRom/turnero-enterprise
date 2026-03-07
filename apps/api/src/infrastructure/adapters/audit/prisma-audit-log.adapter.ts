import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
	AuditLogPort,
	AuditLogEvent,
	GenericAuditActor,
} from './audit-log.port';

@Injectable()
export class PrismaAuditLogRepository
	implements AuditLogPort<Prisma.TransactionClient>
{
	async record(
		tx: Prisma.TransactionClient,
		actor: GenericAuditActor,
		event: AuditLogEvent,
	): Promise<void> {
		const actorType = actor.type === 'USER' ? 'USER' : 'SYSTEM';
		const actorUserId = actor.type === 'USER' ? actor.userId : null;

		await tx.auditLog.create({
			data: {
				tenantId: event.tenantId,
				entity: event.entity,
				entityId: event.entityId,
				action: event.action,
				actorType,
				actorUserId,
				before: event.before ?? Prisma.JsonNull,
				after: event.after ?? Prisma.JsonNull,
				metadata: event.metadata ?? Prisma.JsonNull,
			},
		});
	}
}