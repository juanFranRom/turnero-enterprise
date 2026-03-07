import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, type Resource } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateResourceDto } from './dtos/create-resource.dto';
import { UpdateResourceDto } from './dtos/update-resource.dto';
import { ListResourcesQuery } from './dtos/list-resources.query';
import {
	listWithCreatedAtCursor,
	toCursorListResponse,
} from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';
import {
	AUDIT_LOG_PORT,
	type AuditLogPort,
} from '../../infrastructure/adapters/audit/audit-log.port';

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
		@Inject(AUDIT_LOG_PORT)
		private readonly auditLog: AuditLogPort<Prisma.TransactionClient>,
	) {}

	private toAuditSnapshot(resource: Resource) {
		return {
			id: resource.id,
			tenantId: resource.tenantId,
			locationId: resource.locationId,
			name: resource.name,
			kind: resource.kind,
			isActive: resource.isActive,
			createdAt: resource.createdAt.toISOString(),
			updatedAt: resource.updatedAt.toISOString(),
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
	): Promise<Resource> {
		const resource = await this.prisma.resource.findFirst({
			where: { id, tenantId },
		});

		if (!resource) {
			throw new NotFoundException({
				code: 'RESOURCE_NOT_FOUND',
				message: 'Resource not found',
			});
		}

		return resource;
	}

	private async getByIdOrThrowTx(
		tx: Prisma.TransactionClient,
		tenantId: string,
		id: string,
	): Promise<Resource> {
		const resource = await tx.resource.findFirst({
			where: { id, tenantId },
		});

		if (!resource) {
			throw new NotFoundException({
				code: 'RESOURCE_NOT_FOUND',
				message: 'Resource not found',
			});
		}

		return resource;
	}

	async create(
		tenantId: string,
		actorUserId: string,
		dto: CreateResourceDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				try {
					return await this.prisma.$transaction(async (tx) => {
						await this.findLocationOrThrowTx(tx, tenantId, dto.locationId);

						const created = await tx.resource.create({
							data: {
								tenantId,
								locationId: dto.locationId,
								name: dto.name.trim(),
								kind: dto.kind ?? 'STAFF',
							},
						});

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'RESOURCE',
								entityId: created.id,
								action: 'CREATE',
								before: null,
								after: this.toAuditSnapshot(created),
							},
						);

						return created;
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
							message: 'Resource name already exists',
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

				const result = await listWithCreatedAtCursor<
					Resource,
					ResourcesCursorScope
				>({
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
						code: 'RESOURCE_NOT_FOUND',
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
		dto: UpdateResourceDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				try {
					return await this.prisma.$transaction(async (tx) => {
						const existing = await this.getByIdOrThrowTx(tx, tenantId, id);

						const updated = await tx.resource.update({
							where: { id: existing.id },
							data: {
								...(dto.name !== undefined
									? { name: dto.name.trim() }
									: {}),
								...(dto.kind !== undefined
									? { kind: dto.kind }
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
								entity: 'RESOURCE',
								entityId: updated.id,
								action: 'UPDATE',
								before: this.toAuditSnapshot(existing),
								after: this.toAuditSnapshot(updated),
							},
						);

						return updated;
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
							message: 'Resource name already exists',
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

					const deleted = await tx.resource.update({
						where: { id: existing.id },
						data: { isActive: false },
					});

					await this.auditLog.record(
						tx,
						{ type: 'USER', userId: actorUserId },
						{
							tenantId,
							entity: 'RESOURCE',
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