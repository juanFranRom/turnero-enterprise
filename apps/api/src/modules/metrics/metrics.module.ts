import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { OwnerCrudMetrics } from '../../common/metrics';

@Module({
  providers: [MetricsService, OwnerCrudMetrics],
  controllers: [MetricsController],
  exports: [MetricsService, OwnerCrudMetrics],
})
export class MetricsModule {}