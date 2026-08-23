/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — publication scheduling and retry

   Provider-independent. Decides WHEN and WHETHER to publish, and what
   to do with a result. Never talks to a platform itself.

   Two invariants this file exists to guarantee:

     1. Approval is the boundary. Nothing is ever scheduled for a
        creative the internal team has not approved.
     2. A retry can never create a second external post. Every schedule
        carries a stable idempotency key, and once a remote id is
        recorded the publication is terminal.
   ═══════════════════════════════════════════════════════════════ */
import {
  MAX_ATTEMPTS, backoffSeconds, isRetryable, publicationKey, supports,
  type ChannelCapabilities, type ChannelConnection, type ChannelId,
  type DealerPublishingSettings, type PublicationSchedule, type PublicationState,
  type PublishAction, type PublishResult,
} from './types';

/** An approved creative ready to enter the publishing pipeline. */
export interface ApprovedCreativeInput {
  readonly dealerId: string;
  readonly weekId: string;
  readonly slotRef: string;
  readonly creativeAssetId: string;
  /** Only 'approved' | 'ready' may produce schedules. */
  readonly slotStatus: string;
  readonly localDate: string;
}

export interface ScheduleContext {
  readonly settings: DealerPublishingSettings;
  readonly connections: readonly ChannelConnection[];
  readonly capabilities: readonly ChannelCapabilities[];
  /** Existing schedules — used so re-running never duplicates. */
  readonly existing: readonly PublicationSchedule[];
}

export interface ScheduleDecision {
  readonly channel: ChannelId;
  readonly created: boolean;
  readonly reason: string;
  readonly schedule?: PublicationSchedule;
}

const APPROVED_STATUSES = ['approved', 'ready'];

/** The action a channel uses for a still-image creative. */
export function defaultActionFor(channel: ChannelId): PublishAction {
  switch (channel) {
    case 'google_business': return 'local_post';
    case 'whatsapp_business': return 'status_broadcast';
    default: return 'single_image_post';
  }
}

/**
 * Turn ONE approved creative into zero or more channel schedules.
 *
 * A channel is skipped — with a stated reason — when it is disabled,
 * not connected, lacks the capability, or already has a schedule.
 */
export function planPublications(
  creative: ApprovedCreativeInput, context: ScheduleContext, now: Date = new Date(),
): readonly ScheduleDecision[] {
  const decisions: ScheduleDecision[] = [];

  // Invariant 1: approval is the boundary.
  if (!APPROVED_STATUSES.includes(creative.slotStatus)) {
    return context.settings.channels.map((c) => ({
      channel: c.channel,
      created: false,
      reason: 'The creative has not been approved yet.',
    }));
  }

  for (const setting of context.settings.channels) {
    const channel = setting.channel;
    const capability = context.capabilities.find((c) => c.channel === channel);
    const connection = context.connections.find(
      (c) => c.channel === channel && c.dealerId === creative.dealerId);
    const action = defaultActionFor(channel);

    if (!setting.enabled) {
      decisions.push({ channel, created: false, reason: 'Channel is switched off for this dealer.' });
      continue;
    }
    if (!capability) {
      decisions.push({ channel, created: false, reason: 'No capability profile for this channel.' });
      continue;
    }
    if (!supports(capability, action)) {
      const note = capability.actions.find((a) => a.action === action)?.note
        ?? 'This platform has no official API for that.';
      decisions.push({ channel, created: false, reason: note });
      continue;
    }
    if (!connection || connection.status !== 'connected') {
      decisions.push({
        channel, created: false,
        reason: connection
          ? `Account is ${connection.status} — reconnect before publishing.`
          : 'No account connected for this channel.',
      });
      continue;
    }

    const key = publicationKey(creative.dealerId, creative.slotRef, channel, creative.weekId);
    // Invariant 2: never create a second schedule for the same identity.
    if (context.existing.some((e) => e.idempotencyKey === key)) {
      decisions.push({ channel, created: false, reason: 'Already scheduled.' });
      continue;
    }

    decisions.push({
      channel,
      created: true,
      reason: setting.autoPublish
        ? 'Scheduled for automatic publishing.'
        : 'Scheduled — awaiting the dealer’s publish approval.',
      schedule: {
        id: key,
        dealerId: creative.dealerId,
        channel,
        slotRef: creative.slotRef,
        creativeAssetId: creative.creativeAssetId,
        scheduledFor: scheduledTime(creative.localDate, setting.defaultPublishTime, now),
        state: setting.autoPublish ? 'scheduled' : 'pending',
        idempotencyKey: key,
        attempts: 0,
      },
    });
  }

  return decisions;
}

function scheduledTime(localDate: string, atLocal: string | undefined, now: Date): string {
  const time = atLocal && /^\d{2}:\d{2}$/.test(atLocal) ? atLocal : '10:00';
  const candidate = new Date(`${localDate}T${time}:00Z`);
  // A time already past today publishes at the next opportunity, not retroactively.
  return candidate.getTime() < now.getTime() ? now.toISOString() : candidate.toISOString();
}

/* ── due selection ───────────────────────────────────────────── */

