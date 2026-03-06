import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import crypto from 'crypto';

function sha16(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function getRealIp(req: Request): string {
  // con trust proxy, Express llena req.ips/req.ip de forma segura
  const anyReq = req as any;
  if (Array.isArray(anyReq.ips) && anyReq.ips.length) return anyReq.ips[0];
  return (anyReq.ip as string) || req.socket.remoteAddress || 'unknown';
}

@Injectable()
export class TurneroThrottlerGuard extends ThrottlerGuard {

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & any>();

    if (req?.headers?.['x-e2e'] === '1') {
      return true;
    }

    if (process.env.NODE_ENV === 'test' || process.env.E2E === '1') {
      return true;
    }

    return super.canActivate(context);
  }

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const r = req as Request & any;

    const tenantSlug =
      (r.headers?.['x-tenant-slug'] as string) ||
      r.tenant?.slug ||
      'no-tenant';

    // Si ya hay usuario autenticado, preferí userId (más justo que IP)
    const userId = r.auth?.userId ?? r.auth?.sub ?? r.auth?.id ?? r.auth?.userId;

    const trackerId = userId ? `u:${String(userId)}` : `ip:${getRealIp(r)}`;

    return `${tenantSlug}:${trackerId}`;
  }

  protected override generateKey(
    context: ExecutionContext,
    tracker: string,
    throttlerName?: string,
  ): string {
    const req = context.switchToHttp().getRequest<Request & any>();

    const method = req.method ?? '';

    const original = (req.originalUrl as string | undefined) ?? '';
    const withoutQuery = original ? original.split('?')[0] : '';
    const path = withoutQuery || ((req.baseUrl ?? '') + (req.path ?? '')) || '';

    // Extras (sin PII)
    let extra = '';

    // login: hashear email (no guardarlo plano)
    if (method === 'POST' && path.endsWith('/login')) {
      const email = (req.body?.email as string)?.toLowerCase?.().trim() ?? '';
      extra = email ? `e=${sha16(email)}` : 'e=none';
    }

    // refresh: si tiene cookie rt
    if (method === 'POST' && path.endsWith('/refresh')) {
      const cookieName = process.env.AUTH_COOKIE_NAME ?? 'rt';
      extra = req.cookies?.[cookieName] ? 'rt=1' : 'rt=0';
    }

    // key final
    const prefix = `turnero:${process.env.NODE_ENV ?? 'dev'}`;
    return `${prefix}|${throttlerName ?? 'default'}|${method}|${path}|${tracker}|${extra}`;
  }
}
