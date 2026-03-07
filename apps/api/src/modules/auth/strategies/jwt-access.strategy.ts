import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { StrategyOptionsWithRequest } from 'passport-jwt';
import type { AuthUser } from '../types/auth-user.type';
import { SessionsService } from '../../sessions/sessions.service'; // ajustá el path real

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(private readonly sessions: SessionsService) {
    const opts: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
      passReqToCallback: true,
    };
    super(opts);
  }

  async validate(req: Request, payload: any): Promise<AuthUser> {
    const tenant = (req as any).tenant;

    if (tenant?.id && payload?.tid && tenant.id !== payload.tid) {
      throw new UnauthorizedException({
        code: 'INVALID_TENANT',
        message: 'Invalid tenant',
      });
    }

    // ✅ ESTO corta el bug: si hiciste logout y esa sid quedó revocada => 401
    await this.sessions.assertActiveOrThrow(payload.tid, payload.sid);

    return {
      userId: payload.sub,
      tenantId: payload.tid,
      role: payload.role,
      sid: payload.sid,
    };
  }
}