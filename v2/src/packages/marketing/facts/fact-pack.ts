/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — Verified Fact Pack

   Mirrors the server-side allow-list in
   `plotmap_ai_marketing_facts_for()` (20260812000400_marketing_
   foundation.sql:270). That SQL function stays the authority in
   production; this module is the same projection applied to the
   client-side Property record so mock mode and Supabase mode produce
   identical fact packs.

   Facts are numbered F001… so the ChatGPT prompt can reference them and
   a human can audit every claim on a finished creative.

   Adding a field here is a deliberate act. Nothing is copied wholesale
   out of the property payload.
   ═══════════════════════════════════════════════════════════════ */
import type { Property } from '../../data/types';
import type { FactPack, VerifiedFact } from '../types';

/** Never marketed, in any channel, under any circumstance. */
export const EXCLUDED_FIELDS: readonly string[] = [
  'owner', 'ownerName', 'ownerPhone', 'sellerPhone', 'commission',
  'notes', 'internalNotes', 'documents', 'buyerData', 'views',
  'internalStatus', 'clientVisible', 'photoStorage',
];

/**
 * Claim vocabulary the operator and the model must never produce.
 * These are the classic real-estate hallucinations.
 */
export const PROHIBITED_CLAIMS: readonly string[] = [
  'best investment', 'guaranteed appreciation', 'assured returns',
  'high rental yield', 'price will rise', 'prices rising',
  'upcoming metro', 'upcoming airport', 'upcoming highway',
  'most demanded sector', 'hottest area', 'limited time offer',
  'last few plots', 'book before price increase',
  'any distance or travel time not supplied in the facts',
  'any amenity not supplied in the facts',
  'any price, rate or payment figure',
];

const pad = (n: number): string => `F${String(n).padStart(3, '0')}`;

/**
 * Build the marketing-safe fact pack for a property.
 * Returns null when the property must not be marketed at all.
 */
export function buildFactPack(property: Property): FactPack | null {
  // Same hard gate the SQL function applies.
  if (property.sold) return null;
  if (!property.published) return null;

  const facts: VerifiedFact[] = [];
  let n = 0;
  const add = (label: string, value: unknown, source: string): void => {
    const v = typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
    if (!v) return;
    facts.push({ id: pad(++n), label, value: v, source });
  };

  add('Property type', property.type, 'property.type');
  add('Sector', property.sector || property.area, 'property.sector');
  add('City', property.city, 'property.city');
  add('Locality', property.loc, 'property.loc');
  add('Size', property.size, 'property.size');
  add('Facing', property.facing, 'property.facing');
  add('Position', property.position, 'property.position');

  for (const approval of property.approvals ?? []) {
    add('Approval', approval, 'property.approvals[]');
  }

  // Landmarks are stated ONLY with their stored distance. A landmark with
  // no stored distance is dropped rather than guessed at.
  for (const landmark of property.landmarks ?? []) {
    if (!landmark?.name || !landmark?.distance) continue;
    add(`Nearby · ${landmark.name}`, landmark.distance, 'property.landmarks[]');
  }

  if (!facts.length) return null;

  return {
    propertyId: property.id,
    facts,
    excluded: EXCLUDED_FIELDS,
    prohibitedClaims: PROHIBITED_CLAIMS,
    schemaVersion: 'marketing-facts-v1',
  };
}

/** A property is only worth a creative if it can state enough real things. */
export const MIN_FACTS_FOR_CREATIVE = 4;

export const hasSufficientFacts = (pack: FactPack | null): boolean =>
  !!pack && pack.facts.length >= MIN_FACTS_FOR_CREATIVE;

/** Facts a given angle should lead with, if present. */
export function factsForAngle(pack: FactPack, labels: readonly string[]): readonly VerifiedFact[] {
  const wanted = labels.map((l) => l.toLowerCase());
  const lead = pack.facts.filter((f) => wanted.includes(f.label.toLowerCase()));
  const rest = pack.facts.filter((f) => !lead.includes(f));
  return [...lead, ...rest];
}

/** Plain-text block for the pack's brief.txt and the ChatGPT prompt. */
export function renderFactBlock(pack: FactPack): string {
  return pack.facts.map((f) => `${f.id}  ${f.label}: ${f.value}`).join('\n');
}
