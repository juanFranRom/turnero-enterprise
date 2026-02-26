import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

type CacheEntry = { tenant: any | null; exp: number };

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  private cache = new Map<string, CacheEntry>();
  private ttlMs = Number(process.env.TENANT_CACHE_TTL_MS ?? 60_000);

  private getCached(slug: string) {
    const v = this.cache.get(slug);
    if (!v) return undefined;
    if (Date.now() > v.exp) {
      this.cache.delete(slug);
      return undefined;
    }
    return v.tenant; // puede ser null (negative cache)
  }

  private setCached(slug: string, tenant: any | null) {
    this.cache.set(slug, { tenant, exp: Date.now() + this.ttlMs });
  }

  async use(req: Request, _res: Response, next: NextFunction) {
    const raw = req.header('X-Tenant-Slug') ?? req.header('x-tenant-slug');
    if (!raw) return next();

    const slug = String(raw).trim().toLowerCase();
    (req as any).tenantSlug = slug;

    const cached = this.getCached(slug);
    if (cached !== undefined) {
      if (cached) (req as any).tenant = cached;
      else (req as any).tenant = null;
      return next();
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, planId: true }, // no traigas de más
    });

    this.setCached(slug, tenant ?? null);
    (req as any).tenant = tenant ?? null;

    return next();
  }
}