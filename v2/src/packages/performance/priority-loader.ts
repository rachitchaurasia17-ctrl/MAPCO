import { CostAwareLruCache, type CacheEntryOptions } from './cache';
import { allowsTask, concurrencyFor } from './network';
import { LoaderInstrumentation } from './instrumentation';
import { resourceKey, type LoadPriority, type LoadStage, type NetworkProfile, type ResourceCost, type ResourceKey } from './types';

const RANK: Record<LoadPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export interface LoadTask<T> {
  readonly key: ResourceKey;
  readonly priority: LoadPriority;
  readonly stage: LoadStage;
  readonly cost: ResourceCost;
  readonly reason: string;
  readonly group?: string;
  readonly contextVersion?: number;
  readonly cache?: CacheEntryOptions<T>;
  readonly run: (signal: AbortSignal) => Promise<T>;
}

interface QueuedTask<T = unknown> extends LoadTask<T> {
  priority: LoadPriority;
  reason: string;
  readonly id: string;
  readonly controller: AbortController;
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
  readonly queuedAt: number;
  readonly wasPredicted: boolean;
  state: 'queued' | 'running';
}

function abortError(message: string): DOMException { return new DOMException(message, 'AbortError'); }

export class PriorityLoader {
  readonly instrumentation: LoaderInstrumentation;
  private readonly cache: CostAwareLruCache<unknown>;
  private readonly tasks = new Map<string, QueuedTask>();
  private readonly contexts = new Map<string, number>();
  private readonly preparedPredictions = new Set<string>();
  private running = 0;
  private disposed = false;
  private idleHandle: number | null = null;

  constructor(
    private readonly profile: () => NetworkProfile,
    options: { maxEntries?: number; maxBytes?: number; debug?: boolean; instrumentation?: LoaderInstrumentation } = {},
  ) {
    this.instrumentation = options.instrumentation ?? new LoaderInstrumentation(200, options.debug ?? false);
    this.cache = new CostAwareLruCache(options.maxEntries ?? 48, options.maxBytes ?? 64 * 1024 * 1024,
      (key) => {
        this.instrumentation.record({ at: Date.now(), kind: 'evicted', key });
        if (this.preparedPredictions.delete(key)) {
          this.instrumentation.record({ at: Date.now(), kind: 'prediction-unused', key });
        }
      });
  }

  get cacheSize(): number { return this.cache.size; }
  get cacheBytes(): number { return this.cache.costBytes; }
  cacheKeys(): readonly string[] { return this.cache.keys(); }
  get pendingImmediate(): boolean { return [...this.tasks.values()].some((task) => task.priority === 'P0' || task.priority === 'P1'); }

  contextVersion(group: string): number { return this.contexts.get(group) ?? 0; }

  beginContext(group: string): number {
    const next = this.contextVersion(group) + 1;
    this.contexts.set(group, next);
    this.cancelWhere((task) => task.group === group, 'context changed');
    return next;
  }

  schedule<T>(input: LoadTask<T>): Promise<T> {
    if (this.disposed) return Promise.reject(abortError('loader disposed'));
    const id = resourceKey(input.key, input.stage);
    const cached = this.cache.get(id) as T | undefined;
    if (cached !== undefined) {
      this.instrumentation.record({ at: Date.now(), kind: 'cache-hit', key: id, priority: input.priority, stage: input.stage, reason: input.reason });
      if ((input.priority === 'P0' || input.priority === 'P1') && this.preparedPredictions.delete(id)) {
        this.instrumentation.record({ at: Date.now(), kind: 'prediction-used', key: id, priority: input.priority, stage: input.stage, reason: input.reason });
      }
      return Promise.resolve(cached);
    }
    this.instrumentation.record({ at: Date.now(), kind: 'cache-miss', key: id, priority: input.priority, stage: input.stage });
    const existing = this.tasks.get(id) as QueuedTask<T> | undefined;
    if (existing) {
      if (RANK[input.priority] < RANK[existing.priority]) this.promote(id, input.priority, input.reason);
      return existing.promise;
    }
    if (!allowsTask(this.profile(), input.priority, input.stage, input.cost)) {
      this.instrumentation.record({ at: Date.now(), kind: 'cancelled', key: id, priority: input.priority, stage: input.stage, reason: 'network/device policy' });
      return Promise.reject(abortError('prediction skipped by network/device policy'));
    }
    if (input.priority === 'P0' || input.priority === 'P1') {
      this.cancelWhere((task) => task.priority === 'P2' || task.priority === 'P3', 'immediate work arrived');
    }
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    const task: QueuedTask<T> = {
      ...input, id, priority: input.priority, reason: input.reason, controller: new AbortController(),
      promise, resolve, reject, queuedAt: Date.now(), wasPredicted: input.priority === 'P2' || input.priority === 'P3', state: 'queued',
    };
    this.tasks.set(id, task as QueuedTask);
    this.instrumentation.record({ at: Date.now(), kind: 'queued', key: id, priority: task.priority, stage: task.stage, bytes: task.cost.bytes, reason: task.reason });
    this.pump();
    return promise;
  }

  promote(idOrKey: string | ResourceKey, priority: LoadPriority, reason: string, stage?: LoadStage): boolean {
    const id = typeof idOrKey === 'string' ? idOrKey : resourceKey(idOrKey, stage);
    const task = this.tasks.get(id);
    if (!task || RANK[priority] >= RANK[task.priority]) return false;
    task.priority = priority; task.reason = reason;
    this.instrumentation.record({ at: Date.now(), kind: 'promoted', key: id, priority, stage: task.stage, reason });
    if (priority === 'P0' || priority === 'P1') this.cancelWhere((other) => other.id !== id && (other.priority === 'P2' || other.priority === 'P3'), 'promoted immediate work');
    this.pump();
    return true;
  }

