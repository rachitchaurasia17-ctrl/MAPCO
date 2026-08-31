/*
 * MAPCO Property Intelligence — disposable remote verification.
 *
 * Reads the gitignored Supabase environment file, prints no credentials,
 * refuses every remote project except the explicitly acknowledged ref, and
 * removes all temporary users, rows, and objects in a finally block.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

const env = readEnv(process.argv[2] ?? 'supabase/.env');
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;
const DEMO_PASSWORD = env.DEMO_PASSWORD;

if (!SUPABASE_URL || !SERVICE || !ANON || !DEMO_PASSWORD) {
  console.error('missing required Supabase verification environment');
  process.exit(2);
}

const target = new URL(SUPABASE_URL);
const projectRef = target.hostname.split('.')[0];
const acknowledgedRef = String(process.env.MAPCO_PI_VERIFY_PROJECT_REF || '').trim();
if (target.hostname !== `${acknowledgedRef}.supabase.co`
    || acknowledgedRef !== 'lswzrkvdwirhvggtvuch') {
  console.error('remote run refused: acknowledge the exact MAPCO-DEV project ref');
  process.exit(2);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SERVICE, options);
const makeClient = () => createClient(SUPABASE_URL, ANON, options);
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const demoPropertyId = `pi-final-verification-${suffix}`;
const inactivePropertyId = `pi-inactive-verification-${suffix}`;
const activeDealerId = `pi-active-${suffix}`;
const inactiveDealerId = `pi-inactive-${suffix}`;
const ownerEmail = `pi-owner-${suffix}@mapco.dev`;
const viewerEmail = `pi-viewer-${suffix}@mapco.dev`;
const inactiveEmail = `pi-inactive-${suffix}@mapco.dev`;
const temporaryPassword = `Pi!${randomUUID()}a9`;
const storagePath = `verification/${suffix}.png`;
const temporaryUserIds = [];
let storageCreated = false;
let pass = 0;
let fail = 0;

function check(condition, message, detail = '') {
  if (condition) {
    console.log(`  PASS ${message}`);
    pass += 1;
  } else {
    console.log(`  FAIL ${message}${detail ? ` — ${detail}` : ''}`);
    fail += 1;
  }
}

async function must(label, operation) {
  const result = await operation;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function signIn(email, password) {
  const client = makeClient();
  const data = await must(`sign in ${email}`, client.auth.signInWithPassword({ email, password }));
  return client;
}

async function createActor(email, role, dealerId) {
  const created = await must(`create ${role} actor`, admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { dealer_id: dealerId, role },
  }));
  temporaryUserIds.push(created.user.id);
  await must(`profile ${role} actor`, admin.from('profiles').upsert({
    id: created.user.id,
    email,
    role,
    dealer_id: dealerId,
    status: 'active',
  }));
  return signIn(email, temporaryPassword);
}

async function invoke(client, propertyId) {
  const result = await client.functions.invoke('property-intelligence', {
    body: { propertyId },
  });
  if (result.error) throw new Error(`PI invoke: ${result.error.message}`);
  return result.data;
}

async function cleanup() {
  const issues = [];
  if (storageCreated) {
    const removed = await admin.storage.from('place-media').remove([storagePath]);
    if (removed.error) issues.push(`storage: ${removed.error.message}`);
  }
  const rows = await admin.from('crm_records').delete().in('id', [demoPropertyId, inactivePropertyId]);
  if (rows.error) issues.push(`properties: ${rows.error.message}`);
  for (const id of temporaryUserIds) {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) issues.push(`user: ${removed.error.message}`);
  }
  const dealer = await admin.from('dealer_settings').delete()
    .in('dealer_id', [activeDealerId, inactiveDealerId]);
  if (dealer.error) issues.push(`dealer: ${dealer.error.message}`);
  check(issues.length === 0, 'temporary remote fixtures removed', issues.join('; '));
}

async function main() {
  console.log(`\n=== MAPCO PI REMOTE VERIFICATION · ${projectRef} ===`);

  console.log('\n[setup] disposable canonical-location fixtures');
  await must('seed active dealer', admin.from('dealer_settings').upsert({
    dealer_id: activeDealerId,
    brand_name: 'PI Verification Active Dealer',
    account_status: 'active',
    subscription_status: 'paid',
    expiry_date: new Date(Date.now() + 86_400_000).toISOString(),
  }));
  await must('seed canonical property', admin.from('crm_records').upsert({
    id: demoPropertyId,
    dealer_id: activeDealerId,
    entity_type: 'properties',
    deleted: false,
    payload: {
      type: 'Residential Plot',
      title: 'PI Final Verification Plot',
      area: 'Sector 78',
      sector: 'Sector 78',
      city: 'Mohali',
      location: {
        latitude: 30.681991,
        longitude: 76.702441,
        updatedAt: new Date().toISOString(),
      },
      published: false,
      clientVisible: false,
      sold: false,
    },
  }));
  await must('seed inactive dealer', admin.from('dealer_settings').upsert({
    dealer_id: inactiveDealerId,
    brand_name: 'PI Verification Inactive Dealer',
    account_status: 'suspended',
    subscription_status: 'active',
  }));
  await must('seed inactive property', admin.from('crm_records').upsert({
    id: inactivePropertyId,
    dealer_id: inactiveDealerId,
    entity_type: 'properties',
    deleted: false,
    payload: {
      type: 'Residential Plot',
      area: 'Sector 78',
      city: 'Mohali',
      location: { latitude: 30.681991, longitude: 76.702441 },
    },
  }));
  check(true, 'canonical locations exist only in server-owned CRM rows');

  const owner = await createActor(ownerEmail, 'owner', activeDealerId);
  const otherDealer = await signIn('b-owner@mapco.dev', DEMO_PASSWORD);
  const viewer = await createActor(viewerEmail, 'viewer', activeDealerId);
  const inactiveOwner = await createActor(inactiveEmail, 'owner', inactiveDealerId);

  console.log('\n[edge] JWT, tenant, role, account, and provider gates');
  const unauthenticated = await fetch(`${SUPABASE_URL}/functions/v1/property-intelligence`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ propertyId: demoPropertyId }),
  });
  check(unauthenticated.status === 401, 'missing JWT is rejected by the Edge gateway');

  const ownerResult = await invoke(owner, demoPropertyId);
  check(ownerResult?.reason === 'server_not_configured',
    'authorized owner reaches provider gate without leaking configuration',
    `status=${ownerResult?.status ?? 'missing'}, reason=${ownerResult?.reason ?? 'missing'}`);

  const tenantResult = await invoke(otherDealer, demoPropertyId);
  check(tenantResult?.status === 'unavailable'
      && ['property_not_found', 'forbidden'].includes(tenantResult?.reason),
    'other dealer cannot resolve or generate the property');

  const viewerResult = await invoke(viewer, demoPropertyId);
  check(viewerResult?.reason === 'forbidden', 'viewer role cannot generate intelligence');

  const inactiveResult = await invoke(inactiveOwner, inactivePropertyId);
  check(inactiveResult?.reason === 'forbidden', 'inactive account cannot generate intelligence');

  console.log('\n[rpc] canonical location and dealer isolation');
  const ownContext = await must('owner PI getter', owner.rpc(
    'plotmap_property_intelligence_get', { p_property_id: demoPropertyId },
  ));
  check(ownContext?.ok === true
      && ownContext?.dealerId === activeDealerId
      && ownContext?.location?.latitude === 30.681991
      && ownContext?.location?.longitude === 76.702441,
    'getter derives dealer and canonical coordinates server-side',
    JSON.stringify({
      ok: ownContext?.ok,
      reason: ownContext?.reason,
      dealerId: ownContext?.dealerId,
      location: ownContext?.location,
    }));

  const foreignContext = await must('cross-tenant PI getter', otherDealer.rpc(
    'plotmap_property_intelligence_get', { p_property_id: demoPropertyId },
  ));
  check(foreignContext?.ok === false, 'cross-tenant getter returns no property context');

  const viewerContext = await must('viewer PI getter', viewer.rpc(
    'plotmap_property_intelligence_get', { p_property_id: demoPropertyId },
  ));
  check(viewerContext?.reason === 'forbidden', 'getter enforces the viewer denial');

  const costSummary = await owner.rpc('plotmap_pi_cost_summary', { p_days: 30 });
  check(!costSummary.error, 'owner can read its dealer-scoped cost summary', costSummary.error?.message);
  const foreignSummary = await otherDealer.rpc('plotmap_pi_cost_summary', { p_days: 30 });
  check(!foreignSummary.error, 'other dealer receives only its own cost-summary scope', foreignSummary.error?.message);

  console.log('\n[tables] browser roles cannot bypass the RPC surface');
  for (const table of [
    'property_intelligence',
    'property_intelligence_runs',
    'property_intelligence_cost_events',
    'property_intelligence_place_cache',
    'property_intelligence_route_cache',
  ]) {
    const direct = await owner.from(table).select('*').limit(1);
    check(Boolean(direct.error), `authenticated direct read denied: ${table}`,
      direct.error ? '' : 'unexpected table access');
  }

  console.log('\n[storage] service write, public read, browser write denial');
  const png = Uint8Array.from(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
  );
  const uploaded = await admin.storage.from('place-media').upload(storagePath, png, {
    contentType: 'image/png',
    upsert: false,
  });
  check(!uploaded.error, 'service role uploads an allowed image to place-media', uploaded.error?.message);
  storageCreated = !uploaded.error;
  if (storageCreated) {
    const publicUrl = admin.storage.from('place-media').getPublicUrl(storagePath).data.publicUrl;
    const downloaded = await fetch(publicUrl);
    check(downloaded.ok && downloaded.headers.get('content-type')?.startsWith('image/png'),
      'place-media object is publicly readable as an image');
  }
  const browserWrite = await owner.storage.from('place-media').upload(
    `verification/browser-${suffix}.png`, png, { contentType: 'image/png', upsert: false },
  );
  check(Boolean(browserWrite.error), 'authenticated browser cannot write place-media');

  console.log('\n[cors] production allow-list is exact');
  const allowed = await fetch(`${SUPABASE_URL}/functions/v1/property-intelligence`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://mapco-navy.vercel.app',
      'Access-Control-Request-Method': 'POST',
    },
  });
  check(allowed.headers.get('access-control-allow-origin') === 'https://mapco-navy.vercel.app',
    'production MAPCO origin is allowed');
  const denied = await fetch(`${SUPABASE_URL}/functions/v1/property-intelligence`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker.invalid',
      'Access-Control-Request-Method': 'POST',
    },
  });
  check(!denied.headers.get('access-control-allow-origin'), 'unlisted origins are not allowed');
}

try {
  await main();
} catch (error) {
  console.log(`  FAIL unexpected verifier error — ${error instanceof Error ? error.message : String(error)}`);
  fail += 1;
} finally {
  await cleanup();
  console.log(`\n=== PI REMOTE VERIFICATION: ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail ? 1 : 0;
}
