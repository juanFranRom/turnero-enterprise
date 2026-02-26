import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<any>();
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant?.id) throw new UnauthorizedException('Missing tenant');
    if (!user?.userId) throw new UnauthorizedException('Missing user');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.userId, tenantId: tenant.id } },
    });

    if (!membership) throw new UnauthorizedException('User not a member of this tenant');

    req.membership = membership;
    return true;
  }
}
