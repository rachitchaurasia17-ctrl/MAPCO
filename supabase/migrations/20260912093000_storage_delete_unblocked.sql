/* ═══════════════════════════════════════════════════════════════
   A dealer deleting a property photo fails with
   "permission denied for table marketing_creatives".

   One permissive DELETE policy on storage.objects — "marketing creative
   delete unbound" — reads public.marketing_creatives directly:

     bucket_id = 'marketing-creatives'
     and plotmap_marketing_can_operate((storage.foldername(name))[1])
     and not exists (select 1 from marketing_creatives c
                     where c.asset ->> 'path' = objects.name)

   marketing_creatives has RLS on, no policies and no grants to
   `authenticated` — deliberately: only the Edge Function reaches it,
   through the service role. So when a dealer deletes anything, the
   planner evaluates this policy's subquery as `authenticated`, which may
   not touch that table at all, and the statement errors.

   Postgres evaluates every permissive policy for the command, so the
   damage is not limited to the bucket this policy names. EVERY storage
   delete a dealer makes fails: a removed property photo leaves its bytes
   behind, and so do deal documents, property documents and link audio.
   The dealer sees the right thing — the photo leaves the property and
   every client link — and the object quietly stays in the bucket.

   The fix is the one the surrounding policies already use: put the
   predicate in a function. Every other condition here is one —
   plotmap_marketing_can_operate, plotmap_photo_dealer_id,
   plotmap_property_photo_path_is_valid — and a SECURITY DEFINER function
   can read the table the policy needs without granting the caller
   anything.

   Nothing about who may delete a marketing creative changes: both
   conditions still hold, and both now live inside the function, so it
   answers false for anyone who is not an operator for that dealer rather
   than becoming an oracle about which paths are in use. `authenticated`
   still has no access to marketing_creatives.
   ═══════════════════════════════════════════════════════════════ */

create or replace function public.plotmap_marketing_creative_is_unbound(p_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'storage'
as $$
  select
    /* Only an operator for the dealer that owns this folder may ask, and
       the answer is still no while any creative references the object. */
    public.plotmap_marketing_can_operate((storage.foldername(p_name))[1])
    and not exists (
      select 1
      from public.marketing_creatives c
      where c.asset ->> 'path' = p_name
    );
$$;

comment on function public.plotmap_marketing_creative_is_unbound(text) is
  'True when the caller may operate on this creative folder and no marketing '
  'creative still references the object. Exists so the storage DELETE policy '
  'can ask without the deleting role needing access to marketing_creatives — '
  'without it, every dealer storage delete errors, in every bucket.';

revoke all on function public.plotmap_marketing_creative_is_unbound(text) from public, anon;
grant execute on function public.plotmap_marketing_creative_is_unbound(text) to authenticated;

drop policy if exists "marketing creative delete unbound" on storage.objects;

create policy "marketing creative delete unbound"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'marketing-creatives'
    and public.plotmap_marketing_creative_is_unbound(name)
  );
