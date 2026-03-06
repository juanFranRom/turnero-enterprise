import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../../modules/metrics/metrics.service';

function safeRoute(req: any): string {
  const baseUrl = req.baseUrl ?? '';
  const route = req.route;

  // caso ideal → /api/appointments/:id/reschedule
  if (route?.path) {
    return `${baseUrl}${route.path}`;
  }

  // si no existe route todavía, intentamos reconstruir desde baseUrl
  if (baseUrl) {
    return baseUrl;
  }

  // fallback final (solo para cosas como /api/auth/login)
  const url = req.originalUrl ?? req.url ?? '';
  return String(url).split('?')[0];
}

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;

      const path = String((req as any).originalUrl ?? req.url ?? '');
      if (path.startsWith('/api/metrics') || path.startsWith('/api/health')) return;

      const route = safeRoute(req as any);
      const status = String(res.statusCode);

      const tenant =
        (req as any).tenant?.slug ??
        (req.headers['x-tenant-slug'] as string | undefined) ??
        'unknown';

      this.metrics.httpRequestsTotal.inc({
        method: req.method,
        route,
        status,
        tenant,
      });

      this.metrics.httpRequestDurationMs.observe(
        { method: req.method, route, status, tenant },
        durationMs,
      );
    });

    next();
  }
}