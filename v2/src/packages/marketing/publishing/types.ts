/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — provider-neutral publishing domain

   ARCHITECTURE ONLY. No adapter in this milestone performs real OAuth,
   stores a real token, or calls a real platform API. The point is that
   when credentials arrive later, an adapter is written against these
   interfaces and nothing else in Marketing changes.

   Core rules encoded here:
     • the core never knows how a provider works
     • a secret NEVER lives in a row or in client state — only a
       `credentialRef` naming a server-side secret
     • "posted" is only ever claimed when a provider genuinely returned
       a remote id
     • capability differences between platforms are DATA, not branches
       scattered through the UI
   ═══════════════════════════════════════════════════════════════ */

export type ChannelId =
  | 'instagram'
  | 'facebook_page'
  | 'google_business'
  | 'whatsapp_business';

export const CHANNELS: readonly ChannelId[] = [
  'instagram', 'facebook_page', 'google_business', 'whatsapp_business',
];

export const CHANNEL_LABEL: Record<ChannelId, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook Page',
  google_business: 'Google Business Profile',
  whatsapp_business: 'WhatsApp Business',
};

/* ── capability model ────────────────────────────────────────── */

/**
 * Mirrors the classification in docs/marketing-publishing-capabilities.md.
 * A capability MAPCO cannot honestly automate is never presented as
 * automatic in the UI.
 */
export type CapabilityStatus =
  | 'SUPPORTED'
  | 'SUPPORTED_WITH_REQUIREMENTS'
  | 'NOT_SUPPORTED'
  | 'NEEDS_VERIFICATION';

export type PublishAction =
  | 'single_image_post'
  | 'carousel_post'
  | 'story'
  | 'reel'
  | 'local_post'
  | 'direct_message'
  | 'status_broadcast';

export interface ChannelCapability {
  readonly action: PublishAction;
  readonly status: CapabilityStatus;
  /** Why, in language safe to show an operator. */
  readonly note: string;
}

/** How a platform ingests the image. Drives the asset-exposure design. */
export type MediaIngest =
  | 'fetch_from_url'   // the platform pulls the bytes from a URL we expose
  | 'direct_upload'    // we POST the bytes
  | 'either'
  | 'not_applicable';

export interface ChannelCapabilities {
  readonly channel: ChannelId;
  readonly actions: readonly ChannelCapability[];
  readonly mediaIngest: MediaIngest;
  /** Formats the platform documents as acceptable. */
  readonly acceptedMime: readonly string[];
  readonly maxBytes?: number;
  /** Aspect ratios the platform documents as acceptable, if constrained. */
  readonly aspectRatios?: readonly string[];
  /** True when the platform itself offers scheduled publishing. */
  readonly nativeScheduling: boolean;
  /** True when the platform returns an id we can use to dedupe retries. */
  readonly remoteIdOnPublish: boolean;
  /** Prerequisites a dealer must satisfy before anything can be published. */
  readonly prerequisites: readonly string[];
  /** Set when a capability is knowingly unverified. */
  readonly caveats: readonly string[];
}

export const supports = (caps: ChannelCapabilities, action: PublishAction): boolean =>
  caps.actions.some((a) => a.action === action
    && (a.status === 'SUPPORTED' || a.status === 'SUPPORTED_WITH_REQUIREMENTS'));

/* ── connection state ────────────────────────────────────────── */

export type ConnectionStatus =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'expired'          // token lapsed — reauthorisation needed
  | 'revoked'          // dealer removed our access
  | 'insufficient_scope'
  | 'error';

/**
 * A dealer's link to one channel.
 *
 * NOTE what is absent: there is no token, no refresh token and no
 * secret of any kind. `credentialRef` NAMES a secret held in a
 * server-side store; the browser never receives the value.
 */
export interface ChannelConnection {
  readonly dealerId: string;
  readonly channel: ChannelId;
  readonly status: ConnectionStatus;
  /** Non-secret public identity, e.g. an IG user id or a GBP location. */
  readonly externalAccountRef?: string;
  /** What the dealer would recognise, e.g. '@abcproperties'. */
  readonly displayName?: string;
  /** NAME of a secret in the server-side store. Never the secret. */
  readonly credentialRef?: string;
  readonly scopes: readonly string[];
  readonly connectedAt?: string;
  readonly lastCheckedAt?: string;
  readonly lastError?: string;
}

