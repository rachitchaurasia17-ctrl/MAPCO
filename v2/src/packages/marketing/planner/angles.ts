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
   MAPCO Marketing — Creative angles and objectives

   Rule-based, not model-generated. Each angle leads with a DIFFERENT
   verified fact, which is what makes a repeated property still read as
   a genuinely new post rather than a reprint.

   An angle only applies when the property actually has the facts it
   leads with — we never manufacture an angle a property cannot support.
   ═══════════════════════════════════════════════════════════════ */
import type { CreativeAngle, FactPack, MarketingObjective } from '../types';

export interface AngleDefinition {
  readonly id: CreativeAngle;
  /** Fact labels this angle leads with. */
  readonly leadLabels: readonly string[];
  /** Rule-derived direction for the operator and the model. */
  readonly direction: string;
  readonly headlineApproach: string;
}

export const ANGLES: readonly AngleDefinition[] = [
  {
    id: 'size_and_shape',
    leadLabels: ['Size', 'Position'],
    direction:
      'Lead with the plot size. Make the scale of the land the first thing a buyer registers, then support it with position.',
    headlineApproach: 'Size-forward. A short, confident statement of the land itself.',
  },
  {
    id: 'facing_and_position',
    leadLabels: ['Facing', 'Position'],
    direction:
      'Lead with facing and position. Vastu and orientation matter to Indian buyers — state them plainly, without claiming any benefit that is not in the facts.',
    headlineApproach: 'Orientation-forward. Calm and factual.',
  },
  {
    id: 'locality_and_sector',
    leadLabels: ['Sector', 'City', 'Locality'],
    direction:
      'Lead with the address. The sector and city are the headline; the property specifics support them.',
    headlineApproach: 'Place-forward. Name the locality first.',
  },
  {
    id: 'approval_and_ownership',
    leadLabels: ['Approval'],
    direction:
      'Lead with the approval status. Credibility is the message — an approved file is what a cautious buyer is scanning for.',
    headlineApproach: 'Trust-forward. Understated and precise.',
  },
  {
    id: 'readiness_and_possession',
    leadLabels: ['Position', 'Size'],
    direction:
      'Lead with readiness — that this is available and ready to act on now. Do not imply urgency or scarcity.',
    headlineApproach: 'Availability-forward. Direct, no pressure language.',
  },
  {
    id: 'connectivity_and_access',
    leadLabels: ['Nearby', 'Locality'],
    direction:
      'Lead with what is genuinely near, using ONLY the stored landmark distances. If no landmark distance is stored, do not use this angle.',
    headlineApproach: 'Connectivity-forward. Concrete distances only.',
  },
];

const BY_ID = new Map(ANGLES.map((a) => [a.id, a]));
export const getAngle = (id: CreativeAngle): AngleDefinition => BY_ID.get(id)!;

/** Angles this property can honestly support, in preference order. */
export function supportedAngles(pack: FactPack): readonly AngleDefinition[] {
  const labels = pack.facts.map((f) => f.label.toLowerCase());
  const has = (needle: string): boolean => labels.some((l) => l.startsWith(needle.toLowerCase()));
  const ok = ANGLES.filter((angle) => angle.leadLabels.some((l) => has(l)));
  // Never return empty — locality is derivable from any pack that passed
  // the minimum-facts gate.
  return ok.length ? ok : [getAngle('locality_and_sector')];
}

export const OBJECTIVES: readonly MarketingObjective[] = [
  'primary_showcase',
  'inventory_highlight',
  'location_advantage',
  'alt_channel_cut',
];

export const OBJECTIVE_INTENT: Record<MarketingObjective, string> = {
  primary_showcase:
    'The day’s strongest single property. Give it the most confident, most photographic treatment.',
  inventory_highlight:
    'A second, deliberately different property — different sector or type where possible — so the feed shows range.',
  location_advantage:
    'Foreground where the property sits. Use only stored locality and landmark facts.',
  alt_channel_cut:
    'A cleaner, lower-text cut of the day’s message, suitable for WhatsApp status where captions are not read.',
};

export const CTA_BY_OBJECTIVE: Record<MarketingObjective, string> = {
  primary_showcase: 'Call for details',
  inventory_highlight: 'Ask for the full list',
  location_advantage: 'Ask for the exact location',
  alt_channel_cut: 'Message on WhatsApp',
};
