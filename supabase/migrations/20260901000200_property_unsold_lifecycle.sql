-- MAPCO Desk — the Unsold property lifecycle.
--
-- A dealer removing a property they never sold must not destroy the record:
-- price, seller relationship, photos, documents, notes, the canonical Earth
-- location, mapPlacement, sector references and every Property Intelligence
-- result keyed on the property id all have to survive so the removal can be
-- undone. So removal becomes a fifth canonical lifecycle, 'unsold', written
-- through the ordinary property save — the row is never deleted and never
-- tombstoned.
--
-- 'unsold' is deliberately distinct from 'archived'. Archived means Off
-- market / On hold: a property the dealer still holds and has only paused.
-- Unsold means the dealer took it off their list without selling it.

-- ---------- 1. accept 'unsold' as a canonical lifecycle ----------
-- Same shape as 20260823000100; only the allowed set widens. The On Sale
-- completeness requirement is unchanged, and 'unsold' carries no completeness
-- requirement of its own: an incomplete draft can be removed too, and comes
-- back as a draft.
alter table public.crm_records drop constraint if exists crm_records_property_lifecycle_valid;
alter table public.crm_records add constraint crm_records_property_lifecycle_valid check (
  entity_type <> 'properties' or payload->>'lifecycle' is null or (
    payload->>'lifecycle' in ('draft','on-sale','sold','archived','unsold')
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

-- A removed property is never client-facing. The presentation and client-link
-- projections already gate on published / clientVisible / sold, all of which
-- the canonical lifecycle writer sets false for 'unsold', so no client-facing
-- SQL changes here. This is the belt-and-braces assertion of that rule.
alter table public.crm_records drop constraint if exists crm_records_unsold_not_client_facing;
alter table public.crm_records add constraint crm_records_unsold_not_client_facing check (
  entity_type <> 'properties' or coalesce(payload->>'lifecycle','') <> 'unsold' or (
    coalesce(lower(payload->>'published'), 'false') <> 'true'
    and coalesce(lower(payload->>'clientVisible'), 'false') <> 'true'
    and coalesce(lower(payload->>'sold'), 'false') <> 'true'
  )
) not valid;
alter table public.crm_records validate constraint crm_records_unsold_not_client_facing;

-- ---------- 2. a removed property is not a seller's live property ----------
-- 'live' has always meant "still on the books". A record the dealer removed
-- without selling is neither live nor sold, so it must not inflate a seller's
-- live count nor block that seller from being archived.
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
          count(*) filter (
            where coalesce(r.payload->>'lifecycle','') not in ('sold','unsold')
          )                                                                      as live_count,
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
      and coalesce(r.payload->>'lifecycle','') not in ('sold','unsold');
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
