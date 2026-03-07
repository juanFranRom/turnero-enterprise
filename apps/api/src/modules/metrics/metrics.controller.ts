import { Controller, Get, Header, ForbiddenException } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getMetrics() {
    const enabled = (process.env.METRICS_ENABLED ?? 'true') === 'true';

    if (!enabled) {
      throw new ForbiddenException({
        code: 'METRICS_DISABLED',
        message: 'Metrics endpoint disabled',
      });
    }

    return await this.metrics.metricsText();
  }
}