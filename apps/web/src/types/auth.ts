export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF';

export type AuthMembership = {
	tenantId: string;
	tenantSlug: string;
	tenantName: string;
	role: UserRole;
};

export type AuthUser = {
	id: string;
	email: string;
	emailVerified: boolean;
	isActive: boolean;
	createdAt: string;
};

export type AuthContext = {
	user: AuthUser;
	memberships: AuthMembership[];
	activeTenantSlug: string | null;
};

export type LoginInput = {
	email: string;
	password: string;
};

export type LoginResponse = {
	accessToken: string;
	user: AuthUser;
	memberships: AuthMembership[];
	activeTenantSlug: string | null;
};

export type RefreshResponse = {
	accessToken: string;
	user: AuthUser;
	memberships: AuthMembership[];
	activeTenantSlug: string | null;
};