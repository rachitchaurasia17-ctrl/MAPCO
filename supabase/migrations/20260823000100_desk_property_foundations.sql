-- MAPCO Desk property foundations: reusable private sellers, canonical private
-- property documents, lifecycle compatibility, and idempotent completed sales.
-- No buyer/client projection reads from these private tables or bucket.

alter table public.crm_records drop constraint if exists crm_records_property_lifecycle_valid;
alter table public.crm_records add constraint crm_records_property_lifecycle_valid check (
  entity_type <> 'properties' or payload->>'lifecycle' is null or (
    payload->>'lifecycle' in ('draft','on-sale','sold','archived')
    and (payload->>'lifecycle' <> 'on-sale' or (
      nullif(trim(payload->>'type'),'') is not null
      and nullif(trim(payload->>'city'),'') is not null
      and nullif(trim(payload->>'area'),'') is not null
      and nullif(trim(payload->>'size'),'') is not null
      and nullif(trim(payload->>'facing'),'') is not null
      and nullif(trim(payload->>'position'),'') is not null
    ))
  )
) not valid;
alter table public.crm_records validate constraint crm_records_property_lifecycle_valid;

create table if not exists public.desk_sellers (
  id text primary key,
  dealer_id text not null,
  name text not null check (length(trim(name)) between 1 and 120),
  primary_phone text not null check (length(trim(primary_phone)) between 1 and 24),
  alternate_phone text check (alternate_phone is null or length(trim(alternate_phone)) between 1 and 24),
  seller_type text not null check (seller_type in ('individual','builder','broker','company')),
  city text,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists desk_sellers_dealer_updated_idx
  on public.desk_sellers (dealer_id, updated_at desc);

create or replace function public.plotmap_touch_desk_seller_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := timezone('utc', now()); return new; end;
$$;
revoke all on function public.plotmap_touch_desk_seller_updated_at() from public, anon, authenticated;
drop trigger if exists desk_sellers_touch_updated_at on public.desk_sellers;
create trigger desk_sellers_touch_updated_at before update on public.desk_sellers
for each row execute function public.plotmap_touch_desk_seller_updated_at();

create table if not exists public.desk_property_sellers (
  id text primary key,
  dealer_id text not null,
  property_id text not null references public.crm_records(id) on delete restrict,
  seller_id text not null references public.desk_sellers(id) on delete restrict,
  asking_price numeric check (asking_price is null or asking_price > 0),
  relationship text not null check (relationship in ('owner','co-owner','builder','authorized-seller')),
  availability text not null default 'unconfirmed' check (availability in ('available','unconfirmed','unavailable')),
  last_confirmed_at timestamptz,
  site_visit_instructions text,
  note text,
  document_status text,
  is_primary boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dealer_id, property_id, seller_id)
);
create index if not exists desk_property_sellers_seller_idx
  on public.desk_property_sellers (dealer_id, seller_id);
create unique index if not exists desk_property_sellers_one_primary_idx
  on public.desk_property_sellers (dealer_id, property_id) where is_primary;

