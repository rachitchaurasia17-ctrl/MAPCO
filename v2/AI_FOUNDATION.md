# MAPCO AI Foundation

Last updated: **2026-08-12 (Asia/Calcutta)** · Branch: **`feat/mapco-v2-backend`**

This document describes the AI backbone added to MAPCO. It is an **architecture
delivery**: the secure, multi-tenant, cost-aware machinery that the next wave of
features is built on. Almost no dealer-facing AI is switched on, and none is on
by default.

> **Dealer Home is untouched.** `src/apps/dealer/pages/home.ts` still renders the
> same real data from `demandSignals`, `clientLinks` and `properties`. It imports
> nothing from `packages/ai`, never calls `adapter.ai`, and contains no AI copy.
> `tests/ai-foundation.test.ts` fails the build if that ever changes.

---

## 1. Architecture found

| Layer | What exists |
|---|---|
| Frontend | Vanilla TypeScript + Vite multi-page app. 14 HTML entries, apps under `src/apps/*`, shared libraries under `src/packages/*`. No React, no SSR. |
| Data boundary | `DataAdapterV2` (`src/packages/data/contracts.ts`), mode-switched in `adapter.ts` between a mock adapter (dev/test) and the Supabase adapter. Screens depend on the interface only. |
| Backend | Supabase (MAPCO-DEV). Postgres with RLS on every tenant table, privileged work behind `SECURITY DEFINER` RPCs named `plotmap_*`. Tenancy key is `dealer_id text`, always resolved through `plotmap_current_dealer_id()` from `auth.uid()`. |
| Server runtime | Supabase Edge Functions (Deno) — the only place a service-role key or any secret may live. `resolve-client-link`, `provision-dealer`, `delete-dealer`. |
| Deployment | Static Vercel build for the frontend. **There is no Node server**, so any AI provider call had to go into an Edge Function. |
| Analytics already present | `presentation_events` (anonymous, RPC-written), `client_link_events` (anonymous, token-scoped), `predictive_usage_events` / `predictive_transition_summaries` (dealer operator telemetry), `plotmap_daily_usage` (platform-admin rollup). |
| Background jobs | **None.** No cron, no queue, no worker. This was the largest gap. |

Two existing conventions shaped every decision: **tables are locked down and
reads go through policies; writes go through RPCs**, and **the browser holds
only the anon key**. The AI layer follows both rather than inventing a new
posture.

---

## 2. Architecture introduced

```
 dealer browser                    Supabase Postgres                  Edge (Deno)
 ─────────────                     ─────────────────                  ───────────
 adapter.ai  ──RPC──►  plotmap_ai_status / _current_artifact
 (read-only)           _artifact_history / _usage_summary
                       _pending_actions / _decide_action
                       _context_facts            ▲
                                                 │ service role only
                            ai_jobs ─────────────┼──── ai-worker
                            ai_executions        │      • claim leased jobs
                            ai_usage_daily       │      • run task
                            ai_artifacts         │      • store artifact
                            ai_action_proposals  │      • execute approved actions
                            ai_action_audit      │
                            marketing_*          └──── ai-run (authenticated)
                            external_performance_metrics    • ask / enqueue

                       plotmap_ai_context_facts_for  ──►  AI service
                       (deterministic facts, no PII)      ├─ router  (cost class → provider/model)
                                                          ├─ prompts (versioned, single source)
                                                          ├─ schema  (generate + re-validate)
                                                          └─ provider (OpenAI today)
                                                                    │
                                                                    ▼
                                                             provider API
```

The separation the brief asked for, made structural:

- **Database owns facts** — `plotmap_ai_context_facts_for` computes every total,
  ranking, comparison and delta in SQL.
- **MAPCO analytics owns calculations** — nothing numeric is asked of a model.
- **AI owns interpretation** — the model receives a bounded JSON fact object and
  returns a validated structured shape.
- **MAPCO owns actions and UI** — the model can only *request* a named action
  from a catalog; MAPCO validates, gates on approval, executes and audits.

---

## 3. Files created

### Database — `supabase/migrations/`

