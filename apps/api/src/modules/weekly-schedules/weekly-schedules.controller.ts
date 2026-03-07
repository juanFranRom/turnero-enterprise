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

import { WeeklySchedulesService } from './weekly-schedules.service';
import { CreateWeeklyScheduleDto } from './dtos/create-weekly-schedule.dto';
import { UpdateWeeklyScheduleDto } from './dtos/update-weekly-schedule.dto';
import { ListWeeklySchedulesQuery } from './dtos/list-weekly-schedules.query';

@Controller('weekly-schedules')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class WeeklySchedulesController {
	constructor(private readonly weekly: WeeklySchedulesService) {}

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
		@Body() dto: CreateWeeklyScheduleDto,
	) {
		return this.weekly.create(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			dto,
		);
	}

	@Get()
	async list(
		@Tenant() tenant: TenantCtx | null,
		@Query() q: ListWeeklySchedulesQuery,
	) {
		return this.weekly.list(this.getTenantIdOrThrow(tenant), q);
	}

	@Get(':id')
	async get(
		@Tenant() tenant: TenantCtx | null,
		@Param('id') id: string,
	) {
		return this.weekly.getById(this.getTenantIdOrThrow(tenant), id);
	}

	@Patch(':id')
	async update(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
		@Body() dto: UpdateWeeklyScheduleDto,
	) {
		return this.weekly.update(
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
		return this.weekly.delete(
			this.getTenantIdOrThrow(tenant),
			user.userId,
			id,
		);
	}
}