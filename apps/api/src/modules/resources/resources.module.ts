import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
  imports: [MetricsModule]
})
export class ResourcesModule {}