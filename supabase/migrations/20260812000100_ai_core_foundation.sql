-- ============================================================
-- MAPCO AI · Core foundation
-- ------------------------------------------------------------
-- Introduces the tenant-scoped backbone every future MAPCO AI
-- capability sits on:
--
--   ai_settings        per-dealer enablement (DEFAULT OFF)
--   ai_quotas          per-dealer cost/volume ceilings
--   ai_jobs            idempotent, leased, retryable execution units
--   ai_executions      one row per provider call (audit + cost)
--   ai_usage_daily     incremental per dealer/day/task/model rollup
--
-- Security posture, identical to the rest of MAPCO:
--   • dealer_id is the tenant key, always derived from auth.uid()
--     through plotmap_current_dealer_id(). No RPC accepts a caller
--     supplied dealer id except the service-role worker surface.
--   • RLS enabled on every table; authenticated callers get SELECT
--     on their own rows only. All writes go through SECURITY DEFINER
--     RPCs or the service role inside an Edge Function.
--   • No provider credential is ever stored in the database.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY
-- IF EXISTS only. No drops, deletes or truncates.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. per-dealer AI settings (fails closed) ----------
-- ai_enabled defaults to FALSE so no dealer surface can start showing
-- AI output until it is explicitly switched on for that dealer.
create table if not exists public.ai_settings (
  dealer_id text primary key references public.dealer_settings(dealer_id) on delete cascade,
  ai_enabled boolean not null default false,
  -- Per-capability switches, e.g. {"daily_intelligence": true}.
  -- An absent key means disabled. Home intentionally reads none of these.
  features jsonb not null default '{}'::jsonb,
  data_retention_days integer not null default 400
    check (data_retention_days between 30 and 3650),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_settings_features_size_check
    check (octet_length(features::text) <= 4096)
);

