import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { REDIS } from '../../infrastructure/redis/redis.module';
import { SESSIONS_CACHE_NS } from './sessions.constants';

@Injectable()
export class SessionsService {
  private readonly redisPrefix = process.env.REDIS_PREFIX ?? 'turnero';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private key(tenantId: string, sid: string) {
    return `${this.redisPrefix}:${SESSIONS_CACHE_NS}:${tenantId}:${sid}`;
  }

  /**
   * ✅ Punto clave: invalida access tokens si la sesión fue revocada o venció.
   * Redis acelera (1), DB es source of truth (2).
   */
  async assertActiveOrThrow(tenantId: string, sid?: string) {
    if (!sid) throw new UnauthorizedException('Missing session');

    const k = this.key(tenantId, sid);

    // 1) Redis fast path
    const cached = await this.redis.get(k);
    if (cached === '1') return;

    // 2) DB fallback
    const session = await this.prisma.session.findUnique({
      where: { id: sid },
      select: { id: true, tenantId: true, revokedAt: true, expiresAt: true },
    });

    const now = new Date();

    const invalid =
      !session ||
      session.tenantId !== tenantId ||
      session.revokedAt !== null ||
      session.expiresAt <= now;

    if (invalid) throw new UnauthorizedException('Session revoked');

    // 3) Cache warm hasta expiresAt
    const ttlSeconds = Math.max(
      1,
      Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
    );

    await this.redis.set(k, '1', 'EX', ttlSeconds);
  }

  /**
   * Para "warm" de cache cuando creás una sesión nueva.
   */
  async markActiveInCache(tenantId: string, sid: string, expiresAt: Date) {
    const now = new Date();
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    );
    await this.redis.set(this.key(tenantId, sid), '1', 'EX', ttlSeconds);
  }

  /**
   * Limpia cache de una sid puntual (logout, rotación, etc.)
   */
  async clearCache(tenantId: string, sid: string) {
    await this.redis.del(this.key(tenantId, sid));
  }

  /**
   * Revoca sesión (DB) y limpia cache.
   * Ojo: revoca aunque venga repetido, idempotente.
   */
  async revokeSession(tenantId: string, sid: string) {
    await this.prisma.session.updateMany({
      where: { id: sid, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.clearCache(tenantId, sid);
  }
}