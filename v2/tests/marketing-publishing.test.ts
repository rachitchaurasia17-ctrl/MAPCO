import { describe, expect, it } from 'vitest';
import {
  capabilitiesFor, allCapabilities, automatableChannels, needsPublicUrl,
  validateCaption, validateForChannels, buildContent, renderCaptionFor,
  containsPhoneNumber, CAPTION_RULES,
  credentialRefFor, isValidCredentialRef, credentialsAvailable,
  findSecretLeaks, containsSecret, needsRefresh,
  UnconfiguredCredentialStore, CredentialStoreNotConfigured,
  planPublications, dueSchedules, applyResult, isExhausted, displayFor, defaultActionFor,
  adapterFor, publishingEnabled,
  toClientSafeConnection, publicationKey, backoffSeconds, isRetryable, supports,
  MAX_ATTEMPTS,
  type ChannelConnection, type DealerPublishingSettings, type PublicationSchedule,
  type CanonicalCreative,
} from '../src/packages/marketing/publishing';

const A = 'dealer-1';
const B = 'dealer-2';
const WEEK = '2026-W34';

const connected = (dealerId: string, channel: Parameters<typeof capabilitiesFor>[0]): ChannelConnection => ({
  dealerId, channel, status: 'connected',
  externalAccountRef: channel === 'google_business' ? 'accounts/1/locations/2' : 'ig-123',
  displayName: '@abcproperties',
  credentialRef: credentialRefFor(dealerId, channel),
  scopes: ['publish'],
  connectedAt: '2026-08-01T00:00:00Z',
});

const settings = (over: Partial<DealerPublishingSettings> = {}): DealerPublishingSettings => ({
  dealerId: A, timezone: 'Asia/Kolkata',
  channels: [
    { channel: 'instagram', enabled: true, autoPublish: true, defaultPublishTime: '10:00' },
    { channel: 'facebook_page', enabled: true, autoPublish: true },
    { channel: 'google_business', enabled: false, autoPublish: false },
    { channel: 'whatsapp_business', enabled: true, autoPublish: true },
  ],
  ...over,
});

const approved = {
  dealerId: A, weekId: WEEK, slotRef: 'C001',
  creativeAssetId: 'asset-1', slotStatus: 'approved', localDate: '2026-08-20',
};

const creative: CanonicalCreative = {
  assetId: 'asset-1', dealerId: A, slotRef: 'C001',
  bucket: 'marketing-creatives', path: 'dealers/dealer-1/C001.jpg',
  mime: 'image/jpeg', bytes: 900_000, width: 1080, height: 1350,
};

describe('verified capability profiles', () => {
  it('marks WhatsApp Status as NOT supported — never automatic', () => {
    const wa = capabilitiesFor('whatsapp_business');
    const status = wa.actions.find((a) => a.action === 'status_broadcast')!;
    expect(status.status).toBe('NOT_SUPPORTED');
    expect(supports(wa, 'status_broadcast')).toBe(false);
    expect(status.note).toMatch(/no official/i);
  });

  it('records that Instagram fetches media and cannot take an upload', () => {
    expect(capabilitiesFor('instagram').mediaIngest).toBe('fetch_from_url');
    expect(needsPublicUrl('instagram')).toBe(true);
    // Facebook is the one that accepts a direct upload.
    expect(needsPublicUrl('facebook_page')).toBe(false);
    expect(needsPublicUrl('google_business')).toBe(true);
  });

  it('records that Instagram has no native scheduling but Facebook does', () => {
    expect(capabilitiesFor('instagram').nativeScheduling).toBe(false);
    expect(capabilitiesFor('facebook_page').nativeScheduling).toBe(true);
    expect(capabilitiesFor('google_business').nativeScheduling).toBe(true);
  });

  it('records Instagram as JPEG-only', () => {
    expect(capabilitiesFor('instagram').acceptedMime).toEqual(['image/jpeg']);
  });

  it('lists the channels that can genuinely be automated today', () => {
    const auto = automatableChannels();
    expect(auto).toContain('instagram');
    expect(auto).toContain('facebook_page');
    expect(auto).toContain('google_business');
    expect(auto).not.toContain('whatsapp_business');
  });

  it('carries prerequisites and honest caveats on every profile', () => {
    for (const c of allCapabilities()) {
      expect(c.prerequisites.length + c.caveats.length).toBeGreaterThan(0);
    }
    expect(capabilitiesFor('whatsapp_business').caveats.join(' ')).toMatch(/VERIFICATION INCOMPLETE/);
  });
});

