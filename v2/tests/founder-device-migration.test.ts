import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(import.meta.dirname, '../../supabase/migrations/20260910123834_founder_device_and_link_access.sql'),
  'utf8',
);

describe('Founder device enforcement migration', () => {
  it('normalises PostgREST request paths for activation and status bootstrap', () => {
    expect(sql).toContain("trim(leading '/' from current_setting('request.path',true))");
    expect(sql).toContain("'rpc/plotmap_activate_device'");
    expect(sql).toContain("'rpc/plotmap_dealer_access_status'");
    expect(sql).not.toContain("'/rpc/plotmap_activate_device'");
    expect(sql).toContain('revoke execute on function public.plotmap_activate_device(text,text,text,text) from anon');
  });

  it('uses the existing account and capability boundary instead of a global hook', () => {
    expect(sql).toContain("public.plotmap_dealer_account_access_reason()='active'");
    expect(sql).toContain("d.status='approved'");
    expect(sql).toContain("b.session_id::text=auth.jwt()->>'session_id'");
    expect(sql).toContain('create or replace function public.plotmap_dealer_is_active');
    expect(sql).toContain('create or replace function public.plotmap_current_dealer_id');
    expect(sql).toContain('create or replace function public.plotmap_current_status');
    expect(sql).not.toContain('pgrst.db_pre_request');
    expect(sql).not.toContain('create policy founder_approved_session');
  });

  it('keeps public buyer boundaries independent from dealer entitlement', () => {
    expect(sql).toContain("public.plotmap_buyer_link_dealer_exists(");
    expect(sql).toContain("array['plotmap_resolve_client_link','plotmap_resolve_client_link_media'");
    expect(sql).toContain("'plotmap_resolve_client_link_maps','plotmap_record_client_link_event','plotmap_client_link_intelligence']");
  });
});
