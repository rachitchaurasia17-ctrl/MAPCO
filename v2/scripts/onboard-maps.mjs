/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Batch map onboarding (dev only, service-role)
   ---------------------------------------------------------------
   Turns the messy 170-file Tri-City source library into organized
   prebuilt_maps records + Storage assets. Handles naming typos,
   double extensions, duplicates across folders, missing extensions,
   and unreadable dimensions — every skip is reported with a reason.

   Reads secrets from the gitignored supabase/.env. Never prints keys.

   Usage:
     node v2/scripts/onboard-maps.mjs --dry                 # classify only, no upload
     node v2/scripts/onboard-maps.mjs --cities=mohali,newchd # onboard these cities
     node v2/scripts/onboard-maps.mjs --all                 # onboard everything
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ALL = args.includes('--all');
const cityFilter = (args.find((a) => a.startsWith('--cities=')) || '').split('=')[1]?.split(',').filter(Boolean) ?? [];
const DEALER = 'dealer-demo';
const ROOT = 'C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO';
const FOLDERS = ['maps with svg', '3d maps', 'non 3d maps'];

// ── env ───────────────────────────────────────────────────────
const env = Object.fromEntries(readFileSync('supabase/.env', 'utf8').split('\n').filter(Boolean).map((l) => {
  const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── classification ────────────────────────────────────────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// City detection — specific before generic; includes common typos.
const CITY_RULES = [
  [/a[e]?rotropolis|aetropolis/, 'Mohali', 'aerotropolis'],
  [/aerocity/, 'Mohali', 'aerocity'],
  [/mullanpur|eco ?city|new ch(d|andigarh)/, 'New Chandigarh', 'new-chandigarh'],
  [/zir(ak|k)p(ur|ut)|zirakp/, 'Zirakpur', 'zirakpur'],
  [/panch(u|k)lka|panchkula/, 'Panchkula', 'panchkula'],
  [/derabassi/, 'Derabassi', 'derabassi'],
  [/kharar/, 'Kharar', 'kharar'],
  [/moh(a|)l?li?|mohalo|mohali/, 'Mohali', 'mohali'],
  [/chandigar+h|chd/, 'Chandigarh', 'chandigarh'],
];
// Named Tri-City developments without a city token in the filename — all Mohali.
const MOHALI_PROJECTS = /gillco|shivalik|jlpl|ireo|pearls|wave estate|uniworld|janta|industrial|shopping centre|focal point|gamada|\bphase\b/;
function cityOf(name) {
  const l = name.toLowerCase();
  for (const [re, city, cslug] of CITY_RULES) if (re.test(l)) return { city, cslug };
  if (MOHALI_PROJECTS.test(l)) return { city: 'Mohali', cslug: 'mohali' };
  return null;
}
function stripExt(f) {
  // collapse double extensions: foo.png.png → foo.png ; foo.svg.svg → foo.svg
  let n = f.replace(/\.(png|jpe?g|svg)\.(png|jpe?g|svg)$/i, '.$2');
  const m = n.match(/\.(png|jpe?g|svg)$/i);
  return { base: n.replace(/\.(png|jpe?g|svg)$/i, ''), ext: m ? m[1].toLowerCase().replace('jpeg', 'jpg') : null };
}
// Manual overrides for files the classifier cannot resolve from the name alone.
// Keyed by "<folder>/<filename>". Remembered here so every rerun is idempotent.
const OVERRIDES = {
  '3d maps/sector 16.png': { city: 'Chandigarh', cslug: 'chandigarh', kind: 'sector', label: 'Sector 16', sectorSlug: 'sector-16', render: 'threeD' },
  'non 3d maps/sector 83.png': { city: 'Mohali', cslug: 'aerocity', kind: 'sector', label: 'Aerocity — Sector 83', sectorSlug: 'sector-83', render: 'original' },
};

function classify(folder, file) {
  const ov = OVERRIDES[`${folder}/${file}`];
  if (ov) {
    const { ext } = stripExt(file);
    return { file, folder, ext, render: ov.render, city: ov.city, cslug: ov.cslug, kind: ov.kind,
      label: ov.label, mapSlug: ov.kind === 'masterplan' ? `${ov.cslug}-master` : `${ov.cslug}-${ov.sectorSlug}` };
  }
  const { base, ext } = stripExt(file);
  if (!ext) return { skip: 'no file extension', file };
  const city = cityOf(base);
  if (!city) return { skip: 'unknown city', file };
  const l = base.toLowerCase();
  const render = ext === 'svg' ? 'overlay' : (/\b3d\b|3d/.test(l) || folder === '3d maps') ? 'threeD' : 'original';
  // sector vs masterplan
  const secMatch = l.match(/sec(?:tor|ter|ter|)[ -]*([0-9]+[a-z]?(?:[ -][0-9]+)?)/) || l.match(/phase[ -]*([0-9]+[a-z-]*)/);
  let kind, label, sectorSlug;
  const PROJECTS = ['gillco', 'shivalik', 'jlpl', 'ireo', 'pearls', 'wave estate', 'uniworld', 'janta', 'industrial', 'shopping centre', 'gamada', 'focal point'];
  const proj = PROJECTS.find((p) => l.includes(p));
  if (secMatch) { kind = 'sector'; label = 'Sector ' + secMatch[1].toUpperCase().replace(/\s+/g, ' '); sectorSlug = slug(secMatch[0]); }
  else if (proj) { kind = 'sector'; label = base.replace(/\b\w/g, (c) => c.toUpperCase()); sectorSlug = slug(proj + '-' + (secMatch?.[1] ?? base.split(city.cslug)[0] ?? proj)); }
  else if (/masterplan|normal|with svg|original|extension|extenstion/.test(l) || render === 'threeD') { kind = 'masterplan'; label = city.city + ' — Master Plan'; }
  else { kind = 'masterplan'; label = city.city + ' — Master Plan'; }
  const mapSlug = kind === 'masterplan' ? `${city.cslug}-master` : `${city.cslug}-${sectorSlug}`;
  return { file, folder, ext, render, city: city.city, cslug: city.cslug, kind, label, mapSlug };
}

// ── dimensions ────────────────────────────────────────────────
function dims(buf, ext) {
  try {
    if (ext === 'png') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (ext === 'jpg') {
      let o = 2;
      while (o < buf.length) {
        if (buf[o] !== 0xff) { o++; continue; }
        const m = buf[o + 1];
        if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
        o += 2 + buf.readUInt16BE(o + 2);
      }
    }
  } catch { /* fallthrough */ }
  return null;
}

// ── plan ──────────────────────────────────────────────────────
const maps = new Map(); // mapSlug → { city, cslug, kind, label, renders: {original?,threeD?,overlay?} }
const skipped = [];
for (const folder of FOLDERS) {
  const dir = join(ROOT, folder);
  for (const file of readdirSync(dir)) {
    if (statSync(join(dir, file)).isDirectory()) continue;
    const c = classify(folder, file);
    if (c.skip) { skipped.push({ file: `${folder}/${file}`, reason: c.skip }); continue; }
    const key = c.mapSlug;
    const rec = maps.get(key) ?? { city: c.city, cslug: c.cslug, kind: c.kind, label: c.label, renders: {} };
    // prefer 'maps with svg' original over others (annotated); keep first threeD/overlay seen
    if (!rec.renders[c.render] || (c.render === 'original' && folder === 'maps with svg')) {
      rec.renders[c.render] = { local: join(dir, file), folder, ext: c.ext };
    }
    maps.set(key, rec);
  }
}

// ── report / execute ──────────────────────────────────────────
const byCity = {};
for (const [id, m] of maps) { (byCity[m.city] ??= []).push({ id, ...m }); }

console.log(`\n=== ONBOARDING PLAN — ${maps.size} logical maps from ${FOLDERS.length} folders ===`);
for (const city of Object.keys(byCity).sort()) {
  const ms = byCity[city];
  const masters = ms.filter((m) => m.kind === 'masterplan').length, sectors = ms.filter((m) => m.kind === 'sector').length;
  console.log(`  ${city}: ${ms.length} maps (${masters} masterplan, ${sectors} sector)`);
}
console.log(`  SKIPPED: ${skipped.length}`);
for (const s of skipped) console.log(`    - ${s.file} → ${s.reason}`);

if (DRY) { console.log('\n(dry run — nothing uploaded)'); process.exit(0); }

// selection
const wanted = ALL ? null : cityFilter.map((c) => c.toLowerCase());
function selected(m) { return !wanted || wanted.some((w) => m.cslug.includes(w) || m.city.toLowerCase().includes(w)); }

let uploaded = 0, registered = 0, failed = 0;
async function upload(cslug, mapSlug, render, r) {
  const path = `${cslug}/${mapSlug}-${render}.${r.ext}`;
  const buf = readFileSync(r.local);
  const ct = r.ext === 'svg' ? 'image/svg+xml' : r.ext === 'jpg' ? 'image/jpeg' : 'image/png';
  const up = await admin.storage.from('maps').upload(path, buf, { contentType: ct, upsert: true });
  if (up.error) { console.log(`    upload FAIL ${path}: ${up.error.message}`); return null; }
  uploaded++;
  const url = admin.storage.from('maps').getPublicUrl(path).data.publicUrl;
  const d = r.ext === 'svg' ? {} : (dims(buf, r.ext) ?? {});
  return { path: url, ...d };
}

// masterplans first (sectors reference them as parents)
const ordered = [...maps.entries()].filter(([, m]) => selected(m)).sort((a, b) => (a[1].kind === 'masterplan' ? -1 : 1) - (b[1].kind === 'masterplan' ? -1 : 1));
for (const [id, m] of ordered) {
  const assets = {};
  for (const render of ['original', 'threeD', 'overlay']) {
    if (m.renders[render]) { const a = await upload(m.cslug, id, render, m.renders[render]); if (a) assets[render] = a; }
  }
  if (!assets.original && !assets.threeD) { failed++; console.log(`    SKIP ${id}: no raster (only overlay)`); continue; }
  const parentId = m.kind === 'sector' ? `${m.cslug}-master` : null;
  const row = {
    id, dealer_id: DEALER, kind: m.kind, city: m.city, area: m.kind === 'masterplan' ? 'Master Plan' : m.label,
    label: m.label, raster: (assets.original ?? assets.threeD).path,
    dims: { ...(assets.original ? { original: { w: assets.original.w, h: assets.original.h } } : {}),
            ...(assets.threeD ? { threeD: { w: assets.threeD.w, h: assets.threeD.h } } : {}) },
    assets, parent_map_id: parentId,
    status: m.kind === 'masterplan' ? 'published' : 'draft',
    client_visible: m.kind === 'masterplan', deleted: false, updated_at: new Date().toISOString(),
  };
  const ins = await admin.from('prebuilt_maps').upsert(row);
  if (ins.error) { failed++; console.log(`    register FAIL ${id}: ${ins.error.message}`); } else { registered++; }
}

console.log(`\n=== DONE: ${registered} maps registered, ${uploaded} assets uploaded, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
