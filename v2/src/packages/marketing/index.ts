/* MAPCO Marketing — public domain API.

   Monthly periods are the canonical entitlement boundary. The retained
   weekly exports below are legacy production-pack compatibility only while
   existing history and Ops screens migrate. The preparation engine is
   provider-neutral and deterministic. Today
   the "creative provider" is a human operator in consumer ChatGPT; a
   future API provider plugs in behind the same brief/pack contracts
   without changing planning, facts, templates, history or export. */

export * from './types';
export * from './dealer-feed';
export * from './monthly';
export {
  TEMPLATES, allTemplates, getTemplate, templatesFor,
  templateAssetUrl, templateFileName,
  type RegisteredTemplate, type GeometryProvenance,
} from './templates/registry';
export {
  buildFactPack, hasSufficientFacts, renderFactBlock, factsForAngle,
  EXCLUDED_FIELDS, PROHIBITED_CLAIMS, MIN_FACTS_FOR_CREATIVE,
} from './facts/fact-pack';
export {
  DeterministicPhotoIntelligence, defaultPhotoIntelligence,
  candidatesFrom, dedupePhotos, isUsablePhoto, orientationOf, measurePhoto,
} from './photos/photo-intelligence';
export {
  ANGLES, OBJECTIVES, OBJECTIVE_INTENT, CTA_BY_OBJECTIVE,
  getAngle, supportedAngles, type AngleDefinition,
} from './planner/angles';
export {
  planWeek, assessEligibility, allBriefs, toHistory,
  weekStartOf, weekIdOf, creativeIdFor, signatureOf,
  STRATEGY_VERSION, DEFAULT_PER_DAY, DAYS_IN_WEEK,
  type PlanInput, type EligibleProperty, type EligibilityResult,
} from './planner/weekly-planner';
export {
  MASTER_BLOCK, OPERATOR_HEADER, PROMPT_VERSION,
  buildDailyPrompt, buildRegenerationPrompt,
} from './prompts';
export { createZip, downloadBlob, fetchBytes, type ZipEntry } from './pack/zip';
export {
  buildDayPack, buildWeekPack, renderWeekSummary, renderBriefText, briefJson, dayFolder,
  type PackProgress,
} from './pack/builder';
export {
  matchFiles, extractCreativeId, summarise, fileToDataUrl,
  MAX_RESULT_BYTES,
  type ImportCandidate, type ImportOutcome, type ImportSummary, type MatchContext,
} from './pack/import';
export { LocalPlanStore, localPlanStore } from './store/local-store';
