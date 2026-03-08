import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Request } from 'express';
import type { AuthenticatedRequestMembership } from '../types/authenticated-request-membership.type';

type RequestWithMembership = Request & {
	membership?: AuthenticatedRequestMembership;
};

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles =
			this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
				context.getHandler(),
				context.getClass(),
			]) ?? [];

		if (requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<RequestWithMembership>();
		const membership = request.membership;

		if (!membership) {
			throw new ForbiddenException({
				code: 'AUTH_MEMBERSHIP_REQUIRED',
				message: 'Tenant membership is required',
			});
		}

		const currentRole = membership.role;

		if (!requiredRoles.includes(currentRole)) {
			throw new ForbiddenException({
				code: 'INSUFFICIENT_ROLE',
				message: 'Insufficient permissions',
				details: {
					requiredRoles,
					currentRole,
				},
			});
		}

		return true;
	}
}