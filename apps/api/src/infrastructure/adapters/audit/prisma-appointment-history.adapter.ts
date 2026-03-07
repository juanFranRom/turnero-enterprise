import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
	AppointmentHistoryPort,
	AppointmentAuditEvent,
	AuditActor,
} from './appointment-history.port';

@Injectable()
export class PrismaAppointmentHistoryRepository
	implements AppointmentHistoryPort<Prisma.TransactionClient>
{
	async recordAppointmentEvent(
		tx: Prisma.TransactionClient,
		actor: AuditActor,
		event: AppointmentAuditEvent,
	): Promise<void> {
		const actorType = actor.type === 'USER' ? 'USER' : 'SYSTEM';
		const actorUserId = actor.type === 'USER' ? actor.userId : null;

		if (event.kind === 'APPOINTMENT_CREATED') {
			await tx.appointmentHistory.create({
				data: {
					tenantId: event.tenantId,
					appointmentId: event.appointmentId,
					action: 'CREATED',
					actorType,
					actorUserId,
					locationId: event.locationId,
					resourceId: event.resourceId,
					serviceId: event.serviceId ?? null,
					newStartsAt: event.startsAt,
					newEndsAt: event.endsAt,
				},
			});
			return;
		}

		if (event.kind === 'APPOINTMENT_CANCELLED') {
			await tx.appointmentHistory.create({
				data: {
					tenantId: event.tenantId,
					appointmentId: event.appointmentId,
					action: 'CANCELLED',
					actorType,
					actorUserId,
					locationId: event.locationId,
					resourceId: event.resourceId,
					serviceId: event.serviceId ?? null,
					newStartsAt: event.startsAt,
					newEndsAt: event.endsAt,
					reason: event.reason ?? null,
					idempotencyKey: event.idempotencyKey ?? null,
				},
			});
			return;
		}

		await tx.appointmentHistory.create({
			data: {
				tenantId: event.tenantId,
				appointmentId: event.appointmentId,
				action: 'RESCHEDULED',
				actorType,
				actorUserId,
				locationId: event.locationId,
				resourceId: event.resourceId,
				serviceId: event.serviceId ?? null,
				prevStartsAt: event.prevStartsAt,
				prevEndsAt: event.prevEndsAt,
				newStartsAt: event.newStartsAt,
				newEndsAt: event.newEndsAt,
				reason: event.reason ?? null,
				idempotencyKey: event.idempotencyKey ?? null,
			},
		});
	}
}