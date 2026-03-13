import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, type Location } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ListLocationsQuery } from './dto/list-locations.query';
import { assertIanaTimeZone } from '../../common/calendar';
import {
	listWithCreatedAtCursor,
	toCursorListResponse,
} from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';
import {
	AUDIT_LOG_PORT,
	type AuditLogPort,
} from '../../infrastructure/adapters/audit/audit-log.port';

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
		@Inject(AUDIT_LOG_PORT)
		private readonly auditLog: AuditLogPort<Prisma.TransactionClient>,
	) {}

	private toAuditSnapshot(location: Location) {
		return {
			id: location.id,
			tenantId: location.tenantId,
			name: location.name,
			timeZone: location.timeZone,
			isActive: location.isActive,
			phone: location.phone,
			addressLine1: location.addressLine1,
			addressLine2: location.addressLine2,
			city: location.city,
			state: location.state,
			postalCode: location.postalCode,
			createdAt: location.createdAt.toISOString(),
			updatedAt: location.updatedAt.toISOString(),
		};
	}

	private async getByIdOrThrow(
		tenantId: string,
		id: string,
	): Promise<Location> {
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

	private async getByIdOrThrowTx(
		tx: Prisma.TransactionClient,
		tenantId: string,
		id: string,
	): Promise<Location> {
		const loc = await tx.location.findFirst({
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
		if (!timeZone) {
			return;
		}

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

	async create(
		tenantId: string,
		actorUserId: string,
		dto: CreateLocationDto,
	): Promise<Location> {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				this.ensureTimeZone(dto.timeZone, tenantId, 'create');

				try {
					return await this.prisma.$transaction(async (tx) => {
						const created = await tx.location.create({
							data: {
								tenantId,
								name: dto.name.trim(),
								timeZone: dto.timeZone ?? 'UTC',
								isActive: dto.isActive ?? true,
								phone: dto.phone?.trim(),
								addressLine1: dto.addressLine1?.trim(),
								addressLine2: dto.addressLine2?.trim(),
								city: dto.city?.trim(),
								state: dto.state?.trim(),
								postalCode: dto.postalCode?.trim(),
							},
						});

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'LOCATION',
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
						? {
								OR: [
									{ name: { contains: q.search, mode: 'insensitive' } },
									{ phone: { contains: q.search, mode: 'insensitive' } },
									{ addressLine1: { contains: q.search, mode: 'insensitive' } },
									{ addressLine2: { contains: q.search, mode: 'insensitive' } },
									{ city: { contains: q.search, mode: 'insensitive' } },
									{ state: { contains: q.search, mode: 'insensitive' } },
									{ postalCode: { contains: q.search, mode: 'insensitive' } },
								],
							}
						: {}),
				};

				const result = await listWithCreatedAtCursor<
					Location,
					LocationsCursorScope
				>({
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

	async update(
		tenantId: string,
		actorUserId: string,
		id: string,
		dto: UpdateLocationDto,
	): Promise<Location> {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				this.ensureTimeZone(dto.timeZone, tenantId, 'update');

				try {
					return await this.prisma.$transaction(async (tx) => {
						const existing = await this.getByIdOrThrowTx(tx, tenantId, id);

						const updated = await tx.location.update({
							where: { id: existing.id },
							data: {
								...(dto.name !== undefined
									? { name: dto.name.trim() }
									: {}),
								...(dto.timeZone !== undefined
									? { timeZone: dto.timeZone }
									: {}),
								...(dto.isActive !== undefined
									? { isActive: dto.isActive }
									: {}),
								...(dto.phone !== undefined
									? { phone: dto.phone?.trim() || null }
									: {}),
								...(dto.addressLine1 !== undefined
									? { addressLine1: dto.addressLine1?.trim() || null }
									: {}),
								...(dto.addressLine2 !== undefined
									? { addressLine2: dto.addressLine2?.trim() || null }
									: {}),
								...(dto.city !== undefined
									? { city: dto.city?.trim() || null }
									: {}),
								...(dto.state !== undefined
									? { state: dto.state?.trim() || null }
									: {}),
								...(dto.postalCode !== undefined
									? { postalCode: dto.postalCode?.trim() || null }
									: {}),
							},
						});

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'LOCATION',
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

					const deleted = await tx.location.update({
						where: { id: existing.id },
						data: { isActive: false },
					});

					await this.auditLog.record(
						tx,
						{ type: 'USER', userId: actorUserId },
						{
							tenantId,
							entity: 'LOCATION',
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