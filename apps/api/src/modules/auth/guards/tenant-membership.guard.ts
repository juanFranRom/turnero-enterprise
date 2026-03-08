import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class TenantMembershipGuard implements CanActivate {
	constructor(private readonly prisma: PrismaService) {}

	async canActivate(ctx: ExecutionContext): Promise<boolean> {
		const req = ctx.switchToHttp().getRequest<Express.Request>();
		const tenant = req.tenant;
		const user = req.auth;

		if (!tenant?.id) {
			throw new UnauthorizedException({
				code: 'TENANT_REQUIRED',
				message: 'Missing tenant',
			});
		}

		if (!user?.userId) {
			throw new UnauthorizedException({
				code: 'USER_REQUIRED',
				message: 'Missing user',
			});
		}

		const membership = await this.prisma.membership.findUnique({
			where: {
				userId_tenantId: {
					userId: user.userId,
					tenantId: tenant.id,
				},
			},
		});

		if (!membership) {
			throw new UnauthorizedException({
				code: 'TENANT_MEMBERSHIP_REQUIRED',
				message: 'User not a member of this tenant',
			});
		}

		req.membership = {
			id: membership.id,
			userId: membership.userId,
			tenantId: membership.tenantId,
			role: membership.role,
		};

		return true;
	}
}