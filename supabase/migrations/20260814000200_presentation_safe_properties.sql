-- Client Presentation must never download the dealer CRM property payload.
-- This authenticated, dealer-derived projection exposes only fields rendered in
-- the presentation. Canonical Earth coordinates stay private; callers receive
-- only hasEarthLocation and hand the property ID to MAPCO Earth.
create or replace function public.plotmap_presentation_properties(
  p_limit integer default 50,
  p_offset integer default 0,
  p_property_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  v_dealer_id text := public.plotmap_current_dealer_id();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_row record;
  v_approvals jsonb;
  v_landmarks jsonb;
  v_photos jsonb;
  v_placement jsonb;
  v_has_earth_location boolean;
begin
  if auth.uid() is null or v_dealer_id is null
     or not public.plotmap_is_active_member()
     or not public.plotmap_dealer_is_active(v_dealer_id) then
    raise exception 'presentation access denied';
  end if;
  if p_property_id is not null and (nullif(trim(p_property_id), '') is null or length(p_property_id) > 160) then
    raise exception 'invalid property id';
  end if;

  select count(*) into v_total
  from public.crm_records r
  where r.dealer_id = v_dealer_id
    and r.entity_type = 'properties'
    and coalesce(r.deleted, false) = false
    and lower(coalesce(r.payload ->> 'published', 'false')) = 'true'
    and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'
    and lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'
    and coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'
    and (p_property_id is null or r.id = p_property_id);

  for v_row in
    select r.id, r.payload
    from public.crm_records r
    where r.dealer_id = v_dealer_id
      and r.entity_type = 'properties'
      and coalesce(r.deleted, false) = false
      and lower(coalesce(r.payload ->> 'published', 'false')) = 'true'
      and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'
      and lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'
      and coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'
      and (p_property_id is null or r.id = p_property_id)
    order by r.updated_at desc, r.id desc
    limit v_limit offset v_offset
  loop
    select coalesce(jsonb_agg(to_jsonb(x.value) order by x.ord), '[]'::jsonb)
      into v_approvals
    from jsonb_array_elements_text(
      case when jsonb_typeof(v_row.payload -> 'approvals') = 'array'
        then v_row.payload -> 'approvals' else '[]'::jsonb end
    ) with ordinality as x(value, ord)
    where x.ord <= 20 and nullif(trim(x.value), '') is not null and length(x.value) <= 120;

    select coalesce(jsonb_agg(jsonb_build_object(
      'name', left(trim(x.value ->> 'name'), 120),
      'distance', left(trim(coalesce(x.value ->> 'distance', '')), 80),
      'icon', left(trim(coalesce(x.value ->> 'icon', '')), 80)
    ) order by x.ord), '[]'::jsonb)
      into v_landmarks
    from jsonb_array_elements(
      case when jsonb_typeof(v_row.payload -> 'landmarks') = 'array'
        then v_row.payload -> 'landmarks' else '[]'::jsonb end
    ) with ordinality as x(value, ord)
    where x.ord <= 20
      and jsonb_typeof(x.value) = 'object'
      and nullif(trim(x.value ->> 'name'), '') is not null;

    -- Only durable HTTPS photos enter the projection. Storage photos are
    -- separately validated and signed by the authenticated adapter.
    select coalesce(jsonb_agg(to_jsonb(x.value) order by x.ord), '[]'::jsonb)
      into v_photos
    from jsonb_array_elements_text(
      case when jsonb_typeof(v_row.payload -> 'photos') = 'array'
        then v_row.payload -> 'photos' else '[]'::jsonb end
    ) with ordinality as x(value, ord)
    where x.ord <= 8
      and x.value ~ '^https://'
      and length(x.value) <= 2048
      and x.value !~ '[?&]token=';

    v_placement := null;
    if jsonb_typeof(v_row.payload -> 'mapPlacement') = 'object'
       and nullif(trim(v_row.payload -> 'mapPlacement' ->> 'mapId'), '') is not null
       and jsonb_typeof(v_row.payload -> 'mapPlacement' -> 'x') = 'number'
       and jsonb_typeof(v_row.payload -> 'mapPlacement' -> 'y') = 'number'
       and (v_row.payload -> 'mapPlacement' ->> 'x')::numeric between 0 and 1
       and (v_row.payload -> 'mapPlacement' ->> 'y')::numeric between 0 and 1 then
      v_placement := jsonb_build_object(
        'mapId', left(trim(v_row.payload -> 'mapPlacement' ->> 'mapId'), 160),
        'x', (v_row.payload -> 'mapPlacement' ->> 'x')::numeric,
        'y', (v_row.payload -> 'mapPlacement' ->> 'y')::numeric
      );
    end if;

    -- Presentation-only viewers cannot open dealer Earth inventory; for every
    -- operational role this boolean enables the ID-only handoff without ever
    -- serializing coordinates.
    v_has_earth_location := public.plotmap_current_role() <> 'viewer'
      and jsonb_typeof(v_row.payload -> 'location') = 'object'
      and jsonb_typeof(v_row.payload -> 'location' -> 'latitude') = 'number'
      and jsonb_typeof(v_row.payload -> 'location' -> 'longitude') = 'number'
      and (v_row.payload -> 'location' ->> 'latitude')::numeric between -90 and 90
      and (v_row.payload -> 'location' ->> 'longitude')::numeric between -180 and 180;

    v_items := v_items || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', v_row.id,
      'type', left(trim(coalesce(v_row.payload ->> 'type', v_row.payload ->> 'propertyType', '')), 80),
      'city', left(trim(coalesce(v_row.payload ->> 'city', '')), 80),
      'area', left(trim(coalesce(v_row.payload ->> 'area', '')), 120),
      'loc', left(trim(coalesce(v_row.payload ->> 'loc', '')), 160),
      'sector', left(trim(coalesce(v_row.payload ->> 'sector', v_row.payload ->> 'block', '')), 120),
      'size', left(trim(coalesce(v_row.payload ->> 'size', '')), 80),
      'facing', left(trim(coalesce(v_row.payload ->> 'facing', '')), 80),
      'position', left(trim(coalesce(v_row.payload ->> 'position', v_row.payload ->> 'roadWidth', '')), 80),
      'approvals', v_approvals,
      'landmarks', v_landmarks,
      'photos', v_photos,
      'masterplanId', left(nullif(trim(v_row.payload ->> 'masterplanId'), ''), 160),
      'sectorMapId', left(nullif(trim(v_row.payload ->> 'sectorMapId'), ''), 160),
      'mapPlacement', v_placement,
      'hasEarthLocation', v_has_earth_location
    )));
  end loop;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'nextOffset', case
      when p_property_id is null and v_offset + jsonb_array_length(v_items) < v_total
        then v_offset + jsonb_array_length(v_items)
      else null
    end
  );
