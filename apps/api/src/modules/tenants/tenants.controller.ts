import { Controller, Get, Headers, BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async me(@Headers('x-tenant-slug') tenantSlug?: string) {
    if (!tenantSlug) throw new BadRequestException('Missing X-Tenant-Slug header');
    return this.tenantsService.findBySlug(tenantSlug);
  }
}
