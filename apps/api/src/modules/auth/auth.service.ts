import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import crypto from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';

type LoginArgs = {
	email: string;
	password: string;
	userAgent?: string | string[] | undefined;
	ip?: string | null;
};

type RefreshArgs = {
	refreshToken: string;
	userAgent?: string | string[] | undefined;
	ip?: string | null;
};

type AuthMembership = {
	tenantId: string;
	tenantSlug: string;
	tenantName: string;
	role: string;
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
		sid: string;
	}) {
		return this.jwt.sign(payload, {
			secret: process.env.JWT_ACCESS_SECRET,
			expiresIn: `${this.accessTtlMin()}m`,
		});
	}

	private signRefreshToken(payload: {
		sub: string;
		sid: string;
	}) {
		return this.jwt.sign(payload, {
			secret: process.env.JWT_REFRESH_SECRET,
			expiresIn: `${this.refreshTtlDays()}d`,
		});
	}

	private async revokeAllUserSessions(userId: string) {
		await this.prisma.session.updateMany({
			where: {
				userId,
				revokedAt: null,
			},
			data: {
				revokedAt: new Date(),
			},
		});
	}

	private async mapMemberships(userId: string): Promise<AuthMembership[]> {
		const memberships = await this.prisma.membership.findMany({
			where: {
				userId,
			},
			select: {
				tenantId: true,
				role: true,
				tenant: {
					select: {
						slug: true,
						name: true,
					},
				},
			},
			orderBy: {
				createdAt: 'asc',
			},
		});

		return memberships.map((membership) => ({
			tenantId: membership.tenantId,
			tenantSlug: membership.tenant.slug,
			tenantName: membership.tenant.name,
			role: membership.role,
		}));
	}

	private resolveInitialActiveTenantId(memberships: AuthMembership[]): string | null {
		if (memberships.length === 1) {
			return memberships[0].tenantId;
		}

		return null;
	}

	private async buildAuthContext(args: {
		userId: string;
		sessionId: string;
	}) {
		const user = await this.prisma.user.findUnique({
			where: {
				id: args.userId,
			},
			select: {
				id: true,
				email: true,
				emailVerified: true,
				isActive: true,
				createdAt: true,
			},
		});

		if (!user) {
			this.unauthorized('USER_NOT_FOUND', 'User not found');
		}

		const memberships = await this.mapMemberships(args.userId);

		const session = await this.prisma.session.findUnique({
			where: {
				id: args.sessionId,
			},
			select: {
				activeTenantId: true,
			},
		});

		const activeTenant =
			session?.activeTenantId
				? memberships.find((membership) => membership.tenantId === session.activeTenantId) ?? null
				: null;

		return {
			user,
			memberships,
			activeTenantSlug: activeTenant?.tenantSlug ?? null,
		};
	}

	async login(args: LoginArgs) {
		const user = await this.prisma.user.findUnique({
			where: {
				email: args.email,
			},
		});

		if (!user || !user.isActive) {
			this.unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
		}

		const ok = await argon2.verify(user.passwordHash, args.password);

		if (!ok) {
			this.unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
		}

		const memberships = await this.mapMemberships(user.id);

		if (!memberships.length) {
			this.unauthorized(
				'TENANT_MEMBERSHIP_REQUIRED',
				'User has no tenant memberships',
			);
		}

		const sessionId = crypto.randomUUID();
		const activeTenantId = this.resolveInitialActiveTenantId(memberships);

		const refreshToken = this.signRefreshToken({
			sub: user.id,
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
				refreshTokenHash,
				userAgent: Array.isArray(args.userAgent)
					? args.userAgent.join(' ')
					: args.userAgent,
				ip: args.ip ?? undefined,
				expiresAt,
				activeTenantId,
			},
		});

		await this.sessions.markActiveInCache('global', sessionId, expiresAt);

		const accessToken = this.signAccessToken({
			sub: user.id,
			sid: sessionId,
		});

		const authContext = await this.buildAuthContext({
			userId: user.id,
			sessionId,
		});

		return {
			accessToken,
			refreshToken,
			...authContext,
		};
	}

	async logout(args: { refreshToken: string }) {
		let payload: any;

		try {
			payload = this.jwt.verify(args.refreshToken, {
				secret: process.env.JWT_REFRESH_SECRET,
			});
		} catch {
			return;
		}

		await this.prisma.session.updateMany({
			where: {
				id: payload.sid,
				revokedAt: null,
			},
			data: {
				revokedAt: new Date(),
			},
		});

		await this.sessions.clearCache('global', payload.sid);
	}

	async logoutBySid(args: { sid: string }) {
		await this.prisma.session.updateMany({
			where: {
				id: args.sid,
				revokedAt: null,
			},
			data: {
				revokedAt: new Date(),
			},
		});

		await this.sessions.clearCache('global', args.sid);
	}

	async logoutByAccessBestEffort(args: {
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

			if (!payload?.sid) {
				return;
			}

			await this.logoutBySid({
				sid: payload.sid,
			});
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

		const session = await this.prisma.session.findUnique({
			where: {
				id: payload.sid,
			},
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

		if (session.userId !== payload.sub) {
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		const ok = await argon2.verify(session.refreshTokenHash, args.refreshToken);

		if (!ok) {
			await this.revokeAllUserSessions(session.userId);
			this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
		}

		const memberships = await this.mapMemberships(session.userId);

		if (!memberships.length) {
			await this.revokeAllUserSessions(session.userId);
			this.unauthorized(
				'TENANT_MEMBERSHIP_REQUIRED',
				'User has no tenant memberships',
			);
		}

		const now = new Date();

		const { newRefreshToken, newSessionId, expiresAt } =
			await this.prisma.$transaction(async (tx) => {
				const updated = await tx.session.updateMany({
					where: {
						id: session.id,
						revokedAt: null,
					},
					data: {
						revokedAt: now,
					},
				});

				if (updated.count !== 1) {
					await this.revokeAllUserSessions(session.userId);
					this.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
				}

				const newSessionId = crypto.randomUUID();

				const newRefreshToken = this.signRefreshToken({
					sub: session.userId,
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
						refreshTokenHash: newRefreshTokenHash,
						userAgent: Array.isArray(args.userAgent)
							? args.userAgent.join(' ')
							: args.userAgent,
						ip: args.ip ?? undefined,
						expiresAt,
						rotatedFromId: session.id,
						activeTenantId: session.activeTenantId,
					},
				});

				return {
					newRefreshToken,
					newSessionId,
					expiresAt,
				};
			});

		await this.sessions.markActiveInCache('global', newSessionId, expiresAt);
		await this.sessions.clearCache('global', session.id);

		const accessToken = this.signAccessToken({
			sub: session.userId,
			sid: newSessionId,
		});

		const authContext = await this.buildAuthContext({
			userId: session.userId,
			sessionId: newSessionId,
		});

		return {
			accessToken,
			newRefreshToken,
			...authContext,
		};
	}

	async logoutAll(args: { userId: string }) {
		await this.prisma.session.updateMany({
			where: {
				userId: args.userId,
				revokedAt: null,
			},
			data: {
				revokedAt: new Date(),
			},
		});
	}

	async me(args: { userId: string; sessionId: string }) {
		return this.buildAuthContext({
			userId: args.userId,
			sessionId: args.sessionId,
		});
	}

	async setActiveTenant(args: {
		userId: string;
		sessionId: string;
		tenantSlug: string;
	}) {
		const membership = await this.prisma.membership.findFirst({
			where: {
				userId: args.userId,
				tenant: {
					slug: args.tenantSlug,
				},
			},
			select: {
				tenantId: true,
				role: true,
				tenant: {
					select: {
						slug: true,
						name: true,
					},
				},
			},
		});

		if (!membership) {
			this.unauthorized(
				'TENANT_MEMBERSHIP_REQUIRED',
				'Not a member of this tenant',
			);
		}

		await this.prisma.session.updateMany({
			where: {
				id: args.sessionId,
				userId: args.userId,
				revokedAt: null,
			},
			data: {
				activeTenantId: membership.tenantId,
			},
		});

		return {
			activeTenantSlug: membership.tenant.slug,
			activeTenant: {
				id: membership.tenantId,
				name: membership.tenant.name,
				slug: membership.tenant.slug,
				role: membership.role,
			},
		};
	}
}