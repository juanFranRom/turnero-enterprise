import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, type Service } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateServiceDto } from './dtos/create-service.dto';
import { UpdateServiceDto } from './dtos/update-service.dto';
import { ListServicesQuery } from './dtos/list-services.query';
import {
	listWithCreatedAtCursor,
	toCursorListResponse,
} from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';
import {
	AUDIT_LOG_PORT,
	type AuditLogPort,
} from '../../infrastructure/adapters/audit/audit-log.port';

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
		@Inject(AUDIT_LOG_PORT)
		private readonly auditLog: AuditLogPort<Prisma.TransactionClient>,
	) {}

	private toAuditSnapshot(service: Service) {
		return {
			id: service.id,
			tenantId: service.tenantId,
			locationId: service.locationId,
			name: service.name,
			description: service.description,
			durationMinutes: service.durationMinutes,
			bufferBeforeMinutes: service.bufferBeforeMinutes,
			bufferAfterMinutes: service.bufferAfterMinutes,
			isActive: service.isActive,
			createdAt: service.createdAt.toISOString(),
			updatedAt: service.updatedAt.toISOString(),
		};
	}

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

	private async findLocationOrThrowTx(
		tx: Prisma.TransactionClient,
		tenantId: string,
		locationId: string,
	) {
		const location = await tx.location.findFirst({
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

	private async getByIdOrThrow(
		tenantId: string,
		id: string,
	): Promise<Service> {
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

	private async getByIdOrThrowTx(
		tx: Prisma.TransactionClient,
		tenantId: string,
		id: string,
	): Promise<Service> {
		const svc = await tx.service.findFirst({
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

	async create(
		tenantId: string,
		actorUserId: string,
		dto: CreateServiceDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				try {
					return await this.prisma.$transaction(async (tx) => {
						await this.findLocationOrThrowTx(tx, tenantId, dto.locationId);

						const created = await tx.service.create({
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

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'SERVICE',
								entityId: created.id,
								action: 'CREATE',
								before: null,
								after: this.toAuditSnapshot(created),
							},
						);

						return created;
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

				const result = await listWithCreatedAtCursor<
					Service,
					ServicesCursorScope
				>({
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

	async update(
		tenantId: string,
		actorUserId: string,
		id: string,
		dto: UpdateServiceDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				try {
					return await this.prisma.$transaction(async (tx) => {
						const existing = await this.getByIdOrThrowTx(tx, tenantId, id);

						const updated = await tx.service.update({
							where: { id: existing.id },
							data: {
								...(dto.name !== undefined
									? { name: dto.name.trim() }
									: {}),
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
								...(dto.isActive !== undefined
									? { isActive: dto.isActive }
									: {}),
							},
						});

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'SERVICE',
								entityId: updated.id,
								action: 'UPDATE',
								before: this.toAuditSnapshot(existing),
								after: this.toAuditSnapshot(updated),
							},
						);

						return updated;
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

	async delete(
		tenantId: string,
		actorUserId: string,
		id: string,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'delete',
			tenant: tenantId,
			run: async () => {
				return this.prisma.$transaction(async (tx) => {
					const existing = await this.getByIdOrThrowTx(tx, tenantId, id);

					const deleted = await tx.service.update({
						where: { id: existing.id },
						data: { isActive: false },
					});

					await this.auditLog.record(
						tx,
						{ type: 'USER', userId: actorUserId },
						{
							tenantId,
							entity: 'SERVICE',
							entityId: deleted.id,
							action: 'DELETE',
							before: this.toAuditSnapshot(existing),
							after: this.toAuditSnapshot(deleted),
							metadata: {
								mode: 'soft-delete',
							},
						},
					);

					return { success: true };
				});
			},
		});
	}
}