-- ---------- 2. per-dealer quotas ----------
-- Costs are stored as integer micro-USD (1e-6 USD). Never floats.
-- NULL means "use the platform default" resolved in plotmap_ai_quota_state.
create table if not exists public.ai_quotas (
  dealer_id text primary key references public.dealer_settings(dealer_id) on delete cascade,
  daily_cost_limit_micro_usd bigint check (daily_cost_limit_micro_usd >= 0),
  monthly_cost_limit_micro_usd bigint check (monthly_cost_limit_micro_usd >= 0),
  daily_execution_limit integer check (daily_execution_limit >= 0),
  -- Hard stop that ignores every other limit; set by platform operators.
  suspended boolean not null default false,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- ---------- 3. jobs ----------
-- A job is a unit of *intent* ("build this dealer's daily snapshot for
-- 2026-08-12"). It may produce zero, one or several provider executions.
-- (dealer_id, job_type, idempotency_key) is unique, so a retried enqueue
-- can never create a duplicate run.
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  job_type text not null check (job_type in (
    'daily_intelligence',
    'weekly_report',
    'signal_scan',
    'marketing_content_context',
    'marketing_creative',
    'marketing_rotation',
    'external_performance_sync',
    'ad_hoc_query'
  )),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  status text not null default 'queued' check (status in (
    'queued', 'running', 'succeeded', 'failed', 'cancelled', 'skipped'
  )),
  -- Lower runs first. Interactive work uses 10, scheduled batch work 50.
  priority smallint not null default 50 check (priority between 0 and 100),
  scheduled_for timestamptz not null default timezone('utc'::text, now()),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  -- Cooperative lease. A crashed worker's job becomes claimable again
  -- once lease_expires_at passes; no external lock service is required.
  lease_owner text,
  lease_expires_at timestamptz,
  -- Job parameters only (window size, property id, period key…).
  -- The heavy deterministic fact context is NEVER stored here.
  input jsonb not null default '{}'::jsonb,
  context_version text,
  result_artifact_id uuid,
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_jobs_input_size_check check (octet_length(input::text) <= 8192)
);

create unique index if not exists ai_jobs_idempotency_uidx
  on public.ai_jobs (dealer_id, job_type, idempotency_key);

-- The claim query: due, runnable, unleased work ordered by priority.
create index if not exists ai_jobs_claimable_idx
  on public.ai_jobs (status, scheduled_for, priority)
  where status in ('queued', 'running');

create index if not exists ai_jobs_dealer_recent_idx
  on public.ai_jobs (dealer_id, created_at desc);

-- ---------- 4. executions ----------
-- One row per provider call. This is the auditability and cost spine:
-- every generated artifact, recommendation and action can be traced back
-- to the exact provider, model, prompt version and fact digest that made it.
create table if not exists public.ai_executions (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  job_id uuid references public.ai_jobs(id) on delete set null,
  -- Workload identity, deliberately separate from provider/model so a task
  -- can be rerouted to a different model without changing product logic.
  task text not null check (char_length(task) between 1 and 80),
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 120),
  status text not null default 'running' check (status in (
    'running', 'succeeded', 'failed', 'rejected', 'skipped'
  )),
  prompt_version text,
  schema_version text,
  -- sha256 of the deterministic fact context. Identical facts + identical
  -- prompt version ⇒ a stored result may be reused instead of re-calling.
  context_digest text check (context_digest is null or context_digest ~ '^[0-9a-f]{64}$'),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  total_tokens integer check (total_tokens >= 0),
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  latency_ms integer check (latency_ms >= 0),
  -- 'schema_invalid' | 'provider_error' | 'timeout' | 'quota_exceeded' | …
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create index if not exists ai_executions_dealer_recent_idx
  on public.ai_executions (dealer_id, created_at desc);
create index if not exists ai_executions_job_idx
  on public.ai_executions (job_id);
-- Supports "have we already produced this exact result?" reuse lookups.
create index if not exists ai_executions_reuse_idx
  on public.ai_executions (dealer_id, task, context_digest)
  where status = 'succeeded' and context_digest is not null;

-- ---------- 5. daily usage rollup ----------
-- Maintained incrementally by plotmap_ai_complete_execution so cost is
-- always queryable without scanning the execution log.
create table if not exists public.ai_usage_daily (
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  day date not null,
  task text not null,
  provider text not null,
  model text not null,
  executions integer not null default 0 check (executions >= 0),
  failures integer not null default 0 check (failures >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (dealer_id, day, task, provider, model)
);

create index if not exists ai_usage_daily_dealer_day_idx
  on public.ai_usage_daily (dealer_id, day desc);

-- ---------- 6. RLS ----------
alter table public.ai_settings enable row level security;
alter table public.ai_quotas enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.ai_executions enable row level security;
alter table public.ai_usage_daily enable row level security;

revoke all on table public.ai_settings from public, anon, authenticated;
revoke all on table public.ai_quotas from public, anon, authenticated;
revoke all on table public.ai_jobs from public, anon, authenticated;
revoke all on table public.ai_executions from public, anon, authenticated;
revoke all on table public.ai_usage_daily from public, anon, authenticated;

-- Read-only for the dealer's own active members. Writes stay RPC/service-role.
grant select on table public.ai_settings to authenticated;
grant select on table public.ai_quotas to authenticated;
grant select on table public.ai_jobs to authenticated;
grant select on table public.ai_executions to authenticated;
grant select on table public.ai_usage_daily to authenticated;

drop policy if exists "ai settings dealer read" on public.ai_settings;
create policy "ai settings dealer read"
on public.ai_settings for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "ai quotas dealer read" on public.ai_quotas;
create policy "ai quotas dealer read"
on public.ai_quotas for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "ai jobs dealer read" on public.ai_jobs;
create policy "ai jobs dealer read"
on public.ai_jobs for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "ai executions dealer read" on public.ai_executions;
create policy "ai executions dealer read"
on public.ai_executions for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "ai usage dealer read" on public.ai_usage_daily;
create policy "ai usage dealer read"
on public.ai_usage_daily for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

-- ---------- 7. enablement helpers ----------

-- Platform defaults live here, in one place, rather than in application code.
create or replace function public.plotmap_ai_platform_defaults()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'daily_cost_limit_micro_usd', 2000000,      -- USD 2.00 / dealer / day
    'monthly_cost_limit_micro_usd', 30000000,   -- USD 30.00 / dealer / month
    'daily_execution_limit', 300
  );
$$;

-- True only when the dealer is an active, writable account AND AI is on.
create or replace function public.plotmap_ai_is_enabled(p_dealer_id text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.ai_enabled
    from public.ai_settings s
    where s.dealer_id = coalesce(nullif(trim(coalesce(p_dealer_id, '')), ''), public.plotmap_current_dealer_id())
  ), false)
  and public.plotmap_dealer_is_active(
    coalesce(nullif(trim(coalesce(p_dealer_id, '')), ''), public.plotmap_current_dealer_id())
  );
