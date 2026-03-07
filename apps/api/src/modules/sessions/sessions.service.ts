import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { REDIS } from '../../infrastructure/redis/redis.module';
import { SESSIONS_CACHE_NS } from './sessions.constants';
import { redisPrefix } from '../../infrastructure/redis/redis-prefix';

@Injectable()
export class SessionsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(REDIS) private readonly redis: Redis,
	) {}

	private key(tenantId: string, sid: string) {
		return `${redisPrefix()}:${SESSIONS_CACHE_NS}:${tenantId}:${sid}`;
	}

	private unauthorized(code: string, message: string, details?: unknown): never {
		throw new UnauthorizedException({
			code,
			message,
			...(details !== undefined ? { details } : {}),
		});
	}

	/**
	 * Invalida access tokens si la sesión fue revocada o venció.
	 * Redis acelera, DB es source of truth.
	 */
	async assertActiveOrThrow(tenantId: string, sid?: string) {
		if (!sid) {
			this.unauthorized('SESSION_REQUIRED', 'Missing session');
		}

		const k = this.key(tenantId, sid);

		const cached = await this.redis.get(k);
		if (cached === '1') return;

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

		if (invalid) {
			this.unauthorized('SESSION_REVOKED', 'Session revoked');
		}

		const ttlSeconds = Math.max(
			1,
			Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
		);

		await this.redis.set(k, '1', 'EX', ttlSeconds);
	}

	async markActiveInCache(tenantId: string, sid: string, expiresAt: Date) {
		const now = new Date();
		const ttlSeconds = Math.max(
			1,
			Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
		);

		await this.redis.set(this.key(tenantId, sid), '1', 'EX', ttlSeconds);
	}

	async clearCache(tenantId: string, sid: string) {
		await this.redis.del(this.key(tenantId, sid));
	}

	async revokeSession(tenantId: string, sid: string) {
		await this.prisma.session.updateMany({
			where: { id: sid, tenantId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

		await this.clearCache(tenantId, sid);
	}
}