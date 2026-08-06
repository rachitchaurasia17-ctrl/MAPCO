-- Enforce the 90-day raw predictive-event retention window globally whenever
-- new operational telemetry arrives. Transition summaries contain only
-- counts/recency and are intentionally retained for dealer-level weighting.

create or replace function public.plotmap_purge_predictive_events_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.predictive_usage_events
   where created_at < timezone('utc'::text, now()) - interval '90 days';
  return null;
end;
$$;

revoke all on function public.plotmap_purge_predictive_events_after_insert() from public, anon, authenticated;

drop trigger if exists predictive_usage_events_retention_trigger on public.predictive_usage_events;
create trigger predictive_usage_events_retention_trigger
after insert on public.predictive_usage_events
for each statement execute function public.plotmap_purge_predictive_events_after_insert();
