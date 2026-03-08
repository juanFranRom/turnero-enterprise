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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import type { TenantCtx } from '../../types/express';

import { ServicesService } from './services.service';
import { CreateServiceDto } from './dtos/create-service.dto';
import { UpdateServiceDto } from './dtos/update-service.dto';
import { ListServicesQuery } from './dtos/list-services.query';

@Controller('services')
@UseGuards(JwtAuthGuard, TenantMembershipGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
export class ServicesController {
	constructor(private readonly services: ServicesService) {}

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
		@Body() dto: CreateServiceDto,
	) {
		return this.services.create(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			dto,
		);
	}

	@Get()
	@Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
	async list(
		@Tenant() tenant: TenantCtx | null,
		@Query() q: ListServicesQuery,
	) {
		return this.services.list(this.getTenantIdOrThrow(tenant), q);
	}

	@Get(':id')
	@Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
	async get(
		@Tenant() tenant: TenantCtx | null,
		@Param('id') id: string,
	) {
		return this.services.getById(this.getTenantIdOrThrow(tenant), id);
	}

	@Patch(':id')
	async update(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
		@Body() dto: UpdateServiceDto,
	) {
		return this.services.update(
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
		return this.services.delete(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
		);
	}
}