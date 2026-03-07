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

  @Post()
  async create(@Tenant() tenant: TenantCtx | null, @Body() dto: CreateWeeklyScheduleDto) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.weekly.create(tenant.id, dto);
  }

  @Get()
  async list(@Tenant() tenant: TenantCtx | null, @Query() q: ListWeeklySchedulesQuery) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.weekly.list(tenant.id, q);
  }

  @Get(':id')
  async get(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.weekly.getById(tenant.id, id);
  }

  @Patch(':id')
  async update(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyScheduleDto,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.weekly.update(tenant.id, id, dto);
  }

  @Delete(':id')
  async remove(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.weekly.delete(tenant.id, id);
  }
}