-- Storage.foldername excludes the file name. Canonical creative paths are
-- dealer/week/slot/hash.ext, so the folder array contains exactly 3 items.
drop policy if exists "marketing creative upload by operator" on storage.objects;
create policy "marketing creative upload by operator" on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketing-creatives'
  and public.plotmap_marketing_can_operate((storage.foldername(name))[1])
  and array_length(storage.foldername(name), 1) = 3
);
