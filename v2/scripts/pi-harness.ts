/* Live end-to-end harness for the Property Intelligence core pipeline.
   Runs the REAL path against REAL APIs from Node:
     canonical point → Vertex gemini-3.6-flash + Maps Grounding
     → Places resolution + MAPCO road nearest-point → Route Matrix.
   Usage:  node --experimental-strip-types scripts/pi-harness.ts
   Secrets: GOOGLE_MAPS_SERVER_KEY from supabase/.env.local; Vertex via ADC. */
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  runPropertyIntelligence, GeminiMapsDiscoveryProvider, GooglePlacesResolver,
  GoogleRoutesClient, microUsdToUsd, type RoadGeometry, type GeoPoint,
} from '../src/packages/property-intelligence/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const V2 = join(HERE, '..');
const REPO = join(V2, '..');

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
    }
  } catch { /* ignore */ }
  return out;
}

const env = loadEnv(join(REPO, 'supabase', '.env.local'));
const MAPS_KEY = env.GOOGLE_MAPS_SERVER_KEY;
const PROJECT = 'mapco-504912';
const LOCATION = 'global';
const MODEL = 'gemini-3.6-flash';

let tokenCache = { value: '', at: 0 };
function adcToken(): string {
  if (tokenCache.value && Date.now() - tokenCache.at < 40 * 60 * 1000) return tokenCache.value;
  const value = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8', shell: true as any }).trim();
  tokenCache = { value, at: Date.now() };
  return value;
}

function loadRoads(): RoadGeometry[] {
  const dir = join(V2, 'src', 'apps', 'earth', 'data', 'roads');
  const roads: RoadGeometry[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.geojson'))) {
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const feature = data?.features?.[0];
      const coords = feature?.geometry?.coordinates;
      if (feature?.geometry?.type !== 'LineString' || !Array.isArray(coords)) continue;
      const path: GeoPoint[] = coords
        .filter((c: unknown): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
        .map((c: [number, number]) => ({ latitude: c[1], longitude: c[0] }));
      if (path.length < 2) continue;
      const props = feature.properties ?? {};
      const name = String(props.name ?? file.replace(/\.geojson$/i, ''));
      const aliases = Array.isArray(props.aliases) ? props.aliases.map(String)
        : typeof props.aliases === 'string' ? props.aliases.split(',').map((s: string) => s.trim()) : [];
      roads.push({ id: file.replace(/\.geojson$/i, ''), name, aliases, path });
    } catch { /* skip */ }
  }
  return roads;
}

async function run(label: string, point: GeoPoint) {
  console.log(`\n\n════════════════════════════════════════════════════`);
  console.log(`  ${label}  (${point.latitude}, ${point.longitude})`);
  console.log(`════════════════════════════════════════════════════`);
  const deps = {
    discovery: new GeminiMapsDiscoveryProvider({
      project: PROJECT, location: LOCATION, model: MODEL,
      getAccessToken: async () => adcToken(), thinkingBudget: 1024,
    }),
    resolver: new GooglePlacesResolver({ apiKey: MAPS_KEY }),
    matrix: new GoogleRoutesClient({ apiKey: MAPS_KEY }),
    roads: loadRoads(),
    now: () => new Date().toISOString(),
    log: (lvl: string, ev: string, d?: unknown) => { if (lvl !== 'info') console.log(`   · ${lvl} ${ev}`, d ?? ''); },
  };
  const t0 = Date.now();
  const { viewModel, usage, inputDigest } = await runPropertyIntelligence(
    { dealerId: 'harness-dealer', propertyId: label.replace(/\s+/g, '-').toLowerCase(), point },
    deps as any,
  );
  console.log(`\n  status: ${viewModel.status}  ·  model: ${viewModel.model}  ·  ${Date.now() - t0}ms`);
  const rows = (list: typeof viewModel.dayToDay) =>
    list.forEach((p) => console.log(`     ${p.name.padEnd(48).slice(0, 48)} ${p.distanceLabel.padStart(8)}  ·  ${p.durationLabel}`));
  console.log(`\n  DAY TO DAY (${viewModel.dayToDay.length}):`);
  rows(viewModel.dayToDay);
  console.log(`\n  CITY REACH (${viewModel.cityReach.length}):`);
  rows(viewModel.cityReach);
  console.log(`\n  usage: in=${usage.inputTokens} out=${usage.outputTokens} grounding=${usage.groundingQueries} places=${usage.placesCalls} matrix=${usage.matrixElements} repair=${usage.repairAttempts}`);
  console.log(`  COST: ${microUsdToUsd(usage.costMicroUsd)} (${usage.costMicroUsd} µUSD)  ·  digest ${inputDigest.slice(0, 16)}…`);
}

if (!MAPS_KEY) { console.error('missing GOOGLE_MAPS_SERVER_KEY'); process.exit(1); }
await run('Mohali Sector 82 Aerocity belt', { latitude: 30.6725, longitude: 76.752 });
await run('New Chandigarh Mullanpur', { latitude: 30.79, longitude: 76.68 });
console.log('\n\nDONE');
