import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import type { TenantCtx } from '../../types/express';

import { ResourceServicesService } from './resource-services.service';
import { CreateResourceServiceDto } from './dtos/create-resource-service.dto';

@Controller()
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class ResourceServicesController {
  constructor(private readonly resourceServices: ResourceServicesService) {}

  @Post('resource-services')
  async link(@Tenant() tenant: TenantCtx | null, @Body() dto: CreateResourceServiceDto) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.resourceServices.link(tenant.id, dto);
  }

  @Delete('resource-services/:id')
  async unlink(@Tenant() tenant: TenantCtx | null, @Param('id') id: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.resourceServices.unlink(tenant.id, id);
  }

  @Get('resources/:resourceId/services')
  async listServices(@Tenant() tenant: TenantCtx | null, @Param('resourceId') resourceId: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.resourceServices.listServicesForResource(tenant.id, resourceId);
  }

  @Get('services/:serviceId/resources')
  async listResources(@Tenant() tenant: TenantCtx | null, @Param('serviceId') serviceId: string) {
    if (!tenant) throw new UnauthorizedException('Invalid request');
    return this.resourceServices.listResourcesForService(tenant.id, serviceId);
  }
}