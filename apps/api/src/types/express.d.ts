import type { AuthUser } from '../modules/auth/types/auth-user.type';
import type { AuthenticatedRequestMembership } from '../modules/auth/types/authenticated-request-membership.type';

export type TenantCtx = {
	id: string;
	slug: string;
	name: string;
	planId: string;
};

export type LogContext = {
	correlationId: string | null;
	tenantId: string | null;
	tenantSlug: string | null;
	userId: string | null;
	role: string | null;
	sid: string | null;
};

declare global {
	namespace Express {
		interface Request {
			auth?: AuthUser;
			membership?: AuthenticatedRequestMembership;
			tenant?: TenantCtx | null;
			tenantSlug?: string;
			correlationId?: string;
			logContext?: LogContext;
		}
	}
}

export {};