create table if not exists public.desk_property_documents (
  id text primary key,
  dealer_id text not null,
  property_id text not null references public.crm_records(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 160),
  document_type text not null check (document_type in (
    'registry','allotment-letter','possession-letter','rera-certificate',
    'gmada-approval','site-plan','other'
  )),
  storage_bucket text not null default 'property-documents' check (storage_bucket = 'property-documents'),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  visibility text not null default 'private' check (visibility in ('private','dealer-team','approved-for-sharing')),
  safety text not null default 'private' check (safety in ('private','sensitive','verified-shareable')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists desk_property_documents_property_idx
  on public.desk_property_documents (dealer_id, property_id, created_at desc);

create or replace function public.plotmap_validate_desk_property_child()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.crm_records r where r.id = new.property_id
      and r.dealer_id = new.dealer_id and r.entity_type = 'properties'
      and coalesce(r.deleted, false) = false
  ) then raise exception 'property_not_available'; end if;
  if tg_table_name = 'desk_property_sellers' then
    if not exists (
      select 1 from public.desk_sellers s where s.id = new.seller_id and s.dealer_id = new.dealer_id
    ) then raise exception 'seller_not_available'; end if;
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;
revoke all on function public.plotmap_validate_desk_property_child() from public, anon, authenticated;

drop trigger if exists desk_property_sellers_validate on public.desk_property_sellers;
create trigger desk_property_sellers_validate before insert or update on public.desk_property_sellers
for each row execute function public.plotmap_validate_desk_property_child();
drop trigger if exists desk_property_documents_validate on public.desk_property_documents;
create trigger desk_property_documents_validate before insert or update on public.desk_property_documents
for each row execute function public.plotmap_validate_desk_property_child();

alter table public.desk_sellers enable row level security;
alter table public.desk_property_sellers enable row level security;
alter table public.desk_property_documents enable row level security;

do $$ declare v_table text; begin
  foreach v_table in array array['desk_sellers','desk_property_sellers','desk_property_documents'] loop
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

grant select, insert, update, delete on public.desk_sellers to authenticated;
grant select, insert, update, delete on public.desk_property_sellers to authenticated;
grant select, insert, update, delete on public.desk_property_documents to authenticated;

create or replace function public.plotmap_assign_property_seller(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_property text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_seller text := nullif(trim(coalesce(p_payload->>'sellerId','')), '');
  v_id text := coalesce(nullif(trim(p_payload->>'id'), ''), 'property-seller-' || encode(extensions.gen_random_bytes(8), 'hex'));
  v_primary boolean := coalesce((p_payload->>'isPrimary')::boolean, true);
  v_row public.desk_property_sellers%rowtype;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
     or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'seller access denied'; end if;
  if not exists (select 1 from public.crm_records where dealer_id=v_dealer and id=v_property
    and entity_type='properties' and not deleted)
    or not exists (select 1 from public.desk_sellers where dealer_id=v_dealer and id=v_seller)
  then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if nullif(p_payload->>'askingPrice','')::numeric <= 0 then
    return jsonb_build_object('ok',false,'reason','asking price must be positive');
  end if;
  if v_primary then update public.desk_property_sellers set is_primary=false, updated_at=timezone('utc',now())
    where dealer_id=v_dealer and property_id=v_property and is_primary; end if;
  insert into public.desk_property_sellers (
    id,dealer_id,property_id,seller_id,asking_price,relationship,availability,last_confirmed_at,
    site_visit_instructions,note,document_status,is_primary
  ) values (
    v_id,v_dealer,v_property,v_seller,nullif(p_payload->>'askingPrice','')::numeric,
    coalesce(nullif(p_payload->>'relationship',''),'owner'),
    coalesce(nullif(p_payload->>'availability',''),'unconfirmed'),
    nullif(p_payload->>'lastConfirmedAt','')::timestamptz,
    nullif(p_payload->>'siteVisitInstructions',''),nullif(p_payload->>'note',''),
    nullif(p_payload->>'documentStatus',''),v_primary
  ) on conflict (dealer_id,property_id,seller_id) do update set
    asking_price=excluded.asking_price, relationship=excluded.relationship,
    availability=excluded.availability,last_confirmed_at=excluded.last_confirmed_at,
    site_visit_instructions=excluded.site_visit_instructions,note=excluded.note,
    document_status=excluded.document_status,is_primary=excluded.is_primary
  returning * into v_row;
  return jsonb_build_object('ok',true,'relationship',to_jsonb(v_row)-'dealer_id'-'created_at'-'updated_at');
exception when invalid_text_representation or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid seller relationship');
end;
$$;
revoke all on function public.plotmap_assign_property_seller(jsonb) from public, anon;
grant execute on function public.plotmap_assign_property_seller(jsonb) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('property-documents','property-documents',false,20971520,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=20971520,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];

create or replace function public.plotmap_property_document_path_valid(p_path text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select (storage.foldername(p_path))[1]='dealers'
    and (storage.foldername(p_path))[2] is not null
    and (storage.foldername(p_path))[3]='properties'
    and (storage.foldername(p_path))[4] is not null
    and (storage.foldername(p_path))[5]='documents'
    and (storage.foldername(p_path))[6] is null
    and lower(storage.extension(p_path)) in ('pdf','jpg','jpeg','png','webp')
    and exists (select 1 from public.crm_records r
      where r.dealer_id=(storage.foldername(p_path))[2]
      and r.id=(storage.foldername(p_path))[4]
      and r.entity_type='properties' and not r.deleted);
$$;
revoke all on function public.plotmap_property_document_path_valid(text) from public,anon,authenticated;
grant execute on function public.plotmap_property_document_path_valid(text) to authenticated;

drop policy if exists "plotmap property documents private read" on storage.objects;
create policy "plotmap property documents private read" on storage.objects for select to authenticated using (
  bucket_id='property-documents' and public.plotmap_is_active_member()
  and public.plotmap_current_role()<>'viewer'
  and (storage.foldername(name))[2]=public.plotmap_current_dealer_id()
  and public.plotmap_property_document_path_valid(name));
drop policy if exists "plotmap property documents private insert" on storage.objects;
create policy "plotmap property documents private insert" on storage.objects for insert to authenticated with check (
  bucket_id='property-documents' and public.plotmap_can_edit_crm()
  and public.plotmap_dealer_can_write((storage.foldername(name))[2])
  and (storage.foldername(name))[2]=public.plotmap_current_dealer_id()
  and public.plotmap_property_document_path_valid(name));
drop policy if exists "plotmap property documents private delete" on storage.objects;
create policy "plotmap property documents private delete" on storage.objects for delete to authenticated using (
  bucket_id='property-documents' and public.plotmap_can_edit_crm()
  and public.plotmap_dealer_can_write((storage.foldername(name))[2])
  and (storage.foldername(name))[2]=public.plotmap_current_dealer_id()
  and public.plotmap_property_document_path_valid(name));

create unique index if not exists crm_one_canonical_completed_sale_per_property
  on public.crm_records (dealer_id, (payload->>'propertyId'))
  where entity_type='deals' and not deleted and payload->>'recordType'='completed-sale';

create or replace function public.plotmap_record_completed_sale(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_dealer_id text := public.plotmap_current_dealer_id();
  v_property_id text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_buyer_id text := nullif(trim(coalesce(p_payload->>'buyerId','')), '');
  v_new_buyer jsonb := p_payload->'newBuyer';
  v_prop record; v_existing_deal jsonb; v_buyer_name text;
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
    'id',v_deal_id,'recordType','completed-sale','propertyId',v_property_id,'propId',v_property_id,
    'prop',v_prop_name,'propSub',v_prop_sub,'city',v_city,'sector',v_sector,
    'buyerId',v_buyer_id,'buyer',v_buyer_name,'sellerId',v_seller_id,'seller',left(v_seller_name,120),
    'sellerPhone',left(v_seller_phone,24),'soldPrice',v_sold_price,
    'brokerage',nullif(p_payload->>'brokerage','')::numeric,'commission',nullif(p_payload->>'commission','')::numeric,
    'commissionReceived',(p_payload->>'commissionReceived')::boolean,
    'paymentReceived',nullif(p_payload->>'paymentReceived','')::numeric,'soldDate',v_sale_date,
    'registrationDate',v_reg_date,'dealer',v_dealer_name,
    'documents',case when jsonb_typeof(v_documents)='array' and jsonb_array_length(v_documents)<=20 then v_documents else '[]'::jsonb end,
    'timeline',v_timeline));
  insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at)
    values(v_deal_id,v_dealer_id,'deals',v_deal,false,timezone('utc',now()));
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
      jsonb_build_object('propertyId',v_property_id,'soldPrice',v_sold_price)); exception when others then null; end;
  return jsonb_build_object('ok',true,'idempotent',false,'deal',v_deal);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid value in payload');
end;
$$;
revoke all on function public.plotmap_record_completed_sale(jsonb) from public,anon;
grant execute on function public.plotmap_record_completed_sale(jsonb) to authenticated;
