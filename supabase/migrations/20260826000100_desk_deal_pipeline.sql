-- ============================================================
-- MAPCO Desk · Deal pipeline, commission ledger and deal papers
-- ------------------------------------------------------------
-- Until now a "deal" could only exist as a COMPLETED sale
-- (20260803000100 / 20260823000100). The approved Desk UI works a
-- full pipeline — Negotiating → Token/Booked → Registry/Closing →
-- Completed, plus Lost/Cancelled — with buyer-side and seller-side
-- commission, token receipts and deal-owned papers.
--
-- This migration makes that pipeline canonical WITHOUT creating a
-- parallel deal system:
--
--   • Pipeline deals stay in crm_records(entity_type='deals') beside
--     completed sales, distinguished by payload->>'recordType'.
--     The existing crm_one_canonical_completed_sale_per_property
--     index is already filtered on recordType='completed-sale', so
--     pipeline rows never collide with it.
--   • The parts that need integrity and querying become relational
--     children: stage events, the commission/token ledger, and deal
--     papers.
--   • Property Papers are NEVER copied into a deal. A deal reads them
--     through its property_id; only deal-specific papers live here.
--   • plotmap_record_completed_sale is extended to COMPLETE a matching
--     active pipeline deal instead of creating a duplicate.
--
-- Security posture is identical to the rest of Desk:
--   • dealer_id is always derived from auth.uid() via
--     plotmap_current_dealer_id(). No RPC accepts a caller dealer id.
--   • RLS on every table; writes require plotmap_can_edit_crm() and
--     plotmap_dealer_can_write().
--   • Nothing here is buyer-facing. No client-safe projection reads
--     these tables or the deal-documents bucket.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- Creates no demo or seeded rows.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. deal payload shape ----------
-- Pipeline deals carry a stage; completed sales keep their existing shape.
-- 'enquiry' is accepted as a legacy alias the read layer folds into
-- 'negotiating' so pre-existing rows stay valid.

alter table public.crm_records drop constraint if exists crm_records_deal_stage_valid;
alter table public.crm_records add constraint crm_records_deal_stage_valid check (
  entity_type <> 'deals'
  or payload->>'stage' is null
  or payload->>'stage' in ('enquiry','negotiating','token','registry','closed','lost')
) not valid;
alter table public.crm_records validate constraint crm_records_deal_stage_valid;

alter table public.crm_records drop constraint if exists crm_records_deal_record_type_valid;
alter table public.crm_records add constraint crm_records_deal_record_type_valid check (
  entity_type <> 'deals'
  or coalesce(payload->>'recordType','completed-sale') in ('pipeline','completed-sale')
) not valid;
alter table public.crm_records validate constraint crm_records_deal_record_type_valid;

-- At most one OPEN pipeline deal per dealer + property + buyer. Completed and
-- lost deals are excluded so a property can be re-sold to another buyer later
-- and so history is never blocked.
create unique index if not exists crm_one_open_pipeline_deal_per_property_buyer
  on public.crm_records (
    dealer_id,
    (payload->>'propertyId'),
    (payload->>'buyerId')
  )
  where entity_type = 'deals'
    and not deleted
    and payload->>'recordType' = 'pipeline'
    and coalesce(payload->>'stage','negotiating') not in ('closed','lost');

-- ---------- 2. stage history ----------

