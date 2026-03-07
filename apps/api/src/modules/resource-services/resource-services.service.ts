import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateResourceServiceDto } from './dtos/create-resource-service.dto';
import { OwnerCrudMetrics } from '../../common/metrics';

@Injectable()
export class ResourceServicesService {
	private readonly metricEntity = 'resource_service' as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly ownerCrudMetrics: OwnerCrudMetrics,
	) {}

	private async findLinkByIdOrThrow(tenantId: string, id: string) {
		const link = await this.prisma.resourceService.findFirst({
			where: { id, tenantId },
			select: { id: true },
		});

		if (!link) {
			throw new NotFoundException({
				code: 'RESOURCE_SERVICE_NOT_FOUND',
				message: 'Link not found',
			});
		}

		return link;
	}

	async link(tenantId: string, dto: CreateResourceServiceDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
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
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'create',
						code: 'RESOURCE_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'RESOURCE_NOT_FOUND',
						message: 'Resource not found',
					});
				}

				if (!service) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'create',
						code: 'SERVICE_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'SERVICE_NOT_FOUND',
						message: 'Service not found',
					});
				}

				if (resource.locationId !== service.locationId) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'create',
						code: 'RESOURCE_SERVICE_LOCATION_MISMATCH',
						tenant: tenantId,
					});

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
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'create',
							code: 'RESOURCE_SERVICE_ALREADY_LINKED',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'RESOURCE_SERVICE_ALREADY_LINKED',
							message: 'Resource already linked to service',
						});
					}

					throw e;
				}
			},
		});
	}

	async unlinkById(tenantId: string, id: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'delete',
			tenant: tenantId,
			run: async () => {
				const link = await this.findLinkByIdOrThrow(tenantId, id);

				await this.prisma.resourceService.delete({
					where: { id: link.id },
				});

				return { ok: true };
			},
		});
	}

	async listServicesForResource(tenantId: string, resourceId: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'list',
			tenant: tenantId,
			run: async () => {
				const resource = await this.prisma.resource.findFirst({
					where: { id: resourceId, tenantId },
					select: { id: true },
				});

				if (!resource) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'list',
						code: 'RESOURCE_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'RESOURCE_NOT_FOUND',
						message: 'Resource not found',
					});
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
			},
		});
	}

	async listResourcesForService(tenantId: string, serviceId: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'list',
			tenant: tenantId,
			run: async () => {
				const service = await this.prisma.service.findFirst({
					where: { id: serviceId, tenantId },
					select: { id: true },
				});

				if (!service) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'list',
						code: 'SERVICE_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'SERVICE_NOT_FOUND',
						message: 'Service not found',
					});
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
			},
		});
	}
}