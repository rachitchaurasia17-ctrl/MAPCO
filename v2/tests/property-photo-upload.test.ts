// @vitest-environment jsdom
/*
 * Real property photos.
 *
 * "Add photo" used to push an integer into pform.photos. That drew a stock
 * illustration keyed off the slot number and uploaded nothing, so a dealer
 * believed a property had photos while every buyer link had none. The photo
 * model is now keyed by the canonical storage path, which is what actually
 * persists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok, err } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';
import { toDeskProperty } from '../src/apps/dealer/desk-store';
import type { Property } from '../src/packages/data/types';

afterEach(() => vi.restoreAllMocks());

const ref = (n: string) => ({
  kind: 'storage' as const, id: n,
  path: `dealers/d1/properties/p1/${n}.jpg`,
});

const property = (over: Partial<Property> = {}) => ({
  id: 'p1', type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Sector 91',
  loc: 'Sector 91, Mohali', sector: '91', size: '250 sq yd', facing: 'East',
  position: 'Corner plot', approvals: [], landmarks: [], price: 7500000,
  photos: [], published: true, sold: false, ...over,
} as unknown as Property);

describe('property photo model', () => {
  it('exposes stored refs and the signed display URLs to the Desk', () => {
    const desk = toDeskProperty(property({
      photoStorage: [ref('a'), ref('b')],
      photos: ['https://signed/a', 'https://signed/b'],
    }));
    expect(desk.photoStorage).toEqual([ref('a'), ref('b')]);
    expect(desk.photoCount).toBe(2);
  });

  it('draws the real photo on a card instead of a stock illustration', () => {
    const c = new Component() as any;
    const pr = { id: 'p1', type: 'Residential Plot', want: 'Plot', photos: ['https://signed/cover.jpg'] };
    expect(c.plotPhoto(pr, 0)).toBe('https://signed/cover.jpg');
  });

  it('falls back to the stock illustration only when there is no photo', () => {
    const c = new Component() as any;
    expect(c.plotPhoto({ id: 'p1', type: 'Residential Plot', want: 'Plot', photos: [] }, 0))
      .toMatch(/^\/assets\/ph-/);
  });

  it('uploads through the repository and keys the photo by its storage path', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pEditId: 'p1', pform: { ...c.blankP(), city: 'Mohali', area: 'Sector 91' } };
    const upload = vi.spyOn(adapter.media, 'uploadPropertyPhoto')
      .mockResolvedValue(ok(ref('a')) as never);
    vi.spyOn(c, 'savePlot').mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' });

    await c.uploadPhotos([file]);

    expect(upload).toHaveBeenCalledWith('p1', file);
    expect(c.state.pform.photos).toEqual([ref('a').path]);
    expect(c.state.pform.photoStorage).toEqual([ref('a')]);
    // First photo uploaded becomes the cover, matching "the first one is what buyers see".
    expect(c.state.pform.cover).toBe(ref('a').path);
  });

  it('reports a failed upload and leaves no tile behind', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pEditId: 'p1', pform: { ...c.blankP(), city: 'Mohali' } };
    vi.spyOn(adapter.media, 'uploadPropertyPhoto')
      .mockResolvedValue(err('validation', 'Each photo must be 5 MB or smaller.') as never);
    const save = vi.spyOn(c, 'savePlot').mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1])], 'big.jpg', { type: 'image/jpeg' });

    await c.uploadPhotos([file]);

    expect(c.state.pform.photos).toEqual([]);
    expect(c.state.propError).toBe('Each photo must be 5 MB or smaller.');
    // No persistence attempt for a photo that never uploaded.
    expect(save).not.toHaveBeenCalled();
  });

  it('says what is missing instead of silently doing nothing with no saved property', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pEditId: null, pform: { ...c.blankP() } };
    const upload = vi.spyOn(adapter.media, 'uploadPropertyPhoto');
    await c.uploadPhotos([new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })]);
    expect(upload).not.toHaveBeenCalled();
    expect(c.state.propError).toMatch(/city and area/i);
  });

  it('removing a photo drops its ref so it leaves every buyer link', async () => {
    const c = new Component() as any;
    c.state = { ...c.state, pEditId: 'p1', pform: {
      ...c.blankP(), city: 'Mohali',
      photos: [ref('a').path, ref('b').path], photoStorage: [ref('a'), ref('b')],
      photoUrls: { [ref('a').path]: 'https://signed/a', [ref('b').path]: 'https://signed/b' },
      cover: ref('a').path,
    } };
    vi.spyOn(c, 'savePlot').mockResolvedValue(undefined);
    vi.spyOn(adapter.media, 'removePropertyPhotos').mockResolvedValue(ok(undefined) as never);

    c.togglePhoto(ref('a').path);

    expect(c.state.pform.photos).toEqual([ref('b').path]);
    expect(c.state.pform.photoStorage).toEqual([ref('b')]);
    // The cover moves to a photo that still exists rather than dangling.
    expect(c.state.pform.cover).toBe(ref('b').path);
  });
});
