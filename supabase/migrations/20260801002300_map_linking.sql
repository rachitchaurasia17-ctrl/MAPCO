-- ============================================================
-- MAPCO V2 · Map linking phase
-- ------------------------------------------------------------
-- Turns the map registry into a connected product:
--   • masterplan ↔ sector hierarchy (parent_map_id)
--   • per-map area + asset bundle (original / 3D / overlay paths + dims)
--   • map states: draft | published | hidden | archived (+ client_visible)
--   • properties link to a masterplan + sector map with normalized 0–1
--     placement (payload.masterplanId / sectorMapId / mapPlacement)
--   • dealer-side CRUD RPCs for Map Studio (create/update, set status,
--     link + place a property) — SECURITY DEFINER, re-checking dealer + role.
-- Public read RPCs (plotmap_client_maps/_overlays) already return m.*/o.*,
-- so they pick up the new columns automatically and stay client-safe.
-- ============================================================

-- ---------- schema: relationships + asset bundle ----------
alter table public.prebuilt_maps
  add column if not exists parent_map_id text,          -- sector → its masterplan
  add column if not exists area text,                   -- e.g. "Aerocity", "Sector 90-91"
  add column if not exists assets jsonb not null default '{}'::jsonb; -- {original:{path,w,h}, threeD:{path,w,h}, overlay:{path,w,h}}

create index if not exists prebuilt_maps_parent_idx on public.prebuilt_maps (dealer_id, parent_map_id);

-- ---------- dealer-side: create / update a map ----------
create or replace function public.plotmap_upsert_map(p_payload jsonb)
returns public.prebuilt_maps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := coalesce(nullif(trim(p_payload ->> 'id'), ''), 'map-' || replace(gen_random_uuid()::text, '-', ''));
  v_row public.prebuilt_maps%rowtype;
begin
  if auth.uid() is null or v_dealer is null or v_dealer = '' or not public.plotmap_can_edit_maps() then
    raise exception 'map edit access denied';
  end if;
  if p_payload ->> 'kind' not in ('masterplan', 'sector') then
    raise exception 'map kind must be masterplan or sector';
  end if;

  insert into public.prebuilt_maps as m
    (id, dealer_id, kind, city, sector, area, label, raster, dims, assets, parent_map_id,
     status, client_visible, deleted, updated_at)
  values (
    v_id, v_dealer, p_payload ->> 'kind',
    nullif(trim(p_payload ->> 'city'), ''), nullif(trim(p_payload ->> 'sector'), ''),
    nullif(trim(p_payload ->> 'area'), ''), nullif(trim(p_payload ->> 'label'), ''),
    nullif(trim(p_payload ->> 'raster'), ''),
    coalesce(p_payload -> 'dims', '{}'::jsonb), coalesce(p_payload -> 'assets', '{}'::jsonb),
    nullif(trim(p_payload ->> 'parentMapId'), ''),
    coalesce(nullif(p_payload ->> 'status', ''), 'draft'),
    coalesce((p_payload ->> 'clientVisible')::boolean, false), false, timezone('utc', now()))
  on conflict (id) do update set
    kind = excluded.kind, city = excluded.city, sector = excluded.sector, area = excluded.area,
    label = excluded.label, raster = excluded.raster, dims = excluded.dims, assets = excluded.assets,
    parent_map_id = excluded.parent_map_id, updated_at = timezone('utc', now())
  where m.dealer_id = v_dealer
  returning * into v_row;

  if v_row.id is null then raise exception 'map not found for this dealer'; end if;
  return v_row;
end;
$$;

-- ---------- dealer-side: publish / hide / archive ----------
create or replace function public.plotmap_set_map_status(p_map_id text, p_status text, p_client_visible boolean default null)
returns public.prebuilt_maps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_row public.prebuilt_maps%rowtype;
begin
  if auth.uid() is null or not public.plotmap_can_edit_maps() then
    raise exception 'map edit access denied';
  end if;
  if p_status not in ('draft', 'published', 'hidden', 'archived') then
    raise exception 'invalid map status';
  end if;
  update public.prebuilt_maps m set
    status = p_status,
    client_visible = coalesce(p_client_visible, case when p_status = 'published' then true else m.client_visible end),
    deleted = (p_status = 'archived'),
    updated_at = timezone('utc', now())
  where m.id = p_map_id and m.dealer_id = v_dealer
  returning * into v_row;
  if v_row.id is null then raise exception 'map not found for this dealer'; end if;
  return v_row;
end;
$$;

-- ---------- dealer-side: link + place a property on a map ----------
create or replace function public.plotmap_link_property_to_map(
  p_property_id text, p_map_id text, p_x numeric default null, p_y numeric default null)
returns public.crm_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_map public.prebuilt_maps%rowtype;
  v_row public.crm_records%rowtype;
  v_patch jsonb;
begin
  if auth.uid() is null or not public.plotmap_can_edit_properties() then
    raise exception 'property edit access denied';
  end if;
  select * into v_map from public.prebuilt_maps where id = p_map_id and dealer_id = v_dealer;
  if v_map.id is null then raise exception 'map not found for this dealer'; end if;
  if p_x is not null and (p_x < 0 or p_x > 1 or p_y < 0 or p_y > 1) then
    raise exception 'placement must be normalized 0..1';
  end if;

  -- masterplan link OR sector link, plus optional normalized placement.
  v_patch := jsonb_build_object(
    case when v_map.kind = 'masterplan' then 'masterplanId' else 'sectorMapId' end, p_map_id);
  if p_x is not null then
    v_patch := v_patch || jsonb_build_object('mapPlacement',
      jsonb_build_object('mapId', p_map_id, 'x', p_x, 'y', p_y));
  end if;

  update public.crm_records r set
    payload = r.payload || v_patch, updated_at = timezone('utc', now())
  where r.id = p_property_id and r.dealer_id = v_dealer and r.entity_type = 'properties'
  returning * into v_row;
  if v_row.id is null then raise exception 'property not found for this dealer'; end if;
  return v_row;
end;
$$;

-- ---------- dealer-side: list own maps (all states, for Map Studio) ----------
create or replace function public.plotmap_dealer_maps()
returns setof public.prebuilt_maps
language sql
stable
security definer
set search_path = public
as $$
  select * from public.prebuilt_maps
  where dealer_id = public.plotmap_current_dealer_id()
  order by kind, coalesce(city, ''), coalesce(created_at, timezone('utc', now())) asc;
$$;

grant execute on function public.plotmap_upsert_map(jsonb) to authenticated;
grant execute on function public.plotmap_set_map_status(text, text, boolean) to authenticated;
grant execute on function public.plotmap_link_property_to_map(text, text, numeric, numeric) to authenticated;
grant execute on function public.plotmap_dealer_maps() to authenticated;

-- ---------- public maps Storage bucket (rasters are not secret) ----------
-- Map rasters are public city masterplans shown to buyers; a PUBLIC bucket is
-- CDN-served and fast. Only PUBLISHED+client_visible maps are surfaced by the
-- read RPCs, so drafts never reach a buyer even though the asset URL is public.
insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do update set public = excluded.public;
