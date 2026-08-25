// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SingleFlight } from '../src/packages/security/single-flight';
import { commitEarthLocationFlow, saveEarthLocationOnce } from '../src/apps/earth/main';
import { createClientLinkRevoker } from '../src/apps/dealer/pages/links';
import { err, ok, type Result } from '../src/packages/data/contracts';
import type { ClientLink } from '../src/packages/data/types';

const sharedModals = readFileSync(resolve(__dirname, '../src/packages/ui/shared-modals.ts'), 'utf8');
const propertiesPage = readFileSync(resolve(__dirname, '../src/apps/dealer/pages/properties.ts'), 'utf8');
const dealsPage = readFileSync(resolve(__dirname, '../src/apps/dealer/pages/deals.ts'), 'utf8');
const marketingPage = readFileSync(resolve(__dirname, '../src/apps/marketing/main.ts'), 'utf8');
const aiConsole = readFileSync(resolve(__dirname, '../src/apps/ai-console/main.ts'), 'utf8');
const linksPage = readFileSync(resolve(__dirname, '../src/apps/dealer/pages/links.ts'), 'utf8');

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

describe('Phase 1 rapid-interaction boundary', () => {
  it('keeps important save, delete, publish, deal, decision, and revoke actions guarded', () => {
    expect(sharedModals).toContain('if (this.saving) return');
    expect(sharedModals).toContain('if (!this.form.name.trim() || this.saving) return');
    expect(propertiesPage).toContain('if (busyId) return');
    expect(propertiesPage).toContain('if (busyId || !window.confirm');
    expect(dealsPage).toContain('if (recording) return');
    expect(marketingPage).toContain("if (state.phase !== 'ready') return");
    expect(aiConsole).toContain('decisionFlights.run(`decision:${id}`');
    expect(linksPage).toContain('createClientLinkRevoker');
    expect(linksPage).toContain('revokeFlights.revoke(id)');
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

  it('keeps a successfully revoked target stopped when authoritative refresh fails', async () => {
    const original = clientLink('link-a');
    let links = [original];
    let errorMessage = '';
    const pending: boolean[] = [];
    const request = deferred<Result<void>>();
    const revoke = vi.fn(() => request.promise);
    const refresh = vi.fn(async () => err('network', 'Could not refresh links'));
    const controller = createClientLinkRevoker({
      getLinks: () => links,
      setLinks: (next) => { links = next; },
      revoke,
      refresh,
      setError: (message) => { errorMessage = message; },
      setPending: (_id, value) => pending.push(value),
    });

    const first = controller.revoke('link-a');
    const repeated = await controller.revoke('link-a');
    expect(repeated).toEqual({ started: false });
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(links[0]?.status).toBe('revoked');
    expect(pending).toEqual([true]);

    request.resolve(ok(undefined));
    await expect(first).resolves.toEqual({ started: true, value: false });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(links[0]?.status).toBe('revoked');
    expect(errorMessage).toContain('link was stopped');
    expect(errorMessage).toContain('could not be refreshed');
    expect(errorMessage).not.toContain('Nothing was changed');
    expect(pending).toEqual([true, false]);
    expect(controller.isActive('link-a')).toBe(false);
  });

  it('preserves another pending revoke and rolls back only the failed target', async () => {
    const a = clientLink('link-a');
    const b = clientLink('link-b');
    let links = [a, b];
    let errorMessage = '';
    const requests = new Map([
      ['link-a', deferred<Result<void>>()],
      ['link-b', deferred<Result<void>>()],
    ]);
    const controller = createClientLinkRevoker({
      getLinks: () => links,
      setLinks: (next) => { links = next; },
      revoke: (id) => requests.get(id)!.promise,
      // Simulate an A refresh that is stale for the still-pending B revoke.
      refresh: async () => ok([{ ...a, status: 'revoked' }, b]),
      setError: (message) => { errorMessage = message; },
    });

    const revokeA = controller.revoke('link-a');
    const revokeB = controller.revoke('link-b');
    expect(links.map((link) => link.status)).toEqual(['revoked', 'revoked']);

    requests.get('link-a')!.resolve(ok(undefined));
    await expect(revokeA).resolves.toEqual({ started: true, value: true });
    expect(links.find((link) => link.id === 'link-b')?.status).toBe('revoked');

    requests.get('link-b')!.resolve(err('network', 'B revoke failed'));
    await expect(revokeB).resolves.toEqual({ started: true, value: false });
    expect(links.find((link) => link.id === 'link-a')?.status).toBe('revoked');
    expect(links.find((link) => link.id === 'link-b')?.status).toBe('active');
    expect(errorMessage).toContain('B revoke failed');
    expect(errorMessage).toContain('Nothing was changed');
  });
});
