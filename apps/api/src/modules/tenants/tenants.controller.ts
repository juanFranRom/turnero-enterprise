import {
	BadRequestException,
	Controller,
	Get,
	Headers,
	UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TenantMembershipGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
export class TenantsController {
	constructor(private readonly tenantsService: TenantsService) {}

	@Get('me')
	async me(@Headers('x-tenant-slug') tenantSlug?: string) {
		if (!tenantSlug) {
			throw new BadRequestException({
				code: 'TENANT_SLUG_REQUIRED',
				message: 'Missing X-Tenant-Slug header',
			});
		}

		return this.tenantsService.findBySlug(tenantSlug);
	}
}