-- ============================================================
-- MAPCO V2 · Restore service_role backend grants
-- ------------------------------------------------------------
-- The migration-kit assumed Supabase's default service_role
-- privileges, which are not applied to tables CREATED by
-- migrations on a fresh project — so service_role (edge functions,
-- admin) hit "permission denied for table ...".
--
-- service_role is the TRUSTED SERVER role (used only inside edge
-- runtimes and admin tooling, never in the browser). It bypasses
-- RLS by design. Granting it does NOT change anon/authenticated
-- access — RLS + the anon lockdown still gate all public paths.
-- ============================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Future tables created by the migration owner also grant to service_role.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;
