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
   MAPCO Marketing — ChatGPT-ready pack builder

   Produces the folder structure the operator uploads into ChatGPT.
   Every file name carries its creative id, so a model handling four
   creatives at once cannot attach the wrong photo to the wrong
   property.

     MAPCO-WEEK-2026-W34/
       WEEK-SUMMARY.md
       DAY-01-MONDAY/
         CHATGPT-PROMPT.txt
         C001-TEMPLATE-T006.png
         C001-HERO.jpg
         C001-SECONDARY-01.jpg
         C001-brief.txt
         C001-brief.json
         …
   ═══════════════════════════════════════════════════════════════ */
import type { CreativeBrief, WeeklyPlan, WeeklyPlanDay } from '../types';
import { getTemplate, templateAssetUrl } from '../templates/registry';
import { getAngle, OBJECTIVE_INTENT } from '../planner/angles';
import { renderFactBlock } from '../facts/fact-pack';
import { buildDailyPrompt, buildRegenerationPrompt, OPERATOR_HEADER, PROMPT_VERSION } from '../prompts';
import { createZip, fetchBytes, type ZipEntry } from './zip';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

const ext = (url: string): string => {
  const clean = url.split('?')[0]!.toLowerCase();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  return 'jpg';
};

export const dayFolder = (day: WeeklyPlanDay): string =>
  `DAY-${String(day.dayIndex + 1).padStart(2, '0')}-${day.weekday.toUpperCase()}`;

/* ── human-readable brief ────────────────────────────────────── */

export function renderBriefText(brief: CreativeBrief): string {
  const template = getTemplate(brief.templateId);
  const angle = getAngle(brief.angle);
  return `MAPCO CREATIVE BRIEF — ${brief.id}
════════════════════════════════════════

Save the finished image as: ${brief.id}.png

Date            : ${brief.localDate}
Property        : ${brief.propertyLabel}  (${brief.propertyId})
Template        : ${brief.templateId} · ${template?.name ?? ''}  (v${brief.templateVersion})
Objective       : ${brief.objective}
                  ${OBJECTIVE_INTENT[brief.objective]}
Creative angle  : ${brief.angle}
                  ${angle.direction}
Headline approach: ${angle.headlineApproach}
Call to action  : ${brief.cta}

FILES
  Template  : ${brief.id}-TEMPLATE-${brief.templateId}.png
  Hero photo: ${brief.id}-HERO.${ext(brief.heroPhoto.url)}
${brief.secondaryPhotos.map((p, i) => `  Extra ${i + 1}   : ${brief.id}-SECONDARY-${String(i + 1).padStart(2, '0')}.${ext(p.url)}`).join('\n') || '  Extra     : none'}

VERIFIED FACTS — the only property facts that may appear
${renderFactBlock(brief.facts)}

DEALER BRANDING — reproduce exactly
  Name : ${brief.brand.name}
  Phone: ${brief.brand.phone ?? '(none supplied — omit)'}
${brief.brand.whatsapp ? `  WhatsApp: ${brief.brand.whatsapp}\n` : ''}
NEVER STATE
${brief.facts.prohibitedClaims.map((c) => `  ✗ ${c}`).join('\n')}

WITHHELD FROM MARKETING (never appears on a creative)
  ${brief.facts.excluded.join(', ')}

Photo selection reasoning (MAPCO, deterministic):
${(brief.heroPhoto as { reasons?: readonly string[] }).reasons?.map((r) => `  • ${r}`).join('\n') ?? '  • dealer photo order'}
`;
}

/** Machine-readable brief. Contains no private field by construction. */
export function briefJson(brief: CreativeBrief): string {
  return JSON.stringify({
    creativeId: brief.id,
    saveAs: `${brief.id}.png`,
    dealerId: brief.dealerId,
    weekId: brief.weekId,
    localDate: brief.localDate,
    dayIndex: brief.dayIndex,
    slotIndex: brief.slotIndex,
    property: { id: brief.propertyId, label: brief.propertyLabel },
    template: { id: brief.templateId, version: brief.templateVersion },
    objective: brief.objective,
    angle: brief.angle,
    direction: brief.direction,
    cta: brief.cta,
    facts: brief.facts.facts,
    prohibitedClaims: brief.facts.prohibitedClaims,
    excludedFields: brief.facts.excluded,
    brand: {
      name: brief.brand.name,
      phone: brief.brand.phone ?? null,
      whatsapp: brief.brand.whatsapp ?? null,
    },
    files: {
      template: `${brief.id}-TEMPLATE-${brief.templateId}.png`,
      hero: `${brief.id}-HERO.${ext(brief.heroPhoto.url)}`,
      secondary: brief.secondaryPhotos.map((p, i) =>
        `${brief.id}-SECONDARY-${String(i + 1).padStart(2, '0')}.${ext(p.url)}`),
    },
    signature: brief.signature,
    promptVersion: PROMPT_VERSION,
    schemaVersion: 'mapco-brief-v1',
  }, null, 2);
}

/* ── pack assembly ───────────────────────────────────────────── */

export interface PackProgress { (done: number, total: number, label: string): void }

