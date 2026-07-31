-- ============================================================
-- MAPCO V2 · Demo dealer seed (dev only)
-- Seeds dealer 'dealer-demo' with settings, a map, and CRM records
-- (properties/clients/deals/demand) mirroring the mock fixtures so
-- Supabase mode shows realistic data. Idempotent (on conflict).
--
-- NOTE: reading these rows requires an authenticated user whose
-- profile.dealer_id = 'dealer-demo'. Create that user via the admin
-- script (needs the service-role key) — see BACKEND_EXECUTION_BRIEF.
-- Inserts here run as the migration owner and bypass RLS.
-- ============================================================

-- ---------- dealer settings (trial account) ----------
insert into public.dealer_settings (dealer_id, brand_name, default_city, subscription_status, account_status, trial_start, trial_end, storage_enabled)
values ('dealer-demo', 'Chaurasia Properties', 'New Chandigarh', 'trial', 'active',
        timezone('utc', now()), timezone('utc', now()) + interval '14 days', true)
on conflict (dealer_id) do update
  set brand_name = excluded.brand_name, subscription_status = excluded.subscription_status;

-- ---------- a published masterplan ----------
insert into public.prebuilt_maps (id, dealer_id, kind, city, sector, label, raster, dims, status, client_visible)
values ('map-nc-master', 'dealer-demo', 'masterplan', 'New Chandigarh', 'Master Plan',
        'New Chandigarh — Master Plan', '/maps-pilot/mohali-masterplan.png',
        '{"original":{"w":1603,"h":1278}}'::jsonb, 'published', true)
on conflict (id) do nothing;

-- ---------- properties ----------
insert into public.crm_records (id, dealer_id, entity_type, payload, deleted)
values
  ('ecocity', 'dealer-demo', 'properties', jsonb_build_object(
    'type','Residential Plot','want','Plot','city','New Chandigarh','area','Eco City',
    'loc','Eco City, New Chandigarh','sector','Eco City, New Chandigarh','size','500 sq yd',
    'facing','North-East','position','Park facing','approvals',jsonb_build_array('RERA','GMADA'),
    'landmarks',jsonb_build_array(jsonb_build_object('name','Chandigarh University','distance','10 min','icon','ph-fill ph-graduation-cap')),
    'price',9500000,'photos',jsonb_build_array('/assets/ph-plot-1.png','/assets/ph-plot-2.png'),
    'published',true,'sold',false,'views',34), false),
  ('block5', 'dealer-demo', 'properties', jsonb_build_object(
    'type','Residential Plot','want','Plot','city','New Chandigarh','area','Zone 2',
    'loc','Zone 2, New Chandigarh','sector','Zone 2, New Chandigarh','size','300 sq yd',
    'facing','East','position','Corner plot','approvals',jsonb_build_array('GMADA'),
    'landmarks',jsonb_build_array(jsonb_build_object('name','Delhi Public School','distance','5 min','icon','ph-fill ph-graduation-cap')),
    'price',5400000,'photos',jsonb_build_array('/assets/ph-plot-2.png'),
    'published',true,'sold',false,'views',21), false),
  ('omx', 'dealer-demo', 'properties', jsonb_build_object(
    'type','Kothi','want','Kothi','city','New Chandigarh','area','Omaxe',
    'loc','Omaxe, New Chandigarh','sector','Omaxe, New Chandigarh','size','1 kanal',
    'facing','North','position','Corner plot','approvals',jsonb_build_array('RERA','GMADA'),
    'landmarks',jsonb_build_array(jsonb_build_object('name','Medicity','distance','9 min','icon','ph-fill ph-first-aid-kit')),
    'price',15000000,'photos',jsonb_build_array('/assets/ph-plot-3.png'),
    'published',true,'sold',false,'views',28), false)
on conflict (id) do nothing;

-- ---------- clients ----------
insert into public.crm_records (id, dealer_id, entity_type, payload, deleted)
values
  ('c1', 'dealer-demo', 'clients', jsonb_build_object(
    'name','Rajiv Sharma','phone','+919876543210','city','Chandigarh','want','Plot',
    'budget','80L – 1.2Cr','budgetMax',12000000,'status','hot','seen','just now',
    'note','Looking for park-facing plot in New Chandigarh.','viewed',jsonb_build_array('ecocity','block5'),
    'interest',jsonb_build_array('ecocity')), false),
  ('c3', 'dealer-demo', 'clients', jsonb_build_object(
    'name','Amandeep Singh','phone','+919876543212','city','New Chandigarh','want','Kothi',
    'budget','1.2Cr – 2Cr','budgetMax',20000000,'status','active','seen','yesterday',
    'note','Big family, needs corner.','viewed',jsonb_build_array('omx'),'interest',jsonb_build_array('omx')), false)
on conflict (id) do nothing;

-- ---------- deals ----------
insert into public.crm_records (id, dealer_id, entity_type, payload, deleted)
values
  ('d1', 'dealer-demo', 'deals', jsonb_build_object(
    'name','Eco City Corner Deal','client','Rajiv Sharma','prop','Eco City plot',
    'propSub','500 sq yd · North-East','area','New Chandigarh','propId','ecocity',
    'value',9500000,'comm',142500,'token',500000,'stage','negotiating'), false),
  ('d3', 'dealer-demo', 'deals', jsonb_build_object(
    'name','Omaxe Premium','client','Amandeep Singh','prop','Omaxe kothi site',
    'propSub','1 kanal · North','area','New Chandigarh','propId','omx',
    'value',15000000,'comm',225000,'token',1000000,'stage','token'), false)
on conflict (id) do nothing;

-- ---------- demand ----------
insert into public.crm_records (id, dealer_id, entity_type, payload, deleted)
values
  ('dm1', 'dealer-demo', 'demand', jsonb_build_object(
    'customerId','c1','customerName','Rajiv Sharma','category','buy',
    'preferredLocations',jsonb_build_array('New Chandigarh','Mohali'),'propertyType','Residential Plot',
    'sizeMin','300 sq yd','sizeMax','500 sq yd','configuration','Park facing preferred',
    'budgetMin',8000000,'budgetMax',12000000,'urgency','immediate','followUp','contacted','status','open'), false),
  ('dm3', 'dealer-demo', 'demand', jsonb_build_object(
    'customerId','c3','customerName','Amandeep Singh','category','invest',
    'preferredLocations',jsonb_build_array('New Chandigarh'),'propertyType','Kothi',
    'configuration','1 kanal','budgetMin',12000000,'budgetMax',20000000,
    'urgency','exploring','followUp','new','status','on-hold'), false)
on conflict (id) do nothing;
