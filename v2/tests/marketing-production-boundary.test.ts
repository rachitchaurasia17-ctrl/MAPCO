import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

describe('Marketing production boundary', () => {
  const migration = read('supabase/migrations/20260821000100_marketing_operations_production.sql');
  const edge = read('supabase/functions/marketing-ops/index.ts');
  const ops = read('v2/src/apps/ops/main.ts');
  const gateway = read('v2/src/packages/marketing/ops/gateway.ts');
  const dealer = read('v2/src/apps/marketing/main.ts');

  it('enforces exactly four outputs per day and 28 per week', () => {
    expect(migration).toContain('check (per_day = 4)');
    expect(migration).toContain('check (target_count = 28)');
    expect(migration).toContain('for v_day in 0..6 loop');
    expect(migration).toContain('for v_slot in 0..3 loop');
    expect(migration).toContain("weekly slot invariant violated");
    expect(migration).not.toMatch(/greatest\(1,\s*least\(8/i);
  });

  it('keeps Ops internal and dealer-scoped at every mutation', () => {
    expect(migration).toContain('marketing_internal_operators');
    expect(migration).toContain('plotmap_marketing_actor_can_operate');
    expect(migration).toContain('internal_operator_required');
    expect(migration).toContain('public.plotmap_dealer_is_active(p_dealer_id)');
    expect(migration).toContain('protected_slot');
    expect(migration).toContain('not_authorised');
  });

  it('uses one canonical creative/schedule/publication pipeline', () => {
    expect(migration).toContain('insert into public.marketing_creatives');
    expect(migration).toContain('insert into public.marketing_schedule_items');
    expect(migration).toContain('public.marketing_publications');
    expect(migration).toContain("'ready_to_publish'");
    expect(migration).not.toMatch(/insert into public\.(?:social_posts|dealer_creatives|published_posts)/i);
  });

  it('stores creative bytes privately and never returns storage paths to either UI', () => {
    expect(migration).toContain("'marketing-creatives', 'marketing-creatives', false");
    expect(migration).toContain('marketing creative upload by operator');
    expect(edge).toContain('delete property.photoRefs');
    expect(edge).toContain('delete asset.path; delete asset.bucket');
    expect(edge).toContain('creative.asset = {');
    expect(edge).toContain('projection_rejected');
    expect(ops).not.toContain('fileToDataUrl');
    expect(ops).not.toContain('localOpsStore');
  });

  it('keeps property packs allow-listed and excludes private fields and coordinates', () => {
    const inventory = migration.slice(
      migration.indexOf('plotmap_marketing_ops_inventory_for'),
      migration.indexOf('plotmap_marketing_ops_week_for'),
    );
    expect(inventory).toContain("'type'");
    expect(inventory).toContain("'city'");
    expect(inventory).toContain("'photoRefs'");
    for (const forbidden of ["'owner'", "'commission'", "'notes'", "'latitude'", "'longitude'", "'location'"]) {
      expect(inventory).not.toContain(forbidden);
    }
  });

  it('never silently chooses local persistence in Supabase mode', () => {
    expect(gateway).toContain("activeDataMode() === 'supabase'");
    expect(gateway).toContain('new SupabaseOpsGateway() : new MockOpsGateway()');
    expect(gateway).not.toMatch(/catch[^}]+localOpsStore/s);
    expect(gateway).toContain("reader.readAsDataURL(file)");
    expect(gateway).toContain("status: 'uploaded'");
    expect(gateway).toContain("if (detectError) throw detectError");
  });

  it('removes fake dealer marketing content and leaves publishing fail-closed', () => {
    for (const fixture of ['const PROPS', 'const TODAY', 'reachChartSvg', '8,400 people', 'Posts published', 'Hot right now']) {
      expect(dealer).not.toContain(fixture);
    }
    expect(dealer).toContain('Publishing not connected');
    expect(dealer).toContain('provider credential and connector report success');
    expect(dealer).toContain('No verified platform metrics yet');
    expect(dealer).toContain("creative.caption || 'No caption was supplied with this creative.'");
    expect(dealer).not.toContain('week-view');
  });

  it('keeps mid-week handling idempotent without a 29th slot', () => {
    expect(migration).toContain('unique (plan_id, property_id)');
    expect(migration).toContain('on conflict (plan_id, property_id) do nothing');
    expect(migration).toContain("v_slot.status not in ('waiting','failed')");
    expect(migration.includes('No safe slot available')).toBe(false);
    expect(ops).toContain('No safe slot available');
    expect(ops).toContain('always remains exactly 28 outputs');
  });
});
