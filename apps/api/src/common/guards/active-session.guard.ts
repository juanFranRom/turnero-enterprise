import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ActiveSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<any>();
    const user = req.auth;
    const tenant = req.tenant;

    // req.auth viene normalizado por tu JwtAccessStrategy: { userId, tenantId, sid, role }
    const sid = user?.sid as string | undefined;
    const userId = user?.userId as string | undefined;
    const tenantId = tenant?.id as string | undefined;

    if (!sid || !userId || !tenantId) throw new UnauthorizedException('Unauthorized');

    const session = await this.prisma.session.findFirst({
      where: {
        id: sid,
        userId,
        tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!session) throw new UnauthorizedException('Session revoked');
    return true;
  }
}
