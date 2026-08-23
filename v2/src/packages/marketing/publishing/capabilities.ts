/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — verified platform capability profiles

   Every entry below was checked against FIRST-PARTY vendor docs on
   2026-08-16. Sources and the full findings live in
   docs/marketing-publishing-capabilities.md.

   These profiles are DATA. The scheduler and the UI read them; no
   platform branching is scattered through components. When a platform
   changes, this file changes and nothing else has to.
   ═══════════════════════════════════════════════════════════════ */
import type { ChannelCapabilities, ChannelId } from './types';

export const CAPABILITIES_CHECKED_ON = '2026-08-16';

/* ── Instagram ───────────────────────────────────────────────────
   Graph API content publishing. Two-step container → publish.
   The two facts that shape our architecture:
     • Meta FETCHES the image from a public HTTPS URL. There is no
       image binary upload. (Resumable upload is video-only.)
     • There is no native scheduling — media_publish is immediate, so
       MAPCO owns the clock.
   ─────────────────────────────────────────────────────────────── */
const INSTAGRAM: ChannelCapabilities = {
  channel: 'instagram',
  mediaIngest: 'fetch_from_url',
  acceptedMime: ['image/jpeg'],
  // Docs are explicit: JPEG only. PNG/WebP/HEIC are rejected.
  maxBytes: 8 * 1024 * 1024,
  aspectRatios: ['4:5', '1:1', '1.91:1'],
  nativeScheduling: false,
  remoteIdOnPublish: true,
  actions: [
    {
      action: 'single_image_post',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Professional (Business or Creator) account required. Image must be a public JPEG URL — Meta fetches it.',
    },
    {
      action: 'carousel_post',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Up to 10 items. All items are cropped to the first item’s aspect ratio.',
    },
    {
      action: 'story',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Publishable, but no stickers, link stickers, polls or music are available via the API.',
    },
    {
      action: 'reel',
      status: 'SUPPORTED',
      note: 'media_type=REELS with a public video URL.',
    },
  ],
  prerequisites: [
    'Instagram must be a professional account (Business or Creator) — a personal account cannot be published to at all.',
    'A Meta app of type Business.',
    'App Review + Business Verification for Advanced Access before serving accounts you do not own.',
    'Facebook Login for Business config additionally requires the IG account linked to a Facebook Page, Page Publishing Authorization, and MANAGE or CREATE_CONTENT on that Page.',
    'MAPCO must be able to expose the approved creative at a public HTTPS URL long enough for Meta to fetch it.',
  ],
  caveats: [
    'Meta’s own docs contradict each other on the publishing limit (100 in the guide vs 50 in the reference). Treat 50 per rolling 24h as the ceiling and read the live value from the content_publishing_limit edge.',
    'Media containers expire after 24 hours and there is no webhook — publication completion must be polled.',
    'media_type=VIDEO for a plain feed video is no longer documented; feed video is effectively Reels.',
  ],
};

/* ── Facebook Page ───────────────────────────────────────────────
   The most permissive of the three: accepts a direct binary upload
   AND supports native scheduling.
   ─────────────────────────────────────────────────────────────── */
const FACEBOOK_PAGE: ChannelCapabilities = {
  channel: 'facebook_page',
  mediaIngest: 'either',
  acceptedMime: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'],
  maxBytes: 10 * 1024 * 1024,
  nativeScheduling: true,
  remoteIdOnPublish: true,
  actions: [
    {
      action: 'single_image_post',
      status: 'SUPPORTED',
      note: 'POST to the Page’s photos edge, with either a hosted URL or a direct multipart upload.',
    },
    {
      action: 'carousel_post',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Two-step: upload each photo unpublished, then attach them to a feed post.',
    },
    {
      action: 'reel',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Separate three-phase upload API, with its own limit of 30 API-published reels per 24 hours.',
    },
    {
      action: 'story',
      status: 'NEEDS_VERIFICATION',
      note: 'Page Stories exist as an API surface but were not verified for this milestone.',
    },
  ],
  prerequisites: [
    'The authorising user must be able to perform the CREATE_CONTENT task on the Page.',
    'Scopes: pages_manage_posts, pages_read_engagement, pages_show_list.',
    'Advanced Access (per-permission App Review) + Business Verification.',
    'Tech Provider status is additionally required to serve other businesses’ Pages.',
  ],
  caveats: [
    'There is no refresh-token grant. A short-lived user token is exchanged for a ~60-day long-lived user token, which is then used to obtain a non-expiring Page token. If the user token lapses the dealer must re-authenticate.',
    'Calling the accounts edge with a SHORT-lived user token yields a SHORT-lived Page token — a very common integration bug.',
    'PNG is accepted but Meta recommends staying under 1MB or the image may look pixelated.',
    'The docs disagree with themselves on the scheduling window (29/30/75 days depending on the page).',
  ],
};

