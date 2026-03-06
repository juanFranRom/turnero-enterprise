import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Location } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ListLocationsQuery } from './dto/list-locations.query';
import { assertIanaTimeZone } from '../../common/calendar';
import { listWithCreatedAtCursor } from '../../common/pagination/list-with-cursor';

// Si ya tenés un cursor codec en common, reemplazá estas 2 funcs por el tuyo.
type LocationsCursorScope = {
  feed: 'locations';
  isActive?: boolean;
  search?: string;
  direction: 'asc' | 'desc';
};

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(tenantId: string, id: string): Promise<Location> {
    const loc = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });

    if (!loc) {
      throw new NotFoundException({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found',
      });
    }

    return loc;
  }

  private ensureTimeZone(timeZone?: string) {
    if (!timeZone) return;
    try {
      assertIanaTimeZone(timeZone);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_TIMEZONE',
        message: 'Invalid IANA timeZone',
        details: { timeZone },
      });
    }
  }

  async create(tenantId: string, dto: CreateLocationDto): Promise<Location> {
    this.ensureTimeZone(dto.timeZone);

    try {
      return await this.prisma.location.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          timeZone: dto.timeZone ?? 'UTC',
          isActive: dto.isActive ?? true,
        },
      });
    } catch (e: any) {
      // Unique [tenantId, name]
      if (e?.code === 'P2002') {
        throw new ConflictException({
          code: 'LOCATION_NAME_TAKEN',
          message: 'Location name already exists for this tenant',
          details: { name: dto.name },
        });
      }
      throw e;
    }
  }

  async list(tenantId: string, q: ListLocationsQuery) {
    const whereBase: Prisma.LocationWhereInput = {
      tenantId,
      ...(q.isActive === undefined ? {} : { isActive: q.isActive }),
      ...(q.search
        ? { name: { contains: q.search, mode: 'insensitive' } }
        : {}),
    };

    return listWithCreatedAtCursor<Location, LocationsCursorScope>({
      tenantId,
      query: q,
      scope: {
        feed: 'locations',
        isActive: q.isActive ?? undefined,
        search: q.search ?? undefined,
        direction: q.direction ?? 'desc',
      },
      whereBase,
      delegate: this.prisma.location,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateLocationDto): Promise<Location> {
    this.ensureTimeZone(dto.timeZone);

    // aseguramos existencia tenant-scoped
    await this.getById(tenantId, id);

    try {
      return await this.prisma.location.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException({
          code: 'LOCATION_NAME_TAKEN',
          message: 'Location name already exists for this tenant',
          details: { name: dto.name },
        });
      }
      throw e;
    }
  }

  async softDelete(tenantId: string, id: string): Promise<Location> {
    // existencia tenant-scoped
    await this.getById(tenantId, id);

    return this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }
}