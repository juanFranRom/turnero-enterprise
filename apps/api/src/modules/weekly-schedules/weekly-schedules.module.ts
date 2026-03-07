import { Module } from '@nestjs/common';
import { WeeklySchedulesController } from './weekly-schedules.controller';
import { WeeklySchedulesService } from './weekly-schedules.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  controllers: [WeeklySchedulesController],
  providers: [WeeklySchedulesService],
  exports: [WeeklySchedulesService],
  imports: [MetricsModule]
})
export class WeeklySchedulesModule {}