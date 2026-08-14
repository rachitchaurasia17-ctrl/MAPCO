/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Render-side validation
   ---------------------------------------------------------------
   A stored artifact payload is JSON that originated outside the UI's
   control. Before any MAPCO surface renders it, it is parsed here into
   a typed value with unknown keys dropped and every field bounded.

   Failure mode is deliberate: a malformed payload yields `null`, and the
   caller renders its ordinary "nothing to show" state. AI is an
   enhancement layer, so bad AI data degrades to no AI data — it never
   throws into a page and never partially renders.
   ═══════════════════════════════════════════════════════════════ */

import type {
  AiAnswer, AiArtifact, AiArtifactKind, AiArtifactSummary, AiConfidence, AiDirection,
  AiEvidence, AiGeneratedCopy, AiIntelligenceSnapshot, AiMarketingSuggestion, AiPriority,
  AiRecommendation, AiReportSection, AiReportSectionKey, AiSignal, AiSignalKind, AiSignalSet,
  AiSubject, AiSubjectKind, AiWeeklyReport,
} from './types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown, max: number, fallback = ''): string =>
  typeof value === 'string' ? value.slice(0, max) : fallback;

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : fallback;
}

function list(value: unknown, max: number): unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

const SUBJECT_KINDS: readonly AiSubjectKind[] =
  ['area', 'sector', 'property', 'client_link', 'map', 'inventory', 'portfolio'];
const SIGNAL_KINDS: readonly AiSignalKind[] = [
  'attention_rising', 'attention_falling', 'unusual_engagement', 'repeat_link_opens',
  'underexposed_inventory', 'coverage_gap', 'inventory_change', 'no_change',
];
const CONFIDENCES: readonly AiConfidence[] = ['low', 'medium', 'high'];
const DIRECTIONS: readonly AiDirection[] = ['up', 'down', 'flat'];
const PRIORITIES: readonly AiPriority[] = ['now', 'this_week', 'later'];
const SECTION_KEYS: readonly AiReportSectionKey[] = [
  'presentation_behaviour', 'property_performance', 'area_performance',
  'marketing_performance', 'important_changes',
];
const ARTIFACT_KINDS: readonly AiArtifactKind[] = [
  'intelligence_snapshot', 'signal_set', 'recommendation_set',
  'weekly_report', 'marketing_suggestion', 'generated_copy', 'answer',
];

/* ── building blocks ────────────────────────────────────────────── */

function parseSubject(raw: unknown): AiSubject {
  const source = isObject(raw) ? raw : {};
  return {
    kind: oneOf(source.kind, SUBJECT_KINDS, 'portfolio'),
    id: str(source.id, 120),
    label: str(source.label, 120),
  };
}

function parseEvidence(raw: unknown): AiEvidence | null {
  if (!isObject(raw)) return null;
  const factPath = str(raw.factPath, 200);
  if (!factPath) return null;
  return {
    factPath,
    metric: str(raw.metric, 80),
    value: num(raw.value),
    ...(typeof raw.previousValue === 'number' ? { previousValue: raw.previousValue } : {}),
  };
}

const parseEvidenceList = (raw: unknown, max: number): AiEvidence[] =>
  list(raw, max).map(parseEvidence).filter((item): item is AiEvidence => item !== null);

function parseSignal(raw: unknown): AiSignal | null {
  if (!isObject(raw)) return null;
  const headline = str(raw.headline, 90);
  if (!headline) return null;
  return {
    id: str(raw.id, 60) || headline.slice(0, 60),
    kind: oneOf(raw.kind, SIGNAL_KINDS, 'no_change'),
    subject: parseSubject(raw.subject),
    headline,
    detail: str(raw.detail, 400),
    direction: oneOf(raw.direction, DIRECTIONS, 'flat'),
    magnitude: Math.min(1, Math.max(0, num(raw.magnitude))),
    confidence: oneOf(raw.confidence, CONFIDENCES, 'low'),
    evidence: parseEvidenceList(raw.evidence, 6),
  };
}

