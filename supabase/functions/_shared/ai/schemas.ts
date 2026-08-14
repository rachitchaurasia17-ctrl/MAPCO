// MAPCO AI · Canonical structured-output schemas (v1)
// ---------------------------------------------------------------
// Every AI workload in MAPCO produces one of these shapes. There is no
// "just return some text" task: the model supplies meaning and content,
// MAPCO supplies the rendering.
//
// Design rules encoded here:
//   • Every claim carries the evidence it came from (`evidence` refs point
//     back into the deterministic fact object) so an artifact stays
//     auditable after the fact.
//   • Nothing may assert a person. Subjects are areas, sectors, properties,
//     links and inventory — never "a buyer".
//   • Arrays are capped, strings are length-bounded: an artifact has a
//     predictable maximum size and therefore a predictable maximum cost.
//
// Bumping AI_SCHEMA_VERSION is a breaking change: stored artifacts keep the
// version they were generated under, and readers must handle both.

import { S, type Schema } from './schema.ts';

export const AI_SCHEMA_VERSION = 'v1';

/* ── shared building blocks ─────────────────────────────────────── */

/** What a statement is about. `id` refers to a MAPCO record, never a person. */
const SUBJECT = S.object(
  {
    kind: S.enum(['area', 'sector', 'property', 'client_link', 'map', 'inventory', 'portfolio']),
    id: S.string({ maxLength: 120, description: 'MAPCO record id, or the area/sector label.' }),
    label: S.string({ maxLength: 120 }),
  },
  { description: 'The MAPCO entity a statement is about.' },
);

/** A pointer into the deterministic facts that justified a statement. */
const EVIDENCE = S.object(
  {
    factPath: S.string({
      maxLength: 200,
      description: 'Dotted path into the supplied facts object, e.g. presentation.byArea[0].',
    }),
    metric: S.string({ maxLength: 80 }),
    value: S.number(),
    previousValue: S.number(),
  },
  { optional: ['previousValue'], description: 'Traceability back to a supplied fact.' },
);

const CONFIDENCE = S.enum(['low', 'medium', 'high']);

/* ── signal ─────────────────────────────────────────────────────── */
// One observed, evidenced change in dealer-owned activity.

export const SIGNAL = S.object(
  {
    id: S.string({ maxLength: 60 }),
    kind: S.enum([
      'attention_rising',
      'attention_falling',
      'unusual_engagement',
      'repeat_link_opens',
      'underexposed_inventory',
      'coverage_gap',
      'inventory_change',
      'no_change',
    ]),
    subject: SUBJECT,
    headline: S.string({ maxLength: 90, description: 'Plain, factual. No adjectives about people.' }),
    detail: S.string({ maxLength: 400 }),
    direction: S.enum(['up', 'down', 'flat']),
    magnitude: S.number({ min: 0, max: 1, description: 'Relative importance within this run.' }),
    confidence: CONFIDENCE,
    evidence: S.array(EVIDENCE, 6, { minItems: 1 }),
  },
  { description: 'One evidenced observation about dealer-owned activity.' },
);

export const SIGNAL_SET = S.object({
  periodLabel: S.string({ maxLength: 60 }),
  summary: S.string({ maxLength: 400 }),
  signals: S.array(SIGNAL, 12),
  /** Explicitly stated when the window genuinely has nothing to report. */
  insufficientData: S.boolean(),
});

/* ── recommendation ─────────────────────────────────────────────── */

export const RECOMMENDATION = S.object(
  {
    id: S.string({ maxLength: 60 }),
    title: S.string({ maxLength: 90 }),
    reason: S.string({ maxLength: 400 }),
    subject: SUBJECT,
    priority: S.enum(['now', 'this_week', 'later']),
    confidence: CONFIDENCE,
    evidence: S.array(EVIDENCE, 4, { minItems: 1 }),
    /**
     * The MAPCO tool this recommendation maps to, if any. MAPCO resolves the
     * name against its own action catalog; an unknown value is dropped, and
     * nothing is executed from this field directly.
     */
    suggestedAction: S.string({ maxLength: 80 }),
  },
  { optional: ['suggestedAction'] },
);

export const RECOMMENDATION_SET = S.object({
  periodLabel: S.string({ maxLength: 60 }),
  recommendations: S.array(RECOMMENDATION, 8),
  insufficientData: S.boolean(),
});

/* ── daily intelligence snapshot ────────────────────────────────── */
// Small and cheap: generated once per dealer per day and stored.

