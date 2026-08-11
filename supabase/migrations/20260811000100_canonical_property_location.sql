-- ============================================================
-- MAPCO · Canonical real-world property location
-- ------------------------------------------------------------
-- The property remains one dealer-scoped crm_records row. Its
-- authoritative Earth coordinate is payload.location:
--   { latitude, longitude, source?, updatedAt? }
-- Masterplan payload.mapPlacement{x,y} remains an independent
-- image/SVG coordinate system and is intentionally untouched.
-- ============================================================

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
    when p_payload -> 'location' ? 'source'
      and coalesce(p_payload -> 'location' ->> 'source', '') not in
        ('dealer-selected', 'manually-verified', 'imported', 'migrated') then false
    when p_payload -> 'location' ? 'updatedAt'
      and jsonb_typeof(p_payload -> 'location' -> 'updatedAt') <> 'string' then false
    else true
  end;
$$;

alter table public.crm_records
  drop constraint if exists crm_records_property_location_valid;
alter table public.crm_records
  add constraint crm_records_property_location_valid
  check (
    entity_type <> 'properties'
    or public.plotmap_property_location_is_valid(payload)
  ) not valid;
alter table public.crm_records
  validate constraint crm_records_property_location_valid;

-- Deterministic compatibility backfill only. These are the five exact legacy
-- MAPCO Earth fixture IDs, additionally guarded by their city + sector identity.
-- No area/sector centroid or inferred coordinate is ever written.
with legacy_location(id, city, sector_token, latitude, longitude) as (
  values
    ('p1', 'Mohali', 'sector 78', 30.6889::numeric, 76.7361::numeric),
    ('p2', 'Mohali', 'sector 88', 30.6743::numeric, 76.7189::numeric),
    ('p3', 'Mohali', 'sector 89', 30.6698::numeric, 76.7147::numeric),
    ('p4', 'Mohali', 'sector 79', 30.6842::numeric, 76.7442::numeric),
    ('p5', 'Mohali', 'sector 68', 30.7061::numeric, 76.7328::numeric)
)
update public.crm_records r
set payload = jsonb_set(
      r.payload,
      '{location}',
      jsonb_build_object(
        'latitude', legacy_location.latitude,
        'longitude', legacy_location.longitude,
        'source', 'migrated',
        'updatedAt', now()
      ),
      true
    ),
    updated_at = timezone('utc'::text, now())
from legacy_location
where r.id = legacy_location.id
  and r.entity_type = 'properties'
  and r.deleted = false
  and (not (r.payload ? 'location') or r.payload -> 'location' = 'null'::jsonb)
  and lower(trim(coalesce(r.payload ->> 'city', ''))) = lower(legacy_location.city)
  and lower(coalesce(
        nullif(trim(r.payload ->> 'sector'), ''),
        nullif(trim(r.payload ->> 'loc'), ''),
        nullif(trim(r.payload ->> 'area'), ''),
        ''
      )) like '%' || legacy_location.sector_token || '%';

-- Atomic location-only writer. It is SECURITY INVOKER, so the existing
-- dealer ownership and property-editor RLS policies remain authoritative.
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
       or p_longitude not between -180 and 180 then
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
