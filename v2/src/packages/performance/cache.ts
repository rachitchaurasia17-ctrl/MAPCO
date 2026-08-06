export interface CacheEntryOptions<V> {
  readonly costBytes?: number;
  readonly expiresAt?: number;
  readonly protected?: boolean;
  readonly dispose?: (value: V) => void;
}

interface Entry<V> extends CacheEntryOptions<V> {
  readonly value: V;
  readonly insertedAt: number;
}

/** A count- and cost-bounded LRU. It never evicts a protected current item. */
export class CostAwareLruCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private bytes = 0;

  constructor(
    readonly maxEntries: number,
    readonly maxBytes: number,
    private readonly onEvict?: (key: string, value: V) => void,
  ) {
    if (maxEntries < 1 || maxBytes < 1) throw new Error('Cache limits must be positive');
  }

  get size(): number { return this.entries.size; }
  get costBytes(): number { return this.bytes; }

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
      this.remove(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  has(key: string, now = Date.now()): boolean { return this.get(key, now) !== undefined; }

  set(key: string, value: V, options: CacheEntryOptions<V> = {}): void {
    this.remove(key);
    const entry: Entry<V> = { value, insertedAt: Date.now(), ...options };
    this.entries.set(key, entry);
    this.bytes += Math.max(0, options.costBytes ?? 0);
    this.trim();
  }

  protect(key: string, protectedValue = true): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.set(key, { ...entry, protected: protectedValue });
  }

  remove(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.bytes -= Math.max(0, entry.costBytes ?? 0);
    try { entry.dispose?.(entry.value); } finally { this.onEvict?.(key, entry.value); }
    return true;
  }

  invalidate(match: (key: string) => boolean): number {
    let removed = 0;
    for (const key of [...this.entries.keys()]) if (match(key) && this.remove(key)) removed++;
    return removed;
  }

  clear(): void {
    for (const key of [...this.entries.keys()]) this.remove(key);
  }

  keys(): string[] { return [...this.entries.keys()]; }

  private trim(): void {
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const candidate = [...this.entries].find(([, entry]) => !entry.protected);
      if (!candidate) break;
      this.remove(candidate[0]);
    }
  }
}
