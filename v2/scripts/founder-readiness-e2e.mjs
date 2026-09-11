/* MAPCO-DEV only: real Founder provisioning, device, entitlement and buyer-link
 * verification. Creates one e2e-* tenant and removes it through delete-dealer.
 * Secrets, passwords, tokens and activation codes are never printed. */
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const envPath = process.argv[2] ?? '../supabase/.env';
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/)
  .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
  .map((line) => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2')]; }));
const URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = env.DEMO_PASSWORD;
const ORIGIN = 'http://localhost:5173';
const BUYER_ORIGIN = 'https://mapco-navy.vercel.app';
if (!URL?.includes('lswzrkvdwirhvggtvuch') || !ANON || !SERVICE || !DEMO_PASSWORD) {
  console.error('Refusing to run: a complete MAPCO-DEV environment is required.');
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const browser = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Date.now().toString(36);
const dealerId = `e2e-founder-${run}`;
const email = `${dealerId}@example.test`;
const password = `E2E-${randomBytes(24).toString('base64url')}`;
const propertyId = `${dealerId}-property`;
const foreignId = `${dealerId}-foreign`;
const clientId = `${dealerId}-client`;
const mapId = `${dealerId}-map`;
const overlayId = `${dealerId}-overlay`;
const token = () => randomBytes(32).toString('hex');
let founder;
let founderToken = '';
let provisioned = false;
let authUserId = '';
let passed = 0;
const storagePaths = [];

function check(condition, label, detail = '') {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  passed += 1;
  console.log(`PASS ${label}`);
}
async function rpc(client, name, args = {}) {
  const result = await client.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}
async function founderSession() {
  let user;
  for (let page = 1; !user && page <= 10; page += 1) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (list.error) throw list.error;
    user = list.data.users.find((candidate) => candidate.email?.toLowerCase() === 'rachitchaurasia17@gmail.com');
    if (list.data.users.length < 100) break;
  }
  check(Boolean(user?.email_confirmed_at), 'sole Founder Auth identity exists and is confirmed');
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'rachitchaurasia17@gmail.com' });
  if (link.error) throw link.error;
  const tokenHash = link.data.properties?.hashed_token;
  check(Boolean(tokenHash), 'Founder session challenge generated server-side');
  const client = browser();
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error('Founder session missing');
  founderToken = verified.data.session.access_token;
  check(await rpc(client, 'plotmap_founder_bootstrap') === true
    && await rpc(client, 'plotmap_is_platform_admin') === true,
  'Founder Auth reaches private Founder Control RPCs');
  return client;
}
function parseProvisioning(text) {
  let result;
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.message ?? event.code ?? 'Provisioning failed');
    if (event.type === 'result') result = event.result;
  }
  if (!result?.completed || !/^\d{8}$/.test(result.activationCode ?? '')) throw new Error('Provisioning completion is invalid');
  return result;
}
async function provision() {
  const response = await fetch(`${URL}/functions/v1/provision-dealer`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${founderToken}`, 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Idempotency-Key': `founder-e2e:${run}:${randomUUID()}` },
    body: JSON.stringify({
      dealerId, businessName: `E2E Founder ${run}`, ownerName: 'E2E Owner', ownerPhone: '+919000000001', primaryArea: 'Mohali', loginEmail: email, passcode: password,
      founderContext: { acquisitionSource: 'referral', pitchVersion: 'readiness-e2e', protocolVersion: 'seven-day', buildVersion: 'founder-completion' },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    let failure;
    try { failure = JSON.parse(body); } catch { /* do not log arbitrary response bodies */ }
    throw new Error(`Provisioning HTTP ${response.status}; code=${failure?.code ?? 'unavailable'}; request=${response.headers.get('sb-request-id') ?? 'unavailable'}; allowedOrigin=${response.headers.get('access-control-allow-origin') ?? 'absent'}`);
  }
  const result = parseProvisioning(body);
  provisioned = true;
  const profile = await admin.from('profiles').select('id').eq('dealer_id', dealerId).single();
  if (profile.error) throw profile.error;
  authUserId = profile.data.id;
  const account = await admin.from('dealer_settings').select('trial_start,trial_end,max_devices_allowed,subscription_status').eq('dealer_id', dealerId).single();
  if (account.error) throw account.error;
  check(result.deviceLimit === 4 && account.data.max_devices_allowed === 4, 'browser provisioning defaults to four approved devices');
  check(account.data.subscription_status === 'trial'
    && Math.abs(Date.parse(account.data.trial_end) - Date.parse(account.data.trial_start) - 7 * 86400000) < 5000,
  'trial starts at account creation and lasts seven days');
  return result.activationCode;
}
async function signIn(deviceToken) {
  const client = browser();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session) throw result.error ?? new Error('Dealer session missing');
  return { client, token: deviceToken, session: result.data.session };
}
const access = (device) => rpc(device.client, 'plotmap_dealer_access_status', { p_device_token: device.token });
async function code() {
  const result = await rpc(founder, 'plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  check(/^\d{8}$/.test(result.code ?? ''), 'Founder created a one-time eight-digit device code');
  return result.code;
}
async function activate(device, value, label) {
  const result = await rpc(device.client, 'plotmap_activate_device', { p_access_code: value, p_device_token: device.token, p_device_label: label, p_browser_info: 'Founder readiness verifier' });
  return Array.isArray(result) ? result[0]?.status : result?.status;
}
async function resolveBuyer(value) {
  const response = await fetch(`${URL}/functions/v1/resolve-client-link`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', Origin: BUYER_ORIGIN, 'x-mapco-client': 'v2-web' }, body: JSON.stringify({ token: value }),
  });
  return { response, body: await response.json().catch(() => ({})) };
}
async function cleanup() {
  if (!provisioned || !founderToken) return;
  if (storagePaths.length) await admin.storage.from('property-photos').remove(storagePaths);
  const response = await fetch(`${URL}/functions/v1/delete-dealer`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${founderToken}`, 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ dealer_id: dealerId, confirm: dealerId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(`cleanup failed (${response.status})`);
  if (authUserId) {
    const remaining = await admin.auth.admin.getUserById(authUserId);
    if (!remaining.error && remaining.data.user) throw new Error('cleanup left the disposable Auth user');
  }
  console.log('PASS disposable dealer, Auth identity and tenant data removed');
}

try {
  const preflight = await fetch(`${URL}/functions/v1/provision-dealer`, {
    method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' },
  });
  check(preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === ORIGIN,
    'configured DEV browser origin passes provisioning preflight before any mutation');
  const buyerPreflight = await fetch(`${URL}/functions/v1/resolve-client-link`, {
    method: 'OPTIONS', headers: { Origin: BUYER_ORIGIN, 'Access-Control-Request-Method': 'POST' },
  });
  check(buyerPreflight.status === 204 && buyerPreflight.headers.get('access-control-allow-origin') === BUYER_ORIGIN,
    'configured buyer browser origin passes resolver preflight before any mutation');
  const gate = await admin.from('dealer_device_sessions').select('session_id').limit(1);
  check(!gate.error, 'scoped device migration is present in MAPCO-DEV', gate.error?.message);
  founder = await founderSession();
  const founderAccess = await rpc(founder, 'plotmap_dealer_access_status');
  check(founderAccess.status === 'approved' && founderAccess.founder === true,
    'sole Founder is not dealer-device gated');
  await rpc(founder, 'plotmap_admin_set_dealer_device_limit', {
    p_dealer_id: 'dealer-demo', p_max_devices_allowed: 4,
  });
  const demoAccount = await admin.from('dealer_settings').select('max_devices_allowed').eq('dealer_id', 'dealer-demo').single();
  if (demoAccount.error) throw new Error(`Demo account lookup: ${demoAccount.error.message}`);
  const demoProfile = await admin.from('profiles').select('id').eq('dealer_id', 'dealer-demo').eq('role', 'owner').limit(1).single();
  if (demoProfile.error) throw new Error(`Demo profile lookup: ${demoProfile.error.message}`);
  const demoAuth = await admin.auth.admin.getUserById(demoProfile.data.id);
  const demoEmail = demoAuth.data.user?.email;
  if (demoAuth.error || !demoEmail) throw new Error(`Demo Auth lookup: ${demoAuth.error?.message ?? 'email missing'}`);
  check(demoAccount.data.max_devices_allowed === 4,
    'Founder legitimately normalises the existing demo account to four devices');
  const demo = browser();
  const demoLogin = await demo.auth.signInWithPassword({ email: demoEmail, password: DEMO_PASSWORD });
  check(!demoLogin.error && Boolean(demoLogin.data.session), 'existing dealer email/password login still works');
  const demoDevice = { client: demo, token: token(), session: demoLogin.data.session };
  check((await access(demoDevice)).status === 'device_not_activated',
    'existing dealer login is server-gated on an unapproved browser');
  const firstCode = await provision();

  const mapSeed = await admin.from('prebuilt_maps').insert({
    id: mapId, dealer_id: dealerId, kind: 'sector', city: 'Mohali', sector: 'E2E', area: 'E2E', label: 'E2E map',
    raster: 'https://mapco-navy.vercel.app/assets/ph-map-sector-90.png', dims: {}, assets: {}, status: 'published', client_visible: true, deleted: false,
  });
  const overlaySeed = await admin.from('map_overlays').insert({
    id: overlayId, dealer_id: dealerId, map_id: mapId, name: 'E2E overlay', kind: 'highlight-set', payload: { itemIds: [] }, status: 'published', client_visible: true, deleted: false,
  });
  const recordsSeed = await admin.from('crm_records').insert([
    { id: propertyId, dealer_id: dealerId, entity_type: 'properties', deleted: false, payload: { title: 'E2E exact property', type: 'Residential Plot', city: 'Mohali', area: 'E2E', loc: 'E2E, Mohali', sector: 'E2E', size: '300 sq yd', price: 5000000, photos: [], published: true, clientVisible: true, sold: false, masterplanId: mapId, sectorMapId: mapId, mapPlacement: { mapId, x: 0.25, y: 0.75 } } },
    { id: clientId, dealer_id: dealerId, entity_type: 'clients', deleted: false, payload: { id: clientId, name: 'E2E Buyer', phone: '+919000000002', city: 'Mohali', status: 'active', viewed: [], interest: [], purchased: [] } },
    { id: foreignId, dealer_id: 'dealer-demo', entity_type: 'properties', deleted: false, payload: { title: 'Foreign tenant canary', published: false, clientVisible: false, sold: false } },
  ]);
  if (mapSeed.error || overlaySeed.error || recordsSeed.error) throw mapSeed.error ?? overlaySeed.error ?? recordsSeed.error;

  const first = await signIn(token());
  check((await access(first)).status === 'device_not_activated', 'new authenticated device is blocked pending activation');
  const dealerFounderCommand = await first.client.rpc('plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  check(Boolean(dealerFounderCommand.error), 'normal dealer cannot call Founder device-management commands');
  check(await activate(demoDevice, firstCode, 'Wrong dealer') === 'dealer_inactive',
    'activation code cannot be redeemed by a different dealer');
  await demo.auth.signOut();
  const wrongCode = firstCode === '00000000' ? '99999999' : '00000000';
  const wrongStarted = Date.now();
  check(await activate(first, wrongCode, 'Wrong code') === 'invalid_code', 'wrong activation code is rejected');
  check(Date.now() - wrongStarted >= 200, 'invalid-code attempts retain the server throttle');
  const expireCode = await admin.from('dealer_access_codes').update({
    expires_at: new Date(Date.now() - 60000).toISOString(),
  }).eq('dealer_id', dealerId).eq('status', 'active');
  if (expireCode.error) throw expireCode.error;
  check(await activate(first, firstCode, 'Expired code') === 'expired', 'expired activation code is rejected');
  const hidden = await first.client.from('crm_records').select('id').eq('id', propertyId);
  check(Boolean(hidden.error) || hidden.data.length === 0, 'unapproved session cannot read dealer rows');
  const hiddenOverlay = await first.client.rpc('plotmap_dealer_overlays', { p_map_id: mapId });
  check(Boolean(hiddenOverlay.error) || !Array.isArray(hiddenOverlay.data) || hiddenOverlay.data.length === 0,
    'unapproved session cannot bypass through older SECURITY DEFINER reads');
  const anonActivation = await browser().rpc('plotmap_activate_device', {
    p_access_code: firstCode, p_device_token: token(), p_device_label: 'anon', p_browser_info: 'anon',
  });
  check(Boolean(anonActivation.error), 'anonymous callers cannot redeem activation codes');

  const usableFirstCode = await code();
  check(await activate(first, usableFirstCode, 'Device 1') === 'approved', 'first device activates once');
  const reused = await signIn(token());
  check(await activate(reused, usableFirstCode, 'Reused code') === 'already_used',
    'consumed activation code cannot approve a different device');
  check((await access(reused)).status === 'device_not_activated', 'reused-code device remains blocked');
  check((await access(first)).status === 'approved', 'activated session receives approved access');
  const visible = await first.client.from('crm_records').select('id').eq('id', propertyId);
  check(!visible.error && visible.data.length === 1, 'approved session reads its tenant');
  const overlay = await first.client.rpc('plotmap_dealer_overlays', { p_map_id: mapId });
  check(!overlay.error && overlay.data.some((row) => row.id === overlayId), 'approved session reaches older scoped reads');
  const foreign = await first.client.from('crm_records').select('id').eq('id', foreignId);
  check(!foreign.error && foreign.data.length === 0, 'approved dealer remains isolated from another dealer');
  const foreignWrite = await first.client.from('crm_records').update({ deleted: true }).eq('id', foreignId).select('id');
  check(Boolean(foreignWrite.error) || foreignWrite.data.length === 0, 'cross-dealer writes are denied');
  const ownLimit = await first.client.from('dealer_settings').update({ max_devices_allowed: 5 }).eq('dealer_id', dealerId).select('max_devices_allowed');
  const savedLimit = await admin.from('dealer_settings').select('max_devices_allowed').eq('dealer_id', dealerId).single();
  check((Boolean(ownLimit.error) || ownLimit.data.length === 0) && savedLimit.data?.max_devices_allowed === 4,
    'dealer cannot change their own device limit');
  const privateWorkspace = await first.client.rpc('plotmap_founder_dealer_workspace', { p_dealer_id: dealerId });
  check(Boolean(privateWorkspace.error), 'normal dealer cannot read private Founder data');
  const storagePath = `dealers/${dealerId}/properties/${propertyId}/${randomUUID()}.png`;
  const blockedStorage = await reused.client.storage.from('property-photos').upload(
    `dealers/${dealerId}/properties/${propertyId}/${randomUUID()}.png`,
    Buffer.from('89504e470d0a1a0a', 'hex'), { contentType: 'image/png', upsert: false },
  );
  check(Boolean(blockedStorage.error), 'unapproved session is denied by Storage RLS');
  const allowedStorage = await first.client.storage.from('property-photos').upload(
    storagePath, Buffer.from('89504e470d0a1a0a', 'hex'), { contentType: 'image/png', upsert: false },
  );
  check(!allowedStorage.error, 'approved session passes Storage RLS');
  storagePaths.push(storagePath);
  const located = await first.client.rpc('plotmap_set_property_location', {
    p_property_id: propertyId, p_latitude: 30.7046486, p_longitude: 76.7178726, p_source: 'manually-verified',
  });
  check(!located.error && located.data?.payload?.location?.latitude === 30.7046486,
    'canonical WGS84 location persists through the real RPC');

  const reopenedClient = browser();
  const restored = await reopenedClient.auth.setSession({ access_token: first.session.access_token, refresh_token: first.session.refresh_token });
  if (restored.error) throw restored.error;
  check((await access({ client: reopenedClient, token: first.token })).status === 'approved',
    'refresh/reopen preserves session and device approval');
  await first.client.auth.signOut();
  const relogin = await signIn(first.token);
  check((await access(relogin)).status === 'approved', 'logout/login on the same browser token does not require reactivation');

  const devices = [relogin];
  for (let index = 2; index <= 4; index += 1) {
    const device = await signIn(token());
    check(await activate(device, await code(), `Device ${index}`) === 'approved', `device ${index} activates`);
    check((await access(device)).status === 'approved', `device ${index} binds its authenticated session`);
    devices.push(device);
  }
  const fifth = await signIn(token());
  check((await access(fifth)).status === 'device_not_activated', 'rejected fifth session remains blocked');
  const extraCode = await founder.rpc('plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  check(Boolean(extraCode.error), 'four-device limit prevents issuance of a fifth activation code');

  const workspace = await rpc(founder, 'plotmap_founder_dealer_workspace', { p_dealer_id: dealerId });
  const firstDevice = workspace.devices.find((item) => item.device_label === 'Device 1');
  check(Boolean(firstDevice?.id), 'Founder workspace lists approved devices');
  const selfRevoke = await devices[1].client.rpc('plotmap_admin_set_device_status', {
    p_device_id: firstDevice.id, p_status: 'revoked', p_developer_notes: 'Unauthorized test',
  });
  check(Boolean(selfRevoke.error), 'dealer cannot revoke or replace approved devices');
  await rpc(founder, 'plotmap_admin_set_device_status', {
    p_device_id: firstDevice.id, p_status: 'revoked', p_developer_notes: 'E2E replacement',
  });
  check((await access(relogin)).status === 'device_not_activated', 'Founder revocation blocks a bound session immediately');
  const replacementCode = await code();
  check(await activate(fifth, replacementCode, 'Replacement device') === 'approved',
    'revoked device slot can be replaced');
  const revokedStorage = await relogin.client.storage.from('property-photos').createSignedUrl(storagePath, 60);
  check(Boolean(revokedStorage.error), 'revoked session is immediately denied by Storage RLS');

  const link = await rpc(devices[1].client, 'plotmap_create_client_link', { p_payload: {
    clientId, propertyIds: [propertyId], priceVisibility: 'shown', locationVisibility: 'exact',
    customPrices: { [propertyId]: 4900000 }, expiresInDays: 7, photoSelections: { [propertyId]: [] },
  } });
  check(Boolean(link.token), 'approved dealer creates an exact-location buyer link');
  const resolved = await resolveBuyer(link.token);
  check(resolved.response.ok && resolved.body?.link?.properties?.[0]?.placement?.mapId === mapId,
    'buyer resolver returns the saved map placement', `HTTP ${resolved.response.status}; reason=${resolved.body?.reason ?? 'none'}`);
  const exactRow = await admin.from('crm_records').select('payload').eq('id', propertyId).single();
  check(exactRow.data?.payload?.location?.longitude === 76.7178726,
    'WGS84 location survives a fresh MAPCO-DEV read');

  const trialBefore = await admin.from('trials').select('id').eq('dealer_id', dealerId).single();
  const expired = await admin.from('dealer_settings')
    .update({ trial_end: new Date(Date.now() - 60000).toISOString() }).eq('dealer_id', dealerId);
  if (expired.error) throw expired.error;
  check((await access(devices[1])).status === 'trial_expired', 'trial expiry blocks an approved dealer session');
  const expiredRead = await devices[1].client.from('crm_records').select('id').eq('id', propertyId);
  check(Boolean(expiredRead.error) || expiredRead.data.length === 0, 'expired dealer is denied by row security');
  const linkAfterExpiry = await resolveBuyer(link.token);
  check(linkAfterExpiry.response.ok && linkAfterExpiry.body?.ok === true,
    'existing buyer link remains active after trial expiry');
  await rpc(founder, 'plotmap_founder_set_account', { p_payload: {
    dealerId, action: 'extend_trial', expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
  } });
  check((await access(devices[1])).status === 'approved', 'Founder trial extension restores access immediately');

  await rpc(founder, 'plotmap_founder_set_account', { p_payload: {
    dealerId, action: 'paid', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    plan: 'Manual payment', amountPaise: 100000,
  } });
  const trialAfter = await admin.from('trials').select('id,commercial_outcome').eq('dealer_id', dealerId).single();
  const propertyAfter = await devices[1].client.from('crm_records').select('id').eq('id', propertyId);
  check(trialBefore.data?.id === trialAfter.data?.id && trialAfter.data?.commercial_outcome === 'won'
    && propertyAfter.data?.length === 1, 'manual paid conversion preserves trial identity and dealer data');
  await rpc(founder, 'plotmap_founder_set_account', { p_payload: { dealerId, action: 'suspend' } });
  check((await access(devices[1])).status === 'account_suspended', 'Founder suspension blocks dealer access immediately');
  const suspendedRead = await devices[1].client.from('crm_records').select('id').eq('id', propertyId);
  check(Boolean(suspendedRead.error) || suspendedRead.data.length === 0, 'suspended dealer is denied by row security');
  const linkAfterSuspend = await resolveBuyer(link.token);
  check(linkAfterSuspend.response.ok && linkAfterSuspend.body?.ok === true,
    'existing buyer link remains active after suspension');
  await rpc(founder, 'plotmap_founder_set_account', { p_payload: { dealerId, action: 'resume' } });
  check((await access(devices[1])).status === 'approved', 'Founder resume restores paid access without recreating the tenant');
  const expireLink = await admin.from('share_links').update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq('id', link.id).eq('dealer_id', dealerId);
  if (expireLink.error) throw expireLink.error;
  const expiredLink = await resolveBuyer(link.token);
  check(!expiredLink.response.ok && expiredLink.body?.ok === false, 'buyer link still enforces its own expiry');
  const restoreLinkExpiry = await admin.from('share_links').update({ expires_at: new Date(Date.now() + 86400000).toISOString() }).eq('id', link.id).eq('dealer_id', dealerId);
  if (restoreLinkExpiry.error) throw restoreLinkExpiry.error;
  await rpc(devices[1].client, 'plotmap_revoke_client_link', { p_link_id: link.id });
  const revokedLink = await resolveBuyer(link.token);
  check(!revokedLink.response.ok && revokedLink.body?.ok === false, 'buyer link still enforces its own revocation');
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
  try { await admin.from('crm_records').delete().eq('id', foreignId).eq('dealer_id', 'dealer-demo'); } catch { /* isolated best effort */ }
  console.log(`Founder readiness verification completed with ${passed} passed checks.`);
}
