// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';
import { renderApp, globalHead } from '../src/apps/dealer/template';
import { deskStore } from '../src/apps/dealer/desk-store';
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderClientLinkView } from '../src/packages/ui/client-link-view';
import type { ClientSafePayload } from '../src/packages/data/contracts';
import { snapshotToState } from '../src/packages/data/supabase/supabase-adapter';
import { previewPayloadFromLink } from '../src/packages/ui/client-link-view';

const payload: ClientSafePayload = {
  dealerDisplayName: 'Test Dealer', dealerPhone: '+919000000000', priceVisible: true, locationVisible: true,
  properties: [{ id: 'shared-1', area: 'Sector 79', size: '300 sq yd', facing: 'East', position: '',
    photos: [], landmarks: [], approvals: [], price: 5400000 }],
};
afterEach(() => vi.restoreAllMocks());

describe('dealer link creation', () => {
  it('uses the real returned URL and saves both sharing switches', async () => {
    const component = new Component() as any;
    component.clients = [{ id: 'client-real', name: 'Buyer', phone: '+919000000000' }];
    component.clientLinks = [];
    component.state.lform = { ...component.blankL(), clientId: 'client-real', plots: ['property-real'], loc: 'exact', price: 'exact', includeIntelligence: true };
    vi.spyOn(adapter.properties, 'get').mockResolvedValue({ ok: true, value: { id: 'property-real', price: 5400000, photos: ['https://example.com/approved.jpg'] } } as any);
    const create = vi.spyOn(adapter.clientLinks, 'create').mockResolvedValue({ ok: true, value: { id: 'link-real', url: 'https://example.com/client/?token=sample', token: 'sample' } });
    await component.sendLink();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ locationVisibility: 'exact', includeIntelligence: true,
      photoSelections: { 'property-real': ['external:0'] }, customPrices: { 'property-real': 5400000 } }));
    expect(component.state.lastLinkUrl).toBe('https://example.com/client/?token=sample');
    expect(component.state.linkBuild).toBe('done');
  });
  it('keeps a failed creation open and never invents a link URL', async () => {
    const component = new Component() as any;
    component.clients = [{ id: 'c', name: 'Buyer' }]; component.clientLinks = [];
    component.state = { ...component.state, linkBuild: 'new', lform: { ...component.blankL(), clientId: 'c', plots: ['p'] } };
    vi.spyOn(adapter.properties, 'get').mockResolvedValue({ ok: true, value: { id: 'p', photos: [] } } as any);
    vi.spyOn(adapter.clientLinks, 'create').mockResolvedValue({ ok: false, error: { code: 'unavailable', message: 'Please retry' } } as any);
    await component.sendLink();
    expect(component.state.linkBuild).toBe('new');
    expect(component.state.linkError).toBe('Please retry');
    expect(component.state.lastLinkUrl).toBeUndefined();
  });
});