/* ── Google Business Profile ─────────────────────────────────────
   Local Posts still live on the LEGACY v4.9 API, and the API is not
   open to the public — a project must be approved before it can even
   see the API.
   ─────────────────────────────────────────────────────────────── */
const GOOGLE_BUSINESS: ChannelCapabilities = {
  channel: 'google_business',
  mediaIngest: 'fetch_from_url',
  acceptedMime: ['image/jpeg', 'image/png'],
  maxBytes: 5 * 1024 * 1024,
  nativeScheduling: true,
  remoteIdOnPublish: true,
  actions: [
    {
      action: 'local_post',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Standard local post with media, summary and a call-to-action. Publication is moderated and asynchronous — state must be polled.',
    },
    {
      action: 'single_image_post',
      status: 'SUPPORTED_WITH_REQUIREMENTS',
      note: 'Same as a local post; the image must be supplied as a public URL.',
    },
  ],
  prerequisites: [
    'The API is not open to the public. A Google Cloud project must be approved via the Business Profile API application (review takes up to ~14 days); an unapproved project has 0 QPM.',
    'The Business Profile must be verified AND active for 60+ days, with a live website.',
    'OAuth scope business.manage, plus OAuth app verification for that sensitive scope.',
    'MAPCO must expose the creative at a public URL — byte upload is not available for post media.',
  ],
  caveats: [
    'Per-post insights were discontinued in 2023 with no replacement. Post-level engagement numbers cannot be reported.',
    'Publication is moderated: a 200 does not mean live. Poll for LIVE or REJECTED.',
    'Policy forbids a phone number in the post body — use the CALL action instead. This is a frequent silent rejection.',
    'Resource-name mismatch: the modern v1 API returns locations/{id} but posts require accounts/{aid}/locations/{lid}. The account id must be stored alongside every location.',
    'No documented character limit for the post summary — the widely quoted 1,500 is not in Google’s docs. Truncate defensively.',
    'Hotels/lodging cannot run OFFER posts, and regulated categories may not carry a CTA.',
  ],
};

/* ── WhatsApp Business ───────────────────────────────────────────
   NOT VERIFIED IN THIS MILESTONE. The research pass did not complete.

   Per the explicit product instruction, WhatsApp **Status** publishing
   is treated as NOT AVAILABLE until proven otherwise in official Meta
   documentation. MAPCO will never automate it through unofficial means
   — no browser automation, no WhatsApp Web scraping, no reverse-
   engineered endpoints.
   ─────────────────────────────────────────────────────────────── */
const WHATSAPP_BUSINESS: ChannelCapabilities = {
  channel: 'whatsapp_business',
  mediaIngest: 'not_applicable',
  acceptedMime: ['image/jpeg', 'image/png'],
  nativeScheduling: false,
  remoteIdOnPublish: false,
  actions: [
    {
      action: 'status_broadcast',
      status: 'NOT_SUPPORTED',
      note: 'No official Meta API publishes to WhatsApp Status. Share the creative manually from the phone.',
    },
    {
      action: 'direct_message',
      status: 'NEEDS_VERIFICATION',
      note: 'The Cloud API can send media messages, but only to opted-in recipients under Meta’s messaging rules. Not verified for this milestone and not enabled.',
    },
  ],
  prerequisites: [
    'Not applicable until the messaging workflow is verified and a consent/opt-in model is designed.',
  ],
  caveats: [
    'VERIFICATION INCOMPLETE — the WhatsApp research pass did not finish. Both capabilities above must be re-checked against official Meta documentation before any adapter ships.',
    'Status publishing and business messaging are entirely different products. Messaging requires recipient opt-in and is governed by the 24-hour customer service window and template rules; it is NOT a broadcast channel for marketing creatives.',
  ],
};

const PROFILES: Record<ChannelId, ChannelCapabilities> = {
  instagram: INSTAGRAM,
  facebook_page: FACEBOOK_PAGE,
  google_business: GOOGLE_BUSINESS,
  whatsapp_business: WHATSAPP_BUSINESS,
};

export const capabilitiesFor = (channel: ChannelId): ChannelCapabilities => PROFILES[channel];
export const allCapabilities = (): readonly ChannelCapabilities[] => Object.values(PROFILES);

/** Channels that can genuinely publish a still image automatically today. */
export const automatableChannels = (): readonly ChannelId[] =>
  allCapabilities()
    .filter((c) => c.actions.some((a) =>
      (a.action === 'single_image_post' || a.action === 'local_post')
      && (a.status === 'SUPPORTED' || a.status === 'SUPPORTED_WITH_REQUIREMENTS')))
    .map((c) => c.channel);

/** True when MAPCO must expose the asset at a public URL for this channel. */
export const needsPublicUrl = (channel: ChannelId): boolean =>
  PROFILES[channel].mediaIngest === 'fetch_from_url';
