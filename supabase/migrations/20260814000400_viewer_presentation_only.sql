-- The viewer role is Presentation-only. It may execute the safe presentation
-- projection, but must not bypass it through generic CRM or storage reads.
create or replace function public.plotmap_can_view_ai()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and public.plotmap_can_edit_crm()
     and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id());
$$;

revoke all on function public.plotmap_can_view_ai() from public, anon;
grant execute on function public.plotmap_can_view_ai() to authenticated, service_role;

-- Predictive history contains dealer-operational IDs. Presentation viewers may
-- contribute bounded usage signals for preloading, but cannot enumerate raw
-- rows or dealer-wide summaries. Suspended accounts cannot read or write it.
drop policy if exists "predictive events dealer read" on public.predictive_usage_events;
create policy "predictive events dealer read"
on public.predictive_usage_events for select to authenticated
using (
  public.plotmap_can_edit_crm()
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "predictive summaries dealer read" on public.predictive_transition_summaries;
create policy "predictive summaries dealer read"
on public.predictive_transition_summaries for select to authenticated
using (
  public.plotmap_can_edit_crm()
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.plotmap_record_predictive_event(text,text,text,text,text,text,text,text,timestamptz)'::regprocedure) into v_definition;
  v_updated := replace(
    v_definition,
    'auth.uid() is null or v_dealer = ''''',
    'auth.uid() is null or v_dealer = '''' or not public.plotmap_can_edit_crm() or not public.plotmap_dealer_is_active(v_dealer)'
  );
  if v_updated = v_definition or position('plotmap_dealer_is_active(v_dealer)' in v_updated) = 0 then
    raise exception 'plotmap_record_predictive_event definition did not match the expected secure baseline';
  end if;
  execute v_updated;
end;
$migration$;

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
    and public.plotmap_can_edit_crm()
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  order by recent_score desc, s.last_used_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.plotmap_record_predictive_event(text,text,text,text,text,text,text,text,timestamptz) from public, anon;
revoke all on function public.plotmap_predictive_summaries(integer) from public, anon;
grant execute on function public.plotmap_record_predictive_event(text,text,text,text,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.plotmap_predictive_summaries(integer) to authenticated;

drop policy if exists "plotmap crm member read" on public.crm_records;
create policy "plotmap crm member read"
on public.crm_records
for select
to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap photos member read" on storage.objects;
create policy "plotmap photos member read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-photos'
  and public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and public.plotmap_photo_dealer_id(name) = public.plotmap_current_dealer_id()
  and public.plotmap_property_photo_path_is_valid(name)
);

drop policy if exists "plotmap overlays member read" on public.map_overlays;
create policy "plotmap overlays member read" on public.map_overlays for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap prebuilt member read" on public.prebuilt_maps;
create policy "plotmap prebuilt member read" on public.prebuilt_maps for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap pevents member read" on public.presentation_events;
create policy "plotmap pevents member read" on public.presentation_events for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap dealer settings member read" on public.dealer_settings;
create policy "plotmap dealer settings member read" on public.dealer_settings for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap share links member read" on public.share_links;
create policy "plotmap share links member read" on public.share_links for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap audit logs member read" on public.audit_logs;
create policy "plotmap audit logs member read" on public.audit_logs for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap client link events member read" on public.client_link_events;
create policy "plotmap client link events member read" on public.client_link_events for select to authenticated
using (
  public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and dealer_id = public.plotmap_current_dealer_id()
);

drop policy if exists "plotmap client link audio member read" on storage.objects;
create policy "plotmap client link audio member read" on storage.objects for select to authenticated
using (
  bucket_id = 'client-link-audio'
  and public.plotmap_is_active_member()
  and public.plotmap_current_role() <> 'viewer'
  and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
  and public.plotmap_client_link_audio_path_is_valid(name)
);

-- `plotmap_list_client_links` is SECURITY DEFINER, so harden its own guard in
-- addition to the table policies above. This preserves its latest return shape.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.plotmap_list_client_links(text)'::regprocedure) into v_definition;
  v_updated := replace(
    v_definition,
    'auth.uid() IS NULL OR NOT public.plotmap_is_active_member()',
    'auth.uid() IS NULL OR NOT public.plotmap_client_link_can_manage()'
  );
  v_updated := replace(
    v_updated,
    'auth.uid() is null or not public.plotmap_is_active_member()',
    'auth.uid() is null or not public.plotmap_client_link_can_manage()'
  );
  if v_updated = v_definition or position('plotmap_is_active_member()' in v_updated) > 0 then
    raise exception 'plotmap_list_client_links definition did not match the expected secure baseline';
  end if;
  execute v_updated;
end;
$migration$;

revoke all on function public.plotmap_list_client_links(text) from public, anon;
grant execute on function public.plotmap_list_client_links(text) to authenticated;

-- Optional AI/marketing modules may already exist on an upgraded deployment.
-- Keep their generic dealer tables outside the Presentation-only viewer role
-- without requiring those modules to be installed on a fresh MAPCO database.
do $migration$
declare
  v_item record;
begin
  for v_item in select * from (values
    ('ai_settings', 'ai settings dealer read'),
    ('ai_quotas', 'ai quotas dealer read'),
    ('ai_jobs', 'ai jobs dealer read'),
    ('ai_executions', 'ai executions dealer read'),
    ('ai_usage_daily', 'ai usage dealer read'),
    ('ai_artifacts', 'ai artifacts dealer read'),
    ('ai_action_proposals', 'ai action proposals dealer read'),
    ('ai_action_audit', 'ai action audit dealer read'),
    ('marketing_content_contexts', 'marketing contexts dealer read'),
    ('marketing_creatives', 'marketing creatives dealer read'),
    ('marketing_schedule_items', 'marketing schedule dealer read'),
    ('marketing_publications', 'marketing publications dealer read'),
    ('marketing_channel_accounts', 'marketing channels dealer read'),
    ('external_performance_metrics', 'external performance dealer read')
  ) as x(table_name, policy_name)
  loop
    if to_regclass('public.' || v_item.table_name) is not null then
      execute format('drop policy if exists %I on public.%I', v_item.policy_name, v_item.table_name);
      execute format(
        'create policy %I on public.%I for select to authenticated using '
        || '(public.plotmap_can_view_ai() '
        || 'and dealer_id = public.plotmap_current_dealer_id())',
        v_item.policy_name, v_item.table_name
      );
    end if;
  end loop;
end;
$migration$;

-- Browser-facing AI RPCs are SECURITY DEFINER and therefore need their own
-- capability check; RLS alone cannot constrain them. Service-only helpers are
-- intentionally absent from this list.
do $migration$
declare
  v_item record;
  v_definition text;
  v_updated text;
begin
  for v_item in select column1 as signature from (values
    ('public.plotmap_ai_status()'),
    ('public.plotmap_ai_usage_summary(integer)'),
    ('public.plotmap_ai_current_artifact(text,text)'),
    ('public.plotmap_ai_artifact_history(text,integer)'),
    ('public.plotmap_ai_pending_actions(integer)'),
    ('public.plotmap_ai_context_facts(integer,integer)'),
    ('public.plotmap_ai_marketing_facts(text)')
  ) as signatures
  loop
    if to_regprocedure(v_item.signature) is null then continue; end if;
    select pg_get_functiondef(to_regprocedure(v_item.signature)) into v_definition;
    v_updated := replace(
      v_definition,
      'public.plotmap_is_active_member()',
      'public.plotmap_can_view_ai()'
    );
    if v_updated = v_definition or position('public.plotmap_is_active_member()' in v_updated) > 0 then
      raise exception '% definition did not match the expected secure baseline', v_item.signature;
    end if;
    execute v_updated;
  end loop;
end;
$migration$;

-- Action decisions were already owner/manager-only, but the SECURITY DEFINER
-- function must also honour dealer suspension/expiry.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  if to_regprocedure('public.plotmap_ai_decide_action(uuid,text,text)') is null then return; end if;
  select pg_get_functiondef('public.plotmap_ai_decide_action(uuid,text,text)'::regprocedure) into v_definition;
  v_updated := replace(
    v_definition,
    'if not public.plotmap_can_edit_crm() then',
    'if not public.plotmap_can_edit_crm() or not public.plotmap_dealer_can_write(v_dealer) then'
  );
  if v_updated = v_definition or position('plotmap_dealer_can_write(v_dealer)' in v_updated) = 0 then
    raise exception 'plotmap_ai_decide_action definition did not match the expected secure baseline';
  end if;
  execute v_updated;
end;
$migration$;
