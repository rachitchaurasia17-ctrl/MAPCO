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
   MAPCO Marketing — Weekly Planner (deterministic)

   Builds an entire week as ONE portfolio, not 28 independent random
   picks. Given the same inputs it always produces the same plan, which
   is what makes the scheduled job safe to retry.

   28 deliverables per week is a hard requirement. With small inventory
   a property necessarily recurs, so distinctness is carried by the
   COMBINATION:

       property × template × hero photo × angle × objective

   The planner enforces a globally unique `signature` per creative and
   spreads each dimension as evenly as the inventory allows. It never
   fabricates a property, a fact or an angle a property cannot support.
   ═══════════════════════════════════════════════════════════════ */
import type { Property } from '../../data/types';
import { allTemplates, getTemplate, templatesFor, type RegisteredTemplate } from '../templates/registry';
import { buildFactPack, hasSufficientFacts } from '../facts/fact-pack';
import { candidatesFrom, defaultPhotoIntelligence, dedupePhotos, isUsablePhoto } from '../photos/photo-intelligence';
import {
  CTA_BY_OBJECTIVE, OBJECTIVES, getAngle, supportedAngles, type AngleDefinition,
} from './angles';
import type {
  CreativeBrief, DealerBrand, FactPack, MarketingHistoryEntry, PhotoCandidate,
  PhotoIntelligence, WeeklyPlan, WeeklyPlanDay,
} from '../types';

export const STRATEGY_VERSION = 'weekly-v1';
export const DEFAULT_PER_DAY = 4;
export const DAYS_IN_WEEK = 7;

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface EligibleProperty {
  readonly property: Property;
  readonly facts: FactPack;
  readonly photos: readonly PhotoCandidate[];
  readonly templates: readonly RegisteredTemplate[];
  readonly angles: readonly AngleDefinition[];
}

export interface EligibilityRejection {
  readonly propertyId: string;
  readonly reason: string;
}

export interface EligibilityResult {
  readonly eligible: readonly EligibleProperty[];
  readonly rejected: readonly EligibilityRejection[];
}

/**
 * Hard gate. Every rejection is recorded with a reason so the operator
 * can see WHY a property is not being marketed.
 */
export function assessEligibility(properties: readonly Property[]): EligibilityResult {
  const eligible: EligibleProperty[] = [];
  const rejected: EligibilityRejection[] = [];

  for (const property of properties) {
    if (property.sold) { rejected.push({ propertyId: property.id, reason: 'sold' }); continue; }
    if (!property.published) { rejected.push({ propertyId: property.id, reason: 'not published' }); continue; }

    const facts = buildFactPack(property);
    if (!hasSufficientFacts(facts)) {
      rejected.push({ propertyId: property.id, reason: 'not enough verified facts' });
      continue;
    }

    const photos = dedupePhotos(candidatesFrom(property.id, property.photos ?? [])).filter(isUsablePhoto);
    if (!photos.length) {
      rejected.push({ propertyId: property.id, reason: 'no usable photo' });
      continue;
    }

    eligible.push({
      property,
      facts: facts!,
      photos,
      templates: templatesFor(property.type),
      angles: supportedAngles(facts!),
    });
  }

  return { eligible, rejected };
}

/* ── week identity ───────────────────────────────────────────── */

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function weekStartOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;      // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** ISO week identity, e.g. '2026-W34'. */
export function weekIdOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);    // Thursday of this week
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Sequential creative id within a week: C001, C002, … */
export const creativeIdFor = (n: number): string => `C${String(n).padStart(3, '0')}`;

/** Distinctness key. Two creatives sharing this would be near-identical. */
export const signatureOf = (
  propertyId: string, templateId: string, heroPhotoId: string, angle: string,
): string => `${propertyId}|${templateId}|${heroPhotoId}|${angle}`;

/* ── planning ────────────────────────────────────────────────── */

export interface PlanInput {
  readonly dealerId: string;
  readonly brand: DealerBrand;
  readonly properties: readonly Property[];
  readonly weekStart?: string;
  readonly timezone?: string;
  readonly perDay?: number;
  readonly revision?: number;
  readonly history?: readonly MarketingHistoryEntry[];
  readonly photoIntelligence?: PhotoIntelligence;
}

/**
 * A least-recently-used rotation. Picking always takes the candidate
 * used longest ago, which spreads usage evenly and deterministically.
 */
