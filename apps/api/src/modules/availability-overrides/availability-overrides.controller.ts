import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AvailabilityOverridesService } from './availability-overrides.service';
import { CreateAvailabilityOverrideDto } from './dtos/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dtos/update-availability-override.dto';
import { ListAvailabilityOverridesQueryDto } from './dtos/list-availability-overrides.query.dto';
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { TenantCtx } from '../../types/express';

@Controller('availability-overrides')
export class AvailabilityOverridesController {
  constructor(
    private readonly availabilityOverridesService: AvailabilityOverridesService,
  ) {}

  private getTenantId(tenant: TenantCtx | null): string {
    return tenant?.id ?? '';
  }

  @Post()
  create(
    @Tenant() tenant: TenantCtx | null,
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    return this.availabilityOverridesService.create(
      this.getTenantId(tenant),
      dto,
    );
  }

  @Get()
  list(
    @Tenant() tenant: TenantCtx | null,
    @Query() query: ListAvailabilityOverridesQueryDto,
  ) {
    return this.availabilityOverridesService.list(
      this.getTenantId(tenant),
      query,
    );
  }

  @Get(':id')
  getById(
    @Tenant() tenant: TenantCtx | null,
    @Param('id') id: string,
  ) {
    return this.availabilityOverridesService.getById(
      this.getTenantId(tenant),
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
      this.getTenantId(tenant),
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
      this.getTenantId(tenant),
      id,
    );
  }
}