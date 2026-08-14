// MAPCO AI · Authenticated dealer request surface
// ---------------------------------------------------------------
// The interactive counterpart to ai-worker. It exists so a dealer-facing
// feature never needs a provider key in the browser and never needs its
// own bespoke AI plumbing.
//
// Tenancy rule: the dealer id is NEVER taken from the request. It is read
// back from plotmap_ai_status() executed under the caller's own JWT, so a
// caller can only ever act on the dealer their session belongs to.
//
// Two intents:
//   ask      run a grounded question against the caller's own facts
//   enqueue  queue background work for the caller's own dealer
//
// No dealer surface calls this yet. It is the door the Ask MAPCO and AI
// Action Queue phases open — not a feature switched on here.

import { rpc, resolveCaller, backendConfigured } from '../_shared/db.ts';
import { allowedOrigins, corsHeaders, json, readJsonBody } from '../_shared/http.ts';
import { logEvent } from '../_shared/redact.ts';
import { runTask } from '../_shared/ai/service.ts';

const ORIGINS = allowedOrigins('MAPCO_AI_ALLOWED_ORIGINS');

/** Job types a browser session may queue for itself. */
const ENQUEUEABLE = new Set(['daily_intelligence', 'weekly_report', 'signal_scan', 'marketing_content_context']);

interface AiStatus {
  ok?: boolean;
  dealerId?: string;
  enabled?: boolean;
  quota?: { allowed?: boolean };
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin');
  const clean = String(origin || '').replace(/\/$/, '');
  const headers = corsHeaders(origin, ORIGINS);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405, headers);
  if (ORIGINS.size === 0) return json({ ok: false, reason: 'unavailable' }, 503, headers);
  if (!origin || !ORIGINS.has(clean)) return json({ ok: false, reason: 'unavailable' }, 403, headers);
  if (!backendConfigured()) return json({ ok: false, reason: 'unavailable' }, 503, headers);

  const caller = await resolveCaller(request);
  if (!caller) return json({ ok: false, reason: 'unauthorized' }, 401, headers);

  const body = await readJsonBody(request);
  if (!body) return json({ ok: false, reason: 'invalid_body' }, 400, headers);

  // Identity, enablement and quota resolved under the caller's own session.
  let status: AiStatus;
  try {
    status = await rpc<AiStatus>('plotmap_ai_status', {}, { accessToken: caller.accessToken });
  } catch {
    return json({ ok: false, reason: 'unavailable' }, 503, headers);
  }
  const dealerId = String(status?.dealerId ?? '');
  if (status?.ok !== true || !dealerId) return json({ ok: false, reason: 'unauthorized' }, 401, headers);
  // A disabled dealer gets a clean, typed refusal — never a fabricated answer.
  if (status.enabled !== true) return json({ ok: false, reason: 'ai_disabled' }, 200, headers);
  if (status.quota?.allowed !== true) return json({ ok: false, reason: 'quota_exceeded' }, 200, headers);

  const intent = String(body.intent ?? '');

  if (intent === 'ask') {
    const question = String(body.question ?? '').trim().slice(0, 500);
    if (question.length < 3) return json({ ok: false, reason: 'invalid_question' }, 400, headers);
    const windowDays = Math.min(Math.max(Number(body.windowDays ?? 7), 1), 90);

    const result = await runTask({
      dealerId,
      taskId: 'ask_mapco',
      periodKey: 'ad-hoc',
      question,
      windowDays,
      // Not stored as an artifact: an ad-hoc answer is a conversation, not
      // a dealer record. The execution row still captures provider, model,
      // fact digest and cost, so the run remains fully auditable.
      persist: false,
    });

    if (!result.ok) {
      logEvent('warn', 'ai-run.ask.failed', { dealerId, reason: result.reason });
      return json({ ok: false, reason: result.reason, retryable: result.retryable }, 200, headers);
    }
    return json({ ok: true, answer: result.payload, costMicroUsd: result.costMicroUsd }, 200, headers);
  }

  if (intent === 'enqueue') {
    const jobType = String(body.jobType ?? '');
    if (!ENQUEUEABLE.has(jobType)) return json({ ok: false, reason: 'unsupported_job_type' }, 400, headers);
    const idempotencyKey = String(body.idempotencyKey ?? '').trim().slice(0, 200);
    if (!idempotencyKey) return json({ ok: false, reason: 'idempotency_key_required' }, 400, headers);

    const input = body.input && typeof body.input === 'object' && !Array.isArray(body.input)
      ? body.input as Record<string, unknown>
      : {};

    try {
      // Enqueued with the SERVER-derived dealer id, never the request's.
      const queued = await rpc<Record<string, unknown>>('plotmap_ai_enqueue_job', {
        p_dealer_id: dealerId,
        p_job_type: jobType,
        p_idempotency_key: idempotencyKey,
        p_input: input,
        p_priority: 20,
        p_max_attempts: 3,
      });
      return json({ ok: queued?.ok === true, ...(queued ?? {}) }, 200, headers);
    } catch {
      return json({ ok: false, reason: 'unavailable' }, 503, headers);
    }
  }

  return json({ ok: false, reason: 'unknown_intent' }, 400, headers);
});