describe('captions written by the team at upload time', () => {
  it('accepts a blank caption and never invents one', () => {
    expect(validateCaption('instagram', {})).toHaveLength(0);
    expect(buildContent({ caption: '   ' }).caption).toBeUndefined();
  });

  it('rejects a phone number for Google Business — a real silent rejection', () => {
    const problems = validateCaption('google_business', { caption: 'Call us on +91 98765 43210 today' });
    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toMatch(/phone number/i);
    // The same caption is fine on Instagram.
    expect(validateCaption('instagram', { caption: 'Call us on +91 98765 43210 today' })).toHaveLength(0);
  });

  it('detects Indian phone shapes', () => {
    expect(containsPhoneNumber('+91 98765 43210')).toBe(true);
    expect(containsPhoneNumber('9876543210')).toBe(true);
    expect(containsPhoneNumber('98765 43210')).toBe(true);
    expect(containsPhoneNumber('500 sq yd, north facing')).toBe(false);
  });

  it('enforces Instagram caption length and hashtag ceiling', () => {
    const long = 'x'.repeat(CAPTION_RULES.instagram.maxLength + 1);
    expect(validateCaption('instagram', { caption: long })[0]!.code).toBe('INVALID_CAPTION');
    const tags = Array.from({ length: 31 }, (_, i) => `tag${i}`);
    const problems = validateCaption('instagram', { caption: 'hello', hashtags: tags });
    expect(problems.some((p) => p.field === 'hashtags')).toBe(true);
  });

  it('says when a cap is defensive rather than official', () => {
    const problems = validateCaption('google_business', { caption: 'y'.repeat(2000) });
    expect(problems[0]!.message).toMatch(/no official limit/i);
  });

  it('validates one caption across every automatable channel at once', () => {
    const problems = validateForChannels(automatableChannels(), buildContent({ caption: 'Ring +91 98765 43210' }));
    expect(problems.some((p) => p.channel === 'google_business')).toBe(true);
    expect(problems.some((p) => p.channel === 'instagram')).toBe(false);
  });

  it('truncates only when the platform would reject, and reports it', () => {
    const short = renderCaptionFor('instagram', { caption: 'Sector 82 plot' });
    expect(short.truncated).toBe(false);
    const long = renderCaptionFor('instagram', { caption: 'z'.repeat(3000) });
    expect(long.truncated).toBe(true);
    expect(long.text.length).toBeLessThanOrEqual(CAPTION_RULES.instagram.maxLength);
    expect(long.originalLength).toBe(3000);
  });

  it('keeps hashtags out of the Google Business summary', () => {
    const rendered = renderCaptionFor('google_business', { summary: 'Plot in Sector 82', hashtags: ['mohali'] });
    expect(rendered.text).not.toContain('#mohali');
  });
});

