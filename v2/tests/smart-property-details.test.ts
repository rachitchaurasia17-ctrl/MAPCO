import { describe, it, expect } from 'vitest';
import { DETAIL_SCHEMAS, detailVisible, detailCompletion } from '../src/packages/data/property-details-schema';
import { propertyKindOf, normalizePropertySpecs, PROPERTY_SPEC_KEYS } from '../src/packages/data/property-specs';
import { switchDetailType, detailView } from '../src/apps/dealer/property-details';
import { toCanonicalProperty, toDeskProperty } from '../src/apps/dealer/desk-store';
import { persistentPropertyPayload } from '../src/packages/data/property-photos';
import { readFileSync } from 'node:fs';

const base = { type: 'Residential Plot', city: 'Mohali', area: '92', size: '300', unit: 'sq yd', price: '1' };
describe('smart property details', () => {
 it('has unique fields and a persistable schema for all ten kinds', () => {
  expect(Object.keys(DETAIL_SCHEMAS)).toHaveLength(10);
  for (const [kind, fields] of Object.entries(DETAIL_SCHEMAS)) {
   expect(new Set(fields.map(f => f.key)).size).toBe(fields.length);
   for (const field of fields) expect(PROPERTY_SPEC_KEYS[kind as keyof typeof PROPERTY_SPEC_KEYS]).toContain(field.key);
  }
 });
 it.each([
 ['Residential Plot', { frontage: 30, corner: true, road2: 24, shape: 'Irregular', dimBack: 28, mutation: true }],
 ['Flat', { superArea: 1800, lift: true, liftCount: 2, furnishing: 'Fully furnished', wardrobes: true }],
 ['Commercial SCO', { occupancy: 'Rented', tenant: 'Bank', monthlyRent: 150000, leaseStart: '2026-09-01', groundArea: 1000 }],
 ['Office', { fitout: 'Plug-and-play', seats: 40, networking: true, cam: 5000 }],
 ['Industrial Plot', { powerLoad: 120, built: true, shedArea: 4000, pollutionConsent: false }]
 ])('round-trips %s through the canonical persistence boundary', (type, values) => {
  const saved = persistentPropertyPayload(toCanonicalProperty({ ...base, type: String(type), ...values as object }, undefined, 'test'));
  expect(saved.specs).toMatchObject(values);
  expect(toDeskProperty(saved)).toMatchObject(values);
 });
 it('restores independent type drafts without writing them into specs', () => {
  const plot = { ...base, frontage: 30, corner: true };
  const flat = { ...switchDetailType(plot, 'Flat'), beds: 3 };
  expect(flat.frontage).toBeUndefined();
  expect(switchDetailType(flat, 'Residential Plot')).toMatchObject(plot);
  expect(toCanonicalProperty(flat).specs).not.toHaveProperty('frontage');
  expect(toCanonicalProperty(flat).specs).not.toHaveProperty('_detailDrafts');
 });
 it.each([
 ['plot', 'road2', 'corner', true], ['plot', 'dimBack', 'shape', 'Irregular'],
 ['sco', 'leaseEnd', 'occupancy', 'Rented'], ['office', 'networking', 'fitout', 'Plug-and-play'],
 ['indplot', 'shedArea', 'built', true], ['flat', 'liftCount', 'lift', true],
 ['flat', 'wardrobes', 'furnishing', 'Fully furnished'], ['kothi', 'basementArea', 'basement', true],
 ['flat', 'possessionDate', 'possession', 'Under construction']
 ])('reveals %s/%s only for its condition', (kind, key, parent, value) => {
  const field = DETAIL_SCHEMAS[kind as keyof typeof DETAIL_SCHEMAS].find(f => f.key === key)!;
  expect(detailVisible(field, {})).toBe(false);
  expect(detailVisible(field, { [parent]: value })).toBe(true);
 });
 it('preserves unknown legacy values and clears explicitly emptied known values', () => {
  const old = toCanonicalProperty({ ...base, frontage: 30 });
  old.specs = { ...old.specs, legacyExpertNote: 'keep me' };
  const edited = persistentPropertyPayload(toCanonicalProperty({ ...base, frontage: '' }, old));
  expect(edited.specs).toEqual({ legacyExpertNote: 'keep me' });
  expect(toCanonicalProperty({ ...base, notes: '' }, { ...old, privateNotes: 'old' }).privateNotes).toBe('');
  expect(toCanonicalProperty({ ...base, type: 'Flat' }, old).specs).toBeUndefined();
 });
 it('counts factual completion, including zero, without invented defaults', () => {
  expect(detailCompletion('plot', {}).complete).toBe(0);
  expect(detailCompletion('flat', { totalFloors: 0 }).complete).toBe(1);
 });
 it('provides numeric handlers, escapes field values and keeps optional groups collapsed', () => {
  let patch = {};
  const view = detailView({ ...base, plotNo: '\"<script>' }, value => { patch = value; });
  const essential = view.pDetailSections.find(g => g.essential)!;
  expect(essential.fields.find(f => f.key === 'plotNo')!.value).toBe('&quot;&lt;script&gt;');
  essential.fields.find(f => f.key === 'frontage')!.on({ target: { value: '30.5' } });
  expect(patch).toEqual({ frontage: 30.5 });
  expect(view.pDetailSections.filter(g => !g.essential).every(g => !g.open)).toBe(true);
 });
 it('keeps unrelated form fields out of normalized specs', () => {
  expect(normalizePropertySpecs('Residential Plot', { ...base, frontage: 30 }, false)).toEqual({ frontage: 30 });
 });
 it('compiles the actual nested dealer template without a browser', async () => {
  const source = readFileSync(new URL('../src/apps/dealer/template.ts', import.meta.url), 'utf8');
  const { renderApp } = await import('../src/apps/dealer/template');
  // The compiler executes before reading the first view-model variable.
  try { renderApp({}); } catch (error) { expect(error).not.toBeInstanceOf(SyntaxError); }
  expect(source).toContain('pDetailSections');
  expect(source).toContain('@media(max-width:600px)');
 });
});

