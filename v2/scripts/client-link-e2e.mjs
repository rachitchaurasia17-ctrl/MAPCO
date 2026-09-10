/* MAPCO-DEV destructive-safe Client Link E2E verification.
 * Creates isolated e2e-* rows, verifies the real DB/Storage/Edge chain, and
 * removes only those rows/objects in finally. It never prints tokens or keys. */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const envPath = process.argv[2] ?? 'supabase/.env';
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
  const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
}));
const URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = env.DEMO_PASSWORD;
if (!URL?.includes('lswzrkvdwirhvggtvuch') || !ANON || !SERVICE || !PASSWORD) {
  console.error('Refusing to run: MAPCO-DEV verification environment is incomplete.');
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

/* Device approval is a founder action — plotmap_founder_create_device_code
   requires plotmap_is_platform_admin(), which is pinned to one verified
   identity. The harness therefore approves its device the same way a real
   one is approved rather than working around the gate. */
const FOUNDER_EMAIL = env.MAPCO_FOUNDER_EMAIL ?? process.env.MAPCO_FOUNDER_EMAIL;
const FOUNDER_PASSWORD = env.MAPCO_FOUNDER_PASSWORD ?? process.env.MAPCO_FOUNDER_PASSWORD;
if (!FOUNDER_EMAIL || !FOUNDER_PASSWORD) {
  console.error('Refusing to run: MAPCO_FOUNDER_EMAIL and MAPCO_FOUNDER_PASSWORD are required.');
  console.error('Every authenticated request passes the device gate; without an approved');
  console.error('device this harness can only produce PT403 failures.');
  process.exit(2);
}
const founder = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
let approvedDeviceId = null;

/** Approve one device for `dealerId` and bind every given session to it. */
async function approveDeviceForSessions(dealerId, sessions) {
  const signedIn = await founder.auth.signInWithPassword({
    email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD,
  });
  if (signedIn.error) throw new Error(`founder sign-in: ${signedIn.error.message}`);
  const { data: code, error: codeErr } = await founder.rpc(
    'plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  if (codeErr) throw new Error(`device code: ${codeErr.message}`);

  const deviceToken = randomBytes(32).toString('hex');
  const { data: act, error: actErr } = await sessions[0].rpc('plotmap_activate_device', {
    p_access_code: String(code.code), p_device_token: deviceToken,
    p_device_label: `client-link-e2e-${runId}`, p_browser_info: 'client-link-e2e',
  });
  if (actErr) throw new Error(`activate: ${actErr.message}`);
  const status = Array.isArray(act) ? act[0]?.status : act?.status;
  if (status !== 'approved') throw new Error(`activate: ${status}`);

  // Every session of this dealer binds itself to that one approved device.
  for (const session of sessions) {
    const { data: access, error } = await session.rpc(
      'plotmap_dealer_access_status', { p_device_token: deviceToken });
    if (error) throw new Error(`gate: ${error.message}`);
    if (access?.status !== 'approved') throw new Error(`gate: ${JSON.stringify(access)}`);
  }

  const { data: devices } = await founder.rpc('plotmap_admin_list_dealer_devices');
  approvedDeviceId = (devices ?? []).find(
    (d) => d.dealer_id === dealerId && d.device_label === `client-link-e2e-${runId}`)?.id ?? null;
}
const browser = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
let passed = 0;
let failed = 0;
const pass = (message) => { passed++; console.log(`  PASS ${message}`); };
const fail = (message) => { failed++; console.log(`  FAIL ${message}`); };
const check = (condition, message) => condition ? pass(message) : fail(message);

const runId = Date.now().toString(36);
const MASTER = `e2e-master-${runId}`;
const SECTOR = `e2e-sector-${runId}`;
const DRAFT = `e2e-draft-${runId}`;
const PROP_A = `e2e-prop-a-${runId}`;
const PROP_B = `e2e-prop-b-${runId}`;
const SALE_PROP = `e2e-sale-prop-${runId}`;
const CLIENT = `e2e-client-${runId}`;
const MAP_PATH = `e2e/${runId}.png`;
let audioPath = '';
let saleDealId = '';
const linkIds = [];

function wavOneSecond() {
  const rate = 16_000;
  const buffer = new ArrayBuffer(44 + rate * 2);
  const view = new DataView(buffer);
  const str = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + rate * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, rate * 2, true);
  for (let i = 0; i < rate; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / rate) * 5000, true);
  return new Uint8Array(buffer);
}

