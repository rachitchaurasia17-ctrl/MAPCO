// MAPCO AI · Service orchestrator
// ---------------------------------------------------------------
// The single entry point for "run an AI workload". Every caller — the
// scheduled worker, an interactive request, a future marketing pipeline —
// comes through here, so the guarantees below hold once rather than being
// re-implemented per feature:
//
//   enablement → quota → reuse check → route → execute → validate
//   → meter → store → audit
//
// Failure is always typed and always accounted for. A provider outage
// produces a recorded failed execution and a graceful result; it never
// throws into a caller and never leaves a half-written artifact.

import { rpc } from '../db.ts';
import { logEvent } from '../redact.ts';
import { buildBusinessContext, buildMarketingContext, type FactsResult } from './context.ts';
import { costMicroUsd } from './pricing.ts';
import { systemPrompt, userPrompt } from './prompts.ts';
import { fallbackRoutes, resolveRoute, type ResolvedRoute } from './router.ts';
import { toJsonSchema, validate } from './schema.ts';
import { AI_SCHEMA_VERSION } from './schemas.ts';
import { getTask, schemaForTask, type TaskDefinition } from './tasks.ts';
import { actionCatalogForPrompt, validateActionRequest } from './tools.ts';

export type AiRunFailure =
  | 'ai_disabled'
  | 'quota_exceeded'
  | 'unknown_task'
  | 'no_provider'
  | 'facts_unavailable'
  | 'schema_invalid'
  | 'provider_failed'
  | 'storage_failed';

export interface AiRunOptions {
  readonly dealerId: string;
  readonly taskId: string;
  readonly periodKey: string;
  readonly periodLabel?: string;
  readonly jobId?: string | null;
  /** Business context window. Ignored for property-scoped tasks. */
  readonly windowDays?: number;
  /** Required for marketing tasks. */
  readonly propertyId?: string;
  /** Required for ask_mapco. */
  readonly question?: string;
  /** Store the validated output as a published artifact. */
  readonly persist?: boolean;
}

export type AiRunResult =
  | {
      readonly ok: true;
      readonly reused: boolean;
      readonly taskId: string;
      readonly payload: Record<string, unknown>;
      readonly artifactId?: string;
      readonly executionId?: string;
      readonly provider?: string;
      readonly model?: string;
      readonly costMicroUsd: number;
      readonly contextDigest?: string;
    }
  | {
      readonly ok: false;
      readonly reason: AiRunFailure;
      readonly detail?: string;
      readonly retryable: boolean;
    };

/* ── gates ──────────────────────────────────────────────────────── */

async function quotaAllows(dealerId: string): Promise<{ allowed: boolean; enabled: boolean }> {
  try {
    const state = await rpc<Record<string, unknown>>('plotmap_ai_quota_state', { p_dealer_id: dealerId });
    return { allowed: state?.allowed === true, enabled: state?.enabled === true };
  } catch {
    // Fail closed: an unreadable quota is not permission to spend.
    return { allowed: false, enabled: false };
  }
}

async function loadContext(task: TaskDefinition, options: AiRunOptions): Promise<FactsResult> {
  if (task.id === 'marketing_copy' || task.id === 'marketing_suggestion') {
    if (!options.propertyId) return { ok: false, reason: 'facts_unavailable' };
    return buildMarketingContext(options.dealerId, options.propertyId);
  }
  return buildBusinessContext(options.dealerId, options.windowDays ?? 7);
}

/* ── provider execution with in-place failover ──────────────────── */

interface ProviderAttempt {
  readonly route: ResolvedRoute;
  readonly data?: unknown;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly ok: boolean;
  readonly retryable: boolean;
}

async function callProvider(
  route: ResolvedRoute,
  task: TaskDefinition,
  system: string,
  user: string,
): Promise<ProviderAttempt> {
  const result = await route.provider.generateStructured({
    model: route.model,
    system,
    user,
    schemaName: task.outputSchema,
    jsonSchema: toJsonSchema(schemaForTask(task)),
    maxOutputTokens: task.maxOutputTokens,
    temperature: task.temperature,
  });
  if (result.ok) {
    return {
      route,
      ok: true,
      retryable: false,
      data: result.data,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: result.latencyMs,
    };
  }
  return {
    route,
    ok: false,
    retryable: result.retryable,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    latencyMs: result.latencyMs,
    errorCode: result.errorCode,
    errorMessage: result.message,
  };
}

