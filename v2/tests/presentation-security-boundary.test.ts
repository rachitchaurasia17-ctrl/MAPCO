import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { productRoutes } from '../src/packages/ui/product-routes';

const projection = readFileSync(new URL('../../supabase/migrations/20260814000200_presentation_safe_properties.sql', import.meta.url), 'utf8');
const viewerPolicy = readFileSync(new URL('../../supabase/migrations/20260814000400_viewer_presentation_only.sql', import.meta.url), 'utf8');
const broker = readFileSync(new URL('../../supabase/functions/presentation-properties/index.ts', import.meta.url), 'utf8');
const canonicalLocation = readFileSync(new URL('../../supabase/migrations/20260811000100_canonical_property_location.sql', import.meta.url), 'utf8');
const fixtureCleanup = readFileSync(new URL('../../supabase/migrations/20260814000300_remove_fixture_earth_locations.sql', import.meta.url), 'utf8');
const safeMaps = readFileSync(new URL('../../supabase/migrations/20260814000500_presentation_safe_maps.sql', import.meta.url), 'utf8');

describe('Client Presentation security boundary', () => {
  it('projects only client-facing property fields through an authenticated dealer-derived RPC', () => {
    expect(projection).toContain('v_dealer_id text := public.plotmap_current_dealer_id()');
    expect(projection).toContain('public.plotmap_dealer_is_active(v_dealer_id)');
    expect(projection).toContain("lower(coalesce(r.payload ->> 'published', 'false')) = 'true'");
    expect(projection).toContain("lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'");
    expect(projection).toContain("'hasEarthLocation', v_has_earth_location");
    for (const forbidden of ["'price'", "'owner'", "'views'", "'location'", "'internalStatus'"]) {
      expect(projection).not.toContain(`${forbidden}, v_row.payload`);
    }
    const browserProjection = projection.slice(0, projection.indexOf('-- Service-only media lookup'));
    expect(browserProjection).not.toContain("'photoStorage'");
    expect(projection).toContain('revoke all on function public.plotmap_presentation_properties');
  });

  it('keeps private photo paths inside the service broker and viewer tokens off raw tables', () => {
    expect(broker).toContain("callRpc('plotmap_presentation_property_media'");
    expect(broker).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(broker).toContain('item.photos = [...external, ...signed]');
    expect(viewerPolicy).toContain("public.plotmap_current_role() <> 'viewer'");
    expect(viewerPolicy).toContain('on public.crm_records');
    expect(viewerPolicy).toContain('on storage.objects');
    for (const table of ['crm_records', 'map_overlays', 'prebuilt_maps', 'presentation_events', 'dealer_settings', 'share_links', 'audit_logs', 'client_link_events']) {
      expect(viewerPolicy).toContain(`on public.${table}`);
    }
    expect(viewerPolicy).toContain('plotmap_client_link_can_manage()');
    expect(viewerPolicy).toContain('create or replace function public.plotmap_can_view_ai()');
    expect(viewerPolicy).toContain('public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())');
    for (const signature of [
      'public.plotmap_ai_status()',
      'public.plotmap_ai_usage_summary(integer)',
      'public.plotmap_ai_current_artifact(text,text)',
      'public.plotmap_ai_artifact_history(text,integer)',
      'public.plotmap_ai_pending_actions(integer)',
      'public.plotmap_ai_context_facts(integer,integer)',
      'public.plotmap_ai_marketing_facts(text)',
    ]) {
      expect(viewerPolicy).toContain(signature);
    }
    expect(viewerPolicy).toContain('plotmap_dealer_can_write(v_dealer)');
    expect(viewerPolicy).toContain('on public.predictive_usage_events for select');
    expect(viewerPolicy).toContain('on public.predictive_transition_summaries for select');
    expect(viewerPolicy).toContain('plotmap_record_predictive_event definition did not match');
    expect(viewerPolicy).toContain('not public.plotmap_can_edit_crm() or not public.plotmap_dealer_is_active(v_dealer)');
    expect(viewerPolicy).toContain('create or replace function public.plotmap_predictive_summaries');
  });

  it('retains safe published map projections while Presentation routes through Earth', () => {
    expect(safeMaps).toContain('public.plotmap_presentation_maps');
    expect(safeMaps).toContain("m.status = 'published'");
    expect(safeMaps).toContain('m.client_visible = true');
    expect(safeMaps).toContain("o.status = 'published'");
    expect(safeMaps).toContain('o.client_visible = true');
    expect(productRoutes.presentation('property-7')).toBe(productRoutes.earth('property-7'));
  });

  it('allowlists and caps every nested map and highlight-set JSON field', () => {
    expect(safeMaps).toContain('public.plotmap_presentation_dimension');
    expect(safeMaps).toContain('v_number < 1 or v_number > 100000');
    expect(safeMaps).toContain('octet_length(v_path) > 2048');
    expect(safeMaps).toContain("candidate.assets #> '{original,path}' as asset_original_path");
    expect(safeMaps).toContain("candidate.assets #> '{threeD,path}' as asset_threed_path");
    expect(safeMaps).toContain("candidate.assets #> '{overlay,path}' as asset_overlay_path");
    expect(safeMaps).toContain("candidate.payload #> '{calibration,overlayViewBox,w}'");
    expect(safeMaps).toContain("in ('calibrated', 'needs-review', 'unavailable')");
    expect(safeMaps).toContain('limit 500');

    expect(safeMaps).toContain("jsonb_typeof(o.payload_item_ids) = 'array'");
    expect(safeMaps).toContain('least(jsonb_array_length(raw.raw_item_ids) - 1, 499)');
    expect(safeMaps).toContain('length(candidate.item_id) <= 160');
    expect(safeMaps).toContain("jsonb_typeof(o.payload_labels) = 'object'");
    expect(safeMaps).toContain('left(btrim(raw.raw_labels ->> selected.item_id), 120)');
    expect(safeMaps).toContain("~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'");
    expect(safeMaps).toContain('limit 50');

    for (const rawProjection of [
      "'assets', m.assets",
      "'dims', m.dims",
      "'calibration', m.payload -> 'calibration'",
      "'itemIds', coalesce(o.payload",
      "then o.payload -> 'labels'",
      'select candidate.*',
    ]) {
      expect(safeMaps).not.toContain(rawProjection);
    }
  });

  it('never promotes the five demo coordinates into canonical locations', () => {
    expect(canonicalLocation).not.toContain('legacy_location');
    expect(canonicalLocation).not.toContain('30.6889');
    expect(canonicalLocation).toContain('No fixture, centroid, or inferred');
    expect(fixtureCleanup).toContain("r.payload -> 'location' ->> 'source' = 'migrated'");
  });

  it('keeps the mock presentation projection structurally free of private fields', async () => {
    const page = await adapter.presentation.listProperties({ limit: 50 });
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    for (const property of page.value.items) {
      const value = property as unknown as Record<string, unknown>;
      for (const forbidden of ['price', 'owner', 'views', 'published', 'sold', 'location', 'photoStorage', 'internalStatus']) {
        expect(value).not.toHaveProperty(forbidden);
      }
    }
  });
});
