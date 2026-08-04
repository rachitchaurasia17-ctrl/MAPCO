-- Client link: per-property typed price (customPrices) overrides the stored
-- price (which changes daily); and when precise location is on ('exact'), the
-- snapshot carries city + map placement so the client page can pin the plot on
-- its sector map and city masterplan. Only the property snapshot build changed
-- (price -> customPrices; added 'city' and 'placement'). Full body re-created so
-- the migration is self-contained.
CREATE OR REPLACE FUNCTION public.plotmap_create_client_link(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
declare
  v_dealer_id text := public.plotmap_current_dealer_id();
  v_client_id text := nullif(trim(coalesce(p_payload ->> 'clientId', '')), '');
  v_property_ids text[];
  v_property_count integer;
  v_price_visibility text := coalesce(nullif(p_payload ->> 'priceVisibility', ''), 'hidden');
  v_location_visibility text := coalesce(nullif(p_payload ->> 'locationVisibility', ''), 'area');
  v_expiry_days integer := coalesce((p_payload ->> 'expiresInDays')::integer, 7);
  v_expires_at timestamptz;
  v_client_name text;
  v_branding jsonb;
  v_properties jsonb := '[]'::jsonb;
  v_media jsonb := '{}'::jsonb;
  v_property record;
  v_property_public_id text;
  v_photos_safe jsonb;
  v_refs jsonb;
  v_ref text;
  v_kind text;
  v_index integer;
  v_source text;
  v_photo_public_id text;
  v_photo_count integer;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text;
  v_link_id uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_audio_path text;
  v_audio_seconds integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 65536 then
    raise exception 'invalid client link payload';
  end if;

  if auth.uid() is null or v_dealer_id is null or not public.plotmap_client_link_can_manage() then
    raise exception 'client link access denied';
  end if;

  if v_client_id is not null and not exists (
    select 1 from public.crm_records r
    where r.dealer_id = v_dealer_id
      and r.id = v_client_id
      and r.entity_type = 'clients'
      and coalesce(r.deleted, false) = false
  ) then
    raise exception 'customer is not available';
  end if;

  if jsonb_typeof(p_payload -> 'propertyIds') <> 'array' then
    raise exception 'choose between one and four properties';
  end if;

  select array_agg(item order by ord), count(*)
    into v_property_ids, v_property_count
  from jsonb_array_elements_text(p_payload -> 'propertyIds') with ordinality as x(item, ord);

  if v_property_count < 1 or v_property_count > 4
     or cardinality(array(select distinct unnest(v_property_ids))) <> v_property_count
     or exists (select 1 from unnest(v_property_ids) x where nullif(trim(x), '') is null) then
    raise exception 'choose between one and four unique properties';
  end if;

  if v_price_visibility not in ('hidden', 'shown') then
    raise exception 'invalid price visibility';
  end if;
  if v_location_visibility not in ('hidden', 'area', 'exact') then
    raise exception 'invalid location visibility';
  end if;
  if v_expiry_days not in (3, 7, 14, 30) then
    raise exception 'invalid expiry';
  end if;
  v_expires_at := timezone('utc'::text, now()) + make_interval(days => v_expiry_days);

  if v_client_id is not null then
    select left(coalesce(nullif(trim(r.payload ->> 'name'), ''), 'Client'), 80)
      into v_client_name
    from public.crm_records r
    where r.dealer_id = v_dealer_id and r.id = v_client_id and r.entity_type = 'clients';
  else
    v_client_name := 'Client';
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'brandName', left(coalesce(nullif(trim(d.brand_name), ''), 'PlotMap'), 120),
    'tagline', left(coalesce(nullif(trim(d.brand_tagline), ''), nullif(trim(d.presentation_tagline), '')), 180),
    'logoUrl', case when d.logo_url ~ '^https://' then left(d.logo_url, 2048) else null end,
    'phone', left(nullif(regexp_replace(coalesce(d.support_phone, ''), '[^0-9+ -]', '', 'g'), ''), 32),
    'whatsapp', left(nullif(regexp_replace(coalesce(d.whatsapp_number, ''), '[^0-9+]', '', 'g'), ''), 24)
  )) into v_branding
  from public.dealer_settings d
  where d.dealer_id = v_dealer_id;

  v_branding := coalesce(v_branding, jsonb_build_object('brandName', 'PlotMap'));

  for v_property in
    select r.id, r.payload, x.ord
    from unnest(v_property_ids) with ordinality as x(id, ord)
    join public.crm_records r on r.id = x.id and r.dealer_id = v_dealer_id
    where r.entity_type = 'properties'
      and coalesce(r.deleted, false) = false
      and coalesce((r.payload ->> 'clientVisible')::boolean, true) = true
      and coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'
    order by x.ord
  loop
    v_property_public_id := encode(extensions.gen_random_bytes(12), 'hex');
    v_photos_safe := '[]'::jsonb;
    v_photo_count := 0;
    v_refs := coalesce(p_payload -> 'photoSelections' -> v_property.id, '[]'::jsonb);
    if jsonb_typeof(v_refs) <> 'array' or jsonb_array_length(v_refs) > 8 then
      raise exception 'invalid photo selection';
    end if;

    for v_ref in select value from jsonb_array_elements_text(v_refs)
    loop
      if v_ref !~ '^(external|storage):[0-7]$' then
        raise exception 'invalid photo selection';
      end if;
      v_kind := split_part(v_ref, ':', 1);
      v_index := split_part(v_ref, ':', 2)::integer;
      v_source := null;

      if v_kind = 'external' then
        v_source := v_property.payload -> 'photos' ->> v_index;
        if v_source is null or v_source !~ '^https://' or length(v_source) > 2048 then
          raise exception 'selected external photo is not approved';
        end if;
      else
        if coalesce(v_property.payload -> 'photoStorage' -> v_index ->> 'kind', '') <> 'storage' then
          raise exception 'selected stored photo is not approved';
        end if;
        v_source := v_property.payload -> 'photoStorage' -> v_index ->> 'path';
        if v_source is null
           or public.plotmap_photo_dealer_id(v_source) <> v_dealer_id
           or public.plotmap_photo_property_id(v_source) <> v_property.id
           or not public.plotmap_property_photo_path_is_valid(v_source) then
          raise exception 'selected stored photo is not approved';
        end if;
      end if;

      v_photo_public_id := encode(extensions.gen_random_bytes(10), 'hex');
      v_photos_safe := v_photos_safe || jsonb_build_array(jsonb_build_object(
        'id', v_photo_public_id,
        'kind', v_kind,
        'url', case when v_kind = 'external' then v_source else null end
      ));
      v_media := v_media || jsonb_build_object(v_photo_public_id, jsonb_build_object(
        'kind', v_kind,
        'source', v_source
      ));
      v_photo_count := v_photo_count + 1;
    end loop;

    if v_photo_count < 1 then
      raise exception 'choose at least one approved photo for each property';
    end if;

    v_properties := v_properties || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', v_property_public_id,
      'title', left(coalesce(nullif(trim(v_property.payload ->> 'title'), ''), 'Property'), 160),
      'propertyType', left(nullif(trim(coalesce(v_property.payload ->> 'propertyType', v_property.payload ->> 'type')), ''), 80),
      'size', left(nullif(trim(v_property.payload ->> 'size'), ''), 80),
      'facing', left(nullif(trim(v_property.payload ->> 'facing'), ''), 80),
      'roadWidth', left(nullif(trim(v_property.payload ->> 'roadWidth'), ''), 80),
      'description', left(nullif(trim(v_property.payload ->> 'description'), ''), 500),
      'area', case when v_location_visibility in ('area', 'exact') then left(nullif(trim(v_property.payload ->> 'area'), ''), 120) else null end,
      'sector', case when v_location_visibility = 'exact' then left(nullif(trim(coalesce(v_property.payload ->> 'sector', v_property.payload ->> 'block')), ''), 120) else null end,
      'plotNumber', case when v_location_visibility = 'exact' then left(nullif(trim(v_property.payload ->> 'plotNumber'), ''), 80) else null end,
      'price', nullif(p_payload -> 'customPrices' ->> v_property.id, ''),
      'city', case when v_location_visibility = 'exact' then left(nullif(trim(v_property.payload ->> 'city'), ''), 80) else null end,
      'placement', case when v_location_visibility = 'exact' then v_property.payload -> 'mapPlacement' else null end,
      'photos', v_photos_safe
    )));
  end loop;

  if jsonb_array_length(v_properties) <> v_property_count then
    raise exception 'one or more properties are not client-visible';
  end if;

  v_audio_path := nullif(trim(coalesce(p_payload -> 'audio' ->> 'objectPath', '')), '');
  v_audio_seconds := coalesce((p_payload -> 'audio' ->> 'seconds')::integer, 0);
  if v_audio_path is not null then
    if v_audio_seconds < 1 or v_audio_seconds > 120
       or not public.plotmap_client_link_audio_path_is_valid(v_audio_path)
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'client-link-audio' and o.name = v_audio_path
       ) then
      raise exception 'invalid client link audio';
    end if;
  end if;

  v_snapshot := jsonb_build_object(
    'version', 1,
    'customer', jsonb_build_object('name', split_part(v_client_name, ' ', 1)),
    'branding', v_branding,
    'visibility', jsonb_build_object('price', v_price_visibility, 'location', v_location_visibility),
    'properties', v_properties,
    'audio', case when v_audio_path is null then null else jsonb_build_object('available', true, 'seconds', v_audio_seconds) end
  );
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.share_links (
    id, dealer_id, created_by, target_type, target_id, client_id, property_ids,
    label, slug, url, status, expires_at, metadata, token_hash, token_hint,
    snapshot_version, created_at, updated_at
  ) values (
    v_link_id, v_dealer_id, auth.uid(), 'client_link', v_property_ids[1], v_client_id, v_property_ids,
    'Private client link', null, '/client/', 'active', v_expires_at,
    jsonb_build_object(
      'client_snapshot', v_snapshot,
      'client_media', v_media,
      'audio_object_path', v_audio_path,
      'audio_seconds', case when v_audio_path is null then null else v_audio_seconds end
    ),
    v_token_hash, right(v_raw_token, 4), 1,
    timezone('utc'::text, now()), timezone('utc'::text, now())
  );

  insert into public.audit_logs (
    dealer_id, actor_profile_id, actor_role, action_type, entity_type, entity_id, metadata
  ) values (
    v_dealer_id, auth.uid(), public.plotmap_current_role(), 'client_link_created',
    'share_links', v_link_id::text,
    jsonb_build_object('property_count', v_property_count, 'expires_at', v_expires_at)
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_link_id,
    'token', v_raw_token,
    'slug', v_raw_token,
    'url', '/client/?token=' || v_raw_token,
    'expiresAt', v_expires_at
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid client link payload';
end;
$function$;
