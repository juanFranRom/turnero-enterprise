import {
	Controller,
	Get,
	Query,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { GetAvailabilityDto } from './dtos/get-availability.dto';
import { GetAvailabilityResponse } from './dtos/get-availability.response';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { TenantCtx } from '../../types/express';

@Controller('availability')
@UseGuards(JwtAuthGuard, TenantMembershipGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
export class AvailabilityController {
	constructor(private readonly service: AvailabilityService) {}

	private getTenantIdOrThrow(tenant: TenantCtx | null): string {
		if (!tenant) {
			throw new UnauthorizedException({
				code: 'TENANT_CONTEXT_REQUIRED',
				message: 'Tenant context is required',
			});
		}

		return tenant.id;
	}

	@Get()
	async getAvailability(
		@Tenant() tenant: TenantCtx | null,
		@Query() q: GetAvailabilityDto,
	): Promise<GetAvailabilityResponse> {
		return this.service.getAvailability({
			tenantId: this.getTenantIdOrThrow(tenant),
			...q,
		});
	}
}