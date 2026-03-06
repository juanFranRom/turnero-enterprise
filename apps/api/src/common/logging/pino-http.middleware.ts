import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from './logger';
import type { AuthUser } from '../../modules/auth/types/auth-user.type';

function safeRoute(req: Request): string {
  const baseUrl = (req as any).baseUrl ?? '';
  const routePath = (req as any).route?.path ?? '';

  if (typeof baseUrl === 'string' && typeof routePath === 'string' && baseUrl && routePath) {
    return `${baseUrl}${routePath}`; // /api/appointments/:id/history
  }

  const url = (req as any).originalUrl ?? req.url ?? '';
  return String(url).split('?')[0];
}

@Injectable()
export class PinoHttpMiddleware implements NestMiddleware {
  private readonly instanceId = crypto.randomUUID().slice(0, 8);

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;

      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

      const p = String((req as any).originalUrl ?? req.url ?? '');
      if (p.startsWith('/api/health') || p.startsWith('/api/metrics')) return;

      const auth = (req as any).auth as AuthUser | undefined;
      const user = (req as any).user as AuthUser | undefined; // fallback

      const context = {
        correlationId: req.correlationId ?? null,
        tenantId: req.tenant?.id ?? null,
        tenantSlug: req.tenant?.slug ?? (req.headers['x-tenant-slug'] as string | undefined) ?? null,
        userId: auth?.userId ?? user?.userId ?? null,
        role: auth?.role ?? user?.role ?? null,
        sid: auth?.sid ?? user?.sid ?? null,
      };

      logger[level](
        {
          instanceId: this.instanceId,
          context,
          req: { method: req.method, path: safeRoute(req) },
          res: { statusCode: status },
          responseTimeMs: Math.round(durationMs),
        },
        'request completed',
      );
    });

    next();
  }
}