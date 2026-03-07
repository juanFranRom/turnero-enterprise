import { Module } from '@nestjs/common';
import { AvailabilityOverridesController } from './availability-overrides.controller';
import { AvailabilityOverridesService } from './availability-overrides.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Module({
  controllers: [AvailabilityOverridesController],
  providers: [AvailabilityOverridesService, PrismaService],
  exports: [AvailabilityOverridesService],
})
export class AvailabilityOverridesModule {}