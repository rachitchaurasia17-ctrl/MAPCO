/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Relink the authoritative ALIGNED map assets (dev only)
   ---------------------------------------------------------------
   The founder produced newly aligned exports where the raster and the
   SVG overlay share IDENTICAL pixel dimensions (viewBox === raster) so
   they overlay 1:1 with NO calibration offset. This script connects the
   newest aligned raster+SVG pair to each Original masterplan record and
   writes per-map calibration metadata (payload.calibration).

     • Chandigarh     → alligned svg/chandigarh masterplan.png + .svg   (1603×1278)
     • Mohali         → alligned svg/mohali masterplan.png     + .svg   (1603×1278)
     • New Chandigarh → alligned svg/new chd 2.png             + new chd 1.svg (1603×1278)
     • Aerocity       → maps with svg/aerotropolis-original.png.png + aerotropolis-overlays.svg.svg (4599×3069)
                        (the proven earlier PlotMap overlay, reused as-is; the
                         duplicate 'aerotropolis-master' record is retired and
                         'aerocity-master' becomes the single Aerocity map)

   Reads secrets from the gitignored supabase/.env. Never prints keys.
   Idempotent: safe to rerun. Usage: node v2/scripts/relink-aligned-maps.mjs [--dry]
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry');
const ROOT = 'C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO';
const ALIGNED = `${ROOT}/migration-kit/maps with svg/alligned svg`;
const WITHSVG = `${ROOT}/migration-kit/maps with svg`;

const env = Object.fromEntries(readFileSync(`${ROOT}/supabase/.env`, 'utf8').split('\n').filter(Boolean).map((l) => {
  const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Read intrinsic PNG dimensions from the IHDR chunk. */
function pngDims(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
/** Pull the viewBox from an SVG's opening tag. */
function svgViewBox(text) {
  const m = text.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? { w: Math.round(+m[1]), h: Math.round(+m[2]) } : null;
}

async function upload(storagePath, localPath, contentType) {
  const buf = readFileSync(localPath);
  if (!DRY) {
    const up = await admin.storage.from('maps').upload(storagePath, buf, { contentType, upsert: true });
    if (up.error) throw new Error(`upload ${storagePath}: ${up.error.message}`);
  }
  const url = admin.storage.from('maps').getPublicUrl(storagePath).data.publicUrl;
  return { url, buf };
}

/** Connect one aligned raster+SVG pair to a masterplan record. */
async function relink({ id, cslug, rasterFile, svgFile, rasterDir = ALIGNED, svgDir = ALIGNED, label, city, keepThreeD = true }) {
  console.log(`\n── ${id} ──`);
  const rasterPath = `${cslug}/${id}-original.png`;
  const svgPath = `${cslug}/${id}-overlay.svg`;

  const raster = await upload(rasterPath, `${rasterDir}/${rasterFile}`, 'image/png');
  const rdims = pngDims(raster.buf);
  const svg = await upload(svgPath, `${svgDir}/${svgFile}`, 'image/svg+xml');
  const vb = svgViewBox(svg.buf.toString('utf8'));

  const aligned = !!vb && vb.w === rdims.w && vb.h === rdims.h;
  const status = aligned ? 'calibrated' : 'needs-review';
  console.log(`   raster ${rdims.w}×${rdims.h}  viewBox ${vb ? vb.w + '×' + vb.h : '?'}  → ${status}`);

  // Read the current record to preserve threeD + other fields.
  const { data: cur, error: readErr } = await admin.from('prebuilt_maps').select('*').eq('id', id).maybeSingle();
  if (readErr) throw new Error(`read ${id}: ${readErr.message}`);
  if (!cur) { console.log(`   !! record ${id} not found — skipping`); return { id, status: 'missing' }; }

  const threeD = keepThreeD ? cur.assets?.threeD : undefined;
  const assets = {
    original: { path: raster.url, w: rdims.w, h: rdims.h },
    ...(threeD ? { threeD } : {}),
    overlay: { path: svg.url, w: (vb?.w ?? rdims.w), h: (vb?.h ?? rdims.h) },
  };
  const dims = {
    original: { w: rdims.w, h: rdims.h },
    ...(threeD ? { threeD: { w: threeD.w, h: threeD.h } } : {}),
  };
  const calibration = {
    status,
    raster: { w: rdims.w, h: rdims.h },
    overlayViewBox: vb ?? null,
    // aligned exports need no offset/scale — the SVG viewBox equals the raster box.
    transform: aligned ? { scale: 1, offsetX: 0, offsetY: 0 } : null,
    source: `${svgDir === ALIGNED ? 'alligned svg' : 'maps with svg'}/${svgFile}`,
    verifiedAt: new Date().toISOString(),
  };
  const payload = { ...(cur.payload ?? {}), calibration };

  const row = {
    assets, dims, raster: raster.url,
    payload,
    ...(label ? { label } : {}),
    ...(city ? { city } : {}),
    updated_at: new Date().toISOString(),
  };
  if (!DRY) {
    const { error } = await admin.from('prebuilt_maps').update(row).eq('id', id);
    if (error) throw new Error(`update ${id}: ${error.message}`);
  }
  console.log(`   ✓ linked (${label ?? cur.label})`);
  return { id, status };
}

(async () => {
  const results = [];
  results.push(await relink({ id: 'chandigarh-master', cslug: 'chandigarh', rasterFile: 'chandigarh masterplan.png', svgFile: 'chandigarh masterplan.svg' }));
  results.push(await relink({ id: 'mohali-master', cslug: 'mohali', rasterFile: 'mohali masterplan.png', svgFile: 'mohali masterplan.svg' }));
  results.push(await relink({ id: 'new-chandigarh-master', cslug: 'newchandigarh', rasterFile: 'new chd 2.png', svgFile: 'new chd 1.svg' }));

  // Aerocity — reuse the proven earlier PlotMap overlay + raster (perfectly aligned 4599×3069).
  results.push(await relink({
    id: 'aerocity-master', cslug: 'aerocity',
    rasterFile: 'aerotropolis-original.png.png', svgFile: 'aerotropolis-overlays.svg.svg',
    rasterDir: WITHSVG, svgDir: WITHSVG,
    label: 'Aerocity — Master Plan', city: 'Mohali', keepThreeD: false,
  }));

  // Retire the duplicate aerotropolis record (its sectors, if any, re-parent to aerocity-master).
  console.log('\n── consolidating aerotropolis → aerocity ──');
  if (!DRY) {
    const { error: reparent } = await admin.from('prebuilt_maps')
      .update({ parent_map_id: 'aerocity-master', updated_at: new Date().toISOString() })
      .eq('parent_map_id', 'aerotropolis-master');
    if (reparent) console.log('   reparent warn:', reparent.message);
    const { error: hide } = await admin.from('prebuilt_maps')
      .update({ status: 'archived', client_visible: false, deleted: true, updated_at: new Date().toISOString() })
      .eq('id', 'aerotropolis-master');
    if (hide) console.log('   retire warn:', hide.message);
  }
  console.log('   ✓ aerotropolis-master retired; aerocity-master is the single Aerocity map');

  console.log('\n=== SUMMARY ===');
  for (const r of results) console.log(`   ${r.id.padEnd(24)} ${r.status}`);
  console.log(DRY ? '\n(dry run — nothing written)' : '\ndone.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