$$;

-- Named capability switch. Absent key ⇒ disabled.
create or replace function public.plotmap_ai_feature_enabled(p_feature text, p_dealer_id text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- jsonb equality rather than a ::boolean cast: a malformed feature value
  -- must read as "disabled", never raise and break the caller.
  select public.plotmap_ai_is_enabled(p_dealer_id)
     and coalesce((
       select (s.features -> p_feature) = 'true'::jsonb
       from public.ai_settings s
       where s.dealer_id = coalesce(nullif(trim(coalesce(p_dealer_id, '')), ''), public.plotmap_current_dealer_id())
     ), false);
$$;

-- ---------- 8. quota state ----------
-- Returns the resolved limits plus current spend so a caller can decide
-- *before* paying for a provider call. Never raises for an unknown dealer.
create or replace function public.plotmap_ai_quota_state(p_dealer_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := coalesce(nullif(trim(coalesce(p_dealer_id, '')), ''), public.plotmap_current_dealer_id());
  v_defaults jsonb := public.plotmap_ai_platform_defaults();
  v_row public.ai_quotas%rowtype;
  v_today date := (timezone('utc'::text, now()))::date;
  v_day_cost bigint := 0;
  v_day_runs bigint := 0;
  v_month_cost bigint := 0;
  v_daily_limit bigint;
  v_monthly_limit bigint;
  v_run_limit bigint;
begin
  if v_dealer = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_dealer');
  end if;

  select * into v_row from public.ai_quotas q where q.dealer_id = v_dealer;

  v_daily_limit := coalesce(v_row.daily_cost_limit_micro_usd, (v_defaults ->> 'daily_cost_limit_micro_usd')::bigint);
  v_monthly_limit := coalesce(v_row.monthly_cost_limit_micro_usd, (v_defaults ->> 'monthly_cost_limit_micro_usd')::bigint);
  v_run_limit := coalesce(v_row.daily_execution_limit, (v_defaults ->> 'daily_execution_limit')::bigint);

  select coalesce(sum(u.cost_micro_usd), 0), coalesce(sum(u.executions), 0)
    into v_day_cost, v_day_runs
    from public.ai_usage_daily u
    where u.dealer_id = v_dealer and u.day = v_today;

  select coalesce(sum(u.cost_micro_usd), 0)
    into v_month_cost
    from public.ai_usage_daily u
    where u.dealer_id = v_dealer and u.day >= date_trunc('month', v_today)::date;

  return jsonb_build_object(
    'ok', true,
    'dealer_id', v_dealer,
    'suspended', coalesce(v_row.suspended, false),
    'enabled', public.plotmap_ai_is_enabled(v_dealer),
    'day', v_today,
    'daily_cost_limit_micro_usd', v_daily_limit,
    'monthly_cost_limit_micro_usd', v_monthly_limit,
    'daily_execution_limit', v_run_limit,
    'day_cost_micro_usd', v_day_cost,
    'day_executions', v_day_runs,
    'month_cost_micro_usd', v_month_cost,
    'allowed', (
      coalesce(v_row.suspended, false) = false
      and v_day_cost < v_daily_limit
      and v_month_cost < v_monthly_limit
      and v_day_runs < v_run_limit
    )
  );
end;
$$;

-- ---------- 9. job lifecycle RPCs ----------

-- Enqueue is idempotent by construction. A second call with the same
-- (job_type, idempotency_key) returns the existing job untouched, so a
-- retried scheduler tick can never double-charge a dealer.
create or replace function public.plotmap_ai_enqueue_job(
  p_dealer_id text,
  p_job_type text,
  p_idempotency_key text,
  p_input jsonb default '{}'::jsonb,
  p_priority smallint default 50,
  p_scheduled_for timestamptz default null,
  p_max_attempts integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_row public.ai_jobs%rowtype;
  v_created boolean := false;
begin
  if v_dealer = '' then raise exception 'dealer_required'; end if;
  if v_key = '' or char_length(v_key) > 200 then raise exception 'invalid_idempotency_key'; end if;
  if octet_length(coalesce(p_input, '{}'::jsonb)::text) > 8192 then raise exception 'input_too_large'; end if;
  if not public.plotmap_ai_is_enabled(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'ai_disabled');
  end if;
  if not (public.plotmap_ai_quota_state(v_dealer) ->> 'allowed')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'quota_exceeded');
  end if;

  insert into public.ai_jobs (
    dealer_id, job_type, idempotency_key, input, priority, scheduled_for, max_attempts
  ) values (
    v_dealer, p_job_type, v_key, coalesce(p_input, '{}'::jsonb),
    least(greatest(coalesce(p_priority, 50), 0), 100),
    coalesce(p_scheduled_for, timezone('utc'::text, now())),
    least(greatest(coalesce(p_max_attempts, 3), 1), 10)
  )
  on conflict (dealer_id, job_type, idempotency_key) do nothing
  returning * into v_row;

  if found then
    v_created := true;
  else
    select * into v_row from public.ai_jobs j
      where j.dealer_id = v_dealer and j.job_type = p_job_type and j.idempotency_key = v_key;
  end if;

  return jsonb_build_object(
    'ok', true, 'created', v_created,
    'job', jsonb_build_object(
      'id', v_row.id, 'status', v_row.status, 'jobType', v_row.job_type,
      'scheduledFor', v_row.scheduled_for, 'attempts', v_row.attempts
    )
  );
end;
$$;

-- Claim up to p_limit due jobs for a worker, taking a time-bounded lease.
-- SKIP LOCKED means several workers can run concurrently without ever
-- handing the same job to two of them.
create or replace function public.plotmap_ai_claim_jobs(
  p_lease_owner text,
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns setof public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text := trim(coalesce(p_lease_owner, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 25);
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 3600);
  v_now timestamptz := timezone('utc'::text, now());
begin
  if v_owner = '' then raise exception 'lease_owner_required'; end if;

  return query
  with claimable as (
    select j.id
    from public.ai_jobs j
    where j.scheduled_for <= v_now
      and j.attempts < j.max_attempts
      and (
        j.status = 'queued'
        -- Reclaim work abandoned by a worker that died mid-run.
        or (j.status = 'running' and (j.lease_expires_at is null or j.lease_expires_at < v_now))
      )
      and public.plotmap_ai_is_enabled(j.dealer_id)
    order by j.priority asc, j.scheduled_for asc
    limit v_limit
    for update skip locked
  )
  update public.ai_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         lease_owner = v_owner,
         lease_expires_at = v_now + make_interval(secs => v_lease),
         started_at = coalesce(j.started_at, v_now),
         updated_at = v_now
   from claimable c
  where j.id = c.id
  returning j.*;
end;
$$;

-- Terminal transition for a job. Releases the lease in every outcome.
create or replace function public.plotmap_ai_complete_job(
  p_job_id uuid,
  p_status text,
  p_result_artifact_id uuid default null,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_in_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ai_jobs%rowtype;
  v_now timestamptz := timezone('utc'::text, now());
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if v_status not in ('succeeded', 'failed', 'cancelled', 'skipped', 'queued') then
    raise exception 'invalid_status';
  end if;
  select * into v_row from public.ai_jobs j where j.id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  -- 'queued' is the retry path: the worker gives the job back with a delay.
  if v_status = 'queued' and v_row.attempts >= v_row.max_attempts then
    v_status := 'failed';
  end if;

  update public.ai_jobs
     set status = v_status,
         result_artifact_id = coalesce(p_result_artifact_id, result_artifact_id),
         error_code = nullif(left(coalesce(p_error_code, ''), 80), ''),
         error_message = nullif(left(coalesce(p_error_message, ''), 500), ''),
         lease_owner = null,
         lease_expires_at = null,
         scheduled_for = case
           when v_status = 'queued'
             then v_now + make_interval(secs => least(greatest(coalesce(p_retry_in_seconds, 120), 10), 86400))
           else scheduled_for
         end,
         completed_at = case when v_status in ('succeeded', 'failed', 'cancelled', 'skipped') then v_now else null end,
         updated_at = v_now
   where id = p_job_id;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- ---------- 10. execution lifecycle RPCs ----------

create or replace function public.plotmap_ai_start_execution(
  p_dealer_id text,
  p_task text,
  p_provider text,
  p_model text,
  p_job_id uuid default null,
  p_prompt_version text default null,
  p_schema_version text default null,
  p_context_digest text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_id uuid;
begin
  if v_dealer = '' then raise exception 'dealer_required'; end if;
  if not public.plotmap_ai_is_enabled(v_dealer) then raise exception 'ai_disabled'; end if;
  if not (public.plotmap_ai_quota_state(v_dealer) ->> 'allowed')::boolean then raise exception 'quota_exceeded'; end if;

  insert into public.ai_executions (
    dealer_id, job_id, task, provider, model, status,
    prompt_version, schema_version, context_digest
  ) values (
    v_dealer, p_job_id,
    left(trim(coalesce(p_task, 'unknown')), 80),
    left(trim(coalesce(p_provider, 'unknown')), 40),
    left(trim(coalesce(p_model, 'unknown')), 120),
    'running',
    nullif(left(trim(coalesce(p_prompt_version, '')), 40), ''),
    nullif(left(trim(coalesce(p_schema_version, '')), 40), ''),
    case when p_context_digest ~ '^[0-9a-f]{64}$' then p_context_digest else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Closing an execution also updates the daily usage rollup in the same
-- transaction, so cost visibility never depends on a separate batch job.
create or replace function public.plotmap_ai_complete_execution(
  p_execution_id uuid,
  p_status text,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_cost_micro_usd bigint default 0,
  p_latency_ms integer default null,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ai_executions%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_now timestamptz := timezone('utc'::text, now());
  v_cost bigint := greatest(coalesce(p_cost_micro_usd, 0), 0);
  v_in bigint := greatest(coalesce(p_input_tokens, 0), 0);
  v_out bigint := greatest(coalesce(p_output_tokens, 0), 0);
begin
  if v_status not in ('succeeded', 'failed', 'rejected', 'skipped') then
    raise exception 'invalid_status';
  end if;

  update public.ai_executions
     set status = v_status,
         input_tokens = coalesce(p_input_tokens, input_tokens),
         output_tokens = coalesce(p_output_tokens, output_tokens),
         total_tokens = coalesce(p_input_tokens, 0) + coalesce(p_output_tokens, 0),
         cost_micro_usd = v_cost,
         latency_ms = coalesce(p_latency_ms, latency_ms),
         error_code = nullif(left(coalesce(p_error_code, ''), 80), ''),
         error_message = nullif(left(coalesce(p_error_message, ''), 500), ''),
         completed_at = v_now
   where id = p_execution_id
   returning * into v_row;

  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  insert into public.ai_usage_daily as u (
    dealer_id, day, task, provider, model,
    executions, failures, input_tokens, output_tokens, cost_micro_usd, updated_at
  ) values (
    v_row.dealer_id, (v_row.created_at at time zone 'utc')::date,
    v_row.task, v_row.provider, v_row.model,
    1, case when v_status = 'succeeded' then 0 else 1 end,
    v_in, v_out, v_cost, v_now
  )
  on conflict (dealer_id, day, task, provider, model) do update set
    executions = u.executions + 1,
    failures = u.failures + case when v_status = 'succeeded' then 0 else 1 end,
    input_tokens = u.input_tokens + v_in,
    output_tokens = u.output_tokens + v_out,
    cost_micro_usd = u.cost_micro_usd + v_cost,
    updated_at = v_now;

  return jsonb_build_object('ok', true, 'status', v_status, 'costMicroUsd', v_cost);
end;
$$;

-- ---------- 11. dealer-facing read RPCs ----------

-- Compact status the dealer app can render without touching provider
-- internals. Safe when AI has never run: every field has a real zero.
create or replace function public.plotmap_ai_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_quota jsonb;
  v_features jsonb;
  v_pending integer := 0;
  v_failed integer := 0;
begin
  if v_dealer = '' or not public.plotmap_is_active_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select coalesce(s.features, '{}'::jsonb) into v_features
    from public.ai_settings s where s.dealer_id = v_dealer;

  select
    count(*) filter (where j.status in ('queued', 'running')),
    count(*) filter (where j.status = 'failed')
    into v_pending, v_failed
    from public.ai_jobs j
    where j.dealer_id = v_dealer
      and j.created_at > timezone('utc'::text, now()) - interval '7 days';

  v_quota := public.plotmap_ai_quota_state(v_dealer);

  return jsonb_build_object(
    'ok', true,
    -- The caller's own dealer id, derived from auth.uid(). Server-side
    -- callers use this instead of ever accepting a dealer id as input.
    'dealerId', v_dealer,
    'enabled', public.plotmap_ai_is_enabled(v_dealer),
    'features', coalesce(v_features, '{}'::jsonb),
    'pendingJobs', v_pending,
    'failedJobs', v_failed,
    'quota', v_quota
  );
end;
$$;

-- Usage/cost the dealer (or an operator) may inspect. Own dealer only.
create or replace function public.plotmap_ai_usage_summary(p_days integer default 30)
returns table (
  day date, task text, provider text, model text,
  executions integer, failures integer,
  input_tokens bigint, output_tokens bigint, cost_micro_usd bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select u.day, u.task, u.provider, u.model, u.executions, u.failures,
         u.input_tokens, u.output_tokens, u.cost_micro_usd
  from public.ai_usage_daily u
  where u.dealer_id = public.plotmap_current_dealer_id()
    and public.plotmap_is_active_member()
    and u.day >= (timezone('utc'::text, now()))::date - least(greatest(coalesce(p_days, 30), 1), 365)
  order by u.day desc, u.cost_micro_usd desc;
$$;

-- ---------- 12. platform-operator write RPCs ----------

create or replace function public.plotmap_ai_admin_set_settings(
  p_dealer_id text,
  p_ai_enabled boolean,
  p_features jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
begin
  if not public.plotmap_is_platform_admin() then raise exception 'platform admin required'; end if;
  if v_dealer = '' then raise exception 'dealer_required'; end if;
  if octet_length(coalesce(p_features, '{}'::jsonb)::text) > 4096 then raise exception 'features_too_large'; end if;
  if not exists (select 1 from public.dealer_settings d where d.dealer_id = v_dealer) then
    raise exception 'unknown dealer';
  end if;

  insert into public.ai_settings (dealer_id, ai_enabled, features, updated_at)
  values (v_dealer, coalesce(p_ai_enabled, false), coalesce(p_features, '{}'::jsonb), timezone('utc'::text, now()))
  on conflict (dealer_id) do update set
    ai_enabled = excluded.ai_enabled,
    features = coalesce(p_features, public.ai_settings.features),
    updated_at = excluded.updated_at;

  insert into public.audit_logs (dealer_id, actor_profile_id, actor_role, action_type, entity_type, entity_id, metadata)
  values (v_dealer, auth.uid(), public.plotmap_current_role(), 'ai.settings.updated', 'ai_settings', v_dealer,
          jsonb_build_object('aiEnabled', coalesce(p_ai_enabled, false)));

  return jsonb_build_object('ok', true, 'dealerId', v_dealer, 'aiEnabled', coalesce(p_ai_enabled, false));
end;
$$;

create or replace function public.plotmap_ai_admin_set_quota(
  p_dealer_id text,
  p_daily_cost_limit_micro_usd bigint default null,
  p_monthly_cost_limit_micro_usd bigint default null,
  p_daily_execution_limit integer default null,
  p_suspended boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
begin
  if not public.plotmap_is_platform_admin() then raise exception 'platform admin required'; end if;
  if v_dealer = '' then raise exception 'dealer_required'; end if;

  insert into public.ai_quotas (
    dealer_id, daily_cost_limit_micro_usd, monthly_cost_limit_micro_usd,
    daily_execution_limit, suspended, updated_at
  ) values (
    v_dealer, p_daily_cost_limit_micro_usd, p_monthly_cost_limit_micro_usd,
    p_daily_execution_limit, coalesce(p_suspended, false), timezone('utc'::text, now())
  )
  on conflict (dealer_id) do update set
    daily_cost_limit_micro_usd = excluded.daily_cost_limit_micro_usd,
    monthly_cost_limit_micro_usd = excluded.monthly_cost_limit_micro_usd,
    daily_execution_limit = excluded.daily_execution_limit,
    suspended = excluded.suspended,
    updated_at = excluded.updated_at;

  insert into public.audit_logs (dealer_id, actor_profile_id, actor_role, action_type, entity_type, entity_id, metadata)
  values (v_dealer, auth.uid(), public.plotmap_current_role(), 'ai.quota.updated', 'ai_quotas', v_dealer,
          jsonb_build_object('suspended', coalesce(p_suspended, false)));

  return public.plotmap_ai_quota_state(v_dealer);
end;
$$;

-- ---------- 13. scheduler support (service role) ----------
-- The set of dealers a scheduled tick should consider. Returning only
-- enabled, writable accounts means the scheduler cannot accidentally
-- enqueue work — and therefore cost — for a suspended or AI-off dealer.
create or replace function public.plotmap_ai_enabled_dealers(p_limit integer default 500)
returns table (dealer_id text, features jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select s.dealer_id, s.features
  from public.ai_settings s
  where s.ai_enabled
    and public.plotmap_dealer_is_active(s.dealer_id)
    and coalesce((select q.suspended from public.ai_quotas q where q.dealer_id = s.dealer_id), false) = false
  order by s.dealer_id
  limit least(greatest(coalesce(p_limit, 500), 1), 5000);
$$;

-- ---------- 14. grants ----------
-- Read helpers: authenticated. Worker/lifecycle RPCs: service_role only —
-- they take a dealer id argument and must never be callable from a browser.

revoke all on function public.plotmap_ai_platform_defaults() from public, anon, authenticated;
revoke all on function public.plotmap_ai_is_enabled(text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_feature_enabled(text, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_quota_state(text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_status() from public, anon, authenticated;
revoke all on function public.plotmap_ai_usage_summary(integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_enqueue_job(text, text, text, jsonb, smallint, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_claim_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_complete_job(uuid, text, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_start_execution(text, text, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_complete_execution(uuid, text, integer, integer, bigint, integer, text, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_admin_set_settings(text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.plotmap_ai_admin_set_quota(text, bigint, bigint, integer, boolean) from public, anon, authenticated;
revoke all on function public.plotmap_ai_enabled_dealers(integer) from public, anon, authenticated;

grant execute on function public.plotmap_ai_status() to authenticated;
grant execute on function public.plotmap_ai_usage_summary(integer) to authenticated;
-- Platform-admin RPCs self-check plotmap_is_platform_admin() internally.
grant execute on function public.plotmap_ai_admin_set_settings(text, boolean, jsonb) to authenticated;
grant execute on function public.plotmap_ai_admin_set_quota(text, bigint, bigint, integer, boolean) to authenticated;

grant execute on function public.plotmap_ai_platform_defaults() to service_role;
grant execute on function public.plotmap_ai_is_enabled(text) to service_role;
grant execute on function public.plotmap_ai_feature_enabled(text, text) to service_role;
grant execute on function public.plotmap_ai_quota_state(text) to service_role;
grant execute on function public.plotmap_ai_enqueue_job(text, text, text, jsonb, smallint, timestamptz, integer) to service_role;
grant execute on function public.plotmap_ai_claim_jobs(text, integer, integer) to service_role;
grant execute on function public.plotmap_ai_complete_job(uuid, text, uuid, text, text, integer) to service_role;
grant execute on function public.plotmap_ai_start_execution(text, text, text, text, uuid, text, text, text) to service_role;
grant execute on function public.plotmap_ai_complete_execution(uuid, text, integer, integer, bigint, integer, text, text) to service_role;
grant execute on function public.plotmap_ai_enabled_dealers(integer) to service_role;
