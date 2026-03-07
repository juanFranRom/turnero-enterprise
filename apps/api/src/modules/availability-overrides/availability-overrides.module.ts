import { Module } from '@nestjs/common';
import { AvailabilityOverridesController } from './availability-overrides.controller';
import { AvailabilityOverridesService } from './availability-overrides.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MetricsModule } from '../metrics/metrics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  controllers: [AvailabilityOverridesController],
  providers: [AvailabilityOverridesService, PrismaService],
  exports: [AvailabilityOverridesService],
  imports: [MetricsModule, AuditModule]
})
export class AvailabilityOverridesModule {}