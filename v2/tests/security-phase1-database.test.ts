import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260825000100_security_phase_1_foundation.sql', import.meta.url),
  'utf8',
);

describe('Phase 1 database security final-state contract', () => {
  it('keeps dealer commercial and control-plane fields provider-owned', () => {
    expect(migration).toContain('plotmap_guard_dealer_settings_account_columns');
    expect(migration).toMatch(/tg_op = 'INSERT'\s+and not public\.plotmap_is_platform_admin\(\)/);
    for (const column of [
      'subscription_status', 'account_status', 'trial_end', 'expiry_date', 'paid',
      'seat_limit', 'max_maps', 'max_properties', 'max_team_members', 'max_devices_allowed',
      'storage_enabled', 'photo_bucket', 'photo_folder',
    ]) {
      expect(migration).toContain(`new.${column} is distinct from old.${column}`);
    }
    expect(migration).toContain('before insert or update on public.dealer_settings');
    expect(migration).toContain('with check (public.plotmap_is_platform_admin())');
  });

  it('derives tenant identity and makes it immutable for every tenant table', () => {
    expect(migration).toContain('create or replace function public.plotmap_enforce_authenticated_tenant()');
    expect(migration).toContain('security definer');
    expect(migration).toContain("coalesce(auth.role(), '') <> 'authenticated'");
    expect(migration).toContain("new.dealer_id := v_dealer_id");
    expect(migration).toContain('new.dealer_id is distinct from old.dealer_id');
    expect(migration).toContain('old.dealer_id is distinct from v_dealer_id');
    expect(migration).toContain("message = 'cross-tenant mutation denied'");
    expect(migration).toContain("if tg_op = 'DELETE' then return old; end if");
    expect(migration).toContain("message = 'dealer_id is immutable'");
    expect(migration).toContain("a.attname = 'dealer_id'");
    expect(migration).toContain('plotmap_00_authenticated_tenant_guard');
    expect(migration).toContain('before insert or update or delete on public.%I');
    expect(migration).toContain('public.plotmap_dealer_can_write(v_dealer_id) is not true');
    expect(migration).toContain("public.plotmap_current_role() = 'viewer'");
    expect(migration).toContain("tg_table_name = 'crm_records'");
    expect(migration).toContain('property quota or account limit reached');
    expect(migration).toContain("role in ('team', 'manager', 'map_editor', 'property_editor', 'viewer')");
    expect(migration).toContain('revoke create on schema public from public, anon, authenticated');
  });

  it('serializes quota admission while allowing existing same-tenant upserts', () => {
    expect(migration).toContain('plotmap_quota_insert_allowed');
    expect(migration).toContain("pg_catalog.hashtextextended('plotmap:quota:' || v_dealer_id, 0)");
    expect(migration.match(/pg_catalog\.pg_advisory_xact_lock/g)?.length).toBe(5);
    expect(migration.match(/v_row_exists := found/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain("message = 'existing row belongs to another dealer'");
    expect(migration).toContain("plotmap_quota_insert_allowed('crm_records', id, dealer_id)");
    expect(migration).toContain("plotmap_quota_insert_allowed('prebuilt_maps', id, dealer_id)");
    expect(migration).toContain("plotmap_quota_insert_allowed('profiles', id::text, dealer_id)");
    expect(migration).toContain("old.entity_type is distinct from 'properties'");
    expect(migration).toContain("old.status is distinct from 'active'");
    expect(migration).toContain('plotmap_assert_quota_after_write');
    expect(migration.match(/create constraint trigger plotmap_quota_final_check/g)?.length).toBe(3);
    expect(migration.match(/deferrable initially deferred/g)?.length).toBe(3);
    expect(migration).toContain('if v_count > coalesce(v_limit, 500) then');
    expect(migration).toContain('if v_count > coalesce(v_limit, 10) then');
    expect(migration).toContain('if v_count > coalesce(v_limit, 5) then');
  });

  it('keeps polymorphic trigger fields table-specific and scopes account helpers', () => {
    expect(migration).toMatch(/if tg_table_name = 'crm_records' then\s+if new\.entity_type/s);
    expect(migration).toMatch(/elsif tg_table_name = 'profiles' then\s+if new\.status/s);
    expect(migration.match(/p_dealer_id = public\.plotmap_current_dealer_id\(\)/g)?.length)
      .toBeGreaterThanOrEqual(1);
    expect(migration).toContain("coalesce(auth.role(), '') = 'authenticated'");
    expect(migration).toContain('and p_dealer_id is distinct from public.plotmap_current_dealer_id()');
  });

  it('restores suspended-account and quota gates in final RLS policies', () => {
    expect(migration).toContain('return public.plotmap_can_insert_property(p_dealer_id)');
    expect(migration).toContain('return public.plotmap_can_insert_prebuilt_map(p_dealer_id)');
    expect(migration).toContain('return public.plotmap_can_insert_team_member(p_dealer_id)');
    expect(migration.match(/public\.plotmap_dealer_can_write\(dealer_id\)/g)?.length).toBeGreaterThan(12);
    for (const table of ['crm_records', 'map_overlays', 'prebuilt_maps', 'dealer_settings', 'share_links', 'profiles']) {
      expect(migration).toContain(`on public.${table}`);
    }
  });

  it('removes forgeable direct audit inserts and exposes only a derived narrow RPC', () => {
    expect(migration).toContain('revoke insert on public.audit_logs from authenticated');
    expect(migration).toContain('plotmap_append_user_audit_event');
    expect(migration).toContain('v_actor uuid := auth.uid()');
    expect(migration).toContain("v_dealer_id text := nullif(public.plotmap_current_dealer_id(), '')");
    expect(migration).toContain("p_action_type = 'property_exported'");
    expect(migration).toContain("p_action_type = 'client_link_copied'");
    expect(migration).toContain("jsonb_build_object('source', 'authenticated_user')");
    expect(migration).toContain('audit event rate limit exceeded');
    expect(migration).toContain('to authenticated;');
  });

  it('retires predictable share slugs and makes presentation visibility explicit', () => {
    expect(migration).toContain('revoke all on function public.plotmap_resolve_share_link(text)');
    expect(migration).toContain("lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'");
    expect(migration).toContain('create or replace view public.client_safe_properties');
    expect(migration).toContain('plotmap_create_client_link visibility baseline did not match');
    expect(migration).toContain('plotmap_create_client_link publication hardening was incomplete');
    expect(migration).toContain("lower(coalesce(r.payload ->> 'published', 'false')) = 'true'");
    expect(migration).toContain("lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'");
    expect(migration).toContain("coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'");
    expect(migration).toContain('plotmap_presentation_property_media(text[])');
    expect(migration).toContain('to service_role;');
  });

  it('does not introduce permissive tenant policies or destructive data operations', () => {
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/\b(?:truncate|delete\s+from|drop\s+table|drop\s+database)\b/i);
  });
});
