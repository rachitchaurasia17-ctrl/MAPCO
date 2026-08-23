/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Ops — MAPCO-PROPERTY-BRIEF.md

   Written to be uploaded straight into consumer ChatGPT alongside the
   property's real photographs. It must give a strong model everything
   it needs to design an excellent advertisement — and nothing else.

   This is NOT a CRM export. It is an allow-listed marketing projection,
   the same boundary `plotmap_ai_marketing_facts_for()` enforces
   server-side. A field appears here only because someone deliberately
   added it.

   MAPCO does not write the creative prompt. The operator does. This
   file supplies facts, branding and guardrails only.
   ═══════════════════════════════════════════════════════════════ */
import type { Property } from '../../data/types';
import { buildFactPack, PROHIBITED_CLAIMS } from '../facts/fact-pack';
import type { DealerBrand } from '../types';

/** Stable public property reference used across the pack, e.g. 'P-ECOCITY'. */
export const propertyRef = (property: Property): string =>
  `P-${property.id.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

/** Stable photo file name, e.g. 'P-ECOCITY-PHOTO-01.jpg'. */
export function photoFileName(property: Property, index: number, url: string): string {
  const clean = url.split('?')[0]!.toLowerCase();
  const ext = clean.endsWith('.png') ? 'png' : clean.endsWith('.webp') ? 'webp' : 'jpg';
  return `${propertyRef(property)}-PHOTO-${String(index + 1).padStart(2, '0')}.${ext}`;
}

const row = (label: string, value: unknown): string | null => {
  const v = typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
  return v ? `| ${label} | ${v} |` : null;
};

/**
 * The property brief. Returns null when the property must not be
 * marketed at all (sold, unpublished, or too little verified detail).
 */
export function renderPropertyBrief(property: Property, brand: DealerBrand): string | null {
  const pack = buildFactPack(property);
  if (!pack) return null;

  const ref = propertyRef(property);
  const photos = property.photos ?? [];

  const detailRows = [
    row('Property reference', ref),
    row('Property type', property.type),
    row('Category', property.want),
    row('Sector / locality', property.sector || property.area),
    row('Area', property.area),
    row('City', property.city),
    row('Address line', property.loc),
    row('Size', property.size),
    row('Facing', property.facing),
    row('Position', property.position),
  ].filter(Boolean) as string[];

  const approvals = (property.approvals ?? []).filter(Boolean);
  const landmarks = (property.landmarks ?? []).filter((l) => l?.name && l?.distance);

  const lines: string[] = [];

  lines.push(`# ${property.area || property.type} — ${property.size}`);
  lines.push('');
  lines.push(`**MAPCO property reference:** \`${ref}\``);
  lines.push('');
  lines.push('> Upload this file together with this property\'s photographs. Every fact below is verified in MAPCO. Nothing outside this file may be stated as a property fact.');
  lines.push('');

  lines.push('## Verified property details');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(...detailRows);
  lines.push('');

  if (approvals.length) {
    lines.push('## Approvals');
    lines.push('');
    for (const a of approvals) lines.push(`- ${a}`);
    lines.push('');
  }

  if (landmarks.length) {
    lines.push('## Nearby — stored distances only');
    lines.push('');
    lines.push('| Place | Distance |');
    lines.push('|---|---|');
    for (const l of landmarks) lines.push(`| ${l.name} | ${l.distance} |`);
    lines.push('');
    lines.push('_Only these distances may be stated. Do not add or estimate any other distance or travel time._');
    lines.push('');
  }

  lines.push('## Photographs');
  lines.push('');
  if (photos.length) {
    lines.push(`${photos.length} real photograph${photos.length === 1 ? '' : 's'} of this property are supplied in this folder, in the dealer's own order:`);
    lines.push('');
    for (let i = 0; i < photos.length; i++) {
      lines.push(`- \`${photoFileName(property, i, photos[i]!)}\`${i === 0 ? '  ← the dealer\'s first/cover photo' : ''}`);
    }
    lines.push('');
    lines.push('_MAPCO does not rank these creatively. Choose whichever best serves the design._');
  } else {
    lines.push('_No usable photograph is available for this property._');
  }
  lines.push('');

  lines.push('## Dealer branding — reproduce exactly');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| Business name | ${brand.name} |`);
  if (brand.tagline) lines.push(`| Tagline | ${brand.tagline} |`);
  if (brand.phone) lines.push(`| Phone | ${brand.phone} |`);
  if (brand.whatsapp && brand.whatsapp !== brand.phone) lines.push(`| WhatsApp | ${brand.whatsapp} |`);
  lines.push('');
  if (!brand.phone && !brand.whatsapp) {
    lines.push('> ⚠️ No contact number is recorded for this dealer in MAPCO. Do not invent one — leave the contact line off the creative.');
    lines.push('');
  }
  if (brand.logoUrl) {
    lines.push('The dealer logo is supplied in the `DEALER/` folder. Place it clearly.');
    lines.push('');
  } else {
    lines.push('> No dealer logo is on file. Set the business name in type instead of inventing a mark.');
    lines.push('');
  }

  lines.push('## Rules for this creative');
  lines.push('');
  lines.push('1. **The photographs are authoritative.** Crop, scale, reposition and grade them. Do not redraw, regenerate, extend or "improve" the property. Do not add buildings, floors, landscaping, cars, people or skies that are not in the photograph. A buyer will visit this plot in person.');
  lines.push('2. **Only the facts above may be stated.** Do not infer facts from the photographs.');
  lines.push('3. **Never invent** a price, an amenity, a distance, a travel time, an approval or a locality claim.');
  lines.push('4. **Dealer branding must be exact** — name and number character for character.');
  lines.push('5. "Powered by MAPCO" may appear, subtly, if it suits the design.');
  lines.push('');

  lines.push('### Never state');
  lines.push('');
  for (const claim of PROHIBITED_CLAIMS) lines.push(`- ${claim}`);
  lines.push('');

  lines.push('### Deliberately withheld');
  lines.push('');
  lines.push('MAPCO holds more about this property than appears above. The following are **excluded from marketing on purpose** and must never appear on a creative:');
  lines.push('');
  lines.push('seller identity and contact · commission · internal notes and CRM history · private customer data · private documents · internal status · exact stored coordinates');
  lines.push('');
  lines.push('**Price is not included.** MAPCO has no marketing-approved price flag for this property, so no figure may be shown. If a price is wanted on the creative, the dealer must confirm it separately.');
  lines.push('');

  lines.push('---');
  lines.push(`_Prepared by MAPCO · reference ${ref} · marketing-facts-v1_`);

  return lines.join('\n');
}

/** Dealer-level context file for the pack. */
export function renderDealerInfo(brand: DealerBrand, propertyCount: number, weekId: string): string {
  const lines: string[] = [];
  lines.push(`# ${brand.name}`);
  lines.push('');
  if (brand.tagline) { lines.push(`_${brand.tagline}_`); lines.push(''); }
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| Business name | ${brand.name} |`);
  lines.push(`| Phone | ${brand.phone ?? '— not recorded in MAPCO —'} |`);
  lines.push(`| WhatsApp | ${brand.whatsapp ?? '— not recorded in MAPCO —'} |`);
  lines.push(`| Marketable properties in this pack | ${propertyCount} |`);
  lines.push(`| Week | ${weekId} |`);
  lines.push('');
  lines.push('## Branding rules');
  lines.push('');
  lines.push('- Reproduce the business name and contact number **exactly** as written above.');
  lines.push('- The dealer\'s brand is primary. "Powered by MAPCO" stays small and secondary.');
  lines.push('- Do not invent a tagline, a website, an email or a social handle.');
  if (!brand.phone && !brand.whatsapp) {
    lines.push('');
    lines.push('> ⚠️ **No contact number on file.** Leave the contact line off every creative for this dealer rather than inventing one.');
  }
  return lines.join('\n');
}

/** Top-level README. Deliberately short — the operator writes the prompt. */
export function renderPackReadme(brand: DealerBrand, refs: readonly string[], weekId: string): string {
  return `# MAPCO AI Marketing Pack — ${brand.name}

Week ${weekId} · ${refs.length} marketable propert${refs.length === 1 ? 'y' : 'ies'}

## What this is

Everything you need to create this dealer's marketing creatives in ChatGPT,
already gathered so you do not have to open MAPCO property by property.

    DEALER/       the dealer's branding and contact details
    PROPERTIES/   one folder per marketable property:
                  MAPCO-PROPERTY-BRIEF.md + that property's real photographs

## How to use it

1. Pick a property folder.
2. Upload its \`MAPCO-PROPERTY-BRIEF.md\`, its photographs, and \`DEALER/dealer-logo.png\` into ChatGPT.
3. Use the highest-quality mode available on your plan.
4. Write your own prompt. You are the creative director — MAPCO does not
   dictate the design, the angle or the layout.
5. Save each finished image as the output slot it fills: \`C001.png\`, \`C002.png\`, …
6. Drag the finished images back into MAPCO Ops → Upload Final Creatives.

## The one hard rule

Each property brief lists the **only** facts that may be stated for that
property, and the claims that must never be made. Everything else about
the design is your judgement.

Properties in this pack: ${refs.join(', ')}

---
_Prepared by MAPCO Marketing Operations. Contains marketing-safe data only._
`;
}
