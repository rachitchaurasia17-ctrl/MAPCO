/* ─────────────────────────────────────────────────────────────────
   DORMANT — not part of the V1 operator workflow.

   V1 is human-directed: the operator writes their own prompt and lets
   ChatGPT make every creative decision. MAPCO no longer selects
   templates, angles, objectives or properties per output, and ships no
   generated creative prompt.

   This module is retained, compiling and tested, for a future
   automation milestone. Nothing in src/apps/ops imports it.
   ───────────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — Template Registry (developer-managed)

   Template identity and geometry are INGESTED, not hand-written:
   `scripts/ingest-templates.mjs` decodes every approved PNG, assigns a
   stable id (T001…, by sorted filename), reads the intrinsic size, and
   locates the authored fill zones. Its output is `generated.ts`.

   This module adds the small amount that cannot be measured — how a
   design should be used — and derives the rest deterministically from
   the measured geometry.

   This is deliberately NOT a dealer-facing template editor. In this
   milestone the PNG is handed to ChatGPT as a visual reference; MAPCO
   does not reconstruct decorative pixels.
   ═══════════════════════════════════════════════════════════════ */
import type {
  AspectRatio, ContentDensity, PhotoOrientation, TemplateArchetype,
  TemplateDefinition, TemplateId, TemplatePhotoRegion,
} from '../types';
import { GENERATED_TEMPLATES } from './generated';

/** How a template's hero box was established. */
export type GeometryProvenance = 'measured' | 'authored' | 'undetected';

/** The shape emitted by the ingestion script. */
export interface GeneratedTemplate {
  readonly id: TemplateId;
  readonly version: number;
  readonly name: string;
  readonly asset: string;
  readonly intrinsic: { readonly w: number; readonly h: number };
  readonly aspectRatio: AspectRatio | string;
  readonly archetype: TemplateArchetype | string;
  readonly geometry: GeometryProvenance | string;
  readonly photoRegions: readonly {
    readonly role: string;
    readonly preferredOrientation: string;
    readonly box?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  }[];
  readonly detectedZones: number;
  readonly contentDensity: ContentDensity | string;
  readonly featureCapacity: number;
  readonly styleTags: readonly string[];
  readonly reviewed: boolean;
}

export interface RegisteredTemplate extends TemplateDefinition {
  readonly geometry: GeometryProvenance;
  readonly detectedZones: number;
  /** True once a human has reviewed this template's usage guidance. */
  readonly reviewed: boolean;
}

/* Channel suitability follows directly from the aspect ratio. */
const CHANNELS_BY_ASPECT: Record<string, readonly string[]> = {
  '4:5': ['instagram_feed', 'facebook', 'whatsapp'],
  '1:1': ['instagram_feed', 'google_business', 'facebook'],
  '2:3': ['instagram_feed', 'print', 'whatsapp'],
  '9:16': ['whatsapp_status', 'instagram_story', 'reels_cover'],
};

/* Property categories a design tends to flatter. Hero-dominant designs
   suit photogenic built property; dense field cards suit plots where
   the facts do the selling. */
function suitabilityFor(archetype: string, density: string): readonly string[] {
  if (archetype === 'hero-dominant') {
    return ['Villa', 'Kothi', 'Flat', 'Builder Floor', 'Residential Plot'];
  }
  if (density === 'high') {
    return ['Residential Plot', 'Commercial', 'Commercial SCO', 'Flat', 'Builder Floor'];
  }
  return ['Residential Plot', 'Flat', 'Villa', 'Kothi', 'Commercial'];
}

function recommendedUseFor(t: GeneratedTemplate): string {
  if (t.archetype === 'hero-dominant') {
    return `Photography-first layout — a single large image carries the creative. Use when the property photograph is genuinely strong. Carries about ${t.featureCapacity} short factual line${t.featureCapacity === 1 ? '' : 's'}.`;
  }
  return `Structured layout with ${t.detectedZones} authored content zones. Use when the property has a full fact set; it can carry about ${t.featureCapacity} short factual bullets alongside the photograph.`;
}

