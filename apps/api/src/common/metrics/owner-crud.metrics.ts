import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../modules/metrics/metrics.service';
import type {
  OwnerCrudErrorMetric,
  OwnerCrudTrackArgs,
} from './owner-crud.types';

@Injectable()
export class OwnerCrudMetrics {
  constructor(private readonly metrics: MetricsService) {}

  async track<T>(args: OwnerCrudTrackArgs<T>): Promise<T> {
    const startedAt = Date.now();

    try {
      const result = await args.run();

      this.metrics.ownerCrudRequestsTotal.inc({
        entity: args.entity,
        action: args.action,
        status: 'success',
        tenant: args.tenant,
      });

      this.metrics.ownerCrudDurationMs.observe(
        {
          entity: args.entity,
          action: args.action,
          tenant: args.tenant,
        },
        Date.now() - startedAt,
      );

      return result;
    } catch (error) {
      this.metrics.ownerCrudRequestsTotal.inc({
        entity: args.entity,
        action: args.action,
        status: 'error',
        tenant: args.tenant,
      });

      this.metrics.ownerCrudDurationMs.observe(
        {
          entity: args.entity,
          action: args.action,
          tenant: args.tenant,
        },
        Date.now() - startedAt,
      );

      throw error;
    }
  }

  validationError(args: OwnerCrudErrorMetric) {
    this.metrics.ownerCrudValidationErrorsTotal.inc({
      entity: args.entity,
      action: args.action,
      code: args.code,
      tenant: args.tenant,
    });
  }

  conflictError(args: OwnerCrudErrorMetric) {
    this.metrics.ownerCrudConflictsTotal.inc({
      entity: args.entity,
      action: args.action,
      code: args.code,
      tenant: args.tenant,
    });
  }
}