describe('credential boundary', () => {
  it('never ships a usable credential store in this milestone', async () => {
    const store = new UnconfiguredCredentialStore();
    expect(credentialsAvailable(store)).toBe(false);
    await store.put(credentialRefFor(A, 'instagram'), 'super-secret', {
      dealerId: A, channel: 'instagram', scopes: [],
    });
    // Metadata survives; the value is discarded and unreadable.
    expect(await store.describe(credentialRefFor(A, 'instagram'))).not.toBeNull();
    await expect(store.read(credentialRefFor(A, 'instagram')))
      .rejects.toBeInstanceOf(CredentialStoreNotConfigured);
  });

  it('builds a dealer-scoped, non-secret credential ref', () => {
    const ref = credentialRefFor(A, 'instagram');
    expect(ref).toBe('mapco:dealer-1:instagram:access');
    expect(isValidCredentialRef(ref)).toBe(true);
    expect(ref).not.toContain('token');
  });

  it('detects a secret leaking into any object', () => {
    expect(containsSecret({ a: { accessToken: 'x' } })).toBe(true);
    expect(containsSecret({ a: { refresh_token: 'x' } })).toBe(true);
    expect(containsSecret({ a: { client_secret: 'x' } })).toBe(true);
    // A REFERENCE is a name, not a secret.
    expect(containsSecret({ credentialRef: 'mapco:d:instagram:access' })).toBe(false);
    expect(findSecretLeaks({ nested: { deep: { apiKey: 'x' } } })[0]!.key).toBe('apiKey');
  });

  it('never exposes a secret in the client-safe projection', () => {
    const withSecret = { ...connected(A, 'instagram'), accessToken: 'LEAK' } as never;
    const safe = toClientSafeConnection(withSecret);
    expect(containsSecret(safe)).toBe(false);
    expect(JSON.stringify(safe)).not.toContain('LEAK');
    expect(JSON.stringify(safe)).not.toContain('mapco:dealer-1');
  });

  it('turns an expired connection into an actionable message, not a raw error', () => {
    const safe = toClientSafeConnection({ ...connected(A, 'instagram'), status: 'expired' });
    expect(safe.actionRequired).toMatch(/reconnect/i);
  });

  it('flags a credential approaching expiry for proactive refresh', () => {
    const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    expect(needsRefresh({ ref: 'r', dealerId: A, channel: 'instagram', scopes: [], expiresAt: soon })).toBe(true);
    const far = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString();
    expect(needsRefresh({ ref: 'r', dealerId: A, channel: 'instagram', scopes: [], expiresAt: far })).toBe(false);
  });
});

describe('scheduling from one approved creative', () => {
  const context = {
    settings: settings(),
    connections: [connected(A, 'instagram'), connected(A, 'facebook_page'), connected(A, 'whatsapp_business')],
    capabilities: allCapabilities(),
    existing: [] as PublicationSchedule[],
  };

  it('creates a schedule per enabled, connected, capable channel', () => {
    const decisions = planPublications(approved, context);
    const created = decisions.filter((d) => d.created);
    expect(created.map((d) => d.channel).sort()).toEqual(['facebook_page', 'instagram']);
  });

  it('refuses to schedule anything for an unapproved creative', () => {
    const decisions = planPublications({ ...approved, slotStatus: 'uploaded' }, context);
    expect(decisions.every((d) => !d.created)).toBe(true);
    expect(decisions[0]!.reason).toMatch(/not been approved/i);
  });

  it('skips a disabled channel', () => {
    const gbp = planPublications(approved, context).find((d) => d.channel === 'google_business')!;
    expect(gbp.created).toBe(false);
    expect(gbp.reason).toMatch(/switched off/i);
  });

  it('never schedules WhatsApp Status as automatic publishing', () => {
    const wa = planPublications(approved, context).find((d) => d.channel === 'whatsapp_business')!;
    expect(wa.created).toBe(false);
    expect(wa.reason).toMatch(/no official/i);
  });

  it('skips a channel with no connected account', () => {
    const decisions = planPublications(approved, { ...context, connections: [] });
    expect(decisions.filter((d) => d.created)).toHaveLength(0);
    expect(decisions.find((d) => d.channel === 'instagram')!.reason).toMatch(/no account connected/i);
  });

  it('is idempotent — re-planning never duplicates a schedule', () => {
    const first = planPublications(approved, context).filter((d) => d.created).map((d) => d.schedule!);
    const second = planPublications(approved, { ...context, existing: first });
    expect(second.filter((d) => d.created)).toHaveLength(0);
    expect(second.find((d) => d.channel === 'instagram')!.reason).toMatch(/already scheduled/i);
  });

  it('gives every schedule a stable dealer-scoped idempotency key', () => {
    const key = publicationKey(A, 'C001', 'instagram', WEEK);
    expect(key).toBe('dealer-1::2026-W34::C001::instagram');
    // Another dealer's identical slot is a different identity.
    expect(publicationKey(B, 'C001', 'instagram', WEEK)).not.toBe(key);
  });
});

