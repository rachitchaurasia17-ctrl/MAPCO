/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — captions

   The internal team writes the caption at upload time, alongside the
   finished image, so that when automatic distribution is switched on
   the post text is already done and nothing has to be written twice.

   MAPCO does NOT generate captions in this milestone. If the team
   leaves it blank, it stays blank — nothing is invented.

   What MAPCO does do is validate the caption against each platform's
   CURRENT documented rules before publication, because the failure
   modes are real and silent:
     • Google Business rejects a post containing a phone number
     • Instagram caps hashtags and caption length
     • an over-length caption is a hard publish failure, not a warning
   ═══════════════════════════════════════════════════════════════ */
import type { ChannelId, PublicationContent, PublishErrorCode, ValidationProblem } from './types';

/* Documented / defensively-chosen limits, checked 2026-08-16.
   Where a platform publishes no official limit we truncate defensively
   and say so rather than pretending to know. */
export interface CaptionRules {
  readonly maxLength: number;
  /** Null when the platform documents no limit — we still cap defensively. */
  readonly maxLengthIsOfficial: boolean;
  readonly maxHashtags?: number;
  /** Platform policy forbids a phone number in the post body. */
  readonly forbidsPhoneNumbers: boolean;
  readonly note: string;
}

export const CAPTION_RULES: Record<ChannelId, CaptionRules> = {
  instagram: {
    maxLength: 2200,
    maxLengthIsOfficial: true,
    maxHashtags: 30,
    forbidsPhoneNumbers: false,
    note: 'Instagram captions are capped at 2,200 characters and 30 hashtags.',
  },
  facebook_page: {
    maxLength: 5000,
    maxLengthIsOfficial: false,
    forbidsPhoneNumbers: false,
    note: 'No hard documented cap for a photo message; capped defensively at 5,000.',
  },
  google_business: {
    maxLength: 1500,
    maxLengthIsOfficial: false,
    forbidsPhoneNumbers: true,
    note: 'Google publishes no official summary limit — 1,500 is a defensive cap. Policy forbids a phone number in the post body; use the CALL action instead.',
  },
  whatsapp_business: {
    maxLength: 1024,
    maxLengthIsOfficial: false,
    forbidsPhoneNumbers: false,
    note: 'Not enabled in this milestone.',
  },
};

/** Indian and international phone shapes, deliberately broad. */
const PHONE_PATTERNS: readonly RegExp[] = [
  /\+\d[\d\s\-().]{7,}/,             // +91 98765 43210
  /\b\d{10}\b/,                      // 9876543210
  /\b\d{5}[\s-]\d{5}\b/,             // 98765 43210
  /\b0\d{2,4}[\s-]\d{6,8}\b/,        // 0172 4001200
];

export const containsPhoneNumber = (text: string): boolean =>
  PHONE_PATTERNS.some((re) => re.test(text));

export const countHashtags = (text: string): number =>
  (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

/**
 * Validate one caption for one channel. Returns problems, never throws.
 * An empty caption is NOT a problem — a creative may legitimately post
 * with no text, and MAPCO will not invent one.
 */
export function validateCaption(channel: ChannelId, content: PublicationContent): readonly ValidationProblem[] {
  const rules = CAPTION_RULES[channel];
  const problems: ValidationProblem[] = [];
  // Google Business calls it a summary; everything else uses the caption.
  const text = (channel === 'google_business' ? content.summary ?? content.caption : content.caption) ?? '';

  if (!text.trim()) return problems;   // blank is allowed

  if (text.length > rules.maxLength) {
    problems.push({
      field: 'caption',
      code: 'INVALID_CAPTION' as PublishErrorCode,
      message: `Caption is ${text.length} characters; ${channel} accepts ${rules.maxLength}.`
        + (rules.maxLengthIsOfficial ? '' : ' (defensive cap — no official limit is published)'),
    });
  }

  if (rules.maxHashtags !== undefined) {
    const tags = countHashtags(text) + (content.hashtags?.length ?? 0);
    if (tags > rules.maxHashtags) {
      problems.push({
        field: 'hashtags',
        code: 'INVALID_CAPTION' as PublishErrorCode,
        message: `${tags} hashtags; ${channel} allows ${rules.maxHashtags}.`,
      });
    }
  }

  if (rules.forbidsPhoneNumbers && containsPhoneNumber(text)) {
    problems.push({
      field: 'caption',
      code: 'INVALID_CAPTION' as PublishErrorCode,
      message: 'Google Business Profile policy forbids a phone number in the post body. '
        + 'Remove it and use the Call action instead — posts containing one are rejected.',
    });
  }

  return problems;
}

/** Validate a caption against every channel a dealer has switched on. */
export function validateForChannels(
  channels: readonly ChannelId[], content: PublicationContent,
): readonly (ValidationProblem & { channel: ChannelId })[] {
  return channels.flatMap((channel) =>
    validateCaption(channel, content).map((p) => ({ ...p, channel })));
}

/**
 * Compose the caption the team wrote into the normalised content object.
 * Hashtags are kept SEPARATE from the caption body so an adapter can
 * place them per platform convention.
 */
export function buildContent(input: {
  caption?: string;
  summary?: string;
  hashtags?: readonly string[];
  cta?: { label: string; url: string };
  link?: string;
}): PublicationContent {
  const caption = input.caption?.trim();
  return {
    ...(caption ? { caption } : {}),
    ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
    ...(input.hashtags?.length ? { hashtags: input.hashtags } : {}),
    ...(input.cta ? { cta: input.cta } : {}),
    ...(input.link ? { link: input.link } : {}),
  };
}

/**
 * The caption as it would actually be sent to one platform.
 * Truncates ONLY when the platform would reject it, and reports that it
 * did — a caption is never silently shortened.
 */
export interface RenderedCaption {
  readonly text: string;
  readonly truncated: boolean;
  readonly originalLength: number;
}

export function renderCaptionFor(channel: ChannelId, content: PublicationContent): RenderedCaption {
  const rules = CAPTION_RULES[channel];
  const body = (channel === 'google_business' ? content.summary ?? content.caption : content.caption) ?? '';
  const tags = content.hashtags?.length && channel !== 'google_business'
    ? `\n\n${content.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}`
    : '';
  const full = `${body}${tags}`;
  if (full.length <= rules.maxLength) {
    return { text: full, truncated: false, originalLength: full.length };
  }
  return {
    text: `${full.slice(0, rules.maxLength - 1)}…`,
    truncated: true,
    originalLength: full.length,
  };
}
