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
   MAPCO Marketing — ChatGPT prompt generation

   MAPCO writes the prompts. The operator never composes one.

   Deliberately model-agnostic: no ChatGPT model name is hard-coded,
   because consumer model names change. The instruction is always
   "use the highest-quality reasoning/image-generation mode available".

   Three prompt kinds:
     1. MASTER   — the MAPCO Creative Director instruction block
     2. DAILY    — one message covering the day's four creatives
     3. REGEN    — a single creative, when one output is weak
   ═══════════════════════════════════════════════════════════════ */
import type { CreativeBrief, WeeklyPlanDay } from '../types';
import { getTemplate } from '../templates/registry';
import { getAngle, OBJECTIVE_INTENT } from '../planner/angles';
import { renderFactBlock } from '../facts/fact-pack';

export const PROMPT_VERSION = 'chatgpt-pack-v1';

/* ── 1. Master creative-director block ───────────────────────── */

export const MASTER_BLOCK = `You are MAPCO's Creative Director for premium Indian real-estate marketing.

HOW TO RUN THIS
Use the highest-quality reasoning and image-generation mode available to you in ChatGPT. Do not downgrade to a faster, lower-quality mode — final visual quality is the whole point of this task.

WHAT YOU ARE MAKING
Finished, ready-to-post marketing creatives at 4:5 portrait (1080 × 1350). Each one must look like a professional Indian property designer made it by hand — not like an AI image.

THE FIVE RULES THAT MATTER MOST

1. THE PROPERTY PHOTOGRAPH IS AUTHORITATIVE.
   Use the supplied photograph as the real photograph. You may crop, scale, reposition, and apply tasteful colour/contrast grading. You must NOT redraw, regenerate, restyle, extend, or "improve" the property itself. Do not add buildings, floors, landscaping, cars, people, skies or features that are not in the photograph. A buyer will visit this plot in person.

2. ONLY THE SUPPLIED FACTS MAY BE STATED.
   Each creative comes with a numbered fact list (F001, F002, …). Those are the only property facts that may appear. Do not infer facts from the photograph. Do not add distances, travel times, amenities, approvals, prices, rates, or locality claims that are not in the list. If a fact is not listed, it does not exist.

3. NEVER MAKE A MARKET CLAIM.
   No "best investment", "guaranteed appreciation", "prices rising", "high rental yield", "upcoming metro/airport/highway", "most demanded sector", "limited time", "last few plots". No urgency or scarcity language of any kind.

4. THE DEALER'S BRAND IS PRIMARY.
   The dealer's name and phone number must appear exactly as supplied — do not reformat, abbreviate or invent them. If a dealer logo file is supplied, place it prominently. "Powered by MAPCO" stays small and secondary, as shown on the template.

5. THE TEMPLATE IS A STRONG VISUAL REFERENCE.
   A template PNG is supplied per creative. Follow its layout, mood, palette and structure closely. The blank light zones show where the photograph and the text blocks belong. Match its design language; do not invent a different look.

CRAFT STANDARD
- Premium Indian real-estate aesthetic: confident, uncluttered, trustworthy.
- Photography leads. Text supports.
- Typography must be crisp and correctly spelled. Re-render if any text is malformed.
- Avoid generic AI marketing voice ("Discover your dream home today!"). Write like a professional who knows the local market.
- Keep copy short. A creative is read in two seconds.`;

/* ── shared brief rendering ──────────────────────────────────── */