async function edgeResolve(token) {
  const response = await fetch(`${URL}/functions/v1/resolve-client-link`, {
    method: 'POST',
    headers: {
      Origin: 'https://mapco-navy.vercel.app',
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
      'x-client-info': 'mapco-e2e',
      'x-mapco-client': 'v2-web',
    },
    body: JSON.stringify({ token }),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

async function edgePreflight() {
  return fetch(`${URL}/functions/v1/resolve-client-link`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://mapco-navy.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info,x-mapco-client',
    },
  });
}

async function cleanup() {
  if (linkIds.length) await admin.from('share_links').delete().in('id', linkIds);
  if (saleDealId) await admin.from('crm_records').delete().eq('id', saleDealId);
  if (audioPath) await admin.storage.from('client-link-audio').remove([audioPath]);
  await admin.from('crm_records').delete().in('id', [PROP_A, PROP_B, SALE_PROP, CLIENT]);
  await admin.from('prebuilt_maps').delete().in('id', [SECTOR, MASTER, DRAFT]);
  await admin.storage.from('maps').remove([MAP_PATH]);
  /* Hand the device slot back. The limit is four per dealer, so a harness
     that kept its device would lock the demo dealer out after four runs. */
  if (approvedDeviceId) {
    try {
      await founder.rpc('plotmap_admin_set_device_status', {
        p_device_id: approvedDeviceId, p_status: 'revoked',
        p_developer_notes: 'client-link-e2e cleanup',
      });
    } catch { /* best effort */ }
    approvedDeviceId = null;
  }
}

async function main() {
  await cleanup();
  const signIn = await browser.auth.signInWithPassword({ email: 'demo-owner@mapco.dev', password: PASSWORD });
  if (signIn.error) throw signIn.error;
  pass('authenticated dealer session issued');

  const preflight = await edgePreflight();
  const allowedHeaders = (preflight.headers.get('access-control-allow-headers') ?? '').toLowerCase();
  check(
    preflight.status === 204
      && preflight.headers.get('access-control-allow-origin') === 'https://mapco-navy.vercel.app'
      && allowedHeaders.includes('x-mapco-client'),
    'browser preflight permits the shared Supabase client header',
  );

  const dealer = 'dealer-demo';
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const mapUpload = await admin.storage.from('maps').upload(MAP_PATH, png, { upsert: true, contentType: 'image/png' });
  if (mapUpload.error) throw mapUpload.error;
  const mapUrl = admin.storage.from('maps').getPublicUrl(MAP_PATH).data.publicUrl;
  await admin.from('prebuilt_maps').upsert([
    { id: MASTER, dealer_id: dealer, kind: 'masterplan', city: 'Mohali', area: 'E2E', label: 'E2E master', raster: mapUrl, assets: { original: { path: mapUrl, w: 1, h: 1 } }, dims: { original: { w: 1, h: 1 } }, status: 'published', client_visible: true, deleted: false },
    { id: SECTOR, dealer_id: dealer, kind: 'sector', city: 'Mohali', sector: 'E2E 90', area: 'E2E', label: 'E2E sector', parent_map_id: MASTER, raster: mapUrl, assets: { original: { path: mapUrl, w: 1, h: 1 } }, dims: { original: { w: 1, h: 1 } }, status: 'published', client_visible: true, deleted: false },
    { id: DRAFT, dealer_id: dealer, kind: 'sector', city: 'Mohali', sector: 'Secret', area: 'Secret', label: 'Draft must not leak', parent_map_id: MASTER, raster: mapUrl, assets: { original: { path: mapUrl, w: 1, h: 1 } }, dims: { original: { w: 1, h: 1 } }, status: 'draft', client_visible: false, deleted: false },
  ]);
  const photo = 'https://mapco-navy.vercel.app/assets/ph-plot-1.png';
  await admin.from('crm_records').upsert([
    { id: CLIENT, dealer_id: dealer, entity_type: 'clients', deleted: false, payload: { id: CLIENT, name: 'E2E Buyer', phone: '+919000000001', city: 'Mohali', want: 'Plot', budget: '₹1 Cr', budgetMax: 10_000_000, status: 'active', seen: 'today', note: '', viewed: [], interest: [], purchased: [] } },
    { id: PROP_A, dealer_id: dealer, entity_type: 'properties', deleted: false, payload: { title: 'E2E First', type: 'Residential Plot', city: 'Mohali', area: 'E2E 90', loc: 'E2E 90, Mohali', sector: 'E2E 90', size: '300 sq yd', facing: 'East', roadWidth: '30 ft', price: 1, photos: [photo], published: true, clientVisible: true, sold: false, masterplanId: MASTER, sectorMapId: SECTOR, mapPlacement: { mapId: SECTOR, x: 0.25, y: 0.75 }, owner: { name: 'MUST NOT LEAK', phone: '000' }, commission: 999 } },
    { id: PROP_B, dealer_id: dealer, entity_type: 'properties', deleted: false, payload: { title: 'E2E Second', type: 'Residential Plot', city: 'Mohali', area: 'E2E 91', loc: 'E2E 91, Mohali', sector: 'E2E 91', size: '250 sq yd', facing: 'North', roadWidth: '40 ft', price: 2, photos: [photo], published: true, clientVisible: true, sold: false, masterplanId: MASTER, mapPlacement: { mapId: MASTER, x: 0.6, y: 0.4 } } },
    { id: SALE_PROP, dealer_id: dealer, entity_type: 'properties', deleted: false, payload: { title: 'E2E Sale Plot', type: 'Residential Plot', city: 'Mohali', area: 'E2E Sale', loc: 'E2E Sale, Mohali', sector: 'E2E Sale', size: '200 sq yd', facing: 'South', roadWidth: '30 ft', price: 6_000_000, photos: [photo], published: true, clientVisible: true, sold: false } },
  ]);

  const teamBrowser = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const teamSignIn = await teamBrowser.auth.signInWithPassword({ email: 'demo-team@mapco.dev', password: PASSWORD });
  if (teamSignIn.error) throw teamSignIn.error;

  /* Both of this dealer's sessions bind to one founder-approved device
     before any authenticated read or write. Signing in is no longer enough:
     an unbound session is refused by the request gate with PT403. */
  await approveDeviceForSessions(dealer, [browser, teamBrowser]);
  pass('dealer sessions bound to a founder-approved device');
  const teamRows = await teamBrowser.from('crm_records').select('id').in('id', [CLIENT, PROP_A]);
  check((teamRows.data ?? []).length === 2, 'new property and client interlink across dealer and team workspaces');

  audioPath = `dealers/${dealer}/client-links/e2e-${runId}.wav`;
  const audioUpload = await browser.storage.from('client-link-audio').upload(audioPath, wavOneSecond(), { contentType: 'audio/wav', upsert: false });
  if (audioUpload.error) throw audioUpload.error;
  pass('authenticated dealer uploaded a WAV to the private audio bucket');

  const created = await browser.rpc('plotmap_create_client_link', { p_payload: {
    clientId: CLIENT, propertyIds: [PROP_A, PROP_B],
    priceVisibility: 'shown', locationVisibility: 'exact', customPrices: { [PROP_A]: 4_500_000, [PROP_B]: 5_200_000 },
    expiresInDays: 7, photoSelections: { [PROP_A]: ['external:0'], [PROP_B]: ['external:0'] },
    audio: { objectPath: audioPath, seconds: 1 },
  } });
  if (created.error || !created.data?.token) throw created.error ?? new Error('exact link was not created');
  linkIds.push(created.data.id);
  const token = created.data.token;

  const row = await admin.from('share_links').select('id,property_ids,metadata').eq('id', created.data.id).single();
  check(!row.error && row.data.property_ids.length === 2, 'real database row contains both selected properties');
  check(row.data?.metadata?.audio_object_path === audioPath, 'database row references the private audio object path');
  const stored = await admin.storage.from('client-link-audio').list(`dealers/${dealer}/client-links`, { search: `e2e-${runId}.wav` });
  check((stored.data ?? []).some((object) => object.name === `e2e-${runId}.wav`), 'real private audio object exists');

  const resolved = await edgeResolve(token);
  check(resolved.response.ok && resolved.body.ok === true, 'anonymous Edge resolver accepts a valid token');
  check(resolved.response.headers.get('access-control-allow-origin') === 'https://mapco-navy.vercel.app', 'resolver CORS allow-list matches production');
  const publicBlob = JSON.stringify(resolved.body);
  const forbiddenKeys = ['owner', 'commission', 'sellerPhone', 'notes', 'internalStatus', 'documents'];
  const publicProperties = resolved.body.link?.properties ?? [];
  check(
    !Object.hasOwn(resolved.body.link ?? {}, 'audioObjectPath')
      && !Object.hasOwn(resolved.body.link ?? {}, 'client_media')
      && !/MUST NOT LEAK|"commission"|"sellerPhone"|"documents"/i.test(publicBlob)
      && publicProperties.every((property) => forbiddenKeys.every((key) => !(key in property))),
    'public payload excludes private paths and dealer-only fields',
  );
  check(resolved.body.link?.properties?.length === 2, 'multi-property public payload contains two properties');
  check(Number(resolved.body.link?.properties?.[0]?.price) === 4_500_000 && Number(resolved.body.link?.properties?.[1]?.price) === 5_200_000, 'per-property Client Link prices persist');
  const mapIds = (resolved.body.link?.maps ?? []).map((map) => map.id).sort();
  check(JSON.stringify(mapIds) === JSON.stringify([MASTER, SECTOR].sort()), 'token-scoped resolver returns only the linked sector and parent masterplan');
  check(!(resolved.body.link?.maps ?? []).some((map) => map.id === DRAFT), 'draft and unrelated maps are excluded');
  check(!(resolved.body.link?.maps ?? []).some((map) => map.assets?.threeD), 'property without a real 3D asset exposes no 3D option');
  check(resolved.body.link?.properties?.[0]?.placement?.mapId === SECTOR, 'normalized saved property pin is returned for Precise Location ON');

  const signedAudio = resolved.body.link?.audio?.url;
  check(/^https:\/\//.test(signedAudio ?? ''), 'resolver returns a short-lived signed audio URL');
  if (signedAudio) {
    const audioResponse = await fetch(signedAudio);
    const audioBytes = new Uint8Array(await audioResponse.arrayBuffer());
    check(audioResponse.ok && /audio\/(wav|x-wav)/i.test(audioResponse.headers.get('content-type') ?? ''), 'signed audio responds anonymously with a WAV MIME type');
    check(new TextDecoder().decode(audioBytes.slice(0, 4)) === 'RIFF', 'signed audio body is a playable WAV resource');
  }

  await browser.rpc('plotmap_record_client_link_event', {
    p_token: token, p_event_type: 'opened', p_session_id: crypto.randomUUID(),
    p_idempotency_key: crypto.randomUUID(), p_metadata: { propertyId: resolved.body.link?.properties?.[0]?.id },
  });
  const listed = await browser.rpc('plotmap_list_client_links', { p_property_id: PROP_A });
  const listedLink = (listed.data ?? []).find((item) => item.id === created.data.id);
  check(listedLink?.events?.opens >= 1, 'open count updates and the link appears in property analytics');
  check(listedLink?.clientId === CLIENT && listedLink?.propertyIds?.includes(PROP_B), 'authenticated listing interlinks the client and all properties');

  const areaCreated = await browser.rpc('plotmap_create_client_link', { p_payload: {
    clientId: CLIENT, propertyIds: [PROP_A], priceVisibility: 'hidden', locationVisibility: 'area',
    expiresInDays: 7, photoSelections: { [PROP_A]: ['external:0'] },
  } });
  if (areaCreated.error || !areaCreated.data?.token) throw areaCreated.error ?? new Error('area link was not created');
  linkIds.push(areaCreated.data.id);
  const areaResolved = await edgeResolve(areaCreated.data.token);
  check((areaResolved.body.link?.maps ?? []).length === 0, 'Precise Location OFF returns no maps');
  check(!areaResolved.body.link?.properties?.[0]?.placement, 'Precise Location OFF returns no pin coordinates');

  const sold = await browser.rpc('plotmap_record_completed_sale', { p_payload: {
    propertyId: SALE_PROP, buyerId: CLIENT, seller: 'Private Seller', sellerPhone: '+919999999999',
    soldPrice: 5_800_000, saleDate: '2026-08-05', brokerage: 100_000, commission: 50_000,
    commissionReceived: true, paymentReceived: 5_800_000, documents: [{ name: 'Private deed' }],
  } });
  check(sold.data?.ok === true && sold.data?.deal?.id, 'completed sale is recorded atomically');
  saleDealId = sold.data?.deal?.id || '';
  const [soldProperty, buyerAfterSale] = await Promise.all([
    admin.from('crm_records').select('payload').eq('id', SALE_PROP).single(),
    admin.from('crm_records').select('payload').eq('id', CLIENT).single(),
  ]);
  check(soldProperty.data?.payload?.sold === true && soldProperty.data?.payload?.published === false && soldProperty.data?.payload?.clientVisible === false, 'sold property leaves inventory and Client Presentation');
  check((buyerAfterSale.data?.payload?.purchased ?? []).includes(SALE_PROP), 'buyer Purchased Properties updates');
  const soldLinkAttempt = await browser.rpc('plotmap_create_client_link', { p_payload: {
    clientId: CLIENT, propertyIds: [SALE_PROP], priceVisibility: 'hidden', locationVisibility: 'area',
    expiresInDays: 7, photoSelections: { [SALE_PROP]: ['external:0'] },
  } });
  check(Boolean(soldLinkAttempt.error), 'sold property cannot be added to a new Client Link');

  await browser.rpc('plotmap_revoke_client_link', { p_link_id: created.data.id });
  const revoked = await edgeResolve(token);
  check(revoked.body.reason === 'revoked', 'revoked token is rejected');
  await admin.from('share_links').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', areaCreated.data.id);
  const expired = await edgeResolve(areaCreated.data.token);
  check(expired.body.reason === 'expired', 'expired token is rejected');
}

main().catch((error) => {
  fail(`unexpected E2E error: ${error.message}`);
}).finally(async () => {
  await cleanup();
  console.log(`\n=== CLIENT LINK E2E: ${passed} passed, ${failed} failed ===`);
  process.exitCode = failed ? 1 : 0;
});
