// MAPCO AI · Background worker
// ---------------------------------------------------------------
// AI work in MAPCO never depends on a browser being open. This function is
// the execution surface for everything scheduled or asynchronous:
//
//   mode=schedule  enqueue due periodic jobs for AI-enabled dealers
//   mode=jobs      claim leased jobs and run them
//   mode=actions   execute dealer-approved action proposals
//
// Trigger it from any scheduler — Supabase cron, an external cron, a CI
// job — with the shared worker key. Nothing about the design assumes a
// particular scheduler, and no browser can reach it: the key lives only in
// the caller and the Edge secret store.
//
// Every enqueue is idempotent, so a scheduler that fires twice, retries,
// or overlaps with a previous run cannot double-charge a dealer.

import { rpc, backendConfigured } from '../_shared/db.ts';
import { json, readJsonBody, secretMatches } from '../_shared/http.ts';
import { logEvent } from '../_shared/redact.ts';
import { runTask } from '../_shared/ai/service.ts';
import { getExecutor, type ActionExecutionContext } from '../_shared/ai/tools.ts';
import { routingStatus } from '../_shared/ai/router.ts';
import { buildMarketingContext } from '../_shared/ai/context.ts';

const WORKER_KEY = String(Deno.env.get('MAPCO_AI_WORKER_KEY') || '');
const LEASE_SECONDS = 300;

const SECURITY_HEADERS: HeadersInit = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

interface JobRow {
  id: string;
  dealer_id: string;
  job_type: string;
  input: Record<string, unknown> | null;
  max_attempts: number;
  attempts: number;
}

/* ── period keys ────────────────────────────────────────────────── */

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** ISO-8601 week key, e.g. 2026-W33. Stable across year boundaries. */
function isoWeekKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/* ── mode: schedule ─────────────────────────────────────────────── */