/** What may safely reach the browser. Enforced by tests. */
export interface ClientSafeConnection {
  readonly channel: ChannelId;
  readonly status: ConnectionStatus;
  readonly displayName?: string;
  readonly connectedAt?: string;
  /** A short, actionable message — never a raw provider response. */
  readonly actionRequired?: string;
}

/** Strip a connection down to what a client may see. */
export function toClientSafeConnection(c: ChannelConnection): ClientSafeConnection {
  const actionRequired =
    c.status === 'expired' || c.status === 'revoked' ? 'Reconnect this account'
    : c.status === 'insufficient_scope' ? 'Reconnect and grant the missing permission'
    : c.status === 'error' ? 'Connection problem — try reconnecting'
    : undefined;
  return {
    channel: c.channel,
    status: c.status,
    ...(c.displayName ? { displayName: c.displayName } : {}),
    ...(c.connectedAt ? { connectedAt: c.connectedAt } : {}),
    ...(actionRequired ? { actionRequired } : {}),
  };
}

/* ── dealer publishing settings ──────────────────────────────── */

export interface ChannelSettings {
  readonly channel: ChannelId;
  readonly enabled: boolean;
  /** Auto-publish is opt-in and OFF by default; approval is the boundary. */
  readonly autoPublish: boolean;
  /** Local time of day to publish, HH:MM. */
  readonly defaultPublishTime?: string;
  /** Google Business needs a location; Facebook needs a page. */
  readonly targetRef?: string;
}

export interface DealerPublishingSettings {
  readonly dealerId: string;
  readonly timezone: string;
  readonly channels: readonly ChannelSettings[];
}

export const channelSetting = (
  s: DealerPublishingSettings, channel: ChannelId,
): ChannelSettings | undefined => s.channels.find((c) => c.channel === channel);

/* ── publication content ─────────────────────────────────────── */

/**
 * Normalised post content. Adapters translate this into their own
 * platform shape. Deliberately NOT baked into the image workflow — the
 * ChatGPT image is only the media asset.
 */
export interface PublicationContent {
  readonly caption?: string;
  readonly cta?: { readonly label: string; readonly url: string };
  readonly link?: string;
  readonly hashtags?: readonly string[];
  /** Google Business local posts carry a short summary. */
  readonly summary?: string;
  /** WhatsApp message body, when messaging is used. */
  readonly messageBody?: string;
}

/** The one canonical creative the operator uploaded. */
export interface CanonicalCreative {
  readonly assetId: string;
  readonly dealerId: string;
  readonly slotRef: string;
  readonly creativeType?: 'post' | 'reel';
  readonly bucket: string;
  readonly path: string;
  readonly mime: string;
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
}

/**
 * A platform-specific variant. Any transformation is RECORDED — a
 * creative is never silently cropped.
 */
export interface PreparedAsset {
  readonly channel: ChannelId;
  readonly sourceAssetId: string;
  readonly bucket: string;
  readonly path: string;
  readonly mime: string;
  readonly width?: number;
  readonly height?: number;
  /** Empty when the canonical asset was used unchanged. */
  readonly transformations: readonly string[];
  /**
   * Short-lived URL for platforms that FETCH media. Never a permanently
   * public object, and never the private path itself.
   */
  readonly fetchUrl?: string;
  readonly fetchUrlExpiresAt?: string;
}

/* ── publication lifecycle ───────────────────────────────────── */

export type PublicationState =
  | 'pending'        // schedule item exists, not yet due
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'skipped'
  | 'manual_required';   // honest state for capabilities with no API

export type PublishErrorCode =
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'TEMPORARY_PROVIDER_ERROR'
  | 'INVALID_MEDIA'
  | 'INVALID_CAPTION'
  | 'ACCOUNT_NOT_ELIGIBLE'
  | 'PERMISSION_DENIED'
  | 'REMOTE_REJECTED'
  | 'UNKNOWN_REMOTE_STATE';

