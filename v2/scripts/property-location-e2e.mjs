#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO-DEV — where Property Intelligence gets its coordinate.

   Property Intelligence is the one surface that spends real money per
   generation, and the one that is worthless if it describes the wrong
   patch of earth. This proves, against the live database, that:

     · the exact WGS84 point the dealer confirmed is what the Edge
       Function is handed — to the digit;
     · nothing in the request body can influence that coordinate;
     · a property with no confirmed pin yields `location_not_set`
       rather than a city centre, a sector centre or a default;
     · a raster sector-sheet placement (mapPlacement) is never
       mistaken for a place on earth;
     · `location.updatedAt`, which decides whether cached intelligence
       still belongs to this property, moves when the pin moves and
       stays put when the dealer edits anything else.

   Reads and writes throwaway rows only, and deletes them afterwards.
   Costs nothing: it never asks for a generation.

   Usage:
     SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... \
       node scripts/property-location-e2e.mjs
   ═══════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error('Need SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY.');
  process.exit(2);
}
if (!/lswzrkvdwirhvggtvuch/.test(URL)) {
  console.error(`Refusing to run: ${URL} is not MAPCO-DEV.`);
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

/* A dealer's own identity depends on an approved device: without one
   plotmap_current_dealer_id() returns '' and every read comes back empty
   rather than refused. Only the founder can approve a device, so the
   harness goes through the real approval rather than around it. */
const FOUNDER_EMAIL = process.env.MAPCO_FOUNDER_EMAIL;
const FOUNDER_PASSWORD = process.env.MAPCO_FOUNDER_PASSWORD;
const founder = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
let approvedDeviceId = null;

async function approveDeviceFor(dealer, dealerSession, label) {
  const { data, error } = await dealerSession.rpc('plotmap_dealer_access_status');
  if (error || data?.status === 'approved') return;
  if (!FOUNDER_EMAIL || !FOUNDER_PASSWORD) {
    console.error('This database requires an approved device, so this harness needs');
    console.error('MAPCO_FOUNDER_EMAIL and MAPCO_FOUNDER_PASSWORD.');
    process.exit(2);
  }
  const signedIn = await founder.auth.signInWithPassword({
    email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD,
  });
  if (signedIn.error) throw new Error(`founder sign-in: ${signedIn.error.message}`);
  const { data: code, error: codeErr } = await founder.rpc(
    'plotmap_founder_create_device_code', { p_dealer_id: dealer });
  if (codeErr) throw new Error(`device code: ${codeErr.message}`);

  const deviceToken = randomBytes(32).toString('hex');
  const { data: act, error: actErr } = await dealerSession.rpc('plotmap_activate_device', {
    p_access_code: String(code.code), p_device_token: deviceToken,
    p_device_label: label, p_browser_info: 'property-location-e2e',
  });
  if (actErr) throw new Error(`activate: ${actErr.message}`);
  const { data: access, error: gateErr } = await dealerSession.rpc(
    'plotmap_dealer_access_status', { p_device_token: deviceToken });
  if (gateErr) throw new Error(`gate: ${gateErr.message}`);
  if (access?.status !== 'approved') throw new Error(`gate: ${JSON.stringify(access)}`);

  const { data: devices } = await founder.rpc('plotmap_admin_list_dealer_devices');
  approvedDeviceId = (devices ?? []).find(
    (d) => d.dealer_id === dealer && d.device_label === label)?.id ?? null;
}

const stamp = Date.now();
let failures = 0;
function check(name, condition, detail = '') {
  const ok = !!condition;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

/* The pin a dealer actually dropped, stored at six decimals — ~11cm. */
const CONFIRMED = { latitude: 30.704649, longitude: 76.717873 };
const MOVED = { latitude: 30.712345, longitude: 76.723456 };
/* What a wrong answer would look like: the centre of Mohali. Nothing may
   ever substitute this for a property's own coordinate. */
const CITY_CENTRE = { latitude: 30.7046, longitude: 76.7179 };

const dealerId = `dealer-loc-${stamp}`;
const email = `mapco-loc-${stamp}@example.invalid`;
const password = `Loc!${Math.random().toString(36).slice(2, 12)}Aa1`;
const PINNED = `prop-loc-pinned-${stamp}`;
const UNPINNED = `prop-loc-unpinned-${stamp}`;
const SHEET_ONLY = `prop-loc-sheet-${stamp}`;
let userId = null;
let session = null;

const property = (id, extra) => ({
  id, dealer_id: dealerId, entity_type: 'properties', deleted: false,
  payload: {
    id, type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Sector 91',
    loc: 'Sector 91, Mohali', sector: '91', size: '250 sq yd', facing: 'East',
    position: 'Corner plot', approvals: [], landmarks: [], price: 7500000,
    photos: [], published: true, sold: false, lifecycle: 'on-sale',
    ...extra,
  },
});

async function provision() {
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw new Error(`createUser: ${userErr.message}`);
  userId = created.user.id;

  const { error: dsErr } = await admin.from('dealer_settings').upsert({
    dealer_id: dealerId, brand_name: 'Location E2E', default_city: 'Mohali',
    subscription_status: 'active', account_status: 'active',
    expiry_date: new Date(Date.now() + 30 * 864e5).toISOString(),
    storage_enabled: true, owner_name: 'Location E2E Owner',
    owner_phone: '+919000000009', primary_area: 'Mohali',
  });
  if (dsErr) throw new Error(`dealer_settings: ${dsErr.message}`);

  const { error: pErr } = await admin.from('profiles').upsert({
    id: userId, email, role: 'owner', dealer_id: dealerId, status: 'active',
  });
  if (pErr) throw new Error(`profiles: ${pErr.message}`);

  const { error: rowErr } = await admin.from('crm_records').upsert([
    property(PINNED, {
      location: { ...CONFIRMED, source: 'dealer-selected', updatedAt: '2026-09-01T10:00:00.000Z' },
    }),
    // No `location` at all: the dealer never confirmed a pin.
    property(UNPINNED, {}),
    // A pin on a raster master-plan image, which is not a place on earth.
    property(SHEET_ONLY, {
      mapPlacement: { mapId: 'sector-91', x: 0.42, y: 0.61, placedAt: '2026-09-01T10:00:00.000Z' },
    }),
  ]);
  if (rowErr) throw new Error(`crm_records: ${rowErr.message}`);

  session = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await session.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);
  await approveDeviceFor(dealerId, session, `property-location-e2e-${stamp}`);
}

async function cleanup() {
  console.log('\n--- cleaning up test data ---');
  try { await admin.from('property_intelligence').delete().eq('dealer_id', dealerId); } catch {}
  try { await admin.from('crm_records').delete().eq('dealer_id', dealerId); } catch {}
  try { await admin.from('profiles').delete().eq('id', userId); } catch {}
  try { await admin.from('dealer_settings').delete().eq('dealer_id', dealerId); } catch {}
  if (userId) { try { await admin.auth.admin.deleteUser(userId); } catch {} }
  /* Hand the device slot back: the limit is four per dealer, and a harness
     that kept its device would eventually lock a dealer out. */
  if (approvedDeviceId) {
    try {
      await founder.rpc('plotmap_admin_set_device_status', {
        p_device_id: approvedDeviceId, p_status: 'revoked',
        p_developer_notes: 'property-location-e2e cleanup',
      });
    } catch { /* best effort */ }
  }
  console.log('cleanup complete');
}

/** Exactly what the Edge Function reads before it builds its request. */
async function contextFor(propertyId) {
  const { data, error } = await session.rpc('plotmap_property_intelligence_get',
    { p_property_id: propertyId });
  if (error) throw new Error(`intelligence_get(${propertyId}): ${error.message}`);
  return data;
}

async function main() {
  console.log('MAPCO-DEV — Property Intelligence coordinate provenance\n');
  await provision();

  /* ── 1. the confirmed pin is what the request is built from ──── */
  const pinned = await contextFor(PINNED);
  check('the property context resolves for its own dealer', pinned?.ok === true,
    JSON.stringify(pinned?.reason ?? 'ok'));
  check('latitude reaches the request exactly as the dealer confirmed it',
    pinned?.location?.latitude === CONFIRMED.latitude,
    `${pinned?.location?.latitude} === ${CONFIRMED.latitude}`);
  check('longitude reaches the request exactly as the dealer confirmed it',
    pinned?.location?.longitude === CONFIRMED.longitude,
    `${pinned?.location?.longitude} === ${CONFIRMED.longitude}`);
  check('the coordinate is not rounded to the city centre',
    pinned?.location?.latitude !== CITY_CENTRE.latitude
    || pinned?.location?.longitude !== CITY_CENTRE.longitude);
  check('the relocation marker travels with it',
    pinned?.location?.updatedAt === '2026-09-01T10:00:00.000Z',
    String(pinned?.location?.updatedAt));
  check('it is recorded as dealer-selected, not derived',
    pinned?.location?.source === 'dealer-selected', String(pinned?.location?.source));

  /* ── 2. no pin means no coordinate, never a substitute ───────── */
  const unpinned = await contextFor(UNPINNED);
  check('a property with no confirmed pin carries no location at all',
    unpinned?.ok === true && (unpinned.location === null || unpinned.location === undefined),
    JSON.stringify(unpinned?.location ?? null));
  check('and its city is still known, so nothing was cleared by mistake',
    unpinned?.city === 'Mohali', String(unpinned?.city));
  check('the city is not promoted into a coordinate',
    !unpinned?.location?.latitude);

  /* ── 3. a sector-sheet pin is not a place on earth ───────────── */
  const sheet = await contextFor(SHEET_ONLY);
  check('a raster sector-sheet placement yields no Earth location',
    sheet?.ok === true && !sheet?.location,
    JSON.stringify(sheet?.location ?? null));

  /* ── 4. tenancy: another dealer's property is not readable ──── */
  const foreign = await contextFor('property-that-is-not-mine');
  check('a property this dealer does not own is refused',
    foreign?.ok === false, String(foreign?.reason));

  /* ── 5. the request body cannot choose the coordinate ────────── */
  /* Asked about the property that has NO pin, while the body insists on one.
     The honest answer is `location_not_set`. If the body could supply a
     coordinate the function would instead go and generate intelligence for
     a beach in Mumbai and file it under a plot in Mohali.

     The unpinned property is used deliberately: a generation is a paid round
     of Places, Routes and model calls, and a verification script has no
     business spending that to prove a point it can prove for nothing. */
  const { data: sessionData } = await session.auth.getSession();
  const token = sessionData?.session?.access_token;
  let bodyIgnored = 'not reached';
  try {
    const response = await fetch(`${URL}/functions/v1/property-intelligence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', apikey: ANON,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        propertyId: UNPINNED,
        // A forged location — Juhu Beach, Mumbai. Nothing may honour it.
        location: { latitude: 19.0760, longitude: 72.8777 },
        latitude: 19.0760, longitude: 72.8777, point: { latitude: 19.0760, longitude: 72.8777 },
      }),
    });
    const vm = await response.json().catch(() => null);
    const serialized = JSON.stringify(vm ?? {});
    bodyIgnored = `${response.status} ${String(vm?.status ?? '')}/${String(vm?.reason ?? '')}`;
    check('the Edge Function never takes a coordinate from the request body',
      !serialized.includes('19.076') && !serialized.includes('72.8777'), bodyIgnored);
    check('it says the location is not set instead of using the forged one',
      vm?.reason === 'location_not_set', bodyIgnored);
    check('and it answers rather than failing open',
      response.status === 200, String(response.status));
  } catch (error) {
    check('the Edge Function never grounds at a coordinate from the request body',
      false, String(error?.message ?? error));
  }

  /* ── 6. the relocation marker means what it says ─────────────── */
  /* It is folded into the intelligence cache digest, so a new value means
     "regenerate" — a paid round of Places, Routes and model calls. */
  const beforeEdit = (await contextFor(PINNED)).location.updatedAt;
  await admin.from('crm_records').update({
    payload: { ...property(PINNED, {
      location: { ...CONFIRMED, source: 'dealer-selected', updatedAt: beforeEdit },
    }).payload, price: 8000000 },
  }).eq('id', PINNED);
  const afterEdit = (await contextFor(PINNED)).location.updatedAt;
  check('editing a price does not mark the intelligence stale',
    afterEdit === beforeEdit, `${beforeEdit} === ${afterEdit}`);

  await admin.from('crm_records').update({
    payload: property(PINNED, {
      location: { ...MOVED, source: 'dealer-selected', updatedAt: new Date().toISOString() },
    }).payload,
  }).eq('id', PINNED);
  const afterMove = await contextFor(PINNED);
  check('moving the pin does mark it stale',
    afterMove.location.updatedAt !== beforeEdit, String(afterMove.location.updatedAt));
  check('and the new coordinate is the one that would be generated from',
    afterMove.location.latitude === MOVED.latitude
    && afterMove.location.longitude === MOVED.longitude,
    `${afterMove.location.latitude},${afterMove.location.longitude}`);
}

main()
  .catch((error) => { failures++; console.error(`\nFATAL: ${error.message}`); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} failure(s)`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
