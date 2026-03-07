import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  // HTTP
  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status', 'tenant'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationMs = new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in ms',
    labelNames: ['method', 'route', 'status', 'tenant'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });

  // Business
  readonly appointmentsCreatedTotal = new Counter({
    name: 'appointments_created_total',
    help: 'Total number of appointments created',
    labelNames: ['tenant'] as const,
    registers: [this.registry],
  });

  readonly appointmentsCancelledTotal = new Counter({
    name: 'appointments_cancelled_total',
    help: 'Total number of appointments cancelled',
    labelNames: ['tenant'] as const,
    registers: [this.registry],
  });

  readonly appointmentsRescheduledTotal = new Counter({
    name: 'appointments_rescheduled_total',
    help: 'Total number of appointments rescheduled',
    labelNames: ['tenant'] as const,
    registers: [this.registry],
  });

  readonly appointmentOverlapConflictsTotal = new Counter({
    name: 'appointment_overlap_conflicts_total',
    help: 'Total number of conflicts due to overlap exclusion constraint',
    labelNames: ['tenant'] as const,
    registers: [this.registry],
  });
  
  readonly availabilityOverrideOverlapConflictsTotal = new Counter({
    name: 'availability_override_overlap_conflicts_total',
    help: 'Total number of conflicts due to availability override overlap exclusion constraint',
    labelNames: ['tenant'] as const,
    registers: [this.registry],
  });

  readonly ownerCrudRequestsTotal = new Counter({
    name: 'owner_crud_requests_total',
    help: 'Total owner CRUD requests by entity/action/status',
    labelNames: ['entity', 'action', 'status', 'tenant'] as const,
    registers: [this.registry],
  });

  readonly ownerCrudDurationMs = new Histogram({
    name: 'owner_crud_duration_ms',
    help: 'Owner CRUD duration in ms by entity/action',
    labelNames: ['entity', 'action', 'tenant'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });

  readonly ownerCrudValidationErrorsTotal = new Counter({
    name: 'owner_crud_validation_errors_total',
    help: 'Total owner CRUD validation errors by entity/action/code',
    labelNames: ['entity', 'action', 'code', 'tenant'] as const,
    registers: [this.registry],
  });

  readonly ownerCrudConflictsTotal = new Counter({
    name: 'owner_crud_conflicts_total',
    help: 'Total owner CRUD conflict errors by entity/action/code',
    labelNames: ['entity', 'action', 'code', 'tenant'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'node_',
    });
  }

  async metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}