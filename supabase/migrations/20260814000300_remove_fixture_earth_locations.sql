-- Remediate the exact five development-fixture coordinates written by an older
-- canonical-location backfill. The match includes fixture id, exact coordinate,
-- and source=migrated; dealer-selected/imported/verified locations are untouched.
with fixture_location(id, latitude, longitude) as (
  values
    ('p1', 30.6889::numeric, 76.7361::numeric),
    ('p2', 30.6743::numeric, 76.7189::numeric),
    ('p3', 30.6698::numeric, 76.7147::numeric),
    ('p4', 30.6842::numeric, 76.7442::numeric),
    ('p5', 30.7061::numeric, 76.7328::numeric)
)
update public.crm_records r
set payload = r.payload - 'location',
    updated_at = timezone('utc'::text, now())
from fixture_location f
where r.entity_type = 'properties'
  and coalesce(r.deleted, false) = false
  and r.id = f.id
  and r.payload -> 'location' ->> 'source' = 'migrated'
  and (r.payload -> 'location' ->> 'latitude')::numeric = f.latitude
  and (r.payload -> 'location' ->> 'longitude')::numeric = f.longitude;
