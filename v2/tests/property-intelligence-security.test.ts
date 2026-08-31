import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const repo = resolve(__dirname, '../..');
const v2 = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8');

const MIGRATION = read('supabase/migrations/20260831000100_property_intelligence_v3.sql');

/* ═══════════════════════════════════════════════════════════════
   No privileged credential may reach the browser
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · credential boundary', () => {
  const browserRoots = ['src/apps', 'src/packages/ui', 'src/packages/data'];

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(v2, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
    }
    return out;
  }

  const browserFiles = browserRoots.flatMap((root) => walk(root));

  it('never imports a server-only provider into browser code', () => {
    // The provider clients hold the Google server key and the Vertex token.
    // Only the Vite middleware and the Edge Function may import them.
    const offenders = browserFiles.filter((file) => {
      const source = readFileSync(join(v2, file), 'utf8');
      return /providers\/(google-places|google-routes|gemini-vertex)/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('never references the Google server key or Vertex credentials in browser code', () => {
    const offenders = browserFiles.filter((file) => {
      const source = readFileSync(join(v2, file), 'utf8');
      return /GOOGLE_MAPS_SERVER_KEY|GOOGLE_SERVICE_ACCOUNT_JSON|VERTEX_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY/
        .test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps the dev middleware out of production builds', () => {
    const plugin = readFileSync(join(v2, 'vite-plugins/property-intelligence-dev.ts'), 'utf8');
    expect(plugin).toContain("apply: 'serve'");
  });

  it('never sends a dealer id from the browser — the server derives it', () => {
    const client = readFileSync(
      join(v2, 'src/apps/earth/intel/property-intelligence-client.ts'), 'utf8',
    );
    expect(client).not.toMatch(/dealerId\s*:/);
    expect(client).toContain('Authorization');
  });

  it('reads the canonical coordinate from the database in production', () => {
    const edge = read('supabase/functions/property-intelligence/index.ts');
    // The coordinate used for generation comes from the RPC result, never
    // from the request body.
    expect(edge).toContain('ctx.location?.latitude');
    expect(edge).toContain('plotmap_property_intelligence_get');
  });
});

/* ═══════════════════════════════════════════════════════════════
   Tenant / role / account-state enforcement
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · database authorization', () => {
  it('gates the caller-facing read on member, role AND account state', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('function public.plotmap_property_intelligence_get'));
    const body = fn.slice(0, fn.indexOf('$$;'));
    expect(body).toContain('plotmap_is_active_member()');
    expect(body).toContain("plotmap_current_role() = 'viewer'");
    expect(body).toContain('plotmap_dealer_is_active(v_dealer)');
    // Tenancy is derived, never accepted from the caller.
    expect(body).toContain('public.plotmap_current_dealer_id()');
    expect(fn).not.toMatch(/plotmap_property_intelligence_get\s*\(\s*p_dealer_id/);
  });

  it('scopes the property lookup to the caller dealer and excludes deleted rows', () => {
    expect(MIGRATION).toContain('and r.dealer_id = v_dealer');
    expect(MIGRATION).toContain('and coalesce(r.deleted, false) = false');
  });

  it('applies the viewer and account-state gate to the RLS read policies', () => {
    const policy = MIGRATION.slice(MIGRATION.indexOf('create policy "property intelligence dealer read"'));
    const clause = policy.slice(0, policy.indexOf(';'));
    expect(clause).toContain("plotmap_current_role() <> 'viewer'");
    expect(clause).toContain('plotmap_dealer_is_active');
    expect(clause).toContain('dealer_id = public.plotmap_current_dealer_id()');
  });

  it('restricts cost data to owners and managers', () => {
    const policy = MIGRATION.slice(MIGRATION.indexOf('create policy "property intelligence cost read"'));
    expect(policy.slice(0, policy.indexOf(';')))
      .toContain("plotmap_current_role() in ('owner', 'manager')");
    const runsPolicy = MIGRATION.slice(
      MIGRATION.indexOf('create policy "property intelligence runs dealer read"'),
    );
    expect(runsPolicy.slice(0, runsPolicy.indexOf(';')))
      .toContain("plotmap_current_role() in ('owner', 'manager')");
    expect(MIGRATION).toContain(
      'revoke all on table public.property_intelligence from public, anon, authenticated',
    );
    const getter = MIGRATION.slice(MIGRATION.indexOf('function public.plotmap_property_intelligence_get'));
    expect(getter.slice(0, getter.indexOf('$$;'))).not.toContain("'lastCostInr'");
  });

  it('grants every writer to service_role only', () => {
    for (const fn of [
      'plotmap_property_intelligence_store_v3',
      'plotmap_property_intelligence_claim',
      'plotmap_property_intelligence_release',
      'plotmap_place_registry_get',
      'plotmap_place_registry_put',
      'plotmap_pi_routes_get',
      'plotmap_pi_routes_put',
      'plotmap_pi_record_cost',
      'plotmap_property_intelligence_record_run_v3',
    ]) {
      const grants = MIGRATION.split('\n').filter((line) => line.includes(fn) && line.includes('grant execute'));
      expect(grants.length, `${fn} must be granted`).toBeGreaterThan(0);
      expect(grants.every((line) => line.includes('service_role')), `${fn} is service_role only`).toBe(true);
      expect(grants.some((line) => /to (anon|authenticated)/.test(line)), `${fn} not exposed`).toBe(false);
    }
  });

  it('revokes the global caches from anon and authenticated', () => {
    expect(MIGRATION).toContain('revoke all on table public.place_registry from public, anon, authenticated');
    expect(MIGRATION).toContain('revoke all on table public.property_intelligence_routes from public, anon, authenticated');
  });

  it('enables RLS on every new table', () => {
    for (const table of [
      'public.place_registry',
      'public.property_intelligence_routes',
      'public.property_intelligence_cost_events',
    ]) {
      expect(MIGRATION).toContain(`alter table ${table} enable row level security`);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   Generation lease — duplicate spend protection
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · duplicate-generation protection', () => {
  it('serializes claims with an advisory lock and honours a lease', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('function public.plotmap_property_intelligence_claim'));
    const body = fn.slice(0, fn.indexOf('$$;'));
    expect(body).toContain('pg_advisory_xact_lock');
    expect(body).toContain("generation_status = 'running'");
    expect(body).toContain("'already_running'");
    // The lease must expire so a crashed run cannot wedge a property.
    expect(body).toContain('generation_started_at >');
  });

  it('claims before spending and releases afterwards in the Edge Function', () => {
    const edge = read('supabase/functions/property-intelligence/index.ts');
    const claimAt = edge.indexOf('plotmap_property_intelligence_claim');
    const runAt = edge.indexOf('runPropertyIntelligence(');
    expect(claimAt).toBeGreaterThan(0);
    expect(claimAt).toBeLessThan(runAt);
    expect(edge).toContain('plotmap_property_intelligence_release');
    expect(edge).toContain('makeId: () => runId');
  });

  it('fences persistence with the current lease token', () => {
    const fn = MIGRATION.slice(
      MIGRATION.indexOf('function public.plotmap_property_intelligence_store_v3'),
    );
    const body = fn.slice(0, fn.indexOf('$$;'));
    expect(body).toContain("generation_status = 'running'");
    expect(body).toContain('generation_run_id = v_run_id');
    expect(body).toContain("'stale_generation'");
    const edge = read('supabase/functions/property-intelligence/index.ts');
    expect(edge).toContain("property_intelligence_store_${stored?.reason");
  });

  it('guards against a concurrent duplicate run in dev too', () => {
    const plugin = readFileSync(join(v2, 'vite-plugins/property-intelligence-dev.ts'), 'utf8');
    expect(plugin).toContain('inFlight');
  });
});

/* ═══════════════════════════════════════════════════════════════
   Place media storage posture
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · place media storage', () => {
  it('creates a public-read bucket restricted to service-role writes', () => {
    expect(MIGRATION).toContain("values (\n  'place-media', 'place-media', true");
    for (const op of ['insert', 'update', 'delete']) {
      const policy = MIGRATION.slice(MIGRATION.indexOf(`create policy "place media service ${op}"`));
      expect(policy.slice(0, 200)).toContain('to service_role');
    }
    // No policy may grant a browser role write access to place media.
    const placePolicies = MIGRATION.split('\n')
      .filter((line) => line.includes('place media service'));
    expect(placePolicies.some((line) => /to authenticated|to anon/.test(line))).toBe(false);
  });

  it('keys stored media by PLACE, not by property or dealer', () => {
    expect(MIGRATION).toContain('place_id text primary key');
    const table = MIGRATION.slice(
      MIGRATION.indexOf('create table if not exists public.place_registry'),
    );
    expect(table.slice(0, table.indexOf(');'))).not.toContain('dealer_id');
  });

  it('records the provenance Google attribution requires', () => {
    const table = MIGRATION.slice(
      MIGRATION.indexOf('create table if not exists public.place_registry'),
    );
    const body = table.slice(0, table.indexOf(');'));
    for (const column of [
      'google_photo_name', 'source', 'storage_path', 'mime_type',
      'width_px', 'height_px', 'attributions', 'retrieved_at', 'status',
    ]) {
      expect(body, `place_registry.${column}`).toContain(column);
    }
  });

  it('documents the Google approval that permits persistent storage', () => {
    expect(MIGRATION).toContain('docs/google-place-photos-approval.md');
    const approval = read('docs/google-place-photos-approval.md');
    expect(approval.length).toBeGreaterThan(200);
  });
});

/* ═══════════════════════════════════════════════════════════════
   Cost ledger completeness
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · cost ledger schema', () => {
  it('stores estimated cost, never a claimed billed amount', () => {
    const table = MIGRATION.slice(
      MIGRATION.indexOf('create table if not exists public.property_intelligence_cost_events'),
    );
    const body = table.slice(0, table.indexOf(');'));
    expect(body).toContain('estimated_micro_usd');
    expect(body).toContain('estimated_inr');
    expect(body).toContain('pricing_version');
    expect(body).toContain('inr_per_usd');
    expect(body).toContain('cache_hit');
    expect(body).toContain('event_index');
    expect(body).toContain('avoided_micro_usd');
    expect(body).toContain('avoided_inr');
    expect(body).not.toContain('actual_cost');
  });

  it('can aggregate by dealer, property, run and day', () => {
    expect(MIGRATION).toContain('pi_cost_events_dealer_day_idx');
    expect(MIGRATION).toContain('pi_cost_events_run_idx');
    expect(MIGRATION).toContain('pi_cost_events_property_idx');
    expect(MIGRATION).toContain('unique (run_id, event_index)');
    expect(MIGRATION).toContain("'savedInr', coalesce(round(sum(avoided_inr), 2), 0)");
  });

  it('records cache reloads at zero provider cost and awaits persistence', () => {
    const edge = read('supabase/functions/property-intelligence/index.ts');
    expect(edge).toContain("operation: 'pipeline_cache_hit'");
    expect(edge).toContain('await recordCost(dealerId, propertyId');
    expect(edge).toContain("plotmap_property_intelligence_record_run_v3");
  });
});

describe('Property Intelligence · Earth integration contracts', () => {
  const detail = read('v2/src/apps/earth/property-detail.ts');

  it('renders an explicit regeneration control and truthful busy polling state', () => {
    expect(detail).toContain('data-pd="intel-refresh"');
    expect(detail).toContain("vm.status === 'generating'");
    expect(detail).toContain('ensureIntelLoaded(p, { retry: true })');
    expect(detail).toContain('Another generation is finishing for this property');
    expect(detail).not.toContain('The intelligence service is rate-limited right now');
  });

  it('uses the real sparse reason and retargets every alternative selection', () => {
    expect(detail).toContain("case 'insufficient_candidates':");
    expect(detail).not.toContain("case 'insufficient_results':");
    expect(detail).toContain('if (next) setIntelRoute(next.id)');
  });
});
