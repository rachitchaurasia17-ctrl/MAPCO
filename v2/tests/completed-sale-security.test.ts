import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const atomicMigration = readFileSync(
  new URL('../../supabase/migrations/20260803000100_record_completed_sale.sql', import.meta.url),
  'utf8',
);
const optionalFieldsMigration = readFileSync(
  new URL('../../supabase/migrations/20260814000100_completed_sale_optional_private_fields.sql', import.meta.url),
  'utf8',
);

describe('completed-sale database boundary', () => {
  it('keeps the completed sale dealer-derived, locked, atomic, and authenticated-only', () => {
    expect(atomicMigration).toContain('v_dealer_id text := public.plotmap_current_dealer_id()');
    expect(atomicMigration).toContain('public.plotmap_can_edit_crm()');
    expect(atomicMigration).toContain('public.plotmap_dealer_can_write(v_dealer_id)');
    expect(atomicMigration).not.toContain('or not public.plotmap_is_active_member()');
    expect(atomicMigration).toContain('for update;');
    expect(atomicMigration).toContain("insert into public.crm_records (id, dealer_id, entity_type, payload");
    expect(atomicMigration).toContain("jsonb_build_object('sold', true, 'published', false, 'clientVisible', false");
    expect(atomicMigration).toContain("jsonb_build_object('purchased'");
    expect(atomicMigration).toContain('revoke all on function public.plotmap_record_completed_sale(jsonb) from public, anon;');
    expect(atomicMigration).toContain('grant execute on function public.plotmap_record_completed_sale(jsonb) to authenticated;');
  });

  it('removes invented optional seller and money facts without replacing the transaction', () => {
    expect(optionalFieldsMigration).toContain('pg_get_functiondef');
    expect(optionalFieldsMigration).toContain("'seller', left(nullif(trim(coalesce(p_payload ->> 'seller', '')), ''), 120)");
    expect(optionalFieldsMigration).toContain("'brokerage', nullif(p_payload ->> 'brokerage', '')::numeric");
    expect(optionalFieldsMigration).toContain("'commissionReceived', (p_payload ->> 'commissionReceived')::boolean");
    expect(optionalFieldsMigration).toContain("'paymentReceived', nullif(p_payload ->> 'paymentReceived', '')::numeric");
    expect(optionalFieldsMigration).toContain('definition did not match the expected secure baseline');
    expect(optionalFieldsMigration).toContain('authorization did not match the expected secure baseline');
    expect(optionalFieldsMigration).toContain('revoke all on function public.plotmap_record_completed_sale(jsonb) from public, anon;');
  });
});