async function scheduleDueJobs(now: Date): Promise<Record<string, unknown>> {
  const dealers = await rpc<{ dealer_id: string; features: Record<string, unknown> }[]>(
    'plotmap_ai_enabled_dealers',
    { p_limit: 500 },
  );
  const day = dayKey(now);
  const week = isoWeekKey(now);
  let enqueued = 0;
  let skipped = 0;

  for (const dealer of dealers ?? []) {
    const features = dealer.features ?? {};
    const plan: { type: string; key: string; input: Record<string, unknown>; priority: number }[] = [];

    // A capability that is off produces no job, and therefore no cost.
    if (features.daily_intelligence === true) {
      plan.push({ type: 'daily_intelligence', key: day, input: { periodKey: day, windowDays: 1 }, priority: 40 });
    }
    // The weekly review runs on Monday UTC, once per ISO week.
    if (features.weekly_report === true && now.getUTCDay() === 1) {
      plan.push({ type: 'weekly_report', key: week, input: { periodKey: week, windowDays: 7 }, priority: 60 });
    }
    if (features.signals === true) {
      plan.push({ type: 'signal_scan', key: day, input: { periodKey: day, windowDays: 7 }, priority: 45 });
    }

    for (const item of plan) {
      try {
        const result = await rpc<Record<string, unknown>>('plotmap_ai_enqueue_job', {
          p_dealer_id: dealer.dealer_id,
          p_job_type: item.type,
          // The period IS the idempotency key: one job per dealer per period,
          // no matter how often the scheduler fires.
          p_idempotency_key: item.key,
          p_input: item.input,
          p_priority: item.priority,
          p_max_attempts: 3,
        });
        if (result?.ok === true && result.created === true) enqueued += 1;
        else skipped += 1;
      } catch (error) {
        skipped += 1;
        logEvent('error', 'worker.enqueue_failed', {
          dealerId: dealer.dealer_id, jobType: item.type,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { dealers: (dealers ?? []).length, enqueued, skipped };
}

/* ── mode: jobs ─────────────────────────────────────────────────── */

async function runOneJob(job: JobRow, now: Date): Promise<{ status: string; reason?: string }> {
  const input = job.input ?? {};
  const periodKey = String(input.periodKey ?? dayKey(now));
  const windowDays = Number(input.windowDays ?? 7);

  switch (job.job_type) {
    case 'daily_intelligence':
    case 'weekly_report':
    case 'signal_scan': {
      const taskId = job.job_type === 'daily_intelligence'
        ? 'daily_intelligence'
        : job.job_type === 'weekly_report' ? 'weekly_report' : 'signal_scan';
      const result = await runTask({
        dealerId: job.dealer_id, taskId, periodKey, periodLabel: periodKey,
        windowDays, jobId: job.id, persist: true,
      });
      if (result.ok) return { status: 'succeeded' };
      // A retryable failure goes back on the queue with a delay; a refusal
      // (disabled, over quota, no facts) is terminal and says why.
      return { status: result.retryable ? 'queued' : 'failed', reason: result.reason };
    }

    case 'marketing_content_context': {
      // Deterministic: freezes marketing-safe property facts. No model call,
      // therefore no cost — the content context is pure MAPCO data work.
      const propertyId = String(input.propertyId ?? '');
      if (!propertyId) return { status: 'failed', reason: 'missing_property' };
      const context = await buildMarketingContext(job.dealer_id, propertyId);
      if (!context.ok || !context.facts) {
        return { status: 'failed', reason: context.reason ?? 'facts_unavailable' };
      }
      const facts = context.facts as Record<string, unknown>;
      await rpc('plotmap_ai_store_marketing_context', {
        p_dealer_id: job.dealer_id,
        p_property_id: propertyId,
        p_facts: facts,
        p_photo_refs: facts.photoRefs ?? [],
        p_content_hash: context.digest ?? null,
      });
      return { status: 'succeeded' };
    }

    case 'marketing_creative': {
      const propertyId = String(input.propertyId ?? '');
      if (!propertyId) return { status: 'failed', reason: 'missing_property' };
      const result = await runTask({
        dealerId: job.dealer_id, taskId: 'marketing_suggestion',
        periodKey: propertyId, propertyId, jobId: job.id, persist: true,
      });
      if (result.ok) return { status: 'succeeded' };
      return { status: result.retryable ? 'queued' : 'failed', reason: result.reason };
    }

    // Declared in the job catalog and reachable, but their pipelines belong
    // to later phases. Skipping with a named reason is the honest state —
    // it is not silently reported as done.
    case 'marketing_rotation':
    case 'external_performance_sync':
      return { status: 'skipped', reason: 'pipeline_not_implemented' };

    default:
      return { status: 'failed', reason: 'unsupported_job_type' };
  }
}

async function runClaimedJobs(leaseOwner: string, limit: number, now: Date): Promise<Record<string, unknown>> {
  const jobs = await rpc<JobRow[]>('plotmap_ai_claim_jobs', {
    p_lease_owner: leaseOwner,
    p_limit: limit,
    p_lease_seconds: LEASE_SECONDS,
  });

  const counts: Record<string, number> = { succeeded: 0, failed: 0, queued: 0, skipped: 0 };
  for (const job of jobs ?? []) {
    let outcome: { status: string; reason?: string };
    try {
      outcome = await runOneJob(job, now);
    } catch (error) {
      // An unexpected throw is contained per job: one bad job never stops
      // the batch and never leaves a lease dangling.
      outcome = { status: 'queued', reason: 'unexpected_error' };
      logEvent('error', 'worker.job_threw', {
        jobId: job.id, jobType: job.job_type,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    counts[outcome.status] = (counts[outcome.status] ?? 0) + 1;
    await rpc('plotmap_ai_complete_job', {
      p_job_id: job.id,
      p_status: outcome.status,
      p_error_code: outcome.reason ?? null,
      p_retry_in_seconds: outcome.status === 'queued' ? 600 : null,
    }).catch(() => undefined);
  }

  return { claimed: (jobs ?? []).length, ...counts };
}

/* ── mode: actions ──────────────────────────────────────────────── */

async function runApprovedActions(limit: number): Promise<Record<string, unknown>> {
  const proposals = await rpc<{ id: string; dealer_id: string; action_type: string; params: Record<string, unknown> }[]>(
    'plotmap_ai_claim_approved_actions',
    { p_limit: limit },
  );

  let executed = 0;
  let failed = 0;
  for (const proposal of proposals ?? []) {
    const executor = getExecutor(proposal.action_type);
    if (!executor) {
      // No registered executor means MAPCO cannot perform this action yet.
      // It is recorded as a failure with a precise reason, never as success.
      failed += 1;
      await rpc('plotmap_ai_record_action_result', {
        p_proposal_id: proposal.id,
        p_status: 'failed',
        p_error_message: 'executor_not_registered',
      }).catch(() => undefined);
      continue;
    }
    const context: ActionExecutionContext = { dealerId: proposal.dealer_id, proposalId: proposal.id };
    try {
      const result = await executor(proposal.params ?? {}, context);
      if (result.ok) executed += 1; else failed += 1;
      await rpc('plotmap_ai_record_action_result', {
        p_proposal_id: proposal.id,
        p_status: result.ok ? 'executed' : 'failed',
        p_result: result.result ?? null,
        p_error_message: result.error ?? null,
      });
    } catch (error) {
      failed += 1;
      await rpc('plotmap_ai_record_action_result', {
        p_proposal_id: proposal.id,
        p_status: 'failed',
        p_error_message: error instanceof Error ? error.message : 'execution_error',
      }).catch(() => undefined);
    }
  }

  return { claimed: (proposals ?? []).length, executed, failed };
}

/* ── handler ────────────────────────────────────────────────────── */

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SECURITY_HEADERS });
  if (request.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405, SECURITY_HEADERS);

  // Fail closed when unconfigured: no key means no worker, not an open one.
  if (!WORKER_KEY) return json({ ok: false, reason: 'worker_not_configured' }, 503, SECURITY_HEADERS);
  if (!secretMatches(request.headers.get('x-mapco-worker-key'), WORKER_KEY)) {
    logEvent('warn', 'worker.unauthorized', {});
    return json({ ok: false, reason: 'unauthorized' }, 401, SECURITY_HEADERS);
  }
  if (!backendConfigured()) return json({ ok: false, reason: 'backend_not_configured' }, 503, SECURITY_HEADERS);

  const body = await readJsonBody(request);
  if (!body) return json({ ok: false, reason: 'invalid_body' }, 400, SECURITY_HEADERS);

  const mode = String(body.mode ?? 'jobs');
  const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 25);
  const now = new Date();
  const leaseOwner = `edge-${crypto.randomUUID()}`;
  const startedAt = Date.now();

  try {
    let result: Record<string, unknown>;
    switch (mode) {
      case 'schedule': result = await scheduleDueJobs(now); break;
      case 'jobs': result = await runClaimedJobs(leaseOwner, limit, now); break;
      case 'actions': result = await runApprovedActions(limit); break;
      case 'status':
        result = { routing: routingStatus() };
        break;
      default:
        return json({ ok: false, reason: 'unknown_mode' }, 400, SECURITY_HEADERS);
    }
    logEvent('info', 'worker.completed', { mode, durationMs: Date.now() - startedAt, ...result });
    return json({ ok: true, mode, ...result }, 200, SECURITY_HEADERS);
  } catch (error) {
    logEvent('error', 'worker.failed', {
      mode, detail: error instanceof Error ? error.message : String(error),
    });
    // The response never carries an internal message: callers get a mode
    // and a status, and the detail stays in the redacted server log.
    return json({ ok: false, reason: 'worker_error', mode }, 500, SECURITY_HEADERS);
  }
});
