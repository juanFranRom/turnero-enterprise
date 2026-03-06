import { keysetAscCreatedAtId, keysetDescCreatedAtId } from './keyset';

describe('keyset builders', () => {
  it('ASC builder uses gt and tie-breaker id gt', () => {
    const where = keysetAscCreatedAtId(new Date('2026-02-23T12:00:00.000Z'), 'id1') as any;

    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toEqual({ createdAt: { gt: new Date('2026-02-23T12:00:00.000Z') } });
    expect(where.OR[1].AND).toEqual([
      { createdAt: new Date('2026-02-23T12:00:00.000Z') },
      { id: { gt: 'id1' } },
    ]);
  });

  it('DESC builder uses lt and tie-breaker id lt', () => {
    const where = keysetDescCreatedAtId(new Date('2026-02-23T12:00:00.000Z'), 'id1') as any;

    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toEqual({ createdAt: { lt: new Date('2026-02-23T12:00:00.000Z') } });
    expect(where.OR[1].AND).toEqual([
      { createdAt: new Date('2026-02-23T12:00:00.000Z') },
      { id: { lt: 'id1' } },
    ]);
  });
});