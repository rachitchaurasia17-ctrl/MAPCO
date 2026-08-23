/* Generates the committed road-geometry snapshot the Edge Function bundles.
   node --experimental-transform-types scripts/build-roads-json.ts */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseRoadFeatureCollection, type RoadGeometry } from '../src/packages/property-intelligence/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const V2 = join(HERE, '..');
const REPO = join(V2, '..');
const roadsDir = join(V2, 'src', 'apps', 'earth', 'data', 'roads');
const outDir = join(REPO, 'supabase', 'functions', 'property-intelligence');
mkdirSync(outDir, { recursive: true });

const roads: RoadGeometry[] = [];
for (const file of readdirSync(roadsDir).filter((f) => f.endsWith('.geojson'))) {
  const parsed = parseRoadFeatureCollection(readFileSync(join(roadsDir, file), 'utf8'), file);
  if (parsed) roads.push(parsed);
}
writeFileSync(join(outDir, 'roads.json'), JSON.stringify(roads));
console.log(`wrote ${roads.length} roads → supabase/functions/property-intelligence/roads.json`);
console.log('names:', roads.map((r) => r.name).join(', '));
