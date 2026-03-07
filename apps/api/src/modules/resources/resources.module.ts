import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { MetricsModule } from '../metrics/metrics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
  imports: [MetricsModule, AuditModule]
})
export class ResourcesModule {}