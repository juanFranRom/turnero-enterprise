import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async me(@Headers('x-tenant-slug') tenantSlug?: string) {
    if (!tenantSlug) {
      throw new BadRequestException({
        code: 'TENANT_SLUG_REQUIRED',
        message: 'Missing X-Tenant-Slug header',
      });
    }

    return this.tenantsService.findBySlug(tenantSlug);
  }
}