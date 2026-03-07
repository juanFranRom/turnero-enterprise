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
  constructor(private readonly locations: LocationsService) {
    console.log("se levanto locations")
  }

  @Post()
  async create(@Tenant() tenant: TenantCtx | null, @Body() dto: CreateLocationDto) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.locations.create(tenant.id, dto);
  }

  @Get()
  async list(@Tenant() tenant: TenantCtx | null, @Query() q: ListLocationsQuery) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.locations.list(tenant.id, q);
  }

  @Get(':id')
  async get(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.locations.getById(tenant.id, id);
  }

  @Patch(':id')
  async update(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.locations.update(tenant.id, id, dto);
  }

  // Soft delete => isActive=false
  @Delete(':id')
  async remove(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.locations.delete(tenant.id, id);
  }
}