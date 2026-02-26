import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class RetryAfter429Filter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const body = exception.getResponse();

    // Sólo nos importa 429
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfterSec =
        typeof body === 'object' && body && 'retryAfterSec' in body
          ? Number((body as any).retryAfterSec)
          : NaN;

      if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
        res.setHeader('Retry-After', String(retryAfterSec));
      }
    }

    // Respuesta estándar de Nest
    res.status(status).json(body);
  }
}