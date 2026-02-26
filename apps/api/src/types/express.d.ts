import type { AuthUser } from '../auth/types/auth-user.type';

export type TenantCtx = {
  id: string;
  slug: string;
  name: string;
  planId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenant?: TenantCtx | null;
      tenantSlug?: string;
    }
  }
}

export {};