describe('publish results, retries and idempotency', () => {
  const base: PublicationSchedule = {
    id: 'k', dealerId: A, channel: 'instagram', slotRef: 'C001',
    creativeAssetId: 'asset-1', scheduledFor: '2026-08-20T10:00:00Z',
    state: 'scheduled', idempotencyKey: 'k', attempts: 0,
  };

  it('records a remote id and marks published', () => {
    const next = applyResult(base, {
      ok: true, remoteId: 'ig_17900', remoteUrl: 'https://instagram.com/p/x', publishedAt: 'now',
    });
    expect(next.state).toBe('published');
    expect(next.remoteId).toBe('ig_17900');
  });

  it('never claims published without a remote id', () => {
    const next = applyResult(base, { ok: true, remoteId: '', publishedAt: 'now' } as never);
    expect(next.state).toBe('failed');
    expect(next.lastErrorCode).toBe('UNKNOWN_REMOTE_STATE');
  });

  it('a retry can never re-publish something already published', () => {
    const published = { ...base, state: 'published' as const, remoteId: 'ig_1', attempts: 1 };
    const again = applyResult(published, { ok: true, remoteId: 'ig_2', publishedAt: 'now' });
    expect(again).toBe(published);          // untouched
    expect(again.remoteId).toBe('ig_1');    // no duplicate post
  });

  it('schedules a retry for a temporary error, with backoff', () => {
    const next = applyResult(base, {
      ok: false, code: 'RATE_LIMITED', message: 'slow down', retryable: true,
    });
    expect(next.state).toBe('failed');
    expect(next.nextAttemptAt).toBeDefined();
    expect(isExhausted(next)).toBe(false);
    expect(backoffSeconds(0)).toBeLessThan(backoffSeconds(3));
  });

  it('stops permanently on a permanent error', () => {
    for (const code of ['INVALID_MEDIA', 'PERMISSION_DENIED', 'ACCOUNT_NOT_ELIGIBLE', 'REMOTE_REJECTED'] as const) {
      const next = applyResult(base, { ok: false, code, message: 'no', retryable: false });
      expect(next.nextAttemptAt).toBeUndefined();
      expect(isExhausted(next)).toBe(true);
      expect(isRetryable(code)).toBe(false);
    }
  });

  it('gives up after the attempt ceiling', () => {
    let s: PublicationSchedule = { ...base, attempts: MAX_ATTEMPTS - 1 };
    s = applyResult(s, { ok: false, code: 'TEMPORARY_PROVIDER_ERROR', message: 'x', retryable: true });
    expect(s.attempts).toBe(MAX_ATTEMPTS);
    expect(isExhausted(s)).toBe(true);
  });

  it('only makes due what is genuinely due', () => {
    const now = new Date('2026-08-20T11:00:00Z');
    const due = dueSchedules([
      base,                                                            // scheduled, past → due
      { ...base, id: 'b', scheduledFor: '2026-08-21T10:00:00Z' },       // future → not due
      { ...base, id: 'c', state: 'failed', attempts: 1, nextAttemptAt: '2026-08-20T10:30:00Z' }, // retry due
      { ...base, id: 'd', state: 'published', remoteId: 'x' },          // terminal
    ], now);
    expect(due.map((s) => s.id).sort()).toEqual(['c', 'k']);
  });
});

describe('truthful UI states', () => {
  it('shows WhatsApp as manual, never as scheduled', () => {
    const d = displayFor('whatsapp_business', capabilitiesFor('whatsapp_business'),
      connected(A, 'whatsapp_business'), undefined, 'WhatsApp');
    expect(d.state).toBe('manual_required');
    expect(d.line).toMatch(/manual share/i);
  });

  it('asks for reconnection when a token expired', () => {
    const d = displayFor('instagram', capabilitiesFor('instagram'),
      { ...connected(A, 'instagram'), status: 'expired' }, undefined, 'Instagram');
    expect(d.action).toMatch(/reconnect/i);
  });

  it('shows Posted only for a genuine remote id', () => {
    const published: PublicationSchedule = {
      id: 'k', dealerId: A, channel: 'instagram', slotRef: 'C001', creativeAssetId: 'a',
      scheduledFor: 'x', state: 'published', idempotencyKey: 'k', attempts: 1, remoteId: 'ig_1',
    };
    expect(displayFor('instagram', capabilitiesFor('instagram'), connected(A, 'instagram'), published, 'Instagram').line)
      .toBe('Posted');
  });

  it('gives an actionable reason for a permanent failure', () => {
    const failed: PublicationSchedule = {
      id: 'k', dealerId: A, channel: 'google_business', slotRef: 'C001', creativeAssetId: 'a',
      scheduledFor: 'x', state: 'failed', idempotencyKey: 'k', attempts: MAX_ATTEMPTS,
      lastErrorCode: 'INVALID_MEDIA',
    };
    const d = displayFor('google_business', capabilitiesFor('google_business'),
      connected(A, 'google_business'), failed, 'Google Business');
    expect(d.line).toMatch(/failed/i);
    expect(d.action).toMatch(/replace the creative/i);
  });
});

