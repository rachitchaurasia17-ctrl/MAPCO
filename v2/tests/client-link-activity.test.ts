import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import { CLIENT_LINKS } from '../src/packages/data/mock-adapter';
import { deriveFollowUps, isLinkLive } from '../src/packages/data/client-link-followups';
import type { ClientLinkSummary } from '../src/packages/data/contracts';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260826000300_client_link_activity.sql', import.meta.url),
  'utf8',
);

const NOW = Date.parse('2026-08-26T12:00:00.000Z');
const iso = (offsetDays: number) => new Date(NOW + offsetDays * 864e5).toISOString();

function summary(over: Partial<ClientLinkSummary> = {}): ClientLinkSummary {
  return {
    id: 'l1', clientId: 'c1', clientName: 'Buyer', clientPhone: '+91 1',
    propertyIds: ['p1'], status: 'active',
    createdAt: iso(-5),
    activity: {
      opens: 1, propertyViews: 1, photoViews: 0, mapOpens: 0,
      audioPlays: 0, calls: 0, whatsapp: 0, visitRequests: 0,
    },
    ...over,
  };
}

describe('follow-ups are factual only', () => {
  const now = () => NOW;

  it('surfaces a site-visit request first', () => {
    const rows = deriveFollowUps([summary({
      activity: { ...summary().activity, visitRequests: 1, calls: 1 },
    })], { now });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe('visit-requested');
    expect(rows[0]!.detail).toMatch(/visit/i);
  });

  it('surfaces a Call tap and a WhatsApp tap', () => {
    const called = deriveFollowUps([summary({
      activity: { ...summary().activity, calls: 2 },
    })], { now });
    expect(called[0]!.reason).toBe('called-you');
    expect(called[0]!.detail).toBe('Tapped Call 2 times');

    const wa = deriveFollowUps([summary({
      activity: { ...summary().activity, whatsapp: 1 },
    })], { now });
    expect(wa[0]!.reason).toBe('whatsapp-tapped');
  });

  it('surfaces a repeat view only when they genuinely came back', () => {
    // One property, viewed twice.
    const repeat = deriveFollowUps([summary({
      propertyIds: ['p1'],
      activity: { ...summary().activity, propertyViews: 2 },
    })], { now });
    expect(repeat[0]!.reason).toBe('viewed-again');

    // Two properties viewed once each is NOT coming back.
    const spread = deriveFollowUps([summary({
      propertyIds: ['p1', 'p2'],
      activity: { ...summary().activity, propertyViews: 2 },
    })], { now });
    expect(spread).toHaveLength(0);
  });

  it('surfaces an expiring link and a link never opened', () => {
    const expiring = deriveFollowUps([summary({
      expiresAt: iso(1),
      activity: { ...summary().activity, propertyViews: 1 },
    })], { now });
    expect(expiring[0]!.reason).toBe('expiring-soon');

    const never = deriveFollowUps([summary({
      createdAt: iso(-4),
      activity: {
        opens: 0, propertyViews: 0, photoViews: 0, mapOpens: 0,
        audioPlays: 0, calls: 0, whatsapp: 0, visitRequests: 0,
      },
    })], { now });
    expect(never[0]!.reason).toBe('never-opened');
    expect(never[0]!.detail).toMatch(/never opened/i);
  });

  it('produces nothing for a link where nothing factual happened', () => {
    expect(deriveFollowUps([summary({ createdAt: iso(-1) })], { now })).toHaveLength(0);
  });

  it('never lists a revoked link', () => {
    expect(deriveFollowUps([summary({
      status: 'revoked',
      activity: { ...summary().activity, visitRequests: 3 },
    })], { now })).toHaveLength(0);
  });

  it('gives one row per link — its strongest reason, not every event', () => {
    const rows = deriveFollowUps([summary({
      expiresAt: iso(1),
      activity: { ...summary().activity, visitRequests: 1, calls: 1, whatsapp: 1, propertyViews: 5 },
    })], { now });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe('visit-requested');
  });

  it('exposes no score, rank or temperature anywhere in the output', () => {
    const rows = deriveFollowUps([summary({
      activity: { ...summary().activity, visitRequests: 1 },
    })], { now });
    // No FIELD may be a score or a temperature. (Substring matching would
    // false-positive on "photoViews" containing "hot".)
    const fields = new Set<string>();
    const walk = (v: unknown) => {
      if (!v || typeof v !== 'object') return;
      for (const [k, child] of Object.entries(v)) { fields.add(k.toLowerCase()); walk(child); }
    };
    walk(rows);
    for (const banned of ['score', 'rank', 'rating', 'interest', 'temperature', 'warmth', 'grade']) {
      expect([...fields], banned).not.toContain(banned);
    }
    // And no value is a temperature label.
    const values = JSON.stringify(rows.map((r) => r.reason)).toLowerCase();
    for (const banned of ['hot', 'warm', 'cold']) expect(values, banned).not.toContain(banned);
  });

  it('knows whether a link can still be opened', () => {
    expect(isLinkLive(summary({ expiresAt: iso(2) }), NOW)).toBe(true);
    expect(isLinkLive(summary({ expiresAt: iso(-1) }), NOW)).toBe(false);
    expect(isLinkLive(summary({ status: 'revoked' }), NOW)).toBe(false);
  });
});

