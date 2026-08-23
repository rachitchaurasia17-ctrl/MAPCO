/* Genuine MAPCO-DEV Marketing workflow verification.

   Creates isolated temporary actors/dealers, exercises authenticated RLS/RPC,
   private Storage and the deployed broker, and removes everything unless
   --keep is supplied for browser verification. Never targets another project. */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const parseEnv = (path) => Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/)
  .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const env = parseEnv(resolve(root, 'supabase/.env'));
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL?.includes('lswzrkvdwirhvggtvuch') || !SERVICE || !ANON) throw new Error('Refusing to run outside MAPCO-DEV');

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const password = 'MapcoMarketingE2E!2026';
const stamp = 'marketing-e2e';
const dealers = { ops: `${stamp}-ops`, a: `${stamp}-dealer-a`, b: `${stamp}-dealer-b` };
const emails = { ops: `${stamp}-operator@mapco.dev`, a: `${stamp}-a@mapco.dev`, b: `${stamp}-b@mapco.dev` };
const propertyIds = { a: `${stamp}-property-a`, b: `${stamp}-property-b`, fresh: `${stamp}-property-new`, noSlot: `${stamp}-property-noslot` };
const photoA = readFileSync(resolve(root, 'v2/public/assets/mkt-prop-1.jpg'));
const creativeA = readFileSync(resolve(root, 'v2/public/assets/mkt-prop-2.jpg'));
const replacementA = readFileSync(resolve(root, 'v2/public/assets/mapco-logo.png'));
const ok = (label) => process.stdout.write(`PASS ${label}\n`);
const assert = (value, label) => { if (!value) throw new Error(`FAIL ${label}`); ok(label); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const weekStart = (() => { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); })();
const weekId = (() => { const d = new Date(`${weekStart}T00:00:00Z`); const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); const jan4Monday = new Date(jan4); jan4Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7)); const n = 1 + Math.round((d - jan4Monday) / 604800000); return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`; })();

async function removeStoragePrefix(bucket, prefix) {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!data?.length) return;
  const paths = [];
  async function walk(base, rows) {
    for (const row of rows) {
      const path = `${base}/${row.name}`;
      if (row.id) paths.push(path);
      else { const { data: children } = await admin.storage.from(bucket).list(path, { limit: 1000 }); await walk(path, children ?? []); }
    }
  }
  await walk(prefix, data);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

async function cleanup() {
  for (const dealerId of Object.values(dealers)) {
    await removeStoragePrefix('property-photos', dealerId);
    await removeStoragePrefix('marketing-creatives', dealerId);
  }
  await admin.from('crm_records').delete().in('dealer_id', Object.values(dealers));
  await admin.from('dealer_settings').delete().in('dealer_id', Object.values(dealers));
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of data?.users ?? []) if (Object.values(emails).includes(user.email)) await admin.auth.admin.deleteUser(user.id);
}

process.on('uncaughtException', async (error) => {
  console.error(error);
  try { await cleanup(); } catch (cleanupError) { console.error('Cleanup failed', cleanupError); }
  process.exitCode = 1;
});

if (process.argv.includes('--cleanup')) { await cleanup(); ok('temporary MAPCO-DEV marketing fixtures removed'); process.exit(0); }

await cleanup();

async function createActor(key, dealerId, role = 'owner') {
  const { data, error } = await admin.auth.admin.createUser({ email: emails[key], password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('actor create failed');
  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id, email: emails[key], role, dealer_id: dealerId, status: 'active', display_name: key === 'ops' ? 'MAPCO Marketing Operator' : `Dealer ${key.toUpperCase()}`,
  });
  if (profileError) throw profileError;
  return data.user.id;
}

for (const [key, dealerId] of Object.entries(dealers)) {
  const { error } = await admin.from('dealer_settings').insert({
    dealer_id: dealerId, brand_name: key === 'ops' ? 'MAPCO Internal Ops' : `MAPCO E2E Dealer ${key.toUpperCase()}`,
    default_city: 'Mohali', support_phone: key === 'ops' ? null : `+91 90000 0000${key === 'a' ? '1' : '2'}`,
    whatsapp_number: null, subscription_status: 'paid', account_status: 'active', paid: true,
    expiry_date: '2099-01-01T00:00:00Z', storage_enabled: true,
  });
  if (error) throw error;
}

const users = {
  ops: await createActor('ops', dealers.ops),
  a: await createActor('a', dealers.a),
  b: await createActor('b', dealers.b),
};
await admin.from('marketing_internal_operators').insert({ operator_id: users.ops, active: true });
await admin.from('marketing_operator_dealers').insert([
  { operator_id: users.ops, dealer_id: dealers.a }, { operator_id: users.ops, dealer_id: dealers.b },
]);

const photoPathA = `${dealers.a}/${propertyIds.a}/photo-01.jpg`;
await admin.storage.from('property-photos').upload(photoPathA, photoA, { contentType: 'image/jpeg', upsert: true });
const property = (id, dealerId, area, photoPath) => ({
  id, dealer_id: dealerId, entity_type: 'properties', deleted: false,
  payload: { type: 'Residential Plot', want: 'Plot', city: 'Mohali', area, loc: area,
    sector: area, size: '250 sq yd', facing: 'East', position: 'Park facing',
    approvals: ['GMADA'], landmarks: [{ name: 'Airport Road', distance: '3 km', icon: 'ph-road' }],
    price: 0, photos: [], photoStorage: photoPath ? [{ kind: 'storage', id: 'photo-1', path: photoPath }] : [],
    published: true, sold: false, views: 0 },
});
let insert = await admin.from('crm_records').insert([
  property(propertyIds.a, dealers.a, 'Sector 88', photoPathA),
  property(propertyIds.b, dealers.b, 'Aerocity', null),
]);
if (insert.error) throw insert.error;

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error('sign in failed');
  return { client, token: data.session.access_token };
}
async function edge(token, body) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/marketing-ops`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`,
      Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

const operator = await signIn(emails.ops);
const roster = await operator.client.rpc('plotmap_marketing_ops_dealers');
assert(!roster.error && roster.data?.ok === true, 'internal operator roster loads');
assert(roster.data.dealers.length === 2, 'operator sees exactly two assigned dealers');
assert(new Set(roster.data.dealers.map((d) => d.id)).size === 2, 'assigned dealer contexts are distinct');

const inventoryA = await edge(operator.token, { action: 'inventory', dealerId: dealers.a });
assert(inventoryA.response.ok && inventoryA.data.ok, 'assigned dealer inventory broker loads');
assert(inventoryA.data.properties.length === 1 && inventoryA.data.properties[0].id === propertyIds.a, 'inventory is dealer isolated');
assert(inventoryA.data.properties[0].photos[0]?.startsWith('https://'), 'real property photo is returned as signed URL');
const inventoryText = JSON.stringify(inventoryA.data);
assert(!/photoRefs|photoStorage|owner|commission|latitude|longitude|coordinates/i.test(inventoryText), 'inventory pack contains no private fields or storage paths');

const opened = await operator.client.rpc('plotmap_marketing_open_week', {
  p_dealer_id: dealers.a, p_week_id: weekId, p_week_start: weekStart, p_timezone: 'Asia/Kolkata', p_per_day: 4,
});
assert(!opened.error && opened.data?.ok && opened.data.targetCount === 28, 'operator opens the persisted 28-output week');
const openedAgain = await operator.client.rpc('plotmap_marketing_open_week', {
  p_dealer_id: dealers.a, p_week_id: weekId, p_week_start: weekStart, p_timezone: 'Asia/Kolkata', p_per_day: 4,
});
assert(openedAgain.data?.idempotent === true, 'week open is idempotent');

let week = await edge(operator.token, { action: 'week', dealerId: dealers.a, weekId });
assert(week.response.ok && week.data.week.slots.length === 28, 'week reload returns exactly 28 persisted slots');
let slot1 = week.data.week.slots.find((slot) => slot.ref === 'C001');
const caption = 'Real MAPCO E2E caption · Sector 88';
let updated = await operator.client.rpc('plotmap_marketing_update_slot', {
  p_slot_id: slot1.id, p_property_ids: [propertyIds.a], p_caption: caption,
  p_channels: ['instagram', 'facebook_page'], p_note: null,
});
assert(!updated.error && updated.data?.ok, 'operator associates property, caption and channels');

const creativePath = `${dealers.a}/${weekId}/C001/${sha(creativeA)}.jpg`;
let upload = await operator.client.storage.from('marketing-creatives').upload(creativePath, creativeA, { contentType: 'image/jpeg' });
assert(!upload.error, `operator uploads an actual creative to private Storage${upload.error ? ` (${upload.error.message})` : ''}`);
let recorded = await operator.client.rpc('plotmap_marketing_record_result', {
  p_slot_id: slot1.id, p_asset_path: creativePath, p_mime: 'image/jpeg', p_bytes: creativeA.length,
  p_width: null, p_height: null, p_content_hash: sha(creativeA), p_property_ids: [propertyIds.a], p_caption: caption,
});
assert(!recorded.error && recorded.data?.ok, 'uploaded creative is bound to its output slot');
let approved = await operator.client.rpc('plotmap_marketing_approve_slot', { p_slot_id: slot1.id });
assert(!approved.error && approved.data?.state === 'ready_to_publish',
  `approval releases canonical creative and schedule records (${approved.error?.message ?? JSON.stringify(approved.data)})`);
const approvedAgain = await operator.client.rpc('plotmap_marketing_approve_slot', { p_slot_id: slot1.id });
assert(approvedAgain.data?.idempotent === true, 'duplicate approval is idempotent');

const dealerA = await signIn(emails.a);
const feedA = await edge(dealerA.token, { action: 'dealer-feed' });
assert(feedA.response.ok && feedA.data.creatives.length === 1, 'approved creative reaches the correct dealer Marketing screen');
assert(feedA.data.creatives[0].caption === caption && feedA.data.creatives[0].propertyId === propertyIds.a, 'dealer sees persisted caption and property association');
assert(feedA.data.creatives[0].asset.displayUrl.startsWith('https://'), 'dealer receives signed creative media without a storage path');
assert((await fetch(feedA.data.creatives[0].asset.displayUrl)).ok, 'signed dealer creative URL is fetchable');
const freshDealerA = await signIn(emails.a);
const refreshedFeed = await edge(freshDealerA.token, { action: 'dealer-feed' });
assert(refreshedFeed.data.creatives[0]?.caption === caption, 'approved state survives a fresh authenticated session');

const dealerB = await signIn(emails.b);
const feedB = await edge(dealerB.token, { action: 'dealer-feed' });
assert(feedB.response.ok && feedB.data.creatives.length === 0, 'second dealer cannot see first dealer creative');

insert = await admin.from('crm_records').insert(property(propertyIds.fresh, dealers.a, 'Sector 99', null));
if (insert.error) throw insert.error;
const detected1 = await operator.client.rpc('plotmap_marketing_detect_new_properties', { p_dealer_id: dealers.a, p_week_id: weekId });
const detected2 = await operator.client.rpc('plotmap_marketing_detect_new_properties', { p_dealer_id: dealers.a, p_week_id: weekId });
assert(detected1.data?.detected === 1 && detected2.data?.idempotent === true, 'mid-week property detection is persisted and idempotent');
week = await edge(operator.token, { action: 'week', dealerId: dealers.a, weekId });
const action = week.data.newProperties.find((item) => item.propertyId === propertyIds.fresh);
assert(action?.recommendedSlotId, 'new property receives an existing safe slot recommendation');
const assigned = await operator.client.rpc('plotmap_marketing_assign_new_property', { p_action_id: action.id, p_slot_id: action.recommendedSlotId });
assert(assigned.data?.ok, 'operator assigns the new property without creating a slot');
week = await edge(operator.token, { action: 'week', dealerId: dealers.a, weekId });
assert(week.data.week.slots.length === 28, 'new-property handling never creates a 29th slot');

const slot2 = week.data.week.slots.find((slot) => slot.ref === 'C002');
await operator.client.rpc('plotmap_marketing_update_slot', { p_slot_id: slot2.id, p_property_ids: [propertyIds.a], p_caption: 'Replacement test', p_channels: ['instagram'], p_note: null });
const firstReplacePath = `${dealers.a}/${weekId}/C002/${sha(photoA)}.jpg`;
await operator.client.storage.from('marketing-creatives').upload(firstReplacePath, photoA, { contentType: 'image/jpeg' });
recorded = await operator.client.rpc('plotmap_marketing_record_result', { p_slot_id: slot2.id, p_asset_path: firstReplacePath,
  p_mime: 'image/jpeg', p_bytes: photoA.length, p_width: null, p_height: null, p_content_hash: sha(photoA),
  p_property_ids: [propertyIds.a], p_caption: 'Replacement test' });
assert(recorded.data?.ok, 'first version of replaceable slot is stored');
const replacementPath = `${dealers.a}/${weekId}/C002/${sha(replacementA)}.png`;
await operator.client.storage.from('marketing-creatives').upload(replacementPath, replacementA, { contentType: 'image/png' });
recorded = await operator.client.rpc('plotmap_marketing_record_result', { p_slot_id: slot2.id, p_asset_path: replacementPath,
  p_mime: 'image/png', p_bytes: replacementA.length, p_width: null, p_height: null, p_content_hash: sha(replacementA),
  p_property_ids: [propertyIds.a], p_caption: 'Replacement test' });
assert(recorded.data?.ok, 'replacement upload supersedes the prior unapproved asset');
const versions = await admin.from('marketing_creative_results').select('superseded').eq('slot_id', slot2.id);
assert(versions.data?.length === 2 && versions.data.filter((row) => !row.superseded).length === 1, 'replacement keeps exactly one current asset');

const slot3 = week.data.week.slots.find((slot) => slot.ref === 'C003');
const failed = await operator.client.rpc('plotmap_marketing_record_result', { p_slot_id: slot3.id,
  p_asset_path: `${dealers.a}/${weekId}/C003/missing.jpg`, p_mime: 'image/jpeg', p_bytes: 10,
  p_width: null, p_height: null, p_content_hash: 'a'.repeat(64), p_property_ids: [propertyIds.a], p_caption: null });
assert(failed.data?.reason === 'asset_not_found', 'failed upload cannot create a creative record');
const duplicatePath = `${dealers.a}/${weekId}/C003/${sha(replacementA)}.png`;
await operator.client.storage.from('marketing-creatives').upload(duplicatePath, replacementA, { contentType: 'image/png' });
const duplicate = await operator.client.rpc('plotmap_marketing_record_result', { p_slot_id: slot3.id,
  p_asset_path: duplicatePath, p_mime: 'image/png', p_bytes: replacementA.length, p_width: null, p_height: null,
  p_content_hash: sha(replacementA), p_property_ids: [propertyIds.a], p_caption: null });
assert(duplicate.data?.reason === 'duplicate_upload', 'duplicate creative content is rejected across the week');

await admin.from('marketing_output_slots').update({ status: 'ready' }).eq('plan_id', opened.data.planId).in('status', ['waiting','failed']);
insert = await admin.from('crm_records').insert(property(propertyIds.noSlot, dealers.a, 'Sector 101', null));
if (insert.error) throw insert.error;
await operator.client.rpc('plotmap_marketing_detect_new_properties', { p_dealer_id: dealers.a, p_week_id: weekId });
week = await edge(operator.token, { action: 'week', dealerId: dealers.a, weekId });
const noSlotAction = week.data.newProperties.find((item) => item.propertyId === propertyIds.noSlot);
assert(noSlotAction && !noSlotAction.recommendedSlotId, 'new property reports no available safe slot instead of adding output 29');
const protectedAssign = await operator.client.rpc('plotmap_marketing_assign_new_property', { p_action_id: noSlotAction.id, p_slot_id: slot1.id });
assert(protectedAssign.data?.reason === 'protected_or_occupied_slot', 'new-property flow never replaces approved or ready work');

process.stdout.write(`E2E_USERS ${emails.ops} ${emails.a} ${emails.b}\n`);
process.stdout.write(`E2E_WEEK ${weekId}\n`);
if (process.argv.includes('--browser-window')) {
  process.stdout.write('BROWSER_WINDOW_READY · press Enter to clean up (automatic after 10 minutes)\n');
  process.stdin.resume();
  await Promise.race([
    new Promise((resolveReady) => process.stdin.once('data', resolveReady)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 10 * 60 * 1000)),
  ]);
}
await cleanup();
ok('temporary MAPCO-DEV marketing fixtures removed');
