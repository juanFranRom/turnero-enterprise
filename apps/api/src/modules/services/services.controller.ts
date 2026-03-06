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

import { ServicesService } from './services.service';
import { CreateServiceDto } from './dtos/create-service.dto';
import { UpdateServiceDto } from './dtos/update-service.dto';
import { ListServicesQuery } from './dtos/list-services.query';

@Controller('services')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  async create(@Tenant() tenant: TenantCtx | null, @Body() dto: CreateServiceDto) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.services.create(tenant.id, dto);
  }

  @Get()
  async list(@Tenant() tenant: TenantCtx | null, @Query() q: ListServicesQuery) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.services.list(tenant.id, q);
  }

  @Get(':id')
  async get(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.services.getById(tenant.id, id);
  }

  @Patch(':id')
  async update(@Tenant() tenant: TenantCtx | null, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.services.update(tenant.id, id, dto);
  }

  @Delete(':id')
  async remove(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.services.softDelete(tenant.id, id);
  }
}