async function entriesForDay(
  day: WeeklyPlanDay,
  weekLabel: string,
  prefix: string,
  onProgress?: PackProgress,
  counter = { done: 0, total: 0 },
): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const folder = prefix ? `${prefix}/${dayFolder(day)}` : dayFolder(day);

  entries.push({
    path: `${folder}/CHATGPT-PROMPT.txt`,
    data: utf8(`${OPERATOR_HEADER}\n\n${buildDailyPrompt(day, weekLabel)}`),
  });

  for (const brief of day.briefs) {
    entries.push({ path: `${folder}/${brief.id}-brief.txt`, data: utf8(renderBriefText(brief)) });
    entries.push({ path: `${folder}/${brief.id}-brief.json`, data: utf8(briefJson(brief)) });
    entries.push({
      path: `${folder}/${brief.id}-REGENERATE-PROMPT.txt`,
      data: utf8(buildRegenerationPrompt(brief)),
    });

    const template = getTemplate(brief.templateId);
    if (template) {
      onProgress?.(++counter.done, counter.total, `${brief.id} template`);
      const bytes = await fetchBytes(templateAssetUrl(template));
      if (bytes) {
        entries.push({ path: `${folder}/${brief.id}-TEMPLATE-${template.id}.png`, data: bytes });
      }
    }

    onProgress?.(++counter.done, counter.total, `${brief.id} hero photo`);
    const hero = await fetchBytes(brief.heroPhoto.url);
    if (hero) {
      entries.push({ path: `${folder}/${brief.id}-HERO.${ext(brief.heroPhoto.url)}`, data: hero });
    }

    for (let i = 0; i < brief.secondaryPhotos.length; i++) {
      const p = brief.secondaryPhotos[i]!;
      onProgress?.(++counter.done, counter.total, `${brief.id} extra ${i + 1}`);
      const bytes = await fetchBytes(p.url);
      if (bytes) {
        entries.push({
          path: `${folder}/${brief.id}-SECONDARY-${String(i + 1).padStart(2, '0')}.${ext(p.url)}`,
          data: bytes,
        });
      }
    }

    if (brief.brand.logoUrl) {
      const logo = await fetchBytes(brief.brand.logoUrl);
      if (logo) {
        entries.push({ path: `${folder}/${brief.id}-DEALER-LOGO.png`, data: logo });
      }
    }
  }

  return entries;
}

const assetCountForDay = (day: WeeklyPlanDay): number =>
  day.briefs.reduce((n, b) => n + 2 + b.secondaryPhotos.length, 0);

export function renderWeekSummary(plan: WeeklyPlan): string {
  const total = plan.days.reduce((n, d) => n + d.briefs.length, 0);
  const lines: string[] = [];
  lines.push(`# MAPCO Marketing — Week ${plan.weekId}`);
  lines.push('');
  lines.push(`**${total} creatives** · week beginning ${plan.weekStart} · timezone ${plan.timezone}`);
  lines.push(`Strategy ${plan.strategyVersion} · revision ${plan.revision} · prepared ${plan.generatedAt}`);
  lines.push('');
  lines.push('## How the week works');
  lines.push('');
  lines.push('Each day folder is one ChatGPT session. Open the day folder, upload every image in it,');
  lines.push('paste `CHATGPT-PROMPT.txt`, and save the four results using the filenames it states.');
  lines.push('Then drag those files back into MAPCO — they are matched automatically by creative id.');
  lines.push('');
  if (plan.notes.length) {
    lines.push('## Planning notes');
    lines.push('');
    for (const n of plan.notes) lines.push(`- ${n}`);
    lines.push('');
  }
  for (const day of plan.days) {
    lines.push(`## ${dayFolder(day)} — ${day.weekday} ${day.localDate}`);
    lines.push('');
    lines.push('| Creative | Property | Template | Objective | Angle |');
    lines.push('|---|---|---|---|---|');
    for (const b of day.briefs) {
      lines.push(`| ${b.id} | ${b.propertyLabel} | ${b.templateId} | ${b.objective} | ${b.angle} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** One day's ChatGPT pack. */
export async function buildDayPack(
  plan: WeeklyPlan, dayIndex: number, onProgress?: PackProgress,
): Promise<{ blob: Blob; fileName: string }> {
  const day = plan.days[dayIndex];
  if (!day) throw new Error(`Day ${dayIndex} is not in this plan`);
  const counter = { done: 0, total: assetCountForDay(day) };
  const entries = await entriesForDay(day, plan.weekId, '', onProgress, counter);
  return {
    blob: createZip(entries),
    fileName: `MAPCO-${plan.weekId}-${dayFolder(day)}.zip`,
  };
}

/** The complete week. */
export async function buildWeekPack(
  plan: WeeklyPlan, onProgress?: PackProgress,
): Promise<{ blob: Blob; fileName: string }> {
  const root = `MAPCO-WEEK-${plan.weekId}`;
  const counter = { done: 0, total: plan.days.reduce((n, d) => n + assetCountForDay(d), 0) };
  const entries: ZipEntry[] = [
    { path: `${root}/WEEK-SUMMARY.md`, data: utf8(renderWeekSummary(plan)) },
  ];
  for (const day of plan.days) {
    entries.push(...await entriesForDay(day, plan.weekId, root, onProgress, counter));
  }
  return { blob: createZip(entries), fileName: `${root}.zip` };
}
