import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateResourceDto } from './dtos/create-resource.dto';
import { UpdateResourceDto } from './dtos/update-resource.dto';
import { ListResourcesQuery } from './dtos/list-resources.query';
import { Prisma, type Resource } from '@prisma/client';
import { listWithCreatedAtCursor } from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';

type ResourcesCursorScope = {
	feed: 'resources';
	locationId?: string;
	kind?: string;
	isActive?: boolean;
	direction: 'asc' | 'desc';
};

@Injectable()
export class ResourcesService {
	private readonly metricEntity = 'resource' as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly ownerCrudMetrics: OwnerCrudMetrics,
	) {}

	private async getByIdOrThrow(tenantId: string, id: string) {
		const resource = await this.prisma.resource.findFirst({
			where: { id, tenantId },
		});

		if (!resource) {
			throw new NotFoundException({
				code: 'RESOURCE_NOT_FOUND',
			});
		}

		return resource;
	}

	async create(tenantId: string, dto: CreateResourceDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				const location = await this.prisma.location.findFirst({
					where: { id: dto.locationId, tenantId },
					select: { id: true },
				});

				if (!location) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'create',
						code: 'LOCATION_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'LOCATION_NOT_FOUND',
					});
				}

				try {
					return await this.prisma.resource.create({
						data: {
							tenantId,
							locationId: dto.locationId,
							name: dto.name.trim(),
							kind: dto.kind ?? 'STAFF',
						},
					});
				} catch (e: any) {
					if (e.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'create',
							code: 'RESOURCE_NAME_TAKEN',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'RESOURCE_NAME_TAKEN',
						});
					}

					throw e;
				}
			},
		});
	}

	async list(tenantId: string, q: ListResourcesQuery) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'list',
			tenant: tenantId,
			run: async () => {
				const whereBase: Prisma.ResourceWhereInput = {
					tenantId,
					...(q.locationId ? { locationId: q.locationId } : {}),
					...(q.kind ? { kind: q.kind } : {}),
					...(q.isActive === undefined ? {} : { isActive: q.isActive }),
				};

				return listWithCreatedAtCursor<Resource, ResourcesCursorScope>({
					tenantId,
					query: q,
					scope: {
						feed: 'resources',
						locationId: q.locationId ?? undefined,
						kind: q.kind ?? undefined,
						isActive: q.isActive ?? undefined,
						direction: q.direction ?? 'desc',
					},
					whereBase,
					delegate: this.prisma.resource,
				});
			},
		});
	}

	async getById(tenantId: string, id: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'get',
			tenant: tenantId,
			run: async () => {
				const resource = await this.prisma.resource.findFirst({
					where: { id, tenantId },
				});

				if (!resource) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'get',
						code: 'RESOURCE_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'RESOURCE_NOT_FOUND',
					});
				}

				return resource;
			},
		});
	}

	async update(tenantId: string, id: string, dto: UpdateResourceDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				const existing = await this.getByIdOrThrow(tenantId, id);

				try {
					return await this.prisma.resource.update({
						where: { id: existing.id },
						data: dto,
					});
				} catch (e: any) {
					if (e.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'update',
							code: 'RESOURCE_NAME_TAKEN',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'RESOURCE_NAME_TAKEN',
						});
					}

					throw e;
				}
			},
		});
	}

	async softDelete(tenantId: string, id: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'delete',
			tenant: tenantId,
			run: async () => {
				const existing = await this.getByIdOrThrow(tenantId, id);

				return this.prisma.resource.update({
					where: { id: existing.id },
					data: { isActive: false },
				});
			},
		});
	}
}