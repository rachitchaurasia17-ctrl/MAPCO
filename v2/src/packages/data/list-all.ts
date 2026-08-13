import { err, ok, type Page, type PageParams, type QueryOptions, type Result } from './contracts';

type PageReader<T> = (params: PageParams, opts?: QueryOptions) => Promise<Result<Page<T>>>;

/**
 * Follow an adapter's opaque cursors without guessing its page-size behavior.
 * IDs are de-duplicated defensively because legacy offset-backed repositories
 * may be upgraded independently from the caller.
 */
export async function listAllRecords<T extends { id: string }>(
  readPage: PageReader<T>,
  opts?: QueryOptions,
): Promise<Result<T[]>> {
  const records = new Map<string, T>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) return err('unknown', 'The data source returned a repeated page cursor.');
      seenCursors.add(cursor);
    }
    const result = await readPage({ ...(cursor ? { cursor } : {}), limit: 50 }, opts);
    if (!result.ok) return result;
    for (const item of result.value.items) records.set(item.id, item);
    cursor = result.value.nextCursor ?? undefined;
  } while (cursor);

  return ok([...records.values()]);
}