/** Schedules a worker should attempt now. */
export function dueSchedules(
  schedules: readonly PublicationSchedule[], now: Date = new Date(),
): readonly PublicationSchedule[] {
  const iso = now.toISOString();
  return schedules.filter((s) => {
    if (s.state === 'scheduled') return s.scheduledFor <= iso;
    // A failed-but-retryable schedule becomes due again after its backoff.
    if (s.state === 'failed' && s.nextAttemptAt && s.attempts < MAX_ATTEMPTS) {
      return s.nextAttemptAt <= iso;
    }
    return false;
  });
}

/* ── applying a result ───────────────────────────────────────── */

/**
 * Fold a publish result into the schedule.
 *
 * 'published' is only ever set when the provider genuinely returned a
 * remote id — an attempted HTTP request is not a publication.
 */
export function applyResult(
  schedule: PublicationSchedule, result: PublishResult, now: Date = new Date(),
): PublicationSchedule {
  // Terminal: never re-publish something that already succeeded.
  if (schedule.state === 'published' && schedule.remoteId) return schedule;

  const attempts = schedule.attempts + 1;

  if (result.ok) {
    if (!result.remoteId) {
      // Defensive: a success without an id is an unknown remote state.
      return {
        ...schedule, attempts, state: 'failed',
        lastErrorCode: 'UNKNOWN_REMOTE_STATE',
        lastErrorMessage: 'The platform accepted the request but returned no post id.',
        nextAttemptAt: new Date(now.getTime() + backoffSeconds(attempts) * 1000).toISOString(),
      };
    }
    return {
      ...schedule, attempts, state: 'published',
      remoteId: result.remoteId,
      ...(result.remoteUrl ? { remoteUrl: result.remoteUrl } : {}),
      nextAttemptAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
    };
  }

  const retry = result.retryable && isRetryable(result.code) && attempts < MAX_ATTEMPTS;
  const waitSeconds = result.retryAfterSeconds ?? backoffSeconds(attempts);
  return {
    ...schedule,
    attempts,
    state: 'failed',
    lastErrorCode: result.code,
    lastErrorMessage: result.message,
    ...(retry
      ? { nextAttemptAt: new Date(now.getTime() + waitSeconds * 1000).toISOString() }
      : { nextAttemptAt: undefined }),
  };
}

/** True when this schedule has permanently stopped trying. */
export const isExhausted = (s: PublicationSchedule): boolean =>
  s.state === 'failed' && (!s.nextAttemptAt || s.attempts >= MAX_ATTEMPTS);

/* ── UI projection ───────────────────────────────────────────── */

export interface ChannelDisplay {
  readonly channel: ChannelId;
  readonly label: string;
  readonly state: PublicationState | 'not_configured';
  /** Short, truthful line for the operator or dealer. */
  readonly line: string;
  /** Present when a human must do something. */
  readonly action?: string;
}

/**
 * What Marketing shows per channel. Never claims a post exists without a
 * remote id, and never presents an unsupported capability as automatic.
 */
export function displayFor(
  channel: ChannelId,
  capability: ChannelCapabilities | undefined,
  connection: ChannelConnection | undefined,
  schedule: PublicationSchedule | undefined,
  label: string,
): ChannelDisplay {
  const action = defaultActionFor(channel);

  if (capability && !supports(capability, action)) {
    const note = capability.actions.find((a) => a.action === action)?.note ?? '';
    return {
      channel, label, state: 'manual_required',
      line: 'Manual share — no official API for this',
      action: note || 'Download the creative and share it manually',
    };
  }
  if (!connection || connection.status === 'disconnected') {
    return { channel, label, state: 'not_configured', line: 'Not connected', action: 'Connect account' };
  }
  if (connection.status === 'expired' || connection.status === 'revoked') {
    return { channel, label, state: 'not_configured', line: 'Reconnect account', action: 'Reconnect account' };
  }
  if (!schedule) {
    return { channel, label, state: 'pending', line: 'Ready to publish' };
  }
  switch (schedule.state) {
    case 'published':
      return { channel, label, state: 'published', line: 'Posted' };
    case 'publishing':
      return { channel, label, state: 'publishing', line: 'Publishing…' };
    case 'scheduled':
      return { channel, label, state: 'scheduled', line: 'Scheduled' };
    case 'failed': {
      const permanent = isExhausted(schedule);
      return {
        channel, label, state: 'failed',
        line: permanent ? `Failed — ${schedule.lastErrorCode ?? 'error'}` : 'Retrying…',
        ...(permanent ? { action: reconnectHint(schedule.lastErrorCode) } : {}),
      };
    }
    default:
      return { channel, label, state: schedule.state, line: 'Ready to publish' };
  }
}

function reconnectHint(code: PublicationSchedule['lastErrorCode']): string {
  switch (code) {
    case 'AUTH_REQUIRED': return 'Reconnect account';
    case 'PERMISSION_DENIED': return 'Reconnect and grant the missing permission';
    case 'INVALID_MEDIA': return 'Replace the creative — the platform rejected the image';
    case 'INVALID_CAPTION': return 'Edit the caption';
    case 'ACCOUNT_NOT_ELIGIBLE': return 'This account type cannot publish via API';
    default: return 'Review and try again';
  }
}
