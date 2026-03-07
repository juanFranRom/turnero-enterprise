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
import { TenantMembershipGuard } from './guards/tenant-membership.guard';
import { AntiBruteForceService } from '../security/anti-bruteforce/anti-bruteforce.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './types/auth-user.type';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { TenantCtx } from '../../types/express';

function getRealIp(req: Request): string | null {
  const anyReq = req as any;
  if (Array.isArray(anyReq.ips) && anyReq.ips.length) return anyReq.ips[0];
  return (anyReq.ip as string) || req.socket.remoteAddress || null;
}

// CSRF mínimo viable (si refresh va en cookie)
function assertCsrfOrigin(req: Request) {
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowed.length) return; // si no configuraste allowlist, no bloquees por ahora

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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly antiBruteForce: AntiBruteForceService,
  ) {}

  @Throttle({
    burst: { limit: 6, ttl: seconds(10) },
    login: { limit: 5, ttl: seconds(60) },
  })
  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    const tenant = (req as any).tenant;
    if (!tenant) {
      throw new UnauthorizedException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Tenant context is required',
      });
    }

    const email = (dto.email ?? '').toLowerCase();
    const ip = (req.ips?.[0] ?? req.ip ?? req.socket?.remoteAddress ?? 'unknown') as string;

    await this.antiBruteForce.checkOrThrow(String(tenant.id), email, ip);

    try {
      const { accessToken, refreshToken } = await this.authService.login({
        tenantId: tenant.id,
        email,
        password: dto.password,
        userAgent: req.headers['user-agent'],
        ip: ip || null,
      });

      await this.antiBruteForce.onSuccess(String(tenant.id), email, ip);

      this.authService.setRefreshCookie(res, refreshToken);
      return { accessToken };
    } catch (e: any) {
      const status = e?.status ?? e?.getStatus?.();
      if (status === 401) {
        await this.antiBruteForce.onFailure(String(tenant.id), email, ip);
      }
      throw e;
    }
  }

  @Throttle({ refresh: { limit: 10, ttl: seconds(60) } })
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tenant = (req as any).tenant;
    if (!tenant) {
      throw new UnauthorizedException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Tenant context is required',
      });
    }

    assertCsrfOrigin(req);

    const refreshToken = this.authService.getRefreshFromCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_MISSING',
        message: 'Missing refresh token',
      });
    }

    const { accessToken, newRefreshToken } = await this.authService.refresh({
      tenantId: tenant.id,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ip: getRealIp(req),
    });

    this.authService.setRefreshCookie(res, newRefreshToken);

    return { accessToken };
  }

  @Throttle({ logout: { limit: 10, ttl: seconds(60) } })
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenant = (req as any).tenant;

    if (tenant?.id) {
      const refreshToken = this.authService.getRefreshFromCookie(req);
      if (refreshToken) {
        await this.authService.logout({ tenantId: tenant.id, refreshToken });
      }
    }

    if (tenant?.id) {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        await this.authService.logoutByAccessBestEffort({
          tenantId: tenant.id,
          authorization: auth,
        });
      }
    }

    this.authService.clearRefreshCookie(res);

    return { ok: true };
  }

  @Throttle({ logoutAll: { limit: 5, ttl: seconds(60) } })
  @Post('logout-all')
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  async logoutAll(
    @Tenant() tenant: TenantCtx | null,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!tenant) {
      throw new UnauthorizedException({
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Tenant context is required',
      });
    }

    await this.authService.logoutAll({
      tenantId: tenant.id,
      userId: user.userId,
    });

    this.authService.clearRefreshCookie(res);

    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me({
      tenantId: user.tenantId,
      userId: user.userId,
    });
  }
}