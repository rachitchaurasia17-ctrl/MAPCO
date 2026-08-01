-- ============================================================
-- MAPCO V2 · Saved highlight sets + property unlink (Map Studio)
-- ------------------------------------------------------------
-- A "highlight set" is a named combination of authored SVG shape ids
-- (roads/blocks) the dealer curates in Map Studio → Publish Masterplan.
-- Each set becomes one state of the single cycling Highlights button in
-- Client Presentation. Stored as a map_overlays row (kind='highlight-set',
-- payload = { itemIds: text[], accent: text }). Dealer-scoped; per-dealer.
-- ============================================================

-- Upsert a highlight set for one of the dealer's maps.
create or replace function public.plotmap_save_highlight_set(p_payload jsonb)
returns public.map_overlays
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := coalesce(nullif(trim(p_payload ->> 'id'), ''), 'hlset-' || replace(gen_random_uuid()::text, '-', ''));
  v_map_id text := nullif(trim(p_payload ->> 'mapId'), '');
  v_row public.map_overlays%rowtype;
begin
  if auth.uid() is null or not public.plotmap_can_edit_maps() then
    raise exception 'map edit access denied';
  end if;
  if v_map_id is null then raise exception 'mapId required'; end if;
  -- the map must belong to this dealer
  if not exists (select 1 from public.prebuilt_maps where id = v_map_id and dealer_id = v_dealer and deleted = false) then
    raise exception 'map not found for this dealer';
  end if;

  insert into public.map_overlays (id, dealer_id, map_id, name, kind, payload, status, client_visible, deleted, updated_at)
  values (
    v_id, v_dealer, v_map_id,
    coalesce(nullif(trim(p_payload ->> 'name'), ''), 'Highlights'),
    'highlight-set',
    jsonb_build_object(
      'itemIds', coalesce(p_payload -> 'itemIds', '[]'::jsonb),
      'accent', coalesce(nullif(p_payload ->> 'accent', ''), '#F59E0B')
    ),
    'published', true, false, timezone('utc', now())
  )
  on conflict (id) do update set
    name = excluded.name,
    map_id = excluded.map_id,
    payload = excluded.payload,
    status = 'published',
    client_visible = true,
    deleted = false,
    updated_at = timezone('utc', now())
  where public.map_overlays.dealer_id = v_dealer
  returning * into v_row;

  if v_row.id is null then raise exception 'could not save highlight set'; end if;
  return v_row;
end;
$$;

-- Soft-delete a highlight set (dealer-scoped).
create or replace function public.plotmap_delete_highlight_set(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_dealer text := public.plotmap_current_dealer_id();
begin
  if auth.uid() is null or not public.plotmap_can_edit_maps() then
    raise exception 'map edit access denied';
  end if;
  update public.map_overlays
    set deleted = true, updated_at = timezone('utc', now())
    where id = p_id and dealer_id = v_dealer;
end;
$$;

-- List ALL of the dealer's overlays/sets for a map (Map Studio; every state).
create or replace function public.plotmap_dealer_overlays(p_map_id text)
returns setof public.map_overlays
language sql
stable
security definer
set search_path = public
as $$
  select * from public.map_overlays
  where dealer_id = public.plotmap_current_dealer_id()
    and map_id = p_map_id
    and deleted = false
  order by created_at asc;
$$;

-- Remove a property's map link + placement (Manage Published → unlink).
create or replace function public.plotmap_unlink_property_from_map(p_property_id text)
returns public.crm_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_row public.crm_records%rowtype;
begin
  if auth.uid() is null or not public.plotmap_can_edit_properties() then
    raise exception 'property edit access denied';
  end if;
  update public.crm_records
    set payload = (payload - 'masterplanId' - 'sectorMapId' - 'mapPlacement'),
        updated_at = timezone('utc', now())
    where id = p_property_id and dealer_id = v_dealer and entity_type = 'properties'
    returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.plotmap_save_highlight_set(jsonb) to authenticated;
grant execute on function public.plotmap_delete_highlight_set(text) to authenticated;
grant execute on function public.plotmap_dealer_overlays(text) to authenticated;
grant execute on function public.plotmap_unlink_property_from_map(text) to authenticated;
