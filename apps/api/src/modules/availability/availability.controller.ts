import { Controller, Get, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

// Reemplazá por tu decorador real:
import { Tenant } from '../tenants/decorators/tenant.decorator';
import { GetAvailabilityDto } from './dtos/get-availability.dto';
import { GetAvailabilityResponse } from './dtos/get-availability.response';

@Controller('availability')
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