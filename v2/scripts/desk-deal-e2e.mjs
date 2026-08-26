#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO Desk — live end-to-end journey + cross-dealer isolation
   ---------------------------------------------------------------
   Runs the real dealer workflow against MAPCO-DEV through the same
   authenticated paths the browser uses (anon key + a signed-in user,
   RLS enforced), then repeats it adversarially as a SECOND dealer to
   prove isolation.

   The service-role key is used ONLY to provision and tear down the
   two throwaway test dealers. Every business assertion runs on an
   ordinary authenticated session, so nothing here can pass because a
   privileged key bypassed a policy.

   Usage (never commit the keys):
     SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... \
       node scripts/desk-deal-e2e.mjs

   Test data is removed on exit, including after a failure.
   ═══════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

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

const stamp = Date.now();
const results = [];
let failures = 0;

function check(name, condition, detail = '') {
  const passed = !!condition;
  if (!passed) failures++;
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return passed;
}

const rid = (p) => `${p}-e2e-${stamp}-${Math.random().toString(36).slice(2, 7)}`;

/* ── provisioning (service role) ─────────────────────────────── */

const dealers = [];

async function provisionDealer(tag) {
  const dealerId = `dealer-e2e-${tag}-${stamp}`;
  const email = `mapco-e2e-${tag}-${stamp}@example.invalid`;
  const password = `Ee2e!${Math.random().toString(36).slice(2, 12)}Aa1`;

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw new Error(`createUser(${tag}): ${userErr.message}`);
  const userId = created.user.id;

  const expiry = new Date(Date.now() + 30 * 864e5).toISOString();
  const { error: dsErr } = await admin.from('dealer_settings').upsert({
    dealer_id: dealerId, brand_name: `E2E ${tag}`, default_city: 'Mohali',
    subscription_status: 'active', account_status: 'active', expiry_date: expiry,
    storage_enabled: true,
  });
  if (dsErr) throw new Error(`dealer_settings(${tag}): ${dsErr.message}`);

  const { error: pErr } = await admin.from('profiles').upsert({
    id: userId, email, role: 'owner', dealer_id: dealerId, status: 'active',
  });
  if (pErr) throw new Error(`profiles(${tag}): ${pErr.message}`);

  const session = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await session.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${tag}): ${signInErr.message}`);

  const record = { tag, dealerId, email, password, userId, session };
  dealers.push(record);
  return record;
}

/* ── cleanup ─────────────────────────────────────────────────── */

async function cleanup() {
  for (const d of dealers) {
    try { await d.session.auth.signOut(); } catch { /* best effort */ }
    for (const table of ['desk_deal_documents', 'desk_deal_payments', 'desk_deal_stage_events',
      'desk_property_documents', 'desk_property_sellers', 'desk_sellers',
      'crm_records', 'audit_logs', 'presentation_events']) {
      try { await admin.from(table).delete().eq('dealer_id', d.dealerId); } catch { /* best effort */ }
    }
    try { await admin.from('profiles').delete().eq('id', d.userId); } catch { /* best effort */ }
    try { await admin.from('dealer_settings').delete().eq('dealer_id', d.dealerId); } catch { /* best effort */ }
    try { await admin.auth.admin.deleteUser(d.userId); } catch { /* best effort */ }
  }
}

/* ── the dealer journey ──────────────────────────────────────── */

async function journey(A) {
  const db = A.session;
  const ids = {
    seller: rid('seller'), property: rid('prop'), client: rid('client'),
  };

  /* 1–2. Seller, then property. */
  const { error: sellerErr } = await db.from('desk_sellers').insert({
    id: ids.seller, dealer_id: A.dealerId, name: 'E2E Seller',
    primary_phone: '+91 90000 00001', seller_type: 'individual', city: 'Mohali',
  });
  check('1. Seller created', !sellerErr, sellerErr?.message);

  const { error: propErr } = await db.from('crm_records').insert({
    id: ids.property, entity_type: 'properties', dealer_id: A.dealerId, deleted: false,
    payload: {
      id: ids.property, type: 'Residential Plot', want: 'Plot', city: 'Mohali',
      area: 'E2E Enclave', loc: 'E2E Enclave, Mohali', sector: '91', size: '300 sq yd',
      facing: 'East', position: 'Corner plot', approvals: ['GMADA'], landmarks: [],
      price: 9000000, photos: [], published: false, sold: false, lifecycle: 'draft',
      views: 0,
      specs: { frontage: '30', depth: '75', corner: true, openSides: 'Two side' },
    },
  });
  check('2. Property added as a draft', !propErr, propErr?.message);

  /* 3. Adaptive specifications survive the write. */
  const { data: specRow } = await db.from('crm_records')
    .select('payload').eq('id', ids.property).single();
  check('3. Adaptive specifications persisted',
    specRow?.payload?.specs?.frontage === '30' && specRow?.payload?.specs?.corner === true,
    JSON.stringify(specRow?.payload?.specs ?? null));

  /* 4. Seller attached with property-specific facts. */
  const { data: assign } = await db.rpc('plotmap_assign_property_seller', {
    p_payload: {
      propertyId: ids.property, sellerId: ids.seller, askingPrice: 8800000,
      relationship: 'owner', availability: 'available',
      lastConfirmedAt: new Date().toISOString(),
      siteVisitInstructions: 'Call before 6pm',
      documentKinds: ['Registry / Sale Deed', 'Jamabandi / Fard'],
      isPrimary: true,
    },
  });
  check('4. Seller attached with property-specific facts', assign?.ok === true, assign?.reason);
  check('4b. Paper multi-select persisted on the relationship',
    Array.isArray(assign?.relationship?.document_kinds)
    && assign.relationship.document_kinds.length === 2,
    JSON.stringify(assign?.relationship?.document_kinds));

  /* 4c–4f. Reusable seller: the SAME seller on a second property. */
  const secondProp = rid('prop2');
  await db.from('crm_records').insert({
    id: secondProp, entity_type: 'properties', dealer_id: A.dealerId, deleted: false,
    payload: { id: secondProp, type: 'Flat', want: 'Flat', city: 'Mohali', area: 'E2E Heights',
      loc: 'E2E Heights, Mohali', sector: '94', size: '1650 sq ft', facing: 'West',
      position: 'Inside', approvals: [], landmarks: [], price: 6500000, photos: [],
      published: true, sold: false, lifecycle: 'on-sale', views: 0 },
  });
  const { data: assign2 } = await db.rpc('plotmap_assign_property_seller', {
    p_payload: { propertyId: secondProp, sellerId: ids.seller, askingPrice: 6300000,
      relationship: 'authorized-seller', availability: 'unconfirmed', isPrimary: true },
  });
  check('4c. Same seller reused on a second property', assign2?.ok === true, assign2?.reason);

  const { data: sellerRows } = await db.from('desk_sellers').select('id').eq('id', ids.seller);
  check('4d. Reuse did not duplicate the seller record',
    (sellerRows ?? []).length === 1, `rows=${(sellerRows ?? []).length}`);

  const { data: directory } = await db.rpc('plotmap_seller_directory', { p_include_archived: false });
  const dirRow = (directory ?? []).find((r) => r.id === ids.seller);
  check('4e. Seller directory read model reports canonical counts',
    dirRow?.live_count === 2 && dirRow?.sold_count === 0,
    `live=${dirRow?.live_count} sold=${dirRow?.sold_count}`);

  const { data: sellerWs } = await db.rpc('plotmap_seller_workspace', { p_seller_id: ids.seller });
  check('4f. Seller workspace returns both properties with private facts',
    sellerWs?.ok === true && (sellerWs.properties ?? []).length === 2
    && (sellerWs.properties ?? []).some((p) => p.relationship?.site_visit_instructions === 'Call before 6pm'),
    `properties=${(sellerWs?.properties ?? []).length}`);

  /* 4g. Archiving is refused while the seller still holds live inventory. */
  const { data: badArchive } = await db.rpc('plotmap_set_seller_archived', {
    p_payload: { sellerId: ids.seller, archived: true },
  });
  check('4g. Archive refused while the seller holds active properties',
    badArchive?.ok === false && /active propert/i.test(String(badArchive?.reason)),
    badArchive?.reason);
  ids.secondProperty = secondProp;

  /* 6–7. Canonical location, then On Sale. */
  const { data: located } = await db.rpc('plotmap_set_property_location', {
    p_property_id: ids.property, p_latitude: 30.7046, p_longitude: 76.7179,
    p_source: 'dealer-selected',
  }).then((r) => r, () => ({ data: null }));
  check('6. Canonical Earth location saved', located !== null && located !== undefined,
    'plotmap_set_property_location');

  const onSale = { ...specRow.payload, lifecycle: 'on-sale', published: true, clientVisible: true };
  const { error: saleErr } = await db.from('crm_records')
    .update({ payload: onSale }).eq('id', ids.property);
  check('7. Property moved to On Sale', !saleErr, saleErr?.message);

  /* 7b. Off-market and back, without losing specifications or media. */
  const { data: beforeArchive } = await db.from('crm_records')
    .select('payload').eq('id', ids.property).single();
  await db.from('crm_records')
    .update({ payload: { ...beforeArchive.payload, lifecycle: 'archived', published: false, clientVisible: false } })
    .eq('id', ids.property);
  const { data: archived } = await db.from('crm_records')
    .select('payload').eq('id', ids.property).single();
  check('7b. Property can go Off Market', archived?.payload?.lifecycle === 'archived');
  check('7c. Specifications survive going off market',
    archived?.payload?.specs?.frontage === '30');

  await db.from('crm_records')
    .update({ payload: { ...archived.payload, lifecycle: 'on-sale', published: true, clientVisible: true } })
    .eq('id', ids.property);
  const { data: restored } = await db.from('crm_records')
    .select('payload').eq('id', ids.property).single();
  check('7d. Property returns to On Sale intact',
    restored?.payload?.lifecycle === 'on-sale' && restored?.payload?.specs?.corner === true);

  /* 7e. The lifecycle constraint refuses incomplete active inventory. */
  const incomplete = rid('prop-incomplete');
  const { error: incompleteErr } = await db.from('crm_records').insert({
    id: incomplete, entity_type: 'properties', dealer_id: A.dealerId, deleted: false,
    payload: { id: incomplete, type: 'Flat', city: 'Mohali', area: '', size: '',
      facing: '', position: '', lifecycle: 'on-sale' },
  });
  check('7e. An incomplete property is refused as active inventory',
    !!incompleteErr, incompleteErr ? incompleteErr.code : 'accepted — constraint missing');

  /* 10. Client. */
  const { error: clientErr } = await db.from('crm_records').insert({
    id: ids.client, entity_type: 'clients', dealer_id: A.dealerId, deleted: false,
    payload: {
      id: ids.client, name: 'E2E Buyer', phone: '+91 90000 00002', city: 'Mohali',
      want: 'Plot', budget: '₹80L–1 Cr', budgetMax: 10000000, status: 'active',
      seen: '', note: '', viewed: [], interest: [], purchased: [],
    },
  });
  check('10. Client created', !clientErr, clientErr?.message);

  /* 16. Start the deal from the canonical client + property. */
  const { data: started } = await db.rpc('plotmap_start_deal', {
    p_payload: {
      propertyId: ids.property, buyerId: ids.client, stage: 'negotiating', value: 9200000,
      commission: {
        buyer: { mode: 'pct', percent: 1 },
        seller: { mode: 'fixed', fixed: 50000 },
      },
      nextAction: { kind: 'Call buyer', note: 'Confirm the price', dueOn: '2026-08-28' },
    },
  });
  check('16. Deal started on the canonical client + property', started?.ok === true, started?.reason);
  const dealId = started?.deal?.id;
  if (!dealId) throw new Error('cannot continue without a deal');

  check('16b. Deal inherited the seller through the property',
    started.deal.sellerId === ids.seller, `sellerId=${started.deal.sellerId}`);

  /* Re-issuing the same start must not create a second deal. */
  const { data: again } = await db.rpc('plotmap_start_deal', {
    p_payload: { propertyId: ids.property, buyerId: ids.client },
  });
  check('16c. Repeat start reuses the open deal instead of duplicating',
    again?.ok === true && again?.idempotent === true && again?.deal?.id === dealId);

  /* 17–18. Negotiating → Token, then record the token. */
  const { data: toToken } = await db.rpc('plotmap_set_deal_stage', {
    p_payload: { dealId, stage: 'token', tokenDate: '2026-08-26', note: 'Token agreed' },
  });
  check('17. Deal moved Negotiating → Token', toToken?.ok === true, toToken?.reason);

  const { data: token } = await db.rpc('plotmap_record_deal_payment', {
    p_payload: { dealId, kind: 'token', amount: 500000, receivedOn: '2026-08-26', note: 'RTGS' },
  });
  check('18. Token recorded', token?.ok === true, token?.reason);

  /* 19. Property papers appear in the deal automatically. */
  const paperId = rid('doc');
  const { error: paperErr } = await db.from('desk_property_documents').insert({
    id: paperId, dealer_id: A.dealerId, property_id: ids.property, title: 'Jamabandi / fard',
    document_type: 'other',
    storage_path: `dealers/${A.dealerId}/properties/${ids.property}/documents/${paperId}.pdf`,
    mime_type: 'application/pdf', size_bytes: 2048,
  });
  check('19a. Property paper stored', !paperErr, paperErr?.message);

  const { data: ws1 } = await db.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
  check('19b. Property papers appear inside the deal automatically',
    ws1?.ok === true && (ws1.propertyPapers ?? []).some((p) => p.title === 'Jamabandi / fard'));
  check('19c. Property paper is referenced, not copied into deal papers',
    (ws1?.dealPapers ?? []).length === 0);

  /* 20. Deal-specific paper stays deal-owned. */
  const dealPaperId = rid('ddoc');
  const { error: dpErr } = await db.from('desk_deal_documents').insert({
    id: dealPaperId, dealer_id: A.dealerId, deal_id: dealId, title: 'Token receipt',
    document_type: 'token-receipt',
    storage_path: `dealers/${A.dealerId}/deals/${dealId}/documents/${dealPaperId}.pdf`,
    mime_type: 'application/pdf', size_bytes: 1024,
  });
  check('20a. Deal-specific paper stored', !dpErr, dpErr?.message);

  const { data: ws2 } = await db.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
  check('20b. Deal paper stays deal-owned and separate',
    (ws2?.dealPapers ?? []).length === 1 && (ws2?.propertyPapers ?? []).length === 1);

  /* 21. Registry / Closing. */
  const { data: toRegistry } = await db.rpc('plotmap_set_deal_stage', {
    p_payload: { dealId, stage: 'registry', registryDate: '2026-09-05' },
  });
  check('21. Deal moved to Registry / Closing', toRegistry?.ok === true, toRegistry?.reason);

  /* 22. Commission is computed, not stored twice. */
  check('22a. Expected commission computed from both sides',
    ws2?.money?.expectedBuyer === 92000 && ws2?.money?.expectedSeller === 50000
    && ws2?.money?.expected === 142000,
    JSON.stringify(ws2?.money));

  await db.rpc('plotmap_record_deal_payment', {
    p_payload: { dealId, kind: 'commission-buyer', amount: 42000, receivedOn: '2026-09-01' },
  });
  const { data: ws3 } = await db.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
  check('22b. Received and still-due commission track receipts',
    ws3?.money?.received === 42000 && ws3?.money?.due === 100000
    && ws3?.money?.fullySettled === false, JSON.stringify(ws3?.money));

  /* 23–24. Mark Sold must COMPLETE the existing deal, not duplicate it. */
  const { data: sold } = await db.rpc('plotmap_record_completed_sale', {
    p_payload: {
      propertyId: ids.property, buyerId: ids.client,
      soldPrice: 9200000, saleDate: '2026-09-05', registrationDate: '2026-09-05',
    },
  });
  check('23. Property marked Sold', sold?.ok === true, sold?.reason);
  check('24. Existing deal completed rather than duplicated',
    sold?.reusedPipelineDeal === true && sold?.deal?.id === dealId,
    `reused=${sold?.reusedPipelineDeal} id=${sold?.deal?.id}`);

  const { data: allDeals } = await db.from('crm_records')
    .select('id,payload').eq('entity_type', 'deals');
  const forProperty = (allDeals ?? []).filter(
    (d) => (d.payload.propertyId ?? d.payload.propId) === ids.property);
  check('24b. Exactly one canonical deal exists for this property',
    forProperty.length === 1, `found ${forProperty.length}`);

  /* 25–26. Buyer and seller histories. */
  const { data: buyerRow } = await db.from('crm_records')
    .select('payload').eq('id', ids.client).single();
  check('25. Buyer purchase history updated',
    (buyerRow?.payload?.purchased ?? []).includes(ids.property));

  const { data: sellerRel } = await db.from('desk_property_sellers')
    .select('property_id').eq('seller_id', ids.seller);
  check('26. Seller keeps its sold-property history',
    (sellerRel ?? []).some((r) => r.property_id === ids.property));

  const { data: dirAfter } = await db.rpc('plotmap_seller_directory', { p_include_archived: false });
  const rowAfter = (dirAfter ?? []).find((r) => r.id === ids.seller);
  check('26b. Seller directory moves the sold property out of live counts',
    rowAfter?.live_count === 1 && rowAfter?.sold_count === 1,
    `live=${rowAfter?.live_count} sold=${rowAfter?.sold_count}`);

  /* Property lifecycle + inventory withdrawal. */
  const { data: soldProp } = await db.from('crm_records')
    .select('payload').eq('id', ids.property).single();
  check('23b. Sold property leaves active inventory',
    soldProp?.payload?.lifecycle === 'sold' && soldProp?.payload?.published === false
    && soldProp?.payload?.clientVisible === false);

  /* 27–28. History survives. */
  const { data: ws4 } = await db.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
  check('28a. Deal papers survive the sale', (ws4?.dealPapers ?? []).length === 1);
  check('28b. Property papers survive the sale', (ws4?.propertyPapers ?? []).length === 1);
  check('28c. Stage history is preserved end to end',
    (ws4?.stageHistory ?? []).map((e) => e.stage).join('>') === 'negotiating>token>registry>closed',
    (ws4?.stageHistory ?? []).map((e) => e.stage).join('>'));

  /* 30–32. Commission outlives the sale, then settles. */
  check('30. Commission can remain due after the sale',
    ws4?.money?.due === 100000 && ws4?.money?.fullySettled === false,
    JSON.stringify(ws4?.money));

  await db.rpc('plotmap_record_deal_payment', {
    p_payload: { dealId, kind: 'commission-buyer', amount: 50000 },
  });
  await db.rpc('plotmap_record_deal_payment', {
    p_payload: { dealId, kind: 'commission-seller', amount: 50000 },
  });
  const { data: ws5 } = await db.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
  check('31–32. Remaining commission settles the deal fully',
    ws5?.money?.received === 142000 && ws5?.money?.due === 0
    && ws5?.money?.fullySettled === true, JSON.stringify(ws5?.money));

  /* A completed deal cannot be silently re-opened by a stage change. */
  const { data: reopen } = await db.rpc('plotmap_set_deal_stage', {
    p_payload: { dealId, stage: 'negotiating' },
  });
  check('33. A completed deal cannot be re-opened by a stage change', reopen?.ok === false,
    reopen?.reason);

  /* A lost deal persists with its reason. */
  const lostClient = rid('client-lost');
  await db.from('crm_records').insert({
    id: lostClient, entity_type: 'clients', dealer_id: A.dealerId, deleted: false,
    payload: { id: lostClient, name: 'E2E Lost Buyer', phone: '+91 90000 00003',
      city: 'Mohali', want: 'Plot', budget: '', budgetMax: 0, status: 'active',
      seen: '', note: '', viewed: [], interest: [], purchased: [] },
  });
  const lostProp = rid('prop-lost');
  await db.from('crm_records').insert({
    id: lostProp, entity_type: 'properties', dealer_id: A.dealerId, deleted: false,
    payload: { id: lostProp, type: 'Flat', want: 'Flat', city: 'Mohali', area: 'E2E Towers',
      loc: 'E2E Towers, Mohali', sector: '92', size: '1450 sq ft', facing: 'North',
      position: 'Inside', approvals: [], landmarks: [], price: 7000000, photos: [],
      published: true, sold: false, lifecycle: 'on-sale', views: 0 },
  });
  const { data: lostDeal } = await db.rpc('plotmap_start_deal', {
    p_payload: { propertyId: lostProp, buyerId: lostClient, value: 7000000 },
  });
  const { data: lost } = await db.rpc('plotmap_set_deal_stage', {
    p_payload: { dealId: lostDeal.deal.id, stage: 'lost', reason: 'Buyer chose another plot' },
  });
  check('34. A lost deal persists with its reason',
    lost?.ok === true && lost?.deal?.stage === 'lost'
    && lost?.deal?.lostReason === 'Buyer chose another plot', lost?.reason);

  return { ...ids, dealId, paperId, dealPaperId };
}

/* ── adversarial second dealer ───────────────────────────────── */

async function isolation(B, owned) {
  const db = B.session;

  const readDenied = async (label, table, column, value) => {
    const { data, error } = await db.from(table).select('*').eq(column, value);
    check(`ISO read ${label}`, (data ?? []).length === 0,
      error ? `denied: ${error.code}` : `rows=${(data ?? []).length}`);
  };

  await readDenied('property/client/deal rows', 'crm_records', 'dealer_id', owned.dealerId);
  await readDenied('sellers', 'desk_sellers', 'id', owned.seller);
  await readDenied('seller relationships', 'desk_property_sellers', 'property_id', owned.property);
  await readDenied('property documents', 'desk_property_documents', 'property_id', owned.property);
  await readDenied('deal payments', 'desk_deal_payments', 'deal_id', owned.dealId);
  await readDenied('deal stage history', 'desk_deal_stage_events', 'deal_id', owned.dealId);
  await readDenied('deal papers', 'desk_deal_documents', 'deal_id', owned.dealId);

  /* Direct unauthorized RPC attempts. */
  const { data: ws } = await db.rpc('plotmap_deal_workspace', { p_deal_id: owned.dealId });
  check('ISO deal workspace RPC refuses another dealer', ws?.ok === false,
    JSON.stringify(ws)?.slice(0, 90));

  const { data: stage } = await db.rpc('plotmap_set_deal_stage', {
    p_payload: { dealId: owned.dealId, stage: 'lost', reason: 'hijack' },
  });
  check('ISO stage change RPC refuses another dealer', stage?.ok === false, stage?.reason);

  const { data: pay } = await db.rpc('plotmap_record_deal_payment', {
    p_payload: { dealId: owned.dealId, kind: 'token', amount: 1 },
  });
  check('ISO payment RPC refuses another dealer', pay?.ok === false, pay?.reason);

  /* Seller read models must not leak another dealer's sellers. */
  const { data: dirB } = await db.rpc('plotmap_seller_directory', { p_include_archived: true });
  check('ISO seller directory returns none of another dealer\'s sellers',
    !(dirB ?? []).some((r) => r.id === owned.seller), `rows=${(dirB ?? []).length}`);

  const { data: wsB } = await db.rpc('plotmap_seller_workspace', { p_seller_id: owned.seller });
  check('ISO seller workspace RPC refuses another dealer', wsB?.ok === false,
    JSON.stringify(wsB)?.slice(0, 80));

  const { data: archB } = await db.rpc('plotmap_set_seller_archived', {
    p_payload: { sellerId: owned.seller, archived: true },
  });
  check('ISO seller archive RPC refuses another dealer', archB?.ok === false, archB?.reason);

  const { data: assignB } = await db.rpc('plotmap_assign_property_seller', {
    p_payload: { propertyId: owned.property, sellerId: owned.seller, relationship: 'owner' },
  });
  check('ISO seller assignment RPC refuses another dealer', assignB?.ok === false, assignB?.reason);

  const { data: startOther } = await db.rpc('plotmap_start_deal', {
    p_payload: { propertyId: owned.property, buyerId: owned.client, value: 1 },
  });
  check('ISO start-deal RPC refuses another dealer property',
    startOther?.ok === false, startOther?.reason);

  const { data: saleOther } = await db.rpc('plotmap_record_completed_sale', {
    p_payload: { propertyId: owned.property, buyerId: owned.client,
      soldPrice: 1, saleDate: '2026-09-09' },
  });
  check('ISO mark-sold RPC refuses another dealer property',
    saleOther?.ok === false, saleOther?.reason);

  /* Tenant forgery: a browser-supplied dealer_id must be ignored. */
  const forged = rid('forged');
  const { error: forgeErr } = await db.from('crm_records').insert({
    id: forged, entity_type: 'properties', dealer_id: owned.dealerId, deleted: false,
    payload: { id: forged, type: 'Flat', city: 'Mohali', area: 'Forged' },
  });
  if (!forgeErr) {
    const { data: row } = await admin.from('crm_records')
      .select('dealer_id').eq('id', forged).single();
    check('ISO forged dealer_id is overwritten with the caller tenant',
      row?.dealer_id === B.dealerId, `stored as ${row?.dealer_id}`);
    await admin.from('crm_records').delete().eq('id', forged);
  } else {
    check('ISO forged dealer_id insert rejected', true, forgeErr.code);
  }

  /* Storage paths belonging to dealer A must not be readable. */
  const { data: signed, error: signErr } = await db.storage
    .from('deal-documents')
    .createSignedUrl(`dealers/${owned.dealerId}/deals/${owned.dealId}/documents/${owned.dealPaperId}.pdf`, 60);
  check('ISO deal-document storage path refuses another dealer',
    !!signErr || !signed?.signedUrl, signErr?.message ?? 'signed url issued');
}

/* ── run ─────────────────────────────────────────────────────── */

(async () => {
  try {
    console.log('MAPCO-DEV Desk E2E — provisioning two throwaway dealers\n');
    const A = await provisionDealer('a');
    const B = await provisionDealer('b');
    check('0. Two isolated dealers signed in', !!A.userId && !!B.userId);

    console.log('\n--- Dealer A: full journey ---');
    const owned = await journey(A);

    console.log('\n--- Dealer B: adversarial isolation ---');
    await isolation(B, { ...owned, dealerId: A.dealerId });
  } catch (error) {
    failures++;
    console.error(`\nFATAL: ${error.message}`);
  } finally {
    console.log('\n--- cleaning up test data ---');
    await cleanup();
    console.log('cleanup complete');
    const passed = results.filter((r) => r.passed).length;
    console.log(`\n${passed}/${results.length} checks passed, ${failures} failure(s)`);
    process.exit(failures ? 1 : 0);
  }
})();
