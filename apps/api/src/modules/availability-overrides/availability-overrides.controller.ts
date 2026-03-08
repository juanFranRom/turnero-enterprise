import {
	Body,
	Controller,
	Delete,
	Get,
	NotFoundException,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AvailabilityOverridesService } from './availability-overrides.service';
import { CreateAvailabilityOverrideDto } from './dtos/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dtos/update-availability-override.dto';
import { ListAvailabilityOverridesQueryDto } from './dtos/list-availability-overrides.query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { TenantCtx } from '../../types/express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';

@Controller('availability-overrides')
@UseGuards(JwtAuthGuard, TenantMembershipGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
export class AvailabilityOverridesController {
	constructor(
		private readonly availabilityOverridesService: AvailabilityOverridesService,
	) {}

	private getTenantIdOrThrow(tenant: TenantCtx | null): string {
		if (!tenant) {
			throw new NotFoundException({
				code: 'TENANT_NOT_FOUND',
				message: 'Tenant not found',
			});
		}

		return tenant.id;
	}

	@Post()
	create(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Body() dto: CreateAvailabilityOverrideDto,
	) {
		return this.availabilityOverridesService.create(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			dto,
		);
	}

	@Get()
	@Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
	list(
		@Tenant() tenant: TenantCtx | null,
		@Query() query: ListAvailabilityOverridesQueryDto,
	) {
		return this.availabilityOverridesService.list(
			this.getTenantIdOrThrow(tenant),
			query,
		);
	}

	@Get(':id')
	@Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
	getById(
		@Tenant() tenant: TenantCtx | null,
		@Param('id') id: string,
	) {
		return this.availabilityOverridesService.getById(
			this.getTenantIdOrThrow(tenant),
			id,
		);
	}

	@Patch(':id')
	update(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
		@Body() dto: UpdateAvailabilityOverrideDto,
	) {
		return this.availabilityOverridesService.update(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
			dto,
		);
	}

	@Delete(':id')
	remove(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
	) {
		return this.availabilityOverridesService.delete(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
		);
	}
}