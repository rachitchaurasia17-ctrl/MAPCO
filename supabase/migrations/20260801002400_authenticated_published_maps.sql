-- ============================================================
-- MAPCO V2 · Authenticated published-maps read (presentation path)
-- ------------------------------------------------------------
-- Migration 001000 intentionally revoked the raw anon
-- plotmap_client_maps(dealer_id) grant in favour of DEVICE-GATED
-- reads (plotmap_client_maps_for_device). We keep that boundary.
--
-- The dealer-facing Client Presentation runs under the AUTHENTICATED
-- dealer session, so it reads its own PUBLISHED + client_visible maps
-- through this dealer-scoped SECURITY DEFINER RPC. Drafts/hidden/
-- archived maps never appear. The buyer (anon) path stays on the
-- device-gated / client-link edge flow.
-- ============================================================

create or replace function public.plotmap_published_maps()
returns setof public.prebuilt_maps
language sql
stable
security definer
set search_path = public
as $$
  select * from public.prebuilt_maps
  where dealer_id = public.plotmap_current_dealer_id()
    and status = 'published'
    and client_visible = true
    and deleted = false
  order by kind, coalesce(created_at, timezone('utc'::text, now())) asc;
$$;

-- Overlays for a published map (dealer-scoped, published sets only).
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
    and o.map_id = p_map_id
    and o.deleted = false
    and m.status = 'published'
  order by o.updated_at asc;
$$;

grant execute on function public.plotmap_published_maps() to authenticated;
grant execute on function public.plotmap_published_overlays(text) to authenticated;
