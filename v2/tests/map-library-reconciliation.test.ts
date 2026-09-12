import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { MAP_REGISTRY } from '../src/packages/maps/sector-map-registry';
import { pinForMap, resolvePropertyMaps } from '../src/packages/maps/registry-types';

const root = new URL('../../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('docs/maps/compatibility-baseline.json', root), 'utf8'));
const decisions = JSON.parse(readFileSync(new URL('docs/maps/import-decisions.json', root), 'utf8'));
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('committed map-library reconciliation', () => {
  it('preserves every existing ID, path, intrinsic dimensions and exact raster bytes', () => {
    for (const old of baseline.maps) {
      const actual = MAP_REGISTRY.find(m => m.id === old.id);
      expect(actual, old.id).toBeDefined();
      expect(actual!.image).toBe(old.image);
      expect(actual!.dimensions).toEqual(old.dimensions);
      expect(sha(readFileSync(new URL(`v2/public${old.image}`, root))), old.id).toBe(old.sha256);
      expect(pinForMap(old.id, {mapId: old.id, x: 0.23, y: 0.81})).toEqual({x:0.23,y:0.81});
    }
  });
  it('contains unique IDs and no new duplicate image bytes', () => {
    expect(new Set(MAP_REGISTRY.map(m => m.id)).size).toBe(MAP_REGISTRY.length);
    const oldHashes = new Set(baseline.maps.map((m: {sha256:string}) => m.sha256));
    const newHashes = new Set();
    for (const row of decisions.imports) {
      const map = MAP_REGISTRY.find(m => m.id === row.id)!;
      const hash = sha(readFileSync(new URL(`v2/public${map.image}`, root)));
      expect(oldHashes.has(hash), row.id).toBe(false);
      expect(newHashes.has(hash), row.id).toBe(false);
      newHashes.add(hash);
    }
  });
  it('has source/output parity and safe local asset paths for every entry', () => {
    const index = JSON.parse(readFileSync(new URL('v2/public/maps/index.json', root), 'utf8'));
    expect(index.maps).toEqual(MAP_REGISTRY);
    for (const m of MAP_REGISTRY) {
      expect(m.image).toMatch(/^\/maps\/[a-z0-9-]+\.(png|jpg|webp)$/);
      expect(existsSync(new URL(`v2/public${m.image}`, root))).toBe(true);
    }
    for (const m of decisions.imports) {
      const source=readFileSync(new URL(`non%203d%20maps/legacy/${m.id}.jpg`,root));
      const output=readFileSync(new URL(`v2/public/maps/${m.id}.jpg`,root));
      expect(source.equals(output),m.id).toBe(true);
      const gitBlob=createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
      expect(gitBlob,m.id).toBe(m.blob);
    }
  });
  it('reproduces the typed registry using only current repository inputs', () => {
    // Hashing every source and published raster is an integration check, not a 5s unit test.
    expect(() => execFileSync(process.execPath,['scripts/import-maps.mjs','--check'],{cwd:new URL('../',import.meta.url), timeout: 25000})).not.toThrow();
  }, 30000);
  it('uses printed regions and sector numbers, not misleading donor paths', () => {
    expect(MAP_REGISTRY.find(m=>m.id==='chandigarh-sector-15')?.city).toBe('Chandigarh');
    expect(MAP_REGISTRY.find(m=>m.id==='chandigarh-sector-31')?.sector).toBe('31');
    expect(MAP_REGISTRY.find(m=>m.id==='chandigarh-sector-42')?.sector).toBe('42');
    expect(MAP_REGISTRY.find(m=>m.id==='eco-city-1')?.city).toBe('New Chandigarh');
    expect(MAP_REGISTRY.find(m=>m.id==='gamada-aerocity-mohali')?.kind).toBe('PROJECT_MAP');
    expect(resolvePropertyMaps({city:'Panchkula',sector:'Sector 10'},MAP_REGISTRY).sectorMap?.id).toBe('scctor-10-p');
  });
  it('never transfers a saved placement onto another reference sheet', () => {
    expect(pinForMap('aerocity-block-c-reference',{mapId:'gamada-aerocity-mohali',x:0.3,y:0.6})).toBeNull();
  });
});