export const INTELLIGENCE_SNAPSHOT = S.object({
  periodLabel: S.string({ maxLength: 60 }),
  headline: S.string({ maxLength: 120, description: 'One factual sentence about the day.' }),
  interpretation: S.string({ maxLength: 700 }),
  signals: S.array(SIGNAL, 6),
  recommendations: S.array(RECOMMENDATION, 4),
  /** True when the day genuinely had too little activity to interpret. */
  insufficientData: S.boolean(),
  dataNotes: S.array(S.string({ maxLength: 200 }), 4),
});

/* ── weekly report ──────────────────────────────────────────────── */

const REPORT_SECTION = S.object({
  key: S.enum([
    'presentation_behaviour',
    'property_performance',
    'area_performance',
    'marketing_performance',
    'important_changes',
  ]),
  title: S.string({ maxLength: 80 }),
  narrative: S.string({ maxLength: 900 }),
  highlights: S.array(
    S.object({
      label: S.string({ maxLength: 80 }),
      value: S.string({ maxLength: 60 }),
      changeLabel: S.string({ maxLength: 60 }),
      subject: SUBJECT,
    }, { optional: ['changeLabel', 'subject'] }),
    6,
  ),
  evidence: S.array(EVIDENCE, 8),
});

export const WEEKLY_REPORT = S.object({
  periodLabel: S.string({ maxLength: 60 }),
  headline: S.string({ maxLength: 140 }),
  executiveSummary: S.string({ maxLength: 900 }),
  sections: S.array(REPORT_SECTION, 5),
  recommendations: S.array(RECOMMENDATION, 6),
  insufficientData: S.boolean(),
  dataNotes: S.array(S.string({ maxLength: 200 }), 5),
});

/* ── marketing ──────────────────────────────────────────────────── */
// Copy only. The dealer's real photograph is inserted unchanged by MAPCO's
// own renderer; no schema here can describe or alter an image.

export const GENERATED_COPY = S.object(
  {
    headline: S.string({ maxLength: 60 }),
    subhead: S.string({ maxLength: 90 }),
    caption: S.string({ maxLength: 600 }),
    hashtags: S.array(S.string({ maxLength: 40 }), 8),
    callToAction: S.string({ maxLength: 60 }),
    /** Facts the copy relied on, so a claim can be checked against the listing. */
    factsUsed: S.array(S.string({ maxLength: 60 }), 8),
  },
  { optional: ['subhead'] },
);

export const MARKETING_SUGGESTION = S.object({
  propertyId: S.string({ maxLength: 120 }),
  angle: S.enum(['location', 'value', 'size', 'approvals', 'connectivity', 'lifestyle', 'availability']),
  rationale: S.string({ maxLength: 400 }),
  confidence: CONFIDENCE,
  copy: GENERATED_COPY,
  /** Preferred surfaces. MAPCO decides the actual design internally. */
  channels: S.array(S.enum(['instagram', 'google_business', 'whatsapp']), 3),
});

/* ── controlled action proposal ─────────────────────────────────── */
// The model may only REQUEST an action from MAPCO's catalog. MAPCO
// re-validates the name and every parameter before anything happens.

export const ACTION_PROPOSAL = S.object(
  {
    actionType: S.string({ maxLength: 80 }),
    title: S.string({ maxLength: 120 }),
    rationale: S.string({ maxLength: 600 }),
    params: S.object(
      {
        propertyIds: S.array(S.string({ maxLength: 120 }), 12),
        area: S.string({ maxLength: 120 }),
        note: S.string({ maxLength: 500 }),
        channel: S.enum(['instagram', 'google_business', 'whatsapp']),
        dueDate: S.string({ maxLength: 10 }),
      },
      { optional: ['propertyIds', 'area', 'note', 'channel', 'dueDate'] },
    ),
  },
  { optional: ['rationale'] },
);

export const ACTION_PROPOSAL_SET = S.object({
  proposals: S.array(ACTION_PROPOSAL, 5),
});

/* ── ask MAPCO (grounded answer) ────────────────────────────────── */

export const ANSWER = S.object({
  answer: S.string({ maxLength: 1200 }),
  /** False when the supplied facts cannot support an answer. */
  answered: S.boolean(),
  evidence: S.array(EVIDENCE, 8),
  followUps: S.array(S.string({ maxLength: 120 }), 3),
});

/* ── registry ───────────────────────────────────────────────────── */

export const OUTPUT_SCHEMAS = {
  signal_set: SIGNAL_SET,
  recommendation_set: RECOMMENDATION_SET,
  intelligence_snapshot: INTELLIGENCE_SNAPSHOT,
  weekly_report: WEEKLY_REPORT,
  marketing_suggestion: MARKETING_SUGGESTION,
  generated_copy: GENERATED_COPY,
  action_proposal_set: ACTION_PROPOSAL_SET,
  answer: ANSWER,
} as const satisfies Record<string, Schema>;

export type OutputSchemaName = keyof typeof OUTPUT_SCHEMAS;
