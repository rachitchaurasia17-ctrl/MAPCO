// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { propertyKindOf, propertySpecKeys } from '../src/packages/data/property-specs';

/* Every property type the Desk offers. Each one gets its own spec sheet;
   none of them may fall through to a shared generic list. */
const TYPES = [
  'Residential Plot', 'Flat', 'Builder Floor', 'Kothi', 'Villa',
  'Commercial SCO', 'Commercial Booth', 'Office', 'Showroom', 'Industrial Plot',
];

/* The five cards, in order, with the colour each is painted. */
const CARDS = [
  { title: 'Essentials', bg: '#bae6fd', ctl: '#fde047' },
  { title: 'Features', bg: '#e9d5ff', ctl: '#6ee7b7' },
  { title: 'Legal & ownership', bg: '#fde68a', ctl: '#93c5fd' },
  { title: null, bg: '#bbf7d0', ctl: '#f9a8d4' },   // "how it is used" — titled per type
  { title: 'Your private note', bg: '#fecaca', ctl: '#67e8f9' },
];

const INK = '#1c1917';

/** Build one type's spec sheet and record every key its controls write. */
function sheetFor(type: string) {
  const component = new Component() as any;
  const written: string[] = [];
  component.state = { ...component.state, pform: { ...component.blankP(), type } };
  component.setP = (patch: Record<string, unknown>) => { written.push(...Object.keys(patch)); };
  const sheet = component.typeFields(component.state.pform);
  const sections = [...sheet.pSections, ...sheet.pMoreSections];
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.opts) field.opts.forEach((o: any) => o.go());
      else field.on({ target: { value: 'x' } });
    }
  }
  return { sheet, sections, written: [...new Set(written)] };
}

describe('the dealer spec sheet', () => {
  it('gives all ten property types the same five coloured cards', () => {
    for (const type of TYPES) {
      const { sections } = sheetFor(type);
      expect(sections, type).toHaveLength(CARDS.length);
      sections.forEach((section: any, i: number) => {
        if (CARDS[i].title) expect(section.title, type).toBe(CARDS[i].title);
        expect(section.style, type).toContain('background:' + CARDS[i].bg);
        expect(section.fields.length, type + ' / ' + section.title).toBeGreaterThan(0);
      });
    }
  });

  it('paints every answer in its own card colour, always on near-black text', () => {
    for (const type of TYPES) {
      const { sections } = sheetFor(type);
      sections.forEach((section: any, i: number) => {
        for (const field of section.fields) {
          const styles = field.opts ? field.opts.map((o: any) => o.style) : [field.inputStyle];
          for (const style of styles) {
            expect(style, type + ' / ' + field.label).toContain(CARDS[i].ctl);
            expect(style, type + ' / ' + field.label).toContain(INK);
          }
        }
      });
    }
  });

  it('opens on the two cards a dealer always fills, and holds the rest behind one tap', () => {
    for (const type of TYPES) {
      const { sheet } = sheetFor(type);
      expect(sheet.pSections.map((s: any) => s.title), type).toEqual(['Essentials', 'Features']);
      expect(sheet.pMoreSections, type).toHaveLength(3);
      expect(sheet.pMoreCount, type).toBeGreaterThan(0);
    }
  });

  it('asks each type its own questions instead of one generic commercial list', () => {
    const essentials = new Map<string, string>();
    for (const type of TYPES) {
      const { sheet } = sheetFor(type);
      essentials.set(type, sheet.pSections[0].fields.map((f: any) => f.label).join('|'));
    }
    // Kothi and Villa are deliberately one model; every other pair differs.
    const shared = new Set(['Kothi', 'Villa']);
    for (const a of TYPES) {
      for (const b of TYPES) {
        if (a === b || (shared.has(a) && shared.has(b))) continue;
        expect(essentials.get(a), a + ' vs ' + b).not.toBe(essentials.get(b));
      }
    }
  });

  it('only asks for what the persisted model can actually store', () => {
    // The rule property-specs.ts states: the saved model matches the rendered
    // form field for field. A question whose answer is dropped on save is a
    // dealer typing into a hole.
    for (const type of TYPES) {
      const { written } = sheetFor(type);
      const allowed = new Set([...propertySpecKeys(type), 'notes', 'beds']);
      const orphans = written.filter((key) => !allowed.has(key));
      expect(orphans, type + ' (' + propertyKindOf(type) + ')').toEqual([]);
    }
  });

  it('ends every type on a private note that is never a customer-facing field', () => {
    for (const type of TYPES) {
      const { sections } = sheetFor(type);
      const last = sections[sections.length - 1];
      expect(last.title, type).toBe('Your private note');
      expect(last.fields, type).toHaveLength(1);
      expect(last.fields[0].isNote, type).toBe(true);
      expect(last.hint, type).toContain('Only you see this');
    }
  });

  it('no longer asks for a second road or a fourth open side', () => {
    const { sheet, written } = sheetFor('Residential Plot');
    expect(written).not.toContain('road2');
    expect(written).not.toContain('facing2');
    const openSides = sheet.pSections[0].fields.find((f: any) => /sides open/i.test(f.label));
    expect(openSides.opts.map((o: any) => o.label))
      .toEqual(['1 side open', '2 sides open', '3 sides open']);
  });
});
