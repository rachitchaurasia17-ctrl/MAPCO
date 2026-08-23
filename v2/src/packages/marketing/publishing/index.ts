/* MAPCO Marketing — publishing (architecture only).

   No adapter performs real OAuth, stores a real token, or calls a real
   platform API in this milestone. Capability profiles are verified
   against first-party docs; see docs/marketing-publishing-capabilities.md */

export * from './types';
export {
  capabilitiesFor, allCapabilities, automatableChannels, needsPublicUrl,
  CAPABILITIES_CHECKED_ON,
} from './capabilities';
export {
  validateCaption, validateForChannels, buildContent, renderCaptionFor,
  containsPhoneNumber, countHashtags, CAPTION_RULES,
  type CaptionRules, type RenderedCaption,
} from './caption';
export {
  credentialRefFor, isValidCredentialRef, credentialsAvailable,
  findSecretLeaks, containsSecret, needsRefresh, reauthorisationMessage,
  UnconfiguredCredentialStore, CredentialStoreNotConfigured,
  type CredentialRef, type CredentialStore, type StoredCredential,
  type LeakFinding, type ReauthorisationNeed,
} from './credentials';
export {
  planPublications, dueSchedules, applyResult, isExhausted, displayFor,
  defaultActionFor,
  type ApprovedCreativeInput, type ScheduleContext, type ScheduleDecision,
  type ChannelDisplay,
} from './scheduler';
export {
  adapterFor, allAdapters, publishingEnabled,
  InstagramPublisher, FacebookPagePublisher,
  GoogleBusinessPublisher, WhatsAppBusinessPublisher,
} from './adapters';
