/* ═══════════════════════════════════════════════════════════════
   MAPCO — Client Link follow-ups
   ---------------------------------------------------------------
   A follow-up is a REASON TO PICK UP THE PHONE, derived only from
   something that factually happened on a link the dealer sent — or
   provably did not happen.

   There is deliberately no Hot / Warm / Cold, no interest score and no
   ranking by "engagement". Every row here can be traced to a recorded
   event or to the absence of one, and says so in plain language.
   ═══════════════════════════════════════════════════════════════ */
import type {
  ClientLinkSummary, ClientLinkFollowUp, FollowUpReason,
} from './contracts';

/** Ordered by how directly the buyer asked to be contacted. */
const PRIORITY: Record<FollowUpReason, number> = {
  'visit-requested': 1,
  'called-you': 2,
  'whatsapp-tapped': 3,
  'viewed-again': 4,
  'expiring-soon': 5,
  'never-opened': 6,
};

export interface FollowUpOptions {
  /** A link within this many days of expiry is worth chasing. */
  expiringWithinDays?: number;
  /** A link unopened for this long is worth chasing. */
  neverOpenedAfterDays?: number;
  /** Injected for tests. */
  now?: () => number;
}

const days = (ms: number) => ms / 864e5;

/**
 * Build the Follow-ups list. A link contributes AT MOST one row — its
 * strongest factual reason — so the dealer sees a list of people to
 * call, not a list of events.
 */
export function deriveFollowUps(
  links: readonly ClientLinkSummary[],
  options: FollowUpOptions = {},
): ClientLinkFollowUp[] {
  const expiringWithinDays = options.expiringWithinDays ?? 2;
  const neverOpenedAfterDays = options.neverOpenedAfterDays ?? 2;
  const now = (options.now ?? Date.now)();

  const out: ClientLinkFollowUp[] = [];

  for (const link of links) {
    if (link.status === 'revoked') continue;
    const a = link.activity;
    const candidates: ClientLinkFollowUp[] = [];

    if (a.visitRequests > 0) {
      candidates.push({
        link, reason: 'visit-requested',
        detail: a.visitRequests === 1
          ? 'Asked to visit a property'
          : `Asked to visit ${a.visitRequests} times`,
        ...(link.lastActivityAt ? { at: link.lastActivityAt } : {}),
      });
    }
    if (a.calls > 0) {
      candidates.push({
        link, reason: 'called-you',
        detail: a.calls === 1 ? 'Tapped Call' : `Tapped Call ${a.calls} times`,
        ...(link.lastActivityAt ? { at: link.lastActivityAt } : {}),
      });
    }
    if (a.whatsapp > 0) {
      candidates.push({
        link, reason: 'whatsapp-tapped',
        detail: a.whatsapp === 1 ? 'Tapped WhatsApp' : `Tapped WhatsApp ${a.whatsapp} times`,
        ...(link.lastActivityAt ? { at: link.lastActivityAt } : {}),
      });
    }
    // "Came back" means more property views than properties on the link —
    // they genuinely looked at something more than once.
    if (a.propertyViews > link.propertyIds.length && link.propertyIds.length > 0) {
      candidates.push({
        link, reason: 'viewed-again',
        detail: 'Opened a property on this link more than once',
        ...(link.lastActivityAt ? { at: link.lastActivityAt } : {}),
      });
    }
    if (link.expiresAt && link.status === 'active') {
      const left = days(Date.parse(link.expiresAt) - now);
      if (left >= 0 && left <= expiringWithinDays) {
        candidates.push({
          link, reason: 'expiring-soon',
          detail: left < 1 ? 'Link expires today' : `Link expires in ${Math.ceil(left)} day${Math.ceil(left) === 1 ? '' : 's'}`,
          at: link.expiresAt,
        });
      }
    }
    if (a.opens === 0 && link.status === 'active' && link.createdAt) {
      const age = days(now - Date.parse(link.createdAt));
      if (age >= neverOpenedAfterDays) {
        candidates.push({
          link, reason: 'never-opened',
          detail: `Sent ${Math.floor(age)} days ago, never opened`,
          at: link.createdAt,
        });
      }
    }

    if (!candidates.length) continue;
    candidates.sort((x, y) => PRIORITY[x.reason] - PRIORITY[y.reason]);
    out.push(candidates[0]!);
  }

  // Strongest reason first; within a reason, most recent first.
  return out.sort((x, y) =>
    PRIORITY[x.reason] - PRIORITY[y.reason]
    || Date.parse(y.at ?? '0') - Date.parse(x.at ?? '0'));
}

/** True when the link can still be opened by the buyer. */
export function isLinkLive(link: ClientLinkSummary, now = Date.now()): boolean {
  if (link.status !== 'active') return false;
  if (!link.expiresAt) return true;
  return Date.parse(link.expiresAt) > now;
}
