import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import type { TenantCtx } from '../../types/express';

import { ResourceServicesService } from './resource-services.service';
import { CreateResourceServiceDto } from './dtos/create-resource-service.dto';

@Controller()
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class ResourceServicesController {
	constructor(private readonly resourceServices: ResourceServicesService) {}

	private getTenantIdOrThrow(tenant: TenantCtx | null): string {
		if (!tenant) {
			throw new UnauthorizedException({
				code: 'TENANT_CONTEXT_REQUIRED',
				message: 'Tenant context is required',
			});
		}

		return tenant.id;
	}

	@Post('resource-services')
	async link(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Body() dto: CreateResourceServiceDto,
	) {
		return this.resourceServices.link(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			dto,
		);
	}

	@Delete('resource-services/:id')
	async unlink(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
	) {
		return this.resourceServices.unlink(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
		);
	}

	@Get('resources/:resourceId/services')
	async listServices(
		@Tenant() tenant: TenantCtx | null,
		@Param('resourceId') resourceId: string,
	) {
		return this.resourceServices.listServicesForResource(
			this.getTenantIdOrThrow(tenant),
			resourceId,
		);
	}

	@Get('services/:serviceId/resources')
	async listResources(
		@Tenant() tenant: TenantCtx | null,
		@Param('serviceId') serviceId: string,
	) {
		return this.resourceServices.listResourcesForService(
			this.getTenantIdOrThrow(tenant),
			serviceId,
		);
	}
}