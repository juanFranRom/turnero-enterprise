import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import type { TenantCtx } from '../../types/express';

import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dtos/create-resource.dto';
import { UpdateResourceDto } from './dtos/update-resource.dto';
import { ListResourcesQuery } from './dtos/list-resources.query';

@Controller('resources')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class ResourcesController {
	constructor(private readonly resources: ResourcesService) {}

	private getTenantIdOrThrow(tenant: TenantCtx | null): string {
		if (!tenant) {
			throw new UnauthorizedException({
				code: 'TENANT_CONTEXT_REQUIRED',
				message: 'Tenant context is required',
			});
		}

		return tenant.id;
	}

	@Post()
	async create(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Body() dto: CreateResourceDto,
	) {
		return this.resources.create(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			dto,
		);
	}

	@Get()
	async list(
		@Tenant() tenant: TenantCtx | null,
		@Query() q: ListResourcesQuery,
	) {
		return this.resources.list(this.getTenantIdOrThrow(tenant), q);
	}

	@Get(':id')
	async get(
		@Tenant() tenant: TenantCtx | null,
		@Param('id') id: string,
	) {
		return this.resources.getById(this.getTenantIdOrThrow(tenant), id);
	}

	@Patch(':id')
	async update(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
		@Body() dto: UpdateResourceDto,
	) {
		return this.resources.update(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
			dto,
		);
	}

	@Delete(':id')
	async remove(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
	) {
		return this.resources.delete(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
		);
	}
}