end;
$function$;

revoke all on function public.plotmap_presentation_properties(integer, integer, text) from public, anon;
grant execute on function public.plotmap_presentation_properties(integer, integer, text) to authenticated;

-- Service-only media lookup for the presentation-properties edge broker. Raw
-- object paths never reach the authenticated browser RPC.
create or replace function public.plotmap_presentation_property_media(p_property_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  v_result jsonb := '{}'::jsonb;
  v_dealer_ids text[];
  v_row record;
  v_paths jsonb;
begin
  if auth.role() <> 'service_role' or p_property_ids is null
     or cardinality(p_property_ids) > 50
     or cardinality(array(select distinct unnest(p_property_ids))) <> cardinality(p_property_ids) then
    raise exception 'presentation media access denied';
  end if;

  select array_agg(distinct r.dealer_id) into v_dealer_ids
  from public.crm_records r
  where r.id = any(p_property_ids)
    and r.entity_type = 'properties'
    and coalesce(r.deleted, false) = false;
  if coalesce(cardinality(v_dealer_ids), 0) <> 1 then
    raise exception 'presentation media scope is ambiguous';
  end if;

  for v_row in
    select r.id, r.dealer_id, r.payload
    from public.crm_records r
    where r.id = any(p_property_ids)
      and r.entity_type = 'properties'
      and r.dealer_id = v_dealer_ids[1]
      and coalesce(r.deleted, false) = false
      and lower(coalesce(r.payload ->> 'published', 'false')) = 'true'
      and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'
      and lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'
      and coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'
  loop
    select coalesce(jsonb_agg(to_jsonb(x.value ->> 'path') order by x.ord), '[]'::jsonb)
      into v_paths
    from jsonb_array_elements(
      case when jsonb_typeof(v_row.payload -> 'photoStorage') = 'array'
        then v_row.payload -> 'photoStorage' else '[]'::jsonb end
    ) with ordinality as x(value, ord)
    where jsonb_typeof(x.value) = 'object'
      and coalesce(x.value ->> 'kind', '') = 'storage'
      and public.plotmap_photo_dealer_id(x.value ->> 'path') = v_row.dealer_id
      and public.plotmap_photo_property_id(x.value ->> 'path') = v_row.id
      and public.plotmap_property_photo_path_is_valid(x.value ->> 'path');
    v_result := v_result || jsonb_build_object(v_row.id, v_paths);
  end loop;
  return v_result;
end;
$function$;

revoke all on function public.plotmap_presentation_property_media(text[]) from public, anon, authenticated;
grant execute on function public.plotmap_presentation_property_media(text[]) to service_role;
