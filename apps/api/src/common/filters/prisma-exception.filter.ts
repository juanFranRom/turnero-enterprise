// src/common/filters/prisma-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { logger } from '../logging/logger';
import { MetricsService } from '../../modules/metrics/metrics.service';

type PgError = Error & {
  code?: string;       // SQLSTATE (e.g. 23P01, 23505)
  constraint?: string; // nombre constraint (a veces viene)
  detail?: string;
};

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(private readonly metrics: MetricsService) {} // ✅ DI

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse();

    const pg = this.extractPgError(exception as any);
    const sqlstate = pg?.code;

    const logCtx = {
      correlationId: (req as any).correlationId ?? null,
      tenantId: (req as any).tenant?.id ?? null,
      tenantSlug: (req as any).tenant?.slug ?? null,
      userId: (req as any).user?.userId ?? (req as any).auth?.userId ?? null, // ✅ prefer req.user (Passport)
      role: (req as any).user?.role ?? (req as any).auth?.role ?? null,
      sid: (req as any).user?.sid ?? (req as any).auth?.sid ?? null,

      method: req.method,
      path: (req as any).originalUrl ?? req.url,

      prisma: {
        kind:
          exception instanceof Prisma.PrismaClientKnownRequestError
            ? 'known'
            : exception instanceof Prisma.PrismaClientUnknownRequestError
              ? 'unknown'
              : 'non_prisma',
        prismaCode:
          exception instanceof Prisma.PrismaClientKnownRequestError
            ? exception.code
            : undefined,
      },

      pg: sqlstate
        ? {
            sqlstate,
            constraint: (pg as any)?.constraint,
            detail: (pg as any)?.detail,
          }
        : undefined,
    };

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapKnownPrismaError(exception);
      if (mapped) {
        const lvl = mapped.status >= 500 ? 'error' : mapped.status >= 400 ? 'warn' : 'info';
        logger[lvl](
          { ...logCtx, err: exception, responseStatus: mapped.status, responseCode: mapped.body?.error?.code },
          'Prisma known error mapped',
        );
        return res.status(mapped.status).json(mapped.body);
      }

      const mappedPg = this.tryMapPg(exception);
      if (mappedPg) {
        // ✅ overlap counter
        if (sqlstate === '23P01') {
          const constraint = pg?.constraint ?? '';
          const detail = pg?.detail ?? '';

          const tenant =
            (req as any).tenant?.slug ??
            (req.headers['x-tenant-slug'] as string | undefined) ??
            'unknown';

          const isAppointmentOverlap =
            constraint.includes('appointment_no_overlap') ||
            detail.includes('appointment_no_overlap');

          const isAvailabilityOverrideOverlap =
            constraint.includes('availability_override_no_overlap') ||
            detail.includes('availability_override_no_overlap');

          if (isAppointmentOverlap) {
            this.metrics.appointmentOverlapConflictsTotal.inc({ tenant });
          }

          if (isAvailabilityOverrideOverlap) {
            this.metrics.availabilityOverrideOverlapConflictsTotal.inc({ tenant });
          }
        }

        const lvl = mappedPg.status >= 500 ? 'error' : mappedPg.status >= 400 ? 'warn' : 'info';
        logger[lvl](
          { ...logCtx, err: exception, responseStatus: mappedPg.status, responseCode: mappedPg.body?.error?.code },
          'Postgres sqlstate mapped from Prisma known error',
        );
        return res.status(mappedPg.status).json(mappedPg.body);
      }

      logger.error(
        { ...logCtx, err: exception },
        `Unhandled PrismaClientKnownRequestError`,
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected database error',
        },
      });
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      const mappedPg = this.tryMapPg(exception);
      if (mappedPg) {
        // ✅ overlap counter
        if (sqlstate === '23P01') {
          const constraint = pg?.constraint ?? '';
          const detail = pg?.detail ?? '';

          const tenant =
            (req as any).tenant?.slug ??
            (req.headers['x-tenant-slug'] as string | undefined) ??
            'unknown';

          const isAppointmentOverlap =
            constraint.includes('appointment_no_overlap') ||
            detail.includes('appointment_no_overlap');

          const isAvailabilityOverrideOverlap =
            constraint.includes('availability_override_no_overlap') ||
            detail.includes('availability_override_no_overlap');

          if (isAppointmentOverlap) {
            this.metrics.appointmentOverlapConflictsTotal.inc({ tenant });
          }

          if (isAvailabilityOverrideOverlap) {
            this.metrics.availabilityOverrideOverlapConflictsTotal.inc({ tenant });
          }
        }

        const lvl = mappedPg.status >= 500 ? 'error' : mappedPg.status >= 400 ? 'warn' : 'info';
        logger[lvl](
          { ...logCtx, err: exception, responseStatus: mappedPg.status, responseCode: mappedPg.body?.error?.code },
          'Postgres sqlstate mapped from Prisma unknown error',
        );
        return res.status(mappedPg.status).json(mappedPg.body);
      }

      logger.error(
        { ...logCtx, err: exception },
        'PrismaClientUnknownRequestError (unmapped)',
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected database error' },
      });
    }

    logger.error(
      { ...logCtx, err: exception as any },
      'Non-prisma exception reached PrismaExceptionFilter',
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
    });
  }

  private mapKnownPrismaError(
    e: Prisma.PrismaClientKnownRequestError,
  ): { status: number; body: any } | null {
    switch (e.code) {
      case 'P2002': // Unique constraint failed
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'UNIQUE_VIOLATION',
              message: 'A record with the same unique key already exists',
              details: { target: (e.meta as any)?.target },
            },
          },
        };

      case 'P2025': // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            error: {
              code: 'NOT_FOUND',
              message: 'Record not found',
            },
          },
        };

      case 'P2003': // FK failed
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'FK_VIOLATION',
              message: 'Related record not found (foreign key constraint)',
              details: { field_name: (e.meta as any)?.field_name },
            },
          },
        };

      default:
        return null;
    }
  }

  /**
   * Intenta mapear SQLSTATE de Postgres.
   * Prisma 6 a veces NO expone cause.code de forma estructurada (viene embebido en message),
   * especialmente para EXCLUSION CONSTRAINT (23P01).
   */
  private tryMapPg(e: any): { status: number; body: any } | null {
    const pg = this.extractPgError(e);
    const sqlstate = pg?.code;
    const constraint = pg?.constraint ?? '';
    const detail = pg?.detail ?? '';

    if (!sqlstate) return null;

    if (sqlstate === '23P01') {
      const isAppointmentOverlap =
        constraint.includes('appointment_no_overlap') ||
        detail.includes('appointment_no_overlap');

      if (isAppointmentOverlap) {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'APPOINTMENT_OVERLAP',
              message: 'The appointment overlaps an existing booking',
            },
          },
        };
      }

      const isAvailabilityOverrideOverlap =
        constraint.includes('availability_override_no_overlap') ||
        detail.includes('availability_override_no_overlap');

      if (isAvailabilityOverrideOverlap) {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'AVAILABILITY_OVERRIDE_OVERLAP',
              message: 'Availability override overlaps an existing override',
            },
          },
        };
      }

      return {
        status: HttpStatus.CONFLICT,
        body: {
          error: {
            code: 'EXCLUSION_CONSTRAINT_VIOLATION',
            message: 'Database exclusion constraint violation',
            details: pg?.detail ? { detail: pg.detail } : undefined,
          },
        },
      };
    }

    if (sqlstate === '23505') {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          error: {
            code: 'UNIQUE_VIOLATION',
            message: 'A record with the same unique key already exists',
          },
        },
      };
    }

    if (sqlstate === '23503') {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          error: {
            code: 'FK_VIOLATION',
            message: 'Foreign key constraint violation',
          },
        },
      };
    }

    if (sqlstate === '23514') {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: 'CHECK_VIOLATION',
            message: 'Check constraint violation',
          },
        },
      };
    }

    if (sqlstate.startsWith('23')) {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          error: {
            code: 'INTEGRITY_VIOLATION',
            message: 'Database integrity constraint violation',
            details: pg?.detail ? { detail: pg.detail } : undefined,
          },
        },
      };
    }

    return null;
  }

  private extractPgError(e: any): PgError | null {
    const cause: PgError | undefined =
      (e?.cause as PgError) ||
      (e?.meta?.cause as PgError) ||
      (typeof e?.meta === 'object' ? (e.meta as any)?.cause : undefined);

    if (cause?.code) return cause;

    const msg = String(e?.message ?? '');

    const codeMatch =
      msg.match(/code:\s*"(\w+)"/) ??
      msg.match(/PostgresError\s*\{\s*code:\s*"(\w+)"/);

    if (!codeMatch?.[1]) return null;

    const detailMatch =
      msg.match(/detail:\s*Some\("([^"]+)"\)/) ??
      msg.match(/detail:\s*"([^"]+)"/);

    const constraintMatch =
      msg.match(/constraint:\s*Some\("([^"]+)"\)/) ??
      msg.match(/constraint:\s*"([^"]+)"/) ??
      msg.match(/violates exclusion constraint "([^"]+)"/) ??
      msg.match(/violates unique constraint "([^"]+)"/) ??
      msg.match(/violates foreign key constraint "([^"]+)"/) ??
      msg.match(/violates check constraint "([^"]+)"/);

    const out: PgError = new Error('PostgresError');
    out.code = codeMatch[1];

    if (detailMatch?.[1]) out.detail = detailMatch[1];
    if (constraintMatch?.[1]) out.constraint = constraintMatch[1];

    return out;
  }
}