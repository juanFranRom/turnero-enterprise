import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AvailabilityOverridesService } from './availability-overrides.service';
import { CreateAvailabilityOverrideDto } from './dtos/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dtos/update-availability-override.dto';
import { ListAvailabilityOverridesQueryDto } from './dtos/list-availability-overrides.query.dto';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { TenantCtx } from '../../types/express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';

@Controller('availability-overrides')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class AvailabilityOverridesController {
  constructor(
    private readonly availabilityOverridesService: AvailabilityOverridesService,
  ) {}

  private getTenantIdOrThrow(tenant: TenantCtx | null): string {
    if (!tenant) {
      throw new NotFoundException({
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        },
      });
    }

    return tenant.id;
  }

  @Post()
  create(
    @Tenant() tenant: TenantCtx | null,
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    return this.availabilityOverridesService.create(
      this.getTenantIdOrThrow(tenant),
      dto,
    );
  }

  @Get()
  list(
    @Tenant() tenant: TenantCtx | null,
    @Query() query: ListAvailabilityOverridesQueryDto,
  ) {
    return this.availabilityOverridesService.list(
      this.getTenantIdOrThrow(tenant),
      query,
    );
  }

  @Get(':id')
  getById(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.availabilityOverridesService.getById(
      this.getTenantIdOrThrow(tenant),
      id,
    );
  }

  @Patch(':id')
  update(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityOverrideDto,
  ) {
    return this.availabilityOverridesService.update(
      this.getTenantIdOrThrow(tenant),
      id,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.availabilityOverridesService.delete(
      this.getTenantIdOrThrow(tenant),
      id,
    );
  }
}