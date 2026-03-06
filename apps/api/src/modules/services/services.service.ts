import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateServiceDto } from './dtos/create-service.dto';
import { UpdateServiceDto } from './dtos/update-service.dto';
import { ListServicesQuery } from './dtos/list-services.query';
import { Prisma, type Service  } from '@prisma/client';
import { listWithCreatedAtCursor } from '../../common/pagination/list-with-cursor';

type ServicesCursorScope = {
  feed: 'services';
  locationId?: string;
  isActive?: boolean;
  direction: 'asc' | 'desc';
};

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateServiceDto) {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Location not found' });
    }

    try {
      return await this.prisma.service.create({
        data: {
          tenantId,
          locationId: dto.locationId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          durationMinutes: dto.durationMinutes,
          bufferBeforeMinutes: dto.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: dto.bufferAfterMinutes ?? 0,
          isActive: true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // unique [tenantId, locationId, name]
        throw new ConflictException({
          code: 'SERVICE_NAME_TAKEN',
          message: 'Service name already exists for this location',
          details: { name: dto.name },
        });
      }
      throw e;
    }
  }

  async list(tenantId: string, q: ListServicesQuery) {
    const whereBase: Prisma.ServiceWhereInput = {
      tenantId,
      ...(q.locationId ? { locationId: q.locationId } : {}),
      ...(q.isActive === undefined ? {} : { isActive: q.isActive }),
    };

    return listWithCreatedAtCursor<Service, ServicesCursorScope>({
      tenantId,
      query: q,
      scope: {
        feed: 'services',
        locationId: q.locationId ?? undefined,
        isActive: q.isActive ?? undefined,
        direction: q.direction ?? 'desc',
      },
      whereBase,
      delegate: this.prisma.service,
    });
  }

  async getById(tenantId: string, id: string) {
    const svc = await this.prisma.service.findFirst({
      where: { id, tenantId },
    });
    if (!svc) {
      throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }
    return svc;
  }

  async update(tenantId: string, id: string, dto: UpdateServiceDto) {
    await this.getById(tenantId, id);

    try {
      return await this.prisma.service.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
          ...(dto.bufferBeforeMinutes !== undefined ? { bufferBeforeMinutes: dto.bufferBeforeMinutes } : {}),
          ...(dto.bufferAfterMinutes !== undefined ? { bufferAfterMinutes: dto.bufferAfterMinutes } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException({
          code: 'SERVICE_NAME_TAKEN',
          message: 'Service name already exists for this location',
          details: { name: dto.name },
        });
      }
      throw e;
    }
  }

  async softDelete(tenantId: string, id: string) {
    await this.getById(tenantId, id);

    // enterprise-safe: si está linkeado por ResourceService, preferimos desactivar igual (soft)
    return this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}