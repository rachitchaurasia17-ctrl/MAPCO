/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — backend verification (dev only, service-role)
   ---------------------------------------------------------------
   Reads secrets from the gitignored supabase/.env. Creates durable demo
   users + profiles, then verifies: login, data loading, dealer-A/
   dealer-B isolation, account states, storage signed URLs.
   Prints only PASS/FAIL — never keys, tokens, or passwords.
   Remote run requires an out-of-band RESETTABLE_DEV:<project-ref>
   acknowledgement. Never point this fixture bootstrap at production.
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── load gitignored env ───────────────────────────────────────
const envPath = process.argv[2] ?? 'supabase/.env';
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n').filter(Boolean).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const URL = env.SUPABASE_URL, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY, PW = env.DEMO_PASSWORD;
if (!URL || !SERVICE || !ANON || !PW) { console.error('missing env'); process.exit(1); }

let target;
try { target = new globalThis.URL(URL); } catch { console.error('invalid Supabase URL'); process.exit(2); }
const localTarget = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
if (!localTarget) {
  const ref = String(process.env.MAPCO_BACKEND_VERIFY_PROJECT_REF || '').trim();
  const confirm = String(process.env.MAPCO_BACKEND_VERIFY_CONFIRM || '');
  if (!/^[a-z0-9]{8,32}$/i.test(ref)
      || target.hostname !== `${ref}.supabase.co`
      || confirm !== `RESETTABLE_DEV:${ref}`) {
    console.error('remote run refused: explicitly acknowledge the exact resettable development project');
    process.exit(2);
  }
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
const ok = (m) => { console.log('  PASS ' + m); pass++; };
const no = (m) => { console.log('  FAIL ' + m); fail++; };

// ── demo actors ───────────────────────────────────────────────
const USERS = [
  { key: 'demoOwner', email: 'demo-owner@mapco.dev', role: 'owner', dealer: 'dealer-demo' },
  { key: 'demoTeam',  email: 'demo-team@mapco.dev',  role: 'team',  dealer: 'dealer-demo' },
  { key: 'bOwner',    email: 'b-owner@mapco.dev',    role: 'owner', dealer: 'dealer-b' },
];
const ids = {};

async function ensureUser(u) {
  // idempotent create
  let { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: PW, email_confirm: true,
    user_metadata: { dealer_id: u.dealer, role: u.role },
  });
  if (error && /registered|exists/i.test(error.message)) {
    // find existing
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    data = { user: list.data.users.find((x) => x.email === u.email) };
  } else if (error) { throw error; }
  const id = data.user.id;
  ids[u.key] = id;
  const { error: pe } = await admin.from('profiles').upsert({
    id, email: u.email, role: u.role, dealer_id: u.dealer, status: 'active',
  });
  if (pe) throw pe;
}

async function seedDealerB() {
  await admin.from('dealer_settings').upsert({
    dealer_id: 'dealer-b', brand_name: 'Rival Realty', subscription_status: 'active', account_status: 'active',
  });
  await admin.from('crm_records').upsert({
    id: 'b-prop-1', dealer_id: 'dealer-b', entity_type: 'properties', deleted: false,
    payload: { type: 'Villa', area: 'Sector 20', loc: 'Sector 20, Panchkula', size: '400 sq yd',
      facing: 'South', position: 'Inside', approvals: ['HUDA'], landmarks: [], price: 12000000,
      photos: [], published: true, sold: false, views: 0 },
  });
}

function anon() { return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } }); }

async function signIn(email) {
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw error;
  return { c, session: data.session };
}

