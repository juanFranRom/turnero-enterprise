import { Module } from '@nestjs/common';
import { APPOINTMENT_HISTORY_PORT } from '../../infrastructure/adapters/audit/appointment-history.port';
import { PrismaAppointmentHistoryRepository } from '../../infrastructure/adapters/audit/prisma-appointment-history.adapter';
import { AUDIT_LOG_PORT } from '../../infrastructure/adapters/audit/audit-log.port';
import { PrismaAuditLogRepository } from '../../infrastructure/adapters/audit/prisma-audit-log.adapter';

@Module({
	providers: [
		PrismaAppointmentHistoryRepository,
		{ provide: APPOINTMENT_HISTORY_PORT, useExisting: PrismaAppointmentHistoryRepository },

		PrismaAuditLogRepository,
		{ provide: AUDIT_LOG_PORT, useExisting: PrismaAuditLogRepository },
	],
	exports: [APPOINTMENT_HISTORY_PORT, AUDIT_LOG_PORT],
})
export class AuditModule {}