-- ═══════════════════════════════════════════════════════════════════════════
-- 20260903000100_evidence_foundation.sql
--
-- The evidence that cannot be reconstructed later. Nothing here duplicates
-- presentation_events, client_link_events, share_links, dealer_settings or
-- audit_logs -- those are extended or read, never mirrored.
--
-- Three corrections to the earlier design, each found by reading the live
-- schema rather than trusting the previous analysis:
--
--   1. plotmap_sanitize_event_metadata() does not pass caller metadata
--      through. It REBUILDS the object from a closed allowlist and discards
--      everything else. A trigger that promotes '_build' / '_outcome' /
--      '_duration_ms' out of metadata would therefore have found an object
--      those keys had already been stripped from, and would have recorded
--      nothing -- the exact silent-drop failure this migration exists to end.
--      Section 2 extends the sanitizer so the envelope survives it.
--
--   2. plotmap_event_metadata_has_secret() rejects any STRING value holding
--      eight consecutive digits. A stringified duration of 12345678 ms would
--      have failed the whole insert. _duration_ms is therefore a JSON number,
--      never a string, and the numeric branch of the guard does not apply.
--
--   3. presentation_events already carries plotmap_00_authenticated_tenant_guard
--      (it has a dealer_id column), which overwrites new.dealer_id with the
--      caller's own profile dealer on INSERT. Dealer identity is already
--      unspoofable; the envelope trigger is named plotmap_10_* so it runs
--      after that guard, never before it.
--
-- Conventions followed: public.plotmap_* helper names, platform-admin gating
-- via public.plotmap_is_platform_admin(), RLS enabled and forced on every new
-- table, no weakening of any existing policy, safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. presentation_events -- actor identity, workflow outcome, build version
--
--    This table already carries dealer-side workspace events; the
--    plotmap_event_name_allowed allowlist contains property_add_clicked,
--    property_added, dealer_dashboard_opened, map_studio_opened and more.
--    The name is misleading, the shape is right. It needs six columns, not a
--    parallel desk_events table.
--
--    occurred_at / ingested_at already exist as created_at / ingested_at
--    (20260801001100). That irreversible decision was already made correctly.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.presentation_events
  add column if not exists actor_profile_id  uuid references public.profiles(id) on delete set null,
  add column if not exists actor_role        text,
  add column if not exists actor_device_hash text,
  add column if not exists outcome           text,
  add column if not exists duration_ms       integer,
  add column if not exists build_version     text;

comment on column public.presentation_events.actor_profile_id is
  'Server-derived from auth.uid() in plotmap_promote_event_envelope(). profiles.id IS auth.users.id (see profiles definition), so this join is sound. Never client-supplied.';
comment on column public.presentation_events.actor_role is
  'profiles.role at the moment of the event. Owner and staff are different evidence about who uses the product.';
comment on column public.presentation_events.actor_device_hash is
  'Which device. NOT which human -- office machines are shared. Strictly weaker than actor_profile_id and must never be presented as an identity.';
comment on column public.presentation_events.outcome is
  'Workflow result. abandoned leaves no row anywhere else in the database and cannot be reconstructed after the fact.';
comment on column public.presentation_events.build_version is
  'Which build the dealer actually ran. Without it, dealers 1-20 produce a dataset in which the treatment changed continuously and silently.';

alter table public.presentation_events
  drop constraint if exists presentation_events_outcome_check;
alter table public.presentation_events
  add constraint presentation_events_outcome_check
  check (outcome is null or outcome in ('started', 'completed', 'abandoned', 'failed'));

alter table public.presentation_events
  drop constraint if exists presentation_events_duration_check;
alter table public.presentation_events
  add constraint presentation_events_duration_check
  check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 86400000));

alter table public.presentation_events
  drop constraint if exists presentation_events_build_version_check;
