import { readNetworkProfile } from './network';
import { PriorityLoader, type LoadTask } from './priority-loader';
import { scoreCandidate, DEFAULT_SCORE_WEIGHTS } from './scoring';
import { SessionLearning } from './session-learning';
import type {
  DealerPredictionSummary, LoadPriority, LoadStage, NetworkProfile, PredictiveActionEvent,
  PredictiveCandidate, ResourceKey, ResourceScope, ScoreResult, ScoreWeights,
} from './types';
import { subscribeResourceInvalidation, type ResourceInvalidation } from './invalidation';

export interface PredictiveEventSink {
  record(event: PredictiveActionEvent, signal?: AbortSignal): Promise<void>;
  summaries(signal?: AbortSignal): Promise<readonly DealerPredictionSummary[]>;
}

interface PredictiveDebugApi {
  summary(): Readonly<Record<string, number>>;
  events(): ReturnType<PriorityLoader['instrumentation']['events']>;
  cache(): { entries: number; bytes: number };
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function dealerScope(userId: string): ResourceScope {
  return { id: `dealer:${userId}`, visibility: 'authenticated' };
}

export function sessionScope(sessionId = randomId()): ResourceScope {
  return { id: `session:${sessionId}`, visibility: 'session' };
}

/** The raw public token is deliberately never used as a cache key. */
export function publicTokenScope(token: string): ResourceScope {
  return { id: `public:${fingerprint(token)}`, visibility: 'public-token' };
}

export class PredictiveRuntime {
  readonly sessionId = randomId();
  readonly learning: SessionLearning;
  readonly loader: PriorityLoader;
  private summaries: readonly DealerPredictionSummary[] = [];
  private previous: { type: string; id: string } | null = null;
  private readonly unsubscribeInvalidation: () => void;
  private readonly telemetryControllers = new Set<AbortController>();
  private readonly telemetryTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly debugApi?: PredictiveDebugApi;

  constructor(
    readonly scope: ResourceScope,
    private readonly sink?: PredictiveEventSink,
    private readonly profile: () => NetworkProfile = readNetworkProfile,
    private readonly weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  ) {
    const network = profile();
    const lowMemory = (network.deviceMemoryGb ?? 8) <= 2;
    this.learning = new SessionLearning(scope.id, this.sessionId);
    const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('loader-debug');
    this.loader = new PriorityLoader(profile, {
      maxEntries: lowMemory ? 20 : 48,
      maxBytes: lowMemory ? 24 * 1024 * 1024 : 64 * 1024 * 1024,
      debug,
    });
    if (debug) {
      this.debugApi = {
        summary: () => this.loader.instrumentation.summary(),
        events: () => this.loader.instrumentation.events(),
        cache: () => ({ entries: this.loader.cacheSize, bytes: this.loader.cacheBytes }),
      };
      (globalThis as typeof globalThis & { __MAPCO_LOADER_DEBUG__?: PredictiveDebugApi }).__MAPCO_LOADER_DEBUG__ = this.debugApi;
    }
    this.unsubscribeInvalidation = subscribeResourceInvalidation((event) => this.handleInvalidation(event));
  }

  async loadHistory(signal?: AbortSignal): Promise<void> {
    if (!this.sink || this.scope.visibility !== 'authenticated') return;
    try { this.summaries = await this.sink.summaries(signal); } catch { this.summaries = []; }
  }

  request<T>(task: Omit<LoadTask<T>, 'key'> & { key: Omit<ResourceKey, 'scope'> }): Promise<T> {
    return this.loader.schedule({ ...task, key: { ...task.key, scope: this.scope } });
  }

  prepareValue<T>(
    key: Omit<ResourceKey, 'scope'>,
    value: T,
    options: { priority?: LoadPriority; reason: string; costBytes?: number; expiresAt?: number },
  ): Promise<T> {
    return this.request({
      key, priority: options.priority ?? 'P1', stage: 'prepare',
      cost: { bytes: options.costBytes ?? 0, parse: 0 }, reason: options.reason,
      cache: { costBytes: options.costBytes ?? 0, expiresAt: options.expiresAt },
      run: async () => value,
    });
  }

  score(candidate: Omit<PredictiveCandidate, 'key'> & { key: Omit<ResourceKey, 'scope'> }): ScoreResult {
    return scoreCandidate({ ...candidate, key: { ...candidate.key, scope: this.scope } }, this.profile(), this.weights);
  }

  scheduleCandidate<T>(
    candidate: Omit<PredictiveCandidate, 'key'> & { key: Omit<ResourceKey, 'scope'> },
    run: (signal: AbortSignal, stage: LoadStage) => Promise<T>,
    options: { cache?: LoadTask<T>['cache']; group?: string; contextVersion?: number } = {},
  ): { decision: ScoreResult; promise?: Promise<T> } {
    const full = { ...candidate, key: { ...candidate.key, scope: this.scope } };
    const decision = scoreCandidate(full, this.profile(), this.weights);
    if (decision.priority === 'skip') return { decision };
    return {
      decision,
      promise: this.loader.schedule({
        key: full.key, priority: decision.priority, stage: decision.stage, cost: candidate.cost,
        reason: `${candidate.reason}; ${decision.explanation.join(', ')}`,
        cache: options.cache, group: options.group, contextVersion: options.contextVersion,
        run: (signal) => run(signal, decision.stage),
      }),
    };
  }

