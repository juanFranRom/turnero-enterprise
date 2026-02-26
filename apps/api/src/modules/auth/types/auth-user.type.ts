export type AuthUser = {
  userId: string;
  tenantId: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  sid: string;
};