| File | Contents |
|---|---|
| `20260812000100_ai_core_foundation.sql` | `ai_settings`, `ai_quotas`, `ai_jobs`, `ai_executions`, `ai_usage_daily` + enablement, quota, job-lifecycle and execution-lifecycle RPCs. |
| `20260812000200_ai_artifacts_and_actions.sql` | `ai_artifacts` (versioned structured output), `ai_action_proposals`, `ai_action_audit` + store/read/propose/decide/record RPCs. |
| `20260812000300_ai_context_builder.sql` | `plotmap_ai_context_facts_for` / `_facts` / `_facts_digest` — the deterministic, privacy-scoped fact projection. |
| `20260812000400_marketing_foundation.sql` | `marketing_content_contexts`, `marketing_creatives`, `marketing_schedule_items`, `marketing_publications`, `marketing_channel_accounts`, `external_performance_metrics`, marketing fact builder, and an extended `plotmap_admin_delete_dealer`. |

### Edge runtime — `supabase/functions/`

| File | Role |
|---|---|
| `_shared/http.ts` | CORS/origin allow-list, bounded bodies, constant-time secret compare. |
| `_shared/db.ts` | Named-RPC-only Supabase access. No generic query surface exists. |
| `_shared/redact.ts` | Log redaction (keys, JWTs, tokens, signed URLs, phones, emails). |
| `_shared/ai/schema.ts` | Schema DSL → strict JSON Schema **and** an independent validator. |
| `_shared/ai/schemas.ts` | Canonical v1 output schemas for every workload. |
| `_shared/ai/provider.ts` | `AiProvider` interface and shared error classification. |
| `_shared/ai/providers/openai.ts` | First provider. The only file that names a vendor. |
| `_shared/ai/providers/index.ts` | Provider registry. |
| `_shared/ai/router.ts` | Cost class → provider/model, with failover and env override. |
| `_shared/ai/tasks.ts` | Task catalog: purpose, output schema, cost class, prompt version, reuse window. |
| `_shared/ai/prompts.ts` | Every prompt, once. |
| `_shared/ai/context.ts` | Fact fetch + identity scrub + byte budget + digest. |
| `_shared/ai/tools.ts` | Controlled action catalog, parameter validation, executor registry. |
| `_shared/ai/service.ts` | The orchestrator: gate → context → reuse → route → call → validate → meter → store. |
| `ai-worker/index.ts` | Scheduled/background worker (`schedule`, `jobs`, `actions`, `status`). |
| `ai-run/index.ts` | Authenticated dealer request surface (`ask`, `enqueue`). |

### Frontend — `v2/src/`

| File | Role |
|---|---|
| `packages/ai/types.ts` | Read-side domain types + `AI_SCHEMA_VERSION`. |
| `packages/ai/guards.ts` | Render-side validation; malformed payload → `null`, never a throw. |
| `packages/ai/contracts.ts` | `AiRepository` interface and the `AiAvailability` vocabulary. |
| `packages/ai/availability.ts` | `withAiFallback` — the timeout + containment boundary. |
| `packages/ai/index.ts` | Barrel. |
| `packages/data/supabase/ai-repository.ts` | Supabase implementation. |
| `packages/data/mock-ai-repository.ts` | Mock implementation that produces **no AI content**. |
| `apps/ai-console/main.ts`, `admin/ai-console.html` | Internal operations console. |
| `tests/ai-foundation.test.ts` | 64 tests covering all of the above. |

### Changed

- `packages/data/contracts.ts` — added `readonly ai: AiRepository` to `DataAdapterV2`.
- `packages/data/supabase/supabase-adapter.ts`, `packages/data/mock-adapter-v2.ts` — wired the two implementations.
- `vite.config.ts` — added the `ai-console` entry.

Nothing else was modified. No existing behaviour was refactored.

---

## 4. Security model

1. **Tenancy is never a parameter from the browser.** Every dealer-facing RPC
   derives `dealer_id` from `auth.uid()`. The functions that *do* take a dealer id
   (`plotmap_ai_context_facts_for`, `_marketing_facts_for`, `_enqueue_job`,
   `_claim_jobs`, `_start_execution`, `_store_artifact`, `_propose_action`,
   `_enabled_dealers`) are revoked from `anon` and `authenticated` and granted
   only to `service_role`. A test asserts this for each of them.
2. **RLS on every new table**, with `revoke all … from public, anon, authenticated`
   and a dealer-scoped `select` policy requiring `plotmap_is_active_member()`.
   All writes go through `SECURITY DEFINER` RPCs or the service role.
3. **Dealers read published artifacts only.** Drafts, superseded versions and
   failed generations stay internal.
4. **No secret in the browser, and none in the database.** The provider key is
   read in exactly one file (`providers/openai.ts`) inside the Edge runtime.
   `marketing_channel_accounts` stores a `credential_ref` *name*, never a token,
   and that column is excluded from the browser-readable column grant.
