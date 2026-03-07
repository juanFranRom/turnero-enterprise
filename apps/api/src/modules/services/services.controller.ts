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

  private getTenantIdOrThrow(tenant: TenantCtx | null): string {
    if (!tenant) {
      throw new UnauthorizedException({
        error: {
          code: 'TENANT_CONTEXT_REQUIRED',
          message: 'Tenant context is required',
        },
      });
    }

    return tenant.id;
  }

  @Post()
  async create(
    @Tenant() tenant: TenantCtx | null,
    @Body() dto: CreateServiceDto,
  ) {
    return this.services.create(this.getTenantIdOrThrow(tenant), dto);
  }

  @Get()
  async list(
    @Tenant() tenant: TenantCtx | null,
    @Query() q: ListServicesQuery,
  ) {
    return this.services.list(this.getTenantIdOrThrow(tenant), q);
  }

  @Get(':id')
  async get(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.services.getById(this.getTenantIdOrThrow(tenant), id);
  }

  @Patch(':id')
  async update(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(this.getTenantIdOrThrow(tenant), id, dto);
  }

  @Delete(':id')
  async remove(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.services.delete(this.getTenantIdOrThrow(tenant), id);
  }
}