describe('questionnaire rendering and repository reopen', () => {
 it.each(['Residential Plot', 'Flat', 'Commercial SCO', 'Office', 'Industrial Plot'])('renders the actual Section 3 markup for %s', type => {
  const source = readFileSync(new URL('../src/apps/dealer/template.ts', import.meta.url), 'utf8');
  const section = source.slice(source.indexOf('<section class="property-details"'), source.indexOf('</section>', source.indexOf('<section class="property-details"')) + 10);
  const decoded = new Function('return `' + section + '`;')();
  const render = new Function('props', 'with(props) { return `' + decoded + '`; }');
  const form = { ...base, type, occupancy: 'Rented', fitout: 'Plug-and-play', built: true };
  const view = detailView(form, () => {}, { Features: true, 'More details': true, 'Legal / ownership': true, 'Commercial / occupancy': true });
  const html = render({ ...view, pform: form, pSizeUnits: [], onPForm: () => {}, __b: () => 'handler(event)' });
  expect(html).toContain(view.pDetailsTitle);
  expect(html).toContain('aria-expanded="true"');
  if(type === 'Flat') { expect(html).toContain('Super area'); expect(html).not.toContain('Second-side road'); }
  if(type === 'Office') expect(html).toContain('Networking');
  if(type === 'Commercial SCO') expect(html).toContain('Lease end');
  if(type === 'Industrial Plot') expect(html).toContain('Shed area');
 });
 it('saves, fetches and edits an advanced record through the repository', async () => {
  const { adapter } = await import('../src/packages/data/mock-adapter-v2');
  const id = 'smart-details-reopen';
  const values = { ...base, frontage: 35, corner: true, road2: 24, mutation: false };
  const saved = await adapter.properties.save(toCanonicalProperty(values, undefined, id));
  expect(saved.ok).toBe(true);
  const reopened = await adapter.properties.get(id);
  expect(reopened.ok).toBe(true);
  if(reopened.ok) {
   expect(toDeskProperty(reopened.value)).toMatchObject({ frontage: 35, road2: 24, mutation: false });
   const edited = await adapter.properties.save(toCanonicalProperty({ ...values, frontage: 36 }, reopened.value));
   expect(edited.ok).toBe(true);
   if(edited.ok) expect(edited.value.specs).toMatchObject({ frontage: 36, road2: 24 });
  }
  await adapter.properties.remove(id);
 });
});
