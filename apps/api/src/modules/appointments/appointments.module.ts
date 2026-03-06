import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AuditModule } from '../audit/audit.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [AuditModule, MetricsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}