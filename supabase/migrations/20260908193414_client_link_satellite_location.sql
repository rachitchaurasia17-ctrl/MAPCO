-- Reuse the exact-location, token-scoped map boundary for a satellite pin.
-- No AI generation or manual duplicate coordinate entry is required.
create or replace function public.plotmap_resolve_client_link_maps(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.share_links%rowtype;
  v_property record;
  v_placement_map public.prebuilt_maps%rowtype;
  v_master_id text;
  v_sector_id text;
  v_placement_id text;
  v_x numeric;
  v_y numeric;
  v_binding jsonb;
  v_bindings jsonb := '[]'::jsonb;
  v_map_ids text[] := '{}';
  v_maps jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' then
    return null;
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_link
  from public.share_links s
  where s.token_hash = encode(extensions.digest(lower(p_token), 'sha256'), 'hex')
    and s.target_type = 'client_link'
    and s.status = 'active'
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > timezone('utc', now()))
    and public.plotmap_dealer_is_active(s.dealer_id)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  -- Precise location OFF is a hard boundary: no map IDs, assets or coordinates.
  if coalesce(v_link.metadata -> 'client_snapshot' -> 'visibility' ->> 'location', 'area') <> 'exact' then
    return jsonb_build_object('ok', true, 'maps', '[]'::jsonb, 'bindings', '[]'::jsonb);
  end if;

  for v_property in
    select x.ord - 1 as index, r.payload,
      v_link.metadata -> 'client_snapshot' -> 'properties' -> (x.ord - 1)::integer as snapshot_property
    from unnest(v_link.property_ids) with ordinality as x(id, ord)
    join public.crm_records r
      on r.id = x.id
     and r.dealer_id = v_link.dealer_id
     and r.entity_type = 'properties'
     and coalesce(r.deleted, false) = false
      and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'
      and lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'
      and coalesce(r.payload ->> 'lifecycle', 'on-sale') not in ('sold', 'draft', 'archived')
    order by x.ord
  loop
    v_master_id := null;
    v_sector_id := null;
    v_placement_id := nullif(trim(coalesce(
      v_property.snapshot_property -> 'placement' ->> 'mapId',
      v_property.payload -> 'mapPlacement' ->> 'mapId'
    )), '');
    v_x := null;
    v_y := null;
    v_placement_map := null;

    select m.id into v_master_id
    from public.prebuilt_maps m
    where m.id = nullif(trim(coalesce(v_property.snapshot_property ->> 'masterplanId', v_property.payload ->> 'masterplanId')), '')
      and m.dealer_id = v_link.dealer_id
      and m.kind = 'masterplan' and m.status = 'published'
      and m.client_visible = true and coalesce(m.deleted, false) = false;

    select m.id into v_sector_id
    from public.prebuilt_maps m
    where m.id = nullif(trim(coalesce(v_property.snapshot_property ->> 'sectorMapId', v_property.payload ->> 'sectorMapId')), '')
      and m.dealer_id = v_link.dealer_id
      and m.kind = 'sector' and m.status = 'published'
      and m.client_visible = true and coalesce(m.deleted, false) = false;

    if v_placement_id is not null then
      select * into v_placement_map
      from public.prebuilt_maps m
      where m.id = v_placement_id
        and m.dealer_id = v_link.dealer_id
        and m.status = 'published'
        and m.client_visible = true
        and coalesce(m.deleted, false) = false;
      if v_placement_map.id is null then v_placement_id := null; end if;
    end if;

    if v_placement_map.id is not null and v_placement_map.kind = 'sector' and v_sector_id is null then
      v_sector_id := v_placement_map.id;
    elsif v_placement_map.id is not null and v_placement_map.kind = 'masterplan' and v_master_id is null then
      v_master_id := v_placement_map.id;
    end if;

    if v_master_id is null and v_sector_id is not null then
      select parent.id into v_master_id
      from public.prebuilt_maps sector
      join public.prebuilt_maps parent
        on parent.id = sector.parent_map_id
       and parent.dealer_id = sector.dealer_id
       and parent.kind = 'masterplan'
       and parent.status = 'published'
       and parent.client_visible = true
       and coalesce(parent.deleted, false) = false
      where sector.id = v_sector_id and sector.dealer_id = v_link.dealer_id;
    end if;

    if v_placement_id is not null
       and coalesce(v_property.snapshot_property -> 'placement' ->> 'x', v_property.payload -> 'mapPlacement' ->> 'x', '') ~ '^[0-9]+([.][0-9]+)?$'
       and coalesce(v_property.snapshot_property -> 'placement' ->> 'y', v_property.payload -> 'mapPlacement' ->> 'y', '') ~ '^[0-9]+([.][0-9]+)?$' then
      v_x := coalesce(v_property.snapshot_property -> 'placement' ->> 'x', v_property.payload -> 'mapPlacement' ->> 'x')::numeric;
      v_y := coalesce(v_property.snapshot_property -> 'placement' ->> 'y', v_property.payload -> 'mapPlacement' ->> 'y')::numeric;
      if v_x < 0 or v_x > 1 or v_y < 0 or v_y > 1 then
        v_x := null; v_y := null;
      end if;
    end if;

    v_binding := jsonb_strip_nulls(jsonb_build_object(
      'index', v_property.index,
      'location', case when v_property.payload -> 'location' is not null
        and public.plotmap_property_location_is_valid(v_property.payload)
        then jsonb_build_object(
          'latitude', v_property.payload -> 'location' -> 'latitude',
          'longitude', v_property.payload -> 'location' -> 'longitude')
        else null end,
      'masterplanId', v_master_id,
      'sectorMapId', v_sector_id,
      'placement', case when v_placement_id is not null and v_x is not null and v_y is not null
        then jsonb_build_object('mapId', v_placement_id, 'x', v_x, 'y', v_y)
        else null end
    ));
    v_bindings := v_bindings || jsonb_build_array(v_binding);
    if v_master_id is not null then v_map_ids := array_append(v_map_ids, v_master_id); end if;
    if v_sector_id is not null then v_map_ids := array_append(v_map_ids, v_sector_id); end if;
    if v_placement_id is not null then v_map_ids := array_append(v_map_ids, v_placement_id); end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', m.id,
    'kind', m.kind,
    'city', left(m.city, 80),
    'sector', left(m.sector, 120),
    'area', left(m.area, 120),
    'label', left(m.label, 160),
    'parentMapId', m.parent_map_id,
    'raster', coalesce(m.assets -> 'original' ->> 'path', m.raster),
    'assets', jsonb_strip_nulls(jsonb_build_object(
      'original', case when coalesce(m.assets -> 'original' ->> 'path', m.raster) ~ '^https://'
        then jsonb_strip_nulls(jsonb_build_object(
          'path', coalesce(m.assets -> 'original' ->> 'path', m.raster),
          'w', coalesce((m.assets -> 'original' ->> 'w')::integer, (m.dims -> 'original' ->> 'w')::integer),
          'h', coalesce((m.assets -> 'original' ->> 'h')::integer, (m.dims -> 'original' ->> 'h')::integer)
        )) else null end,
      'threeD', case when coalesce(m.assets -> 'threeD' ->> 'path', '') ~ '^https://'
        then jsonb_strip_nulls(jsonb_build_object(
          'path', m.assets -> 'threeD' ->> 'path',
          'w', coalesce((m.assets -> 'threeD' ->> 'w')::integer, (m.dims -> 'threeD' ->> 'w')::integer),
          'h', coalesce((m.assets -> 'threeD' ->> 'h')::integer, (m.dims -> 'threeD' ->> 'h')::integer)
        )) else null end
    )),
    'dims', jsonb_strip_nulls(jsonb_build_object(
      'original', m.dims -> 'original',
      'threeD', case when coalesce(m.assets -> 'threeD' ->> 'path', '') ~ '^https://' then m.dims -> 'threeD' else null end
    ))
  )) order by case when m.kind = 'masterplan' then 0 else 1 end, m.id), '[]'::jsonb)
  into v_maps
  from public.prebuilt_maps m
  where m.id in (select distinct unnest(v_map_ids))
    and m.dealer_id = v_link.dealer_id
    and m.status = 'published'
    and m.client_visible = true
    and coalesce(m.deleted, false) = false
    and coalesce(m.assets -> 'original' ->> 'path', m.raster, '') ~ '^https://';

  return jsonb_build_object('ok', true, 'maps', v_maps, 'bindings', v_bindings);
end;
$$;

revoke all on function public.plotmap_resolve_client_link_maps(text) from public, anon, authenticated;
grant execute on function public.plotmap_resolve_client_link_maps(text) to service_role;

-- Preserve the current creator, including previous price/privacy fixes.
do $migration$
declare
  definition text;
  old_fragment text := '''visibility'', jsonb_build_object(''price'', v_price_visibility, ''location'', v_location_visibility)';
  new_fragment text := '''visibility'', jsonb_build_object(''price'', v_price_visibility, ''location'', v_location_visibility, ''intelligence'', coalesce(p_payload -> ''includeIntelligence'', ''true''::jsonb) = ''true''::jsonb)';
begin
  select pg_get_functiondef('public.plotmap_create_client_link(jsonb)'::regprocedure) into definition;
  if position(old_fragment in definition) = 0 then
    raise exception 'Expected client-link visibility baseline was not found';
  end if;
  execute replace(definition, old_fragment, new_fragment);
end;
$migration$;

