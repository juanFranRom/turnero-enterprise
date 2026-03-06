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

import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dtos/create-resource.dto';
import { UpdateResourceDto } from './dtos/update-resource.dto';
import { ListResourcesQuery } from './dtos/list-resources.query';

@Controller('resources')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Post()
  async create(
    @Tenant() tenant: TenantCtx | null,
    @Body() dto: CreateResourceDto,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');

    return this.resources.create(tenant.id, dto);
  }

  @Get()
  async list(
    @Tenant() tenant: TenantCtx | null,
    @Query() q: ListResourcesQuery,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');

    return this.resources.list(tenant.id, q);
  }

  @Get(':id')
  async get(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');

    return this.resources.getById(tenant.id, id);
  }

  @Patch(':id')
  async update(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');

    return this.resources.update(tenant.id, id, dto);
  }

  @Delete(':id')
  async remove(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    if (!tenant) throw new UnauthorizedException('Invalid request');

    return this.resources.softDelete(tenant.id, id);
  }
}