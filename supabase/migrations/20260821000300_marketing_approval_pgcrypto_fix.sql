-- pgcrypto is installed in the extensions schema on MAPCO-DEV. Keep the
-- approval function's fixed search path explicit so digest() resolves safely.
alter function public.plotmap_marketing_approve_slot(uuid)
  set search_path = public, extensions;
