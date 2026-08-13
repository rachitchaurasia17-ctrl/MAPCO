-- Client Presentation receives an explicit published-map projection and
-- published/client-visible highlight sets only. Dealer/map-editor catalogs stay
-- on their existing private repository. These leaf sanitizers keep hostile or
-- legacy JSON from crossing that projection as unbounded nested objects.
create or replace function public.plotmap_presentation_dimension(p_value jsonb)
returns integer
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $function$
declare
  v_number numeric;
begin
  if jsonb_typeof(p_value) <> 'number' then return null; end if;
  begin
    v_number := p_value::text::numeric;
  exception when others then
    return null;
  end;
  if v_number < 1 or v_number > 100000 or trunc(v_number) <> v_number then
    return null;
  end if;
  return v_number::integer;
end;
$function$;

create or replace function public.plotmap_presentation_asset_path(p_value text)
returns text
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $function$
declare
  v_path text := btrim(p_value);
begin
  if v_path = '' or octet_length(v_path) > 2048 or v_path ~ '[[:cntrl:]]' then
    return null;
  end if;
  if v_path ~ '^https://[^[:space:]]+$'
     or v_path ~ '^/[[:alnum:]][[:alnum:]_.~/%+@=-]*$'
     or v_path ~ '^[[:alnum:]][[:alnum:]_.~/%+@=-]*$' then
    return v_path;
  end if;
  return null;
end;
$function$;

revoke all on function public.plotmap_presentation_dimension(jsonb) from public, anon, authenticated;
revoke all on function public.plotmap_presentation_asset_path(text) from public, anon, authenticated;

