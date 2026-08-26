#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO — curated City Reach landmark importer
   ---------------------------------------------------------------
   Reads the operator-curated dataset, validates it, and publishes the
   MAPCO-owned photos into a public asset folder.

     landmarks photos/            (operator drop folder, any filename)
       → validate coordinate
       → confirm the image file exists AND is really an image
       → normalise the extension to the true image type
       → copy to v2/public/landmarks/<id>.<ext>
       → emit v2/public/landmarks/index.json

   Nothing is invented. A landmark with a bad coordinate or a missing
   photo is REPORTED, not silently dropped or back-filled with a Google
   image. The photo is copied once — never inlined as base64, never
   duplicated per consumer.

   Usage:  node scripts/import-landmarks.mjs [--check]
           --check validates and reports without writing anything.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const V2 = resolve(HERE, '..');
const REPO = resolve(V2, '..');
const SOURCE_PHOTOS = join(REPO, 'landmarks photos');
const OUT_DIR = join(V2, 'public', 'landmarks');
const DATASET = join(V2, 'src', 'packages', 'property-intelligence', 'landmarks', 'dataset.ts');

const checkOnly = process.argv.includes('--check');

/* ── read the dataset without a TS toolchain ──────────────────── */
function loadDataset() {
  const source = readFileSync(DATASET, 'utf8');
  const start = source.indexOf('[', source.indexOf('CURATED_LANDMARKS'));
  const end = source.lastIndexOf('];');
  if (start < 0 || end < 0) throw new Error('could not locate CURATED_LANDMARKS array');
  const body = source.slice(start, end + 1);
  // The array is pure data; evaluate it in isolation.
  // eslint-disable-next-line no-new-func
  return new Function(`return ${body}`)();
}

/* ── real image type from the file signature ──────────────────── */
function imageType(path) {
  const head = readFileSync(path).subarray(0, 16);
  const hex = head.toString('hex');
  if (hex.startsWith('ffd8ff')) return 'jpg';
  if (hex.startsWith('89504e47')) return 'png';
  if (hex.startsWith('52494646') && head.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (head.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('ascii');
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
    return 'heic';
  }
  if (hex.startsWith('47494638')) return 'gif';
  return null;
}

const CURATED_REGION = { minLat: 30.2, maxLat: 31.2, minLng: 76.3, maxLng: 77.2 };

function coordinateError(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'not finite numbers';
  if (lat < -90 || lat > 90) return `latitude ${lat} out of range`;
  if (lng < -180 || lng > 180) return `longitude ${lng} out of range`;
  if (lat < CURATED_REGION.minLat || lat > CURATED_REGION.maxLat
    || lng < CURATED_REGION.minLng || lng > CURATED_REGION.maxLng) {
    return `outside the curated Tri-City region (${lat}, ${lng})`;
  }
  return null;
}

/* ── run ──────────────────────────────────────────────────────── */
const rows = loadDataset();
const issues = [];
const imported = [];
const seenIds = new Set();
const usedFiles = new Set();

if (!existsSync(SOURCE_PHOTOS)) {
  console.error(`Curated photo folder not found: ${SOURCE_PHOTOS}`);
  process.exit(2);
}
if (!checkOnly) mkdirSync(OUT_DIR, { recursive: true });

for (const row of rows) {
  if (seenIds.has(row.id)) {
    issues.push({ id: row.id, name: row.name, problem: 'duplicate-id', detail: 'id appears more than once' });
    continue;
  }
  seenIds.add(row.id);

  const coordProblem = coordinateError(row.latitude, row.longitude);
  if (coordProblem) {
    issues.push({ id: row.id, name: row.name, problem: 'invalid-coordinate', detail: coordProblem });
    continue; // a landmark without a trustworthy location is not importable
  }

  let image = null;
  if (!row.imageFile) {
    issues.push({ id: row.id, name: row.name, problem: 'missing-image', detail: 'no photo supplied for this landmark' });
  } else {
    const source = join(SOURCE_PHOTOS, row.imageFile);
    if (!existsSync(source)) {
      issues.push({ id: row.id, name: row.name, problem: 'image-not-found', detail: `file not in the photo folder: ${row.imageFile}` });
    } else {
      const type = imageType(source);
      if (!type) {
        issues.push({ id: row.id, name: row.name, problem: 'image-not-found', detail: `${row.imageFile} is not a recognised image` });
      } else {
        usedFiles.add(row.imageFile);
        const target = `${row.id}.${type}`;
        image = `/landmarks/${target}`;
        if (!checkOnly) copyFileSync(source, join(OUT_DIR, target));
      }
    }
  }

  imported.push({
    id: row.id, name: row.name,
    latitude: row.latitude, longitude: row.longitude,
    category: row.category, city: row.city,
    ...(row.locality ? { locality: row.locality } : {}),
    recognition: row.recognition,
    image,
    active: true,
  });
}

/* Photos in the drop folder that no landmark claims. */
const orphanPhotos = readdirSync(SOURCE_PHOTOS)
  .filter((f) => statSync(join(SOURCE_PHOTOS, f)).isFile())
  .filter((f) => !usedFiles.has(f));

if (!checkOnly) {
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({
    version: 1,
    generatedFrom: 'src/packages/property-intelligence/landmarks/dataset.ts',
    count: imported.length,
    landmarks: imported,
  }, null, 2)}\n`);

  /* A runtime-neutral module as well as the JSON. The Supabase Edge
     Function runs on Deno with no filesystem access to public/, so it
     imports this instead of reading index.json. Generated, never edited
     by hand — re-running the importer is the only way to change it. */
  const module = [
    '/* GENERATED by scripts/import-landmarks.mjs — do not edit.',
    '   Source: landmarks/dataset.ts + the curated photo folder.',
    '   Re-run the importer to regenerate. */',
    "import type { CuratedLandmark } from './types.ts';",
    '',
    'export const CURATED_LANDMARK_LIBRARY: readonly CuratedLandmark[] = [',
    ...imported.map((l) => `  ${JSON.stringify({ ...l, createdAt: undefined, updatedAt: undefined })},`
      .replace(/,"createdAt":undefined|,"updatedAt":undefined/g, '')),
    '];',
    '',
  ].join('\n');
  writeFileSync(join(V2, 'src', 'packages', 'property-intelligence', 'landmarks', 'library.ts'), module);
}

/* ── report ───────────────────────────────────────────────────── */
const withPhoto = imported.filter((l) => l.image).length;
console.log(`\nMAPCO curated City Reach landmarks${checkOnly ? ' (check only, nothing written)' : ''}`);
console.log(`  dataset rows          ${rows.length}`);
console.log(`  imported              ${imported.length}`);
console.log(`  with a curated photo  ${withPhoto}`);
console.log(`  without a photo       ${imported.length - withPhoto}`);

if (issues.length) {
  console.log(`\n  ISSUES (${issues.length}) — reported, never back-filled:`);
  for (const issue of issues) {
    console.log(`    [${issue.problem}] ${issue.name} (${issue.id}) — ${issue.detail}`);
  }
}
if (orphanPhotos.length) {
  console.log(`\n  PHOTOS WITH NO LANDMARK ROW (${orphanPhotos.length}):`);
  for (const f of orphanPhotos) console.log(`    ${f}`);
}

const blocking = issues.filter((i) => i.problem === 'invalid-coordinate' || i.problem === 'duplicate-id');
if (blocking.length) {
  console.error(`\n${blocking.length} blocking issue(s). Import incomplete.`);
  process.exit(1);
}
console.log(`\n${checkOnly ? 'Check' : 'Import'} complete.\n`);
