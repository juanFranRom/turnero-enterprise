import { Module } from '@nestjs/common';
import { AUDIT_PORT } from '../../domain/audit/audit.port';
import { PrismaAuditRepository } from '../../infrastructure/adapters/audit/prisma-audit.adapter';

@Module({
  providers: [
    PrismaAuditRepository,
    { provide: AUDIT_PORT, useExisting: PrismaAuditRepository },
  ],
  exports: [AUDIT_PORT],
})
export class AuditModule {}