import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, type AvailabilityOverride } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateAvailabilityOverrideDto } from './dtos/create-availability-override.dto';
import { UpdateAvailabilityOverrideDto } from './dtos/update-availability-override.dto';
import { ListAvailabilityOverridesQueryDto } from './dtos/list-availability-overrides.query.dto';
import {
	assertIntervalValid,
	parseOptionalDate,
} from '../../common/calendar';
import {
	listWithCreatedAtCursor,
	toCursorListResponse,
} from '../../common/pagination/list-with-cursor';
import { OwnerCrudMetrics } from '../../common/metrics';
import {
	AUDIT_LOG_PORT,
	type AuditLogPort,
} from '../../infrastructure/adapters/audit/audit-log.port';

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
	return Object.fromEntries(
		Object.entries(obj).filter(([, value]) => value !== undefined),
	) as T;
}

@Injectable()
export class AvailabilityOverridesService {
	private readonly metricEntity = 'availability_override' as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly ownerCrudMetrics: OwnerCrudMetrics,
		@Inject(AUDIT_LOG_PORT)
		private readonly auditLog: AuditLogPort<Prisma.TransactionClient>,
	) {}

	private toAuditSnapshot(item: AvailabilityOverride) {
		return {
			id: item.id,
			tenantId: item.tenantId,
			locationId: item.locationId,
			resourceId: item.resourceId,
			kind: item.kind,
			startsAt: item.startsAt.toISOString(),
			endsAt: item.endsAt.toISOString(),
			reason: item.reason,
			createdAt: item.createdAt.toISOString(),
			updatedAt: item.updatedAt.toISOString(),
		};
	}

	async create(
		tenantId: string,
		actorUserId: string,
		dto: CreateAvailabilityOverrideDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				const startsAt = this.parseRequiredDate(dto.startsAt, tenantId, 'create');
				const endsAt = this.parseRequiredDate(dto.endsAt, tenantId, 'create');

				this.assertValidInterval(
					{ start: startsAt, end: endsAt },
					tenantId,
					'create',
				);

				try {
					return await this.prisma.$transaction(async (tx) => {
						const location = await tx.location.findFirst({
							where: {
								id: dto.locationId,
								tenantId,
							},
							select: {
								id: true,
							},
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
								message: 'Location not found',
							});
						}

						const resource = await tx.resource.findFirst({
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

						if (resource.locationId !== dto.locationId) {
							this.ownerCrudMetrics.validationError({
								entity: this.metricEntity,
								action: 'create',
								code: 'INVALID_LOCATION_RESOURCE_RELATION',
								tenant: tenantId,
							});

							throw new BadRequestException({
								code: 'INVALID_LOCATION_RESOURCE_RELATION',
								message: 'Resource does not belong to location',
							});
						}

						await this.assertNoOverlapTx({
							tx,
							tenantId,
							resourceId: dto.resourceId,
							startsAt,
							endsAt,
							action: 'create',
						});

						const created = await tx.availabilityOverride.create({
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

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'AVAILABILITY_OVERRIDE',
								entityId: created.id,
								action: 'CREATE',
								before: null,
								after: this.toAuditSnapshot(created),
							},
						);

						return created;
					});
				} catch (error: any) {
					this.rethrowIfOverrideOverlap(error, tenantId, 'create');
					throw error;
				}
			},
		});
	}

	async list(tenantId: string, query: ListAvailabilityOverridesQueryDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'list',
			tenant: tenantId,
			run: async () => {
				const startsFrom = this.parseQueryDate(query.startsFrom, tenantId, 'list');
				const startsTo = this.parseQueryDate(query.startsTo, tenantId, 'list');
				const endsFrom = this.parseQueryDate(query.endsFrom, tenantId, 'list');
				const endsTo = this.parseQueryDate(query.endsTo, tenantId, 'list');

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
				const item = await this.findByIdOrThrow(tenantId, id);

				return item;
			},
		});
	}

	private async findByIdOrThrow(
		tenantId: string,
		id: string,
		select?: Record<string, unknown>,
	) {
		const item = await this.prisma.availabilityOverride.findFirst({
			where: { id, tenantId },
			...(select ? { select } : {}),
		});

		if (!item) {
			throw new NotFoundException({
				code: 'AVAILABILITY_OVERRIDE_NOT_FOUND',
				message: 'Availability override not found',
			});
		}

		return item;
	}

	private async findByIdOrThrowTx(
		tx: Prisma.TransactionClient,
		tenantId: string,
		id: string,
		select?: Record<string, unknown>,
	) {
		const item = await tx.availabilityOverride.findFirst({
			where: { id, tenantId },
			...(select ? { select } : {}),
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
		actorUserId: string,
		id: string,
		dto: UpdateAvailabilityOverrideDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				try {
					return await this.prisma.$transaction(async (tx) => {
						const existing = await this.findByIdOrThrowTx(tx, tenantId, id, {
							id: true,
							tenantId: true,
							locationId: true,
							resourceId: true,
							kind: true,
							startsAt: true,
							endsAt: true,
							reason: true,
							createdAt: true,
							updatedAt: true,
						});

						const startsAt = dto.startsAt
							? this.parseRequiredDate(dto.startsAt, tenantId, 'update')
							: existing.startsAt;

						const endsAt = dto.endsAt
							? this.parseRequiredDate(dto.endsAt, tenantId, 'update')
							: existing.endsAt;

						this.assertValidInterval(
							{ start: startsAt, end: endsAt },
							tenantId,
							'update',
						);

						await this.assertNoOverlapTx({
							tx,
							tenantId,
							resourceId: existing.resourceId,
							startsAt,
							endsAt,
							excludeId: existing.id,
							action: 'update',
						});

						const updated = await tx.availabilityOverride.update({
							where: { id: existing.id },
							data: {
								kind: dto.kind ?? existing.kind,
								startsAt,
								endsAt,
								reason: dto.reason ?? existing.reason,
							},
						});

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'AVAILABILITY_OVERRIDE',
								entityId: updated.id,
								action: 'UPDATE',
								before: this.toAuditSnapshot(existing as AvailabilityOverride),
								after: this.toAuditSnapshot(updated),
							},
						);

						return updated;
					});
				} catch (error: any) {
					this.rethrowIfOverrideOverlap(error, tenantId, 'update');
					throw error;
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
					const existing = await this.findByIdOrThrowTx(tx, tenantId, id, {
						id: true,
						tenantId: true,
						locationId: true,
						resourceId: true,
						kind: true,
						startsAt: true,
						endsAt: true,
						reason: true,
						createdAt: true,
						updatedAt: true,
					});

					await tx.availabilityOverride.delete({
						where: { id: existing.id },
					});

					await this.auditLog.record(
						tx,
						{ type: 'USER', userId: actorUserId },
						{
							tenantId,
							entity: 'AVAILABILITY_OVERRIDE',
							entityId: existing.id,
							action: 'DELETE',
							before: this.toAuditSnapshot(existing as AvailabilityOverride),
							after: null,
							metadata: {
								mode: 'hard-delete',
							},
						},
					);

					return {
						success: true,
					};
				});
			},
		});
	}

	private parseRequiredDate(
		input: string,
		tenantId: string,
		action: 'create' | 'update',
	): Date {
		const parsed = parseOptionalDate(input);

		if (!(parsed instanceof Date)) {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'INVALID_DATE',
				tenant: tenantId,
			});

			throw new BadRequestException({
				code: 'INVALID_DATE',
				message: 'Invalid date',
			});
		}

		return parsed;
	}

	private parseQueryDate(
		input: string | undefined,
		tenantId: string,
		action: 'list',
	): Date | undefined {
		try {
			const parsed = parseOptionalDate(input);
			return parsed === null ? undefined : parsed;
		} catch {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'INVALID_DATE',
				tenant: tenantId,
			});

			throw new BadRequestException({
				code: 'INVALID_DATE',
				message: 'Invalid date',
			});
		}
	}

	private assertValidInterval(
		interval: { start: Date; end: Date },
		tenantId: string,
		action: 'create' | 'update',
	) {
		try {
			assertIntervalValid(interval);
		} catch {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'INVALID_INTERVAL',
				tenant: tenantId,
			});

			throw new BadRequestException({
				code: 'INVALID_INTERVAL',
				message: 'Invalid interval',
			});
		}
	}

	private async assertNoOverlap(args: {
		tenantId: string;
		resourceId: string;
		startsAt: Date;
		endsAt: Date;
		excludeId?: string;
		action: 'create' | 'update';
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
			this.ownerCrudMetrics.conflictError({
				entity: this.metricEntity,
				action: args.action,
				code: 'AVAILABILITY_OVERRIDE_OVERLAP',
				tenant: args.tenantId,
			});

			throw new ConflictException({
				code: 'AVAILABILITY_OVERRIDE_OVERLAP',
				message: 'Availability override overlaps existing one',
				details: {
					conflictingOverrideId: conflict.id,
				},
			});
		}
	}

	private async assertNoOverlapTx(args: {
		tx: Prisma.TransactionClient;
		tenantId: string;
		resourceId: string;
		startsAt: Date;
		endsAt: Date;
		excludeId?: string;
		action: 'create' | 'update';
	}) {
		const conflict = await args.tx.availabilityOverride.findFirst({
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
			this.ownerCrudMetrics.conflictError({
				entity: this.metricEntity,
				action: args.action,
				code: 'AVAILABILITY_OVERRIDE_OVERLAP',
				tenant: args.tenantId,
			});

			throw new ConflictException({
				code: 'AVAILABILITY_OVERRIDE_OVERLAP',
				message: 'Availability override overlaps existing one',
				details: {
					conflictingOverrideId: conflict.id,
				},
			});
		}
	}

	private rethrowIfOverrideOverlap(
		error: any,
		tenantId: string,
		action: 'create' | 'update',
	): never | void {
		const message = String(error?.message ?? '');
		const metaTarget = error?.meta?.target;

		if (
			error?.code === 'P2004' ||
			message.includes('availability_override_no_overlap') ||
			String(metaTarget ?? '').includes('availability_override_no_overlap')
		) {
			this.ownerCrudMetrics.conflictError({
				entity: this.metricEntity,
				action,
				code: 'AVAILABILITY_OVERRIDE_OVERLAP',
				tenant: tenantId,
			});

			throw new ConflictException({
				code: 'AVAILABILITY_OVERRIDE_OVERLAP',
				message: 'Availability override overlaps existing one',
			});
		}
	}
}