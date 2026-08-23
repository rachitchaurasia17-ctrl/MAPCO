/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — publisher adapters

   ARCHITECTURE ONLY. Every `publish()` here refuses, loudly, because no
   credential store is configured and no provider credentials exist.
   That is deliberate: a stub that pretended to succeed would produce a
   fake "Posted" state, which is exactly what must never happen.

   What IS real and useful today:
     • capability reporting
     • connection validation
     • creative + caption validation against CURRENT documented rules
     • asset preparation decisions (including the public-URL problem)
     • error classification

   When credentials arrive, only `publish()` and `getPublicationStatus()`
   need bodies. Nothing else in Marketing changes.
   ═══════════════════════════════════════════════════════════════ */
import { capabilitiesFor, needsPublicUrl } from './capabilities';
import { validateCaption } from './caption';
import { CredentialStoreNotConfigured } from './credentials';
import type {
  CanonicalCreative, ChannelCapabilities, ChannelConnection, ChannelId,
  PreparedAsset, PublicationContent, PublicationState, PublishAction,
  PublishErrorCode, PublisherAdapter, PublishRequest, PublishResult, ValidationProblem,
} from './types';
import { supports } from './types';

/** Shared behaviour. A provider adapter overrides only what differs. */
abstract class BaseAdapter implements PublisherAdapter {
  abstract readonly channel: ChannelId;

  getCapabilities(): ChannelCapabilities {
    return capabilitiesFor(this.channel);
  }

  async validateConnection(connection: ChannelConnection): Promise<readonly ValidationProblem[]> {
    const problems: ValidationProblem[] = [];
    if (connection.dealerId !== connection.dealerId.trim() || !connection.dealerId) {
      problems.push({ field: 'dealerId', code: 'PERMISSION_DENIED', message: 'Missing dealer.' });
    }
    if (connection.status !== 'connected') {
      problems.push({
        field: 'connection',
        code: connection.status === 'expired' || connection.status === 'revoked'
          ? 'AUTH_REQUIRED' : 'PERMISSION_DENIED',
        message: `Account is ${connection.status}. Reconnect before publishing.`,
      });
    }
    if (!connection.credentialRef) {
      problems.push({
        field: 'credentialRef', code: 'AUTH_REQUIRED',
        message: 'No credential is associated with this connection.',
      });
    }
    return problems;
  }

  async validateCreative(
    asset: CanonicalCreative, content: PublicationContent, action: PublishAction,
  ): Promise<readonly ValidationProblem[]> {
    const caps = this.getCapabilities();
    const problems: ValidationProblem[] = [];

    if (!supports(caps, action)) {
      const note = caps.actions.find((a) => a.action === action)?.note
        ?? 'This platform has no official API for that action.';
      problems.push({ field: 'action', code: 'ACCOUNT_NOT_ELIGIBLE', message: note });
      return problems;
    }

    if (!caps.acceptedMime.includes(asset.mime)) {
      problems.push({
        field: 'mime', code: 'INVALID_MEDIA',
        message: `${this.channel} accepts ${caps.acceptedMime.join(', ')} — this creative is ${asset.mime}.`,
      });
    }
    if (caps.maxBytes && asset.bytes > caps.maxBytes) {
      problems.push({
        field: 'bytes', code: 'INVALID_MEDIA',
        message: `Image is ${(asset.bytes / 1048576).toFixed(1)} MB; the limit is ${(caps.maxBytes / 1048576).toFixed(0)} MB.`,
      });
    }
    problems.push(...validateCaption(this.channel, content));
    return problems;
  }

  async prepareAsset(asset: CanonicalCreative, _action: PublishAction): Promise<PreparedAsset> {
    const caps = this.getCapabilities();
    const transformations: string[] = [];
    // Any real conversion is recorded, never silent. Conversion itself is
    // future work — today we only decide and describe.
    if (!caps.acceptedMime.includes(asset.mime)) {
      transformations.push(`convert ${asset.mime} → ${caps.acceptedMime[0]}`);
    }
    return {
      channel: this.channel,
      sourceAssetId: asset.assetId,
      bucket: asset.bucket,
      path: asset.path,
      mime: caps.acceptedMime.includes(asset.mime) ? asset.mime : caps.acceptedMime[0]!,
      width: asset.width,
      height: asset.height,
      transformations,
      // Platforms that FETCH need a short-lived public URL. Minting it is
      // a server-side concern; the field exists so the contract is honest.
      ...(needsPublicUrl(this.channel) ? {} : {}),
    };
  }

