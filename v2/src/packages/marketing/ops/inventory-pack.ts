/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Ops — the AI-ready dealer inventory pack

   Exports EVERY marketable property for one dealer, each with a
   ChatGPT-ready brief and its real photographs, so the operator never
   opens MAPCO property by property.

       MAPCO-DEALER-<DEALER>-<WEEK>/
         README.md
         DEALER/
           dealer-info.md
           dealer-logo.png
         PROPERTIES/
           P-ECOCITY/
             MAPCO-PROPERTY-BRIEF.md
             P-ECOCITY-PHOTO-01.jpg
             …

   No templates. No prompts. No creative direction. The operator is the
   creative director; this pack is data preparation only.
   ═══════════════════════════════════════════════════════════════ */
import type { Property } from '../../data/types';
import type { DealerBrand } from '../types';
import { buildFactPack } from '../facts/fact-pack';
import { createZip, fetchBytes, type ZipEntry } from '../pack/zip';
import {
  photoFileName, propertyRef, renderDealerInfo, renderPackReadme, renderPropertyBrief,
} from './property-brief';
import { assertDealerAccess, type OperatorDealerAccess } from './types';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export interface MarketableProperty {
  readonly property: Property;
  readonly ref: string;
  readonly photoCount: number;
}

export interface EligibilityNote {
  readonly propertyId: string;
  readonly reason: string;
}

export interface InventoryAssessment {
  readonly marketable: readonly MarketableProperty[];
  readonly excluded: readonly EligibilityNote[];
}

/**
 * What may be advertised. Deliberately strict and fully explained —
 * an operator should be able to see WHY something is missing.
 */
export function assessInventory(properties: readonly Property[]): InventoryAssessment {
  const marketable: MarketableProperty[] = [];
  const excluded: EligibilityNote[] = [];

  for (const property of properties) {
    if (property.sold) { excluded.push({ propertyId: property.id, reason: 'sold' }); continue; }
    if (!property.published) { excluded.push({ propertyId: property.id, reason: 'not published' }); continue; }

    const photos = (property.photos ?? []).filter((u) => u && u.trim() && !u.startsWith('data:image/svg'));
    if (!photos.length) { excluded.push({ propertyId: property.id, reason: 'no usable photograph' }); continue; }

    if (!buildFactPack(property)) {
      excluded.push({ propertyId: property.id, reason: 'not enough verified detail to advertise' });
      continue;
    }

    marketable.push({ property, ref: propertyRef(property), photoCount: photos.length });
  }

  return { marketable, excluded };
}

export interface PackProgress { (done: number, total: number, label: string): void }

export interface PackResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly propertyCount: number;
  readonly photoCount: number;
  readonly excluded: readonly EligibilityNote[];
}

const safeDealerSlug = (name: string): string =>
  name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'DEALER';

/**
 * Build the dealer's AI marketing pack.
 *
 * Dealer access is checked before a single byte is read, so an operator
 * can never assemble a pack for a dealer they are not assigned to.
 */
export async function buildInventoryPack(
  operator: OperatorDealerAccess,
  dealerId: string,
  brand: DealerBrand,
  properties: readonly Property[],
  weekId: string,
  onProgress?: PackProgress,
): Promise<PackResult> {
  assertDealerAccess(operator, dealerId);

  const { marketable, excluded } = assessInventory(properties);
  const root = `MAPCO-DEALER-${safeDealerSlug(brand.name)}-${weekId}`;
  const entries: ZipEntry[] = [];

  entries.push({
    path: `${root}/README.md`,
    data: utf8(renderPackReadme(brand, marketable.map((m) => m.ref), weekId)),
  });
  entries.push({
    path: `${root}/DEALER/dealer-info.md`,
    data: utf8(renderDealerInfo(brand, marketable.length, weekId)),
  });

  if (brand.logoUrl) {
    const logo = await fetchBytes(brand.logoUrl);
    if (logo) entries.push({ path: `${root}/DEALER/dealer-logo.png`, data: logo });
  }

  const total = marketable.reduce((n, m) => n + m.photoCount, 0);
  let done = 0;
  let photoCount = 0;

  for (const item of marketable) {
    const dir = `${root}/PROPERTIES/${item.ref}`;
    const brief = renderPropertyBrief(item.property, brand);
    if (!brief) continue;
    entries.push({ path: `${dir}/MAPCO-PROPERTY-BRIEF.md`, data: utf8(brief) });

    const photos = (item.property.photos ?? []).filter((u) => u && u.trim());
    for (let i = 0; i < photos.length; i++) {
      const url = photos[i]!;
      onProgress?.(++done, total, `${item.ref} photo ${i + 1}`);
      const bytes = await fetchBytes(url);
      if (!bytes) continue;
      entries.push({ path: `${dir}/${photoFileName(item.property, i, url)}`, data: bytes });
      photoCount++;
    }
  }

  return {
    blob: createZip(entries),
    fileName: `${root}.zip`,
    propertyCount: marketable.length,
    photoCount,
    excluded,
  };
}

/** Text preview of what a pack would contain, without building it. */
export function describePack(
  brand: DealerBrand, properties: readonly Property[], weekId: string,
): { lines: readonly string[]; marketable: number; excluded: readonly EligibilityNote[] } {
  const { marketable, excluded } = assessInventory(properties);
  const lines = [`MAPCO-DEALER-${safeDealerSlug(brand.name)}-${weekId}/`, '  README.md', '  DEALER/'];
  lines.push('    dealer-info.md');
  if (brand.logoUrl) lines.push('    dealer-logo.png');
  lines.push('  PROPERTIES/');
  for (const item of marketable) {
    lines.push(`    ${item.ref}/`);
    lines.push('      MAPCO-PROPERTY-BRIEF.md');
    lines.push(`      ${item.photoCount} photograph${item.photoCount === 1 ? '' : 's'}`);
  }
  return { lines, marketable: marketable.length, excluded };
}
