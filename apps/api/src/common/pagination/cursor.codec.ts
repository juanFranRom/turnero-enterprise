import type { CursorBase } from './cursor.types';

export function encodeCursor<TScope extends Record<string, unknown>>(
  c: CursorBase<TScope>,
): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor<TScope extends Record<string, unknown>>(
  raw: string,
): CursorBase<TScope> {
  const json = Buffer.from(raw, 'base64url').toString('utf8');
  const parsed = JSON.parse(json);

  if (!parsed || parsed.v !== 1) throw new Error('Invalid cursor');
  if (typeof parsed.tenantId !== 'string') throw new Error('Invalid cursor');
  if (typeof parsed.at !== 'string' || typeof parsed.id !== 'string')
    throw new Error('Invalid cursor');
  if (typeof parsed.scope !== 'object' || parsed.scope === null)
    throw new Error('Invalid cursor');

  return parsed as CursorBase<TScope>;
}