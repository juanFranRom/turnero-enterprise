export type CursorBase<TScope extends Record<string, unknown> = Record<string, unknown>> = {
  v: 1;
  tenantId: string;
  scope: TScope;
  at: string; // ISO createdAt
  id: string; // tie-breaker
};