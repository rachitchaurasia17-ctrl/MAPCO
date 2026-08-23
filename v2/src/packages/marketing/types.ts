/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — Weekly Pack domain types

   The preparation engine is deterministic and provider-neutral. It
   prepares everything a creative needs EXCEPT the final pixels, which
   in this milestone are produced by a human operator in consumer
   ChatGPT.

   Nothing here calls a model. Nothing here touches the network.
   ═══════════════════════════════════════════════════════════════ */

/** Stable template identity, e.g. 'T001'. */
export type TemplateId = string;
/** Stable creative identity within a week, e.g. 'C017'. */
export type CreativeId = string;

export type AspectRatio = '4:5' | '1:1' | '9:16';

export type TemplateArchetype =
  | 'field-card'      // labelled Location / Details / Highlights / Contact rows
  | 'hero-dominant';  // one large image, minimal text furniture

export type ContentDensity = 'low' | 'medium' | 'high';

export type PhotoOrientation = 'landscape' | 'portrait' | 'square' | 'any';

/** A photo region a template exposes. */
export interface TemplatePhotoRegion {
  readonly role: 'hero' | 'secondary';
  /** Normalised box within the template (0–1), for operator guidance. */
  readonly box?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly preferredOrientation: PhotoOrientation;
}

/**
 * Developer-managed template metadata. The PNG itself is handed to
 * ChatGPT as a visual reference — MAPCO does not reconstruct the
 * decorative artwork.
 */
export interface TemplateDefinition {
  readonly id: TemplateId;
  readonly version: number;
  readonly name: string;
  /** File name inside the templates/ directory. */
  readonly asset: string;
  readonly intrinsic: { readonly w: number; readonly h: number };
  readonly aspectRatio: AspectRatio;
  readonly archetype: TemplateArchetype;
  readonly photoRegions: readonly TemplatePhotoRegion[];
  readonly contentDensity: ContentDensity;
  /** How strongly the design foregrounds the locality line. */
  readonly locationEmphasis: 'low' | 'medium' | 'high';
  /** How many short factual bullets the design can carry. */
  readonly featureCapacity: number;
  readonly hasDealerBrandingArea: boolean;
  readonly hasContactArea: boolean;
  readonly hasPoweredByMapco: boolean;
  /** Visual mood, used to spread the week across looks. */
  readonly styleTags: readonly string[];
  readonly suitableFor: readonly string[];
  readonly recommendedUse: string;
  readonly avoidWhen: string;
}

/* ── Verified facts ──────────────────────────────────────────── */

/**
 * One allow-listed, provenance-carrying fact. `id` (F001…) is what the
 * ChatGPT prompt references, so a human can audit every claim.
 */
export interface VerifiedFact {
  readonly id: string;            // 'F001'
  readonly label: string;         // 'Sector'
  readonly value: string;         // 'Sector 82'
  /** Where this came from — the canonical field path. */
  readonly source: string;        // 'property.sector'
}

export interface FactPack {
  readonly propertyId: string;
  readonly facts: readonly VerifiedFact[];
  /** Facts deliberately withheld from marketing surfaces. */
  readonly excluded: readonly string[];
  /** Claims the operator/model must never make. */
  readonly prohibitedClaims: readonly string[];
  readonly schemaVersion: 'marketing-facts-v1';
}

/* ── Photos ──────────────────────────────────────────────────── */

export interface PhotoCandidate {
  readonly id: string;
  /** Display URL (mock) or signed URL (production). Never a raw private path. */
  readonly url: string;
  readonly index: number;
  readonly width?: number;
  readonly height?: number;
  readonly bytes?: number;
  readonly orientation?: PhotoOrientation;
}

export interface RankedPhoto extends PhotoCandidate {
  readonly score: number;
  /** Why this ranked where it did — shown to the operator, never invented. */
  readonly reasons: readonly string[];
}

/**
 * Provider-neutral photo ranking. The deterministic implementation uses
 * only metadata it can actually observe. A future multimodal provider
 * implements the same contract without changing the weekly pipeline.
 */
export interface PhotoIntelligence {
  readonly name: string;
  /** True when this provider can genuinely judge photo content. */
  readonly semantic: boolean;
  rank(photos: readonly PhotoCandidate[], context: PhotoRankContext): Promise<readonly RankedPhoto[]>;
}

export interface PhotoRankContext {
  readonly propertyType: string;
  readonly preferredOrientation: PhotoOrientation;
  /** Photo ids already used recently for this property — deprioritise. */
  readonly recentlyUsedIds: readonly string[];
}

