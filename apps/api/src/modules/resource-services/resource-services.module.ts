import { Module } from '@nestjs/common';
import { ResourceServicesController } from './resource-services.controller';
import { ResourceServicesService } from './resource-services.service';
import { MetricsModule } from '../metrics/metrics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  controllers: [ResourceServicesController],
  providers: [ResourceServicesService],
  exports: [ResourceServicesService],
  imports: [MetricsModule, AuditModule]
})
export class ResourceServicesModule {}