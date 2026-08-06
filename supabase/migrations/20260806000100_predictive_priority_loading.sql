-- MAPCO V2 predictive-priority telemetry.
-- Dealer-only operational events; separate from buyer presentation analytics.
-- No client/seller content, raw public tokens, pointer, pan, or zoom events.

create table if not exists public.predictive_usage_events (
  id bigint generated always as identity primary key,
  dealer_id text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 100),
  event_type text not null check (event_type in (
    'route-opened', 'city-opened', 'masterplan-opened', 'sector-opened',
    'property-opened', 'view-on-map', 'mode-selected',
    'client-link-started', 'client-link-property-added', 'transition'
  )),
  from_type text,
  from_id text,
  to_type text,
  to_id text,
  resource_type text,
  resource_id text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists predictive_usage_events_dealer_recent_idx
  on public.predictive_usage_events (dealer_id, created_at desc);
create index if not exists predictive_usage_events_transition_idx
  on public.predictive_usage_events (dealer_id, from_type, from_id, to_type, to_id, created_at desc);

create table if not exists public.predictive_transition_summaries (
  dealer_id text not null,
  from_type text not null,
  from_id text not null,
  to_type text not null,
  to_id text not null,
  transition_count integer not null default 0 check (transition_count >= 0),
  last_used_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (dealer_id, from_type, from_id, to_type, to_id)
);

alter table public.predictive_usage_events enable row level security;
alter table public.predictive_transition_summaries enable row level security;

drop policy if exists "predictive events dealer read" on public.predictive_usage_events;
create policy "predictive events dealer read"
on public.predictive_usage_events for select to authenticated
using (dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "predictive summaries dealer read" on public.predictive_transition_summaries;
create policy "predictive summaries dealer read"
on public.predictive_transition_summaries for select to authenticated
using (dealer_id = public.plotmap_current_dealer_id());

-- Writes go only through the scoped RPC. Direct table writes stay unavailable.
revoke all on table public.predictive_usage_events from anon, authenticated;
revoke all on table public.predictive_transition_summaries from anon, authenticated;
grant select on table public.predictive_usage_events to authenticated;
grant select on table public.predictive_transition_summaries to authenticated;

create or replace function public.plotmap_record_predictive_event(
  p_event_type text,
  p_session_id text,
  p_from_type text default null,
  p_from_id text default null,
  p_to_type text default null,
  p_to_id text default null,
  p_resource_type text default null,
  p_resource_id text default null,
  p_created_at timestamptz default timezone('utc'::text, now())
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_at timestamptz := greatest(
    least(coalesce(p_created_at, timezone('utc'::text, now())), timezone('utc'::text, now()) + interval '5 minutes'),
    timezone('utc'::text, now()) - interval '1 day'
  );
begin
  if auth.uid() is null or v_dealer = '' then raise exception 'not_authenticated'; end if;
  if p_event_type not in (
    'route-opened', 'city-opened', 'masterplan-opened', 'sector-opened',
    'property-opened', 'view-on-map', 'mode-selected',
    'client-link-started', 'client-link-property-added', 'transition'
  ) then raise exception 'unsupported_predictive_event'; end if;
  if char_length(trim(coalesce(p_session_id, ''))) not between 8 and 100 then raise exception 'invalid_session'; end if;

  insert into public.predictive_usage_events (
    dealer_id, actor_id, session_id, event_type,
    from_type, from_id, to_type, to_id, resource_type, resource_id, created_at
  ) values (
    v_dealer, auth.uid(), trim(p_session_id), p_event_type,
    nullif(left(trim(coalesce(p_from_type, '')), 40), ''),
    nullif(left(trim(coalesce(p_from_id, '')), 120), ''),
    nullif(left(trim(coalesce(p_to_type, '')), 40), ''),
    nullif(left(trim(coalesce(p_to_id, '')), 120), ''),
    nullif(left(trim(coalesce(p_resource_type, '')), 40), ''),
    nullif(left(trim(coalesce(p_resource_id, '')), 120), ''),
    v_at
  );

  if nullif(trim(coalesce(p_from_type, '')), '') is not null
     and nullif(trim(coalesce(p_from_id, '')), '') is not null
     and nullif(trim(coalesce(p_to_type, '')), '') is not null
     and nullif(trim(coalesce(p_to_id, '')), '') is not null then
    insert into public.predictive_transition_summaries (
      dealer_id, from_type, from_id, to_type, to_id, transition_count, last_used_at, updated_at
    ) values (
      v_dealer, left(trim(p_from_type), 40), left(trim(p_from_id), 120),
      left(trim(p_to_type), 40), left(trim(p_to_id), 120), 1, v_at, timezone('utc'::text, now())
    )
    on conflict (dealer_id, from_type, from_id, to_type, to_id) do update
      set transition_count = public.predictive_transition_summaries.transition_count + 1,
          last_used_at = greatest(public.predictive_transition_summaries.last_used_at, excluded.last_used_at),
          updated_at = timezone('utc'::text, now());
  end if;

  -- Time-bounded raw events. Summaries retain only counts and recency.
  delete from public.predictive_usage_events
   where dealer_id = v_dealer and created_at < timezone('utc'::text, now()) - interval '90 days';
end;
$$;

create or replace function public.plotmap_predictive_summaries(p_limit integer default 100)
returns table (
  from_type text, from_id text, to_type text, to_id text,
  transition_count integer, recent_score double precision, last_used_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.from_type, s.from_id, s.to_type, s.to_id, s.transition_count,
    least(1.0, ln(s.transition_count + 1)::double precision / ln(16)::double precision)
      * exp(-greatest(0, extract(epoch from (timezone('utc'::text, now()) - s.last_used_at))) / 1209600.0) as recent_score,
    s.last_used_at
  from public.predictive_transition_summaries s
  where s.dealer_id = public.plotmap_current_dealer_id()
  order by recent_score desc, s.last_used_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.plotmap_record_predictive_event(text,text,text,text,text,text,text,text,timestamptz) from public, anon;
revoke all on function public.plotmap_predictive_summaries(integer) from public, anon;
grant execute on function public.plotmap_record_predictive_event(text,text,text,text,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.plotmap_predictive_summaries(integer) to authenticated;
