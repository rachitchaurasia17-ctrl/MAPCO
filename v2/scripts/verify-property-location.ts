/*
 * MAPCO-DEV canonical Property.location live verification.
 *
 * Uses temporary, clearly synthetic rows and removes them in finally. It never
 * assigns a guessed coordinate to real inventory. Secrets come only from the
 * gitignored supabase/.env file and are never printed.
 *
 * Run from v2/: npx vite-node scripts/verify-property-location.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDataAdapter } from '../src/packages/data/supabase/supabase-adapter';
import { getSupabase, readEnv } from '../src/packages/data/supabase/client';

const MAPCO_DEV_REF = 'lswzrkvdwirhvggtvuch';
const LEGACY_PROPERTY_REF = 'czmkfmkmgqlienmdihul';
const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '..', 'supabase', '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const URL = env.SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;
const PASSWORD = env.DEMO_PASSWORD;
if (!URL || !SERVICE || !ANON || !PASSWORD) throw new Error('MAPCO-DEV verification credentials unavailable');
if (!URL.includes(MAPCO_DEV_REF) || URL.includes(LEGACY_PROPERTY_REF)) {
  throw new Error('Refusing to verify a Supabase project other than MAPCO-DEV');
}
const browserEnv = readEnv();
if (!browserEnv?.url.includes(MAPCO_DEV_REF) || browserEnv.url.includes(LEGACY_PROPERTY_REF)) {
  throw new Error('Vite browser configuration is not MAPCO-DEV');
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = Date.now().toString(36);
const dealerAPropertyId = `verify-location-a-${runId}`;
const dealerBPropertyId = `verify-location-b-${runId}`;
const exact = { latitude: 30.6889123456789, longitude: 76.7361123456789 };
let passed = 0;

function pass(message: string): void {
  console.log(`PASS ${message}`);
  passed++;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL ${message}`);
  pass(message);
}

function client(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureActor(email: string, dealerId: string): Promise<void> {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find((candidate) => candidate.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { dealer_id: dealerId, role: 'owner' },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error('Could not create verification user');
    user = created.data.user;
  }
  const profile = await admin.from('profiles').upsert({
    id: user.id,
    email,
    dealer_id: dealerId,
    role: 'owner',
    status: 'active',
  });
  if (profile.error) throw profile.error;
}

function payload(label: string): Record<string, unknown> {
  return {
    type: 'Residential Plot',
    want: 'Plot',
    city: 'Verification',
    area: label,
    loc: label,
    sector: label,
    size: 'test-only',
    facing: 'East',
    position: 'test-only',
    approvals: [],
    landmarks: [],
    price: 0,
    photos: [],
    published: false,
    sold: false,
    views: 0,
  };
}

async function signIn(supabase: SupabaseClient, email: string): Promise<void> {
  const result = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (result.error || !result.data.session) throw result.error ?? new Error(`No session for ${email}`);
}

async function main(): Promise<void> {
  await ensureActor('demo-owner@mapco.dev', 'dealer-demo');
  await ensureActor('b-owner@mapco.dev', 'dealer-b');

  const seeded = await admin.from('crm_records').upsert([
    { id: dealerAPropertyId, dealer_id: 'dealer-demo', entity_type: 'properties', deleted: false, payload: payload('Canonical location verification A') },
    { id: dealerBPropertyId, dealer_id: 'dealer-b', entity_type: 'properties', deleted: false, payload: payload('Canonical location verification B') },
  ]);
  if (seeded.error) throw seeded.error;

  const appClient = await getSupabase();
  if (!appClient) throw new Error('MAPCO Supabase browser client is unavailable');
  await signIn(appClient, 'demo-owner@mapco.dev');

  const adapter = new SupabaseDataAdapter();
  const written = await adapter.properties.setLocation(dealerAPropertyId, {
    ...exact,
    source: 'manually-verified',
  });
  assert(written.ok, 'PropertyRepository.setLocation persisted through the real Supabase adapter');
  if (!written.ok) return;
  assert(written.value.location?.latitude === exact.latitude, 'latitude precision round-tripped exactly');
  assert(written.value.location?.longitude === exact.longitude, 'longitude precision round-tripped exactly');
  assert(written.value.location?.source === 'manually-verified', 'location provenance persisted');
  assert(Boolean(written.value.location?.updatedAt), 'location update timestamp persisted');

  const freshOwner = client();
  await signIn(freshOwner, 'demo-owner@mapco.dev');
  const freshRead = await freshOwner.from('crm_records').select('id,payload').eq('id', dealerAPropertyId).maybeSingle();
  assert(!freshRead.error && freshRead.data?.payload?.location?.latitude === exact.latitude,
    'a fresh authenticated session read the persisted latitude');
  assert(freshRead.data?.payload?.location?.longitude === exact.longitude,
    'a fresh authenticated session read the persisted longitude');

  const dealerB = client();
  await signIn(dealerB, 'b-owner@mapco.dev');
  const bReadA = await dealerB.from('crm_records').select('id').eq('id', dealerAPropertyId);
  assert(!bReadA.error && (bReadA.data ?? []).length === 0, 'dealer B cannot read dealer A location row');
  const bWriteA = await dealerB.rpc('plotmap_set_property_location', {
    p_property_id: dealerAPropertyId,
    p_latitude: exact.latitude,
    p_longitude: exact.longitude,
    p_source: 'dealer-selected',
  });
  assert(!bWriteA.error && bWriteA.data?.id !== dealerAPropertyId,
    'dealer B receives no dealer A row from a cross-tenant update');
  const afterBWrite = await freshOwner.from('crm_records').select('payload').eq('id', dealerAPropertyId).single();
  assert(afterBWrite.data?.payload?.location?.source === 'manually-verified',
    'dealer B cannot update dealer A location row');

  const aReadB = await freshOwner.from('crm_records').select('id').eq('id', dealerBPropertyId);
  assert(!aReadB.error && (aReadB.data ?? []).length === 0, 'dealer A cannot read dealer B location row');
  const aWriteB = await freshOwner.rpc('plotmap_set_property_location', {
    p_property_id: dealerBPropertyId,
    p_latitude: exact.latitude,
    p_longitude: exact.longitude,
    p_source: 'dealer-selected',
  });
  assert(!aWriteB.error && aWriteB.data?.id !== dealerBPropertyId,
    'dealer A receives no dealer B row from a cross-tenant update');
  const afterAWrite = await dealerB.from('crm_records').select('payload').eq('id', dealerBPropertyId).single();
  assert(!afterAWrite.data?.payload?.location, 'dealer A cannot update dealer B location row');

  const bOwnWrite = await dealerB.rpc('plotmap_set_property_location', {
    p_property_id: dealerBPropertyId,
    p_latitude: exact.latitude,
    p_longitude: exact.longitude,
    p_source: 'dealer-selected',
  });
  assert(!bOwnWrite.error && bOwnWrite.data?.payload?.location?.latitude === exact.latitude,
    'authenticated dealer can update its own property location');

  const anonymous = client();
  const anonWrite = await anonymous.rpc('plotmap_set_property_location', {
    p_property_id: dealerAPropertyId,
    p_latitude: exact.latitude,
    p_longitude: exact.longitude,
    p_source: 'dealer-selected',
  });
  assert(Boolean(anonWrite.error), 'anonymous location write is denied');

  const invalid = await admin.from('crm_records').update({
    payload: { ...payload('Invalid coordinate constraint check'), location: { latitude: 91, longitude: 76 } },
  }).eq('id', dealerAPropertyId);
  assert(Boolean(invalid.error), 'database constraint rejects out-of-range coordinates');

  const safeRows = await admin.from('client_safe_properties').select('*').limit(50);
  if (safeRows.error) throw safeRows.error;
  const safeJson = JSON.stringify(safeRows.data ?? []);
  assert(!/"location"|"latitude"|"longitude"/i.test(safeJson),
    'public client-safe property projection excludes raw coordinates');

  const migrated = await admin.from('crm_records')
    .select('id,payload')
    .in('id', ['p1', 'p2', 'p3', 'p4', 'p5'])
    .eq('entity_type', 'properties');
  if (migrated.error) throw migrated.error;
  const migratedCount = (migrated.data ?? []).filter((row) => row.payload?.location?.source === 'migrated').length;
  console.log(`MIGRATED_ROWS=${migratedCount}`);
  console.log(`PASS ${passed}/${passed} canonical location live checks`);
}

try {
  await main();
} catch (error) {
  const detail = error as { message?: string; code?: string; details?: string };
  console.error(`FAIL ${detail.message ?? 'canonical location live verification failed'}`);
  if (detail.code) console.error(`CODE ${detail.code}`);
  if (detail.details) console.error(`DETAIL ${detail.details}`);
  process.exitCode = 1;
} finally {
  await admin.from('crm_records').delete().in('id', [dealerAPropertyId, dealerBPropertyId]);
}
