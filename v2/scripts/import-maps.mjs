#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO — non-3D map importer
   ---------------------------------------------------------------
   Reads the operator's map drop folder, classifies each file, reads its
   intrinsic pixel size, publishes it under MAPCO assets, and emits a
   generated registry module.

   Classification is conservative. A filename that does not clearly say
   what kind of map it is gets REPORTED, not guessed — showing a city
   masterplan where a dealer expects a sector sheet is worse than showing
   nothing.

   Usage:  node scripts/import-maps.mjs [--check]
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V2 = resolve(HERE, '..');
const REPO = resolve(V2, '..');
const SOURCE = join(REPO, 'non 3d maps');
const OUT_DIR = join(V2, 'public', 'maps');
const REGISTRY_OUT = join(V2, 'src', 'packages', 'maps', 'sector-map-registry.ts');

const checkOnly = process.argv.includes('--check');

/* ── image type + intrinsic dimensions ────────────────────────── */
function readImage(path) {
  const buf = readFileSync(path);
  const hex = buf.subarray(0, 4).toString('hex');

  if (hex.startsWith('89504e47')) {           // PNG
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (hex.startsWith('ffd8ff')) {             // JPEG — walk the segments
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15 except DHT(c4), JPG(c8), DAC(cc)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { type: 'jpg', width: 0, height: 0 };
  }
  if (hex.startsWith('52494646') && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    const fmt = buf.subarray(12, 16).toString('ascii');
    if (fmt === 'VP8X') return { type: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (fmt === 'VP8 ') return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { type: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return { type: 'webp', width: 0, height: 0 };
  }
  return null;
}

/* ── classification ───────────────────────────────────────────── */
const norm = (s) => s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();

const CITIES = [
  ['new chandigarh', 'New Chandigarh'], ['mullanpur', 'New Chandigarh'],
  ['aerotropolis', 'Aerotropolis'], ['aerocity', 'Aerocity'],
  ['chandigarh', 'Chandigarh'], ['chd', 'Chandigarh'],
  ['mohali', 'Mohali'], ['mohalli', 'Mohali'], ['mohli', 'Mohali'],
  ['panchkula', 'Panchkula'], ['panchulka', 'Panchkula'],
  ['zirakpur', 'Zirakpur'], ['kharar', 'Kharar'], ['derabassi', 'Derabassi'],
];

/** Named townships / projects present in the drop folder. */
const PROJECTS = [
  'gillco', 'ireo', 'jlpl', 'janta township', 'pearls city', 'uniworld city',
  'wave estate', 'shivalik city', 'eco city', 'ecocity', 'omaxe',
];

function cityOf(text) {
  for (const [token, label] of CITIES) if (text.includes(token)) return label;
  return null;
}

/*
 * Files whose name alone does not say what they are. Each is an explicit
 * curation decision with its reason recorded — NOT a pattern guess. A
 * file that is not listed here and does not match a pattern is reported,
 * never classified on a hunch.
 */
const OVERRIDES = {
  // GMADA is the development authority; this is the Aerocity master plan.
  'gamada aerocity mohali': { kind: 'MASTERPLAN', city: 'Aerocity', why: 'GMADA Aerocity master plan' },
  // "normal" distinguishes the plain sheet from the 3D rendering.
  'new chd normal': { kind: 'MASTERPLAN', city: 'New Chandigarh', why: 'plain (non-3D) New Chandigarh master plan' },
  // Panchkula Extension is a separate planned area from Panchkula proper.
  'panchulka extenstion': { kind: 'MASTERPLAN', city: 'Panchkula', why: 'Panchkula Extension master plan' },
  // Amravati Enclave is a named township, filed under the Panchkula folder.
  amravti: { kind: 'PROJECT_MAP', city: 'Panchkula', project: 'amravati enclave', why: 'Amravati Enclave township layout' },
  // Chandigarh sectors stop at 56; sector 83 exists in Mohali.
  'sector 83': { kind: 'SECTOR_MAP', city: 'Mohali', sector: '83', why: 'Chandigarh has no sector 83; Mohali does' },
};

function classify(base, folder = '') {
  const text = norm(base);
  const override = OVERRIDES[text];
  if (override) return { ...override, curated: true };
  // The folder names the city when the filename only abbreviates it.
  const folderCity = folder ? cityOf(norm(folder)) : null;

  if (/\bmasterplan\b|\bmaster plan\b/.test(text)) {
    return { kind: 'MASTERPLAN', city: cityOf(text) ?? folderCity };
  }
  if (/\bindustrial\b|\bfocal point\b/.test(text)) {
    const phase = text.match(/\bphase\s+(\d+[a-z]?)\b/);
    return {
      kind: 'INDUSTRIAL_MAP',
      city: cityOf(text) ?? folderCity ?? 'Mohali',
      sector: phase ? `phase ${phase[1]}` : undefined,
    };
  }
  if (/\bshopping cent(re|er)\b/.test(text)) {
    const phase = text.match(/\bphase\s+(\d+[a-z]?)\b/) ?? text.match(/\b(\d+)\s+phase\b/);
    return {
      kind: 'OTHER_LAYOUT', city: cityOf(text) ?? folderCity ?? 'Mohali',
      sector: phase ? `phase ${phase[1]}` : undefined,
    };
  }
  for (const project of PROJECTS) {
    if (text.includes(project)) {
      const sector = text.match(/\bsector\s+(\d+[a-z]?)\b/) ?? text.match(/\bsec\s+(\d+[a-z]?)\b/);
      return {
        kind: 'PROJECT_MAP', city: cityOf(text) ?? folderCity ?? 'Mohali',
        project, sector: sector ? sector[1] : undefined,
      };
    }
  }
  /* Local filename habits, all present in the drop folder:
       "sector 78 mohali", "sctor 34 chd", "secter 32 chd"
       "scctor 10 p" / "sector 3 p" / "sector p 12"  -> trailing p = Panchkula
       "sector p 2 mansa devi"                       -> Mansa Devi Complex
       "sector1 p"                                   -> no space          */
  const sector = text.match(/\b(?:sector|sctor|secter|scctor|sec)\s*p?\s*(\d+\s*[a-z]?)\b/)
    ?? text.match(/\b(?:sector|scctor)(\d+)\s*p\b/);
  if (sector) {
    const number = sector[1].replace(/\s+/g, '');
    const mansaDevi = /\bmansa devi\b/.test(text);
    return {
      kind: 'SECTOR_MAP',
      city: cityOf(text) ?? folderCity,
      sector: number,
      ...(mansaDevi ? { project: 'mansa devi complex' } : {}),
    };
  }
  // "phase 5 mohali", "phase 8-b"
  const phase = text.match(/\bphase\s+(\d+\s*[a-z]?)\b/);
  if (phase) {
    return { kind: 'SECTOR_MAP', city: cityOf(text) ?? folderCity ?? 'Mohali', sector: `phase ${phase[1].replace(/\s+/g, '')}` };
  }
  return null; // ambiguous — reported, never guessed
}

/* ── run ──────────────────────────────────────────────────────── */
if (!existsSync(SOURCE)) { console.error(`Map folder not found: ${SOURCE}`); process.exit(2); }
if (!checkOnly) mkdirSync(OUT_DIR, { recursive: true });

const issues = [];
const maps = [];
const seen = new Set();
const oversized = [];
const curated = [];

/* One level of nesting is meaningful: the operator groups a city's
   sector sheets in a folder named after that city. */
const entries = [];
for (const name of readdirSync(SOURCE)) {
  const full = join(SOURCE, name);
  if (statSync(full).isDirectory()) {
    for (const inner of readdirSync(full)) {
      const innerFull = join(full, inner);
      if (statSync(innerFull).isFile()) entries.push({ file: inner, full: innerFull, folder: name });
    }
  } else {
    entries.push({ file: name, full, folder: '' });
  }
}

for (const { file, full, folder } of entries) {
  if (/^desktop\.ini$/i.test(file)) continue;

  const image = readImage(full);
  if (!image) { issues.push({ file, problem: 'not-an-image', detail: 'unrecognised file signature' }); continue; }
  if (!image.width || !image.height) {
    issues.push({ file, problem: 'unreadable-dimensions', detail: `could not read pixel size of a ${image.type}` });
    continue;
  }

  const base = file.replace(extname(file), '');
  const classified = classify(base, folder);
  if (!classified || !classified.city) {
    issues.push({
      file, problem: 'ambiguous-name',
      detail: classified
        ? `classified ${classified.kind} but the city is unclear`
        : 'cannot tell what kind of map this is from the filename',
    });
    continue;
  }

  let id = norm(base).replace(/\s+/g, '-');
  if (seen.has(id)) {
    let n = 2;
    while (seen.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  seen.add(id);

  if (classified.curated) curated.push({ file, why: classified.why });
  const target = `${id}.${image.type}`;
  const bytes = statSync(full).size;
  if (bytes > 4 * 1024 * 1024) oversized.push({ file: target, mb: (bytes / 1048576).toFixed(1) });
  if (!checkOnly) copyFileSync(full, join(OUT_DIR, target));

  maps.push({
    id,
    name: base.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim(),
    kind: classified.kind,
    city: classified.city,
    ...(classified.sector ? { sector: classified.sector } : {}),
    ...(classified.project ? { project: classified.project } : {}),
    image: `/maps/${target}`,
    dimensions: { width: image.width, height: image.height },
    active: true,
  });
}

if (!checkOnly) {
  const module = [
    '/* GENERATED by scripts/import-maps.mjs — do not edit.',
    '   Source: the "non 3d maps" drop folder.',
    '   Re-run the importer to regenerate. */',
    "import type { CanonicalMap } from './registry-types.ts';",
    '',
    'export const MAP_REGISTRY: readonly CanonicalMap[] = [',
    ...maps.map((m) => `  ${JSON.stringify(m)},`),
    '];',
    '',
  ].join('\n');
  writeFileSync(REGISTRY_OUT, module);
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ version: 1, count: maps.length, maps }, null, 2)}\n`);
}

/* ── report ───────────────────────────────────────────────────── */
const byKind = maps.reduce((acc, m) => ({ ...acc, [m.kind]: (acc[m.kind] ?? 0) + 1 }), {});
console.log(`\nMAPCO non-3D map registry${checkOnly ? ' (check only)' : ''}`);
console.log(`  imported ${maps.length}`);
for (const [kind, n] of Object.entries(byKind).sort()) console.log(`    ${kind.padEnd(16)} ${n}`);
if (curated.length) {
  console.log(`
  RESOLVED BY EXPLICIT CURATION (${curated.length}) — filename alone was not enough:`);
  for (const c of curated) console.log(`    ${c.file} — ${c.why}`);
}
if (issues.length) {
  console.log(`\n  NEEDS A DECISION (${issues.length}) — reported, never guessed:`);
  for (const i of issues) console.log(`    [${i.problem}] ${i.file} — ${i.detail}`);
}
if (oversized.length) {
  console.log(`\n  OVERSIZED (>4MB, should be compressed before launch):`);
  for (const o of oversized) console.log(`    ${o.mb} MB  ${o.file}`);
}
console.log(`\n${checkOnly ? 'Check' : 'Import'} complete.\n`);