alter table public.presentation_events
  add constraint presentation_events_build_version_check
  check (build_version is null or build_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$');

create index if not exists presentation_events_funnel_idx
  on public.presentation_events (dealer_id, event_type, outcome, created_at desc);

create index if not exists presentation_events_actor_idx
  on public.presentation_events (dealer_id, actor_profile_id, created_at desc)
  where actor_profile_id is not null;

create index if not exists presentation_events_build_idx
  on public.presentation_events (dealer_id, build_version, created_at desc)
  where build_version is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Metadata sanitizer -- extended, not replaced in spirit
--
--    Everything the live function already did is reproduced byte-for-byte:
--    object check, 2048-byte cap, secret scan, surface, env, source, the nine
--    generic keys, and the error-code reduction. Two blocks are added:
--
--      a. a closed set of evidence keys with preserved primitive types, so a
--         number stays a number and a boolean stays a boolean;
--      b. the system envelope (_build, _outcome, _duration_ms), which the
--         trigger in section 3 promotes into real columns.
--
--    _dealer, _actor, _session and _ts are deliberately NOT read here. They
--    are RPC parameters or derived from auth.uid(); a caller that sends them
--    as metadata simply loses them, which is the intended outcome.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.plotmap_sanitize_event_metadata(
  p_event_type text,
  p_metadata jsonb,
  p_surface text
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_input jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_output jsonb := jsonb_build_object(
    'surface', case when p_surface = 'admin' then 'admin' else 'presentation' end
  );
  v_value text;
  v_key text;
  v_num numeric;
begin
  if jsonb_typeof(v_input) <> 'object' then
    raise exception 'metadata must be an object';
  end if;
  if octet_length(v_input::text) > 2048 then
    raise exception 'metadata too large';
  end if;
  if public.plotmap_event_metadata_has_secret(v_input, 0) then
    raise exception 'sensitive analytics metadata rejected';
  end if;

  if v_input->>'env' = 'local' then
    v_output := v_output || jsonb_build_object('env', 'local');
  end if;

  v_value := v_input->>'source';
  if v_value = any (array[
    'client_presentation', 'area_select', 'area_switcher', 'properties_tab',
    'property_detail', 'send_details_later', 'whatsapp'
  ]) then
    v_output := v_output || jsonb_build_object('source', v_value);
  end if;

  foreach v_key in array array['page', 'role', 'view', 'kind', 'via', 'group', 'itemId', 'mapId', 'name']
  loop
    v_value := v_input->>v_key;
    if v_value is not null
       and length(v_value) <= 120
       and v_value ~ '^[A-Za-z0-9][A-Za-z0-9 _.:/()-]*$' then
      v_output := v_output || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  if p_event_type in ('app_error', 'asset_load_failure', 'slow_operation') then
    v_value := lower(coalesce(v_input->>'code', ''));
    v_output := v_output || jsonb_build_object('code', case
      when p_event_type = 'asset_load_failure' then 'asset_load_failure'
      when p_event_type = 'slow_operation' then 'slow_operation'
      when v_value like '%timeout%' or v_value like '%timed out%' then 'timeout'
      when v_value like '%network%' or v_value like '%failed to fetch%' then 'network_error'
      when v_value like '%script error%' then 'script_error'
      else 'client_error'
    end);
  end if;

  -- ── evidence foundation (20260903000100): bounded event context ────────
  -- A closed key set, exactly like the generic block above. Facts only:
  -- which flow, which stage failed, which lifecycle the row landed in, how
  -- the coordinate was reached. No scores, no judgements, no free text.
  foreach v_key in array array['flow', 'stage', 'lifecycle', 'pin_source', 'error_kind']
  loop
    v_value := v_input->>v_key;
    if v_value is not null
       and length(v_value) <= 40
       and v_value ~ '^[a-z][a-z0-9_-]*$' then
      v_output := v_output || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  -- Numbers stay numbers. A stringified count could trip the eight-digit
  -- branch of plotmap_event_metadata_has_secret and lose the whole event.
  foreach v_key in array array['step', 'photo_count']
  loop
    if jsonb_typeof(v_input -> v_key) = 'number' then
      v_num := (v_input ->> v_key)::numeric;
      if v_num >= 0 and v_num <= 100000 then
        v_output := v_output || jsonb_build_object(v_key, floor(v_num)::bigint);
      end if;
    end if;
  end loop;

  -- has_location is a fact about the row that persisted, and is deliberately
  -- NOT the same signal as a property_location_pinned event: the Desk's
  -- "Confirm this spot" control is not a gate, so a dealer can tap the map and
  -- save, persisting a real coordinate without ever confirming it. The event
  -- records deliberate confirmation; this boolean records the outcome.
  foreach v_key in array array['downgraded', 'has_map_placement', 'has_location', 'published', 'is_edit']
  loop
    if jsonb_typeof(v_input -> v_key) = 'boolean' then
      v_output := v_output || jsonb_build_object(v_key, v_input -> v_key);
    end if;
  end loop;

  -- ── system envelope ────────────────────────────────────────────────────
  -- Promoted to columns by plotmap_10_presentation_events_envelope. Shape is
  -- validated here so a malformed client value is dropped rather than stored.
  v_value := v_input ->> '_build';
  if v_value is not null and v_value ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$' then
    v_output := v_output || jsonb_build_object('_build', v_value);
  end if;

  v_value := v_input ->> '_outcome';
  if v_value in ('started', 'completed', 'abandoned', 'failed') then
    v_output := v_output || jsonb_build_object('_outcome', v_value);
  end if;

  if jsonb_typeof(v_input -> '_duration_ms') = 'number' then
    v_num := (v_input ->> '_duration_ms')::numeric;
    if v_num >= 0 and v_num <= 86400000 then
      v_output := v_output || jsonb_build_object('_duration_ms', floor(v_num)::bigint);
    end if;
  end if;

  return v_output;
end;
$$;

revoke all on function public.plotmap_sanitize_event_metadata(text, jsonb, text)
  from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Envelope promotion trigger
--
--    The plotmap_record_presentation_event and
--    plotmap_record_device_presentation_event signatures are untouched, so no
--    existing caller breaks and both ingestion doors gain the same columns.
--
--    actor_profile_id is derived from auth.uid() here, where a client cannot
--    reach it. The device door is anon-authenticated, so auth.uid() is null
--    there and the actor columns stay null -- correctly, because a device
--    token identifies a machine and never a person.
--
--    Raw metadata is preserved as written. Interpretation is derived in the
--    views at the bottom of this file, never written back over the fact.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.plotmap_promote_event_envelope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- SELECT ... INTO leaves both targets null when the profile row is absent,
  -- so a platform admin without a dealer profile cannot trip the FK.
  if new.actor_profile_id is null and v_uid is not null then
    select p.id, p.role
      into new.actor_profile_id, new.actor_role
      from public.profiles p
     where p.id = v_uid;
  end if;

  if jsonb_typeof(new.metadata) = 'object' then
    if new.outcome is null
       and (new.metadata ->> '_outcome') in ('started', 'completed', 'abandoned', 'failed') then
      new.outcome := new.metadata ->> '_outcome';
    end if;

    if new.duration_ms is null
       and jsonb_typeof(new.metadata -> '_duration_ms') = 'number' then
      new.duration_ms := least(
        greatest(floor((new.metadata ->> '_duration_ms')::numeric), 0),
        86400000
      )::integer;
    end if;

    if new.build_version is null
       and (new.metadata ->> '_build') ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$' then
      new.build_version := new.metadata ->> '_build';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.plotmap_promote_event_envelope()
  from public, anon, authenticated;

-- plotmap_00_authenticated_tenant_guard forces new.dealer_id to the caller's
-- own profile dealer. The 10 prefix keeps this trigger strictly after it.
drop trigger if exists plotmap_presentation_events_envelope on public.presentation_events;
drop trigger if exists plotmap_10_presentation_events_envelope on public.presentation_events;
create trigger plotmap_10_presentation_events_envelope
  before insert on public.presentation_events
  for each row execute function public.plotmap_promote_event_envelope();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Event taxonomy -- nine additions to the existing allowlist
--
--    Named for business meaning, not for the UI component that fired them.
--    UI names rot at the next redesign, and this repository redesigns often.
--    v2/src/packages/data/contracts.ts holds the frontend copy; it is
--    compared against this array in both directions by
--    v2/tests/telemetry-contract.test.ts on every run.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.plotmap_event_name_allowed(p_name text)
returns boolean
language sql
immutable
as $$
  select p_name = any (array[
    -- lifecycle
    'app_open', 'dealer_login', 'presentation_opened',
    -- navigation
    'dealer_dashboard_opened', 'team_workspace_opened', 'properties_page_opened',
    'map_studio_opened', 'clients_page_opened', 'insights_page_opened',
    'admin_page_opened', 'client_panel_opened', 'inventory_opened',
    -- maps
    'map_opened', 'area_viewed', 'sector_viewed', 'overlay_selected',
    'sector_proof_clicked', 'original_proof_clicked',
    -- properties
    'property_add_clicked', 'property_added', 'property_selected',
    'property_viewed', 'followup_created_from_presentation',
    -- sharing
    'property_shared_whatsapp', 'brochure_shared', 'property_shared',
    -- health
    'app_error', 'asset_load_failure', 'slow_operation',
    -- evidence foundation (20260903000100)
    'property_location_pinned', 'property_valued', 'earth_opened',
    'intelligence_requested', 'intelligence_viewed', 'client_link_created',
    'seller_added', 'buyer_added', 'deal_stage_changed'
  ]);
$$;

revoke all on function public.plotmap_event_name_allowed(text)
  from public, anon, authenticated;
grant execute on function public.plotmap_event_name_allowed(text)
  to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. trials -- the trial as an experimental unit
--
--    dealer_settings holds trial_start / trial_end / subscription_status for
--    the CURRENT account state. It cannot hold a second trial, a pitch
--    version, or a referral source. This is the experimental record; it
--    deliberately does not restate subscription_status.
--
--    Three outcome axes exist. Only the commercial one is stored. Progression
--    and buyer validation are derived in the views below, so the theory of
--    activation can change without rewriting a single historical row.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.trials (
  id                      uuid primary key default gen_random_uuid(),
  dealer_id               text not null references public.dealer_settings(dealer_id) on delete cascade,

  started_at              timestamptz not null,
  ends_at                 timestamptz not null,
  closed_at               timestamptz,

  -- Treatment record. Changing any of these mid-trial is allowed; leaving a
  -- change unrecorded is not. presentation_events.build_version is
  -- authoritative for what the dealer actually ran; this is what he started on.
  pitch_version           text not null,
  build_version_at_start  text not null,
  protocol_version        text not null default 'v1',

  acquisition_source      text not null,
  referred_by_dealer_id   text references public.dealer_settings(dealer_id) on delete set null,
  tie_strength            text,

  -- Raw commercial facts. No inferred commission anywhere in this schema.
  inventory_value_paise   bigint,
  price_offered_paise     bigint,
  price_paid_paise        bigint,
  discount_reason         text,

  commercial_outcome      text not null default 'open',
  loss_reason             text,

  -- Known confound: did the dealer phone the buyer and ask him to open the
  -- link? Recorded at the time or lost forever.
  buyer_contact_prompted  boolean,

  notes                   text,
  created_at              timestamptz not null default timezone('utc'::text, now()),
  updated_at              timestamptz not null default timezone('utc'::text, now()),

  constraint trials_window_check
    check (ends_at > started_at),
  constraint trials_closed_check
    check (closed_at is null or closed_at >= started_at),
  constraint trials_acquisition_check
    check (acquisition_source in ('family', 'referral', 'cold', 'walk_in', 'inbound')),
  constraint trials_tie_check
    check (tie_strength is null or tie_strength in ('strong', 'known', 'weak')),
  constraint trials_commercial_check
    check (commercial_outcome in ('open', 'won', 'lost', 'deferred', 'churned')),
  constraint trials_no_self_referral
    check (referred_by_dealer_id is null or referred_by_dealer_id <> dealer_id),
  constraint trials_pitch_version_check
    check (length(btrim(pitch_version)) > 0 and length(pitch_version) <= 60),
  constraint trials_build_version_check
    check (length(btrim(build_version_at_start)) > 0 and length(build_version_at_start) <= 60)
);

create index if not exists trials_dealer_idx on public.trials (dealer_id, started_at desc);
create index if not exists trials_treatment_idx on public.trials (pitch_version, build_version_at_start);
create index if not exists trials_referral_idx on public.trials (referred_by_dealer_id)
  where referred_by_dealer_id is not null;

comment on table public.trials is
  'Experimental record of one dealer trial. Provider-owned: RLS forced, platform admin only. Dealers cannot read founder records about themselves.';
comment on column public.trials.inventory_value_paise is
  'Listing value represented in DealSetu. NOT expected commission. Do not multiply by a brokerage rate to produce an economic claim.';
comment on column public.trials.commercial_outcome is
  'Axis 3 of 3, and the only one stored. Progression is trial_milestones_v; buyer validation is buyer_engagement_v. A dealer can pay without a buyer ever opening a link, and that row must not read as activation.';

-- ───────────────────────────────────────────────────────────────────────────
-- 6. evidence -- everything a human observed, with provenance
--
--    Not crm_records: that is dealer-scoped under dealer RLS, and a founder
--    observation about a dealer must never be readable by that dealer.
--    Not audit_logs: that is a dealer-scoped security trail, written by
--    nothing in application code today.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.evidence (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  provenance   text not null,

  dealer_id    text references public.dealer_settings(dealer_id) on delete set null,
  trial_id     uuid references public.trials(id) on delete set null,

  body         text not null,
  tags         text[] not null default '{}',

  occurred_at  timestamptz not null,
  recorded_at  timestamptz not null default timezone('utc'::text, now()),

  created_by   uuid references public.profiles(id) on delete set null,

  constraint evidence_kind_check
    check (kind in ('objection', 'statement', 'intervention', 'surprise', 'decision', 'treatment_change')),
  constraint evidence_provenance_check
    check (provenance in ('system_observed', 'founder_observed', 'dealer_stated',
                          'buyer_observed', 'derived', 'backfilled')),
  constraint evidence_body_check
    check (length(btrim(body)) > 0 and length(body) <= 4000),
  constraint evidence_not_future
    check (occurred_at <= recorded_at + interval '1 hour')
);

create index if not exists evidence_dealer_idx on public.evidence (dealer_id, kind, occurred_at desc);
create index if not exists evidence_trial_idx on public.evidence (trial_id, occurred_at desc)
  where trial_id is not null;
create index if not exists evidence_tags_idx on public.evidence using gin (tags);

comment on column public.evidence.body is
  'Verbatim. Never summarised at write time -- "too expensive" and "my son says these apps never work" are different objections needing different answers.';
comment on column public.evidence.recorded_at is
  'Distinct from occurred_at so a memory entered three days later is visibly weaker than a timestamped observation.';
comment on column public.evidence.provenance is
  'buyer_observed is the highest-INDEPENDENCE evidence available, not truth. The dealer still chose which buyer to send the link to.';

-- ───────────────────────────────────────────────────────────────────────────
-- 7. predictions -- structured so calibration is computable later
--
--    Deliberately NOT a nullable variant of evidence. A Brier score requires
--    a non-null confidence, a resolution enum, and a hard guarantee that the
--    prediction existed before the observation. Nullable columns on a shared
--    table drift, and one drifted row makes every calibration number
--    meaningless.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.predictions (
  id                uuid primary key default gen_random_uuid(),

  statement         text not null,
  domain            text not null,
  confidence        integer not null,

  dealer_id         text references public.dealer_settings(dealer_id) on delete set null,
  trial_id          uuid references public.trials(id) on delete set null,

  created_at        timestamptz not null default timezone('utc'::text, now()),
  horizon_at        timestamptz not null,

  resolution        text not null default 'pending',
  resolved_at       timestamptz,
  resolution_note   text,
  resolution_evidence_id uuid references public.evidence(id) on delete set null,

  created_by        uuid references public.profiles(id) on delete set null,

  constraint predictions_confidence_check
    check (confidence between 1 and 99),
  constraint predictions_domain_check
    check (domain in ('pricing', 'product', 'behaviour', 'timing', 'commercial', 'other')),
  constraint predictions_resolution_check
    check (resolution in ('pending', 'true', 'false', 'unresolvable', 'expired')),
  constraint predictions_horizon_check
    check (horizon_at > created_at),
  constraint predictions_resolved_shape
    check (
      (resolution = 'pending' and resolved_at is null)
      or (resolution <> 'pending' and resolved_at is not null and resolved_at >= created_at)
    ),
  constraint predictions_statement_check
    check (length(btrim(statement)) > 0 and length(statement) <= 500)
);

create index if not exists predictions_open_idx on public.predictions (horizon_at)
  where resolution = 'pending';
create index if not exists predictions_calibration_idx
  on public.predictions (domain, confidence, resolution)
  where resolution in ('true', 'false');
create index if not exists predictions_dealer_idx on public.predictions (dealer_id, created_at desc)
  where dealer_id is not null;

comment on table public.predictions is
  'A staked prediction. The stake is immutable; only the resolution may be written, and only once.';

-- A prediction whose statement or confidence can be edited after the fact is
-- not a prediction. A resolution that can flip from true to false is not a
-- record. Both are blocked here rather than left to application discipline.
create or replace function public.plotmap_guard_prediction_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.id         is distinct from old.id
     or new.statement  is distinct from old.statement
     or new.confidence is distinct from old.confidence
     or new.domain     is distinct from old.domain
     or new.dealer_id  is distinct from old.dealer_id
     or new.trial_id   is distinct from old.trial_id
     or new.horizon_at is distinct from old.horizon_at
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '42501',
      message = 'a staked prediction cannot be edited; resolve it instead';
  end if;

  -- Terminal means terminal. Correcting a resolved prediction is an audited
  -- act: write an evidence row saying so, do not rewrite the history.
  if old.resolution in ('true', 'false')
     and new.resolution is distinct from old.resolution then
    raise exception using
      errcode = '42501',
      message = 'a terminally resolved prediction cannot be re-resolved; record a correction in evidence';
  end if;

  if old.resolution <> 'pending' and new.resolution = 'pending' then
    raise exception using
      errcode = '42501',
      message = 'a resolved prediction cannot be reopened';
  end if;

  return new;
end;
$$;

drop trigger if exists plotmap_predictions_immutable on public.predictions;
create trigger plotmap_predictions_immutable
  before update on public.predictions
  for each row execute function public.plotmap_guard_prediction_immutability();

-- ───────────────────────────────────────────────────────────────────────────
-- 8. RLS -- all three tables are provider-owned. No dealer may read them.
--
--    Deliberately NOT given plotmap_00_authenticated_tenant_guard. That
--    trigger overwrites new.dealer_id with the caller's own dealer, which is
--    correct for tenant data and wrong here: trials.dealer_id names the
--    dealer the record is ABOUT, written by a platform admin who belongs to a
--    different dealer. The guard early-returns for platform admins in any
--    case, and RLS already denies everyone else.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.trials      enable row level security;
alter table public.evidence    enable row level security;
alter table public.predictions enable row level security;

alter table public.trials      force row level security;
alter table public.evidence    force row level security;
alter table public.predictions force row level security;

revoke all on public.trials      from public, anon, authenticated;
revoke all on public.evidence    from public, anon, authenticated;
revoke all on public.predictions from public, anon, authenticated;

drop policy if exists trials_platform_admin_all on public.trials;
create policy trials_platform_admin_all on public.trials
  for all to authenticated
  using (public.plotmap_is_platform_admin())
  with check (public.plotmap_is_platform_admin());

drop policy if exists evidence_platform_admin_all on public.evidence;
create policy evidence_platform_admin_all on public.evidence
  for all to authenticated
  using (public.plotmap_is_platform_admin())
  with check (public.plotmap_is_platform_admin());

drop policy if exists predictions_platform_admin_all on public.predictions;
create policy predictions_platform_admin_all on public.predictions
  for all to authenticated
  using (public.plotmap_is_platform_admin())
  with check (public.plotmap_is_platform_admin());

grant select, insert, update, delete on public.trials      to authenticated;
grant select, insert, update, delete on public.evidence    to authenticated;
grant select, insert, update, delete on public.predictions to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. Derived views -- interpretation lives here, never in the event history
--
--    Each view encodes a CURRENT hypothesis about what matters. When twenty
--    trials say something different, replace the view. No migration of
--    history, no rewrite, nothing lost.
--
--    security_invoker keeps the caller's RLS in force, so a view can never
--    become a way around the policies above.
-- ───────────────────────────────────────────────────────────────────────────

drop view if exists public.trial_milestones_v;
create view public.trial_milestones_v
with (security_invoker = true) as
select
  t.id   as trial_id,
  t.dealer_id,
  t.started_at,

  -- An ATTEMPT IS NOT A SUCCESS. Every milestone below requires
  -- outcome = 'completed', which is only written after canonical persistence
  -- actually succeeded. A failed save must never advance a trial.
  min(pe.created_at) filter (
    where pe.event_type = 'property_added' and pe.outcome = 'completed')       as first_property_at,
  min(pe.created_at) filter (
    where pe.event_type = 'property_location_pinned')                          as first_location_at,
  min(pe.created_at) filter (
    where pe.event_type = 'client_link_created' and pe.outcome is distinct from 'failed')
                                                                               as first_link_at,

  count(*) filter (
    where pe.event_type = 'property_added' and pe.outcome = 'completed')        as properties_added,
  count(*) filter (
    where pe.event_type = 'property_added' and pe.outcome = 'failed')           as property_add_failures,
  count(*) filter (
    where pe.event_type = 'property_add_clicked' and pe.outcome = 'started')    as add_started,
  count(*) filter (
    where pe.event_type = 'property_add_clicked' and pe.outcome = 'abandoned')  as add_abandoned,
  count(*) filter (
    where pe.event_type = 'property_location_pinned')                           as locations_pinned,

  count(distinct pe.actor_profile_id)                                           as distinct_actors,
  count(distinct pe.build_version)                                              as builds_seen,
  count(distinct date_trunc('day', pe.created_at))                              as active_days
from public.trials t
left join public.presentation_events pe
  on  pe.dealer_id  = t.dealer_id
  and pe.created_at >= t.started_at
  and pe.created_at <  coalesce(t.closed_at, t.ends_at)
group by t.id, t.dealer_id, t.started_at;

comment on view public.trial_milestones_v is
  'Progression axis, derived on read. Known limit: events are attributed to a trial by dealer_id and time window, so a dealer with two trials leaves the gap between them attributed to neither. Fine at n=1; verify before dealer #10.';

-- Buyer-side evidence ladder. The highest-INDEPENDENCE evidence in the
-- system -- the buyer sits outside the founder's family network -- but it is
-- not truth. Known confounds: the dealer picks his warmest buyer, the dealer
-- may phone him and ask him to open it (trials.buyer_contact_prompted),
-- novelty, and accidental opens. The ladder exists so a two-second open is
-- never scored the same as a return visit with a site-visit request.
drop view if exists public.buyer_engagement_v;
create view public.buyer_engagement_v
with (security_invoker = true) as
with per_link as (
  select
    sl.dealer_id,
    cle.link_id,
    count(*) filter (where cle.event_type = 'opened')                             as opens,
    count(distinct cle.session_hash)                                              as sessions,
    count(distinct date_trunc('day', cle.created_at))                             as distinct_days,
    count(*) filter (where cle.event_type = 'audio_played')                       as audio_plays,
    count(*) filter (where cle.event_type = 'property_viewed')                    as property_views,
    count(*) filter (where cle.event_type = 'photos_viewed')                      as photo_views,
    count(*) filter (where cle.event_type = 'map_opened')                         as map_opens,
    count(*) filter (where cle.event_type in ('call_clicked', 'whatsapp_clicked',
                                              'visit_requested'))                 as intent_actions,
    count(*) filter (where cle.event_type = 'visit_requested')                    as visit_requests,
    count(distinct cle.property_public_id)                                        as properties_touched,
    min(cle.created_at)                                                           as first_open_at,
    max(cle.created_at)                                                           as last_open_at
  from public.share_links sl
  join public.client_link_events cle on cle.link_id = sl.id
  group by sl.dealer_id, cle.link_id
)
select
  per_link.*,
  case
    when opens = 0                                                  then 'none'
    when intent_actions > 0 or distinct_days >= 2                   then 'deep'
    when properties_touched >= 2 or map_opens > 0
      or audio_plays > 0 or photo_views > 0 or opens >= 2           then 'engaged'
    else 'incidental'
  end as engagement_level
from per_link;

comment on view public.buyer_engagement_v is
  'Buyer validation axis, derived on read. Highest-independence behavioural evidence available -- not truth. Confounds are named in the migration comment above this view.';

-- Calibration is computable from this alone. Never averaged across domains:
-- well calibrated on product and badly overconfident on pricing blends into a
-- healthy-looking score and a dead company.
drop view if exists public.founder_calibration_v;
create view public.founder_calibration_v
with (security_invoker = true) as
select
  domain,
  width_bucket(confidence, 0, 100, 10) as confidence_bucket,
  count(*)                             as n,
  avg(confidence)::numeric(5,2)        as claimed_pct,
  (100.0 * avg(case when resolution = 'true' then 1 else 0 end))::numeric(5,2) as observed_pct,
  avg(power(confidence / 100.0 - case when resolution = 'true' then 1 else 0 end, 2))::numeric(6,4) as brier
from public.predictions
where resolution in ('true', 'false')
group by domain, width_bucket(confidence, 0, 100, 10);

comment on view public.founder_calibration_v is
  'Calibration by domain and confidence bucket. Do not render a bucket with n < 3. Below ten resolved predictions in total, do not render this at all.';

revoke all on public.trial_milestones_v   from public, anon;
revoke all on public.buyer_engagement_v   from public, anon;
revoke all on public.founder_calibration_v from public, anon;

grant select on public.trial_milestones_v    to authenticated;
grant select on public.buyer_engagement_v    to authenticated;
grant select on public.founder_calibration_v to authenticated;

commit;
