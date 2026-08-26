-- ============================================================
-- MAPCO Desk · Seller completion + dealer-private read models
-- ------------------------------------------------------------
-- The reusable-seller backend from 20260823000100 is complete and
-- correct, but three things the approved Contacts UI captures had no
-- canonical home, so the Desk could not be wired to it without
-- silently dropping dealer input:
--
--   desk_sellers.business          the firm / trading name a dealer
--                                  records beside a person's name
--   desk_sellers.archived          Contacts offers Archive; without a
--                                  column it was in-memory only
--   desk_property_sellers
--     .document_kinds              the UI is a MULTI-select of paper
--                                  kinds; document_status is one text
--                                  column and cannot hold a list
--
-- It also adds two read models. The existing adapter methods
-- (getWithProperties / getForProperty) issue one query PER relation,
-- which is N+1 on both the Sellers list and the Seller profile. These
-- return the whole shape in a single dealer-scoped round trip.
--
-- Nothing here is buyer-facing. Seller identity, phone, asking price,
-- visit instructions and notes are dealer-private and must never reach
-- a client-safe projection.
--
-- Safe to re-run. Creates no demo rows.
-- ============================================================

-- ---------- 1. columns the approved UI already collects ----------

alter table public.desk_sellers
  add column if not exists business text
    check (business is null or length(trim(business)) <= 160);

alter table public.desk_sellers
  add column if not exists archived boolean not null default false;

create index if not exists desk_sellers_dealer_active_idx
  on public.desk_sellers (dealer_id, updated_at desc) where not archived;

alter table public.desk_property_sellers
  add column if not exists document_kinds jsonb not null default '[]'::jsonb;

alter table public.desk_property_sellers
  drop constraint if exists desk_property_sellers_document_kinds_array;
alter table public.desk_property_sellers
  add constraint desk_property_sellers_document_kinds_array check (
    jsonb_typeof(document_kinds) = 'array' and jsonb_array_length(document_kinds) <= 30
  );

-- ---------- 2. assignment accepts the paper multi-select ----------
-- Same contract as 20260823000100 plus documentKinds. Re-declared in
-- full so the tenancy and validation checks stay in one place.

create or replace function public.plotmap_assign_property_seller(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_property text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_seller text := nullif(trim(coalesce(p_payload->>'sellerId','')), '');
  v_id text := coalesce(nullif(trim(p_payload->>'id'), ''), 'property-seller-' || encode(extensions.gen_random_bytes(8), 'hex'));
  v_primary boolean := coalesce((p_payload->>'isPrimary')::boolean, true);
  v_kinds jsonb := coalesce(p_payload->'documentKinds', '[]'::jsonb);
  v_row public.desk_property_sellers%rowtype;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
     or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'seller access denied'; end if;
  if jsonb_typeof(v_kinds) <> 'array' or jsonb_array_length(v_kinds) > 30 then
    v_kinds := '[]'::jsonb;
  end if;
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
    site_visit_instructions,note,document_status,document_kinds,is_primary
  ) values (
    v_id,v_dealer,v_property,v_seller,nullif(p_payload->>'askingPrice','')::numeric,
    coalesce(nullif(p_payload->>'relationship',''),'owner'),
    coalesce(nullif(p_payload->>'availability',''),'unconfirmed'),
    nullif(p_payload->>'lastConfirmedAt','')::timestamptz,
    nullif(p_payload->>'siteVisitInstructions',''),nullif(p_payload->>'note',''),
    nullif(p_payload->>'documentStatus',''),v_kinds,v_primary
  ) on conflict (dealer_id,property_id,seller_id) do update set
    asking_price=excluded.asking_price, relationship=excluded.relationship,
    availability=excluded.availability,last_confirmed_at=excluded.last_confirmed_at,
    site_visit_instructions=excluded.site_visit_instructions,note=excluded.note,
    document_status=excluded.document_status,document_kinds=excluded.document_kinds,
    is_primary=excluded.is_primary
  returning * into v_row;
  return jsonb_build_object('ok',true,'relationship',to_jsonb(v_row)-'dealer_id'-'created_at'-'updated_at');
exception when invalid_text_representation or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid seller relationship');
end;
$$;
revoke all on function public.plotmap_assign_property_seller(jsonb) from public, anon;
grant execute on function public.plotmap_assign_property_seller(jsonb) to authenticated;

-- ---------- 3. seller directory read model ----------
-- One round trip for the Sellers list: every seller with its live and
-- sold property counts and the most recent availability confirmation.

