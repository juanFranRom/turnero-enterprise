import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WeeklySchedule } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateWeeklyScheduleDto } from './dtos/create-weekly-schedule.dto';
import { UpdateWeeklyScheduleDto } from './dtos/update-weekly-schedule.dto';
import { ListWeeklySchedulesQuery } from './dtos/list-weekly-schedules.query';
import { hhmmToDbTime } from '../../common/calendar/time-of-day';
import { parseOptionalDate } from '../../common/calendar/dates'; 
import { assertIntervalValid } from '../../common/calendar/intervals';


@Injectable()
export class WeeklySchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertLocationResourceSameTenant(tenantId: string, locationId: string, resourceId: string) {
    const [loc, res] = await Promise.all([
      this.prisma.location.findFirst({ where: { id: locationId, tenantId }, select: { id: true } }),
      this.prisma.resource.findFirst({ where: { id: resourceId, tenantId }, select: { id: true, locationId: true } }),
    ]);

    if (!loc) throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Location not found' });
    if (!res) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });

    // hardening: resource debe pertenecer a esa location (en tu schema Resource tiene locationId)
    if (res.locationId !== locationId) {
      throw new BadRequestException({
        code: 'RESOURCE_LOCATION_MISMATCH',
        message: 'Resource does not belong to location',
      });
    }
  }

  async create(tenantId: string, dto: CreateWeeklyScheduleDto): Promise<WeeklySchedule> {
    const start = hhmmToDbTime(dto.startTime);
    const end = hhmmToDbTime(dto.endTime);
    try {
    assertIntervalValid({ start, end }); // INVALID_INTERVAL
    } catch {
    throw new BadRequestException({ code: 'INVALID_TIME_RANGE', message: 'endTime must be after startTime' });
}

    const effectiveFrom = parseOptionalDate(dto.effectiveFrom) ?? new Date();
    const effectiveTo = parseOptionalDate(dto.effectiveTo);

    await this.assertLocationResourceSameTenant(tenantId, dto.locationId, dto.resourceId);

    try {
      return await this.prisma.weeklySchedule.create({
        data: {
          tenantId,
          locationId: dto.locationId,
          resourceId: dto.resourceId,
          dayOfWeek: dto.dayOfWeek,
          startTime: start,
          endTime: end,
          effectiveFrom: effectiveFrom!,
          effectiveTo: effectiveTo === undefined ? null : effectiveTo,
        },
      });
    } catch (e: any) {
      // unique([tenantId, resourceId, dayOfWeek, startTime, endTime])
      if (e?.code === 'P2002') {
        throw new ConflictException({
          code: 'WEEKLY_SCHEDULE_DUPLICATE',
          message: 'Weekly schedule already exists',
        });
      }
      throw e;
    }
  }

  async list(tenantId: string, q: ListWeeklySchedulesQuery) {
    const where: Prisma.WeeklyScheduleWhereInput = {
      tenantId,
      ...(q.resourceId ? { resourceId: q.resourceId } : {}),
      ...(q.locationId ? { locationId: q.locationId } : {}),
      ...(q.dayOfWeek ? { dayOfWeek: q.dayOfWeek } : {}),
    };

    return this.prisma.weeklySchedule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getById(tenantId: string, id: string) {
    const row = await this.prisma.weeklySchedule.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'WEEKLY_SCHEDULE_NOT_FOUND', message: 'Weekly schedule not found' });
    return row;
  }

  async update(tenantId: string, id: string, dto: UpdateWeeklyScheduleDto) {
    const existing = await this.getById(tenantId, id);

    const locationId = dto.locationId ?? existing.locationId;
    const resourceId = dto.resourceId ?? existing.resourceId;

    await this.assertLocationResourceSameTenant(tenantId, locationId, resourceId);

    const start = dto.startTime ? hhmmToDbTime(dto.startTime) : existing.startTime;
    const end = dto.endTime ? hhmmToDbTime(dto.endTime) : existing.endTime;

    try {
        assertIntervalValid({ start, end }); // INVALID_INTERVAL
    } catch {
        throw new BadRequestException({ code: 'INVALID_TIME_RANGE', message: 'endTime must be after startTime' });
    }

    const effectiveFrom = dto.effectiveFrom !== undefined ? (parseOptionalDate(dto.effectiveFrom) ?? new Date()) : existing.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo !== undefined ? parseOptionalDate(dto.effectiveTo) : existing.effectiveTo;

    try {
      return await this.prisma.weeklySchedule.update({
        where: { id },
        data: {
          locationId,
          resourceId,
          ...(dto.dayOfWeek !== undefined ? { dayOfWeek: dto.dayOfWeek } : {}),
          startTime: start,
          endTime: end,
          effectiveFrom,
          effectiveTo: effectiveTo === undefined ? null : effectiveTo,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException({
          code: 'WEEKLY_SCHEDULE_DUPLICATE',
          message: 'Weekly schedule already exists',
        });
      }
      throw e;
    }
  }

  async remove(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    await this.prisma.weeklySchedule.delete({ where: { id } });
    return { ok: true };
  }
}