-- ============================================================
-- MAPCO V2 · Let the authenticated dealer create/revoke client links
-- ------------------------------------------------------------
-- plotmap_create_client_link was revoked from `authenticated` pending the
-- send-link UI. The function is SECURITY DEFINER and enforces everything
-- internally (auth.uid(), plotmap_client_link_can_manage(), dealer scoping,
-- property ownership + client-visibility, approved-photo checks, audio path
-- validation), so granting execute to authenticated is safe and matches the
-- other dealer-facing RPCs. Also (re)grant revoke/extend for completeness.
-- ============================================================

grant execute on function public.plotmap_create_client_link(jsonb) to authenticated;
grant execute on function public.plotmap_revoke_client_link(uuid) to authenticated;
grant execute on function public.plotmap_extend_client_link(uuid, integer) to authenticated;