function parseRecommendation(raw: unknown): AiRecommendation | null {
  if (!isObject(raw)) return null;
  const title = str(raw.title, 90);
  if (!title) return null;
  const suggestedAction = str(raw.suggestedAction, 80);
  return {
    id: str(raw.id, 60) || title.slice(0, 60),
    title,
    reason: str(raw.reason, 400),
    subject: parseSubject(raw.subject),
    priority: oneOf(raw.priority, PRIORITIES, 'later'),
    confidence: oneOf(raw.confidence, CONFIDENCES, 'low'),
    evidence: parseEvidenceList(raw.evidence, 4),
    ...(suggestedAction ? { suggestedAction } : {}),
  };
}

const parseSignals = (raw: unknown, max: number): AiSignal[] =>
  list(raw, max).map(parseSignal).filter((item): item is AiSignal => item !== null);

const parseRecommendations = (raw: unknown, max: number): AiRecommendation[] =>
  list(raw, max).map(parseRecommendation).filter((item): item is AiRecommendation => item !== null);

/* ── payload parsers ────────────────────────────────────────────── */

export function parseIntelligenceSnapshot(raw: unknown): AiIntelligenceSnapshot | null {
  if (!isObject(raw)) return null;
  const headline = str(raw.headline, 120);
  if (!headline) return null;
  return {
    periodLabel: str(raw.periodLabel, 60),
    headline,
    interpretation: str(raw.interpretation, 700),
    signals: parseSignals(raw.signals, 6),
    recommendations: parseRecommendations(raw.recommendations, 4),
    insufficientData: bool(raw.insufficientData),
    dataNotes: list(raw.dataNotes, 4).map((note) => str(note, 200)).filter(Boolean),
  };
}

export function parseSignalSet(raw: unknown): AiSignalSet | null {
  if (!isObject(raw)) return null;
  return {
    periodLabel: str(raw.periodLabel, 60),
    summary: str(raw.summary, 400),
    signals: parseSignals(raw.signals, 12),
    insufficientData: bool(raw.insufficientData),
  };
}

function parseReportSection(raw: unknown): AiReportSection | null {
  if (!isObject(raw)) return null;
  const title = str(raw.title, 80);
  if (!title) return null;
  return {
    key: oneOf(raw.key, SECTION_KEYS, 'important_changes'),
    title,
    narrative: str(raw.narrative, 900),
    highlights: list(raw.highlights, 6).flatMap((item) => {
      if (!isObject(item)) return [];
      const label = str(item.label, 80);
      if (!label) return [];
      const changeLabel = str(item.changeLabel, 60);
      return [{
        label,
        value: str(item.value, 60),
        ...(changeLabel ? { changeLabel } : {}),
        ...(isObject(item.subject) ? { subject: parseSubject(item.subject) } : {}),
      }];
    }),
    evidence: parseEvidenceList(raw.evidence, 8),
  };
}

export function parseWeeklyReport(raw: unknown): AiWeeklyReport | null {
  if (!isObject(raw)) return null;
  const headline = str(raw.headline, 140);
  if (!headline) return null;
  return {
    periodLabel: str(raw.periodLabel, 60),
    headline,
    executiveSummary: str(raw.executiveSummary, 900),
    sections: list(raw.sections, 5)
      .map(parseReportSection)
      .filter((item): item is AiReportSection => item !== null),
    recommendations: parseRecommendations(raw.recommendations, 6),
    insufficientData: bool(raw.insufficientData),
    dataNotes: list(raw.dataNotes, 5).map((note) => str(note, 200)).filter(Boolean),
  };
}

export function parseGeneratedCopy(raw: unknown): AiGeneratedCopy | null {
  if (!isObject(raw)) return null;
  const headline = str(raw.headline, 60);
  const caption = str(raw.caption, 600);
  if (!headline || !caption) return null;
  const subhead = str(raw.subhead, 90);
  return {
    headline,
    ...(subhead ? { subhead } : {}),
    caption,
    hashtags: list(raw.hashtags, 8).map((tag) => str(tag, 40)).filter(Boolean),
    callToAction: str(raw.callToAction, 60),
    factsUsed: list(raw.factsUsed, 8).map((fact) => str(fact, 60)).filter(Boolean),
  };
}

