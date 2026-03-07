import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class TenantsService {
	constructor(private readonly prisma: PrismaService) {}

	async findBySlug(slug: string) {
		const tenant = await this.prisma.tenant.findUnique({
			where: { slug },
		});

		if (!tenant) {
			throw new NotFoundException({
				code: 'TENANT_NOT_FOUND',
				message: 'Tenant not found',
			});
		}

		return tenant;
	}
}