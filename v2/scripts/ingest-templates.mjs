/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — template ingestion

   Reads every approved template PNG, derives what can be derived
   DETERMINISTICALLY, and emits a registry data file.

   Run once when templates change:
       node scripts/ingest-templates.mjs

   What is derived here (never re-derived at plan time):
     • stable id  — T001… assigned by sorted filename, so ids are
       reproducible and survive renames of unrelated files
     • intrinsic size + aspect ratio  — from the PNG IHDR
     • photo/text fill zones — by decoding the image and locating the
       authored near-uniform light regions
     • archetype / content density / feature capacity — from the shape
       and count of those zones

   What is NOT derived: taste. Style tags and usage guidance come from
   a small curated table below, keyed by id, and default to safe
   generic values for templates a human has not yet reviewed.
   ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(HERE, '../public/templates');
const OUT_FILE = path.resolve(HERE, '../src/packages/marketing/templates/generated.ts');

/* ── PNG decode (non-interlaced, 8-bit) ──────────────────────── */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8 || interlace !== 0 || !channels) {
    return { w, h, bpp: 0, data: null };
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const row = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let v = row[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
  }
  return { w, h, bpp: channels, data: out };
}

/** Authored fill zones are bright and desaturated; background art is not. */
const isSlotPixel = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max > 208 && max - min < 14;
};

function findZones(png) {
  const { w, h, bpp, data } = png;
  if (!data) return [];
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * bpp;
      if (isSlotPixel(data[i], data[i + 1], data[i + 2])) mask[y * w + x] = 1;
    }
  }
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const zones = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0; stack[sp++] = s; seen[s] = 1;
    let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      count++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const fill = count / (bw * bh);
    const touchesEdge = minX <= 1 || minY <= 1 || maxX >= w - 2 || maxY >= h - 2;
    if (!touchesEdge && bw >= 60 && bh >= 26 && fill > 0.8) {
      zones.push({
        x: +(minX / w).toFixed(4), y: +(minY / h).toFixed(4),
        w: +(bw / w).toFixed(4), h: +(bh / h).toFixed(4),
        area: +((bw * bh) / (w * h)).toFixed(4),
      });
    }
  }
  return zones.sort((a, b) => b.area - a.area);
}

function aspectOf(w, h) {
  const r = w / h;
  if (Math.abs(r - 0.8) < 0.02) return '4:5';
  if (Math.abs(r - 2 / 3) < 0.02) return '2:3';
  if (Math.abs(r - 9 / 16) < 0.03) return '9:16';
  if (Math.abs(r - 1) < 0.02) return '1:1';
  return '4:5';
}

/* Curated taste layer. Only ids listed here have reviewed guidance;
   everything else gets honest generic defaults. */
const CURATED = {
  T012: { name: 'Vivid Studio', styleTags: ['vivid', 'modern', '3d', 'bright'], reviewed: true },
  T013: { name: 'Organic Clay', styleTags: ['earthy', 'calm', 'botanical', 'premium'], reviewed: true },
};

const files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.toLowerCase().endsWith('.png')).sort();
const out = [];

files.forEach((file, i) => {
  const id = `T${String(i + 1).padStart(3, '0')}`;
  const buf = fs.readFileSync(path.join(TEMPLATE_DIR, file));
  let png;
  try { png = decodePng(buf); } catch { png = { w: 0, h: 0, bpp: 0, data: null }; }
  const zones = findZones(png);
  const hero = zones[0] ?? null;
  const textZones = zones.slice(1);
  const aspect = aspectOf(png.w, png.h);

  // Deterministic characterisation from measured geometry.
  const heroArea = hero?.area ?? 0;
  const archetype = heroArea >= 0.42 || textZones.length <= 1 ? 'hero-dominant' : 'field-card';
  const contentDensity = textZones.length >= 4 ? 'high' : textZones.length >= 2 ? 'medium' : 'low';
  const featureCapacity = Math.max(1, Math.min(4, textZones.length || 1));
  const heroOrientation = hero
    ? (hero.w * png.w) / (hero.h * png.h) > 1.15 ? 'landscape'
      : (hero.w * png.w) / (hero.h * png.h) < 0.87 ? 'portrait' : 'square'
    : 'any';

  const curated = CURATED[id] ?? {};
  out.push({
    id,
    version: 1,
    name: curated.name ?? `Template ${id}`,
    asset: file,
    intrinsic: { w: png.w, h: png.h },
    aspectRatio: aspect,
    archetype,
    geometry: hero ? 'measured' : 'undetected',
    photoRegions: hero
      ? [{ role: 'hero', preferredOrientation: heroOrientation, box: { x: hero.x, y: hero.y, w: hero.w, h: hero.h } }]
      : [{ role: 'hero', preferredOrientation: 'any' }],
    detectedZones: zones.length,
    contentDensity,
    featureCapacity,
    styleTags: curated.styleTags ?? [],
    reviewed: !!curated.reviewed,
  });
});

const header = `/* GENERATED by scripts/ingest-templates.mjs — do not edit by hand.
   Re-run after adding or changing template PNGs.
   ${out.length} templates · ${new Set(out.map((t) => t.aspectRatio)).size} aspect ratios */
import type { GeneratedTemplate } from './registry';

export const GENERATED_TEMPLATES: readonly GeneratedTemplate[] = ${JSON.stringify(out, null, 2)} as const;
`;
fs.writeFileSync(OUT_FILE, header, 'utf8');

const byAspect = {};
const byGeom = {};
for (const t of out) {
  byAspect[t.aspectRatio] = (byAspect[t.aspectRatio] ?? 0) + 1;
  byGeom[t.geometry] = (byGeom[t.geometry] ?? 0) + 1;
}
console.log(`ingested ${out.length} templates → ${path.relative(process.cwd(), OUT_FILE)}`);
console.log('aspect ratios:', byAspect);
console.log('hero geometry:', byGeom);
console.log('archetypes   :', out.reduce((a, t) => ((a[t.archetype] = (a[t.archetype] ?? 0) + 1), a), {}));
