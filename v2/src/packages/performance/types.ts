export type LoadPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type LoadStage = 'prepare' | 'download';

export type PredictiveResourceType =
  | 'bootstrap' | 'map-metadata' | 'map-raster' | 'map-svg' | 'map-overlay'
  | 'property-summary' | 'property-thumbnail' | 'property-media' | 'map-placement'
  | 'signed-media' | 'client-link-preview';

export interface ResourceScope {
  /** `dealer:<user-id>`, `session:<id>`, or `public:<token fingerprint>`. */
  readonly id: string;
  readonly visibility: 'authenticated' | 'public-token' | 'session';
}

export interface ResourceKey {
  readonly scope: ResourceScope;
  readonly type: PredictiveResourceType;
  readonly id: string;
  readonly version?: string;
  readonly visibilityVersion?: string;
}

export function resourceKey(key: ResourceKey, stage?: LoadStage): string {
  return [key.scope.visibility, key.scope.id, key.type, key.id, key.version ?? 'current', key.visibilityVersion ?? 'visible', stage ?? 'any']
    .map((part) => encodeURIComponent(part)).join('|');
}

export interface ResourceCost {
  /** Estimated network bytes. Zero means metadata/local preparation. */
  readonly bytes: number;
  /** Relative main-thread parse/decode cost from 0..1. */
  readonly parse: number;
  readonly heavy?: boolean;
}

export interface NetworkProfile {
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  readonly saveData: boolean;
  readonly deviceMemoryGb?: number;
  readonly visible: boolean;
  readonly idle: boolean;
  readonly online: boolean;
}

export interface CandidateSignals {
  /** Explicit dealer intent. 1 means a direct click/tap/select. */
  readonly directAction?: number;
  readonly context?: number;
  readonly relationship?: number;
  readonly sessionTransition?: number;
  readonly dealerRecent?: number;
  readonly dealerHistory?: number;
  readonly recentInteraction?: number;
  readonly probability?: number;
}

export interface PredictiveCandidate {
  readonly key: ResourceKey;
  readonly signals: CandidateSignals;
  readonly cost: ResourceCost;
  readonly preferredStage: LoadStage;
  readonly isThreeD?: boolean;
  readonly reason: string;
}

export interface ScoreWeights {
  readonly directAction: number;
  readonly context: number;
  readonly relationship: number;
  readonly sessionTransition: number;
  readonly dealerRecent: number;
  readonly dealerHistory: number;
  readonly recentInteraction: number;
  readonly probability: number;
  readonly byteCost: number;
  readonly parseCost: number;
  readonly constrainedNetwork: number;
}

export interface ScoreResult {
  readonly score: number;
  readonly priority: LoadPriority | 'skip';
  readonly stage: LoadStage;
  readonly explanation: readonly string[];
}

export type LoaderEventKind =
  | 'queued' | 'started' | 'prepared' | 'downloaded' | 'cache-hit' | 'cache-miss'
  | 'promoted' | 'demoted' | 'cancelled' | 'stale' | 'failed' | 'evicted'
  | 'prediction-used' | 'prediction-unused';

export interface LoaderEvent {
  readonly at: number;
  readonly kind: LoaderEventKind;
  readonly key: string;
  readonly priority?: LoadPriority;
  readonly stage?: LoadStage;
  readonly durationMs?: number;
  readonly bytes?: number;
  readonly reason?: string;
}

export interface PredictiveActionEvent {
  readonly sessionId: string;
  readonly eventType:
    | 'route-opened' | 'city-opened' | 'masterplan-opened' | 'sector-opened'
    | 'property-opened' | 'view-on-map' | 'mode-selected'
    | 'client-link-started' | 'client-link-property-added' | 'transition';
  readonly fromType?: string;
  readonly fromId?: string;
  readonly toType?: string;
  readonly toId?: string;
  readonly resourceType?: PredictiveResourceType;
  readonly resourceId?: string;
  readonly at: string;
}

export interface DealerPredictionSummary {
  readonly fromType: string;
  readonly fromId: string;
  readonly toType: string;
  readonly toId: string;
  readonly count: number;
  readonly recentScore: number;
  readonly lastUsedAt: string;
}