create or replace function public.plotmap_seller_directory(p_include_archived boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_is_active_member()
     or public.plotmap_current_role() = 'viewer'
     or not public.plotmap_dealer_is_active(v_dealer)
  then raise exception 'seller access denied'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.updated_at desc)
    from (
      select
        s.id, s.name, s.primary_phone, s.alternate_phone, s.seller_type,
        s.business, s.city, s.note, s.archived, s.created_at, s.updated_at,
        coalesce(agg.live_count, 0)  as live_count,
        coalesce(agg.sold_count, 0)  as sold_count,
        agg.last_confirmed_at,
        agg.any_unconfirmed,
        coalesce(agg.properties, '[]'::jsonb) as properties
      from public.desk_sellers s
      left join lateral (
        select
          count(*) filter (where coalesce(r.payload->>'lifecycle','') <> 'sold')  as live_count,
          count(*) filter (where coalesce(r.payload->>'lifecycle','') =  'sold')  as sold_count,
          max(ps.last_confirmed_at)                                              as last_confirmed_at,
          bool_or(ps.availability <> 'available')                                as any_unconfirmed,
          jsonb_agg(jsonb_build_object(
            'propertyId', r.id,
            'lifecycle',  coalesce(r.payload->>'lifecycle','draft'),
            'loc',        coalesce(r.payload->>'loc', r.payload->>'area'),
            'price',      r.payload->'price',
            'askingPrice',ps.asking_price,
            'availability',ps.availability,
            'lastConfirmedAt', ps.last_confirmed_at,
            'isPrimary',  ps.is_primary
          ) order by ps.is_primary desc, ps.created_at)                          as properties
        from public.desk_property_sellers ps
        join public.crm_records r
          on r.id = ps.property_id and r.dealer_id = ps.dealer_id
         and r.entity_type = 'properties' and not r.deleted
        where ps.dealer_id = v_dealer and ps.seller_id = s.id
      ) agg on true
      where s.dealer_id = v_dealer
        and (p_include_archived or not s.archived)
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.plotmap_seller_directory(boolean) from public, anon;
grant execute on function public.plotmap_seller_directory(boolean) to authenticated;

-- ---------- 4. seller workspace read model ----------
-- One round trip for a Seller profile: the seller, plus every property
-- it is attached to with the full private relationship facts, split
-- into active and sold.

create or replace function public.plotmap_seller_workspace(p_seller_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_seller jsonb;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_is_active_member()
     or public.plotmap_current_role() = 'viewer'
     or not public.plotmap_dealer_is_active(v_dealer)
  then raise exception 'seller access denied'; end if;

  select to_jsonb(s) - 'dealer_id' into v_seller
  from public.desk_sellers s
  where s.dealer_id = v_dealer and s.id = p_seller_id;
  if v_seller is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  return jsonb_build_object(
    'ok', true,
    'seller', v_seller,
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'property', jsonb_build_object('id', r.id, 'payload', r.payload),
        'relationship', to_jsonb(ps) - 'dealer_id'
      ) order by ps.is_primary desc, ps.created_at)
      from public.desk_property_sellers ps
      join public.crm_records r
        on r.id = ps.property_id and r.dealer_id = ps.dealer_id
       and r.entity_type = 'properties' and not r.deleted
      where ps.dealer_id = v_dealer and ps.seller_id = p_seller_id
    ), '[]'::jsonb));
end;
$$;
revoke all on function public.plotmap_seller_workspace(text) from public, anon;
grant execute on function public.plotmap_seller_workspace(text) to authenticated;

-- ---------- 5. archive / restore ----------
-- Archiving is non-destructive: relationships, documents and completed
-- deals that reference the seller are untouched, so sold history and
-- deal seller context survive.

create or replace function public.plotmap_set_seller_archived(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := nullif(trim(coalesce(p_payload->>'sellerId','')), '');
  v_archived boolean := coalesce((p_payload->>'archived')::boolean, true);
  v_live int;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
     or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'seller access denied'; end if;
  if not exists (select 1 from public.desk_sellers where dealer_id=v_dealer and id=v_id)
    then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  if v_archived then
    select count(*) into v_live
    from public.desk_property_sellers ps
    join public.crm_records r on r.id = ps.property_id and r.dealer_id = ps.dealer_id
     and r.entity_type = 'properties' and not r.deleted
    where ps.dealer_id = v_dealer and ps.seller_id = v_id
      and coalesce(r.payload->>'lifecycle','') <> 'sold';
    if v_live > 0 then
      return jsonb_build_object('ok',false,'reason',
        'this seller is still attached to ' || v_live || ' active propert' ||
        case when v_live = 1 then 'y' else 'ies' end);
    end if;
  end if;

  update public.desk_sellers set archived = v_archived, updated_at = timezone('utc', now())
    where dealer_id = v_dealer and id = v_id;
  return jsonb_build_object('ok',true,'archived',v_archived);
end;
$$;
revoke all on function public.plotmap_set_seller_archived(jsonb) from public, anon;
grant execute on function public.plotmap_set_seller_archived(jsonb) to authenticated;
