-- A missing Earth point is represented by no payload.location. (0, 0) is a
-- sentinel/default, never a dealer-selected property location.

create or replace function public.plotmap_property_location_is_valid(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when not (p_payload ? 'location') or p_payload -> 'location' = 'null'::jsonb then true
    when jsonb_typeof(p_payload -> 'location') <> 'object' then false
    when jsonb_typeof(p_payload -> 'location' -> 'latitude') <> 'number' then false
    when jsonb_typeof(p_payload -> 'location' -> 'longitude') <> 'number' then false
    when (p_payload -> 'location' ->> 'latitude')::numeric not between -90 and 90 then false
    when (p_payload -> 'location' ->> 'longitude')::numeric not between -180 and 180 then false
    when (p_payload -> 'location' ->> 'latitude')::numeric = 0
      and (p_payload -> 'location' ->> 'longitude')::numeric = 0 then false
    when p_payload -> 'location' ? 'source'
      and coalesce(p_payload -> 'location' ->> 'source', '') not in
        ('dealer-selected', 'manually-verified', 'imported', 'migrated') then false
    when p_payload -> 'location' ? 'updatedAt'
      and jsonb_typeof(p_payload -> 'location' -> 'updatedAt') <> 'string' then false
    else true
  end;
$$;

create or replace function public.plotmap_set_property_location(
  p_property_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_source text default 'dealer-selected'
)
returns public.crm_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.crm_records%rowtype;
  v_location jsonb;
begin
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'latitude and longitude must both be present or both be null';
  end if;

  if p_latitude is not null then
    if p_latitude not between -90 and 90
       or p_longitude not between -180 and 180
       or (p_latitude = 0 and p_longitude = 0) then
      raise exception 'invalid property coordinates';
    end if;
    if coalesce(p_source, '') not in
      ('dealer-selected', 'manually-verified', 'imported', 'migrated') then
      raise exception 'invalid property location source';
    end if;
    v_location := jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'source', p_source,
      'updatedAt', now()
    );
  end if;

  update public.crm_records r
  set payload = case
        when v_location is null then r.payload - 'location'
        else jsonb_set(r.payload, '{location}', v_location, true)
      end,
      updated_at = timezone('utc'::text, now())
  where r.id = p_property_id
    and r.entity_type = 'properties'
    and r.dealer_id = public.plotmap_current_dealer_id()
    and r.deleted = false
  returning r.* into v_row;

  return v_row;
end;
$$;

revoke all on function public.plotmap_set_property_location(text, double precision, double precision, text)
  from public, anon;
grant execute on function public.plotmap_set_property_location(text, double precision, double precision, text)
  to authenticated;
