// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { afterEach } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SingleFlight } from '../src/packages/security/single-flight';
import { commitEarthLocationFlow, saveEarthLocationOnce } from '../src/apps/earth/main';
import { Component } from '../src/apps/dealer/logic';
import { err, ok, type Result } from '../src/packages/data/contracts';
import type { ClientLink } from '../src/packages/data/types';

const sharedModals = readFileSync(resolve(__dirname, '../src/packages/ui/shared-modals.ts'), 'utf8');
// The marketing app was split main/logic/template; the publish guard lives
// in the logic module now.
const marketingPage = readFileSync(resolve(__dirname, '../src/apps/marketing/logic.ts'), 'utf8');
const aiConsole = readFileSync(resolve(__dirname, '../src/apps/ai-console/main.ts'), 'utf8');
/* src/apps/dealer/pages/{properties,deals,links}.ts were consolidated into
   one dealer screen module. The rapid-interaction rule did not change, so
   the guards are asserted against the module that holds them now. */
const dealerScreen = readFileSync(resolve(__dirname, '../src/apps/dealer/logic.ts'), 'utf8');

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const clientLink = (id: string): ClientLink => ({
  id, clientId: `client-${id}`, clientName: `Buyer ${id}`, props: [`property-${id}`],
  propNames: [`Plot ${id}`], expiry: 'Tomorrow', loc: 'area', price: 'hidden',
  audio: 'none', audioSecs: 0, status: 'active',
  events: { opens: 0, played: 0, called: 0, wa: 0, visit: 0 }, lastOpen: 'Never',
});

afterEach(() => vi.restoreAllMocks());

