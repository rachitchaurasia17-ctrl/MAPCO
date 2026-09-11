#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO-DEV — a dealer's media, all the way to gone.

   Removing a photo has to remove it. For a long time the dealer saw the
   right thing — the photo left the property and every client link — while
   the bytes stayed in the bucket, because one permissive DELETE policy on
   storage.objects read a table the deleting role may not touch, and
   Postgres evaluates every permissive policy for the command. The error
   was about marketing creatives; the casualty was every storage delete a
   dealer made, in every bucket.

   This proves the two halves of that together:

     · a dealer can upload their own property photo and delete it, and
       the object is really gone afterwards;
     · a marketing creative that is still referenced by a creative record
       still cannot be deleted, and a dealer still cannot touch another
       dealer's media at all.

   Throwaway rows only, removed afterwards.
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

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const dealers = [];
const devices = [];
let creativePath = '';
let creativeId = '';

async function provision(tag) {
  const dealerId = `dealer-store-${tag}-${stamp}`;
  const email = `mapco-store-${tag}-${stamp}@example.invalid`;
  const password = `St!${Math.random().toString(36).slice(2, 12)}Aa1`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const userId = created.user.id;

  await admin.from('dealer_settings').upsert({
    dealer_id: dealerId, brand_name: `Storage ${tag}`, default_city: 'Mohali',
    subscription_status: 'active', account_status: 'active',
    expiry_date: new Date(Date.now() + 30 * 864e5).toISOString(), storage_enabled: true,
  });
  await admin.from('profiles').upsert({
    id: userId, email, role: 'owner', dealer_id: dealerId, status: 'active',
  });

  const propertyId = `prop-store-${tag}-${stamp}`;
  await admin.from('crm_records').upsert({
    id: propertyId, dealer_id: dealerId, entity_type: 'properties', deleted: false,
    payload: { id: propertyId, type: 'Residential Plot', want: 'Plot', city: 'Mohali',
      area: 'Sector 91', loc: 'Sector 91, Mohali', size: '250 sq yd', facing: 'East',
      position: 'Corner plot', approvals: [], landmarks: [], price: 7500000,
      photos: [], published: true, sold: false, lifecycle: 'on-sale' },
  });

  const session = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await session.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${tag}): ${signInErr.message}`);

  const probe = await session.rpc('plotmap_dealer_access_status');
  if (!probe.error && probe.data?.status !== 'approved') {
    if (!FOUNDER_EMAIL || !FOUNDER_PASSWORD) {
      console.error('A dealer needs an approved device here: set MAPCO_FOUNDER_EMAIL and MAPCO_FOUNDER_PASSWORD.');
      process.exit(2);
    }
    await founder.auth.signInWithPassword({ email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD });
    const { data: code, error: codeErr } = await founder.rpc(
      'plotmap_founder_create_device_code', { p_dealer_id: dealerId });
    if (codeErr) throw new Error(`device code(${tag}): ${codeErr.message}`);
    const token = randomBytes(32).toString('hex');
    const label = `storage-e2e-${tag}-${stamp}`;
    await session.rpc('plotmap_activate_device', {
      p_access_code: String(code.code), p_device_token: token,
      p_device_label: label, p_browser_info: 'storage-lifecycle-e2e',
    });
    const bound = await session.rpc('plotmap_dealer_access_status', { p_device_token: token });
    if (bound.data?.status !== 'approved') throw new Error(`gate(${tag}): ${JSON.stringify(bound.data)}`);
    const { data: roster } = await founder.rpc('plotmap_admin_list_dealer_devices');
    const device = (roster ?? []).find((d) => d.dealer_id === dealerId && d.device_label === label);
    if (device) devices.push(device.id);
  }

  const record = { tag, dealerId, userId, session, propertyId };
  dealers.push(record);
  return record;
}

async function cleanup() {
  console.log('\n--- cleaning up test data ---');
  for (const d of dealers) {
    const listed = await admin.storage.from('property-photos')
      .list(`dealers/${d.dealerId}/properties/${d.propertyId}`);
    const paths = (listed.data ?? []).map((o) => `dealers/${d.dealerId}/properties/${d.propertyId}/${o.name}`);
    if (paths.length) { try { await admin.storage.from('property-photos').remove(paths); } catch {} }
    try { await admin.from('marketing_creatives').delete().eq('dealer_id', d.dealerId); } catch {}
    try { await admin.from('marketing_content_contexts').delete().eq('dealer_id', d.dealerId); } catch {}
    try { await admin.from('crm_records').delete().eq('dealer_id', d.dealerId); } catch {}
    try { await admin.from('profiles').delete().eq('id', d.userId); } catch {}
    try { await admin.from('dealer_settings').delete().eq('dealer_id', d.dealerId); } catch {}
    try { await admin.auth.admin.deleteUser(d.userId); } catch {}
  }
  if (creativePath) { try { await admin.storage.from('marketing-creatives').remove([creativePath]); } catch {} }
  for (const id of devices) {
    try {
      await founder.rpc('plotmap_admin_set_device_status', {
        p_device_id: id, p_status: 'revoked', p_developer_notes: 'storage-lifecycle-e2e cleanup',
      });
    } catch {}
  }
  console.log('cleanup complete');
}

async function main() {
  console.log('MAPCO-DEV — property media, all the way to gone\n');
  const a = await provision('a');
  const b = await provision('b');

  /* ── a dealer's own photo, up and back down ────────────────── */
  const path = `dealers/${a.dealerId}/properties/${a.propertyId}/${stamp}.png`;
  const up = await a.session.storage.from('property-photos')
    .upload(path, PNG, { contentType: 'image/png' });
  check('a dealer can upload a photo for their own property', !up.error,
    up.error?.message ?? 'uploaded');

  const del = await a.session.storage.from('property-photos').remove([path]);
  check('and can delete it again', !del.error && (del.data ?? []).length === 1,
    del.error?.message ?? 'removed');

  const remaining = await admin.storage.from('property-photos')
    .list(`dealers/${a.dealerId}/properties/${a.propertyId}`);
  check('and the bytes are actually gone, not just the reference',
    (remaining.data ?? []).length === 0, `${(remaining.data ?? []).length} object(s) left`);

  /* ── the property must exist; a path cannot be invented ────── */
  const strayPath = `dealers/${a.dealerId}/properties/prop-that-does-not-exist/${stamp}.png`;
  const stray = await a.session.storage.from('property-photos')
    .upload(strayPath, PNG, { contentType: 'image/png' });
  check('a photo cannot be uploaded for a property that does not exist', !!stray.error,
    stray.error?.message ?? 'accepted');

  /* ── nobody reaches another dealer's media ─────────────────── */
  const theirPath = `dealers/${b.dealerId}/properties/${b.propertyId}/${stamp}.png`;
  await admin.storage.from('property-photos').upload(theirPath, PNG, { contentType: 'image/png' });
  const intrude = await a.session.storage.from('property-photos').upload(
    `dealers/${b.dealerId}/properties/${b.propertyId}/${stamp}-x.png`, PNG, { contentType: 'image/png' });
  check('a dealer cannot put a photo in another dealer\'s folder', !!intrude.error,
    intrude.error?.message ?? 'accepted');
  const steal = await a.session.storage.from('property-photos').remove([theirPath]);
  check('nor delete another dealer\'s photo',
    !!steal.error || (steal.data ?? []).length === 0,
    steal.error?.message ?? `${(steal.data ?? []).length} removed`);
  const stillThere = await admin.storage.from('property-photos')
    .list(`dealers/${b.dealerId}/properties/${b.propertyId}`);
  check('and it is still where its owner left it', (stillThere.data ?? []).length === 1);

  /* ── the marketing rule the policy exists to enforce ───────── */
  creativePath = `${a.dealerId}/${stamp}-bound.jpg`;
  await admin.storage.from('marketing-creatives')
    .upload(creativePath, PNG, { contentType: 'image/jpeg', upsert: true });
  const { data: ctx } = await admin.from('marketing_content_contexts').insert({
    dealer_id: a.dealerId, property_id: a.propertyId, version: 1, status: 'current',
    facts: { property: { area: 'Sector 91, Mohali' } }, photo_refs: [],
    content_hash: createHash('sha256').update(`${a.dealerId}:${stamp}`).digest('hex'),
  }).select('id').single();
  const { data: creative } = await admin.from('marketing_creatives').insert({
    dealer_id: a.dealerId, content_context_id: ctx.id, property_id: a.propertyId,
    design_key: 'storage-e2e', design_version: '1', channel: 'instagram', format: 'square',
    status: 'approved', creative_type: 'post', copy: { caption: 'bound' },
    asset: { bucket: 'marketing-creatives', path: creativePath, mime: 'image/jpeg' },
  }).select('id').single();
  creativeId = creative.id;

  const bound = await a.session.storage.from('marketing-creatives').remove([creativePath]);
  const boundStill = await admin.storage.from('marketing-creatives').list(a.dealerId);
  check('a creative a marketing record still points at cannot be deleted',
    (boundStill.data ?? []).some((o) => o.name.endsWith('-bound.jpg')),
    bound.error?.message ?? `${(bound.data ?? []).length} removed`);
  check('and the attempt does not error the way it used to',
    !bound.error || !/permission denied for table/i.test(bound.error.message),
    bound.error?.message ?? 'no error');
}

main()
  .catch((error) => { failures++; console.error(`\nFATAL: ${error.message}`); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} failure(s)`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
