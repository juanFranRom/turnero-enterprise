import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateResourceServiceDto } from './dtos/create-resource-service.dto';

@Injectable()
export class ResourceServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async link(tenantId: string, dto: CreateResourceServiceDto) {
    const [resource, service] = await Promise.all([
      this.prisma.resource.findFirst({
        where: { id: dto.resourceId, tenantId },
        select: { id: true, locationId: true },
      }),
      this.prisma.service.findFirst({
        where: { id: dto.serviceId, tenantId },
        select: { id: true, locationId: true },
      }),
    ]);

    if (!resource) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
    }
    if (!service) {
      throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }

    if (resource.locationId !== service.locationId) {
      throw new BadRequestException({
        code: 'RESOURCE_SERVICE_LOCATION_MISMATCH',
        message: 'Resource and service must belong to the same location',
        details: {
          resourceId: dto.resourceId,
          serviceId: dto.serviceId,
        },
      });
    }

    try {
      return await this.prisma.resourceService.create({
        data: {
          tenantId,
          resourceId: dto.resourceId,
          serviceId: dto.serviceId,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException({
          code: 'RESOURCE_SERVICE_ALREADY_LINKED',
          message: 'Resource already linked to service',
        });
      }
      throw e;
    }
  }

  async unlinkById(tenantId: string, id: string) {
    const link = await this.prisma.resourceService.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!link) {
      throw new NotFoundException({ code: 'RESOURCE_SERVICE_NOT_FOUND', message: 'Link not found' });
    }

    await this.prisma.resourceService.delete({ where: { id } });
    return { ok: true };
  }

  async listServicesForResource(tenantId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, tenantId },
      select: { id: true },
    });
    if (!resource) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
    }

    const links = await this.prisma.resourceService.findMany({
      where: { tenantId, resourceId },
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });

    return links.map((l) => ({
      linkId: l.id,
      service: l.service,
      linkedAt: l.createdAt,
    }));
  }

  async listResourcesForService(tenantId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, tenantId },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }

    const links = await this.prisma.resourceService.findMany({
      where: { tenantId, serviceId },
      orderBy: { createdAt: 'desc' },
      include: { resource: true },
    });

    return links.map((l) => ({
      linkId: l.id,
      resource: l.resource,
      linkedAt: l.createdAt,
    }));
  }
}