describe('Phase 1 rapid-interaction boundary', () => {
  it('keeps important save, delete, publish, deal, decision, and revoke actions guarded', () => {
    expect(sharedModals).toContain('if (this.saving) return');
    expect(sharedModals).toContain('if (!this.form.name.trim() || this.saving) return');
    expect(marketingPage).toContain("if (this.state.phase !== 'ready') return");
    expect(aiConsole).toContain('decisionFlights.run(`decision:${id}`');
    // One SingleFlight boundary now covers every dealer mutation.
    expect(dealerScreen).toContain('_flights = new SingleFlight()');
    for (const key of [
      "this.write('revoke:' + id", "this.write('delete:' + id",
      "this.write('lifecycle:' + id", "this.write('price:' + id",
      "this.write('archive:' + id",
    ]) expect(dealerScreen).toContain(key);
    // Deal writes keep their own in-flight latches.
    expect(dealerScreen).toContain('if (this._savingDeal) return false');
    expect(dealerScreen).toContain('if (this._recordingDealPayment) return false');
    expect(dealerScreen).toContain('if (this._startingDeal) return');
    expect(dealerScreen).toContain('if (this.state.savingSold) return');
  });

  it('starts only one write when the same control is clicked repeatedly on a slow network', async () => {
    const gate = new SingleFlight();
    const request = deferred<string>();
    const write = vi.fn(() => request.promise);

    const first = gate.run('save:property-1', write);
    const repeated = await gate.run('save:property-1', write);

    expect(repeated).toEqual({ started: false });
    expect(write).toHaveBeenCalledTimes(1);
    expect(gate.isActive('save:property-1')).toBe(true);
    request.resolve('saved');
    await expect(first).resolves.toEqual({ started: true, value: 'saved' });
    expect(gate.isActive('save:property-1')).toBe(false);
  });

  it('releases a failed request so a deliberate retry can proceed', async () => {
    const gate = new SingleFlight();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce('retried');

    await expect(gate.run('delete:property-1', write)).rejects.toThrow('network failed');
    await expect(gate.run('delete:property-1', write)).resolves.toEqual({ started: true, value: 'retried' });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('does not globally freeze unrelated records during rapid navigation or selection', async () => {
    const gate = new SingleFlight();
    const first = deferred<string>();
    const second = deferred<string>();
    const a = gate.run('publish:property-a', () => first.promise);
    const b = gate.run('publish:property-b', () => second.promise);

    expect(gate.isActive('publish:property-a')).toBe(true);
    expect(gate.isActive('publish:property-b')).toBe(true);
    second.resolve('b'); first.resolve('a');
    await expect(Promise.all([a, b])).resolves.toEqual([
      { started: true, value: 'a' },
      { started: true, value: 'b' },
    ]);
  });

  it('single-flights the real Earth location save boundary and resets after failure', async () => {
    const request = deferred<{ id: string }>();
    const write = vi.fn(() => request.promise);
    const pending: boolean[] = [];

    const first = saveEarthLocationOnce('property-earth-a', write, (value) => pending.push(value));
    const repeated = await saveEarthLocationOnce('property-earth-a', write, (value) => pending.push(value));

    expect(repeated).toEqual({ started: false });
    expect(write).toHaveBeenCalledTimes(1);
    expect(pending).toEqual([true]);
    request.reject(new Error('slow save failed'));
    await expect(first).rejects.toThrow('slow save failed');
    expect(pending).toEqual([true, false]);

    await expect(saveEarthLocationOnce('property-earth-a', async () => ({ id: 'property-earth-a' })))
      .resolves.toEqual({ started: true, value: { id: 'property-earth-a' } });
  });

  it('does not let a settled Earth save mutate a newer add-flow context', async () => {
    let currentFlow = 'flow-a';
    const aControls = { confirmDisabled: false, cancelDisabled: false };
    const bControls = { confirmDisabled: false, cancelDisabled: false };
    const saved = vi.fn();
    const failed = vi.fn();
    const success = deferred<{ id: string }>();

    const first = commitEarthLocationFlow({
      propertyId: 'property-a',
      write: () => success.promise,
      isCurrent: () => currentFlow === 'flow-a',
      setPending: (pending) => {
        aControls.confirmDisabled = pending;
        aControls.cancelDisabled = pending;
      },
      onSaved: saved,
      onError: failed,
    });
    expect(aControls).toEqual({ confirmDisabled: true, cancelDisabled: true });
    currentFlow = 'flow-b';
    success.resolve({ id: 'property-a' });
    await expect(first).resolves.toEqual({ started: true, applied: false });
    expect(saved).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(bControls).toEqual({ confirmDisabled: false, cancelDisabled: false });

    const staleFailure = deferred<{ id: string }>();
    currentFlow = 'flow-c';
    const second = commitEarthLocationFlow({
      propertyId: 'property-c',
      write: () => staleFailure.promise,
      isCurrent: () => currentFlow === 'flow-c',
      setPending: vi.fn(),
      onSaved: saved,
      onError: failed,
    });
    currentFlow = 'flow-d';
    staleFailure.reject(new Error('old flow failed'));
    await expect(second).resolves.toEqual({ started: true, applied: false });
    expect(failed).not.toHaveBeenCalled();
  });

  it('starts one revoke per link however fast the control is clicked', async () => {
    const c = new Component() as any;
    c.clientLinks = [{ id: 'link-a', status: 'active' }, { id: 'link-b', status: 'active' }];
    const request = deferred<Result<void>>();
    const revoke = vi.spyOn(adapter.clientLinks, 'revoke')
      .mockImplementation(((id: string) => (id === 'link-a' ? request.promise : Promise.resolve(ok(undefined)))) as never);
    vi.spyOn(c, 'loadClientLinks').mockResolvedValue(undefined);

    const first = c.revokeLink('link-a');
    await c.revokeLink('link-a');
    expect(revoke).toHaveBeenCalledTimes(1);
    // A different link is never blocked by the one in flight.
    await c.revokeLink('link-b');
    expect(revoke).toHaveBeenCalledTimes(2);

    request.resolve(ok(undefined));
    await first;
    expect(c.writing('revoke:link-a')).toBe(false);
  });

  it('keeps a successfully revoked link stopped when the authoritative refresh fails', async () => {
    const c = new Component() as any;
    c.clientLinks = [{ id: 'link-a', status: 'active' }];
    vi.spyOn(adapter.clientLinks, 'revoke').mockResolvedValue(ok(undefined) as never);
    // The refresh fails, so the list keeps whatever it already held.
    vi.spyOn(adapter.clientLinks, 'list').mockResolvedValue(err('network', 'Could not refresh links') as never);
    await c.revokeLink('link-a');
    expect(c.clientLinks[0].status).toBe('revoked');
    expect(c.state.linkLoadError).toBeTruthy();
  });

  it('leaves a link active and says so when the revoke itself fails', async () => {
    const c = new Component() as any;
    c.clientLinks = [{ id: 'link-a', status: 'active' }];
    vi.spyOn(adapter.clientLinks, 'revoke').mockResolvedValue(err('network', 'no') as never);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const load = vi.spyOn(c, 'loadClientLinks').mockResolvedValue(undefined);
    await c.revokeLink('link-a');
    expect(c.clientLinks[0].status).toBe('active');
    expect(load).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });

  it('releases the key after a failure so a deliberate retry proceeds', async () => {
    const c = new Component() as any;
    c.clientLinks = [{ id: 'link-a', status: 'active' }];
    const revoke = vi.spyOn(adapter.clientLinks, 'revoke')
      .mockResolvedValueOnce(err('network', 'no') as never)
      .mockResolvedValueOnce(ok(undefined) as never);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(c, 'loadClientLinks').mockResolvedValue(undefined);
    await c.revokeLink('link-a');
    await c.revokeLink('link-a');
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(c.clientLinks[0].status).toBe('revoked');
  });
});