  recordAction(
    eventType: PredictiveActionEvent['eventType'],
    target: { type: string; id: string },
    resource?: { type: PredictiveActionEvent['resourceType']; id: string },
  ): void {
    const from = this.previous;
    if (from) this.learning.record(from.type, from.id, target.type, target.id);
    this.previous = target;
    if (!this.sink || this.scope.visibility !== 'authenticated') return;
    const event: PredictiveActionEvent = {
      sessionId: this.sessionId, eventType,
      ...(from ? { fromType: from.type, fromId: from.id } : {}),
      toType: target.type, toId: target.id,
      ...(resource ? { resourceType: resource.type, resourceId: resource.id } : {}),
      at: new Date().toISOString(),
    };
    this.deferTelemetry((signal) => this.sink!.record(event, signal));
  }

  historySignals(fromType: string, fromId: string, toType: string, toId: string): { sessionTransition: number; dealerRecent: number; dealerHistory: number } {
    const dealer = SessionLearning.dealerScores(this.summaries, fromType, fromId, toType, toId);
    return {
      sessionTransition: this.learning.transitionScore(fromType, fromId, toType, toId),
      dealerRecent: dealer.recent,
      dealerHistory: dealer.history,
    };
  }

  invalidate(type: ResourceKey['type'], id: string): number {
    const typePart = encodeURIComponent(type), idPart = encodeURIComponent(id);
    return this.loader.invalidate((key) => key.includes(`|${typePart}|${idPart}|`));
  }

  dispose(): void {
    this.unsubscribeInvalidation();
    for (const timer of this.telemetryTimers) clearTimeout(timer);
    this.telemetryTimers.clear();
    for (const controller of this.telemetryControllers) controller.abort();
    this.telemetryControllers.clear();
    this.loader.dispose();
    const host = globalThis as typeof globalThis & { __MAPCO_LOADER_DEBUG__?: PredictiveDebugApi };
    if (host.__MAPCO_LOADER_DEBUG__ === this.debugApi) delete host.__MAPCO_LOADER_DEBUG__;
  }

  private deferTelemetry(send: (signal: AbortSignal) => Promise<void>): void {
    const controller = new AbortController();
    this.telemetryControllers.add(controller);
    const attempt = () => {
      if (controller.signal.aborted) return;
      if (this.loader.pendingImmediate) {
        const retry = setTimeout(() => {
          this.telemetryTimers.delete(retry);
          attempt();
        }, 250);
        this.telemetryTimers.add(retry);
        return;
      }
      void send(controller.signal).catch(() => undefined).finally(() => this.telemetryControllers.delete(controller));
    };
    const timer = setTimeout(() => {
      this.telemetryTimers.delete(timer);
      attempt();
    }, 750);
    this.telemetryTimers.add(timer);
  }

  private handleInvalidation(event: ResourceInvalidation): void {
    if (event.entity === 'dealer-session') { this.loader.clearScope(this.scope.id); return; }
    if (event.entity === 'property' || event.entity === 'inventory') {
      for (const type of ['property-summary', 'property-thumbnail', 'property-media', 'map-placement'] as const) this.invalidate(type, event.id);
      this.invalidate('bootstrap', 'visible-property-summaries');
      return;
    }
    if (event.entity === 'map') {
      if (event.id === '*') {
        this.loader.invalidate((key) => this.matchesType(key, ['map-metadata', 'map-raster', 'map-svg', 'map-overlay']));
      } else {
        for (const type of ['map-metadata', 'map-raster', 'map-svg', 'map-overlay'] as const) this.invalidate(type, event.id);
      }
      this.invalidate('bootstrap', 'published-map-registry');
      return;
    }
    if (event.entity === 'client') {
      this.loader.invalidate((key) => this.matchesType(key, ['client-link-preview']));
      return;
    }
    if (event.entity === 'client-link') {
      this.invalidate('client-link-preview', event.id);
      this.invalidate('client-link-preview', 'new');
      this.loader.invalidate((key) => {
        const parts = this.keyParts(key);
        return parts?.[2] === 'client-link-preview' && parts[3]?.startsWith('selection:');
      });
    }
  }

  private keyParts(key: string): string[] | null {
    try { return key.split('|').map((part) => decodeURIComponent(part)); } catch { return null; }
  }

  private matchesType(key: string, types: readonly ResourceKey['type'][]): boolean {
    const parts = this.keyParts(key);
    return types.includes(parts?.[2] as ResourceKey['type']);
  }
}
