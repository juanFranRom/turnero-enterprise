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
import { OwnerCrudMetrics } from '../../common/metrics';

@Injectable()
export class WeeklySchedulesService {
	private readonly metricEntity = 'weekly_schedule' as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly ownerCrudMetrics: OwnerCrudMetrics,
	) {}

	private async assertLocationResourceSameTenant(
		tenantId: string,
		locationId: string,
		resourceId: string,
		action: 'create' | 'update',
	) {
		const [loc, res] = await Promise.all([
			this.prisma.location.findFirst({
				where: { id: locationId, tenantId },
				select: { id: true },
			}),
			this.prisma.resource.findFirst({
				where: { id: resourceId, tenantId },
				select: { id: true, locationId: true },
			}),
		]);

		if (!loc) {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'LOCATION_NOT_FOUND',
				tenant: tenantId,
			});

			throw new NotFoundException({
				code: 'LOCATION_NOT_FOUND',
				message: 'Location not found',
			});
		}

		if (!res) {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'RESOURCE_NOT_FOUND',
				tenant: tenantId,
			});

			throw new NotFoundException({
				code: 'RESOURCE_NOT_FOUND',
				message: 'Resource not found',
			});
		}

		if (res.locationId !== locationId) {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'RESOURCE_LOCATION_MISMATCH',
				tenant: tenantId,
			});

			throw new BadRequestException({
				code: 'RESOURCE_LOCATION_MISMATCH',
				message: 'Resource does not belong to location',
			});
		}
	}

	private assertValidTimeRange(
		start: Date,
		end: Date,
		tenantId: string,
		action: 'create' | 'update',
	) {
		try {
			assertIntervalValid({ start, end });
		} catch {
			this.ownerCrudMetrics.validationError({
				entity: this.metricEntity,
				action,
				code: 'INVALID_TIME_RANGE',
				tenant: tenantId,
			});

			throw new BadRequestException({
				code: 'INVALID_TIME_RANGE',
				message: 'endTime must be after startTime',
			});
		}
	}

	private parseEffectiveDate(
		input: string | null | undefined,
		tenantId: string,
		action: 'create' | 'update',
	): Date | null | undefined {
		try {
			return parseOptionalDate(input);
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

	async create(tenantId: string, dto: CreateWeeklyScheduleDto): Promise<WeeklySchedule> {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'create',
			tenant: tenantId,
			run: async () => {
				const start = hhmmToDbTime(dto.startTime);
				const end = hhmmToDbTime(dto.endTime);

				this.assertValidTimeRange(start, end, tenantId, 'create');

				const effectiveFrom =
					this.parseEffectiveDate(dto.effectiveFrom, tenantId, 'create') ??
					new Date();

				const effectiveTo = this.parseEffectiveDate(
					dto.effectiveTo,
					tenantId,
					'create',
				);

				await this.assertLocationResourceSameTenant(
					tenantId,
					dto.locationId,
					dto.resourceId,
					'create',
				);

				try {
					return await this.prisma.weeklySchedule.create({
						data: {
							tenantId,
							locationId: dto.locationId,
							resourceId: dto.resourceId,
							dayOfWeek: dto.dayOfWeek,
							startTime: start,
							endTime: end,
							effectiveFrom,
							effectiveTo: effectiveTo === undefined ? null : effectiveTo,
						},
					});
				} catch (e: any) {
					if (e?.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'create',
							code: 'WEEKLY_SCHEDULE_DUPLICATE',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'WEEKLY_SCHEDULE_DUPLICATE',
							message: 'Weekly schedule already exists',
						});
					}

					throw e;
				}
			},
		});
	}

	async list(tenantId: string, q: ListWeeklySchedulesQuery) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'list',
			tenant: tenantId,
			run: async () => {
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
			},
		});
	}

	async getById(tenantId: string, id: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'get',
			tenant: tenantId,
			run: async () => {
				const row = await this.prisma.weeklySchedule.findFirst({
					where: { id, tenantId },
				});

				if (!row) {
					this.ownerCrudMetrics.validationError({
						entity: this.metricEntity,
						action: 'get',
						code: 'WEEKLY_SCHEDULE_NOT_FOUND',
						tenant: tenantId,
					});

					throw new NotFoundException({
						code: 'WEEKLY_SCHEDULE_NOT_FOUND',
						message: 'Weekly schedule not found',
					});
				}

				return row;
			},
		});
	}

	async update(tenantId: string, id: string, dto: UpdateWeeklyScheduleDto) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				const existing = await this.getById(tenantId, id);

				const locationId = dto.locationId ?? existing.locationId;
				const resourceId = dto.resourceId ?? existing.resourceId;

				await this.assertLocationResourceSameTenant(
					tenantId,
					locationId,
					resourceId,
					'update',
				);

				const start = dto.startTime
					? hhmmToDbTime(dto.startTime)
					: existing.startTime;

				const end = dto.endTime ? hhmmToDbTime(dto.endTime) : existing.endTime;

				this.assertValidTimeRange(start, end, tenantId, 'update');

				const effectiveFrom =
					dto.effectiveFrom !== undefined
						? (this.parseEffectiveDate(dto.effectiveFrom, tenantId, 'update') ??
							new Date())
						: existing.effectiveFrom;

				const effectiveTo =
					dto.effectiveTo !== undefined
						? this.parseEffectiveDate(dto.effectiveTo, tenantId, 'update')
						: existing.effectiveTo;

				try {
					return await this.prisma.weeklySchedule.update({
						where: { id },
						data: {
							locationId,
							resourceId,
							...(dto.dayOfWeek !== undefined
								? { dayOfWeek: dto.dayOfWeek }
								: {}),
							startTime: start,
							endTime: end,
							effectiveFrom,
							effectiveTo: effectiveTo === undefined ? null : effectiveTo,
						},
					});
				} catch (e: any) {
					if (e?.code === 'P2002') {
						this.ownerCrudMetrics.conflictError({
							entity: this.metricEntity,
							action: 'update',
							code: 'WEEKLY_SCHEDULE_DUPLICATE',
							tenant: tenantId,
						});

						throw new ConflictException({
							code: 'WEEKLY_SCHEDULE_DUPLICATE',
							message: 'Weekly schedule already exists',
						});
					}

					throw e;
				}
			},
		});
	}

	async remove(tenantId: string, id: string) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'delete',
			tenant: tenantId,
			run: async () => {
				await this.getById(tenantId, id);
				await this.prisma.weeklySchedule.delete({ where: { id } });
				return { ok: true };
			},
		});
	}
}