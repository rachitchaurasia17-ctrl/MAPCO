#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · REAL-PROVIDER smoke test
   ---------------------------------------------------------------
   Runs ONE complete generation against the live providers:
     Gemini 3.6 Flash on Vertex AI (Maps grounding)  — Phase 1 + Phase 2
     Google Places (New)                            — identity + details
     Google Place Photos                            — persisted to disk
     Google Routes                                  — distance/duration/polyline

   THIS SPENDS REAL MONEY (roughly ₹10–40 for one fresh property).
   It is deliberately NOT part of `npm test` and never runs in CI.

   Requires:
     supabase/.env.local  →  GOOGLE_MAPS_SERVER_KEY
     gcloud auth application-default login   (for Vertex)

   Usage:
     node scripts/property-intelligence-smoke.mjs
     node scripts/property-intelligence-smoke.mjs --lat 30.68 --lng 76.70 \
       --locality "Sector 78" --city Mohali
   ═══════════════════════════════════════════════════════════════ */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runPropertyIntelligence,
  GeminiVertexTextModel,
  GooglePlacesClient,
  GoogleRoutesClient,
  DEFAULT_LIMITS,
  DEFAULT_PRICING,
  formatInr,
} from '../src/packages/property-intelligence/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const v2Root = resolve(here, '..');
const repoRoot = resolve(v2Root, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* absent is fine */ }
  return out;
}

const secrets = loadEnv(join(repoRoot, 'supabase', '.env.local'));
const MAPS_KEY = secrets.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_SERVER_KEY || '';
if (!MAPS_KEY) {
  console.error('GOOGLE_MAPS_SERVER_KEY is not set (supabase/.env.local). Aborting.');
  process.exit(1);
}

