import {
	Body,
	Controller,
	Get,
	Post,
	Req,
	Res,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AntiBruteForceService } from '../security/anti-bruteforce/anti-bruteforce.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './types/auth-user.type';

function getRealIp(req: Request): string | null {
	const anyReq = req as any;

	if (Array.isArray(anyReq.ips) && anyReq.ips.length) {
		return anyReq.ips[0];
	}

	return (anyReq.ip as string) || req.socket.remoteAddress || null;
}

function assertCsrfOrigin(req: Request) {
	const allowed = (process.env.CORS_ORIGINS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	if (!allowed.length) {
		return;
	}

	const origin = req.headers.origin as string | undefined;
	const referer = req.headers.referer as string | undefined;
	const src = origin ?? referer ?? '';

	if (!src) {
		throw new UnauthorizedException({
			code: 'CSRF_ORIGIN_REQUIRED',
			message: 'CSRF check failed',
		});
	}

	const ok = allowed.some((a) => src.startsWith(a));

	if (!ok) {
		throw new UnauthorizedException({
			code: 'CSRF_ORIGIN_INVALID',
			message: 'CSRF check failed',
			details: {
				origin: origin ?? null,
				referer: referer ?? null,
			},
		});
	}
}

type SetActiveTenantDto = {
	tenantSlug: string;
};

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly antiBruteForce: AntiBruteForceService,
	) {}

	@Throttle({
		burst: { limit: 6, ttl: seconds(10) },
		default: { limit: 5, ttl: seconds(60) },
	})
	@Post('login')
	async login(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
		@Body() dto: LoginDto,
	) {
		const email = (dto.email ?? '').toLowerCase();
		const ip = (req.ips?.[0] ?? req.ip ?? req.socket?.remoteAddress ?? 'unknown') as string;

		await this.antiBruteForce.checkOrThrow('global', email, ip);

		try {
			const result = await this.authService.login({
				email,
				password: dto.password,
				userAgent: req.headers['user-agent'],
				ip: ip || null,
			});

			await this.antiBruteForce.onSuccess('global', email, ip);

			this.authService.setRefreshCookie(res, result.refreshToken);

			return {
				accessToken: result.accessToken,
				user: result.user,
				memberships: result.memberships,
				activeTenantSlug: result.activeTenantSlug,
			};
		} catch (e: any) {
			const status = e?.status ?? e?.getStatus?.();

			if (status === 401) {
				await this.antiBruteForce.onFailure('global', email, ip);
			}

			throw e;
		}
	}

	@Throttle({ default: { limit: 10, ttl: seconds(60) } })
	@Post('refresh')
	async refresh(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		assertCsrfOrigin(req);

		const refreshToken = this.authService.getRefreshFromCookie(req);

		if (!refreshToken) {
			throw new UnauthorizedException({
				code: 'REFRESH_TOKEN_MISSING',
				message: 'Missing refresh token',
			});
		}

		const result = await this.authService.refresh({
			refreshToken,
			userAgent: req.headers['user-agent'],
			ip: getRealIp(req),
		});

		this.authService.setRefreshCookie(res, result.newRefreshToken);

		return {
			accessToken: result.accessToken,
			user: result.user,
			memberships: result.memberships,
			activeTenantSlug: result.activeTenantSlug,
		};
	}

	@Throttle({ default: { limit: 10, ttl: seconds(60) } })
	@Post('logout')
	async logout(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const refreshToken = this.authService.getRefreshFromCookie(req);

		if (refreshToken) {
			await this.authService.logout({ refreshToken });
		}

		const auth = req.headers.authorization;

		if (auth?.startsWith('Bearer ')) {
			await this.authService.logoutByAccessBestEffort({
				authorization: auth,
			});
		}

		this.authService.clearRefreshCookie(res);

		return { ok: true };
	}

	@Throttle({ default: { limit: 5, ttl: seconds(60) } })
	@Post('logout-all')
	@UseGuards(JwtAuthGuard)
	async logoutAll(
		@CurrentUser() user: AuthUser,
		@Res({ passthrough: true }) res: Response,
	) {
		await this.authService.logoutAll({
			userId: user.userId,
		});

		this.authService.clearRefreshCookie(res);

		return { ok: true };
	}

	@Throttle({ default: { limit: 60, ttl: seconds(60) } })
	@UseGuards(JwtAuthGuard)
	@Get('me')
	async me(@CurrentUser() user: AuthUser) {
		return this.authService.me({
			userId: user.userId,
			sessionId: user.sid,
		});
	}

	@UseGuards(JwtAuthGuard)
	@Post('set-active-tenant')
	async setActiveTenant(
		@CurrentUser() user: AuthUser,
		@Body() dto: SetActiveTenantDto,
	) {
		return this.authService.setActiveTenant({
			userId: user.userId,
			sessionId: user.sid,
			tenantSlug: dto.tenantSlug,
		});
	}
}