describe('complete saved property overview', () => {
  it('renders the actual property and money templates without a template error', () => {
    const component = new Component() as any;
    const property = { id: 'review-p', type: 'Residential Plot', want: 'Plot', size: '300 sq yd',
      city: 'Mohali', area: 'Sector 79', loc: 'Sector 79, Mohali', price: 5400000, status: 'available',
      photos: [], docs: [], highlights: [], specs: { frontage: '30', depth: '90', notes: 'Saved property note' } };
    component.properties = [property];
    component.state = { ...component.state, section: 'properties', propDetail: property.id, pdTab: 'overview' };
    component.__templateFn = renderApp;
    document.body.innerHTML = '<div id="app"></div>';
    component.render();
    expect(document.body.textContent).toContain('All saved property details');
    expect(document.body.textContent).toContain('Saved property note');
    const capture = (name: string) => {
      if (process.env.MAPCO_UI_REVIEW !== '1') return;
      // .review/ is a scratch output folder and is not committed, so create it.
      mkdirSync('.review', { recursive: true });
      writeFileSync(`.review/${name}.html`, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + globalHead + '</head><body>' + document.body.innerHTML + '</body></html>');
    };
    capture('property');
    component.state = { ...component.state, section: 'deals', propDetail: null, selectedDeal: component.deals[0].id, dealTab: 'money' };
    component.render();
    expect(document.body.textContent).toContain('Totals update automatically');
    capture('money');
    const oldWorkspace = deskStore.sellerWorkspace;
    deskStore.sellerWorkspace = { seller: { id: 'review-s', name: 'Sample Seller', phone: '+919000000000',
      kind: 'Individual', city: 'Mohali', note: 'Call before visiting.' }, active: [{ property, ps: { relation: 'Owner', askPrice: 5400000, availConfirmed: true } }], sold: [] } as any;
    component.state = { ...component.state, section: 'clients', selectedDeal: null, sellerView: 'review-s', svTab: 'overview' };
    component.render();
    expect(document.body.textContent).toContain('Seller details');
    expect(document.body.textContent).toContain('Call before visiting.');
    capture('seller');
    deskStore.sellerWorkspace = oldWorkspace;
    component.clients = [{ id: 'review-c', name: 'Sample Buyer', phone: '+919000000000', city: 'Mohali',
      status: 'warm', budget: '40L – 60L', want: 'Plot', interest: [], types: ['Residential Plot'], areas: ['Sector 79'], prefs: ['Park facing'], notes: [] }];
    component.state = { ...component.state, sellerView: null, selectedClient: 'review-c', cpTab: 'overview' };
    component.render();
    expect(document.body.textContent).toContain('Buying requirements');
    capture('buyer');
    document.body.innerHTML = '';
  });
  it.each([
    ['Flat', { superArea: '1825', maintenance: '4200' }, ['1825', '4200']],
    ['Kothi', { kitchens: '2', notes: 'Keys with owner' }, ['2', 'Keys with owner']],
    ['Residential Plot', { block: 'Block C', boundaryWall: true }, ['Block C', 'Boundary']],
    ['Commercial Booth', { washroom: true, currentUse: 'Rented' }, ['Washroom', 'Rented']],
    ['Industrial Plot', { access: 'Truck access', powerLoad: '100' }, ['Truck access', '100']],
  ])('shows saved %s answers from its Add Property fields', (type, specs, answers) => {
    const component = new Component() as any;
    const view = component.buildPropertyOverview({ type, size: '300 sq yd', specs });
    const text = JSON.stringify(view.detailGroups);
    for (const answer of answers as string[]) expect(text).toContain(answer);
  });

  it('deducts token and later buyer payments, without treating commission as property payment', () => {
    const money = (new Component() as any).dealMoney({ value: 1000000, cB: 0, cSMode: 'fixed', cSFix: 20000,
      pay: [{ k: 'token', amt: 50000 }, { k: 'buyerPay', amt: 200000 }, { k: 'commS', amt: 5000 }] });
    expect(money).toMatchObject({ buyerPaid: 250000, remaining: 750000, cB: 0, expected: 20000, due: 15000 });
  });
});

