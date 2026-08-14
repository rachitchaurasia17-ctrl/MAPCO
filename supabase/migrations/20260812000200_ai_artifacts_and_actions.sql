-- ============================================================
-- MAPCO AI · Structured artifacts and controlled actions
-- ------------------------------------------------------------
-- Two additive domains:
--
--   ai_artifacts          versioned, validated, STORED structured output
--                         (intelligence snapshot, weekly report, signal
--                         set, recommendations, marketing suggestion,
--                         generated copy). Generated once, read many.
--
--   ai_action_proposals   an action the model REQUESTED. MAPCO validates
--   ai_action_audit       and executes it — the model never touches the
--                         database. Consequential/external actions can
--                         require explicit dealer approval.
--
-- Nothing here renders itself. The payload is data; MAPCO owns the UI.
-- No row is created by this migration: there is no seeded or demo output.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. artifacts ----------
-- period_key identifies WHAT the artifact is about, so the same kind can
-- be produced repeatedly without collision:
--   daily/signals   → '2026-08-12'
--   weekly report   → '2026-W33'
--   marketing       → 'prop-1723'
-- (dealer_id, kind, period_key, version) is unique; a regeneration always
-- creates a NEW version and supersedes the old one, preserving history.
create table if not exists public.ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  kind text not null check (kind in (
    'intelligence_snapshot',
    'signal_set',
    'recommendation_set',
    'weekly_report',
    'marketing_suggestion',
    'generated_copy',
    'answer'
  )),
  period_key text not null check (char_length(period_key) between 1 and 120),
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in (
    'draft', 'published', 'superseded', 'failed'
  )),
  schema_version text not null default 'v1' check (char_length(schema_version) between 1 and 40),
  -- Validated structured output. Always an object, never free prose.
  payload jsonb not null default '{}'::jsonb,
  -- The deterministic facts MAPCO calculated and sent. Kept for audit:
  -- every claim in payload must be traceable to something in here.
  facts jsonb not null default '{}'::jsonb,
  context_digest text check (context_digest is null or context_digest ~ '^[0-9a-f]{64}$'),
  execution_id uuid references public.ai_executions(id) on delete set null,
  job_id uuid references public.ai_jobs(id) on delete set null,
  provider text,
  model text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  generated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_artifacts_payload_size_check check (octet_length(payload::text) <= 262144),
  constraint ai_artifacts_facts_size_check check (octet_length(facts::text) <= 262144)
);

create unique index if not exists ai_artifacts_version_uidx
  on public.ai_artifacts (dealer_id, kind, period_key, version);

-- Exactly one published artifact per (dealer, kind, period).
create unique index if not exists ai_artifacts_published_uidx
  on public.ai_artifacts (dealer_id, kind, period_key)
  where status = 'published';

create index if not exists ai_artifacts_dealer_kind_recent_idx
  on public.ai_artifacts (dealer_id, kind, generated_at desc);

