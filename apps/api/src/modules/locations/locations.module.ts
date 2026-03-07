import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { MetricsModule } from '../metrics/metrics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
  imports: [MetricsModule, AuditModule]
})
export class LocationsModule {}