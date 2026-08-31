/*
 * Controlled MAPCO-DEV live verification runner.
 *
 * Credentials are read from the gitignored Supabase environment and never
 * printed. Runtime state is written to the OS temp directory for subsequent
 * reload/regeneration/UI checks and removed by the cleanup mode.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^(?:"(.*)"|'(.*)')$/, '$1$2')];
      }),
  );
}

const env = readEnv(process.argv[3] ?? 'supabase/.env');
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;
const expectedRef = String(process.env.MAPCO_PI_VERIFY_PROJECT_REF || '');
if (!SUPABASE_URL || !SERVICE || !ANON || new URL(SUPABASE_URL).hostname !== `${expectedRef}.supabase.co`
    || expectedRef !== 'lswzrkvdwirhvggtvuch') {
  throw new Error('refusing live run without the exact MAPCO-DEV acknowledgement');
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SERVICE, options);
const statePath = join(process.env.TEMP || process.env.TMP || '.', 'mapco-pi-live-session.json');
const mode = process.argv[2] ?? 'first';

function loadState() {
  if (!existsSync(statePath)) throw new Error(`live verification state not found: ${statePath}`);
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

async function must(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function ownerClient(state) {
  const client = createClient(SUPABASE_URL, ANON, options);
  await must('owner sign-in', client.auth.signInWithPassword({
    email: state.ownerEmail, password: state.password,
  }));
  return client;
}

async function invoke(client, propertyId, refresh = false) {
  const started = Date.now();
  const result = await client.functions.invoke('property-intelligence', {
    body: { propertyId, ...(refresh ? { refresh: true } : {}) },
  });
  if (result.error) throw new Error(`Edge invocation: ${result.error.message}`);
  return { body: result.data, elapsedMs: Date.now() - started };
}

function flattenPlaces(pi) {
  const local = (pi?.local_categories ?? []).flatMap((category) => category.places ?? []);
  const city = pi?.city_places ?? [];
  return [...local, ...city];
}

async function readEvidence(state, runId) {
  const pi = await must('persisted intelligence', admin.from('property_intelligence')
    .select('*').eq('dealer_id', state.dealerId).eq('property_id', state.propertyId).maybeSingle());
  const runs = await must('run telemetry', admin.from('property_intelligence_runs')
    .select('*').eq('dealer_id', state.dealerId).eq('property_id', state.propertyId)
    .order('created_at', { ascending: false }));
  const run = runId ? runs.find((row) => row.run_id === runId) : runs[0];
  const events = run ? await must('cost events', admin.from('property_intelligence_cost_events')
    .select('*').eq('run_id', run.run_id).order('event_index')) : [];
  const places = flattenPlaces(pi);
  const placeIds = [...new Set(places.map((place) => place.placeId).filter(Boolean))];
  const registry = placeIds.length ? await must('place registry', admin.from('place_registry')
    .select('*').in('place_id', placeIds)) : [];
  const routes = await must('route cache', admin.from('property_intelligence_routes')
    .select('*').eq('origin_key', state.originKey));
  return { pi, runs, run, events, places, placeIds, registry, routes };
}

function report(label, state, response, evidence) {
  const { pi, run, events, places, registry, routes } = evidence;
  const groundedIdentityHits = (pi?.candidate_universe ?? []).filter(
    (candidate) => candidate?.placesResolution?.provider === 'GEMINI_GROUNDING',
  ).length;
  const paidIdentityResolutions = events.filter((event) => event.operation === 'places_identity')
    .reduce((sum, event) => sum + Number(event.units || 0), 0);
  const photoSuccess = places.filter((place) => place.imageSource === 'google-place-photo' && place.image).length;
  const routeSuccess = places.filter((place) => place.routeStatus === 'ok').length;
  const cacheHits = events.filter((event) => event.cache_hit).length;
  const eventCost = events.reduce((sum, event) => sum + Number(event.estimated_inr || 0), 0);
  const avoided = events.reduce((sum, event) => sum + Number(event.avoided_inr || 0), 0);

  console.log(`\n=== ${label} ===`);
  console.log(`property_id=${state.propertyId}`);
  console.log(`generation_run_id=${run?.run_id ?? pi?.generation_run_id ?? 'missing'}`);
  console.log(`api_status=${response?.body?.status ?? 'missing'}`);
  console.log(`api_reason=${response?.body?.reason ?? 'none'}`);
  console.log(`generation_status=${pi?.generation_status ?? 'missing'}`);
  console.log(`generation_stage=${pi?.generation_stage ?? 'missing'}`);
  console.log(`elapsed_ms=${response?.elapsedMs ?? 0}`);
  console.log(`candidate_count=${pi?.candidate_universe?.length ?? 0}`);
  console.log(`grounded_identity_hits=${groundedIdentityHits}`);
  console.log(`paid_identity_resolution_count=${paidIdentityResolutions}`);
  console.log(`local_category_count=${pi?.local_categories?.length ?? 0}`);
  console.log(`city_place_count=${pi?.city_places?.length ?? 0}`);
  console.log(`photo_success_count=${photoSuccess}`);
  console.log(`route_success_count=${routeSuccess}`);
  console.log(`cache_hit_event_count=${cacheHits}`);
  console.log(`estimated_inr_events=${eventCost.toFixed(4)}`);
  console.log(`estimated_inr_run=${Number(run?.estimated_inr || 0).toFixed(4)}`);
  console.log(`avoided_inr=${avoided.toFixed(4)}`);
  console.log(`pipeline_version=${pi?.pipeline_version ?? 'missing'}`);
  console.log(`phase1_prompt_version=${pi?.phase1_prompt_version ?? 'missing'}`);
  console.log(`phase2_prompt_version=${pi?.phase2_prompt_version ?? 'missing'}`);
  console.log(`phase2_output_persisted=${Boolean(pi?.phase2_output)}`);
  console.log(`registry_records=${registry.length}`);
  console.log(`stored_photo_records=${registry.filter((row) => row.status === 'stored' && row.storage_path && row.public_url).length}`);
  console.log(`route_cache_records=${routes.length}`);
  console.log(`run_telemetry_persisted=${Boolean(run?.run_id)}`);
  console.log('PROVIDER_CALL_LEDGER');
  for (const event of events) {
    console.log([
      `event=${event.event_index}`,
      `provider=${event.provider}`,
      `operation=${event.operation}`,
      `requests=${event.requests}`,
      `units=${event.units}`,
      `input_tokens=${event.input_tokens}`,
      `output_tokens=${event.output_tokens}`,
      `cache_hit=${event.cache_hit}`,
      `estimated_inr=${Number(event.estimated_inr).toFixed(4)}`,
      `avoided_inr=${Number(event.avoided_inr).toFixed(4)}`,
    ].join(' '));
  }
}

async function first() {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const state = {
    dealerId: `pi-v1-live-${suffix}`,
    propertyId: `pi-v1-sector78-${suffix}`,
    clientId: `pi-v1-client-${suffix}`,
    ownerEmail: `pi-v1-owner-${suffix}@mapco.dev`,
    password: `PiLive!${randomUUID()}a9`,
    originKey: '30.68199,76.70244|r1-drive-essentials',
    userIds: [], linkIds: [],
  };
  console.log('SETUP controlled MAPCO-DEV dealer/property with canonical server-owned coordinates');
  await must('dealer', admin.from('dealer_settings').insert({
    dealer_id: state.dealerId, brand_name: 'MAPCO PI V1 Verification',
    account_status: 'active', subscription_status: 'paid',
    expiry_date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  }));
  const created = await must('owner user', admin.auth.admin.createUser({
    email: state.ownerEmail, password: state.password, email_confirm: true,
    user_metadata: { dealer_id: state.dealerId, role: 'owner' },
  }));
  state.userIds.push(created.user.id);
  await must('owner profile', admin.from('profiles').upsert({
    id: created.user.id, email: state.ownerEmail, role: 'owner',
    dealer_id: state.dealerId, status: 'active',
  }));
  const photo = 'https://mapco-navy.vercel.app/assets/ph-plot-1.png';
  await must('property', admin.from('crm_records').insert({
    id: state.propertyId, dealer_id: state.dealerId, entity_type: 'properties', deleted: false,
    payload: {
      id: state.propertyId, title: 'PI V1 Verification Property', type: 'Residential Plot',
      city: 'Mohali', area: 'Sector 78', sector: 'Sector 78', loc: 'Sector 78, Mohali',
      size: '300 sq yd', facing: 'East', roadWidth: '30 ft', price: 9_500_000,
      photos: [photo], published: true, clientVisible: true, sold: false,
      location: { latitude: 30.681991, longitude: 76.702441, updatedAt: new Date().toISOString() },
    },
  }));
  await must('client', admin.from('crm_records').insert({
    id: state.clientId, dealer_id: state.dealerId, entity_type: 'clients', deleted: false,
    payload: { id: state.clientId, name: 'PI Verification Buyer', city: 'Mohali',
      want: 'Residential Plot', budget: 'Verification', status: 'active',
      viewed: [], interest: [], purchased: [] },
  }));
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });

  const owner = await ownerClient(state);
  console.log('RUN deployed Edge → Gemini Phase 1/2 → Places/Photos/Routes → Supabase');
  const response = await invoke(owner, state.propertyId, false);
  const evidence = await readEvidence(state);
  report('FIRST LIVE GENERATION', state, response, evidence);
  state.firstRunId = evidence.run?.run_id ?? null;
  state.firstEstimatedInr = Number(evidence.run?.estimated_inr || 0);
  state.firstPlaceIds = evidence.placeIds;
  state.firstStoragePaths = evidence.registry.map((row) => row.storage_path).filter(Boolean);
  state.firstRouteKeys = evidence.routes.map((row) => `${row.origin_key}::${row.destination_key}`);
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });

  if (response.body?.status !== 'ready' || evidence.pi?.generation_status !== 'complete') {
    throw new Error(`live generation did not complete: ${response.body?.reason ?? evidence.pi?.failure_reason ?? 'unknown'}`);
  }
  if (state.firstEstimatedInr > 40) throw new Error(`generation exceeded ₹40 cap: ${state.firstEstimatedInr}`);
  console.log(`STATE_PATH=${statePath}`);
}

async function retry() {
  const state = loadState();
  const owner = await ownerClient(state);
  console.log('RETRY deployed Edge after bounded-concurrency integration fix');
  const response = await invoke(owner, state.propertyId, false);
  const evidence = await readEvidence(state);
  report('FIRST COMPLETED LIVE GENERATION', state, response, evidence);
  state.firstRunId = evidence.run?.run_id ?? null;
  state.firstEstimatedInr = Number(evidence.run?.estimated_inr || 0);
  state.firstPlaceIds = evidence.placeIds;
  state.firstStoragePaths = evidence.registry.map((row) => row.storage_path).filter(Boolean);
  state.firstRouteKeys = evidence.routes.map((row) => `${row.origin_key}::${row.destination_key}`);
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  if (response.body?.status !== 'ready' || evidence.pi?.generation_status !== 'complete') {
    throw new Error(`retry did not complete: ${response.body?.reason ?? evidence.pi?.failure_reason ?? 'unknown'}`);
  }
  if (state.firstEstimatedInr > 40) throw new Error(`generation exceeded ₹40 cap: ${state.firstEstimatedInr}`);
}

async function complete() {
  const state = loadState();
  const owner = await ownerClient(state);
  let finalEvidence = null;
  let finalResponse = null;
  for (let stage = 1; stage <= 4; stage++) {
    console.log(`CONTINUATION invocation=${stage}`);
    const response = await invoke(owner, state.propertyId, false);
    const evidence = await readEvidence(state);
    report(`LIVE CONTINUATION ${stage}`, state, response, evidence);
    finalEvidence = evidence;
    finalResponse = response;
    if (response.body?.status === 'ready' && evidence.pi?.generation_status === 'complete') break;
    if (response.body?.status !== 'generating') {
      throw new Error(`continuation failed: ${response.body?.reason ?? evidence.pi?.failure_reason ?? 'unknown'}`);
    }
  }
  if (!finalEvidence || finalResponse?.body?.status !== 'ready'
      || finalEvidence.pi?.generation_status !== 'complete') {
    throw new Error('bounded continuations did not produce a ready persisted result');
  }
  state.firstRunId = finalEvidence.run?.run_id ?? null;
  state.firstEstimatedInr = Number(finalEvidence.run?.estimated_inr || 0);
  state.firstPlaceIds = finalEvidence.placeIds;
  state.firstStoragePaths = finalEvidence.registry.map((row) => row.storage_path).filter(Boolean);
  state.firstRouteKeys = finalEvidence.routes.map((row) => `${row.origin_key}::${row.destination_key}`);
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  if (state.firstEstimatedInr > 40) throw new Error(`generation exceeded ₹40 cap: ${state.firstEstimatedInr}`);
}

async function reload() {
  const state = loadState();
  const owner = await ownerClient(state);
  const response = await invoke(owner, state.propertyId, false);
  const evidence = await readEvidence(state);
  report('PERSISTED SAME-PROPERTY RELOAD', state, response, evidence);
  const paid = evidence.events.filter((event) => !event.cache_hit
    && (Number(event.requests) > 0 || Number(event.estimated_inr) > 0));
  if (response.body?.status !== 'ready' || response.body?.cache !== 'hit') {
    throw new Error('normal reload did not use persisted intelligence');
  }
  if (paid.length || Number(evidence.run?.estimated_inr || 0) !== 0) {
    throw new Error('normal reload incurred provider cost');
  }
  state.reloadRunId = evidence.run?.run_id ?? null;
  state.reloadEstimatedInr = Number(evidence.run?.estimated_inr || 0);
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  console.log('provider_calls_avoided=gemini_phase1,gemini_phase2,places_identity,places_details,place_photo,routes');
}

async function regenerate() {
  const state = loadState();
  const owner = await ownerClient(state);
  console.log('REGENERATE concurrent refresh requests=2');
  const [a, b] = await Promise.all([
    invoke(owner, state.propertyId, true), invoke(owner, state.propertyId, true),
  ]);
  const lockResponses = [a.body?.cache, b.body?.cache];
  console.log(`regeneration_lock_responses=${lockResponses.join(',')}`);
  if (!lockResponses.includes('busy') || !lockResponses.includes('miss')) {
    throw new Error('concurrent regeneration did not produce one lease winner and one busy response');
  }
  let evidence = await readEvidence(state);
  report('REGENERATION CHECKPOINT 1', state, a.body?.cache === 'miss' ? a : b, evidence);
  const regenerationRunId = evidence.pi?.generation_run_id;
  if (!regenerationRunId || regenerationRunId === state.firstRunId) {
    throw new Error('regeneration did not create a new generation run');
  }

  const stale = await must('stale-run fence check', admin.rpc(
    'plotmap_property_intelligence_store_v3', {
      p_dealer_id: state.dealerId, p_property_id: state.propertyId,
      p_payload: { runId: state.firstRunId },
    },
  ));
  console.log(`stale_run_store_reason=${stale?.reason ?? 'missing'}`);
  if (stale?.reason !== 'stale_generation') throw new Error('stale run was not fenced');

  let response = a.body?.cache === 'miss' ? a : b;
  for (let continuation = 2; continuation <= 4; continuation++) {
    if (response.body?.status === 'ready' && evidence.pi?.generation_status === 'complete') break;
    response = await invoke(owner, state.propertyId, false);
    evidence = await readEvidence(state);
    report(`REGENERATION CHECKPOINT ${continuation}`, state, response, evidence);
    if (response.body?.status !== 'generating' && response.body?.status !== 'ready') {
      throw new Error(`regeneration continuation failed: ${response.body?.reason ?? 'unknown'}`);
    }
  }
  if (response.body?.status !== 'ready' || evidence.pi?.generation_status !== 'complete') {
    throw new Error('regeneration did not complete');
  }
  const run = evidence.runs.find((row) => row.run_id === regenerationRunId);
  const events = await must('regeneration events', admin.from('property_intelligence_cost_events')
    .select('*').eq('run_id', regenerationRunId).order('event_index'));
  const photoReuses = events.filter((event) => event.operation === 'place_photo' && event.cache_hit);
  const routeReuses = events.filter((event) => event.operation === 'routes_compute_route' && event.cache_hit);
  const storagePaths = evidence.registry.map((row) => row.storage_path).filter(Boolean);
  const duplicatePaths = storagePaths.filter((path, index) => storagePaths.indexOf(path) !== index);
  const commonPlaces = evidence.placeIds.filter((id) => (state.firstPlaceIds ?? []).includes(id));
  console.log(`regeneration_run_id=${regenerationRunId}`);
  console.log(`regeneration_estimated_inr=${Number(run?.estimated_inr || 0).toFixed(4)}`);
  console.log(`photo_reuse_events=${photoReuses.length}`);
  console.log(`route_reuse_events=${routeReuses.length}`);
  console.log(`common_place_ids_reused=${commonPlaces.length}`);
  console.log(`duplicate_selected_storage_paths=${duplicatePaths.length}`);
  console.log(`refresh_reason=${run?.refresh_reason ?? 'missing'}`);
  console.log(`cache_outcome=${run?.cache_outcome ?? 'missing'}`);
  if (!photoReuses.length || !routeReuses.length || !commonPlaces.length || duplicatePaths.length) {
    throw new Error('regeneration did not prove global photo/route reuse without duplicates');
  }
  if (Number(run?.estimated_inr || 0) > 40) throw new Error('regeneration exceeded ₹40 cap');
  if (run?.cache_outcome !== 'refresh' || run?.refresh_reason !== 'manual_refresh') {
    throw new Error('regeneration telemetry did not retain intentional refresh semantics');
  }
  state.regenerationRunId = regenerationRunId;
  state.regenerationEstimatedInr = Number(run?.estimated_inr || 0);
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
}

async function resolveClientLink(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/resolve-client-link`, {
    method: 'POST',
    headers: {
      Origin: 'https://mapco-navy.vercel.app', apikey: ANON,
      Authorization: `Bearer ${ANON}`, 'content-type': 'application/json',
      'x-client-info': 'mapco-pi-live-verifier', 'x-mapco-client': 'v2-web',
    },
    body: JSON.stringify({ token }),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function publicIntel(resolved) {
  return resolved.body?.link?.properties?.[0]?.intelligence ?? null;
}

async function links() {
  const state = loadState();
  const owner = await ownerClient(state);
  const common = {
    clientId: state.clientId, propertyIds: [state.propertyId], expiresInDays: 7,
    photoSelections: { [state.propertyId]: ['external:0'] },
  };
  const exact = await must('exact Client Link', owner.rpc('plotmap_create_client_link', {
    p_payload: { ...common, priceVisibility: 'shown', locationVisibility: 'exact' },
  }));
  const area = await must('area Client Link', owner.rpc('plotmap_create_client_link', {
    p_payload: { ...common, priceVisibility: 'hidden', locationVisibility: 'area' },
  }));
  if (!exact?.token || !area?.token) throw new Error('Client Link token missing');
  state.linkIds.push(exact.id, area.id);
  state.exactLinkToken = exact.token;
  state.areaLinkToken = area.token;
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });

  const [exactResolved, areaResolved] = await Promise.all([
    resolveClientLink(exact.token), resolveClientLink(area.token),
  ]);
  const exactIntel = publicIntel(exactResolved);
  const areaIntel = publicIntel(areaResolved);
  const exactPlaces = exactIntel
    ? [...(exactIntel.local ?? []).flatMap((category) => category.places ?? []), ...(exactIntel.city ?? [])]
    : [];
  const areaPlaces = areaIntel
    ? [...(areaIntel.local ?? []).flatMap((category) => category.places ?? []), ...(areaIntel.city ?? [])]
    : [];
  const hiddenRaw = JSON.stringify(areaResolved.body);
  const hiddenSafe = areaIntel?.origin === null && areaPlaces.length > 0 && areaPlaces.every((place) =>
    place.distanceMeters === null && place.durationSeconds === null
    && place.encodedPolyline === null && place.routeTarget === null
    && place.latitude === null && place.longitude === null);
  const exactWorks = exactIntel?.origin?.latitude === 30.681991
    && exactIntel?.origin?.longitude === 76.702441
    && exactPlaces.some((place) => place.distanceMeters > 0 && place.encodedPolyline);
  console.log(`exact_link_resolved=${exactResolved.response.ok && exactResolved.body?.ok === true}`);
  console.log(`exact_intelligence_places=${exactPlaces.length}`);
  console.log(`exact_location_intelligence_present=${Boolean(exactWorks)}`);
  console.log(`hidden_link_resolved=${areaResolved.response.ok && areaResolved.body?.ok === true}`);
  console.log(`hidden_intelligence_places=${areaPlaces.length}`);
  console.log(`hidden_geometry_projection_safe=${Boolean(hiddenSafe)}`);
  console.log(`hidden_canonical_coordinate_absent=${!hiddenRaw.includes('30.681991') && !hiddenRaw.includes('76.702441')}`);
  if (!exactResolved.response.ok || !areaResolved.response.ok || !exactWorks || !hiddenSafe
      || hiddenRaw.includes('30.681991') || hiddenRaw.includes('76.702441')) {
    throw new Error('Client Link persisted PI or buyer-safe location projection failed');
  }
}

async function createSecurityActor(state, label, role, dealerId) {
  const email = `pi-v1-${label}-${Date.now()}-${randomUUID().slice(0, 6)}@mapco.dev`;
  const created = await must(`${label} user`, admin.auth.admin.createUser({
    email, password: state.password, email_confirm: true,
    user_metadata: { dealer_id: dealerId, role },
  }));
  state.userIds.push(created.user.id);
  await must(`${label} profile`, admin.from('profiles').upsert({
    id: created.user.id, email, role, dealer_id: dealerId, status: 'active',
  }));
  const client = createClient(SUPABASE_URL, ANON, options);
  await must(`${label} sign-in`, client.auth.signInWithPassword({ email, password: state.password }));
  return client;
}

async function security() {
  const state = loadState();
  const owner = await ownerClient(state);
  const otherDealer = `pi-v1-other-${Date.now()}`;
  const inactiveDealer = `pi-v1-inactive-${Date.now()}`;
  const inactiveProperty = `pi-v1-inactive-property-${Date.now()}`;
  state.securityDealerIds = [otherDealer, inactiveDealer];
  state.securityPropertyIds = [inactiveProperty];
  await must('other dealer', admin.from('dealer_settings').insert({
    dealer_id: otherDealer, brand_name: 'PI Security Other', account_status: 'active',
    subscription_status: 'paid', expiry_date: new Date(Date.now() + 86_400_000).toISOString(),
  }));
  await must('inactive dealer', admin.from('dealer_settings').insert({
    dealer_id: inactiveDealer, brand_name: 'PI Security Inactive', account_status: 'suspended',
    subscription_status: 'active',
  }));
  await must('inactive property', admin.from('crm_records').insert({
    id: inactiveProperty, dealer_id: inactiveDealer, entity_type: 'properties', deleted: false,
    payload: { type: 'Residential Plot', city: 'Mohali', area: 'Sector 78',
      location: { latitude: 30.681991, longitude: 76.702441 } },
  }));
  const other = await createSecurityActor(state, 'other', 'owner', otherDealer);
  const viewer = await createSecurityActor(state, 'viewer', 'viewer', state.dealerId);
  const inactive = await createSecurityActor(state, 'inactive', 'owner', inactiveDealer);
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });

  const unauth = await fetch(`${SUPABASE_URL}/functions/v1/property-intelligence`, {
    method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ propertyId: state.propertyId }),
  });
  const own = await invoke(owner, state.propertyId, false);
  const foreign = await invoke(other, state.propertyId, false);
  const viewerResult = await invoke(viewer, state.propertyId, false);
  const inactiveResult = await invoke(inactive, inactiveProperty, false);
  const chosenDealer = await owner.functions.invoke('property-intelligence', {
    body: { propertyId: state.propertyId, dealer_id: otherDealer, dealerId: otherDealer },
  });
  const tableDenials = {};
  for (const table of [
    'property_intelligence', 'property_intelligence_runs',
    'property_intelligence_cost_events', 'place_registry', 'property_intelligence_routes',
  ]) {
    const direct = await owner.from(table).select('*').limit(1);
    tableDenials[table] = Boolean(direct.error);
  }
  const checks = {
    unauthenticatedDenied: unauth.status === 401,
    sameDealerAllowed: own.body?.status === 'ready' && own.body?.cache === 'hit',
    crossTenantDenied: foreign.body?.status === 'unavailable'
      && ['property_not_found', 'forbidden'].includes(foreign.body?.reason),
    viewerDenied: viewerResult.body?.reason === 'forbidden',
    inactiveDenied: inactiveResult.body?.reason === 'forbidden',
    browserDealerChoiceIgnored: !chosenDealer.error && chosenDealer.data?.status === 'ready'
      && chosenDealer.data?.cache === 'hit',
    allDirectTablesDenied: Object.values(tableDenials).every(Boolean),
  };
  for (const [name, passed] of Object.entries(checks)) console.log(`${name}=${passed}`);
  for (const [table, denied] of Object.entries(tableDenials)) console.log(`direct_${table}_denied=${denied}`);
  if (!Object.values(checks).every(Boolean)) throw new Error('live security gate failed');
}

async function cleanup() {
  const state = loadState();
  for (const id of state.linkIds ?? []) await admin.from('share_links').delete().eq('id', id);
  await admin.from('crm_records').delete().in('id', [
    state.propertyId, state.clientId, ...(state.securityPropertyIds ?? []),
  ]);
  for (const id of state.userIds ?? []) await admin.auth.admin.deleteUser(id);
  await admin.from('dealer_settings').delete().in('dealer_id', [
    state.dealerId, ...(state.securityDealerIds ?? []),
  ]);
  rmSync(statePath, { force: true });
  console.log('controlled dealer/user/property/client/link fixtures removed');
}

async function audit() {
  const state = loadState();
  const evidence = await readEvidence(state);
  report('LIVE GENERATION AUDIT', state, { body: null, elapsedMs: 0 }, evidence);
  if (evidence.pi?.failure_reason) console.log(`failure_reason=${evidence.pi.failure_reason}`);
  if (evidence.pi?.failure_detail) console.log(`failure_detail=${String(evidence.pi.failure_detail).slice(0, 300)}`);
}

if (mode === 'first') await first();
else if (mode === 'retry') await retry();
else if (mode === 'complete') await complete();
else if (mode === 'reload') await reload();
else if (mode === 'regenerate') await regenerate();
else if (mode === 'links') await links();
else if (mode === 'security') await security();
else if (mode === 'cleanup') await cleanup();
else if (mode === 'audit') await audit();
else if (mode === 'path') console.log(statePath);
else throw new Error(`unknown mode: ${mode}`);