-- ---------- 2. action proposals ----------
-- risk drives approval policy:
--   internal      → stays inside MAPCO (create task, draft a note)
--   external      → leaves MAPCO (publish, send) — approval always required
--   consequential → changes dealer business state — approval always required
create table if not exists public.ai_action_proposals (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  action_type text not null check (char_length(action_type) between 1 and 80),
  status text not null default 'proposed' check (status in (
    'proposed', 'approved', 'rejected', 'executing', 'executed', 'failed', 'expired', 'cancelled'
  )),
  risk text not null default 'external' check (risk in ('internal', 'external', 'consequential')),
  requires_approval boolean not null default true,
  title text not null check (char_length(title) between 1 and 200),
  rationale text check (rationale is null or char_length(rationale) <= 2000),
  -- Validated against the action's own parameter schema before insert.
  params jsonb not null default '{}'::jsonb,
  source_artifact_id uuid references public.ai_artifacts(id) on delete set null,
  execution_id uuid references public.ai_executions(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  error_message text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_action_params_size_check check (octet_length(params::text) <= 32768),
  -- External and consequential actions can never be marked auto-executable.
  constraint ai_action_approval_floor_check
    check (risk = 'internal' or requires_approval = true)
);

create index if not exists ai_action_proposals_dealer_status_idx
  on public.ai_action_proposals (dealer_id, status, created_at desc);

-- ---------- 3. append-only action audit ----------
-- Who proposed, who approved, what executed, what happened. No UPDATE or
-- DELETE policy exists, so history cannot be rewritten through the API.
create table if not exists public.ai_action_audit (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  proposal_id uuid references public.ai_action_proposals(id) on delete cascade,
  event text not null check (event in (
    'proposed', 'approved', 'rejected', 'execution_started',
    'executed', 'failed', 'expired', 'cancelled'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  -- 'ai' when MAPCO's own worker acted, 'dealer' for a human decision.
  actor_kind text not null default 'dealer' check (actor_kind in ('ai', 'dealer', 'platform', 'system')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint ai_action_audit_detail_size_check check (octet_length(detail::text) <= 8192)
);

create index if not exists ai_action_audit_proposal_idx
  on public.ai_action_audit (proposal_id, created_at desc);
create index if not exists ai_action_audit_dealer_idx
  on public.ai_action_audit (dealer_id, created_at desc);

-- ---------- 4. RLS ----------
alter table public.ai_artifacts enable row level security;
alter table public.ai_action_proposals enable row level security;
alter table public.ai_action_audit enable row level security;

revoke all on table public.ai_artifacts from public, anon, authenticated;
revoke all on table public.ai_action_proposals from public, anon, authenticated;
revoke all on table public.ai_action_audit from public, anon, authenticated;

grant select on table public.ai_artifacts to authenticated;
grant select on table public.ai_action_proposals to authenticated;
grant select on table public.ai_action_audit to authenticated;

-- Dealers read only PUBLISHED artifacts. Drafts, superseded versions and
-- failed generations stay internal to the worker and platform operators.
drop policy if exists "ai artifacts dealer read" on public.ai_artifacts;
create policy "ai artifacts dealer read"
on public.ai_artifacts for select to authenticated
using (
  public.plotmap_is_active_member()
  and dealer_id = public.plotmap_current_dealer_id()
  and status = 'published'
);

drop policy if exists "ai action proposals dealer read" on public.ai_action_proposals;
create policy "ai action proposals dealer read"
on public.ai_action_proposals for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "ai action audit dealer read" on public.ai_action_audit;
create policy "ai action audit dealer read"
on public.ai_action_audit for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

-- ---------- 5. artifact write RPC (service role) ----------
-- Publishing is atomic: the new version supersedes the previous published
-- one inside a single statement pair, so a reader can never see two.
create or replace function public.plotmap_ai_store_artifact(
  p_dealer_id text,
  p_kind text,
  p_period_key text,
  p_payload jsonb,
  p_facts jsonb default '{}'::jsonb,
  p_schema_version text default 'v1',
  p_execution_id uuid default null,
  p_job_id uuid default null,
  p_provider text default null,
  p_model text default null,
  p_context_digest text default null,
  p_confidence numeric default null,
  p_publish boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_period text := trim(coalesce(p_period_key, ''));
  v_version integer;
  v_id uuid;
  v_status text := case when coalesce(p_publish, true) then 'published' else 'draft' end;
begin
  if v_dealer = '' then raise exception 'dealer_required'; end if;
  if v_period = '' then raise exception 'period_key_required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_must_be_object'; end if;
  if octet_length(p_payload::text) > 262144 then raise exception 'payload_too_large'; end if;
  if octet_length(coalesce(p_facts, '{}'::jsonb)::text) > 262144 then raise exception 'facts_too_large'; end if;
  if not public.plotmap_ai_is_enabled(v_dealer) then raise exception 'ai_disabled'; end if;

  -- Serialise concurrent writers for this exact artifact slot.
  perform pg_advisory_xact_lock(hashtext('plotmap:ai:artifact:' || v_dealer || ':' || p_kind || ':' || v_period));

  select coalesce(max(a.version), 0) + 1 into v_version
    from public.ai_artifacts a
    where a.dealer_id = v_dealer and a.kind = p_kind and a.period_key = v_period;

  if v_status = 'published' then
    update public.ai_artifacts
       set status = 'superseded', updated_at = timezone('utc'::text, now())
     where dealer_id = v_dealer and kind = p_kind and period_key = v_period and status = 'published';
  end if;

  insert into public.ai_artifacts (
    dealer_id, kind, period_key, version, status, schema_version,
    payload, facts, context_digest, execution_id, job_id, provider, model, confidence
  ) values (
    v_dealer, p_kind, v_period, v_version, v_status,
    left(coalesce(nullif(trim(coalesce(p_schema_version, '')), ''), 'v1'), 40),
    p_payload, coalesce(p_facts, '{}'::jsonb),
    case when p_context_digest ~ '^[0-9a-f]{64}$' then p_context_digest else null end,
    p_execution_id, p_job_id,
    nullif(left(trim(coalesce(p_provider, '')), 40), ''),
    nullif(left(trim(coalesce(p_model, '')), 120), ''),
    case when p_confidence between 0 and 1 then p_confidence else null end
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'status', v_status);
end;
$$;

-- ---------- 6. artifact read RPCs (dealer) ----------

-- The current published artifact for a kind/period. Returns ok:false with a
-- typed reason instead of raising, so a UI can degrade gracefully.
create or replace function public.plotmap_ai_current_artifact(
  p_kind text,
  p_period_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_row public.ai_artifacts%rowtype;
begin
  if v_dealer = '' or not public.plotmap_is_active_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if not public.plotmap_ai_is_enabled(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'ai_disabled');
  end if;

  select * into v_row
    from public.ai_artifacts a
    where a.dealer_id = v_dealer
      and a.kind = p_kind
      and a.status = 'published'
      and (p_period_key is null or a.period_key = p_period_key)
    order by a.generated_at desc
    limit 1;

  if not found then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;

  return jsonb_build_object(
    'ok', true,
    'artifact', jsonb_build_object(
      'id', v_row.id, 'kind', v_row.kind, 'periodKey', v_row.period_key,
      'version', v_row.version, 'schemaVersion', v_row.schema_version,
      'payload', v_row.payload, 'confidence', v_row.confidence,
      'generatedAt', v_row.generated_at,
      -- Provenance is available for internal auditing; UI need not show it.
      'provenance', jsonb_build_object('provider', v_row.provider, 'model', v_row.model,
                                       'contextDigest', v_row.context_digest)
    )
  );
end;
$$;

create or replace function public.plotmap_ai_artifact_history(
  p_kind text,
  p_limit integer default 20
)
returns table (
  id uuid, kind text, period_key text, version integer, status text,
  generated_at timestamptz, provider text, model text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.kind, a.period_key, a.version, a.status, a.generated_at, a.provider, a.model
  from public.ai_artifacts a
  where a.dealer_id = public.plotmap_current_dealer_id()
    and public.plotmap_is_active_member()
    and public.plotmap_ai_is_enabled(public.plotmap_current_dealer_id())
    and a.kind = p_kind
    and a.status in ('published', 'superseded')
  order by a.generated_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- ---------- 7. action proposal RPCs ----------

-- Created only by the worker (service role) after MAPCO has validated the
-- parameters against the action's own schema. The model cannot reach this.
create or replace function public.plotmap_ai_propose_action(
  p_dealer_id text,
  p_action_type text,
  p_title text,
  p_params jsonb,
  p_risk text default 'external',
  p_rationale text default null,
  p_source_artifact_id uuid default null,
  p_execution_id uuid default null,
  p_expires_in_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_risk text := lower(trim(coalesce(p_risk, 'external')));
  v_id uuid;
begin
  if v_dealer = '' then raise exception 'dealer_required'; end if;
  if v_risk not in ('internal', 'external', 'consequential') then raise exception 'invalid_risk'; end if;
  if p_params is null or jsonb_typeof(p_params) <> 'object' then raise exception 'params_must_be_object'; end if;
  if octet_length(p_params::text) > 32768 then raise exception 'params_too_large'; end if;
  if not public.plotmap_ai_is_enabled(v_dealer) then raise exception 'ai_disabled'; end if;

  insert into public.ai_action_proposals (
    dealer_id, action_type, title, params, risk, requires_approval,
    rationale, source_artifact_id, execution_id, expires_at
  ) values (
    v_dealer,
    left(trim(coalesce(p_action_type, '')), 80),
    left(trim(coalesce(p_title, 'Suggested action')), 200),
    p_params, v_risk,
    -- Only purely internal actions may ever skip the approval gate.
    v_risk <> 'internal',
    nullif(left(trim(coalesce(p_rationale, '')), 2000), ''),
    p_source_artifact_id, p_execution_id,
    timezone('utc'::text, now()) + make_interval(hours => least(greatest(coalesce(p_expires_in_hours, 168), 1), 2160))
  )
  returning id into v_id;

  insert into public.ai_action_audit (dealer_id, proposal_id, event, actor_kind, detail)
  values (v_dealer, v_id, 'proposed', 'ai',
          jsonb_build_object('actionType', p_action_type, 'risk', v_risk));

  return jsonb_build_object('ok', true, 'id', v_id, 'requiresApproval', v_risk <> 'internal');
end;
$$;

-- The dealer's decision. Approval alone does NOT execute; the worker picks
-- up approved proposals and runs the matching MAPCO tool.
create or replace function public.plotmap_ai_decide_action(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_row public.ai_action_proposals%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_now timestamptz := timezone('utc'::text, now());
begin
  if v_decision not in ('approve', 'reject', 'cancel') then raise exception 'invalid_decision'; end if;
  -- Approving an AI action is an owner/manager decision, matching the CRM
  -- write tier. Viewers and editors cannot authorise it.
  if not public.plotmap_can_edit_crm() then raise exception 'not_permitted'; end if;

  select * into v_row from public.ai_action_proposals p
    where p.id = p_proposal_id and p.dealer_id = v_dealer for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_row.status <> 'proposed' then
    return jsonb_build_object('ok', false, 'reason', 'already_decided', 'status', v_row.status);
  end if;
  if v_row.expires_at is not null and v_row.expires_at < v_now then
    update public.ai_action_proposals set status = 'expired', updated_at = v_now where id = p_proposal_id;
    insert into public.ai_action_audit (dealer_id, proposal_id, event, actor_kind) values (v_dealer, p_proposal_id, 'expired', 'system');
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  update public.ai_action_proposals
     set status = case v_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'cancelled' end,
         approved_by = auth.uid(),
         approved_at = v_now,
         updated_at = v_now
   where id = p_proposal_id;

  insert into public.ai_action_audit (dealer_id, proposal_id, event, actor_id, actor_role, actor_kind, detail)
  values (v_dealer, p_proposal_id,
          case v_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'cancelled' end,
          auth.uid(), public.plotmap_current_role(), 'dealer',
          jsonb_build_object('note', nullif(left(trim(coalesce(p_note, '')), 500), '')));

  return jsonb_build_object('ok', true, 'status', v_decision);
end;
$$;

-- Terminal transition written by the worker after MAPCO executed the tool.
create or replace function public.plotmap_ai_record_action_result(
  p_proposal_id uuid,
  p_status text,
  p_result jsonb default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ai_action_proposals%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_now timestamptz := timezone('utc'::text, now());
begin
  if v_status not in ('executing', 'executed', 'failed') then raise exception 'invalid_status'; end if;

  update public.ai_action_proposals
     set status = v_status,
         result = coalesce(p_result, result),
         error_message = nullif(left(coalesce(p_error_message, ''), 500), ''),
         executed_at = case when v_status in ('executed', 'failed') then v_now else executed_at end,
         updated_at = v_now
   where id = p_proposal_id
   returning * into v_row;

  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  insert into public.ai_action_audit (dealer_id, proposal_id, event, actor_kind, detail)
  values (v_row.dealer_id, p_proposal_id,
          case v_status when 'executing' then 'execution_started' when 'executed' then 'executed' else 'failed' end,
          'system', jsonb_build_object('error', nullif(left(coalesce(p_error_message, ''), 500), '')));

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- Dealer-facing queue read. Expired proposals are filtered out at read time
-- so a stale row never appears actionable.
create or replace function public.plotmap_ai_pending_actions(p_limit integer default 25)
returns table (
  id uuid, action_type text, status text, risk text, requires_approval boolean,
  title text, rationale text, params jsonb, created_at timestamptz, expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.action_type, p.status, p.risk, p.requires_approval,
         p.title, p.rationale, p.params, p.created_at, p.expires_at
  from public.ai_action_proposals p
  where p.dealer_id = public.plotmap_current_dealer_id()
    and public.plotmap_is_active_member()
    and public.plotmap_ai_is_enabled(public.plotmap_current_dealer_id())
    and p.status in ('proposed', 'approved', 'executing')
    and (p.expires_at is null or p.expires_at > timezone('utc'::text, now()))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

-- ---------- 8. worker-side lookups (service role) ----------

-- Cost control at the source: if the deterministic facts are byte-identical
-- to a recent published artifact of the same kind, there is nothing new to
-- interpret and no provider call is made.
create or replace function public.plotmap_ai_reusable_artifact(
  p_dealer_id text,
  p_kind text,
  p_context_digest text,
  p_max_age_minutes integer default 720
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.ai_artifacts%rowtype;
begin
  if coalesce(p_max_age_minutes, 0) <= 0 then return jsonb_build_object('ok', false, 'reason', 'reuse_disabled'); end if;
  if p_context_digest !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'reason', 'no_digest'); end if;

  select * into v_row
    from public.ai_artifacts a
    where a.dealer_id = lower(trim(coalesce(p_dealer_id, '')))
      and a.kind = p_kind
      and a.status = 'published'
      and a.context_digest = p_context_digest
      and a.generated_at > timezone('utc'::text, now())
                           - make_interval(mins => least(greatest(p_max_age_minutes, 1), 43200))
    order by a.generated_at desc
    limit 1;

  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id, 'periodKey', v_row.period_key, 'version', v_row.version,
    'payload', v_row.payload, 'generatedAt', v_row.generated_at
  );
end;
$$;

-- Approved proposals waiting for MAPCO to execute them. Leasing is not
-- needed here: a proposal moves to 'executing' before any work begins, so
-- a second worker cannot pick up the same row.
create or replace function public.plotmap_ai_claim_approved_actions(p_limit integer default 10)
returns setof public.ai_action_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
begin
  return query
  with claimable as (
    select p.id from public.ai_action_proposals p
    where p.status = 'approved'
      and (p.expires_at is null or p.expires_at > v_now)
      and public.plotmap_ai_is_enabled(p.dealer_id)
    order by p.approved_at asc nulls last
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
    for update skip locked
  )
  update public.ai_action_proposals p
     set status = 'executing', updated_at = v_now
   from claimable c
  where p.id = c.id
  returning p.*;
end;
$$;

-- ---------- 9. grants ----------
revoke all on function public.plotmap_ai_store_artifact(text, text, text, jsonb, jsonb, text, uuid, uuid, text, text, text, numeric, boolean) from public, anon, authenticated;
revoke all on function public.plotmap_ai_current_artifact(text, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_artifact_history(text, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_propose_action(text, text, text, jsonb, text, text, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_decide_action(uuid, text, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_record_action_result(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_pending_actions(integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_reusable_artifact(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_claim_approved_actions(integer) from public, anon, authenticated;

grant execute on function public.plotmap_ai_current_artifact(text, text) to authenticated;
grant execute on function public.plotmap_ai_artifact_history(text, integer) to authenticated;
grant execute on function public.plotmap_ai_decide_action(uuid, text, text) to authenticated;
grant execute on function public.plotmap_ai_pending_actions(integer) to authenticated;

grant execute on function public.plotmap_ai_store_artifact(text, text, text, jsonb, jsonb, text, uuid, uuid, text, text, text, numeric, boolean) to service_role;
grant execute on function public.plotmap_ai_propose_action(text, text, text, jsonb, text, text, uuid, uuid, integer) to service_role;
grant execute on function public.plotmap_ai_record_action_result(uuid, text, jsonb, text) to service_role;
grant execute on function public.plotmap_ai_reusable_artifact(text, text, text, integer) to service_role;
grant execute on function public.plotmap_ai_claim_approved_actions(integer) to service_role;
