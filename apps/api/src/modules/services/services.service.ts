import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateServiceDto } from './dtos/create-service.dto';
import { UpdateServiceDto } from './dtos/update-service.dto';
import { ListServicesQuery } from './dtos/list-services.query';
import { Prisma, type Service } from '@prisma/client';
import {
	listWithCreatedAtCursor,
	toCursorListResponse,
} from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';

type ServicesCursorScope = {
	feed: 'services';
	locationId?: string;
	isActive?: boolean;
	direction: 'asc' | 'desc';
};

@Injectable()
export class ServicesService {
	private readonly metricEntity = 'service' as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly ownerCrudMetrics: OwnerCrudMetrics,
	) {}

	private async findLocationOrThrow(tenantId: string, locationId: string) {
		const location = await this.prisma.location.findFirst({
			where: { id: locationId, tenantId },
			select: { id: true },
		});

		if (!location) {
			throw new NotFoundException({
				code: 'LOCATION_NOT_FOUND',
				message: 'Location not found',
			});
		}

		return location;
	}

	private async getByIdOrThrow(tenantId: string, id: string): Promise<Service> {
		const svc = await this.prisma.service.findFirst({
			where: { id, tenantId },
		});

		if (!svc) {
			throw new NotFoundException({
				code: 'SERVICE_NOT_FOUND',
				message: 'Service not found',
			});
		}

		return svc;
	}

	async create(tenantId: string, dto: CreateServiceDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				await this.findLocationOrThrow(tenantId, dto.locationId);

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
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'create',
							code: 'SERVICE_NAME_TAKEN',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'SERVICE_NAME_TAKEN',
							message: 'Service name already exists for this location',
							details: { name: dto.name },
						});
					}

					throw e;
				}
			},
		});
	}

	async list(tenantId: string, q: ListServicesQuery) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'list',
			tenant: tenantId,
			run: async () => {
				const whereBase: Prisma.ServiceWhereInput = {
					tenantId,
					...(q.locationId ? { locationId: q.locationId } : {}),
					...(q.isActive === undefined ? {} : { isActive: q.isActive }),
				};

				const result = await listWithCreatedAtCursor<Service, ServicesCursorScope>({
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

				return toCursorListResponse(result);
			},
		});
	}

	async getById(tenantId: string, id: string) {
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
						code: 'SERVICE_NOT_FOUND',
						tenant: tenantId,
					});

					throw e;
				}
			},
		});
	}

	async update(tenantId: string, id: string, dto: UpdateServiceDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				const existing = await this.getByIdOrThrow(tenantId, id);

				try {
					return await this.prisma.service.update({
						where: { id: existing.id },
						data: {
							...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
							...(dto.description !== undefined
								? { description: dto.description?.trim() || null }
								: {}),
							...(dto.durationMinutes !== undefined
								? { durationMinutes: dto.durationMinutes }
								: {}),
							...(dto.bufferBeforeMinutes !== undefined
								? { bufferBeforeMinutes: dto.bufferBeforeMinutes }
								: {}),
							...(dto.bufferAfterMinutes !== undefined
								? { bufferAfterMinutes: dto.bufferAfterMinutes }
								: {}),
							...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
						},
					});
				} catch (e: any) {
					if (e?.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'update',
							code: 'SERVICE_NAME_TAKEN',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'SERVICE_NAME_TAKEN',
							message: 'Service name already exists for this location',
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

				await this.prisma.service.update({
					where: { id: existing.id },
					data: { isActive: false },
				});

				return { success: true };
			},
		});
	}
}