/* ── Creative planning ───────────────────────────────────────── */

export type MarketingObjective =
  | 'primary_showcase'
  | 'inventory_highlight'
  | 'location_advantage'
  | 'alt_channel_cut';

/** Deterministic creative angles. Each leads with a different real fact. */
export type CreativeAngle =
  | 'size_and_shape'
  | 'facing_and_position'
  | 'locality_and_sector'
  | 'approval_and_ownership'
  | 'readiness_and_possession'
  | 'connectivity_and_access';

export type CreativeStatus =
  | 'ready_for_chatgpt'
  | 'generated'
  | 'needs_review'
  | 'approved'
  | 'skipped';

export interface DealerBrand {
  readonly dealerId: string;
  readonly name: string;
  readonly tagline?: string;
  readonly phone?: string;
  readonly whatsapp?: string;
  readonly logoUrl?: string;
  readonly accentColor?: string;
}

/** One planned deliverable — everything ChatGPT needs, decided by MAPCO. */
export interface CreativeBrief {
  readonly id: CreativeId;
  readonly dealerId: string;
  readonly weekId: string;
  readonly dayIndex: number;        // 0–6
  readonly localDate: string;       // YYYY-MM-DD
  readonly slotIndex: number;       // 0–3 within the day

  readonly propertyId: string;
  readonly propertyLabel: string;
  readonly templateId: TemplateId;
  readonly templateVersion: number;

  readonly heroPhoto: PhotoCandidate;
  readonly secondaryPhotos: readonly PhotoCandidate[];

  readonly facts: FactPack;
  readonly objective: MarketingObjective;
  readonly angle: CreativeAngle;
  /** Human-readable direction, rule-derived — never model-invented. */
  readonly direction: string;
  readonly cta: string;
  readonly brand: DealerBrand;

  /** Distinctness key — no two briefs in a week may share it. */
  readonly signature: string;
  readonly status: CreativeStatus;
  /** Set once the operator uploads the finished image. */
  readonly resultAssetId?: string;
}

export interface WeeklyPlanDay {
  readonly dayIndex: number;
  readonly localDate: string;
  readonly weekday: string;
  readonly briefs: readonly CreativeBrief[];
}

export interface WeeklyPlan {
  readonly id: string;
  readonly dealerId: string;
  /** ISO week identity, e.g. '2026-W34'. */
  readonly weekId: string;
  readonly weekStart: string;       // YYYY-MM-DD (Monday)
  readonly timezone: string;
  readonly revision: number;
  readonly strategyVersion: string;
  readonly targetCount: number;
  readonly days: readonly WeeklyPlanDay[];
  readonly generatedAt: string;
  /** Honest notes about constraints hit while planning. */
  readonly notes: readonly string[];
}

/** Idempotency identity: a duplicate run must not create a second week. */
export const planKey = (dealerId: string, weekId: string, revision: number): string =>
  `${dealerId}::${weekId}::r${revision}`;

/* ── Persistence boundary ────────────────────────────────────── */

export interface StoredResult {
  readonly creativeId: CreativeId;
  readonly fileName: string;
  readonly mime: string;
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
  readonly dataUrl: string;
  readonly uploadedAt: string;
}

/**
 * Where weekly plans live. LocalPlanStore backs the current mock mode;
 * a Supabase implementation slots in behind the same interface.
 */
export interface MarketingPlanStore {
  getPlan(dealerId: string, weekId: string): Promise<WeeklyPlan | null>;
  savePlan(plan: WeeklyPlan): Promise<void>;
  listPlans(dealerId: string, limit?: number): Promise<readonly WeeklyPlan[]>;
  updateBrief(dealerId: string, weekId: string, brief: CreativeBrief): Promise<void>;
  saveResult(dealerId: string, result: StoredResult): Promise<void>;
  getResult(dealerId: string, creativeId: CreativeId): Promise<StoredResult | null>;
  /** Property/template/photo usage across previous weeks — drives cooldowns. */
  history(dealerId: string, sinceIso: string): Promise<readonly MarketingHistoryEntry[]>;
}

export interface MarketingHistoryEntry {
  readonly creativeId: CreativeId;
  readonly propertyId: string;
  readonly templateId: TemplateId;
  readonly heroPhotoId: string;
  readonly angle: CreativeAngle;
  readonly objective: MarketingObjective;
  readonly localDate: string;
  readonly signature: string;
}