describe('client presentation and visit requests', () => {
  it('removes the generated report from the payload when MAPCO AI is off', () => {
    const state = snapshotToState({ visibility: { location: 'exact', intelligence: false }, properties: [{ id: 'p', photos: [], intelligence: { status: 'ready', local: [], city: [] } }] });
    if (state.kind !== 'valid' && state.kind !== 'no-approved-photos') throw Error('Invalid fixture');
    expect(state.payload.intelligenceVisible).toBe(false);
    expect(state.payload.properties[0]?.intelligence).toBeUndefined();
    const host = document.createElement('div'); renderClientLinkView(host, state.payload);
    expect(host.querySelector<HTMLElement>('#cl-ai')?.style.display).toBe('none');
  });
  it('shows a saved satellite pin without an AI report, but strips it for area-only links', () => {
    const snapshot = { visibility: { price: 'shown', location: 'exact' },
      properties: [{ id: 'public-0', area: 'Sector 79', location: { latitude: 30.7, longitude: 76.7, secret: 'private' }, photos: [] }] };
    for (const visibility of ['exact', 'area', 'hidden']) {
      const state = snapshotToState({ ...snapshot, visibility: { ...snapshot.visibility, location: visibility } });
      if (state.kind !== 'valid' && state.kind !== 'no-approved-photos') throw Error('Invalid fixture');
      const host = document.createElement('div');
      renderClientLinkView(host, state.payload);
      expect(Boolean(host.querySelector('iframe')), visibility).toBe(visibility === 'exact');
      expect(JSON.stringify(state.payload)).not.toContain('private');
      expect(state.payload.properties[0]?.intelligence).toBeUndefined();
    }
  });

  it('projects the same saved pin into the dealer preview only for exact sharing', () => {
    const property = { ...payload.properties[0], location: { latitude: 30.7, longitude: 76.7 }, sellerPhone: 'private' } as any;
    for (const loc of ['exact', 'area', 'hidden']) {
      const projected = previewPayloadFromLink({ props: [property.id], loc, price: 'shown' } as any, [property], 'Dealer');
      expect(Boolean(projected.properties[0]?.location)).toBe(loc === 'exact');
      expect(JSON.stringify(projected)).not.toContain('private');
    }
  });
  it('does not invent a satellite position when only an area was shared', () => {
    const host = document.createElement('div');
    renderClientLinkView(host, payload);
    expect(host.querySelector('iframe')).toBeNull();
    expect(host.textContent).toContain('Exact location not shared yet');
    expect(host.textContent).toContain('MAPCO AI');
    expect(host.textContent).not.toContain('undefined facing');
  });

  it('renders a square satellite panel from an exact shared origin', () => {
    const host = document.createElement('div');
    renderClientLinkView(host, { ...payload, properties: [{ ...payload.properties[0]!, intelligence: {
      status: 'ready', origin: { latitude: 30.7, longitude: 76.7 }, local: [], city: [],
      generatedAt: '', schemaVersion: 1, pipelineVersion: 'test', provider: 'test', model: 'test',
    } }] });
    expect(host.querySelector('.cl-satellite iframe')?.getAttribute('src')).toContain('30.7%2C76.7');
    expect(host.querySelector('iframe')?.getAttribute('src')).toContain('t=k');
  });

  it('validates the requested slot and includes property, date and IST time in WhatsApp', () => {
    const host = document.createElement('div');
    const onEvent = vi.fn();
    renderClientLinkView(host, payload, { onEvent });
    const request = host.querySelector<HTMLAnchorElement>('#cl-request-visit')!;
    request.click();
    expect(onEvent).not.toHaveBeenCalled();
    expect(host.querySelector('#cl-visit-status')?.textContent).toContain('future date');
    const future = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    host.querySelector<HTMLInputElement>('#cl-visit-date')!.value = future;
    host.querySelector<HTMLSelectElement>('#cl-visit-time')!.value = '11:00';
    request.addEventListener('click', event => event.preventDefault());
    request.click();
    expect(decodeURIComponent(request.href)).toContain(`${future} at 11:00 IST`);
    expect(decodeURIComponent(request.href)).toContain('Sector 79 (300 sq yd)');
    expect(onEvent).toHaveBeenCalledWith('visit_requested', 'shared-1');
  });

  it('keeps preview requests local', () => {
    const host = document.createElement('div'), onEvent = vi.fn();
    renderClientLinkView(host, payload, { embedded: true, onEvent });
    host.querySelector<HTMLInputElement>('#cl-visit-date')!.value = '2099-01-01';
    host.querySelector<HTMLSelectElement>('#cl-visit-time')!.value = '11:00';
    host.querySelector<HTMLAnchorElement>('#cl-request-visit')!.click();
    expect(onEvent).not.toHaveBeenCalled();
    expect(host.querySelector('#cl-visit-status')?.textContent).toContain('Preview:');
  });
});