async function main() {
  console.log('\n[setup] demo users + profiles');
  for (const u of USERS) await ensureUser(u);
  await seedDealerB();
  ok('created/linked ' + USERS.length + ' users to profiles');

  console.log('\n[auth] real Supabase-mode login');
  const demo = await signIn('demo-owner@mapco.dev');
  demo.session?.access_token ? ok('demo owner login → session issued') : no('demo owner login');
  const b = await signIn('b-owner@mapco.dev');
  b.session ? ok('dealer-b owner login → session issued') : no('dealer-b owner login');

  console.log('\n[data] dealer-scoped loading');
  const demoProps = await demo.c.from('crm_records').select('id').eq('entity_type', 'properties');
  const demoIds = (demoProps.data ?? []).map((r) => r.id).sort();
  demoIds.length >= 3 && demoIds.includes('ecocity')
    ? ok('demo owner sees seeded properties: ' + demoIds.join(','))
    : no('demo owner property load (' + JSON.stringify(demoProps.error ?? demoIds) + ')');

  console.log('\n[isolation] dealer-A vs dealer-B (RLS)');
  const bProps = await b.c.from('crm_records').select('id').eq('entity_type', 'properties');
  const bIds = (bProps.data ?? []).map((r) => r.id);
  bIds.length === 1 && bIds[0] === 'b-prop-1'
    ? ok('dealer-b sees ONLY its own property')
    : no('dealer-b scoping wrong: ' + JSON.stringify(bIds));
  !bIds.includes('ecocity') ? ok('dealer-b CANNOT see dealer-demo rows') : no('LEAK: dealer-b saw dealer-demo');
  !demoIds.includes('b-prop-1') ? ok('dealer-demo CANNOT see dealer-b rows') : no('LEAK: dealer-demo saw dealer-b');
  // targeted cross-tenant fetch by id
  const cross = await demo.c.from('crm_records').select('id').eq('id', 'b-prop-1').maybeSingle();
  (!cross.data) ? ok('cross-tenant fetch by id returns nothing') : no('LEAK: cross-tenant id fetch returned a row');

  console.log('\n[account] account-state source');
  const ds = await demo.c.from('dealer_settings').select('subscription_status,account_status,trial_end').maybeSingle();
  ds.data?.subscription_status === 'trial' ? ok('demo dealer reads its trial dealer_settings') : no('account-state read: ' + JSON.stringify(ds.error ?? ds.data));

  console.log('\n[storage] private buckets + signed URL');
  const buckets = await admin.storage.listBuckets();
  const pp = (buckets.data ?? []).find((x) => x.id === 'property-photos');
  pp && pp.public === false ? ok('property-photos bucket is PRIVATE') : no('property-photos bucket state: ' + JSON.stringify(pp));
  // upload a tiny object as admin under dealer path, sign it
  const path = 'dealer-demo/verify-' + Date.now() + '.png';
  // 1x1 PNG (the bucket restricts to image mime types by policy — verify a valid image works).
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const up = await admin.storage.from('property-photos').upload(path, png, { upsert: true, contentType: 'image/png' });
  if (up.error) no('upload: ' + up.error.message);
  else {
    const signed = await admin.storage.from('property-photos').createSignedUrl(path, 900);
    signed.data?.signedUrl ? ok('15-min signed URL minted for private object') : no('signed URL: ' + JSON.stringify(signed.error));
    // anon must NOT read the object without a signed URL
    const anonRead = await anon().storage.from('property-photos').download(path);
    anonRead.error ? ok('anon direct download blocked (private)') : no('LEAK: anon downloaded private object');
    await admin.storage.from('property-photos').remove([path]);
  }

  console.log('\n[client-links] create → resolve → safety → revoke → expiry');
  // a link needs an APPROVED https photo per property; seed one.
  await admin.from('crm_records').upsert({
    id: 'clink-prop', dealer_id: 'dealer-demo', entity_type: 'properties', deleted: false,
    payload: { type: 'Residential Plot', title: 'Link Test Plot', area: 'Eco City', loc: 'Eco City, New Chandigarh',
      sector: 'Eco City', size: '400 sq yd', facing: 'East', roadWidth: '30 ft', price: 8000000,
      photos: ['https://cdn.mapco.dev/clink-1.jpg'], published: true, clientVisible: true, sold: false, views: 0 },
  });
  const SEL = { 'clink-prop': ['external:0'] };
  // create a link as demo owner (price hidden, location area)
  const created = await demo.c.rpc('plotmap_create_client_link', {
    p_payload: { clientId: 'c1', propertyIds: ['clink-prop'], photoSelections: SEL, priceVisibility: 'hidden', locationVisibility: 'area', expiresInDays: 7 },
  });
  const token = created.data?.token;
  token && /^[0-9a-f]{64}$/.test(token) ? ok('link created, 64-hex raw token returned once') : no('create link: ' + JSON.stringify(created.error ?? created.data));
  if (token) {
    // resolve via ANON (buyer path)
    const r1 = await anon().rpc('plotmap_resolve_client_link', { p_token: token });
    const link = r1.data?.link;
    r1.data?.ok === true && Array.isArray(link?.properties) && link.properties.length === 1
      ? ok('anon resolve → valid snapshot with 1 property') : no('resolve valid: ' + JSON.stringify(r1.data));
    // safety: price hidden ⇒ no price; no forbidden fields anywhere in payload
    const blob = JSON.stringify(link ?? {});
    (link?.visibility?.price === 'hidden' && !/"price":\s*"?\d/.test(blob))
      ? ok('price hidden ⇒ no price in snapshot') : no('price leak: ' + blob.slice(0, 200));
    !/commission|sellerPhone|"internalStatus"|negotiation|"note"/i.test(blob)
      ? ok('snapshot has no commission/seller/notes/internal fields') : no('FORBIDDEN field in snapshot');
    // token is a hash server-side: raw token must not equal stored hash (verify hint only)
    // revoke
    const idRow = await admin.from('share_links').select('id').eq('dealer_id', 'dealer-demo').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const linkId = idRow.data?.id;
    const rev = await demo.c.rpc('plotmap_revoke_client_link', { p_link_id: linkId });
    rev.data?.ok === true ? ok('owner revoked the link') : no('revoke: ' + JSON.stringify(rev.error ?? rev.data));
    const r2 = await anon().rpc('plotmap_resolve_client_link', { p_token: token });
    r2.data?.ok === false && r2.data?.reason === 'revoked' ? ok('revoked link resolves → revoked') : no('post-revoke: ' + JSON.stringify(r2.data));
  }
  // expiry: new link, force expiry in the past via admin, resolve → expired
  const created2 = await demo.c.rpc('plotmap_create_client_link', {
    p_payload: { clientId: 'c1', propertyIds: ['clink-prop'], photoSelections: SEL, priceVisibility: 'shown', locationVisibility: 'exact', expiresInDays: 7 },
  });
  const token2 = created2.data?.token;
  if (token2) {
    const id2 = await admin.from('share_links').select('id').eq('dealer_id', 'dealer-demo').order('created_at', { ascending: false }).limit(1).maybeSingle();
    await admin.from('share_links').update({ expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq('id', id2.data?.id);
    const r3 = await anon().rpc('plotmap_resolve_client_link', { p_token: token2 });
    r3.data?.ok === false && r3.data?.reason === 'expired' ? ok('expired link resolves → expired') : no('expiry: ' + JSON.stringify(r3.data));
    // clean up: revoke the 2nd link too
    await admin.from('share_links').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id2.data?.id);
  } else { no('create link #2 for expiry: ' + JSON.stringify(created2.error ?? created2.data)); }

  console.log('\n[roles] team member scope vs owner');
  const team = await signIn('demo-team@mapco.dev');
  team.session ? ok('team member login → session issued') : no('team login');
  const teamProps = await team.c.from('crm_records').select('id').eq('entity_type', 'properties');
  (teamProps.data ?? []).some((r) => r.id === 'ecocity')
    ? ok('team member reads own dealer data (staff read)') : no('team read: ' + JSON.stringify(teamProps.error ?? teamProps.data));
  const teamCross = await team.c.from('crm_records').select('id').eq('id', 'b-prop-1').maybeSingle();
  !teamCross.data ? ok('team member is tenant-isolated (no dealer-b)') : no('LEAK: team saw dealer-b');
  // owner-only helper: team must NOT be a platform admin
  const isAdmin = await team.c.rpc('plotmap_is_platform_admin');
  isAdmin.data === false || isAdmin.data == null ? ok('team member is not a platform admin') : no('team elevated to platform admin');

  console.log('\n[predictive] dealer-scoped operational telemetry');
  const predictiveSession = `verify-${Date.now()}`;
  const predictiveTarget = `target-${Date.now()}`;
  const predictiveArgs = {
    p_event_type: 'property-opened', p_session_id: predictiveSession,
    p_from_type: 'route', p_from_id: 'verification',
    p_to_type: 'property', p_to_id: predictiveTarget,
    p_resource_type: 'property-summary', p_resource_id: predictiveTarget,
    p_created_at: new Date().toISOString(),
  };
  const recorded = await demo.c.rpc('plotmap_record_predictive_event', predictiveArgs);
  !recorded.error ? ok('authenticated dealer records a minimal predictive event through RPC') : no('predictive record: ' + recorded.error.message);
  const ownEvent = await demo.c.from('predictive_usage_events').select('dealer_id,event_type,to_id').eq('session_id', predictiveSession);
  (ownEvent.data ?? []).length === 1 && ownEvent.data?.[0]?.dealer_id === 'dealer-demo'
    ? ok('dealer reads its own predictive event') : no('predictive own read: ' + JSON.stringify(ownEvent.error ?? ownEvent.data));
  const otherEvent = await b.c.from('predictive_usage_events').select('dealer_id').eq('session_id', predictiveSession);
  (otherEvent.data ?? []).length === 0 ? ok('dealer-b cannot read dealer-demo predictive events') : no('LEAK: dealer-b read predictive event');
  const ownSummary = await demo.c.rpc('plotmap_predictive_summaries', { p_limit: 200 });
  (ownSummary.data ?? []).some((row) => row.from_id === 'verification' && row.to_id === predictiveTarget)
    ? ok('dealer transition summary is updated with time-decayed score') : no('predictive summary: ' + JSON.stringify(ownSummary.error ?? ownSummary.data));
  const otherSummary = await b.c.rpc('plotmap_predictive_summaries', { p_limit: 200 });
  !(otherSummary.data ?? []).some((row) => row.to_id === predictiveTarget)
    ? ok('dealer-b summaries exclude dealer-demo transitions') : no('LEAK: dealer-b summary included demo transition');
  const directWrite = await demo.c.from('predictive_usage_events').insert({
    dealer_id: 'dealer-b', actor_id: ids.demoOwner, session_id: predictiveSession,
    event_type: 'route-opened', to_type: 'route', to_id: 'forbidden-direct-write',
  });
  directWrite.error ? ok('direct predictive table writes are blocked') : no('SECURITY: direct predictive insert succeeded');
  const anonPredictive = await anon().rpc('plotmap_predictive_summaries', { p_limit: 10 });
  anonPredictive.error ? ok('anonymous callers cannot execute predictive telemetry RPCs') : no('SECURITY: anon predictive RPC succeeded');
  await admin.from('predictive_usage_events').delete().eq('session_id', predictiveSession);
  await admin.from('predictive_transition_summaries').delete()
    .eq('dealer_id', 'dealer-demo').eq('from_type', 'route').eq('from_id', 'verification')
    .eq('to_type', 'property').eq('to_id', predictiveTarget);
  const predictiveCleanup = await admin.from('predictive_usage_events').select('id').eq('session_id', predictiveSession);
  (predictiveCleanup.data ?? []).length === 0 ? ok('temporary predictive verification rows removed') : no('predictive verification cleanup failed');

  console.log('\n[maps] storage upload → dealer CRUD → publish → link → client visibility');
  const pngDims = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
  const ROOT = 'migration-kit/maps with svg';
  const assets = [
    { local: `${ROOT}/new chd normal.png`, path: 'newchandigarh/masterplan.png', ct: 'image/png' },
    { local: `${ROOT}/new chd svg with id attribute.svg`, path: 'newchandigarh/overlay.svg', ct: 'image/svg+xml' },
    { local: `${ROOT}/mohali normal.png`, path: 'mohali/masterplan.png', ct: 'image/png' },
    { local: `${ROOT}/mohali 3d map.png`, path: 'mohali/3d.png', ct: 'image/png' },
    { local: `${ROOT}/mohali svg with id attribute.svg`, path: 'mohali/overlay.svg', ct: 'image/svg+xml' },
  ];
  const url = {};
  let uploaded = 0;
  for (const a of assets) {
    try {
      const buf = readFileSync(a.local);
      const up = await admin.storage.from('maps').upload(a.path, buf, { contentType: a.ct, upsert: true });
      if (up.error) { no('upload ' + a.path + ': ' + up.error.message); continue; }
      url[a.path] = admin.storage.from('maps').getPublicUrl(a.path).data.publicUrl;
      if (a.ct === 'image/png') a.dims = pngDims(buf);
      uploaded++;
    } catch (e) { no('read ' + a.local + ': ' + e.message); }
  }
  uploaded === assets.length ? ok(`uploaded ${uploaded} map assets to public 'maps' bucket`) : no(`uploaded ${uploaded}/${assets.length}`);
  const dim = (p) => assets.find((a) => a.path === p)?.dims ?? { w: 0, h: 0 };

  // create maps via the dealer RPC (Map Studio path)
  const ncMaster = await demo.c.rpc('plotmap_upsert_map', { p_payload: {
    id: 'map-nc-master', kind: 'masterplan', city: 'New Chandigarh', area: 'Master Plan', label: 'New Chandigarh — Master Plan',
    raster: url['newchandigarh/masterplan.png'], dims: { original: dim('newchandigarh/masterplan.png') },
    assets: { original: { path: url['newchandigarh/masterplan.png'], ...dim('newchandigarh/masterplan.png') },
              overlay: { path: url['newchandigarh/overlay.svg'] } },
  } });
  ncMaster.data?.id ? ok('dealer created New Chandigarh masterplan (draft)') : no('upsert nc master: ' + JSON.stringify(ncMaster.error ?? ncMaster.data));
  const mohMaster = await demo.c.rpc('plotmap_upsert_map', { p_payload: {
    id: 'map-mohali-master', kind: 'masterplan', city: 'Mohali', area: 'Master Plan', label: 'Mohali — Master Plan',
    raster: url['mohali/masterplan.png'], dims: { original: dim('mohali/masterplan.png'), threeD: dim('mohali/3d.png') },
    assets: { original: { path: url['mohali/masterplan.png'], ...dim('mohali/masterplan.png') },
              threeD: { path: url['mohali/3d.png'], ...dim('mohali/3d.png') },
              overlay: { path: url['mohali/overlay.svg'] } },
  } });
  mohMaster.data?.id ? ok('dealer created Mohali masterplan with 3D + overlay') : no('upsert mohali: ' + JSON.stringify(mohMaster.error));
  const mohSector = await demo.c.rpc('plotmap_upsert_map', { p_payload: {
    id: 'map-mohali-sec', kind: 'sector', city: 'Mohali', sector: 'Sector 90-91', area: 'Janta Township',
    parentMapId: 'map-mohali-master', label: 'Mohali — Sector 90-91',
    raster: url['mohali/masterplan.png'], dims: { original: dim('mohali/masterplan.png') },
  } });
  mohSector.data?.parent_map_id === 'map-mohali-master' ? ok('sector map linked to its masterplan (parent_map_id)') : no('sector parent: ' + JSON.stringify(mohSector.error ?? mohSector.data));

  // publish two, leave the sector as draft
  await demo.c.rpc('plotmap_set_map_status', { p_map_id: 'map-nc-master', p_status: 'published', p_client_visible: true });
  await demo.c.rpc('plotmap_set_map_status', { p_map_id: 'map-mohali-master', p_status: 'published', p_client_visible: true });

  // link + place properties on the New Chandigarh masterplan
  const link1 = await demo.c.rpc('plotmap_link_property_to_map', { p_property_id: 'ecocity', p_map_id: 'map-nc-master', p_x: 0.42, p_y: 0.31 });
  const placed = link1.data?.payload?.mapPlacement;
  (placed?.mapId === 'map-nc-master' && placed?.x === 0.42 && link1.data?.payload?.masterplanId === 'map-nc-master')
    ? ok('property linked+placed on masterplan (masterplanId + normalized xy)') : no('link property: ' + JSON.stringify(link1.error ?? link1.data?.payload));
  await demo.c.rpc('plotmap_link_property_to_map', { p_property_id: 'omx', p_map_id: 'map-nc-master', p_x: 0.6, p_y: 0.55 });

  // dealer sees ALL its maps (incl draft sector); client sees only published+visible
  const dealerMaps = await demo.c.rpc('plotmap_dealer_maps');
  const dmIds = (dealerMaps.data ?? []).map((m) => m.id);
  dmIds.includes('map-mohali-sec') && dmIds.includes('map-nc-master')
    ? ok('Map Studio lists all dealer maps incl draft (' + dmIds.length + ')') : no('dealer maps: ' + JSON.stringify(dealerMaps.error ?? dmIds));
  const clientMaps = await demo.c.rpc('plotmap_published_maps');
  const cmIds = (clientMaps.data ?? []).map((m) => m.id);
  (cmIds.includes('map-nc-master') && cmIds.includes('map-mohali-master') && !cmIds.includes('map-mohali-sec'))
    ? ok('presentation sees only PUBLISHED maps (draft sector excluded)') : no('published maps: ' + JSON.stringify(clientMaps.error ?? cmIds));
  // archive one → disappears from presentation
  await demo.c.rpc('plotmap_set_map_status', { p_map_id: 'map-mohali-master', p_status: 'archived' });
  const cm2 = await demo.c.rpc('plotmap_published_maps');
  !(cm2.data ?? []).map((m) => m.id).includes('map-mohali-master') ? ok('archived map removed from presentation view') : no('archive leak');
  await demo.c.rpc('plotmap_set_map_status', { p_map_id: 'map-mohali-master', p_status: 'published', p_client_visible: true });
  // cross-dealer: dealer-b cannot edit dealer-demo maps
  const evil = await b.c.rpc('plotmap_set_map_status', { p_map_id: 'map-nc-master', p_status: 'archived' });
  (evil.error || evil.data === null) ? ok('dealer-b CANNOT modify dealer-demo maps') : no('LEAK: dealer-b modified demo map');
  // Clean up this section's throwaway test maps so they never pollute the real catalog.
  await admin.from('prebuilt_maps').delete().in('id', ['map-nc-master', 'map-mohali-master', 'map-mohali-sec']);

  console.log('\n[library] onboarded map library integrity');
  const lib = await admin.from('prebuilt_maps').select('id,kind,status,parent_map_id,dims').eq('dealer_id', 'dealer-demo');
  if (lib.error) { no('library query: ' + lib.error.message); }
  else {
    const rows = lib.data;
    const ids = new Set(rows.map((r) => r.id));
    const masters = rows.filter((r) => r.kind === 'masterplan');
    const sectors = rows.filter((r) => r.kind === 'sector');
    const orphans = sectors.filter((r) => r.parent_map_id && !ids.has(r.parent_map_id));
    const noDims = masters.filter((r) => !r.dims || !(r.dims.original || r.dims.threeD));
    rows.length >= 60 ? ok(`library onboarded: ${rows.length} maps (${masters.length} master, ${sectors.length} sector)`) : no(`only ${rows.length} maps`);
    orphans.length === 0 ? ok('every sector resolves to an existing parent masterplan') : no(`${orphans.length} orphan sectors`);
    noDims.length === 0 ? ok('every masterplan has intrinsic dimensions') : no(`${noDims.length} masterplans missing dims`);
    masters.filter((r) => r.status !== 'archived').every((r) => r.status === 'published')
      ? ok('all non-archived masterplans published (client-visible)') : no('some active masterplans not published');
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  // The named demo users/dealers are intentional reusable development
  // fixtures. The safety latch above prevents accidental production creation.
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
