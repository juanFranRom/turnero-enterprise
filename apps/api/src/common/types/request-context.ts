export type TenantCtx = { id: string; slug?: string };
export type CurrentUserCtx = { userId: string; tenantId: string; role?: string };