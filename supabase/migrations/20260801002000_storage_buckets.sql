-- ============================================================
-- MAPCO V2 · Storage buckets (private)
-- The photo/audio RLS policies (000300/000800) assume these buckets
-- exist. Create them PRIVATE (public=false); media is served only via
-- short-lived signed URLs (property photos) or the edge media broker
-- (client-link audio). Idempotent.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('property-photos', 'property-photos', false),
  ('client-link-audio', 'client-link-audio', false)
on conflict (id) do update set public = excluded.public;