5. **Model has no database access.** No SQL is generated, sent or executed. The
   only write paths are the named RPCs, all called by MAPCO's own code.
6. **The context contains no identity.** The SQL projection is allow-listed, and
   `context.ts` independently strips identity-shaped keys before any send. Two
   layers, so the guarantee does not rest on one implementation.
7. **Anonymity is stated in the payload.** Facts carry
   `identity.presentationVisitorsIdentified: false` and an explicit note, and the
   system prompt forbids attributing activity to a person.
8. **Approval floor is a database constraint**, not a convention:
   `check (risk = 'internal' or requires_approval = true)`. External and
   consequential actions cannot be marked auto-executable.
9. **Action history is append-only.** `ai_action_audit` has no update or delete
   policy.
10. **Dealer purge covers everything.** All new tables cascade from
    `dealer_settings` and are listed in `plotmap_admin_delete_dealer` so the
    deletion summary stays complete.

---

## 5. Provider abstraction

Five concepts are separated, exactly as the brief specified:

| Concept | Where it lives |
|---|---|
| Provider | `providers/*.ts` implementing `AiProvider`. |
| Model | Chosen by `router.ts` at call time. |
| Task / purpose | `tasks.ts` — a workload, not a model. |
| Context builder | `context.ts` + the SQL fact functions. |
| Structured response | `schema.ts` + `schemas.ts`. |
| Usage / cost | `pricing.ts` → `ai_executions` → `ai_usage_daily`. |
| Execution status | `ai_executions.status`, `ai_jobs.status`. |

Routing is by **cost class** (`cheap` / `standard` / `deep`), so the weekly deep
review and a marketing headline can run on different models without touching a
prompt, schema, table or screen. `MAPCO_AI_ROUTES` overrides the table as JSON,
making a reroute a configuration change. If a call fails retryably, the service
fails over to the next candidate in place. Adding a provider is one file plus one
registry line.

`MAPCO_AI_PRICING` overrides rates the same way. Unknown models fall back to a
deliberately pessimistic rate — unmetered must never look free.

---

## 6. Job and execution architecture

- **`ai_jobs`** is intent. `(dealer_id, job_type, idempotency_key)` is unique, so
  a scheduler that double-fires, retries or overlaps cannot create duplicate work.
  For periodic jobs the **period is the key** (`2026-08-12`, `2026-W33`).
- **Leasing, not locking.** A claim sets `status='running'` with a
  `lease_expires_at`; a crashed worker's job becomes claimable again when the
  lease passes. `FOR UPDATE SKIP LOCKED` lets several workers run concurrently.
- **Retries are explicit.** `attempts`/`max_attempts` with a delayed re-queue;
  once attempts are exhausted the job moves to `failed` with a reason.
- **`ai_executions`** is one row per provider call: task, provider, model, prompt
  version, schema version, fact digest, tokens, cost, latency, error. This is the
  audit and cost spine.
- **`ai_usage_daily`** is updated inside the same transaction that closes an
  execution, so cost is queryable without a batch job — including for failed
  calls that still burned tokens.

The worker is scheduler-agnostic. Trigger `ai-worker` from Supabase cron, an
external cron, Vercel, or CI with the shared key:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-worker" -H "x-mapco-worker-key: $MAPCO_AI_WORKER_KEY" -H 'content-type: application/json' -d '{"mode":"schedule"}'
```

Then `{"mode":"jobs","limit":5}` to run claimed work and `{"mode":"actions"}` to
execute approved proposals. A sensible cadence is `schedule` hourly, `jobs` every
few minutes, `actions` every few minutes.

---

## 7. Data and context flow

```
presentation_events ─┐
client_link_events  ─┤
share_links         ─┼─►  plotmap_ai_context_facts_for(dealer, window)
crm_records         ─┤     • totals, per-area / per-sector / per-property counts
prebuilt_maps       ─┘     • current window vs previous window of equal length
                           • inventory metadata, coverage gaps, zero-engagement stock
                           • NO name, phone, owner, seller, note, token or session id
                                    │
                                    ▼
                     context.ts  scrub identity keys → cap arrays to a 24 KB
                                 budget → sha256 digest
                                    │
                                    ▼
                     reuse check: identical digest within the task's reuse window
                                  ⇒ return the stored artifact, spend nothing
                                    │
                                    ▼
                     router → provider (strict JSON Schema at generation)
                                    │
                                    ▼
                     MAPCO re-validates → meters cost → stores a new artifact
                     version and supersedes the previous one
                                    │
                                    ▼
                     adapter.ai (read) → guards.ts re-validates → MAPCO renders
