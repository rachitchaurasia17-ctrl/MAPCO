/* MAPCO Marketing Operations — internal, team-only.

   V1 is human-directed. MAPCO prepares data and tracks production;
   the operator is the creative director and works in consumer ChatGPT.

   Deliberately NOT exported here (dormant, see each file's banner):
   the weekly creative planner, creative angles/objectives, the template
   registry, generated ChatGPT prompts, and the template-based pack
   builder. They compile and are tested, but nothing in this workflow
   imports them. */

export * from './types';
export {
  createWeek, mergeWeek, slotsForDay, findSlot, isDone, weekProgress,
  releasableSlots, slotRef, weekStartOf, weekIdOf,
  DEFAULT_PER_DAY, DAYS_IN_WEEK, WEEKDAYS,
  type WeekProgress,
} from './slots';
export {
  buildInventoryPack, assessInventory, describePack,
  type MarketableProperty, type EligibilityNote, type InventoryAssessment,
  type PackResult, type PackProgress,
} from './inventory-pack';
export {
  renderPropertyBrief, renderDealerInfo, renderPackReadme,
  propertyRef, photoFileName,
} from './property-brief';
export { LocalOpsStore, localOpsStore } from './ops-store';
export {
  marketingOpsGateway,
  type MarketingOpsGateway, type OpsDealerRecord, type OpsLoadResult,
  type OpsWeekResult, type NewInventoryItem,
} from './gateway';
export {
  detectNewProperties, raiseActions, recommendSlot, summariseBacklog,
  buildNewPropertyPack, suggestForUpload, recalculateFuture,
  isMarketableForOps, isHandled, actionId, TERMINAL_STAGES,
  type NewPropertyAction, type NewPropertyStage, type SlotRecommendation,
  type RecommendationKind, type BacklogSummary, type UploadSuggestion,
  type NewPropertyPackResult, type DetectionInput, type RaiseInput, type RecommendInput,
} from './new-property';
export {
  toReleasedCreative, releasedForDealer, canGenuinelyPublish, RELEASE_NOTE,
  type ReleasedCreative, type ReleaseState,
} from './release';

/* Still active from the shared package: */
export { buildFactPack, PROHIBITED_CLAIMS, EXCLUDED_FIELDS } from '../facts/fact-pack';
export { createZip, downloadBlob, fetchBytes, type ZipEntry } from '../pack/zip';
export {
  matchFiles, extractCreativeId, summarise, fileToDataUrl,
  MAX_RESULT_BYTES,
  type ImportCandidate, type ImportOutcome, type ImportSummary,
} from '../pack/import';
