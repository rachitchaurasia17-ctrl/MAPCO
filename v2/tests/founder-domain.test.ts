import { describe, expect, it } from 'vitest';
import { accountState, activeThroughToInstant, escapeHtml, type DealerAccount } from '../src/apps/developer/domain';

const dealer = (patch: Partial<DealerAccount> = {}): DealerAccount => ({
  dealer_id: 'dealer-a', brand_name: 'Dealer A', owner_name: 'Owner', owner_phone: null,
  login_email: null, primary_area: 'Mohali', account_status: 'active', subscription_status: 'trial',
  trial_start: '2026-09-10T00:00:00Z', trial_end: '2026-09-17T00:00:00Z', expiry_date: null,
  plan_code: null, paid: false, max_devices_allowed: 4, approved_device_count: 0,
  developer_notes: null, payment_notes: null, ...patch,
});

describe('founder account semantics', () => {
  it('expires a trial at the exact boundary', () => {
    expect(accountState(dealer(), Date.parse('2026-09-16T23:59:59Z'))).toBe('Trial');
    expect(accountState(dealer(), Date.parse('2026-09-17T00:00:00Z'))).toBe('Expired');
  });
  it('reads paid access independently of the old trial expiry', () => {
    expect(accountState(dealer({ subscription_status: 'paid', paid: true,
      expiry_date: '2026-10-10T18:29:59.999Z' }), Date.parse('2026-09-20T00:00:00Z'))).toBe('Paid');
  });
  it('does not label suspended or unknown entitlement active', () => {
    expect(accountState(dealer({ account_status: 'suspended' }), Date.parse('2026-09-11'))).toBe('Suspended');
    expect(accountState(dealer({ trial_end: 'invalid' }))).toBe('Expired');
    expect(accountState(dealer({ trial_end: null }))).toBe('Expired');
  });
  it('uses an inclusive India business date regardless of machine timezone', () => {
    expect(activeThroughToInstant('2026-10-10')).toBe('2026-10-10T18:29:59.999Z');
    expect(() => activeThroughToInstant('2026-02-30')).toThrow();
    expect(() => activeThroughToInstant('10/10/2026')).toThrow();
  });
  it('escapes dealer-supplied text before rendering it in founder controls', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});