  async publish(_request: PublishRequest): Promise<PublishResult> {
    // Never fabricate a success. No credentials exist, so nothing posted.
    throw new CredentialStoreNotConfigured();
  }

  async getPublicationStatus(_c: ChannelConnection, _remoteId: string): Promise<PublicationState> {
    throw new CredentialStoreNotConfigured();
  }

  classifyError(error: unknown): PublishErrorCode {
    const text = error instanceof Error ? error.message : String(error ?? '');
    const t = text.toLowerCase();
    if (t.includes('rate limit') || t.includes('too many requests') || t.includes('429')) return 'RATE_LIMITED';
    if (t.includes('expired') || t.includes('invalid token') || t.includes('oauth') || t.includes('401')) return 'AUTH_REQUIRED';
    if (t.includes('permission') || t.includes('scope') || t.includes('403')) return 'PERMISSION_DENIED';
    if (t.includes('timeout') || t.includes('econn') || t.includes('502') || t.includes('503')) return 'TEMPORARY_PROVIDER_ERROR';
    if (t.includes('media') || t.includes('image') || t.includes('aspect')) return 'INVALID_MEDIA';
    if (t.includes('caption') || t.includes('summary') || t.includes('text')) return 'INVALID_CAPTION';
    if (t.includes('rejected') || t.includes('policy')) return 'REMOTE_REJECTED';
    return 'UNKNOWN_REMOTE_STATE';
  }
}

/** Instagram: container → publish, image fetched from a public JPEG URL. */
export class InstagramPublisher extends BaseAdapter {
  readonly channel: ChannelId = 'instagram';

  override async validateCreative(
    asset: CanonicalCreative, content: PublicationContent, action: PublishAction,
  ): Promise<readonly ValidationProblem[]> {
    const problems = [...await super.validateCreative(asset, content, action)];
    // JPEG-only is a hard platform rule and the most common surprise.
    if (asset.mime !== 'image/jpeg') {
      problems.push({
        field: 'mime', code: 'INVALID_MEDIA',
        message: 'Instagram accepts JPEG only — PNG and WebP are rejected. The creative must be converted before publishing.',
      });
    }
    return problems;
  }
}

/** Facebook Page: accepts a direct upload and supports native scheduling. */
export class FacebookPagePublisher extends BaseAdapter {
  readonly channel: ChannelId = 'facebook_page';
}

/** Google Business Profile: moderated local post, media from a public URL. */
export class GoogleBusinessPublisher extends BaseAdapter {
  readonly channel: ChannelId = 'google_business';

  override async validateConnection(connection: ChannelConnection): Promise<readonly ValidationProblem[]> {
    const problems = [...await super.validateConnection(connection)];
    // A post cannot be addressed without accounts/{aid}/locations/{lid}.
    if (connection.status === 'connected' && !connection.externalAccountRef?.includes('locations/')) {
      problems.push({
        field: 'externalAccountRef', code: 'ACCOUNT_NOT_ELIGIBLE',
        message: 'A Business Profile location must be selected before posting.',
      });
    }
    return problems;
  }
}

/**
 * WhatsApp: Status publishing has no official API and is therefore never
 * automated. This adapter exists so the UI can show a truthful manual
 * state rather than pretending the channel is unavailable.
 */
export class WhatsAppBusinessPublisher extends BaseAdapter {
  readonly channel: ChannelId = 'whatsapp_business';

  override async publish(_request: PublishRequest): Promise<PublishResult> {
    return {
      ok: false,
      code: 'ACCOUNT_NOT_ELIGIBLE',
      message: 'WhatsApp Status has no official publishing API. Share the approved creative manually.',
      retryable: false,
    };
  }
}

const ADAPTERS: Record<ChannelId, PublisherAdapter> = {
  instagram: new InstagramPublisher(),
  facebook_page: new FacebookPagePublisher(),
  google_business: new GoogleBusinessPublisher(),
  whatsapp_business: new WhatsAppBusinessPublisher(),
};

export const adapterFor = (channel: ChannelId): PublisherAdapter => ADAPTERS[channel];
export const allAdapters = (): readonly PublisherAdapter[] => Object.values(ADAPTERS);

/** True once a real connector could actually post. False for this milestone. */
export const publishingEnabled = (): boolean => false;