let adc;
try {
  adc = execSync('gcloud auth application-default print-access-token', {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch {
  console.error('No ADC token. Run: gcloud auth application-default login');
  process.exit(1);
}

/* ── filesystem store, mirroring the production caches ──────────── */
const cacheDir = join(v2Root, '.pi-cache');
const mediaDir = join(v2Root, 'public', 'place-media', 'places');
for (const dir of [cacheDir, join(cacheDir, 'places'), join(cacheDir, 'routes'), mediaDir]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
const safeId = (v) => String(v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
const readJson = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch { return null; } };
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));

const store = {
  async getPlaceMedia(ids) {
    const out = new Map();
    for (const id of new Set(ids.filter(Boolean))) {
      const rec = readJson(join(cacheDir, 'places', `${safeId(id)}.json`));
      if (rec) out.set(id, rec);
    }
    return out;
  },
  async putPlaceMedia(media) {
    writeJson(join(cacheDir, 'places', `${safeId(media.placeId)}.json`), media);
    return media;
  },
  async storePhoto(placeId, bytes, mimeType) {
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const file = `${safeId(placeId)}.${ext}`;
    writeFileSync(join(mediaDir, file), bytes);
    return { storagePath: `places/${file}`, publicUrl: `/place-media/places/${file}` };
  },
  async getRoutes(originKey, keys) {
    const out = new Map();
    for (const key of new Set(keys.filter(Boolean))) {
      const rec = readJson(join(cacheDir, 'routes', `${safeId(originKey + '_' + key)}.json`));
      if (rec) out.set(key, rec);
    }
    return out;
  },
  async putRoute(originKey, record) {
    writeJson(join(cacheDir, 'routes', `${safeId(originKey + '_' + record.destinationKey)}.json`), record);
  },
};

const point = {
  latitude: Number(arg('lat', '30.681991')),
  longitude: Number(arg('lng', '76.702441')),
};
const locality = arg('locality', 'Sector 78');
const city = arg('city', 'Mohali');

console.log('MAPCO Property Intelligence — REAL provider run');
console.log(`  property   ${point.latitude}, ${point.longitude} — ${locality}, ${city}`);
console.log('  providers  Vertex Gemini (grounded) · Places (New) · Place Photos · Routes');
console.log('  WARNING    this spends real money\n');

const started = Date.now();
const result = await runPropertyIntelligence(
  {
    dealerId: 'smoke-dealer',
    propertyId: `smoke-${point.latitude}-${point.longitude}`,
    point, locality, city, propertySector: locality,
    refreshReason: 'smoke-test',
  },
  {
    model: new GeminiVertexTextModel({
      project: 'mapco-504912', location: 'global', model: 'gemini-3.6-flash',
      getAccessToken: async () => adc,
    }),
    places: new GooglePlacesClient({ apiKey: MAPS_KEY, regionCode: 'IN' }),
    routes: new GoogleRoutesClient({ apiKey: MAPS_KEY, regionCode: 'IN' }),
    store,
    limits: DEFAULT_LIMITS,
    pricing: DEFAULT_PRICING,
    now: () => new Date().toISOString(),
    log: (level, event, data) => {
      const line = data ? `${event} ${JSON.stringify(data)}` : event;
      if (level === 'error') console.error('  !', line);
      else if (level === 'warn') console.warn('  ~', line);
      else console.log('  ·', line);
    },
  },
);

const { viewModel: vm, usage } = result;
const line = (s = '') => console.log(s);

line();
line('════════ RESULT ════════');
line(`status            ${vm.status}${vm.reason ? ` (${vm.reason})` : ''}`);
line(`stage             ${usage.stage}`);
line(`elapsed           ${((Date.now() - started) / 1000).toFixed(1)}s`);
line();
line('──── Phase 1 → normalization ────');
line(`candidate universe   ${usage.candidateCount}`);
line(`places resolved      ${usage.resolvedCount}`);
line();
line('──── Phase 2 (final judgment) ────');
line(`local categories     ${vm.local.length}`);
line(`city landmarks       ${vm.city.length}`);
line(`repair attempts      ${usage.repairAttempts}`);
line();

for (const category of vm.local) {
  line(`  ${category.category}`);
  for (const p of category.places) {
    const distance = p.routeStatus === 'ok' ? `${p.distanceLabel} · ${p.durationLabel}` : `(${p.routeStatus})`;
    line(`    ${p.rank}. ${p.name.padEnd(38)} ${distance}${p.image ? '  [photo]' : ''}`);
  }
}
line();
line('  CITY REACH (unranked)');
for (const p of vm.city) {
  const distance = p.routeStatus === 'ok' ? `${p.distanceLabel} · ${p.durationLabel}` : `(${p.routeStatus})`;
  line(`    - ${p.name.padEnd(38)} ${distance}${p.image ? '  [photo]' : ''}  ${p.category}`);
}

const withPhoto = [...vm.local.flatMap((c) => c.places), ...vm.city].filter((p) => p.image);
const withRoute = [...vm.local.flatMap((c) => c.places), ...vm.city].filter((p) => p.routeStatus === 'ok');

line();
line('──── Phase 3 (deterministic enrichment) ────');
line(`photos stored        ${usage.photosFetched}   reused ${usage.photosReused}`);
line(`routes computed      ${usage.routesComputed}   reused ${usage.routesReused}`);
line(`cards with a photo   ${withPhoto.length}`);
line(`cards with a route   ${withRoute.length}`);
if (withPhoto[0]) line(`sample photo         ${withPhoto[0].image}`);
if (withRoute[0]) {
  line(`sample route         ${withRoute[0].name} — ${withRoute[0].distanceMeters} m, `
    + `${withRoute[0].durationSeconds}s, polyline ${withRoute[0].encodedPolyline?.length ?? 0} chars`);
}

line();
line('──── COST (estimated from recorded units) ────');
line(`pricing              ${usage.pricingVersion}  @ ₹${usage.inrPerUsd}/USD`);
for (const event of usage.events) {
  line(`  ${event.operation.padEnd(24)} units=${String(event.units).padStart(7)}  `
    + `${event.cacheHit ? 'CACHED' : formatInr(event.estimatedInr).padStart(8)}`);
}
line(`TOTAL                ${formatInr(usage.totalInr)}`);
line();

const outPath = join(cacheDir, 'smoke-result.json');
writeJson(outPath, {
  ranAt: new Date().toISOString(),
  input: { point, locality, city },
  viewModel: vm,
  usage,
  candidateUniverse: result.candidateUniverse,
  phase2Output: result.phase2Output,
});
line(`full record written to ${outPath}`);
process.exit(vm.status === 'ready' ? 0 : 1);