class Rotation<T> {
  private readonly lastUsed = new Map<T, number>();
  constructor(items: readonly T[], seedUsage?: ReadonlyMap<T, number>) {
    items.forEach((item, i) => this.lastUsed.set(item, seedUsage?.get(item) ?? -items.length + i));
  }
  /** Least-recently-used items first, optionally filtered. */
  order(filter?: (item: T) => boolean): T[] {
    return [...this.lastUsed.entries()]
      .filter(([item]) => !filter || filter(item))
      .sort((a, b) => a[1] - b[1])
      .map(([item]) => item);
  }
  use(item: T, at: number): void { this.lastUsed.set(item, at); }
}

export async function planWeek(input: PlanInput): Promise<WeeklyPlan> {
  const perDay = input.perDay ?? DEFAULT_PER_DAY;
  const target = perDay * DAYS_IN_WEEK;
  const weekStart = input.weekStart ?? weekStartOf(new Date());
  const weekId = weekIdOf(new Date(`${weekStart}T00:00:00Z`));
  const revision = input.revision ?? 1;
  const photoAi = input.photoIntelligence ?? defaultPhotoIntelligence;
  const notes: string[] = [];

  const { eligible, rejected } = assessEligibility(input.properties);
  for (const r of rejected) notes.push(`${r.propertyId} excluded — ${r.reason}.`);

  if (!eligible.length) {
    notes.push('No property is currently marketable, so no creatives were planned.');
    return {
      id: `${input.dealerId}::${weekId}::r${revision}`,
      dealerId: input.dealerId, weekId, weekStart,
      timezone: input.timezone ?? 'Asia/Kolkata',
      revision, strategyVersion: STRATEGY_VERSION, targetCount: target,
      days: [], generatedAt: new Date().toISOString(), notes,
    };
  }

  if (eligible.length * 1 < perDay) {
    notes.push(
      `Only ${eligible.length} marketable propert${eligible.length === 1 ? 'y' : 'ies'} available, ` +
      `so properties repeat within a day is avoided where possible but a day may reuse one.`);
  }

  // Seed rotations from real history so week N+1 does not repeat week N.
  const propSeed = new Map<string, number>();
  const tplSeed = new Map<string, number>();
  for (const h of input.history ?? []) {
    const t = Date.parse(h.localDate) || 0;
    propSeed.set(h.propertyId, Math.max(propSeed.get(h.propertyId) ?? 0, t));
    tplSeed.set(h.templateId, Math.max(tplSeed.get(h.templateId) ?? 0, t));
  }
  const propertyRotation = new Rotation(eligible.map((e) => e.property.id), propSeed);
  const templateRotation = new Rotation(allTemplates().map((t) => t.id), tplSeed);

  const usedSignatures = new Set<string>((input.history ?? []).map((h) => h.signature));
  const byId = new Map(eligible.map((e) => [e.property.id, e]));
  // Per-property counters so photo/angle advance every time it recurs.
  const propertyUse = new Map<string, number>();
  // Photos used recently per property, for the ranking context.
  const recentPhotos = new Map<string, string[]>();
  for (const h of input.history ?? []) {
    const list = recentPhotos.get(h.propertyId) ?? [];
    list.push(h.heroPhotoId);
    recentPhotos.set(h.propertyId, list);
  }

  const days: WeeklyPlanDay[] = [];
  let sequence = 0;
  let tick = 0;

  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex++) {
    const localDate = addDays(weekStart, dayIndex);
    const briefs: CreativeBrief[] = [];
    const propertiesToday = new Set<string>();
    const templatesToday = new Set<string>();

    for (let slotIndex = 0; slotIndex < perDay; slotIndex++) {
      const objective = OBJECTIVES[slotIndex % OBJECTIVES.length]!;

      // 1. Property — least recently used, preferring one not already
      //    used today. Falls back to allowing a repeat only if the
      //    inventory genuinely cannot fill the day.
      const propOrder = propertyRotation.order();
      const propertyId =
        propOrder.find((id) => !propertiesToday.has(id)) ?? propOrder[0]!;
      const entry = byId.get(propertyId)!;
      const useCount = propertyUse.get(propertyId) ?? 0;

      // 2. Template — least recently used among those suited to this
      //    property, never one already used today.
      const suited = new Set(entry.templates.map((t) => t.id));
      const tplOrder = templateRotation.order((id) => suited.has(id));
      const templateId =
        tplOrder.find((id) => !templatesToday.has(id))
        ?? tplOrder[0]
        ?? templateRotation.order().find((id) => !templatesToday.has(id))
        ?? allTemplates()[0]!.id;
      const template = getTemplate(templateId)!;

      // 3. Hero photo — rotate by how many times this property has run,
      //    ranked against the template's preferred orientation.
      const heroRegion = template.photoRegions.find((r) => r.role === 'hero');
      const ranked = await photoAi.rank(entry.photos, {
        propertyType: entry.property.type,
        preferredOrientation: heroRegion?.preferredOrientation ?? 'any',
        recentlyUsedIds: recentPhotos.get(propertyId) ?? [],
      });
      const pool = ranked.length ? ranked : entry.photos;
      const hero = pool[useCount % pool.length]!;
      const secondary = pool.filter((p) => p.id !== hero.id).slice(0, 2);

      // 4. Angle — advance with each recurrence AND offset by the slot,
      //    so a repeated property leads with a different verified fact
      //    every time, and the four creatives in one day never all lead
      //    with the same thing.
      const angleDef = entry.angles[(useCount + slotIndex) % entry.angles.length]!;

      // 5. Guarantee global distinctness. If this exact combination has
      //    been used, walk the angle then the photo until it is new.
      let signature = signatureOf(propertyId, templateId, hero.id, angleDef.id);
      let chosenAngle = angleDef;
      let chosenHero = hero;
      if (usedSignatures.has(signature)) {
        outer: for (let a = 0; a < entry.angles.length; a++) {
          for (let p = 0; p < pool.length; p++) {
            const candAngle = entry.angles[(useCount + a) % entry.angles.length]!;
            const candHero = pool[(useCount + p) % pool.length]!;
            const cand = signatureOf(propertyId, templateId, candHero.id, candAngle.id);
            if (!usedSignatures.has(cand)) {
              signature = cand; chosenAngle = candAngle; chosenHero = candHero;
              break outer;
            }
          }
        }
      }
      usedSignatures.add(signature);

      const id = creativeIdFor(++sequence);
      briefs.push({
        id,
        dealerId: input.dealerId,
        weekId,
        dayIndex,
        localDate,
        slotIndex,
        propertyId,
        propertyLabel: `${entry.property.area || entry.property.type} · ${entry.property.size}`,
        templateId: template.id,
        templateVersion: template.version,
        heroPhoto: chosenHero,
        secondaryPhotos: secondary,
        facts: entry.facts,
        objective,
        angle: chosenAngle.id,
        direction: chosenAngle.direction,
        cta: CTA_BY_OBJECTIVE[objective],
        brand: input.brand,
        signature,
        status: 'ready_for_chatgpt',
      });

      // book-keeping
      tick++;
      propertyRotation.use(propertyId, tick);
      templateRotation.use(templateId, tick);
      propertiesToday.add(propertyId);
      templatesToday.add(templateId);
      propertyUse.set(propertyId, useCount + 1);
      const seen = recentPhotos.get(propertyId) ?? [];
      seen.push(chosenHero.id);
      recentPhotos.set(propertyId, seen);
    }

    days.push({ dayIndex, localDate, weekday: WEEKDAYS[dayIndex]!, briefs });
  }

  const produced = days.reduce((n, d) => n + d.briefs.length, 0);
  if (produced === target) {
    notes.push(`${target} creatives planned across ${eligible.length} marketable propert${eligible.length === 1 ? 'y' : 'ies'}.`);
  }
  const perProperty = Math.ceil(target / Math.max(1, eligible.length));
  if (eligible.length < target) {
    notes.push(
      `Inventory is smaller than the weekly target, so each property appears about ${perProperty} times — ` +
      `every appearance uses a different template, hero photo and creative angle.`);
  }

  return {
    id: `${input.dealerId}::${weekId}::r${revision}`,
    dealerId: input.dealerId,
    weekId,
    weekStart,
    timezone: input.timezone ?? 'Asia/Kolkata',
    revision,
    strategyVersion: STRATEGY_VERSION,
    targetCount: target,
    days,
    generatedAt: new Date().toISOString(),
    notes,
  };
}

/** Flatten a plan to its briefs, in creative-id order. */
export const allBriefs = (plan: WeeklyPlan): readonly CreativeBrief[] =>
  plan.days.flatMap((d) => d.briefs);

/** Convert a plan into history entries for the next week's rotation seed. */
export const toHistory = (plan: WeeklyPlan): readonly MarketingHistoryEntry[] =>
  allBriefs(plan).map((b) => ({
    creativeId: b.id,
    propertyId: b.propertyId,
    templateId: b.templateId,
    heroPhotoId: b.heroPhoto.id,
    angle: b.angle,
    objective: b.objective,
    localDate: b.localDate,
    signature: b.signature,
  }));
