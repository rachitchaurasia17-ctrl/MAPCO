import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..', '..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260823000200_marketing_monthly_reels.sql'), 'utf8');
const gateway = readFileSync(resolve(root, 'v2/src/packages/marketing/monthly/gateway.ts'), 'utf8');
const broker = readFileSync(resolve(root, 'supabase/functions/marketing-ops/index.ts'), 'utf8');
const monthlySource = [
  'types.ts', 'period.ts', 'ledger.ts', 'media.ts', 'library.ts', 'gateway.ts',
].map((file) => readFileSync(resolve(root, 'v2/src/packages/marketing/monthly', file), 'utf8')).join('\n');

describe('Marketing monthly production boundary', () => {
  it('uses one monthly quota authority with exactly 30 Posts and 8 Reels', () => {
    expect(migration).toContain('create table if not exists public.marketing_periods');
    expect(migration).toContain('posts_entitled = 30');
    expect(migration).toContain('reels_entitled = 8');
    expect(migration).toContain('generate_series(1, 30)');
    expect(migration).toContain('monthly post slot invariant violated');
    expect(migration).toContain('post_quota_exhausted');
    expect(migration).toContain('reel_quota_exhausted');
  });

  it('enforces both quotas transactionally and idempotently', () => {
    expect(migration.match(/pg_advisory_xact_lock/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain('marketing_post_slots_idempotency_uidx');
    expect(migration).toContain('unique (dealer_id, period_id, submission_key)');
    expect(migration).toContain("'idempotency_conflict'");
    expect(migration).toContain("'entitlementConsumed', true");
  });

  it('retains legacy history but makes monthly periods the new authority', () => {
    expect(migration).not.toMatch(/drop table\s+public\.marketing_weekly_plans/i);
    expect(migration).not.toMatch(/delete from\s+public\.marketing_(creatives|publications|content_contexts)/i);
    expect(migration).toContain('Legacy Marketing V1 production-pack history');
    expect(migration).toContain('New entitlement work uses marketing_periods');
  });

  it('keeps raw and finished video private, validated, and non-duplicated', () => {
    expect(migration).toContain("'marketing-reel-raw', 'marketing-reel-raw', false");
    expect(migration).toContain("'marketing-reel-finished', 'marketing-reel-finished', false");
    expect(migration).toContain("p_mime not in ('video/mp4', 'video/quicktime', 'video/webm')");
    expect(migration).toContain('marketing_reel_assets_active_uidx');
    expect(migration).toContain("state = 'superseded'");
    expect(migration).toContain("'cleanup', v_cleanup");
    expect(gateway).not.toMatch(/return\s+\{[^}]*storage_path/is);
  });

  it('has server-side property ownership, sold-state, operator, and cross-dealer checks', () => {
    expect(migration).toContain('plotmap_marketing_property_is_marketable');
    expect(migration).toContain("= 'on-sale'");
    expect(migration).toContain('plotmap_marketing_can_operate');
    expect(migration).toContain('plotmap_current_dealer_id() = v_job.dealer_id');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.marketing_reel_jobs from public, anon, authenticated');
    expect(broker).toContain('rpcFailureStatus');
    expect(broker).toContain("if (/authori[sz]ed|access|required/.test(reason)) return 403");
  });

  it('turns a finished Reel into the existing canonical creative and schedule machinery', () => {
    expect(migration).toContain("creative_type, design_key");
    expect(migration).toContain("v_job.dealer_id, v_context, v_job.property_id, 'reel'");
    expect(migration).toContain('insert into public.marketing_schedule_items');
    expect(migration).toContain("c.status in ('approved', 'published')");
    expect(migration).toContain("'creativeType', c.creative_type");
  });

  it('does not couple historical Marketing rows to destructive property deletion', () => {
    expect(migration).toMatch(/property_id text not null/);
    expect(migration).not.toMatch(/property_id text not null references public\.crm_records/i);
    expect(migration).toContain("return jsonb_build_object('ok', false, 'reason', 'property_not_marketable')");
  });

  it('allow-lists production facts and introduces no fake analytics', () => {
    const factsFunction = migration.slice(
      migration.indexOf('create or replace function public.plotmap_ai_marketing_facts_for'),
      migration.indexOf('create or replace function public.plotmap_marketing_ensure_period_for'),
    );
    expect(factsFunction).not.toContain("'price', case");
    for (const excluded of ['askingPrice', 'sellerPhone', 'commission', 'location', 'coordinates', 'mapPlacement']) {
      expect(factsFunction).toContain(`'${excluded}'`);
    }
    expect(monthlySource).not.toMatch(/\b(reach|impressions|engagement|hot right now)\b/i);
  });
});
