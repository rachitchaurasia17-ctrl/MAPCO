/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Highlight system live verification (dev only)
   ---------------------------------------------------------------
   Exercises the REAL dealer-session presentation path against
   MAPCO-DEV: signs in as the demo owner (anon key + password, exactly
   like the browser), reads plotmap_published_maps, and asserts every
   aligned masterplan carries a calibrated overlay whose SVG fetches,
   parses and contains the expected authored highlight groups.

   Prints only PASS/FAIL lines — never secrets. Exit 1 on any failure.
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ROOT = 'C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO';
const env = Object.fromEntries(readFileSync(`${ROOT}/supabase/.env`, 'utf8').split('\n').filter(Boolean).map((l) => {
  const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  PASS  ${m}`); };
const bad = (m) => { fail++; console.log(`  FAIL  ${m}`); };

const EXPECT = {
  'chandigarh-master': { vb: [1603, 1278], groups: ['roads', 'sectors'] },
  'mohali-master': { vb: [1603, 1278], groups: ['roads', 'sectors'], sample: '66' },
  'new-chandigarh-master': { vb: [1603, 1278], groups: ['major roads', 'ZONE-1'] },
  'aerocity-master': { vb: [4599, 3069], groups: [] }, // flat roads overlay (no groups)
};

(async () => {
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: signInErr } = await c.auth.signInWithPassword({ email: 'demo-owner@mapco.dev', password: env.DEMO_PASSWORD });
  if (signInErr) { bad(`sign in demo owner: ${signInErr.message}`); process.exit(1); }
  ok('signed in as demo owner (anon key + password, browser-equivalent)');

  const { data, error } = await c.rpc('plotmap_published_maps');
  if (error) { bad(`plotmap_published_maps: ${error.message}`); process.exit(1); }
  const maps = data ?? [];
  ok(`plotmap_published_maps returned ${maps.length} published+visible maps`);

  const byId = Object.fromEntries(maps.map((m) => [m.id, m]));

  // aerotropolis duplicate must be gone; single Aerocity remains
  if (byId['aerotropolis-master']) bad('aerotropolis-master still visible (should be retired)');
  else ok('aerotropolis-master retired (not in published maps)');
  if (byId['aerocity-master']?.label?.toLowerCase().includes('aerocity')) ok('aerocity-master is the single Aerocity map');
  else bad('aerocity-master missing or mislabeled');

  // aligned maps: calibrated overlay, viewBox === raster, SVG fetches + groups
  for (const [id, exp] of Object.entries(EXPECT)) {
    const m = byId[id];
    if (!m) { bad(`${id}: not published`); continue; }
    const cal = m.payload?.calibration;
    const ov = m.assets?.overlay;
    if (cal?.status === 'calibrated') ok(`${id}: calibration=calibrated`); else bad(`${id}: calibration=${cal?.status}`);
    if (ov?.path && ov.w === exp.vb[0] && ov.h === exp.vb[1]) ok(`${id}: overlay viewBox ${ov.w}×${ov.h} matches raster`);
    else bad(`${id}: overlay viewBox ${ov?.w}×${ov?.h} != ${exp.vb.join('×')}`);
    const rd = m.dims?.original;
    if (rd && rd.w === exp.vb[0] && rd.h === exp.vb[1]) ok(`${id}: raster ${rd.w}×${rd.h} (1:1 with overlay → no calibration offset)`);
    else bad(`${id}: raster ${rd?.w}×${rd?.h} != overlay`);

    // fetch + parse the SVG, confirm authored groups exist
    try {
      const res = await fetch(ov.path);
      const svg = await res.text();
      const vbMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      if (vbMatch && +vbMatch[1] === exp.vb[0] && +vbMatch[2] === exp.vb[1]) ok(`${id}: fetched SVG viewBox ${vbMatch[1]}×${vbMatch[2]}`);
      else bad(`${id}: fetched SVG viewBox mismatch (${vbMatch?.[1]}×${vbMatch?.[2]})`);
      for (const g of exp.groups) {
        if (svg.includes(`id="${g}"`)) ok(`${id}: authored group "${g}" present`);
        else bad(`${id}: authored group "${g}" MISSING`);
      }
      if (exp.sample && svg.includes(`id="${exp.sample}"`)) ok(`${id}: individual sector "${exp.sample}" spotlightable`);
    } catch (e) { bad(`${id}: SVG fetch failed: ${e.message}`); }
  }

  // non-aligned masterplans: no overlay (alignment pending), still published
  for (const id of ['zirakpur-master', 'panchkula-master', 'derabassi-master', 'kharar-master']) {
    const m = byId[id];
    if (!m) { bad(`${id}: not published (should still show, highlights disabled)`); continue; }
    if (!m.assets?.overlay && m.payload?.calibration?.status === 'unavailable') ok(`${id}: no overlay → Alignment pending (renders raster only)`);
    else bad(`${id}: unexpected overlay/calibration state`);
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