export function parseMarketingSuggestion(raw: unknown): AiMarketingSuggestion | null {
  if (!isObject(raw)) return null;
  const copy = parseGeneratedCopy(raw.copy);
  const propertyId = str(raw.propertyId, 120);
  if (!copy || !propertyId) return null;
  return {
    propertyId,
    angle: oneOf(raw.angle,
      ['location', 'value', 'size', 'approvals', 'connectivity', 'lifestyle', 'availability'] as const,
      'availability'),
    rationale: str(raw.rationale, 400),
    confidence: oneOf(raw.confidence, CONFIDENCES, 'low'),
    copy,
    channels: list(raw.channels, 3)
      .map((channel) => oneOf(channel, ['instagram', 'google_business', 'whatsapp'] as const, 'instagram')),
  };
}

export function parseAnswer(raw: unknown): AiAnswer | null {
  if (!isObject(raw)) return null;
  const answer = str(raw.answer, 1200);
  if (!answer) return null;
  return {
    answer,
    answered: bool(raw.answered, true),
    evidence: parseEvidenceList(raw.evidence, 8),
    followUps: list(raw.followUps, 3).map((item) => str(item, 120)).filter(Boolean),
  };
}

/* ── envelope ───────────────────────────────────────────────────── */

/**
 * Parse a stored artifact envelope with a payload parser of the caller's
 * choosing. A payload that fails its parser makes the whole artifact null,
 * so a surface never renders a half-valid record.
 */
export function parseArtifact<T>(
  raw: unknown,
  parsePayload: (payload: unknown) => T | null,
): AiArtifact<T> | null {
  if (!isObject(raw)) return null;
  const payload = parsePayload(raw.payload);
  if (payload === null) return null;
  const provenance = isObject(raw.provenance) ? raw.provenance : {};
  const confidence = num(raw.confidence, -1);
  return {
    id: str(raw.id, 60),
    kind: oneOf(raw.kind, ARTIFACT_KINDS, 'intelligence_snapshot'),
    periodKey: str(raw.periodKey, 120),
    version: Math.max(1, Math.round(num(raw.version, 1))),
    schemaVersion: str(raw.schemaVersion, 40, 'v1'),
    payload,
    ...(confidence >= 0 && confidence <= 1 ? { confidence } : {}),
    generatedAt: str(raw.generatedAt, 40),
    provenance: {
      ...(str(provenance.provider, 40) ? { provider: str(provenance.provider, 40) } : {}),
      ...(str(provenance.model, 120) ? { model: str(provenance.model, 120) } : {}),
      ...(str(provenance.contextDigest, 64) ? { contextDigest: str(provenance.contextDigest, 64) } : {}),
    },
  };
}

export function parseArtifactSummary(raw: unknown): AiArtifactSummary | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id ?? raw.artifact_id, 60);
  if (!id) return null;
  return {
    id,
    kind: oneOf(raw.kind, ARTIFACT_KINDS, 'intelligence_snapshot'),
    periodKey: str(raw.period_key ?? raw.periodKey, 120),
    version: Math.max(1, Math.round(num(raw.version, 1))),
    status: oneOf(raw.status, ['published', 'superseded'] as const, 'published'),
    generatedAt: str(raw.generated_at ?? raw.generatedAt, 40),
    ...(str(raw.provider, 40) ? { provider: str(raw.provider, 40) } : {}),
    ...(str(raw.model, 120) ? { model: str(raw.model, 120) } : {}),
  };
}

/** Payload parser for each artifact kind, so a caller can stay generic. */
export const PAYLOAD_PARSERS = {
  intelligence_snapshot: parseIntelligenceSnapshot,
  signal_set: parseSignalSet,
  weekly_report: parseWeeklyReport,
  marketing_suggestion: parseMarketingSuggestion,
  generated_copy: parseGeneratedCopy,
  answer: parseAnswer,
} as const;
