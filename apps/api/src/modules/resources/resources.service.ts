import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, ResourceKind, Role, type Resource } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateResourceDto } from './dtos/create-resource.dto';
import { UpdateResourceDto } from './dtos/update-resource.dto';
import { ListResourcesQuery } from './dtos/list-resources.query';
import { GenerateResourceUserDto } from './dtos/generate-resource-user.dto';
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
	search?: string;
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

	private toAuditSnapshot(
		resource: Resource & {
			person?: {
				id: string;
				firstName: string;
				lastName: string;
				documentNumber: string;
				email: string;
				phone: string | null;
				isActive: boolean;
				user?: {
					id: string;
					email: string;
					isActive: boolean;
					mustChangePassword: boolean;
				} | null;
			} | null;
		},
	) {
		return {
			id: resource.id,
			tenantId: resource.tenantId,
			locationId: resource.locationId,
			personId: resource.personId,
			name: resource.name,
			description: resource.description,
			kind: resource.kind,
			isActive: resource.isActive,
			createdAt: resource.createdAt.toISOString(),
			updatedAt: resource.updatedAt.toISOString(),
			person: resource.person
				? {
					id: resource.person.id,
					firstName: resource.person.firstName,
					lastName: resource.person.lastName,
					documentNumber: resource.person.documentNumber,
					email: resource.person.email,
					phone: resource.person.phone,
					isActive: resource.person.isActive,
					user: resource.person.user
						? {
							id: resource.person.user.id,
							email: resource.person.user.email,
							isActive: resource.person.user.isActive,
							mustChangePassword:
								resource.person.user.mustChangePassword,
						}
						: null,
				}
				: null,
		};
	}

	private sanitizeSearch(value?: string) {
		const trimmed = value?.trim();
		return trimmed ? trimmed : undefined;
	}

	private generateTemporaryPassword() {
		return `Tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now()
			.toString()
			.slice(-4)}`;
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

	private async getByIdOrThrowTx(
		tx: Prisma.TransactionClient,
		tenantId: string,
		id: string,
	) {
		const resource = await tx.resource.findFirst({
			where: { id, tenantId },
			include: {
				person: {
					include: {
						user: {
							select: {
								id: true,
								email: true,
								isActive: true,
								mustChangePassword: true,
							},
						},
					},
				},
			},
		});

		if (!resource) {
			throw new NotFoundException({
				code: 'RESOURCE_NOT_FOUND',
				message: 'Resource not found',
			});
		}

		return resource;
	}

	private async getByIdOrThrow(
		tenantId: string,
		id: string,
	) {
		const resource = await this.prisma.resource.findFirst({
			where: { id, tenantId },
			include: {
				person: {
					include: {
						user: {
							select: {
								id: true,
								email: true,
								isActive: true,
								mustChangePassword: true,
							},
						},
					},
				},
			},
		});

		if (!resource) {
			throw new NotFoundException({
				code: 'RESOURCE_NOT_FOUND',
				message: 'Resource not found',
			});
		}

		return resource;
	}

	private assertCreatePayloadRules(dto: CreateResourceDto) {
		if (dto.kind === ResourceKind.PERSON) {
			if (!dto.person) {
				throw new ConflictException({
					code: 'PERSON_RESOURCE_PERSON_REQUIRED',
					message:
						'Person payload is required for PERSON resources',
				});
			}

			return;
		}

		if (dto.person) {
			throw new ConflictException({
				code: 'RESOURCE_PERSON_PAYLOAD_NOT_ALLOWED',
				message:
					'Person payload is only allowed for PERSON resources',
			});
		}

		if (dto.user) {
			throw new ConflictException({
				code: 'RESOURCE_USER_PAYLOAD_NOT_ALLOWED',
				message:
					'User payload is only allowed for PERSON resources',
			});
		}
	}

	private async createUserForPersonTx(
		tx: Prisma.TransactionClient,
		args: {
			tenantId: string;
			personId: string;
			email: string;
			role: Role;
			temporaryPassword?: string;
		},
	) {
		const temporaryPassword =
			args.temporaryPassword ?? this.generateTemporaryPassword();

		const passwordHash = await argon2.hash(temporaryPassword);

		const createdUser = await tx.user.create({
			data: {
				email: args.email.trim().toLowerCase(),
				passwordHash,
				personId: args.personId,
				mustChangePassword: true,
			},
		});

		await tx.membership.create({
			data: {
				userId: createdUser.id,
				tenantId: args.tenantId,
				role: args.role,
			},
		});

		return {
			user: createdUser,
			temporaryPassword,
		};
	}

	private async syncUserEmailFromPersonTx(
		tx: Prisma.TransactionClient,
		args: {
			personId: string;
			email: string;
		},
	) {
		const normalizedEmail = args.email.trim().toLowerCase();

		const person = await tx.person.findUnique({
			where: {
				id: args.personId,
			},
			include: {
				user: {
					select: {
						id: true,
						email: true,
					},
				},
			},
		});

		if (!person?.user) {
			return;
		}

		if (person.user.email === normalizedEmail) {
			return;
		}

		await tx.user.update({
			where: {
				id: person.user.id,
			},
			data: {
				email: normalizedEmail,
			},
		});
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
				this.assertCreatePayloadRules(dto);

				try {
					return await this.prisma.$transaction(async (tx) => {
						await this.findLocationOrThrowTx(tx, tenantId, dto.locationId);

						if (dto.kind !== ResourceKind.PERSON) {
							const created = await tx.resource.create({
								data: {
									tenantId,
									locationId: dto.locationId,
									name: dto.name.trim(),
									description: dto.description?.trim() || null,
									kind: dto.kind,
								},
								include: {
									person: {
										include: {
											user: {
												select: {
													id: true,
													email: true,
													isActive: true,
													mustChangePassword: true,
												},
											},
										},
									},
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

							return {
								resource: created,
								person: null,
								user: null,
							};
						}

						const createdPerson = await tx.person.create({
							data: {
								tenantId,
								firstName: dto.person!.firstName.trim(),
								lastName: dto.person!.lastName.trim(),
								documentNumber: dto.person!.documentNumber.trim(),
								email: dto.person!.email.trim().toLowerCase(),
								phone: dto.person!.phone?.trim() || null,
							},
						});

						let createdUserResult:
							| {
								user: {
									id: string;
									email: string;
									mustChangePassword: boolean;
								};
								temporaryPassword: string;
								role: Role;
							}
							| null = null;

						if (dto.user?.create === true) {
							const role = dto.user.role ?? Role.STAFF;

							const generated = await this.createUserForPersonTx(tx, {
								tenantId,
								personId: createdPerson.id,
								email: createdPerson.email,
								role,
								temporaryPassword: dto.user.temporaryPassword,
							});

							createdUserResult = {
								user: {
									id: generated.user.id,
									email: generated.user.email,
									mustChangePassword: generated.user.mustChangePassword,
								},
								temporaryPassword: generated.temporaryPassword,
								role,
							};
						}

						const created = await tx.resource.create({
							data: {
								tenantId,
								locationId: dto.locationId,
								personId: createdPerson.id,
								name: dto.name.trim(),
								description: dto.description?.trim() || null,
								kind: ResourceKind.PERSON,
							},
							include: {
								person: {
									include: {
										user: {
											select: {
												id: true,
												email: true,
												isActive: true,
												mustChangePassword: true,
											},
										},
									},
								},
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

						return {
							resource: created,
							person: created.person,
							user: createdUserResult
								? {
									id: createdUserResult.user.id,
									email: createdUserResult.user.email,
									role: createdUserResult.role,
									mustChangePassword: createdUserResult.user.mustChangePassword,
									temporaryPassword: createdUserResult.temporaryPassword,
								}
								: null,
						};
					});
				} catch (e: any) {
					if (e.code === 'P2002') {
						const target = Array.isArray(e.meta?.target)
							? e.meta.target.join(',')
							: '';

						if (target.includes('tenantId,locationId,name')) {
							throw new ConflictException({
								code: 'RESOURCE_NAME_TAKEN',
								message: 'Resource name already exists',
							});
						}

						if (target.includes('tenantId,documentNumber')) {
							throw new ConflictException({
								code: 'PERSON_DOCUMENT_TAKEN',
								message: 'Person document already exists',
							});
						}

						if (target.includes('tenantId,email')) {
							throw new ConflictException({
								code: 'PERSON_EMAIL_TAKEN',
								message: 'Person email already exists',
							});
						}

						if (target === 'email' || target.includes('email')) {
							throw new ConflictException({
								code: 'USER_EMAIL_TAKEN',
								message: 'User email already exists',
							});
						}
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
				const search = this.sanitizeSearch(q.search);

				const whereBase: Prisma.ResourceWhereInput = {
					tenantId,
					...(q.locationId ? { locationId: q.locationId } : {}),
					...(q.kind ? { kind: q.kind } : {}),
					...(q.isActive === undefined ? {} : { isActive: q.isActive }),
					...(search
						? {
							OR: [
								{
									name: {
										contains: search,
										mode: 'insensitive',
									},
								},
								{
									description: {
										contains: search,
										mode: 'insensitive',
									},
								},
								{
									person: {
										firstName: {
											contains: search,
											mode: 'insensitive',
										},
									},
								},
								{
									person: {
										lastName: {
											contains: search,
											mode: 'insensitive',
										},
									},
								},
								{
									person: {
										email: {
											contains: search,
											mode: 'insensitive',
										},
									},
								},
								{
									person: {
										documentNumber: {
											contains: search,
											mode: 'insensitive',
										},
									},
								},
							],
						}
						: {}),
				};

				const result = await listWithCreatedAtCursor<
					Prisma.ResourceGetPayload<{
						include: {
							person: {
								include: {
									user: {
										select: {
											id: true;
											email: true;
											isActive: true;
											mustChangePassword: true;
										};
									};
								};
							};
						};
					}>,
					ResourcesCursorScope
				>({
					tenantId,
					query: q,
					scope: {
						feed: 'resources',
						locationId: q.locationId ?? undefined,
						kind: q.kind ?? undefined,
						isActive: q.isActive ?? undefined,
						search,
						direction: q.direction ?? 'desc',
					},
					whereBase,
					delegate: {
						findMany: (args) =>
							this.prisma.resource.findMany({
								...(args as Prisma.ResourceFindManyArgs),
								include: {
									person: {
										include: {
											user: {
												select: {
													id: true,
													email: true,
													isActive: true,
													mustChangePassword: true,
												},
											},
										},
									},
								},
							}),
					},
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
								...(dto.description !== undefined
									? { description: dto.description.trim() || null }
									: {}),
								...(dto.isActive !== undefined
									? { isActive: dto.isActive }
									: {}),
							},
							include: {
								person: {
									include: {
										user: {
											select: {
												id: true,
												email: true,
												isActive: true,
												mustChangePassword: true,
											},
										},
									},
								},
							},
						});

						if (dto.person) {
							if (existing.kind !== ResourceKind.PERSON || !existing.personId) {
								throw new ConflictException({
									code: 'RESOURCE_PERSON_PAYLOAD_NOT_ALLOWED',
									message:
										'Person payload is only allowed for PERSON resources',
								});
							}

							const normalizedPersonEmail =
								dto.person.email !== undefined
									? dto.person.email.trim().toLowerCase()
									: undefined;

							const updatedPerson = await tx.person.update({
								where: { id: existing.personId },
								data: {
									...(dto.person.firstName !== undefined
										? { firstName: dto.person.firstName.trim() }
										: {}),
									...(dto.person.lastName !== undefined
										? { lastName: dto.person.lastName.trim() }
										: {}),
									...(dto.person.documentNumber !== undefined
										? {
											documentNumber: dto.person.documentNumber.trim(),
										}
										: {}),
									...(normalizedPersonEmail !== undefined
										? {
											email: normalizedPersonEmail,
										}
										: {}),
									...(dto.person.phone !== undefined
										? {
											phone: dto.person.phone.trim() || null,
										}
										: {}),
									...(dto.person.isActive !== undefined
										? { isActive: dto.person.isActive }
										: {}),
								},
								include: {
									user: {
										select: {
											id: true,
											email: true,
										},
									},
								},
							});

							if (normalizedPersonEmail !== undefined) {
								await this.syncUserEmailFromPersonTx(tx, {
									personId: existing.personId,
									email: normalizedPersonEmail,
								});
							}
						}

						const reloaded = await this.getByIdOrThrowTx(tx, tenantId, id);

						await this.auditLog.record(
							tx,
							{ type: 'USER', userId: actorUserId },
							{
								tenantId,
								entity: 'RESOURCE',
								entityId: reloaded.id,
								action: 'UPDATE',
								before: this.toAuditSnapshot(existing),
								after: this.toAuditSnapshot(reloaded),
							},
						);

						return reloaded;
					});
				} catch (e: any) {
					if (e.code === 'P2002') {
						const target = Array.isArray(e.meta?.target)
							? e.meta.target.join(',')
							: '';

						if (target.includes('tenantId,locationId,name')) {
							throw new ConflictException({
								code: 'RESOURCE_NAME_TAKEN',
								message: 'Resource name already exists',
							});
						}

						if (target.includes('tenantId,documentNumber')) {
							throw new ConflictException({
								code: 'PERSON_DOCUMENT_TAKEN',
								message: 'Person document already exists',
							});
						}

						if (target.includes('tenantId,email')) {
							throw new ConflictException({
								code: 'PERSON_EMAIL_TAKEN',
								message: 'Person email already exists',
							});
						}

						if (target === 'email' || target.includes('email')) {
							throw new ConflictException({
								code: 'USER_EMAIL_TAKEN',
								message: 'User email already exists',
							});
						}
					}

					throw e;
				}
			},
		});
	}

	async generateUser(
		tenantId: string,
		actorUserId: string,
		id: string,
		dto: GenerateResourceUserDto,
	) {
		return this.ownerCrudMetrics.track({
			entity: this.metricEntity,
			action: 'update',
			tenant: tenantId,
			run: async () => {
				return this.prisma.$transaction(async (tx) => {
					const existing = await this.getByIdOrThrowTx(tx, tenantId, id);

					if (existing.kind !== ResourceKind.PERSON || !existing.personId) {
						throw new ConflictException({
							code: 'RESOURCE_GENERATE_USER_ONLY_FOR_PERSON',
							message:
								'User generation is only available for PERSON resources',
						});
					}

					const person = await tx.person.findFirst({
						where: {
							id: existing.personId,
							tenantId,
						},
						include: {
							user: true,
						},
					});

					if (!person) {
						throw new NotFoundException({
							code: 'RESOURCE_PERSON_NOT_FOUND',
							message: 'Person not found',
						});
					}

					if (person.user) {
						throw new ConflictException({
							code: 'RESOURCE_PERSON_USER_ALREADY_EXISTS',
							message: 'Person already has a user',
						});
					}

					const role = dto.role ?? Role.STAFF;

					const generated = await this.createUserForPersonTx(tx, {
						tenantId,
						personId: person.id,
						email: person.email,
						role,
						temporaryPassword: dto.temporaryPassword,
					});

					const reloaded = await this.getByIdOrThrowTx(tx, tenantId, id);

					await this.auditLog.record(
						tx,
						{ type: 'USER', userId: actorUserId },
						{
							tenantId,
							entity: 'RESOURCE',
							entityId: reloaded.id,
							action: 'UPDATE',
							before: this.toAuditSnapshot(existing),
							after: this.toAuditSnapshot(reloaded),
							metadata: {
								mode: 'generate-user',
								generatedUserId: generated.user.id,
								role,
							},
						},
					);

					return {
						resource: reloaded,
						user: {
							id: generated.user.id,
							email: generated.user.email,
							role,
							mustChangePassword: generated.user.mustChangePassword,
							temporaryPassword: generated.temporaryPassword,
						},
					};
				});
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
						include: {
							person: {
								include: {
									user: {
										select: {
											id: true,
											email: true,
											isActive: true,
											mustChangePassword: true,
										},
									},
								},
							},
						},
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