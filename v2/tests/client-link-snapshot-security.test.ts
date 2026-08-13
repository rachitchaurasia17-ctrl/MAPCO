import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const typedLinkMigration = readFileSync(new URL('../../supabase/migrations/20260803000200_client_link_typed_price_and_precise_pins.sql', import.meta.url), 'utf8');
const hardeningMigration = readFileSync(new URL('../../supabase/migrations/20260814000600_client_link_hidden_price_guard.sql', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../src/packages/data/supabase/supabase-adapter.ts', import.meta.url), 'utf8');

describe('private client-link snapshot boundary', () => {
  it('never serializes a custom price while price visibility is hidden', () => {
    expect(typedLinkMigration).toContain("'price', case when v_price_visibility = 'shown'");
    expect(hardeningMigration).toContain("case when v_price_visibility = 'shown'");
    expect(hardeningMigration).toContain('expected price-visibility baseline');
  });

  it('rebuilds placement from an explicit three-field allowlist', () => {
    expect(typedLinkMigration).toContain("'placement', case when v_location_visibility = 'exact'");
    expect(typedLinkMigration).toContain("'mapId', left(trim(v_property.payload -> 'mapPlacement' ->> 'mapId'), 160)");
    expect(typedLinkMigration).toContain("'x', (v_property.payload -> 'mapPlacement' ->> 'x')::numeric");
    expect(typedLinkMigration).toContain("'y', (v_property.payload -> 'mapPlacement' ->> 'y')::numeric");
    expect(typedLinkMigration).not.toContain("then v_property.payload -> 'mapPlacement'");
  });

  it('does not synthesize a center pin from incomplete legacy placement', () => {
    expect(adapter).toContain('const hasValidPlacement = precise');
    expect(adapter).toContain('Number.isFinite(placementX)');
    expect(adapter).not.toContain('placement.x ?? 0.5');
    expect(adapter).not.toContain('placement.y ?? 0.5');
  });
});
