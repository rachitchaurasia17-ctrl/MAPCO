/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Supabase repository
   ---------------------------------------------------------------
   Implements AiRepository over the dealer-scoped `plotmap_ai_*` RPCs
   and the `ai-run` Edge Function.

   Security properties this file relies on rather than re-implements:
     • Every RPC derives the dealer from auth.uid(). No dealer id is
       ever sent from the browser.
     • Dealers can read only PUBLISHED artifacts for their own dealer,
       enforced by RLS, not by a filter here.
     • No provider key exists in the browser. Generation happens only
       inside Edge Functions.

   Every method returns a typed Result and never throws, so an AI
   outage degrades a surface instead of breaking it.
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './client';
import { ok, err, type Result, type QueryOptions } from '../contracts';
import {
  aiReady, aiUnavailable, AI_DISABLED_STATUS,
  type AiAvailability, type AiActionDecision, type AiJobType,
  type AiRepository, type AiUnavailableReason,
} from '../../ai/contracts';
import {
  parseAnswer, parseArtifact, parseArtifactSummary, PAYLOAD_PARSERS,
} from '../../ai/guards';
import type {
  AiActionProposal, AiArtifactKind, AiArtifactSummary, AiAnswer, AiIntelligenceSnapshot,
  AiMarketingSuggestion, AiQuotaState, AiSignalSet, AiStatus, AiUsageRow, AiWeeklyReport,
} from '../../ai/types';

type Envelope = Record<string, unknown>;

function aborted<T>(opts?: QueryOptions): Result<T> | null {
  return opts?.signal?.aborted ? err('aborted', 'Request cancelled') : null;
}

async function client(): Promise<SupabaseClient | null> {
  try {
    return await getSupabase();
  } catch {
    return null;
  }
}

/** RPC `reason` strings map onto the availability vocabulary, one to one. */
function reasonToAvailability(reason: unknown): AiUnavailableReason {
  switch (String(reason ?? '')) {
    case 'ai_disabled': return 'disabled';
    case 'not_authenticated': return 'not_authenticated';
    case 'not_available': return 'not_available';
    default: return 'error';
  }
}

function parseQuota(raw: unknown): AiQuotaState | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Envelope;
  if (source.ok !== true) return null;
  const n = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return {
    suspended: source.suspended === true,
    dailyCostLimitMicroUsd: n(source.daily_cost_limit_micro_usd),
    monthlyCostLimitMicroUsd: n(source.monthly_cost_limit_micro_usd),
    dailyExecutionLimit: n(source.daily_execution_limit),
    dayCostMicroUsd: n(source.day_cost_micro_usd),
    dayExecutions: n(source.day_executions),
    monthCostMicroUsd: n(source.month_cost_micro_usd),
    allowed: source.allowed === true,
  };
}

function parseFeatures(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    // Only an explicit true enables a capability. Anything else is off.
    if (value === true) out[key] = true;
  }
  return out;
}

