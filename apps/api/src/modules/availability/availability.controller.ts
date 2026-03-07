import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

// Reemplazá por tu decorador real:
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { GetAvailabilityDto } from './dtos/get-availability.dto';
import { GetAvailabilityResponse } from './dtos/get-availability.response';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';

@Controller('availability')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class AvailabilityController {
    constructor(private readonly service: AvailabilityService) {}

    @Get()
    async getAvailability(
        @Tenant() tenant: { tenantId: string }, 
        @Query() q: GetAvailabilityDto
    ): Promise<GetAvailabilityResponse> {
        return this.service.getAvailability({
            tenantId: tenant.tenantId,
            ...q,
        });
    }
}