/** Only these are worth retrying. Everything else is permanent. */
export const RETRYABLE: readonly PublishErrorCode[] = [
  'RATE_LIMITED', 'TEMPORARY_PROVIDER_ERROR', 'UNKNOWN_REMOTE_STATE',
];

export const isRetryable = (code: PublishErrorCode): boolean => RETRYABLE.includes(code);

/** Errors the dealer must act on before anything can succeed. */
export const NEEDS_RECONNECT: readonly PublishErrorCode[] = [
  'AUTH_REQUIRED', 'PERMISSION_DENIED',
];

export interface PublishRequest {
  readonly dealerId: string;
  readonly channel: ChannelId;
  readonly action: PublishAction;
  readonly connection: ChannelConnection;
  readonly asset: PreparedAsset;
  readonly content: PublicationContent;
  /**
   * Stable identity for this publication attempt. The adapter must use
   * it so a retry cannot create a second external post.
   */
  readonly idempotencyKey: string;
}

export interface PublishSuccess {
  readonly ok: true;
  /** The provider's own id. Absent means we must NOT claim 'published'. */
  readonly remoteId: string;
  readonly remoteUrl?: string;
  readonly publishedAt: string;
}

export interface PublishFailure {
  readonly ok: false;
  readonly code: PublishErrorCode;
  /** Safe to show an operator. Never a raw provider payload. */
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
}

export type PublishResult = PublishSuccess | PublishFailure;

export interface ValidationProblem {
  readonly field: string;
  readonly code: PublishErrorCode;
  readonly message: string;
}

/* ── the adapter contract ────────────────────────────────────── */

/**
 * Every provider implements exactly this. The Marketing core calls
 * nothing else, so Meta/Google specifics never leak into UI components.
 */
export interface PublisherAdapter {
  readonly channel: ChannelId;
  getCapabilities(): ChannelCapabilities;
  /** Is this dealer's connection usable right now? */
  validateConnection(connection: ChannelConnection): Promise<readonly ValidationProblem[]>;
  /** Does this creative + content satisfy CURRENT platform requirements? */
  validateCreative(
    asset: CanonicalCreative, content: PublicationContent, action: PublishAction,
  ): Promise<readonly ValidationProblem[]>;
  /** Produce the platform variant, recording any transformation. */
  prepareAsset(asset: CanonicalCreative, action: PublishAction): Promise<PreparedAsset>;
  publish(request: PublishRequest): Promise<PublishResult>;
  getPublicationStatus(connection: ChannelConnection, remoteId: string): Promise<PublicationState>;
  deletePublication?(connection: ChannelConnection, remoteId: string): Promise<boolean>;
  /** Map a provider error into MAPCO's vocabulary. */
  classifyError(error: unknown): PublishErrorCode;
}

/* ── schedule + attempt records ──────────────────────────────── */

export interface PublicationSchedule {
  readonly id: string;
  readonly dealerId: string;
  readonly channel: ChannelId;
  readonly slotRef: string;
  readonly creativeAssetId: string;
  readonly scheduledFor: string;
  readonly state: PublicationState;
  /** Stable across retries — this is the dedupe identity. */
  readonly idempotencyKey: string;
  readonly attempts: number;
  readonly nextAttemptAt?: string;
  readonly remoteId?: string;
  readonly remoteUrl?: string;
  readonly lastErrorCode?: PublishErrorCode;
  readonly lastErrorMessage?: string;
}

export const MAX_ATTEMPTS = 5;

/** Exponential backoff with a ceiling: 1m, 4m, 15m, 60m, 60m. */
export function backoffSeconds(attempt: number): number {
  const table = [60, 240, 900, 3600, 3600];
  return table[Math.min(attempt, table.length - 1)]!;
}

/** Deterministic idempotency identity for one (dealer, slot, channel). */
export const publicationKey = (
  dealerId: string, slotRef: string, channel: ChannelId, productionPeriodId: string,
): string => `${dealerId}::${productionPeriodId}::${slotRef}::${channel}`;
