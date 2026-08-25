/**
 * Small per-action concurrency boundary for mutation controls.
 *
 * Different record keys may proceed independently; repeated clicks for the
 * same key are ignored until the original request settles, including errors.
 */
export class SingleFlight {
  private readonly active = new Set<string>();

  isActive(key: string): boolean {
    return this.active.has(key);
  }

  async run<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<{ started: boolean; value?: T }> {
    if (this.active.has(key)) return { started: false };
    this.active.add(key);
    try {
      return { started: true, value: await operation() };
    } finally {
      this.active.delete(key);
    }
  }
}