create or replace function public.plotmap_presentation_maps(p_map_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_dealer_id text := public.plotmap_current_dealer_id();
  v_items jsonb;
begin
  if auth.uid() is null or v_dealer_id is null
     or not public.plotmap_is_active_member()
     or not public.plotmap_dealer_is_active(v_dealer_id) then
    raise exception 'presentation map access denied';
  end if;
  if p_map_id is not null and (nullif(trim(p_map_id), '') is null or length(p_map_id) > 160) then
    raise exception 'invalid map id';
  end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', m.id,
    'kind', m.kind,
    'city', left(nullif(btrim(m.city), ''), 80),
    'sector', left(nullif(btrim(m.sector), ''), 120),
    'area', left(nullif(btrim(m.area), ''), 120),
    'label', left(nullif(btrim(m.label), ''), 160),
    'parent_map_id', case when length(m.parent_map_id) <= 160 then nullif(btrim(m.parent_map_id), '') else null end,
    'raster', paths.original_path,
    'assets', nested.safe_assets,
    'dims', nested.safe_dims,
    'calibration', case when nested.safe_calibration <> '{}'::jsonb then nested.safe_calibration else null end,
    'published', true,
    'hidden', false
  )) order by m.kind, coalesce(m.created_at, timezone('utc'::text, now())) asc), '[]'::jsonb)
    into v_items
  from (
    select
      candidate.id, candidate.kind, candidate.city, candidate.sector, candidate.area,
      candidate.label, candidate.parent_map_id, candidate.raster, candidate.created_at,
      candidate.assets #> '{original,path}' as asset_original_path,
      candidate.assets #> '{original,w}' as asset_original_w,
      candidate.assets #> '{original,h}' as asset_original_h,
      candidate.assets #> '{threeD,path}' as asset_threed_path,
      candidate.assets #> '{threeD,w}' as asset_threed_w,
      candidate.assets #> '{threeD,h}' as asset_threed_h,
      candidate.assets #> '{overlay,path}' as asset_overlay_path,
      candidate.assets #> '{overlay,w}' as asset_overlay_w,
      candidate.assets #> '{overlay,h}' as asset_overlay_h,
      candidate.dims #> '{original,w}' as dims_original_w,
      candidate.dims #> '{original,h}' as dims_original_h,
      candidate.dims #> '{threeD,w}' as dims_threed_w,
      candidate.dims #> '{threeD,h}' as dims_threed_h,
      candidate.payload #> '{calibration,status}' as calibration_status,
      candidate.payload #> '{calibration,overlayViewBox,w}' as calibration_overlay_w,
      candidate.payload #> '{calibration,overlayViewBox,h}' as calibration_overlay_h,
      candidate.payload #> '{calibration,raster,w}' as calibration_raster_w,
      candidate.payload #> '{calibration,raster,h}' as calibration_raster_h
    from public.prebuilt_maps candidate
    where candidate.dealer_id = v_dealer_id
      and candidate.status = 'published'
      and candidate.client_visible = true
      and coalesce(candidate.deleted, false) = false
      and candidate.kind in ('masterplan', 'sector')
      and length(candidate.id) between 1 and 160
      and (p_map_id is null or candidate.id = p_map_id)
    order by candidate.kind, coalesce(candidate.created_at, timezone('utc'::text, now())) asc
    limit 500
  ) m
  cross join lateral (
    select
      coalesce(
        public.plotmap_presentation_asset_path(case
          when jsonb_typeof(m.asset_original_path) = 'string' then m.asset_original_path #>> '{}'
          else null end),
        public.plotmap_presentation_asset_path(m.raster)
      ) as original_path,
      public.plotmap_presentation_asset_path(case
        when jsonb_typeof(m.asset_threed_path) = 'string' then m.asset_threed_path #>> '{}'
        else null end) as threed_path,
      public.plotmap_presentation_asset_path(case
        when jsonb_typeof(m.asset_overlay_path) = 'string' then m.asset_overlay_path #>> '{}'
        else null end) as overlay_path
  ) paths
  cross join lateral (
    select
      coalesce(public.plotmap_presentation_dimension(m.asset_original_w), public.plotmap_presentation_dimension(m.dims_original_w)) as original_w,
      coalesce(public.plotmap_presentation_dimension(m.asset_original_h), public.plotmap_presentation_dimension(m.dims_original_h)) as original_h,
      coalesce(public.plotmap_presentation_dimension(m.asset_threed_w), public.plotmap_presentation_dimension(m.dims_threed_w)) as threed_w,
      coalesce(public.plotmap_presentation_dimension(m.asset_threed_h), public.plotmap_presentation_dimension(m.dims_threed_h)) as threed_h,
      public.plotmap_presentation_dimension(m.asset_overlay_w) as overlay_w,
      public.plotmap_presentation_dimension(m.asset_overlay_h) as overlay_h,
      public.plotmap_presentation_dimension(m.calibration_overlay_w) as calibration_overlay_w,
      public.plotmap_presentation_dimension(m.calibration_overlay_h) as calibration_overlay_h,
      public.plotmap_presentation_dimension(m.calibration_raster_w) as calibration_raster_w,
      public.plotmap_presentation_dimension(m.calibration_raster_h) as calibration_raster_h
  ) dimensions
  cross join lateral (
    select
      jsonb_strip_nulls(jsonb_build_object(
        'original', case when paths.original_path is not null then jsonb_strip_nulls(jsonb_build_object(
          'path', paths.original_path,
          'w', case when dimensions.original_w is not null and dimensions.original_h is not null then dimensions.original_w else null end,
          'h', case when dimensions.original_w is not null and dimensions.original_h is not null then dimensions.original_h else null end
        )) else null end,
        'threeD', case when paths.threed_path is not null then jsonb_strip_nulls(jsonb_build_object(
          'path', paths.threed_path,
          'w', case when dimensions.threed_w is not null and dimensions.threed_h is not null then dimensions.threed_w else null end,
          'h', case when dimensions.threed_w is not null and dimensions.threed_h is not null then dimensions.threed_h else null end
        )) else null end,
        'overlay', case when paths.overlay_path is not null then jsonb_strip_nulls(jsonb_build_object(
          'path', paths.overlay_path,
          'w', case when dimensions.overlay_w is not null and dimensions.overlay_h is not null then dimensions.overlay_w else null end,
          'h', case when dimensions.overlay_w is not null and dimensions.overlay_h is not null then dimensions.overlay_h else null end
        )) else null end
      )) as safe_assets,
      jsonb_strip_nulls(jsonb_build_object(
        'original', case when dimensions.original_w is not null and dimensions.original_h is not null
          then jsonb_build_object('w', dimensions.original_w, 'h', dimensions.original_h) else null end,
        'threeD', case when dimensions.threed_w is not null and dimensions.threed_h is not null
          then jsonb_build_object('w', dimensions.threed_w, 'h', dimensions.threed_h) else null end
      )) as safe_dims,
      jsonb_strip_nulls(jsonb_build_object(
        'status', case
          when jsonb_typeof(m.calibration_status) = 'string'
           and m.calibration_status #>> '{}' in ('calibrated', 'needs-review', 'unavailable')
          then m.calibration_status #>> '{}' else null end,
        'overlayViewBox', case
          when dimensions.calibration_overlay_w is not null and dimensions.calibration_overlay_h is not null
          then jsonb_build_object('w', dimensions.calibration_overlay_w, 'h', dimensions.calibration_overlay_h)
          else null end,
        'raster', case
          when dimensions.calibration_raster_w is not null and dimensions.calibration_raster_h is not null
          then jsonb_build_object('w', dimensions.calibration_raster_w, 'h', dimensions.calibration_raster_h)
          else null end
      )) as safe_calibration
  ) nested
  where paths.original_path is not null;

  return v_items;