export class SupabaseAiRepository implements AiRepository {
  async status(opts?: QueryOptions): Promise<Result<AiStatus>> {
    const a = aborted<AiStatus>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return ok(AI_DISABLED_STATUS);
      const { data, error } = await c.rpc('plotmap_ai_status');
      if (error) return ok(AI_DISABLED_STATUS);
      const envelope = (data ?? {}) as Envelope;
      if (envelope.ok !== true) return ok(AI_DISABLED_STATUS);
      return ok({
        enabled: envelope.enabled === true,
        features: parseFeatures(envelope.features),
        pendingJobs: Number(envelope.pendingJobs ?? 0),
        failedJobs: Number(envelope.failedJobs ?? 0),
        quota: parseQuota(envelope.quota),
      });
    } catch {
      // Status is the one call that must never surface an error: a page
      // asking "is AI on?" gets "no" rather than an exception.
      return ok(AI_DISABLED_STATUS);
    }
  }

  private async artifact<T>(
    kind: AiArtifactKind,
    parsePayload: (payload: unknown) => T | null,
    periodKey?: string,
    opts?: QueryOptions,
  ): Promise<Result<AiAvailability<T>>> {
    const a = aborted<AiAvailability<T>>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return ok(aiUnavailable<T>('unsupported'));
      const { data, error } = await c.rpc('plotmap_ai_current_artifact', {
        p_kind: kind,
        p_period_key: periodKey ?? null,
      });
      if (error) return ok(aiUnavailable<T>('error'));
      const envelope = (data ?? {}) as Envelope;
      if (envelope.ok !== true) return ok(aiUnavailable<T>(reasonToAvailability(envelope.reason)));
      const parsed = parseArtifact<T>(envelope.artifact, parsePayload);
      // A stored payload that fails validation is treated as absent rather
      // than rendered partially. Nothing unvalidated reaches a screen.
      return ok(parsed ? aiReady(parsed) : aiUnavailable<T>('error'));
    } catch {
      return ok(aiUnavailable<T>('error'));
    }
  }

  snapshot(periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiIntelligenceSnapshot>>> {
    return this.artifact('intelligence_snapshot', PAYLOAD_PARSERS.intelligence_snapshot, periodKey, opts);
  }

  weeklyReport(periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiWeeklyReport>>> {
    return this.artifact('weekly_report', PAYLOAD_PARSERS.weekly_report, periodKey, opts);
  }

  signals(periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiSignalSet>>> {
    return this.artifact('signal_set', PAYLOAD_PARSERS.signal_set, periodKey, opts);
  }

  marketingSuggestion(propertyId: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiMarketingSuggestion>>> {
    // Marketing artifacts are keyed by property id, not by a date period.
    return this.artifact('marketing_suggestion', PAYLOAD_PARSERS.marketing_suggestion, propertyId, opts);
  }

  async history(
    kind: AiArtifactKind,
    limit = 20,
    opts?: QueryOptions,
  ): Promise<Result<readonly AiArtifactSummary[]>> {
    const a = aborted<readonly AiArtifactSummary[]>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return ok([]);
      const { data, error } = await c.rpc('plotmap_ai_artifact_history', { p_kind: kind, p_limit: limit });
      if (error) return ok([]);
      return ok(((data ?? []) as unknown[])
        .map(parseArtifactSummary)
        .filter((item): item is AiArtifactSummary => item !== null));
    } catch {
      return ok([]);
    }
  }

  async usage(days = 30, opts?: QueryOptions): Promise<Result<readonly AiUsageRow[]>> {
    const a = aborted<readonly AiUsageRow[]>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return ok([]);
      const { data, error } = await c.rpc('plotmap_ai_usage_summary', { p_days: days });
      if (error) return ok([]);
      return ok(((data ?? []) as Envelope[]).map((row) => ({
        day: String(row.day ?? ''),
        task: String(row.task ?? ''),
        provider: String(row.provider ?? ''),
        model: String(row.model ?? ''),
        executions: Number(row.executions ?? 0),
        failures: Number(row.failures ?? 0),
        inputTokens: Number(row.input_tokens ?? 0),
        outputTokens: Number(row.output_tokens ?? 0),
        costMicroUsd: Number(row.cost_micro_usd ?? 0),
      })));
    } catch {
      return ok([]);
    }
  }

  async pendingActions(opts?: QueryOptions): Promise<Result<readonly AiActionProposal[]>> {
    const a = aborted<readonly AiActionProposal[]>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return ok([]);
      const { data, error } = await c.rpc('plotmap_ai_pending_actions', { p_limit: 25 });
      if (error) return ok([]);
      return ok(((data ?? []) as Envelope[]).map((row) => ({
        id: String(row.id ?? ''),
        actionType: String(row.action_type ?? ''),
        status: (row.status as AiActionProposal['status']) ?? 'proposed',
        risk: (row.risk as AiActionProposal['risk']) ?? 'external',
        requiresApproval: row.requires_approval !== false,
        title: String(row.title ?? ''),
        ...(row.rationale ? { rationale: String(row.rationale) } : {}),
        params: (row.params && typeof row.params === 'object' ? row.params : {}) as Record<string, unknown>,
        createdAt: String(row.created_at ?? ''),
        ...(row.expires_at ? { expiresAt: String(row.expires_at) } : {}),
      })));
    } catch {
      return ok([]);
    }
  }

  async decideAction(
    id: string,
    decision: AiActionDecision,
    note?: string,
    opts?: QueryOptions,
  ): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return err('unavailable', 'AI is not configured');
      const { data, error } = await c.rpc('plotmap_ai_decide_action', {
        p_proposal_id: id,
        p_decision: decision,
        p_note: note ?? null,
      });
      if (error) return err('forbidden', 'That decision could not be recorded');
      const envelope = (data ?? {}) as Envelope;
      if (envelope.ok !== true) {
        return envelope.reason === 'expired'
          ? err('gone', 'That suggestion has expired')
          : err('conflict', 'That suggestion was already decided');
      }
      return ok(undefined);
    } catch {
      return err('network', 'That decision could not be recorded', { retryable: true });
    }
  }

  async contextFacts(
    windowDays = 7,
    opts?: QueryOptions,
  ): Promise<Result<Readonly<Record<string, unknown>>>> {
    const a = aborted<Readonly<Record<string, unknown>>>(opts); if (a) return a;
    try {
      const c = await client();
      if (!c) return err('unavailable', 'AI is not configured');
      const { data, error } = await c.rpc('plotmap_ai_context_facts', {
        p_window_days: windowDays,
        p_top: 20,
      });
      if (error) return err('forbidden', 'Facts are unavailable');
      const envelope = (data ?? {}) as Envelope;
      if (envelope.ok !== true) return err('unavailable', String(envelope.reason ?? 'Facts are unavailable'));
      return ok(envelope);
    } catch {
      return err('network', 'Facts are unavailable', { retryable: true });
    }
  }

  async ask(question: string, windowDays = 7, opts?: QueryOptions): Promise<Result<AiAnswer | null>> {
    const a = aborted<AiAnswer | null>(opts); if (a) return a;
    const trimmed = question.trim().slice(0, 500);
    if (trimmed.length < 3) return err('validation', 'Ask a longer question');
    try {
      const c = await client();
      if (!c) return err('unavailable', 'AI is not configured');
      // Provider calls happen only inside the Edge runtime; the browser
      // holds no key and never talks to a provider directly.
      const response = await c.functions.invoke('ai-run', {
        body: { intent: 'ask', question: trimmed, windowDays },
      });
      if (response.error) return err('unavailable', 'MAPCO could not answer right now', { retryable: true });
      const envelope = (response.data ?? {}) as Envelope;
      if (envelope.ok !== true) {
        return envelope.reason === 'ai_disabled' ? ok(null) : err('unavailable', 'MAPCO could not answer right now');
      }
      return ok(parseAnswer(envelope.answer));
    } catch {
      return err('network', 'MAPCO could not answer right now', { retryable: true });
    }
  }

  async enqueue(
    jobType: AiJobType,
    idempotencyKey: string,
    input?: Readonly<Record<string, unknown>>,
    opts?: QueryOptions,
  ): Promise<Result<{ readonly created: boolean }>> {
    const a = aborted<{ readonly created: boolean }>(opts); if (a) return a;
    const key = idempotencyKey.trim().slice(0, 200);
    if (!key) return err('validation', 'An idempotency key is required');
    try {
      const c = await client();
      if (!c) return err('unavailable', 'AI is not configured');
      const response = await c.functions.invoke('ai-run', {
        body: { intent: 'enqueue', jobType, idempotencyKey: key, input: input ?? {} },
      });
      if (response.error) return err('unavailable', 'That job could not be queued', { retryable: true });
      const envelope = (response.data ?? {}) as Envelope;
      if (envelope.ok !== true) return err('forbidden', String(envelope.reason ?? 'That job could not be queued'));
      return ok({ created: envelope.created === true });
    } catch {
      return err('network', 'That job could not be queued', { retryable: true });
    }
  }
}
