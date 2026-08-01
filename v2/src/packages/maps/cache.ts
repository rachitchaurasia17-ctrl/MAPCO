/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Bounded LRU cache
   Documented maximum; no permanent global cache for every map/photo.
   Evicted entries are disposed (image refs / object URLs released).
   ═══════════════════════════════════════════════════════════════ */

export class BoundedCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    /** documented hard maximum number of retained entries. */
    readonly max: number,
    /** called when an entry is evicted or the cache is cleared. */
    private readonly onEvict?: (value: V, key: K) => void,
  ) {
    if (max < 1) throw new Error('BoundedCache max must be >= 1');
  }

  get size(): number { return this.map.size; }

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      // refresh recency
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  has(key: K): boolean { return this.map.has(key); }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as K;
      const evicted = this.map.get(oldest)!;
      this.map.delete(oldest);
      this.onEvict?.(evicted, oldest);
    }
  }

  clear(): void {
    for (const [k, v] of this.map) this.onEvict?.(v, k);
    this.map.clear();
  }
}