  demote(id: string, priority: LoadPriority): boolean {
    const task = this.tasks.get(id);
    if (!task || RANK[priority] <= RANK[task.priority] || task.state === 'running') return false;
    task.priority = priority;
    this.instrumentation.record({ at: Date.now(), kind: 'demoted', key: id, priority, stage: task.stage });
    return true;
  }

  cancelWhere(match: (task: Readonly<QueuedTask>) => boolean, reason = 'cancelled'): number {
    let count = 0;
    for (const task of [...this.tasks.values()]) {
      if (!match(task)) continue;
      count++;
      task.controller.abort();
      if (task.state === 'queued') {
        this.tasks.delete(task.id);
        task.reject(abortError(reason));
      }
      this.instrumentation.record({ at: Date.now(), kind: 'cancelled', key: task.id, priority: task.priority, stage: task.stage, reason });
    }
    return count;
  }

  markUsed(key: ResourceKey, stage: LoadStage): void {
    const id = resourceKey(key, stage);
    if (!this.preparedPredictions.delete(id)) return;
    this.instrumentation.record({ at: Date.now(), kind: 'prediction-used', key: id, stage });
  }

  protect(key: ResourceKey, stage: LoadStage, value = true): void { this.cache.protect(resourceKey(key, stage), value); }

  invalidate(match: (key: string) => boolean): number {
    this.cancelWhere((task) => match(task.id), 'invalidated');
    return this.cache.invalidate(match);
  }

  clearScope(scopeId: string): void {
    const encoded = encodeURIComponent(scopeId);
    this.invalidate((key) => key.includes(`|${encoded}|`));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelIdlePump();
    this.cancelWhere(() => true, 'loader disposed');
    this.cache.clear();
  }

  private pump(allowIdleWork = false): void {
    if (this.disposed) return;
    const limit = concurrencyFor(this.profile());
    while (this.running < limit) {
      const task = [...this.tasks.values()].filter((item) => item.state === 'queued')
        .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.queuedAt - b.queuedAt)[0];
      if (!task) break;
      if (task.priority === 'P3' && !allowIdleWork) {
        this.scheduleIdlePump();
        break;
      }
      task.state = 'running'; this.running++;
      const started = Date.now();
      this.instrumentation.record({ at: started, kind: 'started', key: task.id, priority: task.priority, stage: task.stage, reason: task.reason });
      void task.run(task.controller.signal).then((value) => {
        if (task.controller.signal.aborted) throw abortError('cancelled');
        if (task.group && task.contextVersion !== undefined && task.contextVersion !== this.contextVersion(task.group)) {
          this.instrumentation.record({ at: Date.now(), kind: 'stale', key: task.id, priority: task.priority, stage: task.stage });
          throw abortError('stale response');
        }
        const predictedAndUsed = task.wasPredicted && (task.priority === 'P0' || task.priority === 'P1');
        if (task.wasPredicted && !predictedAndUsed) this.preparedPredictions.add(task.id);
        this.cache.set(task.id, value, task.cache as CacheEntryOptions<unknown>);
        if (predictedAndUsed) {
          this.instrumentation.record({ at: Date.now(), kind: 'prediction-used', key: task.id, priority: task.priority, stage: task.stage, reason: task.reason });
        }
        this.instrumentation.record({ at: Date.now(), kind: task.stage === 'prepare' ? 'prepared' : 'downloaded', key: task.id, priority: task.priority, stage: task.stage, durationMs: Date.now() - started, bytes: task.cost.bytes, reason: task.reason });
        // Remove the in-flight identity before resolving consumers. A mutation
        // can synchronously invalidate the freshly cached value from inside an
        // awaiting consumer; that next request must not receive this settled
        // Promise as though it were still in flight.
        this.tasks.delete(task.id);
        task.resolve(value);
      }).catch((error) => {
        if (!task.controller.signal.aborted && (error as { name?: string })?.name !== 'AbortError') {
          this.instrumentation.record({ at: Date.now(), kind: 'failed', key: task.id, priority: task.priority, stage: task.stage, durationMs: Date.now() - started, reason: String((error as Error)?.message ?? error) });
        }
        this.tasks.delete(task.id);
        task.reject(error);
      }).finally(() => {
        this.tasks.delete(task.id); this.running--; this.pump();
      });
    }
  }

  private scheduleIdlePump(): void {
    if (this.idleHandle !== null || this.disposed) return;
    const host = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    if (host.requestIdleCallback) {
      this.idleHandle = host.requestIdleCallback(() => {
        this.idleHandle = null;
        this.pump(true);
      }, { timeout: 2_000 });
      return;
    }
    this.idleHandle = globalThis.setTimeout(() => {
      this.idleHandle = null;
      this.pump(true);
    }, 40) as unknown as number;
  }

  private cancelIdlePump(): void {
    if (this.idleHandle === null) return;
    const host = globalThis as typeof globalThis & { cancelIdleCallback?: (handle: number) => void };
    if (host.cancelIdleCallback) host.cancelIdleCallback(this.idleHandle);
    else globalThis.clearTimeout(this.idleHandle);
    this.idleHandle = null;
  }
}
