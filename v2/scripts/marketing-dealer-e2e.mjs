#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO-DEV — the dealer's Marketing workspace, end to end.

   One canonical marketing record has to carry a creative all the way
   from the operator who produced it to the dealer who owns it:

     operator uploads the finished creative
       → marketing_creatives (+ its content context and channels)
       → dealer-feed Edge Function
       → the dealer sees their own media, caption, property and channels

   This proves that chain against the live database, and the two things
   that make it safe:

     · a dealer sees their own creatives and nobody else's;
     · nothing reads as posted unless a publication row says so, and
       that row's status uses the database's own vocabulary
       (attempted / succeeded / failed).

   Throwaway rows only; removed afterwards. Never prints keys.

   Usage:
     SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... \
       node scripts/marketing-dealer-e2e.mjs
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
function check(name, condition, detail = '') {
  const ok = !!condition;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

const CAPTION = 'Corner plot in Sector 91, Mohali. 250 sq yd, east facing, ready to register.';
const BUCKET = 'marketing-creatives';
const devices = [];
const dealers = [];

/* A 1x1 JPEG. Real bytes, so the signed URL really resolves to media. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

async function approveDevice(dealerId, session, label) {
  const { data, error } = await session.rpc('plotmap_dealer_access_status');
  if (error || data?.status === 'approved') return;
  if (!FOUNDER_EMAIL || !FOUNDER_PASSWORD) {
    console.error('This database requires an approved device: set MAPCO_FOUNDER_EMAIL and MAPCO_FOUNDER_PASSWORD.');
    process.exit(2);
  }
  const signedIn = await founder.auth.signInWithPassword({ email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD });
  if (signedIn.error) throw new Error(`founder sign-in: ${signedIn.error.message}`);
  const { data: code, error: codeErr } = await founder.rpc(
    'plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  if (codeErr) throw new Error(`device code: ${codeErr.message}`);
  const deviceToken = randomBytes(32).toString('hex');
  const { error: actErr } = await session.rpc('plotmap_activate_device', {
    p_access_code: String(code.code), p_device_token: deviceToken,
    p_device_label: label, p_browser_info: 'marketing-dealer-e2e',
  });
  if (actErr) throw new Error(`activate: ${actErr.message}`);
  const { data: access, error: gateErr } = await session.rpc(
    'plotmap_dealer_access_status', { p_device_token: deviceToken });
  if (gateErr) throw new Error(`gate: ${gateErr.message}`);
  if (access?.status !== 'approved') throw new Error(`gate: ${JSON.stringify(access)}`);
  const { data: roster } = await founder.rpc('plotmap_admin_list_dealer_devices');
  const found = (roster ?? []).find((d) => d.dealer_id === dealerId && d.device_label === label);
  if (found) devices.push(found.id);
}

async function provisionDealer(tag) {
  const dealerId = `dealer-mkt-${tag}-${stamp}`;
  const email = `mapco-mkt-${tag}-${stamp}@example.invalid`;
  const password = `Mk!${Math.random().toString(36).slice(2, 12)}Aa1`;

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw new Error(`createUser(${tag}): ${userErr.message}`);
  const userId = created.user.id;

  const { error: dsErr } = await admin.from('dealer_settings').upsert({
    dealer_id: dealerId, brand_name: `Marketing E2E ${tag}`, default_city: 'Mohali',
    subscription_status: 'active', account_status: 'active',
    expiry_date: new Date(Date.now() + 30 * 864e5).toISOString(),
    storage_enabled: true, owner_name: `Marketing E2E ${tag} Owner`,
    owner_phone: '+91900000010' + (tag === 'a' ? '1' : '2'), primary_area: 'Mohali',
  });
  if (dsErr) throw new Error(`dealer_settings(${tag}): ${dsErr.message}`);

  const { error: pErr } = await admin.from('profiles').upsert({
    id: userId, email, role: 'owner', dealer_id: dealerId, status: 'active',
  });
  if (pErr) throw new Error(`profiles(${tag}): ${pErr.message}`);

  const session = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await session.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${tag}): ${signInErr.message}`);
  await approveDevice(dealerId, session, `marketing-e2e-${tag}-${stamp}`);

  const record = { tag, dealerId, userId, session, propertyId: `prop-mkt-${tag}-${stamp}` };
  dealers.push(record);
  return record;
}

/** The rows the operator's approve-slot step produces, written directly. */
async function seedCreativeFor(dealer, { creativeType = 'post', channels = ['instagram', 'facebook_page'] } = {}) {
  const { error: propErr } = await admin.from('crm_records').upsert({
    id: dealer.propertyId, dealer_id: dealer.dealerId, entity_type: 'properties', deleted: false,
    payload: {
      id: dealer.propertyId, type: 'Residential Plot', want: 'Plot', city: 'Mohali',
      area: 'Sector 91', loc: 'Sector 91, Mohali', sector: '91', size: '250 sq yd',
      facing: 'East', position: 'Corner plot', approvals: [], landmarks: [],
      price: 7500000, photos: [], published: true, sold: false, lifecycle: 'on-sale',
    },
  });
  if (propErr) throw new Error(`property(${dealer.tag}): ${propErr.message}`);

  const path = `${dealer.dealerId}/${stamp}-${dealer.tag}.jpg`;
  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, JPEG, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw new Error(`upload(${dealer.tag}): ${upErr.message}`);

  const { data: ctx, error: ctxErr } = await admin.from('marketing_content_contexts').insert({
    dealer_id: dealer.dealerId, property_id: dealer.propertyId, version: 1, status: 'current',
    facts: { property: { area: 'Sector 91, Mohali', type: 'Residential Plot', size: '250 sq yd' } },
    photo_refs: [], content_hash: createHash('sha256').update(`${dealer.dealerId}:${stamp}`).digest('hex'),
  }).select('id').single();
  if (ctxErr) throw new Error(`context(${dealer.tag}): ${ctxErr.message}`);

  const { data: creative, error: crErr } = await admin.from('marketing_creatives').insert({
    dealer_id: dealer.dealerId, content_context_id: ctx.id, property_id: dealer.propertyId,
    design_key: 'e2e', design_version: '1', channel: channels[0], format: 'square',
    status: 'approved', creative_type: creativeType,
    copy: { caption: CAPTION },
    asset: { bucket: BUCKET, path, mime: 'image/jpeg', w: 1, h: 1, bytes: JPEG.length },
    approved_at: new Date().toISOString(),
  }).select('id').single();
  if (crErr) throw new Error(`creative(${dealer.tag}): ${crErr.message}`);

  for (const channel of channels) {
    const { error: siErr } = await admin.from('marketing_schedule_items').insert({
      dealer_id: dealer.dealerId, creative_id: creative.id, channel,
      scheduled_for: new Date().toISOString(), status: 'approved', slot_key: `e2e-${channel}`,
    });
    if (siErr) throw new Error(`schedule(${dealer.tag}/${channel}): ${siErr.message}`);
  }
  dealer.creativeId = creative.id;
  dealer.assetPath = path;
  return creative.id;
}

async function dealerFeed(dealer) {
  const { data: sessionData } = await dealer.session.auth.getSession();
  const response = await fetch(`${URL}/functions/v1/marketing-ops`, {
    method: 'POST',
    headers: {
      /* marketing-ops answers only allow-listed origins. The dealer app is
         served from one of them; a request without an Origin is refused
         with 403, which is the same answer a stranger would get. */
      Origin: 'http://localhost:5173',
      'Content-Type': 'application/json', apikey: ANON,
      Authorization: `Bearer ${sessionData?.session?.access_token}`,
    },
    body: JSON.stringify({ action: 'dealer-feed' }),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function cleanup() {
  console.log('\n--- cleaning up test data ---');
  for (const dealer of dealers) {
    try { await admin.from('marketing_publications').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.from('marketing_schedule_items').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.from('marketing_creatives').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.from('marketing_content_contexts').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.from('marketing_post_slots').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.from('marketing_periods').delete().eq('dealer_id', dealer.dealerId); } catch {}
    if (dealer.assetPath) { try { await admin.storage.from(BUCKET).remove([dealer.assetPath]); } catch {} }
    try { await admin.from('crm_records').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.from('profiles').delete().eq('id', dealer.userId); } catch {}
    try { await admin.from('dealer_settings').delete().eq('dealer_id', dealer.dealerId); } catch {}
    try { await admin.auth.admin.deleteUser(dealer.userId); } catch {}
  }
  for (const deviceId of devices) {
    try {
      await founder.rpc('plotmap_admin_set_device_status', {
        p_device_id: deviceId, p_status: 'revoked',
        p_developer_notes: 'marketing-dealer-e2e cleanup',
      });
    } catch {}
  }
  console.log('cleanup complete');
}

async function main() {
  console.log('MAPCO-DEV — dealer Marketing workspace\n');
  const a = await provisionDealer('a');
  const b = await provisionDealer('b');
  await seedCreativeFor(a, { creativeType: 'post', channels: ['instagram', 'facebook_page'] });
  await seedCreativeFor(b, { creativeType: 'reel', channels: ['instagram'] });

  /* ── 1. the dealer sees their own canonical creative ───────────── */
  const feedA = await dealerFeed(a);
  check('the dealer feed answers', feedA.status === 200 && feedA.body.ok === true,
    `${feedA.status} ${JSON.stringify(feedA.body.reason ?? 'ok')}`);
  const creatives = feedA.body.creatives ?? [];
  check('it returns exactly the dealer\'s own creative', creatives.length === 1,
    `${creatives.length} creative(s)`);
  const one = creatives[0] ?? {};
  check('with the caption the operator stored', one.caption === CAPTION, String(one.caption).slice(0, 40) + '…');
  check('with the property it was made for', one.propertyId === a.propertyId, String(one.propertyId));
  check('labelled from the canonical property facts',
    String(one.propertyLabel || '').includes('Sector 91'), String(one.propertyLabel));
  check('with the channels it is scheduled on',
    JSON.stringify((one.channels ?? []).slice().sort()) === JSON.stringify(['facebook_page', 'instagram']),
    JSON.stringify(one.channels));
  check('typed as a post', one.creativeType === 'post', String(one.creativeType));

  /* ── 2. the media is real, private, and reaches the dealer ────── */
  const displayUrl = one.asset?.displayUrl ?? '';
  check('the asset arrives as a signed URL, never a storage path',
    /^https:\/\//.test(displayUrl) && !('path' in (one.asset ?? {})) && !('bucket' in (one.asset ?? {})),
    displayUrl ? 'signed' : JSON.stringify(one.asset));
  if (displayUrl) {
    const media = await fetch(displayUrl);
    const bytes = new Uint8Array(await media.arrayBuffer());
    check('and that URL really serves the bytes the operator uploaded',
      media.status === 200 && bytes.length === JPEG.length,
      `${media.status} ${bytes.length}B of ${JPEG.length}B`);
  }
  const anonymous = await fetch(`${URL}/storage/v1/object/${BUCKET}/${a.assetPath}`,
    { headers: { apikey: ANON } });
  check('the same object is not readable without a signature',
    anonymous.status >= 400, String(anonymous.status));

  /* ── 3. one dealer never sees another's marketing ─────────────── */
  const feedB = await dealerFeed(b);
  const idsB = (feedB.body.creatives ?? []).map((c) => c.id);
  check('the other dealer sees only their own', idsB.length === 1 && idsB[0] === b.creativeId,
    `${idsB.length} creative(s)`);
  check('and never the first dealer\'s creative', !idsB.includes(a.creativeId));
  check('the other dealer\'s reel is typed as a reel',
    (feedB.body.creatives ?? [])[0]?.creativeType === 'reel');

  /* ── 4. nothing reads as posted until a publication says so ──── */
  check('a creative with no publication row reports none',
    Array.isArray(one.publicationStates) && one.publicationStates.length === 0,
    JSON.stringify(one.publicationStates));

  await admin.from('marketing_publications').insert({
    dealer_id: a.dealerId, creative_id: a.creativeId, channel: 'instagram',
    status: 'succeeded', external_ref: 'ig-e2e-' + stamp,
    external_url: 'https://instagram.com/p/e2e',
  });
  const afterPublish = await dealerFeed(a);
  const states = (afterPublish.body.creatives ?? [])[0]?.publicationStates ?? [];
  const instagram = states.find((s) => s.channel === 'instagram');
  check('and reports it once one exists', !!instagram, JSON.stringify(states));
  check('using the database\'s own word for it', instagram?.status === 'succeeded', String(instagram?.status));
  check('with the time it went out', !!instagram?.publishedAt, String(instagram?.publishedAt));
  check('while the channel that did not go out stays silent',
    !states.some((s) => s.channel === 'facebook_page'), JSON.stringify(states.map((s) => s.channel)));
}

main()
  .catch((error) => { failures++; console.error(`\nFATAL: ${error.message}`); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} failure(s)`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
