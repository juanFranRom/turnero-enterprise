import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantCtx } from '../../../types/express';

export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantCtx | null => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenant ?? null;
  },
);