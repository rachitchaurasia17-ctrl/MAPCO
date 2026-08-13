-- Defense in depth: even a direct authenticated RPC call cannot smuggle a
-- custom price into a bearer snapshot whose visibility is declared hidden.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.plotmap_create_client_link(jsonb)'::regprocedure) into v_definition;
  v_updated := replace(
    v_definition,
    $old$'price', nullif(p_payload -> 'customPrices' ->> v_property.id, ''),$old$,
    $new$'price', case when v_price_visibility = 'shown' then nullif(p_payload -> 'customPrices' ->> v_property.id, '') else null end,$new$
  );
  v_updated := replace(
    v_updated,
    $old$'placement', case when v_location_visibility = 'exact' then v_property.payload -> 'mapPlacement' else null end,$old$,
    $new$'placement', case when v_location_visibility = 'exact'
        and jsonb_typeof(v_property.payload -> 'mapPlacement') = 'object'
        and nullif(trim(v_property.payload -> 'mapPlacement' ->> 'mapId'), '') is not null
        and jsonb_typeof(v_property.payload -> 'mapPlacement' -> 'x') = 'number'
        and jsonb_typeof(v_property.payload -> 'mapPlacement' -> 'y') = 'number'
        and (v_property.payload -> 'mapPlacement' ->> 'x')::numeric between 0 and 1
        and (v_property.payload -> 'mapPlacement' ->> 'y')::numeric between 0 and 1
        then jsonb_build_object(
          'mapId', left(trim(v_property.payload -> 'mapPlacement' ->> 'mapId'), 160),
          'x', (v_property.payload -> 'mapPlacement' ->> 'x')::numeric,
          'y', (v_property.payload -> 'mapPlacement' ->> 'y')::numeric
        ) else null end,$new$
  );
  if position($old$'price', nullif(p_payload -> 'customPrices'$old$ in v_updated) > 0
     or position($old$case when v_price_visibility = 'shown'$old$ in v_updated) = 0 then
    raise exception 'plotmap_create_client_link definition did not match the expected price-visibility baseline';
  end if;
  if position($old$then v_property.payload -> 'mapPlacement' else null end$old$ in v_updated) > 0
     or position($old$'mapId', left(trim(v_property.payload -> 'mapPlacement' ->> 'mapId'), 160)$old$ in v_updated) = 0 then
    raise exception 'plotmap_create_client_link placement projection did not match the expected safe baseline';
  end if;
  execute v_updated;
end;
$migration$;

revoke all on function public.plotmap_create_client_link(jsonb) from public, anon;
grant execute on function public.plotmap_create_client_link(jsonb) to authenticated;
