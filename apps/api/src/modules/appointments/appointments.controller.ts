import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Headers,
	NotFoundException,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import type { TenantCtx } from '../../types/express';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CancelAppointmentDto } from './dtos/cancel-appointment.dto';
import { RescheduleAppointmentDto } from './dtos/reschedule-appointment.dto';
import { AppointmentResponseDto } from './dtos/appointment-response.dto';
import { GetAppointmentHistoryQueryDto } from './dtos/get-appointment-history.dto';
import { GetAppointmentsHistoryGlobalQueryDto } from './dtos/get-appointments-history-global.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, TenantMembershipGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
export class AppointmentsController {
	constructor(private readonly service: AppointmentsService) {}

	private getTenantOrThrow(tenant: TenantCtx | null): TenantCtx {
		if (!tenant) {
			throw new NotFoundException({
				code: 'TENANT_NOT_FOUND',
				message: 'Tenant not found',
			});
		}

		return tenant;
	}

	@Post()
	async create(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Body() dto: CreateAppointmentDto,
	): Promise<AppointmentResponseDto> {
		return this.service.create(
			this.getTenantOrThrow(tenant),
			user.userId,
			dto,
		);
	}

	@Patch(':id/cancel')
	async cancel(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
		@Headers('idempotency-key') idempotencyKey: string | undefined,
		@Body() dto: CancelAppointmentDto,
	): Promise<AppointmentResponseDto> {
		const finalKey = idempotencyKey ?? dto.idempotencyKey;

		if (finalKey && finalKey.length > 80) {
			throw new BadRequestException({
				code: 'INVALID_IDEMPOTENCY_KEY',
				message: 'Idempotency-Key must be at most 80 characters',
				details: {
					maxLength: 80,
					receivedLength: finalKey.length,
				},
			});
		}

		return this.service.cancel(this.getTenantOrThrow(tenant), user.userId, id, {
			...dto,
			idempotencyKey: finalKey,
		});
	}

	@Patch(':id/reschedule')
	async reschedule(
		@Tenant() tenant: TenantCtx | null,
		@CurrentUser() user: AuthUser,
		@Param('id') id: string,
		@Headers('idempotency-key') idempotencyKey: string | undefined,
		@Body() dto: RescheduleAppointmentDto,
	): Promise<AppointmentResponseDto> {
		const finalKey = idempotencyKey ?? dto.idempotencyKey;

		if (finalKey && finalKey.length > 80) {
			throw new BadRequestException({
				code: 'INVALID_IDEMPOTENCY_KEY',
				message: 'Idempotency-Key must be at most 80 characters',
				details: {
					maxLength: 80,
					receivedLength: finalKey.length,
				},
			});
		}

		return this.service.reschedule(
			this.getTenantOrThrow(tenant),
			user.userId,
			id,
			{
				...dto,
				idempotencyKey: finalKey,
			},
		);
	}

	@Get(':id/history')
	async history(
		@Param('id') id: string,
		@Query() query: GetAppointmentHistoryQueryDto,
		@Tenant() tenant: TenantCtx | null,
	) {
		const safeTenant = this.getTenantOrThrow(tenant);

		return this.service.getAppointmentHistory({
			tenantId: safeTenant.id,
			appointmentId: id,
			limit: query.limit,
			cursor: query.cursor,
		});
	}

	@Get('history')
	async historyGlobal(
		@Query() query: GetAppointmentsHistoryGlobalQueryDto,
		@Tenant() tenant: TenantCtx | null,
	) {
		const safeTenant = this.getTenantOrThrow(tenant);

		return this.service.getAppointmentsHistoryGlobal({
			tenantId: safeTenant.id,
			limit: query.limit,
			cursor: query.cursor,
			action: query.action,
			direction: query.direction,
			actorUserId: query.actorUserId,
			appointmentId: query.appointmentId,
			resourceId: query.resourceId,
			locationId: query.locationId,
			from: query.from,
			to: query.to,
		});
	}
}