function avoidWhenFor(t: GeneratedTemplate): string {
  if (t.archetype === 'hero-dominant') {
    return 'The available photograph is weak or low-resolution, or the property has several facts worth stating — there is nowhere to put them.';
  }
  return 'The property has only one or two verified facts; the empty content zones will read as unfinished.';
}

const asAspect = (v: string): AspectRatio =>
  v === '1:1' || v === '9:16' || v === '4:5' ? v : '4:5';

const asOrientation = (v: string): PhotoOrientation =>
  v === 'landscape' || v === 'portrait' || v === 'square' ? v : 'any';

function hydrate(t: GeneratedTemplate): RegisteredTemplate {
  const archetype: TemplateArchetype = t.archetype === 'hero-dominant' ? 'hero-dominant' : 'field-card';
  const density = (['low', 'medium', 'high'] as const).includes(t.contentDensity as ContentDensity)
    ? (t.contentDensity as ContentDensity) : 'medium';
  const photoRegions: readonly TemplatePhotoRegion[] = t.photoRegions.map((r) => ({
    role: r.role === 'secondary' ? 'secondary' : 'hero',
    preferredOrientation: asOrientation(r.preferredOrientation),
    ...(r.box ? { box: r.box } : {}),
  }));

  return {
    id: t.id,
    version: t.version,
    name: t.name,
    asset: t.asset,
    intrinsic: t.intrinsic,
    aspectRatio: asAspect(String(t.aspectRatio)),
    archetype,
    photoRegions,
    contentDensity: density,
    locationEmphasis: density === 'high' ? 'high' : density === 'medium' ? 'medium' : 'low',
    featureCapacity: t.featureCapacity,
    // Every approved MAPCO template carries the MAPCO mark; contact and
    // dealer areas exist on the structured layouts.
    hasDealerBrandingArea: archetype === 'hero-dominant',
    hasContactArea: archetype === 'field-card',
    hasPoweredByMapco: true,
    styleTags: t.styleTags,
    suitableFor: suitabilityFor(archetype, density),
    recommendedUse: recommendedUseFor(t),
    avoidWhen: avoidWhenFor(t),
    geometry: (['measured', 'authored', 'undetected'] as const)
      .includes(t.geometry as GeometryProvenance) ? (t.geometry as GeometryProvenance) : 'undetected',
    detectedZones: t.detectedZones,
    reviewed: t.reviewed,
  };
}

export const TEMPLATES: readonly RegisteredTemplate[] = GENERATED_TEMPLATES.map(hydrate);

const BY_ID = new Map<TemplateId, RegisteredTemplate>(TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id: TemplateId): RegisteredTemplate | undefined => BY_ID.get(id);
export const allTemplates = (): readonly RegisteredTemplate[] => TEMPLATES;

/** Channels a template's aspect ratio suits. */
export const channelsFor = (t: RegisteredTemplate): readonly string[] =>
  CHANNELS_BY_ASPECT[t.aspectRatio] ?? ['instagram_feed'];

/** Public URL for a template asset (served from v2/public/templates/). */
export const templateAssetUrl = (t: RegisteredTemplate): string => `/templates/${t.asset}`;

/** Stable, human-readable pack file name, e.g. 'C017-TEMPLATE-T006.png'. */
export const templateFileName = (creativeId: string, t: RegisteredTemplate): string =>
  `${creativeId}-TEMPLATE-${t.id}.png`;

/**
 * Templates suited to a property type. Never returns empty — a property
 * with an unusual type still needs a design.
 */
export function templatesFor(propertyType: string): readonly RegisteredTemplate[] {
  const match = TEMPLATES.filter((t) =>
    t.suitableFor.some((s) => s.toLowerCase() === propertyType.toLowerCase()));
  return match.length ? match : TEMPLATES;
}

/** Templates for a given output shape — used by the alt-channel cut. */
export const templatesByAspect = (aspect: AspectRatio): readonly RegisteredTemplate[] =>
  TEMPLATES.filter((t) => t.aspectRatio === aspect);