/* ── main entry point ───────────────────────────────────────────── */

export async function runTask(options: AiRunOptions): Promise<AiRunResult> {
  const task = getTask(options.taskId);
  if (!task) return { ok: false, reason: 'unknown_task', retryable: false };

  const gate = await quotaAllows(options.dealerId);
  if (!gate.enabled) return { ok: false, reason: 'ai_disabled', retryable: false };
  if (!gate.allowed) return { ok: false, reason: 'quota_exceeded', retryable: false };

  const context = await loadContext(task, options);
  if (!context.ok || !context.facts) {
    return { ok: false, reason: 'facts_unavailable', detail: context.reason, retryable: false };
  }

  // Reuse: identical facts within the task's reuse window means there is
  // genuinely nothing new to say, so nothing is bought.
  if (task.artifactKind && task.reuseWindowMinutes > 0 && context.digest) {
    try {
      const reusable = await rpc<Record<string, unknown>>('plotmap_ai_reusable_artifact', {
        p_dealer_id: options.dealerId,
        p_kind: task.artifactKind,
        p_context_digest: context.digest,
        p_max_age_minutes: task.reuseWindowMinutes,
      });
      if (reusable?.ok === true) {
        logEvent('info', 'ai.run.reused', { dealerId: options.dealerId, task: task.id });
        return {
          ok: true,
          reused: true,
          taskId: task.id,
          payload: (reusable.payload ?? {}) as Record<string, unknown>,
          artifactId: String(reusable.id ?? ''),
          costMicroUsd: 0,
          contextDigest: context.digest,
        };
      }
    } catch {
      // A reuse lookup failure only costs a regeneration; carry on.
    }
  }

  let route = resolveRoute(task.costClass);
  if (!route) return { ok: false, reason: 'no_provider', retryable: true };

  const system = systemPrompt(task);
  const user = userPrompt(task, {
    facts: context.facts,
    question: options.question,
    periodLabel: options.periodLabel ?? options.periodKey,
    actionCatalog: task.id === 'action_proposals' ? actionCatalogForPrompt() : undefined,
  });

  let executionId = '';
  try {
    executionId = await rpc<string>('plotmap_ai_start_execution', {
      p_dealer_id: options.dealerId,
      p_task: task.id,
      p_provider: route.providerName,
      p_model: route.model,
      p_job_id: options.jobId ?? null,
      p_prompt_version: task.promptVersion,
      p_schema_version: AI_SCHEMA_VERSION,
      p_context_digest: context.digest ?? null,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // start_execution re-checks enablement and quota inside the database,
    // so this is a real refusal, not a transport hiccup to retry blindly.
    return { ok: false, reason: 'quota_exceeded', detail, retryable: false };
  }

  let attempt = await callProvider(route, task, system, user);
  if (!attempt.ok && attempt.retryable) {
    for (const next of fallbackRoutes(task.costClass, route.model)) {
      logEvent('warn', 'ai.route.failover', {
        dealerId: options.dealerId, task: task.id,
        from: route.model, to: next.model, errorCode: attempt.errorCode ?? '',
      });
      route = next;
      attempt = await callProvider(next, task, system, user);
      if (attempt.ok) break;
    }
  }

  const cost = costMicroUsd(attempt.route.providerName, attempt.route.model, {
    inputTokens: attempt.inputTokens,
    outputTokens: attempt.outputTokens,
  });

  if (!attempt.ok) {
    await completeExecution(executionId, 'failed', attempt, cost);
    logEvent('error', 'ai.run.provider_failed', {
      dealerId: options.dealerId, task: task.id, errorCode: attempt.errorCode ?? '',
    });
    return {
      ok: false, reason: 'provider_failed',
      detail: attempt.errorCode, retryable: attempt.retryable,
    };
  }

  // MAPCO's own validation. Provider-side constraints are a first gate;
  // this is the gate that decides what may be stored.
  const validated = validate<Record<string, unknown>>(schemaForTask(task), attempt.data);
  if (!validated.ok) {
    await completeExecution(executionId, 'rejected', attempt, cost, 'schema_invalid', validated.errors.join('; '));
    logEvent('error', 'ai.run.schema_invalid', {
      dealerId: options.dealerId, task: task.id, errors: validated.errors.slice(0, 3).join('; '),
    });
    return { ok: false, reason: 'schema_invalid', detail: validated.errors[0], retryable: true };
  }

  let payload = validated.value;
  // Action requests get a second, independent resolution against the
  // catalog. Anything the model named that MAPCO does not offer is dropped
  // here, before a proposal row can exist.
  if (task.id === 'action_proposals') payload = filterActionProposals(payload);

  await completeExecution(executionId, 'succeeded', attempt, cost);

  let artifactId: string | undefined;
  if (task.artifactKind && options.persist !== false) {
    try {
      const stored = await rpc<Record<string, unknown>>('plotmap_ai_store_artifact', {
        p_dealer_id: options.dealerId,
        p_kind: task.artifactKind,
        p_period_key: options.periodKey,
        p_payload: payload,
        p_facts: context.facts,
        p_schema_version: AI_SCHEMA_VERSION,
        p_execution_id: executionId,
        p_job_id: options.jobId ?? null,
        p_provider: attempt.route.providerName,
        p_model: attempt.route.model,
        p_context_digest: context.digest ?? null,
        p_publish: true,
      });
      if (stored?.ok === true) artifactId = String(stored.id ?? '');
      else return { ok: false, reason: 'storage_failed', retryable: true };
    } catch (error) {
      logEvent('error', 'ai.run.storage_failed', {
        dealerId: options.dealerId, task: task.id,
        detail: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, reason: 'storage_failed', retryable: true };
    }
  }

  logEvent('info', 'ai.run.succeeded', {
    dealerId: options.dealerId, task: task.id,
    provider: attempt.route.providerName, model: attempt.route.model,
    costMicroUsd: cost, contextBytes: context.bytes ?? 0, trimmed: context.trimmed ?? false,
  });

  return {
    ok: true, reused: false, taskId: task.id, payload, artifactId, executionId,
    provider: attempt.route.providerName, model: attempt.route.model,
    costMicroUsd: cost, contextDigest: context.digest,
  };
}

async function completeExecution(
  executionId: string,
  status: 'succeeded' | 'failed' | 'rejected',
  attempt: ProviderAttempt,
  cost: number,
  errorCode?: string,
  errorMessage?: string,
): Promise<void> {
  if (!executionId) return;
  try {
    await rpc('plotmap_ai_complete_execution', {
      p_execution_id: executionId,
      p_status: status,
      p_input_tokens: attempt.inputTokens,
      p_output_tokens: attempt.outputTokens,
      // A failed call that consumed tokens is still billed by the provider,
      // so it is still metered here. Cost tracking must never under-report.
      p_cost_micro_usd: cost,
      p_latency_ms: attempt.latencyMs,
      p_error_code: errorCode ?? attempt.errorCode ?? null,
      p_error_message: errorMessage ?? attempt.errorMessage ?? null,
    });
  } catch (error) {
    logEvent('error', 'ai.execution.close_failed', {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Keep only proposals naming a real MAPCO action with valid parameters. */
function filterActionProposals(payload: Record<string, unknown>): Record<string, unknown> {
  const raw = Array.isArray(payload.proposals) ? payload.proposals as Record<string, unknown>[] : [];
  const kept: Record<string, unknown>[] = [];
  for (const proposal of raw) {
    const check = validateActionRequest(proposal.actionType, proposal.params);
    if (!check.ok) {
      logEvent('warn', 'ai.action.rejected', {
        actionType: String(proposal.actionType ?? ''), reason: check.reason,
      });
      continue;
    }
    kept.push({
      actionType: check.action.type,
      title: String(proposal.title ?? check.action.type).slice(0, 120),
      rationale: String(proposal.rationale ?? '').slice(0, 600),
      params: check.params,
      risk: check.action.risk,
    });
  }
  return { ...payload, proposals: kept };
}
