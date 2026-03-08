import { Role } from '@prisma/client';

export type AuthenticatedRequestMembership = {
	id: string;
	userId: string;
	tenantId: string;
	role: Role;
};