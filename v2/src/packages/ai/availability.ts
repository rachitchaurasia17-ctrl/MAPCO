/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Failure boundary
   ---------------------------------------------------------------
   AI is an enhancement layer. The dealer dashboard, Properties, Client
   Presentation, Client Links, MAPCO Earth, CRM workflows and the
   existing analytics must all keep working when AI is switched off,
   over quota, mid-outage, or returning nonsense.

   Every future AI surface wraps its read in `withAiFallback`. The
   contract it enforces:

     • an AI read NEVER throws into a page;
     • an AI read NEVER blocks a page — it is bounded by a timeout;
     • a failure resolves to a typed `unavailable` value that the page
       renders as "nothing to show", exactly like an empty state.

   Consequence: a page can only be broken by AI if it deliberately
   bypasses this module.
   ═══════════════════════════════════════════════════════════════ */

import type { Result } from '../data/contracts';
import { aiUnavailable, type AiAvailability, type AiUnavailableReason } from './contracts';

/** AI never holds a screen longer than this. */
export const AI_READ_TIMEOUT_MS = 6000;

function reasonFor(error: { code?: string } | undefined): AiUnavailableReason {
  switch (error?.code) {
    case 'unauthorized': return 'not_authenticated';
    case 'forbidden': return 'disabled';
    case 'rate_limited': return 'quota_exceeded';
    default: return 'error';
  }
}

/**
 * Run an AI read with a hard timeout and total failure containment.
 * Returns the availability value directly — callers get a value to
 * render, never a promise they must guard.
 */
export async function withAiFallback<T>(
  read: () => Promise<Result<AiAvailability<T>>>,
  options: { timeoutMs?: number } = {},
): Promise<AiAvailability<T>> {
  const timeoutMs = options.timeoutMs ?? AI_READ_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      read(),
      new Promise<Result<AiAvailability<T>>>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, error: {
          code: 'unavailable', message: 'AI read timed out', retryable: true,
        } }), timeoutMs);
      }),
    ]);
    return result.ok ? result.value : aiUnavailable<T>(reasonFor(result.error));
  } catch {
    // A thrown adapter is still just "no AI right now".
    return aiUnavailable<T>('error');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * True when a surface should render its AI section at all.
 * A capability that is off, or an artifact that does not exist yet,
 * means the section is simply absent — never a placeholder, never a
 * "coming soon" card, never invented sample content.
 */
export function shouldRenderAi<T>(availability: AiAvailability<T>): availability is
  { kind: 'ready'; artifact: import('./types').AiArtifact<T> } {
  return availability.kind === 'ready';
}

/**
 * An artifact whose model reported insufficient data is real output that
 * says "not enough happened". Surfaces should treat it as a quiet state
 * rather than filling the space with something more confident.
 */
export function isInsufficient(payload: unknown): boolean {
  return Boolean(
    payload && typeof payload === 'object'
    && (payload as { insufficientData?: unknown }).insufficientData === true,
  );
}
