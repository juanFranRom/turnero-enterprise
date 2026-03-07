import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, type Location } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ListLocationsQuery } from './dto/list-locations.query';
import { assertIanaTimeZone } from '../../common/calendar';
import { listWithCreatedAtCursor, toCursorListResponse } from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';

type LocationsCursorScope = {
	feed: 'locations';
	isActive?: boolean;
	search?: string;
	direction: 'asc' | 'desc';
};

@Injectable()
export class LocationsService {
	private readonly metricEntity = 'location' as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly ownerCrudMetrics: OwnerCrudMetrics,
	) {}

	private async getByIdOrThrow(tenantId: string, id: string): Promise<Location> {
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

	private ensureTimeZone(
		timeZone: string | undefined,
		tenantId: string,
		action: 'create' | 'update',
	) {
		if (!timeZone) return;

		try {
			assertIanaTimeZone(timeZone);
		} catch {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'INVALID_TIMEZONE',
				tenant: tenantId,
			});

			throw new BadRequestException({
				code: 'INVALID_TIMEZONE',
				message: 'Invalid IANA timeZone',
				details: { timeZone },
			});
		}
	}

	async getById(tenantId: string, id: string): Promise<Location> {
    return this.ownerCrudMetrics.track({
      entity: this.metricEntity,
      action: 'get',
      tenant: tenantId,
      run: async () => {
        try {
          return await this.getByIdOrThrow(tenantId, id);
        } catch (e) {
          this.ownerCrudMetrics.validationError({
            entity: this.metricEntity,
            action: 'get',
            code: 'LOCATION_NOT_FOUND',
            tenant: tenantId,
          });

          throw e;
        }
      },
    });
  }

	async create(tenantId: string, dto: CreateLocationDto): Promise<Location> {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				this.ensureTimeZone(dto.timeZone, tenantId, 'create');

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
					if (e?.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'create',
							code: 'LOCATION_NAME_TAKEN',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'LOCATION_NAME_TAKEN',
							message: 'Location name already exists for this tenant',
							details: { name: dto.name },
						});
					}

					throw e;
				}
			},
		});
	}

	async list(tenantId: string, q: ListLocationsQuery) {
    return this.ownerCrudMetrics.track({
      entity: this.metricEntity,
      action: 'list',
      tenant: tenantId,
      run: async () => {
        const whereBase: Prisma.LocationWhereInput = {
          tenantId,
          ...(q.isActive === undefined ? {} : { isActive: q.isActive }),
          ...(q.search
            ? { name: { contains: q.search, mode: 'insensitive' } }
            : {}),
        };

        const result = await listWithCreatedAtCursor<Location, LocationsCursorScope>({
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

        return toCursorListResponse(result);
      },
    });
  }

	async update(tenantId: string, id: string, dto: UpdateLocationDto): Promise<Location> {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				this.ensureTimeZone(dto.timeZone, tenantId, 'update');

				const existing = await this.getByIdOrThrow(tenantId, id);

				try {
					return await this.prisma.location.update({
						where: { id: existing.id },
						data: {
							...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
							...(dto.timeZone !== undefined
								? { timeZone: dto.timeZone }
								: {}),
							...(dto.isActive !== undefined
								? { isActive: dto.isActive }
								: {}),
						},
					});
				} catch (e: any) {
					if (e?.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'update',
							code: 'LOCATION_NAME_TAKEN',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'LOCATION_NAME_TAKEN',
							message: 'Location name already exists for this tenant',
							details: { name: dto.name },
						});
					}

					throw e;
				}
			},
		});
	}

	async delete(tenantId: string, id: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'delete',
			tenant: tenantId,
			run: async () => {
				const existing = await this.getByIdOrThrow(tenantId, id);

				await this.prisma.location.update({
          where: { id: existing.id },
          data: { isActive: false },
        });

        return { success: true };
			},
		});
	}
}