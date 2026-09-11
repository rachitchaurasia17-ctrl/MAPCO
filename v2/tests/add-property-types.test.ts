// @vitest-environment jsdom
/*
 * Add Property has to work for every kind of property a dealer sells, not
 * just a plot.
 *
 * Two things decide whether a dealer can actually use it:
 *   · a completed form of that type must be allowed On Sale — if a type can
 *     never satisfy the readiness rule, every one of them silently persists
 *     as a draft and is invisible to customers forever;
 *   · the fields that belong to that type must survive, and the fields that
 *     belong to a different type must not follow it across.
 */
import { describe, expect, it } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { toCanonicalProperty, missingForOnSale } from '../src/apps/dealer/desk-store';
import { propertySpecKeys, staleSpecKeys } from '../src/packages/data/property-specs';

const component = new Component() as any;
const TYPES = component.PTYPES.map((t: { k: string }) => t.k);

/** What a dealer has filled in by the end of step 1 for any type. */
const completed = (type: string) => ({
  ...component.blankP(),
  type, city: 'Mohali', area: 'Sector 91', sector: '91',
  size: '250', unit: 'sq yd', price: '0.75',
});

describe('every property type the wizard offers', () => {
  it('offers the ten types the Desk knows about', () => {
    expect(TYPES).toHaveLength(10);
    expect(TYPES).toContain('Residential Plot');
    expect(TYPES).toContain('Flat');
    expect(TYPES).toContain('Commercial SCO');
    expect(TYPES).toContain('Industrial Plot');
  });

  it.each(TYPES)('can put a completed %s on sale', (type: string) => {
    const property = toCanonicalProperty(completed(type) as never, undefined, 'p1');
    const missing = missingForOnSale(property);

    // A type that can never satisfy this is a type that can never be sold.
    expect(missing, `${type} is missing ${missing.join(', ')}`).toEqual([]);
  });

  it.each(TYPES)('keeps %s on its own field model', (type: string) => {
    const property = toCanonicalProperty(completed(type) as never, undefined, 'p1');
    // Nothing from another kind of property may ride along.
    expect(staleSpecKeys(type, property.specs ?? {})).toEqual([]);
  });

  it('drops the fields that belonged to the type the dealer changed away from', () => {
    /* A dealer who starts a Flat, fills in the bathrooms and the floor, then
       realises it is a plot must not end up with a plot on the fourth floor.
       A flat is described by its configuration — "3 BHK" — so `beds` belongs
       to a Kothi or a Villa and is not part of a flat's model at all. */
    const flat = toCanonicalProperty(
      { ...completed('Flat'), baths: '2', floor: '4', config: '3 BHK' } as never, undefined, 'p1');
    expect(flat.specs?.baths).toBe('2');
    expect(flat.specs?.floor).toBe('4');

    const plot = toCanonicalProperty(
      { ...completed('Residential Plot'), baths: '2', floor: '4', config: '3 BHK', corner: true } as never,
      flat, 'p1');
    expect(plot.specs?.baths).toBeUndefined();
    expect(plot.specs?.floor).toBeUndefined();
    expect(plot.specs?.corner).toBe(true);
  });

  it('describes a kothi by its bedrooms and a flat by its configuration', () => {
    const kothi = toCanonicalProperty(
      { ...completed('Kothi'), beds: '4', baths: '3' } as never, undefined, 'p1');
    expect(kothi.specs?.beds).toBe('4');

    const flat = toCanonicalProperty(
      { ...completed('Flat'), beds: '4', config: '3 BHK' } as never, undefined, 'p2');
    expect(flat.specs?.beds).toBeUndefined();
    expect(flat.specs?.config).toBe('3 BHK');
  });

  it('gives a commercial property a facing it can legally hold', () => {
    // Commercial units have no compass facing; the record says so rather
    // than leaving the field empty and failing readiness for every one.
    const sco = toCanonicalProperty(completed('Commercial SCO') as never, undefined, 'p1');
    expect(sco.facing).toBe('—');
    expect(missingForOnSale(sco)).toEqual([]);
  });

  it('records a position for a property with no corner or park to speak of', () => {
    const flat = toCanonicalProperty(completed('Flat') as never, undefined, 'p1');
    expect(String(flat.position)).not.toBe('');
  });

  it('names what is missing rather than refusing the save', () => {
    const half = toCanonicalProperty(
      { ...component.blankP(), type: 'Flat', city: 'Mohali' } as never, undefined, 'p1');
    const missing = missingForOnSale(half);
    expect(missing).toContain('area');
    expect(missing).toContain('size');
  });

  it.each(TYPES)('has a field model for %s at all', (type: string) => {
    expect(propertySpecKeys(type).length).toBeGreaterThan(0);
  });
});
