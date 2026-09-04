/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Telemetry envelope
   ---------------------------------------------------------------
   Pure, dependency-free and unit-testable. The rules here exist
   because the previous emitter dropped every event silently: names
   the database rejected, an empty dealer id, and no way to notice.

   The single most important rule is that this module mirrors what
   public.plotmap_sanitize_event_metadata() will actually keep.
   That function does not pass caller metadata through — it REBUILDS
   the object from a closed allowlist and discards the rest. If this
   module were permissive, a developer would watch a key leave the
   browser and never learn it did not arrive.

   So the key sets below are the contract, and
   tests/telemetry-contract.test.ts compares them against the
   migration SQL in both directions.
   ═══════════════════════════════════════════════════════════════ */
import {
  REPO_ERROR_CODES,
  type PresentationEventMetadata,
  type PresentationEventOutcome,
  type RepoError,
} from './contracts';

/** Owned by the system. A caller may never set these. _build, _outcome and
 *  _duration_ms are promoted into real columns by the database trigger;
 *  _dealer, _actor, _session and _ts are RPC parameters or derived from
 *  auth.uid() server-side and are never read out of metadata at all. */
export const RESERVED_EVENT_METADATA_KEYS = [
  '_build', '_outcome', '_duration_ms',
  '_dealer', '_actor', '_session', '_ts',
] as const;

/** Caller keys the database keeps as short lowercase tokens.
 *  Mirrors the first foreach block of the evidence-foundation sanitizer. */
export const EVENT_METADATA_TEXT_KEYS = [
  'flow', 'stage', 'lifecycle', 'pin_source', 'error_kind',
] as const;

/** Caller keys the database keeps as integers. */
export const EVENT_METADATA_NUMBER_KEYS = ['step', 'photo_count'] as const;

/** Caller keys the database keeps as booleans. */
export const EVENT_METADATA_BOOLEAN_KEYS = [
  'downgraded', 'has_map_placement', 'has_location', 'published', 'is_edit',
] as const;

const RESERVED = new Set<string>(RESERVED_EVENT_METADATA_KEYS);
const TEXT_KEYS = new Set<string>(EVENT_METADATA_TEXT_KEYS);
const NUMBER_KEYS = new Set<string>(EVENT_METADATA_NUMBER_KEYS);
const BOOLEAN_KEYS = new Set<string>(EVENT_METADATA_BOOLEAN_KEYS);

/** public.presentation_events_metadata_guard caps the JSON at 2048 bytes and
 *  runs a secret scan. Stay well clear of both. */
const MAX_METADATA_BYTES = 1200;

/** The sanitizer's own bounds: `^[a-z][a-z0-9_-]*$`, 40 chars. */
const TEXT_VALUE = /^[a-z][a-z0-9_-]{0,39}$/;

/** plotmap_event_metadata_has_secret() rejects the WHOLE event when any string
 *  value holds eight consecutive digits, or looks like a bearer token, a
 *  Supabase secret or a JWT. A value that would trip it is dropped here so one
 *  careless caller cannot silence the pipeline again. */
const SECRET_SHAPED =
  /(?:(?:^|\D)\d{8}(?:\D|$))|(?:bearer\s+[\w.~+/-]{12,})|(?:sb_secret_[\w-]+)|(?:eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{8,})/i;

/** Server bound on _duration_ms and presentation_events.duration_ms. */
const MAX_DURATION_MS = 86_400_000;

/** Server bound on the counting keys. */
const MAX_COUNT = 100_000;

/** The build a dealer actually ran. `^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$`
 *  server-side; a full 40-char sha is deliberately not used. */
const BUILD_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$/;

const OUTCOMES: readonly PresentationEventOutcome[] = ['started', 'completed', 'abandoned', 'failed'];

export interface EventEnvelope {
  readonly build: string;
  readonly outcome?: PresentationEventOutcome;
  readonly durationMs?: number;
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!TEXT_VALUE.test(value)) return undefined;
  if (SECRET_SHAPED.test(value)) return undefined;
  return value;
}

function safeCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  return rounded >= 0 && rounded <= MAX_COUNT ? rounded : undefined;
}

/**
 * Merge caller metadata into the system envelope.
 *
 * Caller keys are filtered exactly as the database will filter them: unknown
 * keys, wrong types, out-of-range numbers and secret-shaped strings are
 * dropped. The envelope is written last and unconditionally, so a caller
 * cannot overwrite it whatever it sends.
 */
export function buildEventMetadata(
  caller: PresentationEventMetadata | undefined,
  envelope: EventEnvelope,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};

  if (caller) {
    for (const [key, raw] of Object.entries(caller)) {
      if (RESERVED.has(key)) continue;

      if (TEXT_KEYS.has(key)) {
        const value = safeText(raw);
        if (value !== undefined) out[key] = value;
      } else if (NUMBER_KEYS.has(key)) {
        const value = safeCount(raw);
        if (value !== undefined) out[key] = value;
      } else if (BOOLEAN_KEYS.has(key)) {
        if (typeof raw === 'boolean') out[key] = raw;
      }
    }
  }

  // Envelope last. Non-negotiable.
  if (BUILD_VERSION.test(envelope.build)) out._build = envelope.build;
  if (envelope.outcome && OUTCOMES.includes(envelope.outcome)) out._outcome = envelope.outcome;
  if (typeof envelope.durationMs === 'number' && Number.isFinite(envelope.durationMs)) {
    // A NUMBER, never a string: an eight-digit duration written as text would
    // trip the server's secret scan and destroy the whole event.
    out._duration_ms = Math.min(Math.max(Math.round(envelope.durationMs), 0), MAX_DURATION_MS);
  }

  // Last-resort size fence. Drop caller keys until it fits; never the envelope.
  const callerKeys = Object.keys(out).filter((key) => !RESERVED.has(key));
  while (JSON.stringify(out).length > MAX_METADATA_BYTES && callerKeys.length) {
    delete out[callerKeys.pop() as string];
  }
  return out;
}

const ERROR_CODES = new Set<string>(REPO_ERROR_CODES);

/**
 * A stable, non-sensitive failure class — never the raw message, which can
 * carry dealer data, buyer names or Postgres internals. Anything that is not
 * one of the repository's own closed error codes becomes 'unknown', so a
 * message accidentally passed here is discarded rather than recorded.
 *
 * Accepts either a bare code or an error-shaped object carrying one.
 */
export function errorKind(input: unknown): string {
  const code: unknown =
    typeof input === 'string' ? input : (input as Partial<RepoError> | null | undefined)?.code;
  return typeof code === 'string' && ERROR_CODES.has(code) ? code : 'unknown';
}
