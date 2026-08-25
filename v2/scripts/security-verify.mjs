#!/usr/bin/env node
/*
 * MAPCO Phase 1 live tenant-isolation verifier (tests A-H).
 *
 * This script uses only the public key plus two ordinary dealer accounts.
 * It deliberately performs hostile writes, so it refuses to run remotely
 * without an exact project-ref acknowledgement. It never accepts a service
 * role key and cleans randomized fixtures in finally blocks.
 */

import { createClient } from '@supabase/supabase-js';

const env = process.env;
const BASE_URL = String(env.MAPCO_SECURITY_TEST_URL || '').replace(/\/$/, '');
const KEY = String(env.MAPCO_SECURITY_TEST_ANON_KEY || '');
const A_EMAIL = String(env.MAPCO_SECURITY_TEST_DEALER_A_EMAIL || '');
const A_PASSWORD = String(env.MAPCO_SECURITY_TEST_DEALER_A_PASSWORD || '');
const B_EMAIL = String(env.MAPCO_SECURITY_TEST_DEALER_B_EMAIL || '');
const B_PASSWORD = String(env.MAPCO_SECURITY_TEST_DEALER_B_PASSWORD || '');
const REMOTE_REF = String(env.MAPCO_SECURITY_TEST_PROJECT_REF || '').trim();
const CONFIRM = String(env.MAPCO_SECURITY_TEST_CONFIRM || '');

function stop(message) {
  console.error(message);
  process.exit(2);
}

function jwtRole(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 3) return '';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.role === 'string' ? payload.role : '';
  } catch {
    return '';
  }
}

if (!BASE_URL || !KEY || !A_EMAIL || !A_PASSWORD || !B_EMAIL || !B_PASSWORD) {
  stop('Missing MAPCO_SECURITY_TEST_URL/ANON_KEY or Dealer A/B test credentials.');
}
if (/^sb_secret_/i.test(KEY) || /service[_-]?role/i.test(KEY) || jwtRole(KEY) === 'service_role') {
  stop('Refusing a secret/service-role key. This verifier must exercise public-client boundaries.');
}

let target;
try { target = new URL(BASE_URL); } catch { stop('MAPCO_SECURITY_TEST_URL is invalid.'); }
const localTarget = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
if (!localTarget) {
  if (!/^[a-z0-9]{8,32}$/i.test(REMOTE_REF)
      || target.hostname !== `${REMOTE_REF}.supabase.co`
      || CONFIRM !== `NON_PRODUCTION:${REMOTE_REF}`) {
    stop('Remote run refused. Set the exact project ref and MAPCO_SECURITY_TEST_CONFIRM=NON_PRODUCTION:<ref>.');
  }
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const anon = createClient(BASE_URL, KEY, clientOptions);
const dealerA = createClient(BASE_URL, KEY, clientOptions);
const dealerB = createClient(BASE_URL, KEY, clientOptions);
const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 18);
const targetPropertyId = `sec-b-target-${runId}`;
const presentationPropertyId = `sec-b-present-${runId}`;
const draftPropertyId = `sec-b-draft-${runId}`;
const soldPropertyId = `sec-b-sold-${runId}`;
const forgedPropertyId = `sec-a-forged-${runId}`;
const safeTitleCanary = `SAFE_PRESENTATION_${runId}`;
const draftTitleCanary = `PRIVATE_DRAFT_${runId}`;
const hiddenTitleCanary = `PRIVATE_HIDDEN_${runId}`;
const soldTitleCanary = `PRIVATE_SOLD_${runId}`;
const privateCanaries = [
  `PRIVATE_SELLER_${runId}`,
  `PRIVATE_COMMISSION_${runId}`,
  `PRIVATE_NOTES_${runId}`,
  `PRIVATE_PRICE_${runId}`,
  `PRIVATE_SECTOR_${runId}`,
  `PRIVATE_PLOT_${runId}`,
  `PRIVATE_LAT_${runId}`,
  `PRIVATE_LNG_${runId}`,
];