create table if not exists public.desk_deal_stage_events (
  id text primary key,
  dealer_id text not null,
  deal_id text not null references public.crm_records(id) on delete cascade,
  stage text not null check (stage in ('enquiry','negotiating','token','registry','closed','lost')),
  occurred_at timestamptz not null default timezone('utc', now()),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists desk_deal_stage_events_deal_idx
  on public.desk_deal_stage_events (dealer_id, deal_id, occurred_at desc);

-- ---------- 3. commission / token ledger ----------
-- The Desk deliberately does NOT keep full transaction accounting. This is a
-- narrow receipts ledger: money the dealer actually received, plus the token.

create table if not exists public.desk_deal_payments (
  id text primary key,
  dealer_id text not null,
  deal_id text not null references public.crm_records(id) on delete cascade,
  kind text not null check (kind in ('token','commission-buyer','commission-seller')),
  amount numeric not null check (amount > 0 and amount <= 1e13),
  received_on date not null,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists desk_deal_payments_deal_idx
  on public.desk_deal_payments (dealer_id, deal_id, received_on desc);

-- ---------- 4. deal-owned papers ----------
-- Property Papers are NOT duplicated here. A deal shows its property's papers
-- by reading desk_property_documents through the deal's propertyId.

create table if not exists public.desk_deal_documents (
  id text primary key,
  dealer_id text not null,
  deal_id text not null references public.crm_records(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  document_type text not null check (document_type in (
    'token-receipt','agreement-to-sell','payment-proof','registry-copy',
    'commission-receipt','other'
  )),
  storage_bucket text not null default 'deal-documents' check (storage_bucket = 'deal-documents'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists desk_deal_documents_deal_idx
  on public.desk_deal_documents (dealer_id, deal_id, created_at desc);

-- ---------- 5. tenancy validation trigger ----------

create or replace function public.plotmap_validate_desk_deal_child()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.crm_records r
    where r.id = new.deal_id
      and r.dealer_id = new.dealer_id
      and r.entity_type = 'deals'
      and coalesce(r.deleted, false) = false
  ) then raise exception 'deal_not_available'; end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;
revoke all on function public.plotmap_validate_desk_deal_child() from public, anon, authenticated;

-- stage events have no updated_at; use a dedicated guard.
create or replace function public.plotmap_validate_desk_deal_stage_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.crm_records r
    where r.id = new.deal_id
      and r.dealer_id = new.dealer_id
      and r.entity_type = 'deals'
      and coalesce(r.deleted, false) = false
  ) then raise exception 'deal_not_available'; end if;
  return new;
end;
$$;
revoke all on function public.plotmap_validate_desk_deal_stage_event() from public, anon, authenticated;

drop trigger if exists desk_deal_payments_validate on public.desk_deal_payments;
create trigger desk_deal_payments_validate before insert or update on public.desk_deal_payments
for each row execute function public.plotmap_validate_desk_deal_child();

drop trigger if exists desk_deal_documents_validate on public.desk_deal_documents;
create trigger desk_deal_documents_validate before insert or update on public.desk_deal_documents
for each row execute function public.plotmap_validate_desk_deal_child();

drop trigger if exists desk_deal_stage_events_validate on public.desk_deal_stage_events;
create trigger desk_deal_stage_events_validate before insert or update on public.desk_deal_stage_events
for each row execute function public.plotmap_validate_desk_deal_stage_event();

-- ---------- 6. RLS ----------

alter table public.desk_deal_stage_events enable row level security;
alter table public.desk_deal_payments enable row level security;
alter table public.desk_deal_documents enable row level security;

do $$ declare v_table text; begin
  foreach v_table in array array['desk_deal_stage_events','desk_deal_payments','desk_deal_documents'] loop
    execute format('drop policy if exists "plotmap %s private read" on public.%I', v_table, v_table);
    execute format('create policy "plotmap %s private read" on public.%I for select to authenticated using (
      public.plotmap_is_active_member() and public.plotmap_current_role() <> ''viewer''
      and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
      and dealer_id = public.plotmap_current_dealer_id())', v_table, v_table);
    execute format('drop policy if exists "plotmap %s private insert" on public.%I', v_table, v_table);
    execute format('create policy "plotmap %s private insert" on public.%I for insert to authenticated with check (
      public.plotmap_can_edit_crm() and public.plotmap_dealer_can_write(dealer_id)
      and dealer_id = public.plotmap_current_dealer_id())', v_table, v_table);
    execute format('drop policy if exists "plotmap %s private update" on public.%I', v_table, v_table);
    execute format('create policy "plotmap %s private update" on public.%I for update to authenticated using (
      public.plotmap_can_edit_crm() and public.plotmap_dealer_can_write(dealer_id)
      and dealer_id = public.plotmap_current_dealer_id()) with check (
      public.plotmap_can_edit_crm() and public.plotmap_dealer_can_write(dealer_id)
      and dealer_id = public.plotmap_current_dealer_id())', v_table, v_table);
    execute format('drop policy if exists "plotmap %s private delete" on public.%I', v_table, v_table);
    execute format('create policy "plotmap %s private delete" on public.%I for delete to authenticated using (
      public.plotmap_can_edit_crm() and public.plotmap_dealer_can_write(dealer_id)
      and dealer_id = public.plotmap_current_dealer_id())', v_table, v_table);
  end loop;
end $$;

grant select, insert, update, delete on public.desk_deal_stage_events to authenticated;
grant select, insert, update, delete on public.desk_deal_payments to authenticated;
grant select, insert, update, delete on public.desk_deal_documents to authenticated;

-- ---------- 7. commission helper ----------
-- One place computes expected commission so the DB, the read model and the UI
-- can never disagree. mode: 'none' | 'pct' | 'fixed'.

create or replace function public.plotmap_deal_commission_side(
  p_value numeric, p_mode text, p_percent numeric, p_fixed numeric
) returns numeric language sql immutable as $$
  select case
    when coalesce(p_mode,'none') = 'fixed' then round(coalesce(p_fixed,0))
    when coalesce(p_mode,'none') = 'pct'   then round(coalesce(p_value,0) * coalesce(p_percent,0) / 100)
    else 0
  end;
$$;
revoke all on function public.plotmap_deal_commission_side(numeric,text,numeric,numeric) from public, anon;
grant execute on function public.plotmap_deal_commission_side(numeric,text,numeric,numeric) to authenticated;

-- ---------- 8. start a pipeline deal ----------

create or replace function public.plotmap_start_deal(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_property text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_buyer text := nullif(trim(coalesce(p_payload->>'buyerId','')), '');
  v_new_buyer jsonb := p_payload->'newBuyer';
  v_stage text := coalesce(nullif(trim(p_payload->>'stage'),''), 'negotiating');
  v_value numeric := nullif(p_payload->>'value','')::numeric;
  v_deal_id text := 'deal-'||encode(extensions.gen_random_bytes(8),'hex');
  v_prop record; v_buyer_name text; v_existing jsonb;
  v_seller_id text; v_seller_name text; v_seller_phone text;
  v_prop_name text; v_prop_sub text; v_deal jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 32768
    then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if v_stage not in ('negotiating','token','registry')
    then return jsonb_build_object('ok',false,'reason','a new deal starts at negotiating, token or registry'); end if;
  if v_property is null then return jsonb_build_object('ok',false,'reason','choose a property'); end if;
  if v_value is not null and v_value <= 0
    then return jsonb_build_object('ok',false,'reason','deal value must be positive'); end if;

  select r.id, r.payload into v_prop from public.crm_records r
    where r.dealer_id = v_dealer and r.id = v_property
      and r.entity_type = 'properties' and not r.deleted for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if coalesce(v_prop.payload->>'lifecycle','') = 'sold'
    then return jsonb_build_object('ok',false,'reason','this property is already sold'); end if;

  -- Canonical buyer: reuse an existing client, or create a minimal truthful one.
  if v_buyer is not null then
    select left(nullif(trim(r.payload->>'name'),''),80) into v_buyer_name from public.crm_records r
      where r.dealer_id = v_dealer and r.id = v_buyer and r.entity_type = 'clients' and not r.deleted;
    if v_buyer_name is null then return jsonb_build_object('ok',false,'reason','buyer is not available'); end if;
  else
    if nullif(trim(coalesce(v_new_buyer->>'name','')),'') is null
      then return jsonb_build_object('ok',false,'reason','choose or add a buyer'); end if;
    v_buyer := 'client-'||encode(extensions.gen_random_bytes(8),'hex');
    v_buyer_name := left(trim(v_new_buyer->>'name'),80);
    insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at) values (
      v_buyer,v_dealer,'clients',jsonb_build_object(
        'id',v_buyer,'name',v_buyer_name,'phone',left(coalesce(v_new_buyer->>'phone',''),24),
        'city','','want','','budget','','budgetMax',0,'status','active','seen','','note','',
        'viewed','[]'::jsonb,'interest','[]'::jsonb,'purchased','[]'::jsonb,
        'profileCompleteness','needs-attention',
        'missingFields',jsonb_build_array('city','requirements','budget')),
      false,timezone('utc',now()));
  end if;

  -- Idempotency: an open pipeline deal for this property+buyer is reused.
  select r.payload into v_existing from public.crm_records r
    where r.dealer_id = v_dealer and r.entity_type = 'deals' and not r.deleted
      and r.payload->>'recordType' = 'pipeline'
      and r.payload->>'propertyId' = v_property
      and r.payload->>'buyerId' = v_buyer
      and coalesce(r.payload->>'stage','negotiating') not in ('closed','lost')
    order by r.created_at limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok',true,'idempotent',true,'deal',v_existing);
  end if;

  -- Seller context comes through the canonical property↔seller relationship.
  select ps.seller_id, s.name, s.primary_phone into v_seller_id, v_seller_name, v_seller_phone
    from public.desk_property_sellers ps
    join public.desk_sellers s on s.id = ps.seller_id and s.dealer_id = ps.dealer_id
    where ps.dealer_id = v_dealer and ps.property_id = v_property
    order by ps.is_primary desc, ps.created_at limit 1;

  v_prop_name := left(coalesce(nullif(trim(coalesce(v_prop.payload->>'title',v_prop.payload->>'area')),''),'Property'),120);
  v_prop_sub := trim(both ' ·' from concat_ws(' · ',
    nullif(trim(v_prop.payload->>'size'),''), nullif(trim(v_prop.payload->>'facing'),'')));

  v_deal := jsonb_strip_nulls(jsonb_build_object(
    'id',v_deal_id,'recordType','pipeline','stage',v_stage,
    'propertyId',v_property,'propId',v_property,'prop',v_prop_name,'propSub',v_prop_sub,
    'city',left(coalesce(v_prop.payload->>'city',''),80),
    'sector',left(coalesce(v_prop.payload->>'sector',v_prop.payload->>'block',''),120),
    'buyerId',v_buyer,'buyer',v_buyer_name,
    'sellerId',v_seller_id,'seller',left(v_seller_name,120),'sellerPhone',left(v_seller_phone,24),
    'value',v_value,
    'commission',jsonb_build_object(
      'buyer',jsonb_build_object(
        'mode',coalesce(nullif(p_payload#>>'{commission,buyer,mode}',''),'none'),
        'percent',nullif(p_payload#>>'{commission,buyer,percent}','')::numeric,
        'fixed',nullif(p_payload#>>'{commission,buyer,fixed}','')::numeric),
      'seller',jsonb_build_object(
        'mode',coalesce(nullif(p_payload#>>'{commission,seller,mode}',''),'none'),
        'percent',nullif(p_payload#>>'{commission,seller,percent}','')::numeric,
        'fixed',nullif(p_payload#>>'{commission,seller,fixed}','')::numeric)),
    'nextAction',case when nullif(trim(p_payload#>>'{nextAction,kind}'),'') is null then null
      else jsonb_build_object(
        'kind',left(trim(p_payload#>>'{nextAction,kind}'),60),
        'note',left(coalesce(p_payload#>>'{nextAction,note}',''),300),
        'dueOn',nullif(p_payload#>>'{nextAction,dueOn}','')::date) end,
    'createdAt',to_char(timezone('utc',now()),'YYYY-MM-DD')));

  insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at)
    values (v_deal_id,v_dealer,'deals',v_deal,false,timezone('utc',now()));
  insert into public.desk_deal_stage_events(id,dealer_id,deal_id,stage,note)
    values ('dse-'||encode(extensions.gen_random_bytes(8),'hex'),v_dealer,v_deal_id,v_stage,'Deal created');

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),'deal_started','deals',v_deal_id,
      jsonb_build_object('propertyId',v_property,'buyerId',v_buyer,'stage',v_stage));
  exception when others then null; end;

  return jsonb_build_object('ok',true,'idempotent',false,'deal',v_deal);
exception when unique_violation then
  return jsonb_build_object('ok',false,'reason','a deal already exists for this buyer and property');
when invalid_text_representation or numeric_value_out_of_range or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid value in payload');
end;
$$;
revoke all on function public.plotmap_start_deal(jsonb) from public, anon;
grant execute on function public.plotmap_start_deal(jsonb) to authenticated;

-- ---------- 9. move a deal between stages ----------
-- Completing a deal is deliberately NOT done here: it must go through
-- plotmap_record_completed_sale so the property, buyer history and sale
-- record all move as one unit.

create or replace function public.plotmap_set_deal_stage(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_deal_id text := nullif(trim(coalesce(p_payload->>'dealId','')), '');
  v_stage text := nullif(trim(coalesce(p_payload->>'stage','')), '');
  v_rec record; v_payload jsonb; v_patch jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if v_stage not in ('negotiating','token','registry','lost')
    then return jsonb_build_object('ok',false,'reason',
      'completing a deal goes through the sale record'); end if;

  select r.id, r.payload into v_rec from public.crm_records r
    where r.dealer_id = v_dealer and r.id = v_deal_id
      and r.entity_type = 'deals' and not r.deleted for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if coalesce(v_rec.payload->>'recordType','completed-sale') <> 'pipeline'
    then return jsonb_build_object('ok',false,'reason','this deal is already completed'); end if;
  if coalesce(v_rec.payload->>'stage','negotiating') = 'closed'
    then return jsonb_build_object('ok',false,'reason','this deal is already completed'); end if;

  v_patch := jsonb_build_object('stage',v_stage);
  if v_stage = 'lost' then
    v_patch := v_patch || jsonb_build_object(
      'lostReason',left(coalesce(nullif(trim(p_payload->>'reason'),''),'Not recorded'),300),
      'lostOn',to_char(timezone('utc',now()),'YYYY-MM-DD'));
  end if;
  -- Stage-specific lightweight input only.
  if v_stage = 'token' and nullif(p_payload->>'tokenDate','') is not null then
    v_patch := v_patch || jsonb_build_object('tokenDate',(p_payload->>'tokenDate')::date);
  end if;
  if v_stage = 'registry' and nullif(p_payload->>'registryDate','') is not null then
    v_patch := v_patch || jsonb_build_object('registryDate',(p_payload->>'registryDate')::date);
  end if;

  v_payload := v_rec.payload || v_patch;
  update public.crm_records set payload = v_payload, updated_at = timezone('utc',now())
    where dealer_id = v_dealer and id = v_deal_id and entity_type = 'deals';
  insert into public.desk_deal_stage_events(id,dealer_id,deal_id,stage,note)
    values ('dse-'||encode(extensions.gen_random_bytes(8),'hex'),v_dealer,v_deal_id,v_stage,
      nullif(left(coalesce(p_payload->>'note',''),500),''));

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),'deal_stage_changed','deals',v_deal_id,
      jsonb_build_object('stage',v_stage));
  exception when others then null; end;

  return jsonb_build_object('ok',true,'deal',v_payload);
exception when invalid_text_representation or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid value in payload');
end;
$$;
revoke all on function public.plotmap_set_deal_stage(jsonb) from public, anon;
grant execute on function public.plotmap_set_deal_stage(jsonb) to authenticated;

-- ---------- 10. record a token / commission receipt ----------

create or replace function public.plotmap_record_deal_payment(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_deal_id text := nullif(trim(coalesce(p_payload->>'dealId','')), '');
  v_kind text := nullif(trim(coalesce(p_payload->>'kind','')), '');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_on date := nullif(p_payload->>'receivedOn','')::date;
  v_id text := 'ddp-'||encode(extensions.gen_random_bytes(8),'hex');
  v_row public.desk_deal_payments%rowtype;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if v_kind not in ('token','commission-buyer','commission-seller')
    then return jsonb_build_object('ok',false,'reason','unknown payment kind'); end if;
  if v_amount is null or v_amount <= 0
    then return jsonb_build_object('ok',false,'reason','enter an amount'); end if;
  if not exists (select 1 from public.crm_records where dealer_id=v_dealer and id=v_deal_id
    and entity_type='deals' and not deleted)
    then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  insert into public.desk_deal_payments(id,dealer_id,deal_id,kind,amount,received_on,note)
    values (v_id,v_dealer,v_deal_id,v_kind,v_amount,
      coalesce(v_on,(timezone('utc',now()))::date),
      nullif(left(coalesce(p_payload->>'note',''),300),''))
    returning * into v_row;

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),'deal_payment_recorded','deals',v_deal_id,
      jsonb_build_object('kind',v_kind,'amount',v_amount));
  exception when others then null; end;

  return jsonb_build_object('ok',true,'payment',to_jsonb(v_row)-'dealer_id');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid value in payload');
end;
$$;
revoke all on function public.plotmap_record_deal_payment(jsonb) from public, anon;
grant execute on function public.plotmap_record_deal_payment(jsonb) to authenticated;

-- ---------- 11. deal-documents storage bucket ----------

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('deal-documents','deal-documents',false,20971520,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=20971520,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];

create or replace function public.plotmap_deal_document_path_valid(p_path text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select (storage.foldername(p_path))[1]='dealers'
    and (storage.foldername(p_path))[2] is not null
    and (storage.foldername(p_path))[3]='deals'
    and (storage.foldername(p_path))[4] is not null
    and (storage.foldername(p_path))[5]='documents'
    and (storage.foldername(p_path))[6] is null
    and lower(storage.extension(p_path)) in ('pdf','jpg','jpeg','png','webp')
    and exists (select 1 from public.crm_records r
      where r.dealer_id=(storage.foldername(p_path))[2]
        and r.id=(storage.foldername(p_path))[4]
        and r.entity_type='deals' and not r.deleted);
$$;
revoke all on function public.plotmap_deal_document_path_valid(text) from public,anon,authenticated;
grant execute on function public.plotmap_deal_document_path_valid(text) to authenticated;

drop policy if exists "plotmap deal documents private read" on storage.objects;
create policy "plotmap deal documents private read" on storage.objects for select to authenticated using (
  bucket_id='deal-documents' and public.plotmap_is_active_member()
  and public.plotmap_current_role()<>'viewer'
  and (storage.foldername(name))[2]=public.plotmap_current_dealer_id()
  and public.plotmap_deal_document_path_valid(name));
drop policy if exists "plotmap deal documents private insert" on storage.objects;
create policy "plotmap deal documents private insert" on storage.objects for insert to authenticated with check (
  bucket_id='deal-documents' and public.plotmap_can_edit_crm()
  and public.plotmap_dealer_can_write((storage.foldername(name))[2])
  and (storage.foldername(name))[2]=public.plotmap_current_dealer_id()
  and public.plotmap_deal_document_path_valid(name));
drop policy if exists "plotmap deal documents private delete" on storage.objects;
create policy "plotmap deal documents private delete" on storage.objects for delete to authenticated using (
  bucket_id='deal-documents' and public.plotmap_can_edit_crm()
  and public.plotmap_dealer_can_write((storage.foldername(name))[2])
  and (storage.foldername(name))[2]=public.plotmap_current_dealer_id()
  and public.plotmap_deal_document_path_valid(name));

-- ---------- 12. deal workspace read model ----------
-- One dealer-private round trip per deal room: the canonical deal, its buyer,
-- property and seller context, stage history, the money ledger with computed
-- expected/received/due, its own papers, and the property's papers by
-- REFERENCE (never copied).

create or replace function public.plotmap_deal_workspace(p_deal_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_deal jsonb; v_property_id text; v_value numeric;
  v_expected_b numeric; v_expected_s numeric;
  v_got_b numeric; v_got_s numeric; v_token numeric;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_is_active_member()
    or public.plotmap_current_role() = 'viewer'
    then raise exception 'deal access denied'; end if;

  select r.payload into v_deal from public.crm_records r
    where r.dealer_id = v_dealer and r.id = p_deal_id
      and r.entity_type = 'deals' and not r.deleted;
  if v_deal is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  v_property_id := coalesce(v_deal->>'propertyId', v_deal->>'propId');
  v_value := coalesce(
    nullif(v_deal->>'value','')::numeric,
    nullif(v_deal->>'soldPrice','')::numeric, 0);

  v_expected_b := public.plotmap_deal_commission_side(v_value,
    v_deal#>>'{commission,buyer,mode}',
    nullif(v_deal#>>'{commission,buyer,percent}','')::numeric,
    nullif(v_deal#>>'{commission,buyer,fixed}','')::numeric);
  v_expected_s := public.plotmap_deal_commission_side(v_value,
    v_deal#>>'{commission,seller,mode}',
    nullif(v_deal#>>'{commission,seller,percent}','')::numeric,
    nullif(v_deal#>>'{commission,seller,fixed}','')::numeric);

  select
    coalesce(sum(amount) filter (where kind='commission-buyer'),0),
    coalesce(sum(amount) filter (where kind='commission-seller'),0),
    coalesce(sum(amount) filter (where kind='token'),0)
  into v_got_b, v_got_s, v_token
  from public.desk_deal_payments where dealer_id=v_dealer and deal_id=p_deal_id;

  return jsonb_build_object(
    'ok',true,
    'deal',v_deal,
    'property',(select jsonb_build_object('id',r.id,'payload',r.payload)
      from public.crm_records r where r.dealer_id=v_dealer and r.id=v_property_id
        and r.entity_type='properties' and not r.deleted),
    'buyer',(select jsonb_build_object('id',r.id,'payload',r.payload)
      from public.crm_records r where r.dealer_id=v_dealer and r.id=v_deal->>'buyerId'
        and r.entity_type='clients' and not r.deleted),
    'seller',(select jsonb_build_object(
        'id',s.id,'name',s.name,'primaryPhone',s.primary_phone,'type',s.seller_type,
        'relationship',ps.relationship,'availability',ps.availability,
        'askingPrice',ps.asking_price,'siteVisitInstructions',ps.site_visit_instructions)
      from public.desk_property_sellers ps
      join public.desk_sellers s on s.id=ps.seller_id and s.dealer_id=ps.dealer_id
      where ps.dealer_id=v_dealer and ps.property_id=v_property_id
      order by ps.is_primary desc, ps.created_at limit 1),
    'stageHistory',(select coalesce(jsonb_agg(jsonb_build_object(
        'stage',e.stage,'occurredAt',e.occurred_at,'note',e.note) order by e.occurred_at),'[]'::jsonb)
      from public.desk_deal_stage_events e where e.dealer_id=v_dealer and e.deal_id=p_deal_id),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',p.id,'kind',p.kind,'amount',p.amount,'receivedOn',p.received_on,'note',p.note)
        order by p.received_on desc, p.created_at desc),'[]'::jsonb)
      from public.desk_deal_payments p where p.dealer_id=v_dealer and p.deal_id=p_deal_id),
    'money',jsonb_build_object(
      'value',v_value,'token',v_token,
      'expectedBuyer',v_expected_b,'expectedSeller',v_expected_s,
      'expected',v_expected_b+v_expected_s,
      'receivedBuyer',v_got_b,'receivedSeller',v_got_s,'received',v_got_b+v_got_s,
      'due',greatest(0,(v_expected_b+v_expected_s)-(v_got_b+v_got_s)),
      'fullySettled',(v_expected_b+v_expected_s) > 0 and (v_got_b+v_got_s) >= (v_expected_b+v_expected_s)),
    'dealPapers',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',d.id,'title',d.title,'type',d.document_type,'bucket',d.storage_bucket,
        'path',d.storage_path,'mimeType',d.mime_type,'sizeBytes',d.size_bytes,'createdAt',d.created_at)
        order by d.created_at desc),'[]'::jsonb)
      from public.desk_deal_documents d where d.dealer_id=v_dealer and d.deal_id=p_deal_id),
    -- Property papers are referenced, never duplicated into the deal.
    'propertyPapers',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',d.id,'title',d.title,'type',d.document_type,'bucket',d.storage_bucket,
        'path',d.storage_path,'mimeType',d.mime_type,'sizeBytes',d.size_bytes,
        'visibility',d.visibility,'safety',d.safety,'createdAt',d.created_at)
        order by d.created_at desc),'[]'::jsonb)
      from public.desk_property_documents d
      where d.dealer_id=v_dealer and d.property_id=v_property_id));
end;
$$;
revoke all on function public.plotmap_deal_workspace(text) from public, anon;
grant execute on function public.plotmap_deal_workspace(text) to authenticated;

-- ---------- 13. Mark Sold completes an existing pipeline deal ----------
-- Replaces the create-only body from 20260823000100. Behaviour added:
-- when an OPEN pipeline deal already exists for this property + buyer, that
-- deal is COMPLETED in place (stage → closed, sale figures merged, stage event
-- appended) instead of a second canonical deal being written.

create or replace function public.plotmap_record_completed_sale(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_dealer_id text := public.plotmap_current_dealer_id();
  v_property_id text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_buyer_id text := nullif(trim(coalesce(p_payload->>'buyerId','')), '');
  v_new_buyer jsonb := p_payload->'newBuyer';
  v_prop record; v_existing_deal jsonb; v_buyer_name text;
  v_pipeline record; v_reused boolean := false;
  v_deal_id text := 'deal-'||encode(extensions.gen_random_bytes(8),'hex');
  v_sold_price numeric; v_sale_date text := nullif(trim(coalesce(p_payload->>'saleDate','')), '');
  v_reg_date text := nullif(trim(coalesce(p_payload->>'registrationDate','')), '');
  v_city text; v_sector text; v_prop_name text; v_prop_sub text; v_dealer_name text;
  v_documents jsonb := coalesce(p_payload->'documents','[]'::jsonb); v_timeline jsonb; v_deal jsonb;
  v_seller_id text; v_seller_name text; v_seller_phone text;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768
  then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  if auth.uid() is null or v_dealer_id is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer_id) then raise exception 'deal access denied'; end if;
  v_sold_price := nullif(p_payload->>'soldPrice','')::numeric;
  if v_property_id is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if v_sold_price is null or v_sold_price<=0 then return jsonb_build_object('ok',false,'reason','enter a final sold price'); end if;
  if v_sale_date is null then return jsonb_build_object('ok',false,'reason','enter the sale date'); end if;
  select r.id,r.payload into v_prop from public.crm_records r where r.dealer_id=v_dealer_id
    and r.id=v_property_id and r.entity_type='properties' and not r.deleted for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if coalesce(v_prop.payload->>'lifecycle','')='sold'
    or lower(coalesce(v_prop.payload->>'sold','false')) in ('true','t','1')
    or coalesce(v_prop.payload->>'internalStatus','')~*'sold' then
    select r.payload into v_existing_deal from public.crm_records r where r.dealer_id=v_dealer_id
      and r.entity_type='deals' and not r.deleted
      and coalesce(r.payload->>'propertyId',r.payload->>'propId')=v_property_id
      and case when coalesce(r.payload->>'soldPrice','') ~ '^[0-9]+([.][0-9]+)?$'
        then (r.payload->>'soldPrice')::numeric else null end=v_sold_price
      and coalesce(r.payload->>'soldDate',r.payload->>'saleDate')=v_sale_date
      and ((v_buyer_id is not null and r.payload->>'buyerId'=v_buyer_id)
        or (v_buyer_id is null and lower(r.payload->>'buyer')=lower(trim(coalesce(v_new_buyer->>'name','')))))
      order by r.created_at limit 1;
    if v_existing_deal is not null then return jsonb_build_object('ok',true,'idempotent',true,'deal',v_existing_deal); end if;
    return jsonb_build_object('ok',false,'reason','already_sold');
  end if;
  if v_buyer_id is not null then
    select left(nullif(trim(r.payload->>'name'),''),80) into v_buyer_name from public.crm_records r
      where r.dealer_id=v_dealer_id and r.id=v_buyer_id and r.entity_type='clients' and not r.deleted;
    if v_buyer_name is null then return jsonb_build_object('ok',false,'reason','buyer is not available'); end if;
  else
    if nullif(trim(coalesce(v_new_buyer->>'name','')),'') is null
      then return jsonb_build_object('ok',false,'reason','choose or add a buyer'); end if;
    v_buyer_id := 'client-'||encode(extensions.gen_random_bytes(8),'hex');
    v_buyer_name := left(trim(v_new_buyer->>'name'),80);
    insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at) values (
      v_buyer_id,v_dealer_id,'clients',jsonb_build_object(
        'id',v_buyer_id,'name',v_buyer_name,'phone',left(coalesce(v_new_buyer->>'phone',''),24),
        'city',left(coalesce(v_new_buyer->>'city',''),80),'want','','budget','','budgetMax',0,
        'status','active','seen','','note','','viewed','[]'::jsonb,'interest','[]'::jsonb,'purchased','[]'::jsonb,
        'profileCompleteness','needs-attention','missingFields',
          case when nullif(trim(coalesce(v_new_buyer->>'city','')),'') is null
            then jsonb_build_array('city','requirements','budget') else jsonb_build_array('requirements','budget') end
      ),false,timezone('utc',now()));
  end if;

  -- Reuse an OPEN pipeline deal for this property + buyer rather than
  -- creating a duplicate canonical deal.
  select r.id, r.payload into v_pipeline from public.crm_records r
    where r.dealer_id=v_dealer_id and r.entity_type='deals' and not r.deleted
      and r.payload->>'recordType'='pipeline'
      and coalesce(r.payload->>'propertyId',r.payload->>'propId')=v_property_id
      and r.payload->>'buyerId'=v_buyer_id
      and coalesce(r.payload->>'stage','negotiating') not in ('closed','lost')
    order by r.created_at limit 1 for update;
  if found then v_deal_id := v_pipeline.id; v_reused := true; end if;

  select ps.seller_id,s.name,s.primary_phone into v_seller_id,v_seller_name,v_seller_phone
    from public.desk_property_sellers ps join public.desk_sellers s
      on s.id=ps.seller_id and s.dealer_id=ps.dealer_id
    where ps.dealer_id=v_dealer_id and ps.property_id=v_property_id
    order by ps.is_primary desc,ps.created_at limit 1;
  v_seller_name := coalesce(v_seller_name,nullif(trim(p_payload->>'seller'),''));
  v_seller_phone := coalesce(v_seller_phone,nullif(trim(p_payload->>'sellerPhone'),''));
  v_city:=left(coalesce(v_prop.payload->>'city',''),80);
  v_sector:=left(coalesce(v_prop.payload->>'sector',v_prop.payload->>'block',''),120);
  v_prop_name:=left(coalesce(nullif(trim(coalesce(v_prop.payload->>'title',v_prop.payload->>'area')),''),'Property'),120);
  v_prop_sub:=trim(both ' ·' from concat_ws(' · ',nullif(trim(v_prop.payload->>'size'),''),nullif(trim(v_prop.payload->>'facing'),'')));
  select left(coalesce(nullif(trim(d.brand_name),''),'PlotMap'),120) into v_dealer_name
    from public.dealer_settings d where d.dealer_id=v_dealer_id;
  v_dealer_name:=coalesce(v_dealer_name,'PlotMap');
  v_timeline:=jsonb_build_array(jsonb_build_object('at',v_sale_date,'label','Sold price recorded'));
  if v_reg_date is not null then v_timeline:=v_timeline||jsonb_build_array(jsonb_build_object('at',v_reg_date,'label','Registration completed')); end if;

  v_deal:=jsonb_strip_nulls(jsonb_build_object(
    'id',v_deal_id,'recordType','completed-sale','stage','closed','propertyId',v_property_id,'propId',v_property_id,
    'prop',v_prop_name,'propSub',v_prop_sub,'city',v_city,'sector',v_sector,
    'buyerId',v_buyer_id,'buyer',v_buyer_name,'sellerId',v_seller_id,'seller',left(v_seller_name,120),
    'sellerPhone',left(v_seller_phone,24),'soldPrice',v_sold_price,
    'brokerage',nullif(p_payload->>'brokerage','')::numeric,'commission',nullif(p_payload->>'commission','')::numeric,
    'commissionReceived',(p_payload->>'commissionReceived')::boolean,
    'paymentReceived',nullif(p_payload->>'paymentReceived','')::numeric,'soldDate',v_sale_date,
    'registrationDate',v_reg_date,'dealer',v_dealer_name,
    'documents',case when jsonb_typeof(v_documents)='array' and jsonb_array_length(v_documents)<=20 then v_documents else '[]'::jsonb end,
    'timeline',v_timeline));

  if v_reused then
    -- Preserve everything the pipeline already carried (value, commission
    -- setup, next action, stage dates) and layer the sale facts on top.
    v_deal := v_pipeline.payload || v_deal;
    update public.crm_records set payload=v_deal, updated_at=timezone('utc',now())
      where dealer_id=v_dealer_id and id=v_deal_id and entity_type='deals';
    insert into public.desk_deal_stage_events(id,dealer_id,deal_id,stage,note)
      values ('dse-'||encode(extensions.gen_random_bytes(8),'hex'),v_dealer_id,v_deal_id,'closed','Property marked sold');
  else
    insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at)
      values(v_deal_id,v_dealer_id,'deals',v_deal,false,timezone('utc',now()));
    insert into public.desk_deal_stage_events(id,dealer_id,deal_id,stage,note)
      values ('dse-'||encode(extensions.gen_random_bytes(8),'hex'),v_dealer_id,v_deal_id,'closed','Sale recorded');
  end if;

  update public.crm_records set payload=v_prop.payload||jsonb_build_object(
      'lifecycle','sold','sold',true,'published',false,'clientVisible',false,'internalStatus','sold',
      'sale',jsonb_build_object('finalPrice',v_sold_price,'soldAt',v_sale_date,'buyerId',v_buyer_id,'dealId',v_deal_id)),
    updated_at=timezone('utc',now()) where dealer_id=v_dealer_id and id=v_property_id and entity_type='properties';
  update public.crm_records set payload=payload||jsonb_build_object('purchased',
      case when coalesce(payload->'purchased','[]'::jsonb) @> jsonb_build_array(v_property_id)
        then coalesce(payload->'purchased','[]'::jsonb)
        else coalesce(payload->'purchased','[]'::jsonb)||to_jsonb(v_property_id) end),
    updated_at=timezone('utc',now()) where dealer_id=v_dealer_id and id=v_buyer_id and entity_type='clients';
  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values(v_dealer_id,auth.uid(),public.plotmap_current_role(),'deal_recorded','deals',v_deal_id,
      jsonb_build_object('propertyId',v_property_id,'soldPrice',v_sold_price,'reusedPipelineDeal',v_reused)); exception when others then null; end;
  return jsonb_build_object('ok',true,'idempotent',false,'reusedPipelineDeal',v_reused,'deal',v_deal);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid value in payload');
end;
$$;
revoke all on function public.plotmap_record_completed_sale(jsonb) from public,anon;
grant execute on function public.plotmap_record_completed_sale(jsonb) to authenticated;
