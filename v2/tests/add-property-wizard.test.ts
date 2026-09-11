// @vitest-environment jsdom
/*
 * The Add Property wizard autosaves as the dealer moves between steps, so
 * nothing typed is ever lost and the Photos step has a property to attach
 * photos to. Those saves are background work and have to behave like it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { deskStore } from '../src/apps/dealer/desk-store';

afterEach(() => vi.restoreAllMocks());

const started = (over: Record<string, unknown> = {}) => {
  const c = new Component() as any;
  c.state = { ...c.state, pform: { ...c.blankP(), city: 'Mohali', area: 'Sector 12', ...over } };
  return c;
};

describe('moving between steps', () => {
  it('saves one property, not one per step', async () => {
    /* Every Next fires a save without waiting for the last one. Run together,
       both read the same empty pEditId and each inserts its own row — the
       dealer fills in one form and finds three properties in their inventory. */
    const c = started();
    const ids: (string | undefined)[] = [];
    vi.spyOn(deskStore, 'saveProperty').mockImplementation((async (_form: unknown, opts: any) => {
      ids.push(opts?.id);
      await new Promise((r) => setTimeout(r, 5));
      return { property: { id: 'p1', city: 'Mohali', area: 'Sector 12', photos: [] } };
    }) as never);

    c.savePlot(false);
    c.savePlot(false);
    c.savePlot(false);
    await c._plotSave;

    // The first creates; every later one updates the record it created.
    expect(ids).toEqual([undefined, 'p1', 'p1']);
  });

  it('does not throw the full-screen card up on a step advance', async () => {
    const c = started();
    vi.spyOn(deskStore, 'saveProperty').mockResolvedValue({
      property: { id: 'p1', city: 'Mohali', area: 'Sector 12', photos: [] },
    } as never);

    await c.savePlot(false);

    // "Saved to MAPCO — live on Earth, Links and Marketing", over the whole
    // screen, because the dealer pressed Next.
    expect(c.state.savingProp).toBe(false);
    expect(c.state.pEditId).toBe('p1');
  });

  it('shows the card once the dealer finishes, and only then', async () => {
    const c = started();
    vi.spyOn(deskStore, 'saveProperty').mockResolvedValue({
      property: { id: 'p1', type: 'Residential Plot', city: 'Mohali', area: 'Sector 12', photos: [] },
    } as never);

    await c.savePlot();

    expect(c.state.savingProp).toMatchObject({ live: true, loc: 'Sector 12, Mohali' });
    expect(c.state.addPlotOpen).toBe(false);
  });

  it('reports a failed save instead of advancing quietly past it', async () => {
    const c = started();
    vi.spyOn(deskStore, 'saveProperty').mockResolvedValue({
      error: 'Could not save this property.', errorCode: 'unknown',
    } as never);

    await c.savePlot(false);

    expect(c.state.propError).toBe('Could not save this property.');
    expect(c.state.pEditId).toBeFalsy();
  });

  it('lets Save close the wizard even while a step advance is still writing', async () => {
    // Closing used to race the autosave: it wrote from the same stale form and
    // without the id the autosave was about to hand back.
    const c = started();
    const ids: (string | undefined)[] = [];
    vi.spyOn(deskStore, 'saveProperty').mockImplementation((async (_form: unknown, opts: any) => {
      ids.push(opts?.id);
      await new Promise((r) => setTimeout(r, 5));
      return { property: { id: 'p1', city: 'Mohali', area: 'Sector 12', photos: [] } };
    }) as never);

    c.savePlot(false);
    await c.savePlot();

    expect(ids).toEqual([undefined, 'p1']);
    expect(c.state.addPlotOpen).toBe(false);
  });
});
