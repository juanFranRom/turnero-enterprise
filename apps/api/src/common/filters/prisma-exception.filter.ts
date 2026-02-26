// src/common/filters/prisma-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type PgError = Error & {
  code?: string;       // SQLSTATE (e.g. 23P01, 23505)
  constraint?: string; // nombre constraint (a veces viene)
  detail?: string;
};

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // Known Prisma errors (P20xx)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapKnownPrismaError(exception);
      if (mapped) return res.status(mapped.status).json(mapped.body);

      // En algunos casos Prisma encapsula error PG en meta/cause
      const mappedPg = this.tryMapPg(exception);
      if (mappedPg) return res.status(mappedPg.status).json(mappedPg.body);

      this.logger.error(
        `Unhandled PrismaClientKnownRequestError code=${exception.code}`,
        exception.stack,
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected database error',
        },
      });
    }

    // Unknown Prisma errors (pueden tener cause PG)
    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      const mappedPg = this.tryMapPg(exception);
      if (mappedPg) return res.status(mappedPg.status).json(mappedPg.body);

      this.logger.error('PrismaClientUnknownRequestError', exception.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected database error' },
      });
    }

    // No debería entrar acá por el @Catch, pero por las dudas
    this.logger.error('Non-prisma exception reached PrismaExceptionFilter');
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
    });
  }

  private mapKnownPrismaError(e: Prisma.PrismaClientKnownRequestError):
    | { status: number; body: any }
    | null {
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

      // Si querés: P2003 FK en prisma (a veces aparece)
      case 'P2003':
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
   * Intenta mapear SQLSTATE de Postgres si viene embebido en `cause` o `meta`.
   * Para tu caso clave: 23P01 -> overlap
   */
  private tryMapPg(e: any): { status: number; body: any } | null {
    const cause: PgError | undefined =
      (e?.cause as PgError) ||
      (e?.meta?.cause as PgError) ||
      (typeof e?.meta === 'object' ? (e.meta as any)?.cause : undefined);

    const sqlstate = cause?.code;

    if (!sqlstate) return null;

    // Caso estrella de Turnero: EXCLUSION CONSTRAINT violation
    if (sqlstate === '23P01') {
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

    // Otros 23xxx: integridad
    if (sqlstate.startsWith('23')) {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          error: {
            code: 'INTEGRITY_VIOLATION',
            message: 'Database integrity constraint violation',
          },
        },
      };
    }

    return null;
  }
}