import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { MetricsModule } from '../metrics/metrics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
  imports: [MetricsModule, AuditModule]
})
export class ServicesModule {}