import type { LoaderEvent } from './types';

export class LoaderInstrumentation {
  private readonly items: LoaderEvent[] = [];
  private readonly counts = new Map<string, number>();

  constructor(readonly capacity = 200, readonly debug = false) {}

  record(event: LoaderEvent): void {
    this.counts.set(event.kind, (this.counts.get(event.kind) ?? 0) + 1);
    if (!this.debug) return;
    this.items.push(event);
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity);
  }

  events(): readonly LoaderEvent[] { return this.items.slice(); }
  summary(): Readonly<Record<string, number>> { return Object.fromEntries(this.counts); }
  clear(): void { this.items.length = 0; this.counts.clear(); }
}
