import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import crypto from 'crypto';
import { ANTI_BRUTE_FORCE_CONFIG } from './anti-bruteforce.constants';
import { REDIS } from '../../../infrastructure/redis/redis.module';
import { redisPrefix } from 'apps/api/src/infrastructure/redis/redis-prefix';

@Injectable()
export class AntiBruteForceService {
	constructor(@Inject(REDIS) private readonly redis: Redis) {}

	private hash(value: string) {
		return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
	}

	private failIpKey(tenantId: string, ip: string) {
		return `${redisPrefix()}:ab:failip:${tenantId}:${ip}`;
	}

	private lockIpKey(tenantId: string, ip: string) {
		return `${redisPrefix()}:ab:lockip:${tenantId}:${ip}`;
	}

	private failKey(tenantId: string, email: string, ip: string) {
		return `${redisPrefix()}:ab:fail:${tenantId}:${this.hash(email)}:${ip}`;
	}

	private lockKey(tenantId: string, email: string, ip: string) {
		return `${redisPrefix()}:ab:lock:${tenantId}:${this.hash(email)}:${ip}`;
	}

	private computeLockMs(
		attempts: number,
		steps: { minAttempts: number; lockMs: number }[],
	) {
		let lockMs = 0;

		for (const step of steps) {
			if (attempts >= step.minAttempts) lockMs = step.lockMs;
		}

		return lockMs;
	}

	async checkOrThrow(tenantId: string, email: string, ip: string) {
		const emailLockTtl = await this.redis.pttl(this.lockKey(tenantId, email, ip));
		const ipLockTtl = await this.redis.pttl(this.lockIpKey(tenantId, ip));

		const ttl = Math.max(emailLockTtl, ipLockTtl);

		if (ttl && ttl > 0) {
			const retryAfterSec = Math.ceil(ttl / 1000);

			throw new HttpException(
				{
					code: 'TOO_MANY_FAILED_ATTEMPTS',
					message: 'Too many failed attempts',
					details: {
						retryAfterSec,
					},
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
	}

	async onFailure(tenantId: string, email: string, ip: string) {
		const emailFailKey = this.failKey(tenantId, email, ip);
		const ipFailKey = this.failIpKey(tenantId, ip);

		const emailAttempts = await this.redis.incr(emailFailKey);
		const ipAttempts = await this.redis.incr(ipFailKey);

		if (emailAttempts === 1) {
			await this.redis.pexpire(
				emailFailKey,
				ANTI_BRUTE_FORCE_CONFIG.FAILURE_WINDOW_MS,
			);
		}

		if (ipAttempts === 1) {
			await this.redis.pexpire(
				ipFailKey,
				ANTI_BRUTE_FORCE_CONFIG.FAILURE_WINDOW_MS,
			);
		}

		const lockEmailMs = this.computeLockMs(
			emailAttempts,
			ANTI_BRUTE_FORCE_CONFIG.LOCK_STEPS_EMAIL,
		);
		const lockIpMs = this.computeLockMs(
			ipAttempts,
			ANTI_BRUTE_FORCE_CONFIG.LOCK_STEPS_IP,
		);

		if (lockEmailMs > 0) {
			await this.redis.set(
				this.lockKey(tenantId, email, ip),
				'1',
				'PX',
				lockEmailMs,
			);
		}

		if (lockIpMs > 0) {
			await this.redis.set(
				this.lockIpKey(tenantId, ip),
				'1',
				'PX',
				lockIpMs,
			);
		}
	}

	async onSuccess(tenantId: string, email: string, ip: string) {
		await this.redis.del(this.failKey(tenantId, email, ip));
		await this.redis.del(this.lockKey(tenantId, email, ip));
		await this.redis.del(this.failIpKey(tenantId, ip));
		await this.redis.del(this.lockIpKey(tenantId, ip));
	}
}