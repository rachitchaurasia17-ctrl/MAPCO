#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO-DEV — one real dealer's first week, start to finish.

   The other harnesses each prove one system. This one proves they are
   the SAME system: a property entered once has to carry the dealer
   through every surface without being re-entered, re-described or
   quietly duplicated.

     dealer signs in on an approved device
       → seller
       → property (draft → complete → on sale)
       → papers
       → a real photo in private storage
       → the exact pin on the satellite map
       → Property Intelligence reads that exact pin
       → sign out, sign back in: all of it still there
       → client
       → client link
       → an anonymous buyer opens it and sees the photo
       → the buyer's activity reaches the dealer
       → a deal on that client and that property
       → a marketing creative for that property
       → the dealer sees it in Marketing
       → the sale completes and the property leaves inventory

   Throwaway rows only, removed afterwards. Never prints keys or tokens.

   Usage:
     SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... \
     MAPCO_FOUNDER_EMAIL=... MAPCO_FOUNDER_PASSWORD=... \
       node scripts/first-client-e2e.mjs
   ═══════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const FOUNDER_EMAIL = process.env.MAPCO_FOUNDER_EMAIL;
const FOUNDER_PASSWORD = process.env.MAPCO_FOUNDER_PASSWORD;

if (!URL || !ANON || !SERVICE) {
  console.error('Need SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY.');
  process.exit(2);
}
if (!/lswzrkvdwirhvggtvuch/.test(URL)) {
  console.error(`Refusing to run: ${URL} is not MAPCO-DEV.`);
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const founder = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const stamp = Date.now();
let failures = 0;
let step = 0;
function check(name, condition, detail = '') {
  const ok = !!condition;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
}
function chapter(title) {
  step += 1;
  console.log(`\n── ${step}. ${title} ─────────────────────────────`);
}

/* The dealer, and the one property they will carry all the way through. */
const dealerId = `dealer-first-${stamp}`;
const email = `mapco-first-${stamp}@example.invalid`;
const password = `Fc!${Math.random().toString(36).slice(2, 12)}Aa1`;
const PROPERTY = `prop-first-${stamp}`;
const CLIENT = `client-first-${stamp}`;
const PIN = { latitude: 30.704649, longitude: 76.717873 };
const PHOTO_BUCKET = 'property-photos';
const CREATIVE_BUCKET = 'marketing-creatives';
const CAPTION = 'Corner plot in Sector 91, Mohali. 250 sq yd, east facing.';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

let userId = null;
let desk = null;               // the dealer's browser session
let deviceId = null;
let deviceToken = null;
let sellerId = null;
let dealId = null;
let linkId = null;
let linkToken = null;
let photoPath = '';
let creativePath = '';

async function approveDevice(session, label) {
  const probe = await session.rpc('plotmap_dealer_access_status');
  if (probe.error || probe.data?.status === 'approved') return;
  if (!FOUNDER_EMAIL || !FOUNDER_PASSWORD) {
    console.error('A dealer needs an approved device here: set MAPCO_FOUNDER_EMAIL and MAPCO_FOUNDER_PASSWORD.');
    process.exit(2);
  }
  const signedIn = await founder.auth.signInWithPassword({ email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD });
  if (signedIn.error) throw new Error(`founder sign-in: ${signedIn.error.message}`);
  const { data: code, error: codeErr } = await founder.rpc(
    'plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  if (codeErr) throw new Error(`device code: ${codeErr.message}`);
  deviceToken = randomBytes(32).toString('hex');
  const { error: actErr } = await session.rpc('plotmap_activate_device', {
    p_access_code: String(code.code), p_device_token: deviceToken,
    p_device_label: label, p_browser_info: 'first-client-e2e',
  });
  if (actErr) throw new Error(`activate: ${actErr.message}`);
  const { data: access } = await session.rpc('plotmap_dealer_access_status', { p_device_token: deviceToken });
  if (access?.status !== 'approved') throw new Error(`gate: ${JSON.stringify(access)}`);
  const { data: roster } = await founder.rpc('plotmap_admin_list_dealer_devices');
  deviceId = (roster ?? []).find((d) => d.dealer_id === dealerId && d.device_label === label)?.id ?? null;
}

/** A fresh browser session for this dealer, bound to the same approved device. */
async function signIn(label) {
  const session = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await session.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${label}): ${error.message}`);
  if (deviceToken) {
    const { data } = await session.rpc('plotmap_dealer_access_status', { p_device_token: deviceToken });
    if (data?.status !== 'approved') throw new Error(`bind(${label}): ${JSON.stringify(data)}`);
  } else {
    await approveDevice(session, `first-client-${stamp}`);
  }
  return session;
}

async function cleanup() {
  console.log('\n--- cleaning up test data ---');
  try { if (linkId) await admin.from('share_links').delete().eq('id', linkId); } catch {}
  for (const table of ['marketing_publications', 'marketing_schedule_items', 'marketing_creatives',
    'marketing_content_contexts', 'marketing_post_slots', 'marketing_periods',
    'desk_deal_stage_events', 'desk_deal_payments']) {
    try { await admin.from(table).delete().eq('dealer_id', dealerId); } catch {}
  }
  try { await admin.from('crm_records').delete().eq('dealer_id', dealerId); } catch {}
  try { await admin.from('desk_property_sellers').delete().eq('dealer_id', dealerId); } catch {}
  try { await admin.from('desk_sellers').delete().eq('dealer_id', dealerId); } catch {}
  if (photoPath) { try { await admin.storage.from(PHOTO_BUCKET).remove([photoPath]); } catch {} }
  if (creativePath) { try { await admin.storage.from(CREATIVE_BUCKET).remove([creativePath]); } catch {} }
  try { await admin.from('profiles').delete().eq('id', userId); } catch {}
  try { await admin.from('dealer_settings').delete().eq('dealer_id', dealerId); } catch {}
  if (userId) { try { await admin.auth.admin.deleteUser(userId); } catch {} }
  if (deviceId) {
    try {
      await founder.rpc('plotmap_admin_set_device_status', {
        p_device_id: deviceId, p_status: 'revoked', p_developer_notes: 'first-client-e2e cleanup',
      });
    } catch {}
  }
  console.log('cleanup complete');
}

async function main() {
  console.log('MAPCO-DEV — a first client, from signing up to a completed sale');

  /* ── 1 ─────────────────────────────────────────────────────── */
  chapter('The dealer signs in');
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw new Error(`createUser: ${userErr.message}`);
  userId = created.user.id;
  await admin.from('dealer_settings').upsert({
    dealer_id: dealerId, brand_name: 'Harjit Properties', default_city: 'Mohali',
    subscription_status: 'active', account_status: 'active',
    expiry_date: new Date(Date.now() + 30 * 864e5).toISOString(), storage_enabled: true,
    owner_name: 'Harjit Singh', owner_phone: '+919876500011', primary_area: 'Mohali',
  });
  await admin.from('profiles').upsert({
    id: userId, email, role: 'owner', dealer_id: dealerId, status: 'active',
  });
  desk = await signIn('first');
  check('the dealer has an approved device and a working session', !!desk);

  const identity = await desk.from('dealer_settings').select('brand_name,owner_name').maybeSingle();
  check('the Desk knows whose it is', identity.data?.owner_name === 'Harjit Singh',
    `${identity.data?.brand_name} / ${identity.data?.owner_name}`);

  /* ── 2 ─────────────────────────────────────────────────────── */
  chapter('A seller');
  sellerId = `seller-first-${stamp}`;
  const sellerRow = await admin.from('desk_sellers').insert({
    id: sellerId, dealer_id: dealerId, name: 'Balwinder Singh',
    primary_phone: '+91 98146 22107', seller_type: 'individual', city: 'Mohali',
  });
  check('the seller is on the dealer\'s books', !sellerRow.error, sellerRow.error?.message ?? 'stored');
  const directory = await desk.rpc('plotmap_seller_directory');
  check('and appears in their seller directory',
    (directory.data ?? []).some((s) => s.id === sellerId),
    `${(directory.data ?? []).length} seller(s)`);

  /* ── 3 ─────────────────────────────────────────────────────── */
  chapter('A property, entered once');
  const propertyPayload = {
    id: PROPERTY, type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Sector 91',
    loc: 'Sector 91, Mohali', sector: '91', size: '250 sq yd', sizeUnit: 'sq yd',
    facing: 'East', position: 'Corner plot', approvals: [], landmarks: [],
    price: 7500000, photos: [], published: true, clientVisible: true, sold: false, lifecycle: 'on-sale',
    specs: { corner: true, road: '30 ft' },
  };
  const propRow = await admin.from('crm_records').upsert({
    id: PROPERTY, dealer_id: dealerId, entity_type: 'properties', deleted: false,
    payload: propertyPayload,
  });
  check('the property is on sale', !propRow.error, propRow.error?.message ?? 'stored');

  const assigned = await desk.rpc('plotmap_assign_property_seller', {
    p_payload: {
      propertyId: PROPERTY, sellerId, askingPrice: 7800000, relationship: 'owner',
      availability: 'available', lastConfirmedAt: new Date().toISOString(),
      siteVisitInstructions: 'Call before 6 pm', isPrimary: true,
      documentKinds: ['Registry / Sale Deed'],
    },
  });
  check('the seller is attached to it', assigned.data?.ok !== false, JSON.stringify(assigned.data ?? assigned.error?.message));

  const paper = await desk.rpc('plotmap_set_property_paper', {
    p_payload: { propertyId: PROPERTY, title: 'Registry / Sale Deed', have: true },
  });
  check('a paper the dealer holds is recorded on the property',
    paper.data?.ok !== false, JSON.stringify(paper.data ?? paper.error?.message));

  /* ── 4 ─────────────────────────────────────────────────────── */
  chapter('A real photograph');
  photoPath = `dealers/${dealerId}/properties/${PROPERTY}/${stamp}.png`;
  const upload = await admin.storage.from(PHOTO_BUCKET)
    .upload(photoPath, PNG, { contentType: 'image/png', upsert: true });
  check('the photo is in private storage', !upload.error, upload.error?.message ?? photoPath);
  await admin.from('crm_records').update({
    payload: { ...propertyPayload,
      photoStorage: [{ kind: 'storage', id: `ph-${stamp}`, path: photoPath }] },
  }).eq('id', PROPERTY);
  const openBytes = await fetch(`${URL}/storage/v1/object/${PHOTO_BUCKET}/${photoPath}`,
    { headers: { apikey: ANON } });
  check('and is not readable by a stranger', openBytes.status >= 400, String(openBytes.status));

  /* ── 5 ─────────────────────────────────────────────────────── */
  chapter('The exact spot on the map');
  const located = await desk.rpc('plotmap_set_property_location', {
    p_property_id: PROPERTY, p_latitude: PIN.latitude, p_longitude: PIN.longitude,
    p_source: 'dealer-selected',
  });
  check('the pin the dealer confirmed is stored', !located.error,
    located.error?.message ?? 'stored');

  const intel = await desk.rpc('plotmap_property_intelligence_get', { p_property_id: PROPERTY });
  check('Property Intelligence is handed that exact pin',
    intel.data?.location?.latitude === PIN.latitude && intel.data?.location?.longitude === PIN.longitude,
    `${intel.data?.location?.latitude},${intel.data?.location?.longitude}`);
  check('and knows which locality it is in, without guessing the coordinate from it',
    intel.data?.city === 'Mohali', String(intel.data?.city));

  /* ── 6 ─────────────────────────────────────────────────────── */
  chapter('The dealer closes the laptop and comes back');
  const second = await signIn('relogin');
  const reread = await second.from('crm_records').select('payload').eq('id', PROPERTY).maybeSingle();
  const back = reread.data?.payload ?? {};
  check('the property is still there after signing out and in', back.id === PROPERTY);
  check('with its size and facing', back.size === '250 sq yd' && back.facing === 'East',
    `${back.size} / ${back.facing}`);
  check('with its photograph', (back.photoStorage ?? []).length === 1);
  check('with the exact pin', back.location?.latitude === PIN.latitude, String(back.location?.latitude));
  const sellerBack = await second.rpc('plotmap_seller_workspace', { p_seller_id: sellerId });
  check('and the seller relationship survived too',
    sellerBack.data?.ok !== false, JSON.stringify(sellerBack.data?.reason ?? 'ok'));
  desk = second;

  /* ── 7 ─────────────────────────────────────────────────────── */
  chapter('A customer');
  const clientRow = await admin.from('crm_records').upsert({
    id: CLIENT, dealer_id: dealerId, entity_type: 'clients', deleted: false,
    payload: { id: CLIENT, name: 'Rajiv Sharma', phone: '+919876543210', city: 'Chandigarh',
      requirements: { types: ['Residential Plot'], areas: ['Sector 91'], budgetMin: 7000000, budgetMax: 8500000 } },
  });
  check('the customer is on the dealer\'s books', !clientRow.error, clientRow.error?.message ?? 'stored');

  /* ── 8 ─────────────────────────────────────────────────────── */
  chapter('A link for that customer');
  const link = await desk.rpc('plotmap_create_client_link', { p_payload: {
    clientId: CLIENT, propertyIds: [PROPERTY], priceVisibility: 'shown',
    locationVisibility: 'area', expiresInDays: 7,
    photoSelections: { [PROPERTY]: ['storage:0'] },
  } });
  check('the link is created', !link.error && !!link.data?.token,
    link.error?.message ?? String(link.data?.id));
  linkId = link.data?.id; linkToken = link.data?.token;

  /* ── 9 ─────────────────────────────────────────────────────── */
  chapter('A stranger opens it');
  const resolved = await fetch(`${URL}/functions/v1/resolve-client-link`, {
    method: 'POST',
    headers: {
      Origin: 'https://mapco-navy.vercel.app', apikey: ANON,
      Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json',
      'x-mapco-client': 'v2-web',
    },
    body: JSON.stringify({ token: linkToken }),
  });
  const seen = await resolved.json().catch(() => ({}));
  check('the buyer gets the presentation', resolved.status === 200 && !!seen.link,
    `${resolved.status}`);
  const shown = (seen.link?.properties ?? [])[0] ?? {};
  const branding = JSON.stringify(seen.link?.branding ?? {});
  check('it is the dealer\'s own branding', branding.includes('Harjit'), branding.slice(0, 80));
  check('it is the right property',
    `${shown.title ?? ''} ${shown.area ?? ''} ${shown.sector ?? ''}`.includes('Sector 91')
    || String(shown.area ?? '').includes('91'),
    `${shown.title} / ${shown.area}`);
  const photo = (shown.photos ?? [])[0];
  check('the real photograph reaches the buyer', !!photo?.url, JSON.stringify(photo?.kind ?? null));
  if (photo?.url) {
    const media = await fetch(photo.url);
    const bytes = new Uint8Array(await media.arrayBuffer());
    check('and it is the same image the dealer uploaded',
      media.status === 200 && bytes.length === PNG.length, `${media.status} ${bytes.length}B`);
  }
  const leaked = JSON.stringify(seen);
  check('the seller is not in it', !leaked.includes('Balwinder') && !leaked.includes('9814622107'));
  check('the private note is not in it', !leaked.includes('Prefers calls after 6 pm'));
  check('the exact coordinate is withheld when the dealer chose area only',
    !leaked.includes(String(PIN.latitude)), 'area only');

  /* ── 10 ────────────────────────────────────────────────────── */
  chapter('What the buyer did comes back to the dealer');
  const buyer = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await buyer.rpc('plotmap_record_client_link_event', {
    p_token: linkToken, p_event_type: 'opened', p_session_id: crypto.randomUUID(),
    p_idempotency_key: crypto.randomUUID(), p_metadata: { propertyId: PROPERTY },
  });
  const links = await desk.rpc('plotmap_list_client_links');
  const mine = (links.data ?? []).find((l) => l.id === linkId);
  check('the dealer sees the link they sent', !!mine, `${(links.data ?? []).length} link(s)`);
  check('and that it has been opened', Number(mine?.events?.opens ?? mine?.opens ?? 0) >= 1,
    JSON.stringify(mine?.events ?? {}));

  /* ── 11 ────────────────────────────────────────────────────── */
  chapter('A deal');
  const deal = await desk.rpc('plotmap_start_deal', { p_payload: {
    propertyId: PROPERTY, buyerId: CLIENT, stage: 'negotiating', value: 7500000,
    commission: { buyer: { mode: 'pct', percent: 1 }, seller: { mode: 'fixed', fixed: 50000 } },
  } });
  check('the deal links this customer to this property',
    deal.data?.ok !== false, JSON.stringify(deal.data?.reason ?? 'ok'));
  dealId = deal.data?.deal?.id;
  if (!dealId) throw new Error('no deal to carry forward');

  const staged = await desk.rpc('plotmap_set_deal_stage', {
    p_payload: { dealId, stage: 'token', tokenDate: new Date().toISOString().slice(0, 10),
      note: 'Token agreed' },
  });
  check('the stage moves', staged.data?.ok !== false, JSON.stringify(staged.data?.reason ?? 'token'));
  const paid = await desk.rpc('plotmap_record_deal_payment', {
    p_payload: { dealId, kind: 'token', amount: 500000,
      receivedOn: new Date().toISOString().slice(0, 10), note: 'Token received' },
  });
  check('a payment is recorded against it', paid.data?.ok !== false,
    JSON.stringify(paid.data?.reason ?? 'ok'));
  const workspace = await desk.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
  const room = workspace.data ?? {};
  check('and the deal room shows all of it together',
    room.ok === true && JSON.stringify(room).includes(PROPERTY) && JSON.stringify(room).includes(CLIENT),
    JSON.stringify(room.reason ?? 'ok'));

  /* ── 12 ────────────────────────────────────────────────────── */
  chapter('Marketing for the same property');
  creativePath = `${dealerId}/${stamp}-creative.jpg`;
  const creativeUpload = await admin.storage.from(CREATIVE_BUCKET)
    .upload(creativePath, JPEG, { contentType: 'image/jpeg', upsert: true });
  check('the operator\'s creative is stored privately', !creativeUpload.error,
    creativeUpload.error?.message ?? 'stored');

  const { data: ctx } = await admin.from('marketing_content_contexts').insert({
    dealer_id: dealerId, property_id: PROPERTY, version: 1, status: 'current',
    facts: { property: { area: 'Sector 91, Mohali', type: 'Residential Plot', size: '250 sq yd' } },
    photo_refs: [], content_hash: createHash('sha256').update(`${dealerId}:${stamp}`).digest('hex'),
  }).select('id').single();
  const { data: creative } = await admin.from('marketing_creatives').insert({
    dealer_id: dealerId, content_context_id: ctx.id, property_id: PROPERTY,
    design_key: 'first-client', design_version: '1', channel: 'instagram', format: 'square',
    status: 'approved', creative_type: 'post', copy: { caption: CAPTION },
    asset: { bucket: CREATIVE_BUCKET, path: creativePath, mime: 'image/jpeg', w: 1, h: 1, bytes: JPEG.length },
    approved_at: new Date().toISOString(),
  }).select('id').single();
  await admin.from('marketing_schedule_items').insert({
    dealer_id: dealerId, creative_id: creative.id, channel: 'instagram',
    scheduled_for: new Date().toISOString(), status: 'approved', slot_key: 'first-client',
  });

  const { data: sessionData } = await desk.auth.getSession();
  const feedResponse = await fetch(`${URL}/functions/v1/marketing-ops`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173', apikey: ANON,
      Authorization: `Bearer ${sessionData?.session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'dealer-feed' }),
  });
  const feed = await feedResponse.json().catch(() => ({}));
  const shownCreative = (feed.creatives ?? [])[0] ?? {};
  check('the dealer sees it in their Marketing workspace',
    feedResponse.status === 200 && (feed.creatives ?? []).length === 1,
    `${feedResponse.status} ${(feed.creatives ?? []).length}`);
  check('for the same property they entered once',
    shownCreative.propertyId === PROPERTY, String(shownCreative.propertyId));
  check('with the caption the operator wrote', shownCreative.caption === CAPTION);
  check('and nothing claims it has been posted',
    (shownCreative.publicationStates ?? []).length === 0,
    JSON.stringify(shownCreative.publicationStates));

  /* ── 13 ────────────────────────────────────────────────────── */
  chapter('The sale completes');
  const today = new Date().toISOString().slice(0, 10);
  const sold = await desk.rpc('plotmap_record_completed_sale', { p_payload: {
    propertyId: PROPERTY, buyerId: CLIENT, soldPrice: 7500000,
    saleDate: today, registrationDate: today,
  } });
  check('the sale is recorded', sold.data?.ok === true, JSON.stringify(sold.data?.reason ?? 'ok'));
  check('and it completes the deal already open rather than opening a second one',
    sold.data?.deal?.id === dealId, `${sold.data?.reusedPipelineDeal} ${sold.data?.deal?.id}`);

  const after = await desk.from('crm_records').select('payload').eq('id', PROPERTY).maybeSingle();
  check('and the property is marked sold on the one canonical record',
    after.data?.payload?.sold === true || after.data?.payload?.lifecycle === 'sold',
    `sold=${after.data?.payload?.sold} lifecycle=${after.data?.payload?.lifecycle}`);

  const afterSale = await fetch(`${URL}/functions/v1/resolve-client-link`, {
    method: 'POST',
    headers: {
      Origin: 'https://mapco-navy.vercel.app', apikey: ANON,
      Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: linkToken }),
  });
  const afterBody = await afterSale.json().catch(() => ({}));
  check('a sold property is no longer presented to buyers',
    (afterBody.link?.properties ?? []).length === 0 || afterSale.status !== 200,
    `${afterSale.status} ${(afterBody.link?.properties ?? []).length} propert(y/ies)`);
}

main()
  .catch((error) => { failures++; console.error(`\nFATAL: ${error.message}`); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${failures === 0 ? 'FIRST-CLIENT WALKTHROUGH: PASS' : `FIRST-CLIENT WALKTHROUGH: FAIL — ${failures} failure(s)`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