const results = [];
function check(label, pass, detail = '') {
  const clean = String(detail || '').replace(/[\r\n]+/g, ' ').slice(0, 240);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}${clean ? ` — ${clean}` : ''}`);
  results.push(Boolean(pass));
  return Boolean(pass);
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`${label} sign-in failed`);
  return data.user;
}

async function dealerIdentity(client, user) {
  const metadataDealer = String(user.app_metadata?.dealer_id || '').trim();
  if (metadataDealer) return metadataDealer;
  const { data, error } = await client.from('profiles').select('dealer_id').eq('id', user.id).maybeSingle();
  if (error || !data?.dealer_id) throw new Error('Active dealer membership could not be resolved');
  return String(data.dealer_id);
}

function privateFieldHits(value, path = '', hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => privateFieldHits(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== 'object') return hits;
  const forbidden = /^(seller(phone|email|contact)?|commission|internal(notes?|status)|negotiation|dealerfinances?|team(info|members?)?|privatecrm|createdby)$/i;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z]/gi, '');
    const childPath = path ? `${path}.${key}` : key;
    if (forbidden.test(normalized)) hits.push(childPath);
    privateFieldHits(child, childPath, hits);
  }
  return hits;
}

function projectionFieldHits(value, path = '', hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => projectionFieldHits(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== 'object') return hits;
  const forbidden = new Set(['price', 'sector', 'plotnumber', 'latitude', 'longitude', 'lat', 'lng', 'exactlocation']);
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z]/gi, '').toLowerCase();
    const childPath = path ? `${path}.${key}` : key;
    if (forbidden.has(normalized)) hits.push(childPath);
    projectionFieldHits(child, childPath, hits);
  }
  return hits;
}

async function removeRecord(client, id) {
  const hard = await client.from('crm_records').delete().eq('id', id);
  if (hard.error) {
    await client.from('crm_records').update({ deleted: true }).eq('id', id);
  }
}

let dealerAId = '';
let dealerBId = '';
const linkIds = new Set();
let storagePath = '';

try {
  const [userA, userB] = await Promise.all([
    signIn(dealerA, A_EMAIL, A_PASSWORD, 'Dealer A'),
    signIn(dealerB, B_EMAIL, B_PASSWORD, 'Dealer B'),
  ]);
  [dealerAId, dealerBId] = await Promise.all([
    dealerIdentity(dealerA, userA),
    dealerIdentity(dealerB, userB),
  ]);
  if (!dealerAId || !dealerBId || dealerAId === dealerBId) {
    throw new Error('Dealer A and Dealer B must belong to distinct organizations');
  }

  const basePayload = {
    title: 'Security isolation fixture', type: 'Residential Plot', propertyType: 'Residential Plot',
    area: 'Security Test Area', size: '100 sq yd', published: true, clientVisible: true,
    photos: ['https://example.com/mapco-security-fixture.jpg'], marker: 'original',
  };
  const presentationPayload = {
    ...basePayload,
    title: safeTitleCanary,
    sellerPhone: privateCanaries[0],
    commission: privateCanaries[1],
    internalNotes: privateCanaries[2],
    price: privateCanaries[3],
    sector: privateCanaries[4],
    plotNumber: privateCanaries[5],
    latitude: privateCanaries[6],
    longitude: privateCanaries[7],
  };
  const fixtures = await dealerB.from('crm_records').insert([
    {
      id: targetPropertyId,
      dealer_id: dealerBId,
      entity_type: 'properties',
      payload: { ...basePayload, title: hiddenTitleCanary, clientVisible: false, internalStatus: 'hidden' },
      deleted: false,
    },
    { id: presentationPropertyId, dealer_id: dealerBId, entity_type: 'properties', payload: presentationPayload, deleted: false },
    {
      id: draftPropertyId,
      dealer_id: dealerBId,
      entity_type: 'properties',
      payload: { ...basePayload, title: draftTitleCanary, published: false },
      deleted: false,
    },
    {
      id: soldPropertyId,
      dealer_id: dealerBId,
      entity_type: 'properties',
      payload: { ...basePayload, title: soldTitleCanary, sold: true },
      deleted: false,
    },
  ]).select('id,dealer_id');
  if (fixtures.error || fixtures.data?.length !== 4) throw new Error('Dealer B fixture setup failed');

  // TEST A: targeted cross-tenant UUID lookup.
  const direct = await dealerA.from('crm_records').select('id').eq('id', targetPropertyId);
  check('TEST A Dealer A cannot query Dealer B property UUID',
    !direct.error && Array.isArray(direct.data) && direct.data.length === 0,
    direct.error?.message || `${direct.data?.length ?? 0} row(s)`);

  // TEST B: caller-forged tenant identifiers must be rejected or overwritten.
  const forged = await dealerA.from('crm_records').insert({
    id: forgedPropertyId,
    dealer_id: dealerBId,
    entity_type: 'properties',
    payload: { ...basePayload, title: 'Forged tenant fixture', published: false, clientVisible: false },
    deleted: false,
  }).select('id,dealer_id');
  const bCanSeeForged = await dealerB.from('crm_records').select('id').eq('id', forgedPropertyId);
  const forgedRejectedOrDerived = Boolean(forged.error)
    || (forged.data?.length === 1 && forged.data[0].dealer_id === dealerAId);
  check('TEST B forged dealer_id is denied or server-derived',
    forgedRejectedOrDerived && !bCanSeeForged.error && bCanSeeForged.data?.length === 0,
    forged.error ? 'request denied' : `stored tenant ${forged.data?.[0]?.dealer_id || 'none'}`);

  // TEST C: cross-tenant UPDATE must affect zero rows and leave the row intact.
  const update = await dealerA.from('crm_records')
    .update({ payload: { ...basePayload, marker: 'tampered-by-a' } })
    .eq('id', targetPropertyId).select('id');
  const afterUpdate = await dealerB.from('crm_records').select('payload').eq('id', targetPropertyId).single();
  check('TEST C Dealer A cannot update Dealer B property',
    (Boolean(update.error) || update.data?.length === 0)
      && afterUpdate.data?.payload?.marker === 'original',
    update.error?.message || `${update.data?.length ?? 0} affected`);

  // TEST E: anonymous CRM access must be denied or project no rows.
  const anonymousCrm = await anon.from('crm_records').select('id').limit(1);
  check('TEST E anonymous CRM query is denied',
    Boolean(anonymousCrm.error) || anonymousCrm.data?.length === 0,
    anonymousCrm.error?.message || `${anonymousCrm.data?.length ?? 0} row(s)`);

  // TEST F: a client token receives only the allowlisted snapshot.
  const created = await dealerB.rpc('plotmap_create_client_link', {
    p_payload: {
      clientId: null,
      propertyIds: [presentationPropertyId],
      photoSelections: { [presentationPropertyId]: ['external:0'] },
      priceVisibility: 'hidden',
      locationVisibility: 'area',
      expiresInDays: 3,
    },
  });
  const linkId = String(created.data?.id || '');
  if (linkId) linkIds.add(linkId);
  const rawToken = String(created.data?.token || '');
  const resolved = rawToken ? await anon.rpc('plotmap_resolve_client_link', { p_token: rawToken }) : { data: null, error: created.error };
  const snapshot = resolved.data?.link;
  const snapshotProperty = Array.isArray(snapshot?.properties) ? snapshot.properties[0] : null;
  const privateHits = privateFieldHits(snapshot);
  const projectionHits = projectionFieldHits(snapshot?.properties);
  const serializedSnapshot = JSON.stringify(snapshot || {});
  const excludedSelections = await Promise.all([
    targetPropertyId,
    draftPropertyId,
    soldPropertyId,
  ].map(async (propertyId) => {
    const attempt = await dealerB.rpc('plotmap_create_client_link', {
      p_payload: {
        clientId: null,
        propertyIds: [propertyId],
        photoSelections: { [propertyId]: ['external:0'] },
        priceVisibility: 'hidden',
        locationVisibility: 'area',
        expiresInDays: 3,
      },
    });
    const accidentalLinkId = String(attempt.data?.id || '');
    if (accidentalLinkId) linkIds.add(accidentalLinkId);
    return Boolean(attempt.error);
  }));
  check('TEST F client presentation excludes dealer-private fields and unrelated rows',
    resolved.data?.ok === true
      && Array.isArray(snapshot?.properties)
      && snapshot.properties.length === 1
      && snapshotProperty?.title === safeTitleCanary
      && snapshotProperty?.id !== presentationPropertyId
      && privateHits.length === 0
      && projectionHits.length === 0
      && privateCanaries.every((canary) => !serializedSnapshot.includes(canary))
      && excludedSelections.every(Boolean)
      && !serializedSnapshot.includes(draftTitleCanary)
      && !serializedSnapshot.includes(hiddenTitleCanary)
      && !serializedSnapshot.includes(soldTitleCanary)
      && !serializedSnapshot.includes(targetPropertyId),
    resolved.error?.message
      || (privateHits.length || projectionHits.length
        ? `forbidden: ${[...privateHits, ...projectionHits].join(',')}`
        : `invalid selections rejected=${excludedSelections.filter(Boolean).length}/3`));

  // TEST G: an ordinary dealer must not invoke platform-owner RPCs.
  const adminAttempt = await dealerA.rpc('plotmap_admin_platform_overview');
  check('TEST G dealer cannot invoke platform-owner RPC',
    Boolean(adminAttempt.error),
    adminAttempt.error?.message || 'unexpected success');

  // TEST H: Dealer A and anon cannot fetch Dealer B's private object.
  storagePath = `dealers/${dealerBId}/properties/${targetPropertyId}/security-${runId}.png`;
  const png = Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ));
  const uploaded = await dealerB.storage.from('property-photos').upload(storagePath, png, {
    contentType: 'image/png', upsert: false,
  });
  if (uploaded.error) throw new Error('Dealer B storage fixture upload failed');
  const [aDownload, anonDownload] = await Promise.all([
    dealerA.storage.from('property-photos').download(storagePath),
    anon.storage.from('property-photos').download(storagePath),
  ]);
  const storageCleanup = await dealerB.storage.from('property-photos').remove([storagePath]);
  check('TEST H cross-tenant and anonymous storage reads are denied',
    Boolean(aDownload.error) && Boolean(anonDownload.error) && !storageCleanup.error,
    `dealerA=${aDownload.error ? 'denied' : 'ALLOWED'}, anon=${anonDownload.error ? 'denied' : 'ALLOWED'}, cleanup=${storageCleanup.error ? 'failed' : 'ok'}`);
  if (storageCleanup.error) throw new Error('Storage fixture cleanup failed; delete test aborted');
  storagePath = '';

  // TEST D is last so even a vulnerable target only destroys a disposable row.
  const deleted = await dealerA.from('crm_records').delete().eq('id', targetPropertyId).select('id');
  const afterDelete = await dealerB.from('crm_records').select('id').eq('id', targetPropertyId).maybeSingle();
  check('TEST D Dealer A cannot delete Dealer B property',
    (Boolean(deleted.error) || deleted.data?.length === 0) && Boolean(afterDelete.data),
    deleted.error?.message || `${deleted.data?.length ?? 0} affected`);
} catch (error) {
  console.error(`Verifier setup/runtime failure: ${error instanceof Error ? error.message : String(error)}`);
  results.push(false);
} finally {
  if (storagePath) {
    try { await dealerB.storage.from('property-photos').remove([storagePath]); } catch { /* best effort */ }
  }
  for (const cleanupLinkId of linkIds) {
    try { await dealerB.rpc('plotmap_revoke_client_link', { p_link_id: cleanupLinkId }); } catch { /* best effort */ }
  }
  await Promise.allSettled([
    removeRecord(dealerB, targetPropertyId),
    removeRecord(dealerB, presentationPropertyId),
    removeRecord(dealerB, draftPropertyId),
    removeRecord(dealerB, soldPropertyId),
    removeRecord(dealerA, forgedPropertyId),
  ]);
  await Promise.allSettled([dealerA.auth.signOut(), dealerB.auth.signOut()]);
}

const passed = results.filter(Boolean).length;
console.log(`\nMAPCO security verification: ${passed}/${results.length} checks passed.`);
if (results.length !== 8 || passed !== 8) process.exit(1);