```

Cost control is built into the path, not bolted on: capability flags gate whether
a job is even enqueued, quotas are checked before an execution row is created,
identical facts skip the call entirely, artifacts are stored rather than
regenerated on view, and array caps bound the maximum size of any single request.

---

## 8. What is implemented now

- Full schema, RLS, RPCs and migrations for AI settings, quotas, jobs,
  executions, usage, artifacts, actions, audit, marketing and external
  performance.
- Working deterministic context builder over real MAPCO data.
- Working provider abstraction with routing, failover, cost metering and an
  OpenAI implementation.
- Working structured-output pipeline: strict schema at generation, independent
  re-validation before storage, independent re-validation before render.
- Working job system: idempotent enqueue, leased claim, retry, terminal states.
- Working background worker with `schedule` / `jobs` / `actions` / `status`.
- Working authenticated request surface for grounded questions and self-enqueue.
- Working action pipeline up to execution: catalog, validation, risk-based
  approval gate, dealer decision, append-only audit.
- `AiRepository` on `DataAdapterV2` with both implementations.
- Internal AI Operations console at `/admin/ai-console.html`.
- 64 new tests; 278 total passing, typecheck and production build clean.

## 9. What is intentionally only prepared

- **Every dealer-facing AI surface.** Daily Intelligence, Weekly Review, Signals,
  Ask MAPCO and the Action Queue have contracts, storage and generation — and no
  screen. Home in particular is untouched.
- **AI is off for every dealer.** `ai_settings.ai_enabled` defaults to `false`,
  and each capability needs its own flag. Nothing runs until a platform operator
  switches it on.
- **Action executors.** The registry in `tools.ts` is deliberately empty. An
  approved action with no executor is recorded as `failed / executor_not_registered`
   — never as done. Registering one function switches an action on.
- **Marketing rendering and publishing.** Tables, content-context freezing and
  copy generation exist. Design selection, image composition and channel APIs do
  not; `marketing_rotation` and `external_performance_sync` jobs return
  `skipped / pipeline_not_implemented`.
- **External performance ingestion.** The provider-neutral table and ingest RPC
  exist. No connector is faked.

## 10. Configuration

New **Edge secrets** (Supabase → Edge Functions). Nothing is added to Vite or
Vercel, so no new value reaches the browser.

| Secret | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | to generate | Provider credential. Without it the router reports no provider and jobs fail cleanly. |
| `MAPCO_AI_WORKER_KEY` | to run the worker | Shared secret for `ai-worker`. Absent ⇒ the worker refuses every request. |
| `MAPCO_AI_ALLOWED_ORIGINS` | for `ai-run` | Comma-separated origin allow-list. Empty ⇒ `ai-run` is unavailable. |
| `MAPCO_AI_ROUTES` | optional | JSON routing override per cost class. |
| `MAPCO_AI_PRICING` | optional | JSON rate override in micro-USD per million tokens. |
| `OPENAI_BASE_URL` | optional | Alternate/compatible endpoint. |

Enabling a dealer (platform admin only):

```sql
select plotmap_ai_admin_set_settings('<dealer_id>', true, '{"signals": true}'::jsonb);
select plotmap_ai_admin_set_quota('<dealer_id>', 2000000, 30000000, 300, false);
```

## 11. Recommended next step

**Turn on exactly one capability, for one dealer, end to end — `signal_scan`.**

It is the cheapest task, its output is the smallest schema, and it exercises
every part of the foundation: enablement, scheduling, leasing, context building,
routing, validation, metering, storage and versioning.

1. Set the Edge secrets and deploy `ai-worker` and `ai-run`.
2. Apply the four migrations to MAPCO-DEV.
3. Enable AI for the demo dealer with `{"signals": true}` only.
4. Trigger `{"mode":"schedule"}` then `{"mode":"jobs"}`.
5. Open `/admin/ai-console.html` and confirm: one execution, a real cost, one
   stored `signal_set` artifact, and a fact object in the Context inspector that
   contains no customer, owner or seller data.
6. Re-run `{"mode":"jobs"}` and confirm the idempotency key prevents a second
   run, and that unchanged facts reuse the artifact at zero cost.

Only after that run is clean should a dealer-facing surface be designed — and the
Home redesign should stay a separate piece of work, after the surfaces that do
not carry the dashboard's risk.
