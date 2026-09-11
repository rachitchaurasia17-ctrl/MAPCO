// @vitest-environment jsdom
/*
 * The Add Property wizard autosaves as the dealer moves between steps, so
 * nothing typed is ever lost and the Photos step has a property to attach
 * photos to. Those saves are background work and have to behave like it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { deskStore, toDeskProperty } from '../src/apps/dealer/desk-store';

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

describe('a double-click on the step buttons', () => {
  /* Every handler is rebound on each render and a render happens the instant
     the step changes, so a second click milliseconds later read the new
     handler and moved again. A dealer double-clicking Next went from
     Property past Seller to Photos without ever seeing the step they
     skipped. */
  const wizard = () => {
    const c = new Component() as any;
    c.state = { ...c.state, pstep: 1, addPlotOpen: true,
      pform: { ...c.blankP(), city: 'Mohali', area: 'Sector 12' } };
    vi.spyOn(c, 'savePlot').mockResolvedValue(undefined);
    return c;
  };

  it('moves exactly one step forward', () => {
    const c = wizard();
    const next = () => c.renderVals().pNext();
    next(); next(); next();
    expect(c.state.pstep).toBe(2);
  });

  it('moves exactly one step back', async () => {
    const c = wizard();
    c.renderVals().pNext();
    expect(c.state.pstep).toBe(2);
    await new Promise((r) => setTimeout(r, 400));
    const back = () => c.renderVals().pBack();
    back(); back();
    expect(c.state.pstep).toBe(1);
  });

  it('still lets a dealer walk the wizard at their own pace', async () => {
    const c = wizard();
    for (const expected of [2, 3, 4]) {
      c.renderVals().pNext();
      expect(c.state.pstep).toBe(expected);
      await new Promise((r) => setTimeout(r, 400));
    }
  });
});

describe('coming back to an unfinished draft', () => {
  /* A dealer who closes the wizard half way through must find their work
     where they left it. Everything they typed is on the canonical record by
     then — the step advances autosave — so reopening has to put all of it
     back into the form, not just the fields step 1 happens to show. */
  const saved = {
    id: 'p-draft', type: 'Kothi', want: 'Kothi', city: 'Mohali', area: 'Sector 70',
    loc: 'Sector 70, Mohali', sector: '70', size: '400 sq yd', sizeUnit: 'sq yd',
    facing: 'North', position: 'Corner plot', price: 21000000,
    approvals: [], landmarks: [], photos: [], published: false, sold: false,
    lifecycle: 'draft', specs: { beds: '5', baths: '4', lawn: true },
    registryRef: 'REG-70', approvalRef: 'GMADA-70',
  };

  it('puts back what the dealer had already entered', () => {
    const c = new Component() as any;
    c.properties = [toDeskProperty(saved as never)];
    c.sellerLinks = {};

    c.openEdit('p-draft', 1);

    const form = c.state.pform;
    expect(c.state.pEditId).toBe('p-draft');
    expect(form.type).toBe('Kothi');
    expect(form.city).toBe('Mohali');
    expect(form.area).toBe('Sector 70');
    expect(form.size).toBe('400');
    expect(form.unit).toBe('sq yd');
    expect(form.facing).toBe('North');
    // 2.1 crore, as the form takes it.
    expect(form.price).toBe('2.1');
  });

  it('opens on the step the dealer was sent to, not always the first', () => {
    const c = new Component() as any;
    c.properties = [toDeskProperty(saved as never)];
    c.sellerLinks = {};

    c.openEdit('p-draft', 3);

    expect(c.state.pstep).toBe(3);
    expect(c.state.addPlotOpen).toBe(true);
  });
});
