import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AvailabilityReadPort } from '../../../domain/appointments/availability-read.port';

export class PrismaAvailabilityReadAdapter implements AvailabilityReadPort {
	constructor(private readonly prisma: PrismaService) {}

	async getLocationTZ({ tenantId, locationId }: any) {
		const loc = await this.prisma.location.findFirst({
			where: { tenantId, id: locationId, isActive: true },
			select: { timeZone: true },
		});

		if (!loc) {
			throw new NotFoundException({
                code: 'LOCATION_NOT_FOUND',
                message: 'Location not found',
			});
		}

		return loc.timeZone;
	}

	async getServiceCfg({ tenantId, locationId, serviceId }: any) {
		const s = await this.prisma.service.findFirst({
			where: { tenantId, locationId, id: serviceId, isActive: true },
			select: {
				durationMinutes: true,
				bufferBeforeMinutes: true,
				bufferAfterMinutes: true,
			},
		});

		if (!s) {
			throw new NotFoundException({
                code: 'SERVICE_NOT_FOUND',
                message: 'Service not found',
			});
		}

		return s;
	}

	async assertResourceServiceAllowed({ tenantId, resourceId, serviceId }: any) {
		const link = await this.prisma.resourceService.findFirst({
			where: { tenantId, resourceId, serviceId },
			select: { id: true },
		});

		if (!link) {
			throw new ForbiddenException({
                code: 'SERVICE_NOT_ALLOWED_FOR_RESOURCE',
                message: 'Service is not allowed for this resource',
			});
		}
	}

	async getWeekly({ tenantId, locationId, resourceId, dayOfWeek, from, to }: any) {
		return this.prisma.weeklySchedule.findMany({
			where: {
				tenantId,
				locationId,
				resourceId,
				dayOfWeek,
				effectiveFrom: { lte: to },
				OR: [
					{ effectiveTo: null },
					{ effectiveTo: { gte: from } },
				],
			},
			select: {
				dayOfWeek: true,
				startTime: true,
				endTime: true,
			},
			orderBy: [{ startTime: 'asc' }],
		});
	}

	async getOverrides({ tenantId, locationId, resourceId, from, to }: any) {
		return this.prisma.availabilityOverride.findMany({
			where: {
				tenantId,
				locationId,
				resourceId,
				startsAt: { lt: to },
				endsAt: { gt: from },
			},
			select: {
				kind: true,
				startsAt: true,
				endsAt: true,
			},
		}) as any;
	}

	async getBusy({
		tenantId,
		locationId,
		resourceId,
		from,
		to,
		excludeAppointmentId,
	}: any) {
		return this.prisma.appointment.findMany({
			where: {
				tenantId,
				locationId,
				resourceId,
				status: { in: ['BOOKED', 'CONFIRMED'] },
				startsAt: { lt: to },
				endsAt: { gt: from },
				...(excludeAppointmentId
					? { NOT: { id: excludeAppointmentId } }
					: {}),
			},
			select: {
				startsAt: true,
				endsAt: true,
			},
		});
	}
}