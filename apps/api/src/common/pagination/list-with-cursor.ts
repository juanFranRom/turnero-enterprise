import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './cursor.codec';
import type { CursorBase } from './cursor.types';

type CursorDirection = 'asc' | 'desc';

type FindManyDelegate<TItem> = {
  findMany(args: unknown): Promise<TItem[]>;
};

type QueryWithCursor = {
  limit?: number;
  cursor?: string;
  direction?: CursorDirection;
};

type ListWithCreatedAtCursorArgs<
  TItem,
  TScope extends Record<string, unknown>,
> = {
  tenantId: string;
  query: QueryWithCursor;
  scope: TScope;
  whereBase: Record<string, unknown>;
  delegate: FindManyDelegate<TItem>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  maxLimit?: number;
  getRowCreatedAt?: (row: TItem) => Date;
  getRowId?: (row: TItem) => string;
};

function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);

  if (ak.length !== bk.length) return false;

  for (const key of ak) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * Keyset pagination reusable helper
 * Fixed sortable field: createdAt (+ id tie-breaker)
 * Supports ASC / DESC safely.
 */
export async function listWithCreatedAtCursor<
  TItem,
  TScope extends Record<string, unknown>,
>(
  args: ListWithCreatedAtCursorArgs<TItem, TScope>,
): Promise<{ items: TItem[]; nextCursor: string | null }> {
  const limit = Math.min(args.query.limit ?? 20, args.maxLimit ?? 100);
  const direction: CursorDirection = args.query.direction ?? 'desc';

  const getRowCreatedAt =
    args.getRowCreatedAt ?? ((row: any) => row.createdAt as Date);
  const getRowId = args.getRowId ?? ((row: any) => row.id as string);

  let cursorWhere: Record<string, unknown> | undefined;

  if (args.query.cursor) {
    let cursor: CursorBase<TScope>;

    try {
      cursor = decodeCursor<TScope>(args.query.cursor);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }

    if (cursor.tenantId !== args.tenantId) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }

    if (!shallowEqual(cursor.scope, args.scope)) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }

    const createdAt = new Date(cursor.at);

    if (Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Invalid cursor',
      });
    }

    cursorWhere =
      direction === 'desc'
        ? {
            OR: [
              { createdAt: { lt: createdAt } },
              { createdAt, id: { lt: cursor.id } },
            ],
          }
        : {
            OR: [
              { createdAt: { gt: createdAt } },
              { createdAt, id: { gt: cursor.id } },
            ],
          };
  }

  const where = cursorWhere
    ? { AND: [args.whereBase, cursorWhere] }
    : args.whereBase;

  const orderBy =
    direction === 'desc'
      ? [{ createdAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'asc' }, { id: 'asc' }];

  const rows = await args.delegate.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(args.select ? { select: args.select } : {}),
    ...(args.include ? { include: args.include } : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];

  const nextCursor =
    hasMore && last
      ? encodeCursor<TScope>({
          v: 1,
          tenantId: args.tenantId,
          scope: args.scope,
          at: getRowCreatedAt(last).toISOString(),
          id: getRowId(last),
        })
      : null;

  return { items, nextCursor };
}

export function toCursorListResponse<T>(result: {
	items: T[];
	nextCursor: string | null;
}) {
	return {
		data: result.items,
		nextCursor: result.nextCursor,
	};
}