function briefBlock(brief: CreativeBrief, ordinal: number): string {
  const template = getTemplate(brief.templateId);
  const angle = getAngle(brief.angle);
  const secondaryList = brief.secondaryPhotos.length
    ? brief.secondaryPhotos.map((_, i) => `${brief.id}-SECONDARY-${String(i + 1).padStart(2, '0')}.jpg`).join(', ')
    : '(none — use the hero photograph only)';

  return `──────────────────────────────────────────
CREATIVE ${ordinal} OF 4 — ID: ${brief.id}
──────────────────────────────────────────
SAVE THE FINISHED IMAGE AS: ${brief.id}.png

Files for this creative:
  • Template reference : ${brief.id}-TEMPLATE-${brief.templateId}.png
  • Property photograph: ${brief.id}-HERO.jpg
  • Extra photographs  : ${secondaryList}

Template guidance (${brief.templateId} · ${template?.name ?? 'template'}):
  Style      : ${template?.styleTags.join(', ') ?? '—'}
  Density    : ${template?.contentDensity ?? '—'} — carry at most ${template?.featureCapacity ?? 3} short factual bullets
  Use it for : ${template?.recommendedUse ?? '—'}

Marketing objective: ${brief.objective}
  ${OBJECTIVE_INTENT[brief.objective]}

Creative angle: ${brief.angle}
  ${angle.direction}
  Headline approach: ${angle.headlineApproach}

VERIFIED FACTS — the ONLY property facts you may state:
${renderFactBlock(brief.facts)}

Call to action: ${brief.cta}

Dealer branding (reproduce exactly):
  Name : ${brief.brand.name}
  Phone: ${brief.brand.phone ?? '(not supplied — omit the phone line entirely)'}
${brief.brand.whatsapp ? `  WhatsApp: ${brief.brand.whatsapp}\n` : ''}${brief.brand.logoUrl ? `  Logo file: ${brief.id}-DEALER-LOGO.png — place it prominently\n` : '  Logo: none supplied — set the dealer name in type instead\n'}`;
}

/* ── 2. Daily four-creative prompt ───────────────────────────── */

export function buildDailyPrompt(day: WeeklyPlanDay, weekLabel: string): string {
  const header = `${MASTER_BLOCK}

══════════════════════════════════════════
TODAY'S BATCH — ${day.weekday}, ${day.localDate}  (${weekLabel})
${day.briefs.length} creatives, to be produced as ONE COORDINATED SET
══════════════════════════════════════════

Treat these ${day.briefs.length} as a portfolio that will be seen together by the same audience on the same day. They must be visibly different from one another:

  • different layout emphasis and visual density
  • different headline approach — do not reuse a sentence pattern
  • different dominant colour feel, guided by each template
  • different crop and framing of the photography

If two of them start to look like variations of the same poster, redo the weaker one.

Produce all ${day.briefs.length} at 4:5 portrait (1080 × 1350). After each image, state only its filename so the operator can save it correctly.
`;

  const bodies = day.briefs.map((b, i) => briefBlock(b, i + 1)).join('\n\n');

  const footer = `

══════════════════════════════════════════
BEFORE YOU FINISH — CHECK EACH CREATIVE
══════════════════════════════════════════
  1. Is every property fact on the image present in that creative's F-list?
  2. Is the property photograph unaltered in substance?
  3. Is the dealer name and phone exactly as supplied?
  4. Is all text correctly spelled and cleanly set?
  5. Are the four visibly different from each other?
  6. Is "Powered by MAPCO" present but subtle?

If any answer is no, regenerate that creative before presenting it.

SAVE AS: ${day.briefs.map((b) => `${b.id}.png`).join(', ')}
Then drag all ${day.briefs.length} files back into MAPCO — it will match them to the right creative automatically.`;

  return `${header}\n${bodies}${footer}`;
}

/* ── 3. Single-creative regeneration prompt ──────────────────── */

export function buildRegenerationPrompt(brief: CreativeBrief, complaint?: string): string {
  return `${MASTER_BLOCK}

══════════════════════════════════════════
REGENERATE ONE CREATIVE — ${brief.id}
══════════════════════════════════════════
${complaint ? `What was wrong with the previous attempt:\n  ${complaint}\n\n` : `The previous attempt was not good enough. Produce a materially better version — not a small variation of the same layout.\n\n`}Keep every fact, the dealer branding and the property photograph exactly as specified. Change the design execution: composition, crop, type hierarchy and use of space.

${briefBlock(brief, 1)}

Produce one image at 4:5 portrait (1080 × 1350) and save it as ${brief.id}.png.`;
}

/** Short header shown at the top of every pack's prompt file. */
export const OPERATOR_HEADER = `HOW TO USE THIS FILE
1. Open ChatGPT and start a NEW chat.
2. Switch to the highest-quality mode available on your plan (best reasoning + image generation).
3. Upload every image file from this folder into that chat.
4. Paste this entire file as your message.
5. Save each finished image using the filename ChatGPT states (C001.png, C002.png, …).
6. Drag all the finished images back into MAPCO → Marketing → Upload results.

If one creative comes out weak, use the "Regenerate" prompt MAPCO provides for that single creative instead of redoing the whole day.
`;