describe('adapters refuse rather than fake', () => {
  it('publishing is disabled in this milestone', () => {
    expect(publishingEnabled()).toBe(false);
  });

  it('every adapter throws rather than fabricating a post', async () => {
    for (const channel of ['instagram', 'facebook_page', 'google_business'] as const) {
      await expect(adapterFor(channel).publish({} as never))
        .rejects.toBeInstanceOf(CredentialStoreNotConfigured);
    }
  });

  it('WhatsApp returns an honest refusal instead of throwing', async () => {
    const result = await adapterFor('whatsapp_business').publish({} as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.message).toMatch(/no official publishing api/i);
    }
  });

  it('Instagram rejects a PNG creative before any network call', async () => {
    const problems = await adapterFor('instagram')
      .validateCreative({ ...creative, mime: 'image/png' }, {}, 'single_image_post');
    expect(problems.some((p) => p.code === 'INVALID_MEDIA')).toBe(true);
  });

  it('Google Business requires a selected location', async () => {
    const problems = await adapterFor('google_business')
      .validateConnection({ ...connected(A, 'google_business'), externalAccountRef: 'accounts/1' });
    expect(problems.some((p) => p.code === 'ACCOUNT_NOT_ELIGIBLE')).toBe(true);
  });

  it('validates the team’s caption as part of creative validation', async () => {
    const problems = await adapterFor('google_business')
      .validateCreative(creative, { caption: 'Call +91 98765 43210' }, 'local_post');
    expect(problems.some((p) => p.code === 'INVALID_CAPTION')).toBe(true);
  });

  it('records any transformation rather than silently converting', async () => {
    const prepared = await adapterFor('instagram').prepareAsset({ ...creative, mime: 'image/png' }, 'single_image_post');
    expect(prepared.transformations.join(' ')).toMatch(/convert image\/png/);
    expect(prepared.sourceAssetId).toBe(creative.assetId);
  });

  it('classifies provider errors into MAPCO’s vocabulary', () => {
    const a = adapterFor('instagram');
    expect(a.classifyError(new Error('HTTP 429 rate limit'))).toBe('RATE_LIMITED');
    expect(a.classifyError(new Error('invalid token'))).toBe('AUTH_REQUIRED');
    expect(a.classifyError(new Error('missing scope'))).toBe('PERMISSION_DENIED');
    expect(a.classifyError(new Error('gateway timeout'))).toBe('TEMPORARY_PROVIDER_ERROR');
  });
});

describe('multi-dealer isolation', () => {
  it('never plans a publication using another dealer’s connection', () => {
    const decisions = planPublications(approved, {
      settings: settings(),
      connections: [connected(B, 'instagram'), connected(B, 'facebook_page')],
      capabilities: allCapabilities(),
      existing: [],
    });
    expect(decisions.filter((d) => d.created)).toHaveLength(0);
  });

  it('scopes credential refs per dealer', () => {
    expect(credentialRefFor(A, 'instagram')).not.toBe(credentialRefFor(B, 'instagram'));
  });

  it('gives each channel the right default action', () => {
    expect(defaultActionFor('google_business')).toBe('local_post');
    expect(defaultActionFor('instagram')).toBe('single_image_post');
    expect(defaultActionFor('whatsapp_business')).toBe('status_broadcast');
  });
});