end;
$function$;

create or replace function public.plotmap_presentation_map(p_map_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_maps jsonb;
  v_map jsonb;
  v_sets jsonb;
begin
  if p_map_id is null or nullif(btrim(p_map_id), '') is null or length(p_map_id) > 160 then
    raise exception 'invalid map id';
  end if;
  v_maps := public.plotmap_presentation_maps(p_map_id);
  v_map := v_maps -> 0;
  if v_map is null then return jsonb_build_object('ok', false); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'name', left(coalesce(nullif(trim(o.name), ''), 'Highlights'), 120),
    'payload', jsonb_build_object(
      'itemIds', safe_items.item_ids,
      'accent', case
        when jsonb_typeof(o.payload_accent) = 'string'
         and btrim(o.payload_accent #>> '{}') ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
        then btrim(o.payload_accent #>> '{}') else '#F59E0B' end,
      'labels', safe_labels.labels
    )
  ) order by o.updated_at asc), '[]'::jsonb)
    into v_sets
  from (
    select candidate.id, candidate.name, candidate.updated_at,
      candidate.payload -> 'itemIds' as payload_item_ids,
      candidate.payload -> 'marks' as payload_marks,
      candidate.payload -> 'accent' as payload_accent,
      candidate.payload -> 'labels' as payload_labels
    from public.map_overlays candidate
    where candidate.dealer_id = public.plotmap_current_dealer_id()
      and candidate.map_id = p_map_id
      and candidate.kind = 'highlight-set'
      and candidate.status = 'published'
      and candidate.client_visible = true
      and coalesce(candidate.deleted, false) = false
      and length(candidate.id) between 1 and 160
    order by candidate.updated_at asc
    limit 50
  ) o
  cross join lateral (
    select
      case
        when jsonb_typeof(o.payload_item_ids) = 'array' then o.payload_item_ids
        when jsonb_typeof(o.payload_marks) = 'array' then o.payload_marks
        else '[]'::jsonb end as raw_item_ids,
      case when jsonb_typeof(o.payload_labels) = 'object'
        then o.payload_labels else '{}'::jsonb end as raw_labels
  ) raw
  cross join lateral (
    select coalesce(jsonb_agg(to_jsonb(sanitized.item_id) order by sanitized.first_ordinal), '[]'::jsonb) as item_ids
    from (
      select candidate.item_id, min(candidate.ordinal) as first_ordinal
      from (
        select ordinal,
          btrim(raw.raw_item_ids ->> ordinal) as item_id,
          raw.raw_item_ids -> ordinal as raw_item
        from generate_series(0, least(jsonb_array_length(raw.raw_item_ids) - 1, 499)) as positions(ordinal)
      ) candidate
      where jsonb_typeof(candidate.raw_item) = 'string'
        and candidate.item_id <> ''
        and length(candidate.item_id) <= 160
        and candidate.item_id !~ '[[:cntrl:]]'
      group by candidate.item_id
    ) sanitized
  ) safe_items
  cross join lateral (
    select coalesce(jsonb_object_agg(sanitized.item_id, sanitized.label order by sanitized.ordinal), '{}'::jsonb) as labels
    from (
      select selected.item_id, selected.ordinal,
        left(btrim(raw.raw_labels ->> selected.item_id), 120) as label,
        raw.raw_labels -> selected.item_id as raw_label
      from jsonb_array_elements_text(safe_items.item_ids) with ordinality as selected(item_id, ordinal)
    ) sanitized
    where jsonb_typeof(sanitized.raw_label) = 'string'
      and sanitized.label <> ''
      and sanitized.label !~ '[[:cntrl:]]'
  ) safe_labels;

  return jsonb_build_object('ok', true, 'map', v_map, 'sets', v_sets);
