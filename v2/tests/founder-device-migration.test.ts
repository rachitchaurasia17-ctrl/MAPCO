import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const foundationSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260910123834_founder_device_and_link_access.sql'),
  'utf8',
);
const correctionSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260911120000_founder_device_access_scoped.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260911063034_founder_device_access_rollback.sql'),
  'utf8',
);
const sql = `${foundationSql}\n${correctionSql}`;

describe('Founder device enforcement migration', () => {
  it('normalises PostgREST request paths for activation and status bootstrap', () => {
    expect(correctionSql).toContain("trim(leading '/' from current_setting('request.path',true))");
    expect(correctionSql).toContain("'rpc/plotmap_activate_device'");
    expect(correctionSql).toContain("'rpc/plotmap_dealer_access_status'");
    expect(correctionSql).not.toContain("'/rpc/plotmap_activate_device'");
    expect(correctionSql).toContain('revoke execute on function public.plotmap_activate_device(text,text,text,text) from anon');
  });

  it('uses the existing account and capability boundary instead of a global hook', () => {
    expect(sql).toContain("public.plotmap_dealer_account_access_reason()='active'");
    expect(sql).toContain("d.status='approved'");
    expect(sql).toContain("b.session_id::text=auth.jwt()->>'session_id'");
    expect(sql).toContain('create or replace function public.plotmap_dealer_is_active');
    expect(sql).toContain('create or replace function public.plotmap_current_dealer_id');
    expect(sql).toContain('create or replace function public.plotmap_current_status');
    expect(correctionSql).toContain('alter role authenticator reset pgrst.db_pre_request');
    expect(correctionSql).toContain("where policyname = 'founder_approved_session'");
  });

  it('keeps public buyer boundaries independent from dealer entitlement', () => {
    expect(sql).toContain("public.plotmap_buyer_link_dealer_exists(");
    expect(correctionSql).toContain("'plotmap_resolve_client_link'");
    expect(correctionSql).toContain("'plotmap_resolve_client_link_media'");
    expect(correctionSql).toContain("'plotmap_resolve_client_link_maps'");
    expect(correctionSql).toContain("'plotmap_record_client_link_event'");
    expect(correctionSql).toContain("'plotmap_client_link_intelligence'");
  });

  it('retains evidence while restoring the pre-rollout boundary on rollback', () => {
    expect(rollbackSql).toContain('alter role authenticator reset pgrst.db_pre_request');
    expect(rollbackSql).toContain("where policyname = 'founder_approved_session'");
    expect(rollbackSql).toContain("replace(v_before,'public.plotmap_buyer_link_dealer_exists(','public.plotmap_dealer_is_active('");
    expect(rollbackSql).toContain('revoke all on function public.plotmap_dealer_access_status(text)');
    expect(rollbackSql).not.toContain('drop table public.dealer_device_sessions');
  });
});
