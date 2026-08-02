-- ============================================================
-- MAPCO V2 · Highlight sets can carry per-shape labels (names)
-- ------------------------------------------------------------
-- Extends plotmap_save_highlight_set so a dealer can name individual
-- roads/blocks in Publish Masterplan (item: add text/name to a shape).
-- payload = { itemIds: text[], accent: text, labels: { <itemId>: <name> } }.
-- ============================================================

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
      'accent', coalesce(nullif(p_payload ->> 'accent', ''), '#F59E0B'),
      'labels', coalesce(p_payload -> 'labels', '{}'::jsonb)
    ),
    'published', true, false, timezone('utc', now())
  )
  on conflict (id) do update set
    name = excluded.name, map_id = excluded.map_id, payload = excluded.payload,
    status = 'published', client_visible = true, deleted = false, updated_at = timezone('utc', now())
  where public.map_overlays.dealer_id = v_dealer
  returning * into v_row;

  if v_row.id is null then raise exception 'could not save highlight set'; end if;
  return v_row;
end;
$$;

grant execute on function public.plotmap_save_highlight_set(jsonb) to authenticated;