end;
$function$;

revoke all on function public.plotmap_presentation_maps(text) from public, anon;
revoke all on function public.plotmap_presentation_map(text) from public, anon;
grant execute on function public.plotmap_presentation_maps(text) to authenticated;
grant execute on function public.plotmap_presentation_map(text) to authenticated;

-- Correct the legacy helper as defense in depth for any remaining callers.
create or replace function public.plotmap_published_overlays(p_map_id text)
returns setof public.map_overlays
language sql
stable
security definer
set search_path = public
as $$
  select o.* from public.map_overlays o
  join public.prebuilt_maps m on m.id = o.map_id and m.dealer_id = o.dealer_id
  where o.dealer_id = public.plotmap_current_dealer_id()
    and auth.uid() is not null
    and public.plotmap_is_active_member()
    and public.plotmap_current_role() <> 'viewer'
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and o.map_id = p_map_id
    and o.status = 'published'
    and o.client_visible = true
    and coalesce(o.deleted, false) = false
    and m.status = 'published'
    and m.client_visible = true
    and coalesce(m.deleted, false) = false
  order by o.updated_at asc;
$$;

revoke all on function public.plotmap_published_overlays(text) from public, anon;
grant execute on function public.plotmap_published_overlays(text) to authenticated;

-- Legacy dealer-map RPCs remain available to operational roles, but blocked,
-- suspended, and Presentation-only viewer accounts cannot bypass the safe map
-- projection through them.
create or replace function public.plotmap_published_maps()
returns setof public.prebuilt_maps
language sql
stable
security definer
set search_path = public
as $$
  select * from public.prebuilt_maps
  where auth.uid() is not null
    and public.plotmap_is_active_member()
    and public.plotmap_current_role() <> 'viewer'
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and dealer_id = public.plotmap_current_dealer_id()
    and status = 'published'
    and client_visible = true
    and coalesce(deleted, false) = false
  order by kind, coalesce(created_at, timezone('utc'::text, now())) asc;
$$;

create or replace function public.plotmap_dealer_maps()
returns setof public.prebuilt_maps
language sql
stable
security definer
set search_path = public
as $$
  select * from public.prebuilt_maps
  where auth.uid() is not null
    and public.plotmap_is_active_member()
    and public.plotmap_current_role() <> 'viewer'
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and dealer_id = public.plotmap_current_dealer_id()
  order by kind, coalesce(city, ''), coalesce(created_at, timezone('utc'::text, now())) asc;
$$;

revoke all on function public.plotmap_published_maps() from public, anon;
revoke all on function public.plotmap_dealer_maps() from public, anon;
grant execute on function public.plotmap_published_maps() to authenticated;
grant execute on function public.plotmap_dealer_maps() to authenticated;