describe('link activity through the repository', () => {
  it('records a real event per property and reads it back', async () => {
    const link = CLIENT_LINKS[0]!;
    const property = link.props[0]!;

    await adapter.clientLinks.recordEvent(link.id, 'opened');
    await adapter.clientLinks.recordEvent(link.id, 'property_viewed', property);
    await adapter.clientLinks.recordEvent(link.id, 'property_viewed', property);
    await adapter.clientLinks.recordEvent(link.id, 'photos_viewed', property);
    await adapter.clientLinks.recordEvent(link.id, 'map_opened', property);

    const workspace = await adapter.clientLinks.workspace(link.id);
    expect(workspace.ok).toBe(true);
    if (!workspace.ok) return;

    const row = workspace.value.properties.find((p) => p.propertyId === property)!;
    expect(row.views).toBe(2);
    expect(row.photoViews).toBe(1);
    expect(row.mapOpens).toBe(1);
    expect(row.lastViewedAt).toBeTruthy();

    // History is chronological and real.
    expect(workspace.value.history.length).toBeGreaterThanOrEqual(5);
    expect(workspace.value.history[0]!.at >= workspace.value.history[1]!.at).toBe(true);
  });

  it('lists every link with its counts in one call', async () => {
    const directory = await adapter.clientLinks.directory();
    expect(directory.ok).toBe(true);
    if (!directory.ok) return;
    expect(directory.value.length).toBe(CLIENT_LINKS.length);
    for (const row of directory.value) {
      expect(row.activity).toBeTruthy();
      expect(row.propertyIds.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports a missing link truthfully', async () => {
    const result = await adapter.clientLinks.workspace('does-not-exist');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });
});

describe('client link activity migration', () => {
  it('adds only real, attributable event kinds', () => {
    for (const kind of ['property_viewed', 'photos_viewed', 'map_opened']) {
      expect(migration).toContain(kind);
    }
    /* No SQL identifier may be a score. The file's own prose explains why
       we do not score buyers, so match declarations and aliases rather
       than any mention of the word. */
    expect(migration).not.toMatch(/\b(?:score|interest_level|warmth|temperature)\s+(?:numeric|integer|int|text|boolean)\b/i);
    expect(migration).not.toMatch(/\bas\s+(?:score|interest_level|warmth|temperature)\b/i);
  });

  it('keeps both read models dealer-scoped and closed to anon', () => {
    for (const fn of ['plotmap_client_link_directory', 'plotmap_client_link_workspace']) {
      expect(migration).toContain(`create or replace function public.${fn}`);
      expect(migration).toContain(`revoke all on function public.${fn}`);
    }
    expect(migration).toContain('public.plotmap_current_dealer_id()');
    expect(migration).not.toMatch(/to anon/);
  });
});
