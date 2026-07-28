/* Typed state coverage: activation/account, presentation, link states,
   and the AsyncState mapping helper. Scenarios are driven via URL in dev;
   here we exercise the deterministic code-path outcomes directly. */
import { describe, it, expect } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import { pageToState, State } from '../src/packages/data/contracts';

describe('Activation code outcomes (deterministic, dev-only)', () => {
  const cases: Array<[string, string]> = [
    ['123456', 'activated'],
    ['000111', 'expired-code'],
    ['111222', 'device-limit-reached'],
    ['222333', 'device-approval-required'],
    ['999999', 'invalid-code'],
    ['12', 'invalid-code'],
  ];
  for (const [code, kind] of cases) {
    it(`code ${code} → ${kind}`, async () => {
      const r = await adapter.auth.submitActivationCode(code);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.kind).toBe(kind);
    });
  }
});

describe('Account/presentation defaults resolve to typed states', () => {
  it('account state is active by default', async () => {
    const r = await adapter.auth.getAccountState();
    if (r.ok) expect(r.value.kind).toBe('active');
  });
  it('presentation is ready by default with a maps list', async () => {
    const r = await adapter.presentation.getState();
    if (r.ok && r.value.kind === 'ready') expect(r.value.maps.length).toBeGreaterThan(0);
  });
});

describe('Client link states resolve deterministically', () => {
  it('valid link', async () => {
    const r = await adapter.clientLinks.resolve('l1');
    if (r.ok) expect(r.value.kind).toBe('valid');
  });
  it('revoked link', async () => {
    const r = await adapter.clientLinks.resolve('l4');
    if (r.ok) expect(r.value.kind).toBe('revoked');
  });
  it('unknown token → invalid-token', async () => {
    const r = await adapter.clientLinks.resolve('nope');
    if (r.ok) expect(r.value.kind).toBe('invalid-token');
  });
  it('empty token → invalid-token', async () => {
    const r = await adapter.clientLinks.resolve('');
    if (r.ok) expect(r.value.kind).toBe('invalid-token');
  });
});

describe('pageToState helper', () => {
  it('maps empty page to empty', () => {
    const s = pageToState({ ok: true, value: { items: [], nextCursor: null } });
    expect(s.kind).toBe('empty');
  });
  it('maps empty filtered page to no-results', () => {
    const s = pageToState({ ok: true, value: { items: [], nextCursor: null } }, { filtered: true });
    expect(s.kind).toBe('no-results');
  });
  it('maps populated page to ready', () => {
    const s = pageToState({ ok: true, value: { items: [1], nextCursor: null } });
    expect(s.kind).toBe('ready');
  });
  it('maps error result to error state', () => {
    const s = pageToState({ ok: false, error: { code: 'network', message: 'x', retryable: true } });
    expect(s.kind).toBe('error');
  });
  it('State factory builds each variant', () => {
    expect(State.loading().kind).toBe('loading');
    expect(State.empty().kind).toBe('empty');
    expect(State.noResults().kind).toBe('no-results');
  });
});
