import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityOverrideKind } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateAvailabilityOverrideDto } from './dtos/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dtos/update-availability-override.dto';
import { ListAvailabilityOverridesQueryDto } from './dtos/list-availability-overrides.query.dto';
import {
  assertIntervalValid,
  parseOptionalDate,
} from '../../common/calendar';
import { listWithCreatedAtCursor } from '../../common/pagination/list-with-cursor';

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined),
    ) as T;
}

@Injectable()
export class AvailabilityOverridesService {
    constructor(private readonly prisma: PrismaService) {}

    async create(tenantId: string, dto: CreateAvailabilityOverrideDto) {
        const startsAt = parseOptionalDate(dto.startsAt);
        const endsAt = parseOptionalDate(dto.endsAt);

        if (!(startsAt instanceof Date) || !(endsAt instanceof Date)) {
            throw new BadRequestException({
                code: 'INVALID_DATE',
                message: 'Invalid date',
            });
        }

        try {
            assertIntervalValid({ start: startsAt, end: endsAt });
        } catch {
            throw new BadRequestException({
                code: 'INVALID_INTERVAL',
                message: 'Invalid interval',
            });
        }

        const location = await this.prisma.location.findFirst({
            where: {
                id: dto.locationId,
                tenantId,
            },
            select: {
                id: true,
            },
        });

        if (!location) {
            throw new NotFoundException({
                code: 'LOCATION_NOT_FOUND',
                message: 'Location not found',
            });
        }

        const resource = await this.prisma.resource.findFirst({
            where: {
                id: dto.resourceId,
                tenantId,
            },
            select: {
                id: true,
                locationId: true,
            },
        });

        if (!resource) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Resource not found',
            });
        }

        if (resource.locationId !== dto.locationId) {
            throw new BadRequestException({
                code: 'INVALID_LOCATION_RESOURCE_RELATION',
                message: 'Resource does not belong to location',
            });
        }

        await this.assertNoOverlap({
            tenantId,
            resourceId: dto.resourceId,
            startsAt,
            endsAt,
        });

        try {
            return await this.prisma.availabilityOverride.create({
                data: {
                tenantId,
                locationId: dto.locationId,
                resourceId: dto.resourceId,
                kind: dto.kind,
                startsAt,
                endsAt,
                reason: dto.reason ?? null,
                },
            });
        } catch (error: any) {
            this.rethrowIfOverrideOverlap(error);
            throw error;
        }
    }

    async list(tenantId: string, query: ListAvailabilityOverridesQueryDto) {
        const startsFrom = parseOptionalDate(query.startsFrom);
        const startsTo = parseOptionalDate(query.startsTo);
        const endsFrom = parseOptionalDate(query.endsFrom);
        const endsTo = parseOptionalDate(query.endsTo);

        const scope = omitUndefined({
            locationId: query.locationId,
            resourceId: query.resourceId,
            kind: query.kind,
            startsFrom: startsFrom?.toISOString(),
            startsTo: startsTo?.toISOString(),
            endsFrom: endsFrom?.toISOString(),
            endsTo: endsTo?.toISOString(),
            upcomingOnly: query.upcomingOnly,
            direction: query.direction ?? 'desc',
        });

        const whereBase = omitUndefined({
            tenantId,
            locationId: query.locationId,
            resourceId: query.resourceId,
            kind: query.kind,
            ...(startsFrom || startsTo
                ? {
                    startsAt: omitUndefined({
                    gte: startsFrom,
                    lte: startsTo,
                    }),
                }
                : {}),
            ...(endsFrom || endsTo
                ? {
                    endsAt: omitUndefined({
                    gte: endsFrom,
                    lte: endsTo,
                    }),
                }
                : {}),
            ...(query.upcomingOnly
                ? {
                    endsAt: {
                    ...(endsFrom ? { gte: endsFrom } : {}),
                    gt: new Date(),
                    ...(endsTo ? { lte: endsTo } : {}),
                    },
                }
                : {}),
        });

        const result = await listWithCreatedAtCursor({
            tenantId,
            query,
            scope,
            whereBase,
            delegate: this.prisma.availabilityOverride,
            maxLimit: 100,
        });

        return {
            data: result.items,
            nextCursor: result.nextCursor,
        };
    }

    async getById(tenantId: string, id: string) {
        const item = await this.prisma.availabilityOverride.findFirst({
            where: {
                id,
                tenantId,
            },
        });

        if (!item) {
            throw new NotFoundException({
                code: 'AVAILABILITY_OVERRIDE_NOT_FOUND',
                message: 'Availability override not found',
            });
        }

        return item;
    }

    async update(
        tenantId: string,
        id: string,
        dto: UpdateAvailabilityOverrideDto,
    ) {
        const existing = await this.prisma.availabilityOverride.findFirst({
            where: {
                id,
                tenantId,
            },
            select: {
                id: true,
                tenantId: true,
                locationId: true,
                resourceId: true,
                kind: true,
                startsAt: true,
                endsAt: true,
                reason: true,
            },
        });

        if (!existing) {
            throw new NotFoundException({
                code: 'AVAILABILITY_OVERRIDE_NOT_FOUND',
                message: 'Availability override not found',
            });
        }

        const startsAt = dto.startsAt
            ? parseOptionalDate(dto.startsAt)
            : existing.startsAt;
        const endsAt = dto.endsAt ? parseOptionalDate(dto.endsAt) : existing.endsAt;

        if (!(startsAt instanceof Date) || !(endsAt instanceof Date)) {
            throw new BadRequestException({
                code: 'INVALID_DATE',
                message: 'Invalid date',
            });
        }

        try {
            assertIntervalValid({ start: startsAt, end: endsAt });
        } catch {
            throw new BadRequestException({
                code: 'INVALID_INTERVAL',
                message: 'Invalid interval',
            });
        }

        await this.assertNoOverlap({
            tenantId,
            resourceId: existing.resourceId,
            startsAt,
            endsAt,
            excludeId: existing.id,
        });

        try {
            return await this.prisma.availabilityOverride.update({
                where: { id: existing.id },
                data: {
                kind: dto.kind ?? existing.kind,
                startsAt,
                endsAt,
                reason: dto.reason ?? existing.reason,
                },
            });
        } catch (error: any) {
            this.rethrowIfOverrideOverlap(error);
            throw error;
        }
    }

    async remove(tenantId: string, id: string) {
        const existing = await this.prisma.availabilityOverride.findFirst({
            where: {
                id,
                tenantId,
            },
            select: {
                id: true,
            },
        });

        if (!existing) {
            throw new NotFoundException({
                code: 'AVAILABILITY_OVERRIDE_NOT_FOUND',
                message: 'Availability override not found',
            });
        }

        await this.prisma.availabilityOverride.delete({
            where: { id: existing.id },
        });

        return {
            success: true,
        };
    }

    private async assertNoOverlap(args: {
        tenantId: string;
        resourceId: string;
        startsAt: Date;
        endsAt: Date;
        excludeId?: string;
    }) {
        const conflict = await this.prisma.availabilityOverride.findFirst({
            where: {
                tenantId: args.tenantId,
                resourceId: args.resourceId,
                ...(args.excludeId ? { id: { not: args.excludeId } } : {}),
                startsAt: { lt: args.endsAt },
                endsAt: { gt: args.startsAt },
            },
            select: {
                id: true,
            },
        });

        if (conflict) {
            throw new ConflictException({
                code: 'AVAILABILITY_OVERRIDE_OVERLAP',
                message: 'Availability override overlaps existing one',
                details: {
                    conflictingOverrideId: conflict.id,
                },
            });
        }
    }

    private rethrowIfOverrideOverlap(error: any): never | void {
        const message = String(error?.message ?? '');
        const metaTarget = error?.meta?.target;

        if (
            error?.code === 'P2004' ||
            message.includes('availability_override_no_overlap') ||
            message.includes('AvailabilityOverride') ||
            String(metaTarget ?? '').includes('availability_override_no_overlap')
        ) {
            throw new ConflictException({
                code: 'AVAILABILITY_OVERRIDE_OVERLAP',
                message: 'Availability override overlaps existing one',
            });
        }
    }
}