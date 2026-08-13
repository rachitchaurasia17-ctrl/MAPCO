import { describe, expect, it } from 'vitest';
import { err, ok, type Page } from '../src/packages/data/contracts';
import { listAllRecords } from '../src/packages/data/list-all';

describe('listAllRecords', () => {
  it('follows opaque cursors and de-duplicates legacy overlap', async () => {
    const pages: Record<string, Page<{ id: string; value: number }>> = {
      first: { items: [{ id: 'a', value: 1 }, { id: 'b', value: 1 }], nextCursor: 'next' },
      next: { items: [{ id: 'b', value: 2 }, { id: 'c', value: 1 }], nextCursor: null },
    };
    const result = await listAllRecords(async ({ cursor }) => ok(pages[cursor || 'first']!));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([
      { id: 'a', value: 1 }, { id: 'b', value: 2 }, { id: 'c', value: 1 },
    ]);
  });

  it('returns repository failures and rejects repeated cursors', async () => {
    const failed = await listAllRecords(async () => err('network', 'offline'));
    expect(failed.ok).toBe(false);

    const repeated = await listAllRecords(async () => ok({ items: [], nextCursor: 'same' }));
    expect(repeated.ok).toBe(false);
  });
});
