// @vitest-environment jsdom
/*
 * A property that persisted as a draft must not be presented as on sale.
 *
 * Saving without the readiness data the database requires stores
 * lifecycle:'draft'. The dealer was told nothing: the property was counted
 * under "On sale", its price was added to "VALUE ON SALE — total active
 * inventory", and it could not actually be shared with anyone.
 *
 * The invariant: persisted lifecycle == what the dealer sees == what the
 * dashboard counts use.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { deskStore, toDeskProperty } from '../src/apps/dealer/desk-store';
import type { Property } from '../src/packages/data/types';

afterEach(() => vi.restoreAllMocks());

const prop = (over: Partial<Property>) => toDeskProperty({
  id: 'p', type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Sector 91',
  loc: 'Sector 91, Mohali', sector: '91', size: '250 sq yd', facing: 'East',
  position: 'Corner plot', approvals: [], landmarks: [], price: 7500000,
  photos: [], published: true, sold: false, ...over,
} as unknown as Property);

describe('a draft is never presented as on sale', () => {
  it('marks a draft record as a draft in the Desk view', () => {
    expect(prop({ id: 'd', lifecycle: 'draft' }).draft).toBe(true);
    expect(prop({ id: 'l', lifecycle: 'on-sale' }).draft).toBe(false);
  });

  it('reports readiness from the persisted lifecycle, not a guess', () => {
    const c = new Component() as any;
    expect(c.readinessOf(prop({ id: 'd', lifecycle: 'draft' })).state).toBe('draft');
    expect(c.readinessOf(prop({ id: 'l', lifecycle: 'on-sale' })).state).toBe('ready');
  });

  it('names what is missing instead of downgrading silently', () => {
    const c = new Component() as any;
    expect(c.draftNotice(['city'])).toBe('Saved as a draft. Add the city to put it on sale.');
    expect(c.draftNotice(['city', 'area'])).toBe('Saved as a draft. Add the city and area to put it on sale.');
    expect(c.draftNotice(['city', 'area', 'size']))
      .toBe('Saved as a draft. Add the city, area and size to put it on sale.');
    // A complete save says nothing at all.
    expect(c.draftNotice([])).toBe('');
    expect(c.draftNotice(undefined)).toBe('');
  });

  it('surfaces the notice through the alert the wizard already renders', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pform: { ...c.blankP(), city: '', area: 'Sector 12', type: 'Residential Plot' } };
    vi.spyOn(deskStore, 'saveProperty').mockResolvedValue({
      property: { id: 'p9', city: '', area: 'Sector 12', photos: [] },
      missing: ['city'],
    } as never);

    await c.savePlot();

    expect(c.state.propError).toBe('Saved as a draft. Add the city to put it on sale.');
    expect(c.state.propMissing).toEqual(['city']);
  });

  it('says it on the finish, not on every step of the way there', async () => {
    /* Each Next autosaves so nothing typed is lost. Announcing the downgrade
       on every one of those read as an error the dealer had caused, halfway
       through a form whose later steps supply the very fields it named. */
    const c = new Component() as any;
    c.state = { ...c.state, pform: { ...c.blankP(), city: '', area: 'Sector 12', type: 'Residential Plot' } };
    vi.spyOn(deskStore, 'saveProperty').mockResolvedValue({
      property: { id: 'p9', city: '', area: 'Sector 12', photos: [] },
      missing: ['city'],
    } as never);

    await c.savePlot(false);

    expect(c.state.propError).toBe('');
    // Still persisted, and still known to be incomplete.
    expect(c.state.pEditId).toBe('p9');
    expect(c.state.propMissing).toEqual(['city']);
  });

  it('never announces a draft as live on Earth, Links and Marketing', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pform: { ...c.blankP(), city: 'Mohali', area: 'Sector 12' } };
    const saveProperty = vi.spyOn(deskStore, 'saveProperty');

    saveProperty.mockResolvedValue({
      property: { id: 'p9', city: 'Mohali', area: 'Sector 12', photos: [] },
      missing: ['size'],
    } as never);
    await c.savePlot();
    expect(c.state.savingProp.live).toBe(false);

    c.state = { ...c.state, pform: { ...c.blankP(), city: 'Mohali', area: 'Sector 12' } };
    saveProperty.mockResolvedValue({
      property: { id: 'p9', city: 'Mohali', area: 'Sector 12', photos: [] },
    } as never);
    await c.savePlot();
    expect(c.state.savingProp.live).toBe(true);
  });

  it('says nothing when the property really did go on sale', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pform: { ...c.blankP(), city: 'Mohali', area: 'Sector 12' } };
    vi.spyOn(deskStore, 'saveProperty').mockResolvedValue({
      property: { id: 'p9', city: 'Mohali', area: 'Sector 12', photos: [] },
      missing: [],
    } as never);

    await c.savePlot(false);

    expect(c.state.propError).toBe('');
  });
});
