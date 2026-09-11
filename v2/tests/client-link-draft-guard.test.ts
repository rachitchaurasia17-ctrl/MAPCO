// @vitest-environment jsdom
/*
 * A draft must never reach a customer.
 *
 * A draft is a property the database refused to put on sale because it is
 * missing something it must have. The buyer's resolver does no lifecycle
 * filtering, so a draft that gets into a client link really is served to the
 * customer — as a property with no size, no facing and no price.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';
import { toDeskProperty } from '../src/apps/dealer/desk-store';
import type { Property } from '../src/packages/data/types';

afterEach(() => vi.restoreAllMocks());

const property = (over: Partial<Property>) => ({
  id: 'p1', type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Sector 88',
  loc: 'Sector 88, Mohali', sector: '88', size: '250 sq yd', facing: 'East',
  position: 'Corner plot', approvals: [], landmarks: [], price: 7500000,
  photos: [], published: true, sold: false, lifecycle: 'on-sale', ...over,
} as unknown as Property);

describe('the client link builder', () => {
  it('does not offer a draft among the properties to send', () => {
    const c = new Component() as any;
    c.properties = [
      toDeskProperty(property({ id: 'live', lifecycle: 'on-sale' })),
      toDeskProperty(property({ id: 'unfinished', lifecycle: 'draft' })),
    ];
    c.state = { ...c.state, linkBuild: 'new' };

    const vm = c.renderVals();

    // Three separate pickers feed the builder; none of them may list a draft.
    expect(vm.lPlots.length).toBe(1);
    expect(vm.lPlotPicks.length).toBe(1);
    expect(vm.lPropRows.length).toBe(1);
  });

  it('refuses to send one that got in through a Send shortcut', async () => {
    /* Every Send button on a card, a client row and the property detail puts a
       property straight into the link without passing a picker, so the refusal
       has to live where the link is actually created. */
    const c = new Component() as any;
    c.state = { ...c.state, lform: { ...c.blankL(), clientId: 'c1', plots: ['unfinished'] } };
    c.clients = [{ id: 'c1', name: 'Rajiv Sharma' }];
    vi.spyOn(adapter.properties, 'get')
      .mockResolvedValue(ok(property({ id: 'unfinished', lifecycle: 'draft' })) as never);
    const create = vi.spyOn(adapter.clientLinks, 'create');

    await c.sendLink();

    expect(create).not.toHaveBeenCalled();
    expect(c.state.linkError)
      .toBe('Sector 88, Mohali is still a draft. Finish it under Properties before sending it to a customer.');
  });

  it('sends a finished property without complaint', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, lform: { ...c.blankL(), clientId: 'c1', plots: ['live'] } };
    c.clients = [{ id: 'c1', name: 'Rajiv Sharma' }];
    vi.spyOn(adapter.properties, 'get')
      .mockResolvedValue(ok(property({ id: 'live', lifecycle: 'on-sale' })) as never);
    const create = vi.spyOn(adapter.clientLinks, 'create')
      .mockResolvedValue(ok({ id: 'l1', url: 'https://example.invalid/l1', expiresAt: null }) as never);
    vi.spyOn(c, 'loadClientLinks').mockResolvedValue(undefined);

    await c.sendLink();

    expect(create).toHaveBeenCalled();
    expect(c.state.linkError).toBe('');
  });
});
