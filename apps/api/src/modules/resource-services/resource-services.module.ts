import { Module } from '@nestjs/common';
import { ResourceServicesController } from './resource-services.controller';
import { ResourceServicesService } from './resource-services.service';

@Module({
  controllers: [ResourceServicesController],
  providers: [ResourceServicesService],
  exports: [ResourceServicesService],
})
export class ResourceServicesModule {}