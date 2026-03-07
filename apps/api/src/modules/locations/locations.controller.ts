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

import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ListLocationsQuery } from './dto/list-locations.query';

@Controller('locations')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

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
    @Body() dto: CreateLocationDto,
  ) {
    return this.locations.create(this.getTenantIdOrThrow(tenant), dto);
  }

  @Get()
  async list(
    @Tenant() tenant: TenantCtx | null,
    @Query() q: ListLocationsQuery,
  ) {
    return this.locations.list(this.getTenantIdOrThrow(tenant), q);
  }

  @Get(':id')
  async get(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.locations.getById(this.getTenantIdOrThrow(tenant), id);
  }

  @Patch(':id')
  async update(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locations.update(this.getTenantIdOrThrow(tenant), id, dto);
  }

  // Soft delete => isActive=false
  @Delete(':id')
  async remove(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.locations.delete(this.getTenantIdOrThrow(tenant), id);
  }
}