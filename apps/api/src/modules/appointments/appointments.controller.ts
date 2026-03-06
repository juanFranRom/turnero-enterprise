import { Body, Controller, Param, Patch, Post, UseGuards, Headers, BadRequestException, NotFoundException, Query, Get  } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { TenantCtx } from '../../common/types/request-context';
import { CancelAppointmentDto } from './dtos/cancel-appointment.dto';
import { RescheduleAppointmentDto } from './dtos/reschedule-appointment.dto';
import { AppointmentResponseDto } from './dtos/appointment-response.dto';
import { GetAppointmentHistoryQueryDto } from './dtos/get-appointment-history.dto';
import { GetAppointmentsHistoryGlobalQueryDto } from './dtos/get-appointments-history-global.dto';


@Controller('appointments')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  async create(
    @Tenant() tenant:TenantCtx,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentResponseDto>  {
    return this.service.create(tenant, user.userId, dto);
  }

  @Patch(':id/cancel')
  async cancel(
    @Tenant() tenant: TenantCtx,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto>  {
    
    const finalKey = idempotencyKey ?? dto.idempotencyKey;
    if (finalKey && finalKey.length > 80) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key must be at most 80 characters',
          details: {
            maxLength: 80,
            receivedLength: finalKey.length,
          },
        },
      });
    }

    return this.service.cancel(tenant, user.userId, id, {
      ...dto,
      idempotencyKey: idempotencyKey ?? dto.idempotencyKey,
    });
  }

  @Patch(':id/reschedule')
  async reschedule(
    @Tenant() tenant: TenantCtx,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<AppointmentResponseDto>  {

    const finalKey = idempotencyKey ?? dto.idempotencyKey;
    if (finalKey && finalKey.length > 80) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key must be at most 80 characters',
          details: {
            maxLength: 80,
            receivedLength: finalKey.length,
          },
        },
      });
    }

    return this.service.reschedule(tenant, user.userId, id, {
      ...dto,
      idempotencyKey: idempotencyKey ?? dto.idempotencyKey,
    });
  }

  @Get(':id/history')
  async history(
    @Param('id') id: string,
    @Query() query: GetAppointmentHistoryQueryDto,
    @Tenant() tenant: TenantCtx | null,
  ) {
    if (!tenant) throw new NotFoundException();

    return this.service.getAppointmentHistory({
      tenantId: tenant.id,
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
    if (!tenant) throw new NotFoundException();

    return this.service.getAppointmentsHistoryGlobal({
      tenantId: tenant.id,
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