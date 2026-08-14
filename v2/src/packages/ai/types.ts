/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Domain types (read side)
   ---------------------------------------------------------------
   The shapes MAPCO renders. They mirror the canonical generation
   schemas in `supabase/functions/_shared/ai/schemas.ts`, which are
   authoritative for what a provider is allowed to produce.

   Two independent validation points, on purpose:
     • the Edge service validates before STORING an artifact;
     • `guards.ts` validates again before RENDERING one.
   A stored row is data from outside the UI's control, so the UI
   checks it rather than trusting it.

   AI_SCHEMA_VERSION must be bumped in BOTH places together. A
   stored artifact keeps the version it was generated under.

   Nothing in this package is imported by the dealer Home page.
   ═══════════════════════════════════════════════════════════════ */

export const AI_SCHEMA_VERSION = 'v1';

export type AiConfidence = 'low' | 'medium' | 'high';
export type AiDirection = 'up' | 'down' | 'flat';
export type AiPriority = 'now' | 'this_week' | 'later';

/** What a statement is about. Never a person — MAPCO's activity data is anonymous. */
export type AiSubjectKind =
  | 'area' | 'sector' | 'property' | 'client_link' | 'map' | 'inventory' | 'portfolio';

export interface AiSubject {
  readonly kind: AiSubjectKind;
  readonly id: string;
  readonly label: string;
}

/** A pointer back into the deterministic facts that justified a statement. */
export interface AiEvidence {
  readonly factPath: string;
  readonly metric: string;
  readonly value: number;
  readonly previousValue?: number;
}

export type AiSignalKind =
  | 'attention_rising'
  | 'attention_falling'
  | 'unusual_engagement'
  | 'repeat_link_opens'
  | 'underexposed_inventory'
  | 'coverage_gap'
  | 'inventory_change'
  | 'no_change';

export interface AiSignal {
  readonly id: string;
  readonly kind: AiSignalKind;
  readonly subject: AiSubject;
  readonly headline: string;
  readonly detail: string;
  readonly direction: AiDirection;
  readonly magnitude: number;
  readonly confidence: AiConfidence;
  readonly evidence: readonly AiEvidence[];
}

export interface AiRecommendation {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly subject: AiSubject;
  readonly priority: AiPriority;
  readonly confidence: AiConfidence;
  readonly evidence: readonly AiEvidence[];
  /** Name of a MAPCO action; resolved against the catalog, never executed from here. */
  readonly suggestedAction?: string;
}

export interface AiSignalSet {
  readonly periodLabel: string;
  readonly summary: string;
  readonly signals: readonly AiSignal[];
  readonly insufficientData: boolean;
}

export interface AiIntelligenceSnapshot {
  readonly periodLabel: string;
  readonly headline: string;
  readonly interpretation: string;
  readonly signals: readonly AiSignal[];
  readonly recommendations: readonly AiRecommendation[];
  readonly insufficientData: boolean;
  readonly dataNotes: readonly string[];
}

export type AiReportSectionKey =
  | 'presentation_behaviour'
  | 'property_performance'
  | 'area_performance'
  | 'marketing_performance'
  | 'important_changes';

export interface AiReportHighlight {
  readonly label: string;
  readonly value: string;
  readonly changeLabel?: string;
  readonly subject?: AiSubject;
}

export interface AiReportSection {
  readonly key: AiReportSectionKey;
  readonly title: string;
  readonly narrative: string;
  readonly highlights: readonly AiReportHighlight[];
  readonly evidence: readonly AiEvidence[];
}

export interface AiWeeklyReport {
  readonly periodLabel: string;
  readonly headline: string;
  readonly executiveSummary: string;
  readonly sections: readonly AiReportSection[];
  readonly recommendations: readonly AiRecommendation[];
  readonly insufficientData: boolean;
  readonly dataNotes: readonly string[];
}

export type AiMarketingChannel = 'instagram' | 'google_business' | 'whatsapp';

export interface AiGeneratedCopy {
  readonly headline: string;
  readonly subhead?: string;
  readonly caption: string;
  readonly hashtags: readonly string[];
  readonly callToAction: string;
  readonly factsUsed: readonly string[];
}

export type AiMarketingAngle =
  | 'location' | 'value' | 'size' | 'approvals' | 'connectivity' | 'lifestyle' | 'availability';

export interface AiMarketingSuggestion {
  readonly propertyId: string;
  readonly angle: AiMarketingAngle;
  readonly rationale: string;
  readonly confidence: AiConfidence;
  readonly copy: AiGeneratedCopy;
  readonly channels: readonly AiMarketingChannel[];
}

export interface AiAnswer {
  readonly answer: string;
  readonly answered: boolean;
  readonly evidence: readonly AiEvidence[];
  readonly followUps: readonly string[];
}

/* ── stored artifact envelope ───────────────────────────────────── */

export type AiArtifactKind =
  | 'intelligence_snapshot'
  | 'signal_set'
  | 'recommendation_set'
  | 'weekly_report'
  | 'marketing_suggestion'
  | 'generated_copy'
  | 'answer';

/** Internal provenance. Kept for auditability; not dealer-facing clutter. */
export interface AiProvenance {
  readonly provider?: string;
  readonly model?: string;
  readonly contextDigest?: string;
}

export interface AiArtifact<T> {
  readonly id: string;
  readonly kind: AiArtifactKind;
  readonly periodKey: string;
  readonly version: number;
  readonly schemaVersion: string;
  readonly payload: T;
  readonly confidence?: number;
  readonly generatedAt: string;
  readonly provenance: AiProvenance;
}

export interface AiArtifactSummary {
  readonly id: string;
  readonly kind: AiArtifactKind;
  readonly periodKey: string;
  readonly version: number;
  readonly status: 'published' | 'superseded';
  readonly generatedAt: string;
  readonly provider?: string;
  readonly model?: string;
}

/* ── actions ────────────────────────────────────────────────────── */

export type AiActionRisk = 'internal' | 'external' | 'consequential';
export type AiActionStatus =
  | 'proposed' | 'approved' | 'rejected' | 'executing'
  | 'executed' | 'failed' | 'expired' | 'cancelled';

export interface AiActionProposal {
  readonly id: string;
  readonly actionType: string;
  readonly status: AiActionStatus;
  readonly risk: AiActionRisk;
  readonly requiresApproval: boolean;
  readonly title: string;
  readonly rationale?: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

/* ── operations ─────────────────────────────────────────────────── */

export interface AiQuotaState {
  readonly suspended: boolean;
  readonly dailyCostLimitMicroUsd: number;
  readonly monthlyCostLimitMicroUsd: number;
  readonly dailyExecutionLimit: number;
  readonly dayCostMicroUsd: number;
  readonly dayExecutions: number;
  readonly monthCostMicroUsd: number;
  readonly allowed: boolean;
}

export interface AiStatus {
  readonly enabled: boolean;
  /** Per-capability switches. An absent key means the capability is off. */
  readonly features: Readonly<Record<string, boolean>>;
  readonly pendingJobs: number;
  readonly failedJobs: number;
  readonly quota: AiQuotaState | null;
}

export interface AiUsageRow {
  readonly day: string;
  readonly task: string;
  readonly provider: string;
  readonly model: string;
  readonly executions: number;
  readonly failures: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicroUsd: number;
}

/** Cost is stored as integer micro-USD; format only at the display edge. */
export function formatMicroUsd(microUsd: number): string {
  const usd = Math.max(0, Number(microUsd) || 0) / 1_000_000;
  return usd < 0.01 && usd > 0 ? '<$0.01' : `$${usd.toFixed(2)}`;
}
