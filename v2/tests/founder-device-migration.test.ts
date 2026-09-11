import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const foundationSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260910123834_founder_device_and_link_access.sql'),
  'utf8',
);
const correctionSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260911065526_founder_device_access_scoped.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260911063034_founder_device_access_rollback.sql'),
  'utf8',
);
const founderSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260910064125_founder_control_foundation.sql'),
  'utf8',
);
const providerGuardSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260825000100_security_phase_1_foundation.sql'),
  'utf8',
);
const legacyAdminSql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260801001000_developer_control_and_trial_analytics_draft.sql'),
  'utf8',
);
const sql = `${foundationSql}\n${correctionSql}`;

describe('Founder device enforcement migration', () => {
  it('normalises PostgREST request paths for activation and status bootstrap', () => {
    expect(correctionSql).toContain("trim(leading '/' from current_setting('request.path',true))");
    expect(correctionSql).toContain("'rpc/plotmap_activate_device'");
    expect(correctionSql).toContain("'rpc/plotmap_dealer_access_status'");
    expect(correctionSql).not.toContain("'/rpc/plotmap_activate_device'");
    expect(correctionSql).toContain('revoke all on function public.plotmap_activate_device(text,text,text,text) from public,anon');
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
    expect(correctionSql).toContain('grant execute on function public.plotmap_resolve_client_link(text) to anon,authenticated');
    expect(correctionSql).toContain('grant execute on function public.plotmap_record_client_link_event(text,text,text,text,jsonb) to anon,authenticated');
  });

  it('does not mutate provider-owned dealer account columns during migration', () => {
    expect(correctionSql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.dealer_settings/i);
    expect(correctionSql).not.toContain('disable trigger');
    expect(correctionSql).not.toContain("set_config('request.jwt.claim");
  });

  it('normalises the demo limit only through the guarded Founder RPC', () => {
    expect(legacyAdminSql).toContain('create or replace function public.plotmap_admin_set_dealer_device_limit');
    expect(legacyAdminSql).toContain('if not public.plotmap_is_platform_admin() then');
    expect(legacyAdminSql).toContain('set max_devices_allowed = p_max_devices_allowed');
    expect(legacyAdminSql).toContain('grant execute on function public.plotmap_admin_set_dealer_device_limit(text, integer) to authenticated');
    expect(providerGuardSql).toContain('new.max_devices_allowed is distinct from old.max_devices_allowed');
    expect(providerGuardSql).toContain("message = 'account, storage, and plan columns are provider-only'");
  });

  it('keeps device codes, limits and revocation Founder-only', () => {
    expect(founderSql).toMatch(/plotmap_founder_create_device_code[\s\S]*?if not public\.plotmap_is_platform_admin\(\)/);
    expect(founderSql).toMatch(/plotmap_admin_set_device_status[\s\S]*?if not public\.plotmap_is_platform_admin\(\)/);
    expect(correctionSql).toContain('revoke all on function public.plotmap_admin_list_dealer_accounts() from public,anon');
    expect(correctionSql).toContain('revoke all on function public.plotmap_admin_set_dealer_account');
  });

  it('retires anonymous legacy device access without revoking buyer links', () => {
    expect(correctionSql).toContain('revoke all on function public.plotmap_client_properties_for_device(text,text) from public,anon,authenticated');
    expect(correctionSql).toContain('revoke all on function public.plotmap_device_status(text,text,text,text) from public,anon,authenticated');
    expect(correctionSql).toContain('revoke all on function public.plotmap_passcode_login(text) from public,anon,authenticated');
    expect(correctionSql).toContain('revoke all on function public.plotmap_record_device_presentation_event');
  });

  it('retains evidence while restoring the pre-rollout boundary on rollback', () => {
    expect(rollbackSql).toContain('alter role authenticator reset pgrst.db_pre_request');
    expect(rollbackSql).toContain("where policyname = 'founder_approved_session'");
    expect(rollbackSql).toContain("replace(v_before,'public.plotmap_buyer_link_dealer_exists(','public.plotmap_dealer_is_active('");
    expect(rollbackSql).toContain('revoke all on function public.plotmap_dealer_access_status(text)');
    expect(rollbackSql).not.toContain('drop table public.dealer_device_sessions');
  });
});
