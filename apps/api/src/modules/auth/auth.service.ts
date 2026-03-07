import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import crypto from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';

type LoginArgs = {
	tenantId: string;
	email: string;
	password: string;
	userAgent?: string | string[] | undefined;
	ip?: string | null;
};

type RefreshArgs = {
	tenantId: string;
	refreshToken: string;
	userAgent?: string | string[] | undefined;
	ip?: string | null;
};

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		private readonly sessions: SessionsService,
	) {}

	private accessTtlMin(): number {
		return Number(process.env.JWT_ACCESS_TTL_MIN ?? 15);
	}

	private refreshTtlDays(): number {
		return Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
	}

	private cookieName(): string {
		return process.env.AUTH_COOKIE_NAME ?? 'rt';
	}

	private unauthorized(code: string, message: string, details?: unknown): never {
		throw new UnauthorizedException({
			code,
			message,
			...(details !== undefined ? { details } : {}),
		});
	}

	setRefreshCookie(res: Response, refreshToken: string) {
		const secure = (process.env.AUTH_COOKIE_SECURE ?? 'false') === 'true';
		const sameSite = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax') as
			| 'lax'
			| 'strict'
			| 'none';

		res.cookie(this.cookieName(), refreshToken, {
			httpOnly: true,
			secure,
			sameSite,
			path: '/api/auth/refresh',
			maxAge: this.refreshTtlDays() * 24 * 60 * 60 * 1000,
		});
	}

	clearRefreshCookie(res: Response) {
		const secure = (process.env.AUTH_COOKIE_SECURE ?? 'false') === 'true';
		const sameSite = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax') as
			| 'lax'
			| 'strict'
			| 'none';
		const name = this.cookieName();

		res.clearCookie(name, {
			httpOnly: true,
			secure,
			sameSite,
			path: '/api/auth/refresh',
		});
		res.clearCookie(name, {
			httpOnly: true,
			secure,
			sameSite,
			path: '/api/auth',
		});
		res.clearCookie(name, {
			httpOnly: true,
			secure,
			sameSite,
			path: '/',
		});
	}

	getRefreshFromCookie(req: Request): string | null {
		const name = this.cookieName();
		const v = (req as any).cookies?.[name];
		return typeof v === 'string' && v.length > 0 ? v : null;
	}

	private signAccessToken(payload: {
		sub: string;
		tid: string;
		role: string;
		sid: string;
	}) {
		return this.jwt.sign(payload, {
			secret: process.env.JWT_ACCESS_SECRET,
			expiresIn: `${this.accessTtlMin()}m`,
		});
	}

	private signRefreshToken(payload: { sub: string; tid: string; sid: string }) {
		return this.jwt.sign(payload, {
			secret: process.env.JWT_REFRESH_SECRET,
			expiresIn: `${this.refreshTtlDays()}d`,
		});
	}

	private async revokeAllUserTenantSessions(userId: string, tenantId: string) {
		await this.prisma.session.updateMany({
			where: { userId, tenantId, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	async login(args: LoginArgs) {
		const user = await this.prisma.user.findUnique({
			where: { email: args.email },
		});

		if (!user || !user.isActive) {
			this.unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
		}

		const ok = await argon2.verify(user.passwordHash, args.password);
		if (!ok) {
			this.unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
		}

		const membership = await this.prisma.membership.findUnique({
			where: {
				userId_tenantId: { userId: user.id, tenantId: args.tenantId },
			},
		});

		if (!membership) {
			this.unauthorized(
				'TENANT_MEMBERSHIP_REQUIRED',
				'Not a member of this tenant',
			);
		}

		const sessionId = crypto.randomUUID();
		const refreshToken = this.signRefreshToken({
			sub: user.id,
			tid: args.tenantId,
			sid: sessionId,
		});
		const refreshTokenHash = await argon2.hash(refreshToken);

		const expiresAt = new Date(
			Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000,
		);

		await this.prisma.session.create({
			data: {
				id: sessionId,
				userId: user.id,
				tenantId: args.tenantId,
				refreshTokenHash,
				userAgent: Array.isArray(args.userAgent)
					? args.userAgent.join(' ')
					: args.userAgent,
				ip: args.ip ?? undefined,
				expiresAt,
			},
		});

		await this.sessions.markActiveInCache(args.tenantId, sessionId, expiresAt);

		const accessToken = this.signAccessToken({
			sub: user.id,
			tid: args.tenantId,
			role: membership.role,
			sid: sessionId,
		});

		return { accessToken, refreshToken };
	}

	async logout(args: { tenantId: string; refreshToken: string }) {
		let payload: any;

		try {
			payload = this.jwt.verify(args.refreshToken, {
				secret: process.env.JWT_REFRESH_SECRET,
			});
		} catch {
			return;
		}

		if (payload.tid !== args.tenantId) return;

		await this.prisma.session.updateMany({
			where: { id: payload.sid, tenantId: args.tenantId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

		await this.sessions.clearCache(args.tenantId, payload.sid);
	}

	async logoutBySid(args: { tenantId: string; sid: string }) {
		await this.prisma.session.updateMany({
			where: { id: args.sid, tenantId: args.tenantId, revokedAt: null },
			data: { revokedAt: new Date() },
		});

		await this.sessions.clearCache(args.tenantId, args.sid);
	}

	async logoutByAccessBestEffort(args: {
		tenantId: string;
		authorization: string;
	}) {
		const token = args.authorization.startsWith('Bearer ')
			? args.authorization.slice('Bearer '.length)
			: args.authorization;

		try {
			const payload: any = this.jwt.verify(token, {
				secret: process.env.JWT_ACCESS_SECRET,
				ignoreExpiration: true,
			});

			if (!payload?.sid) return;
			if (payload?.tid !== args.tenantId) return;

			await this.logoutBySid({ tenantId: args.tenantId, sid: payload.sid });
		} catch {
			return;
		}
	}

	async refresh(args: RefreshArgs) {
		let payload: any;

		try {
			payload = this.jwt.verify(args.refreshToken, {
				secret: process.env.JWT_REFRESH_SECRET,
			});
		} catch {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		if (payload.tid !== args.tenantId) {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		const session = await this.prisma.session.findUnique({
			where: { id: payload.sid },
		});

		if (!session) {
			this.unauthorized('SESSION_NOT_FOUND', 'Session not found');
		}

		if (session.revokedAt) {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		if (session.expiresAt.getTime() < Date.now()) {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		if (session.tenantId !== args.tenantId) {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		if (session.userId !== payload.sub) {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		const ok = await argon2.verify(session.refreshTokenHash, args.refreshToken);
		if (!ok) {
			await this.revokeAllUserTenantSessions(session.userId, args.tenantId);
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		const membership = await this.prisma.membership.findUnique({
			where: {
				userId_tenantId: { userId: session.userId, tenantId: args.tenantId },
			},
		});

		if (!membership) {
			await this.revokeAllUserTenantSessions(session.userId, args.tenantId);
			this.unauthorized(
				'TENANT_MEMBERSHIP_REQUIRED',
				'Not a member of this tenant',
			);
		}

		const now = new Date();

		const { newRefreshToken, newSessionId } = await this.prisma.$transaction(
			async (tx) => {
				const updated = await tx.session.updateMany({
					where: { id: session.id, revokedAt: null },
					data: { revokedAt: now },
				});

				if (updated.count !== 1) {
					await this.revokeAllUserTenantSessions(session.userId, args.tenantId);
					this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
				}

				const newSessionId = crypto.randomUUID();
				const newRefreshToken = this.signRefreshToken({
					sub: session.userId,
					tid: args.tenantId,
					sid: newSessionId,
				});

				const newRefreshTokenHash = await argon2.hash(newRefreshToken);
				const expiresAt = new Date(
					Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000,
				);

				await tx.session.create({
					data: {
						id: newSessionId,
						userId: session.userId,
						tenantId: args.tenantId,
						refreshTokenHash: newRefreshTokenHash,
						userAgent: Array.isArray(args.userAgent)
							? args.userAgent.join(' ')
							: args.userAgent,
						ip: args.ip ?? undefined,
						expiresAt,
						rotatedFromId: session.id,
					},
				});

				return { newRefreshToken, newSessionId };
			},
		);

		await this.sessions.markActiveInCache(
			args.tenantId,
			newSessionId,
			new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000),
		);

		await this.sessions.clearCache(args.tenantId, session.id);

		const accessToken = this.signAccessToken({
			sub: session.userId,
			tid: args.tenantId,
			role: membership.role,
			sid: newSessionId,
		});

		return { accessToken, newRefreshToken };
	}

	async logoutAll(args: { tenantId: string; userId: string }) {
		await this.prisma.session.updateMany({
			where: {
				tenantId: args.tenantId,
				userId: args.userId,
				revokedAt: null,
			},
			data: { revokedAt: new Date() },
		});
	}

	async me(args: { tenantId: string; userId: string }) {
		const user = await this.prisma.user.findUnique({
			where: { id: args.userId },
			select: {
				id: true,
				email: true,
				emailVerified: true,
				isActive: true,
				createdAt: true,
			},
		});

		const membership = await this.prisma.membership.findUnique({
			where: {
				userId_tenantId: { userId: args.userId, tenantId: args.tenantId },
			},
			select: { role: true, tenantId: true, createdAt: true },
		});

		return { user, membership };
	}
}