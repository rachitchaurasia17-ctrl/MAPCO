/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Repository contract
   ---------------------------------------------------------------
   The single boundary every future AI surface talks to, mirroring how
   the rest of MAPCO consumes `DataAdapterV2`. A screen depends on this
   interface, never on Supabase, an Edge Function or a provider.

   Three properties matter more than the method list:

   1. READ-ONLY BY DEFAULT. The only mutating methods are a dealer
      approving an action and queueing background work. No screen can
      trigger a provider call as a side effect of rendering.

   2. AVAILABILITY IS A VALUE. Every artifact read returns an
      `AiAvailability`, so "AI is off", "nothing generated yet" and
      "here is the artifact" are all ordinary states a page renders —
      not exceptions it has to survive.

   3. NO SURFACE IS WIRED YET. Nothing in the dealer app calls these
      methods. The dealer Home page in particular reads none of them
      and continues to render its existing real data.
   ═══════════════════════════════════════════════════════════════ */

import type { QueryOptions, Result } from '../data/contracts';
import type {
  AiActionProposal, AiAnswer, AiArtifact, AiArtifactKind, AiArtifactSummary,
  AiIntelligenceSnapshot, AiMarketingSuggestion, AiSignalSet, AiStatus, AiUsageRow, AiWeeklyReport,
} from './types';

/** Why an artifact is not being shown. Never an error the UI must catch. */
export type AiUnavailableReason =
  | 'disabled'          // AI is off for this dealer
  | 'not_available'     // enabled, but nothing generated for this period yet
  | 'not_authenticated'
  | 'quota_exceeded'
  | 'unsupported'       // this build/mode has no AI backend
  | 'error';            // transport or validation failure; degrade quietly

export type AiAvailability<T> =
  | { readonly kind: 'unavailable'; readonly reason: AiUnavailableReason }
  | { readonly kind: 'ready'; readonly artifact: AiArtifact<T> };

export const aiUnavailable = <T>(reason: AiUnavailableReason): AiAvailability<T> =>
  ({ kind: 'unavailable', reason });

export const aiReady = <T>(artifact: AiArtifact<T>): AiAvailability<T> =>
  ({ kind: 'ready', artifact });

export type AiJobType =
  | 'daily_intelligence'
  | 'weekly_report'
  | 'signal_scan'
  | 'marketing_content_context';

export type AiActionDecision = 'approve' | 'reject' | 'cancel';

export interface AiRepository {
  /** Enablement, per-capability flags, queue health and quota. Always safe to call. */
  status(opts?: QueryOptions): Promise<Result<AiStatus>>;

  /** Latest published daily intelligence snapshot. */
  snapshot(periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiIntelligenceSnapshot>>>;

  /** Latest published weekly report. */
  weeklyReport(periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiWeeklyReport>>>;

  /** Latest published signal set. */
  signals(periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiSignalSet>>>;

  /** Latest marketing suggestion for one property. */
  marketingSuggestion(propertyId: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiMarketingSuggestion>>>;

  /** Version history for a kind, so a dealer can see what changed and when. */
  history(kind: AiArtifactKind, limit?: number, opts?: QueryOptions): Promise<Result<readonly AiArtifactSummary[]>>;

  /** Per day/task/model usage and cost for this dealer. */
  usage(days?: number, opts?: QueryOptions): Promise<Result<readonly AiUsageRow[]>>;

  /** Action proposals awaiting a decision or currently running. */
  pendingActions(opts?: QueryOptions): Promise<Result<readonly AiActionProposal[]>>;

  /** Dealer approval/rejection. Approving queues execution; it does not execute. */
  decideAction(id: string, decision: AiActionDecision, note?: string, opts?: QueryOptions): Promise<Result<void>>;

  /**
   * The deterministic facts MAPCO would send about this dealer's own
   * business. Exposed for operator/developer visibility so the context
   * layer is inspectable without reading provider logs.
   */
  contextFacts(windowDays?: number, opts?: QueryOptions): Promise<Result<Readonly<Record<string, unknown>>>>;

  /** Grounded question against this dealer's own facts. */
  ask(question: string, windowDays?: number, opts?: QueryOptions): Promise<Result<AiAnswer | null>>;

  /** Queue background work for this dealer. Idempotent by key. */
  enqueue(
    jobType: AiJobType,
    idempotencyKey: string,
    input?: Readonly<Record<string, unknown>>,
    opts?: QueryOptions,
  ): Promise<Result<{ readonly created: boolean }>>;
}

/** The status value used whenever no AI backend is reachable. */
export const AI_DISABLED_STATUS: AiStatus = {
  enabled: false,
  features: {},
  pendingJobs: 0,
  failedJobs: 0,
  quota: null,
};
