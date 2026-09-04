/*
 * The frontend event taxonomy and the database allowlist are one contract.
 *
 * They used to disagree completely — contracts.ts held 'opened',
 * 'map-changed', 'property-viewed', 'gallery-opened', 'closed', and
 * plotmap_event_name_allowed() has never contained any of them. The RPC
 * raises 'unknown event type' for a name it does not know, the emitter
 * swallowed that error, and so every event the product could have recorded
 * was rejected on arrival with nothing to show for it.
 *
 * A comment saying the two lists match is worth nothing. This file compares
 * them mechanically, in both directions, on every run — and then proves the
 * comparison itself actually catches drift, so a passing run means something.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_EVENT_KINDS, REPO_ERROR_CODES } from '../src/packages/data/contracts';
import {
  EVENT_METADATA_BOOLEAN_KEYS,
  EVENT_METADATA_NUMBER_KEYS,
  EVENT_METADATA_TEXT_KEYS,
  RESERVED_EVENT_METADATA_KEYS,
  buildEventMetadata,
  errorKind,
} from '../src/packages/data/telemetry';

/* ── reading the real migrations, in the house static-parse style ────────── */

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

function migrationSources(): readonly { readonly file: string; readonly sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    // Line endings normalised: git may check these out with CRLF on Windows,
    // and no assertion here is about whitespace.
    .map((file) => ({ file, sql: readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/g, '\n') }));
}

/** The definition that actually wins: migrations apply in filename order, and
 *  `create or replace` means the last one is live. */
function lastDefinitionOf(functionName: string): { file: string; body: string } {
  const marker = `create or replace function public.${functionName}`;
  let found: { file: string; body: string } | null = null;
  for (const { file, sql } of migrationSources()) {
    let from = sql.indexOf(marker);
    while (from !== -1) {
      const open = sql.indexOf('$$', from);
      const close = sql.indexOf('$$', open + 2);
      found = { file, body: sql.slice(from, close === -1 ? sql.length : close + 2) };
      from = sql.indexOf(marker, from + marker.length);
    }
  }
  if (!found) throw new Error(`no definition of public.${functionName} in supabase/migrations`);
  return found;
}

/** Every single-quoted literal inside the first `array[...]` of a body slice. */
function arrayLiteralAt(body: string, from: number): readonly string[] {
  const open = body.indexOf('array[', from);
  if (open === -1) throw new Error('no array literal found');
  const close = body.indexOf(']', open);
  return [...body.slice(open, close).matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

function allArrayLiterals(body: string): readonly (readonly string[])[] {
  const out: string[][] = [];
  for (const match of body.matchAll(/array\[[^\]]*\]/g)) {
    out.push([...match[0].matchAll(/'([^']*)'/g)].map((m) => m[1]));
  }
  return out;
}

/** Identify a sanitizer key list by a member it must contain. Renaming that
 *  member in SQL makes this throw, which is the point. */
function keyListContaining(body: string, member: string): readonly string[] {
  const found = allArrayLiterals(body).filter((list) => list.includes(member));
  if (found.length !== 1) {
    throw new Error(`expected exactly one SQL key list containing '${member}', found ${found.length}`);
  }
  return found[0];
}

/* ── the comparison, written once and then itself tested ─────────────────── */

interface SetDiff { readonly missingInTs: readonly string[]; readonly missingInSql: readonly string[]; }

function diff(sql: readonly string[], ts: readonly string[]): SetDiff {
  const sqlSet = new Set(sql);
  const tsSet = new Set(ts);
  return {
    missingInTs: sql.filter((name) => !tsSet.has(name)),
    missingInSql: ts.filter((name) => !sqlSet.has(name)),
  };
}

const EMPTY: SetDiff = { missingInTs: [], missingInSql: [] };

describe('event taxonomy: SQL allowlist == TypeScript allowlist', () => {
  const allowlist = lastDefinitionOf('plotmap_event_name_allowed');
  const sqlNames = arrayLiteralAt(allowlist.body, 0);

  it('resolves the winning allowlist definition from the evidence-foundation migration', () => {
    expect(allowlist.file).toBe('20260903000100_evidence_foundation.sql');
  });

  it('agrees in both directions, name for name', () => {
    expect(diff(sqlNames, PRESENTATION_EVENT_KINDS)).toEqual(EMPTY);
  });

  it('carries the same number of names on both sides, with no duplicates', () => {
    expect(new Set(sqlNames).size).toBe(sqlNames.length);
    expect(new Set(PRESENTATION_EVENT_KINDS).size).toBe(PRESENTATION_EVENT_KINDS.length);
    expect(sqlNames.length).toBe(PRESENTATION_EVENT_KINDS.length);
    expect(sqlNames.length).toBe(38);
  });

  it('contains no hyphenated name on either side', () => {
    for (const name of [...sqlNames, ...PRESENTATION_EVENT_KINDS]) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('still carries the Add Property workflow names the Desk emits', () => {
    for (const name of ['property_add_clicked', 'property_added', 'property_location_pinned']) {
      expect(sqlNames).toContain(name);
      expect(PRESENTATION_EVENT_KINDS as readonly string[]).toContain(name);
    }
  });

  /* The comparison above is only worth running if it fails when it should. */

  it('fails on a hyphen/underscore mutation', () => {
    const mutated = PRESENTATION_EVENT_KINDS.map((n) =>
      n === 'property_add_clicked' ? 'property-add-clicked' : n);
    const result = diff(sqlNames, mutated);
    expect(result.missingInTs).toEqual(['property_add_clicked']);
    expect(result.missingInSql).toEqual(['property-add-clicked']);
  });

  it('fails on a frontend-only event', () => {
    const result = diff(sqlNames, [...PRESENTATION_EVENT_KINDS, 'invented_event']);
    expect(result.missingInSql).toEqual(['invented_event']);
  });

  it('fails on a SQL-only event', () => {
    const result = diff([...sqlNames, 'sql_only_event'], PRESENTATION_EVENT_KINDS);
    expect(result.missingInTs).toEqual(['sql_only_event']);
  });

  it('fails on a dropped event', () => {
    const result = diff(sqlNames, PRESENTATION_EVENT_KINDS.filter((n) => n !== 'deal_stage_changed'));
    expect(result.missingInTs).toEqual(['deal_stage_changed']);
  });
});

describe('metadata contract: what the client sends is what the database keeps', () => {
  const sanitizer = lastDefinitionOf('plotmap_sanitize_event_metadata');

  it('is defined by the evidence-foundation migration', () => {
    expect(sanitizer.file).toBe('20260903000100_evidence_foundation.sql');
  });

  it('keeps exactly the caller text keys the frontend offers', () => {
    expect(diff(keyListContaining(sanitizer.body, 'flow'), EVENT_METADATA_TEXT_KEYS)).toEqual(EMPTY);
  });

  it('keeps exactly the caller number keys the frontend offers', () => {
    expect(diff(keyListContaining(sanitizer.body, 'step'), EVENT_METADATA_NUMBER_KEYS)).toEqual(EMPTY);
  });

  it('keeps exactly the caller boolean keys the frontend offers', () => {
    expect(diff(keyListContaining(sanitizer.body, 'downgraded'), EVENT_METADATA_BOOLEAN_KEYS)).toEqual(EMPTY);
  });

  it('preserves the three envelope keys the trigger promotes into columns', () => {
    for (const key of ['_build', '_outcome', '_duration_ms']) {
      expect(sanitizer.body).toContain(`'${key}'`);
    }
  });

  it('never reads the four identity keys out of caller metadata', () => {
    // _dealer, _actor, _session and _ts are RPC parameters or derived from
    // auth.uid(). If the sanitizer or the trigger ever learned to read them
    // from metadata, a client could name itself.
    const promoter = lastDefinitionOf('plotmap_promote_event_envelope');
    for (const key of ['_dealer', '_actor', '_session', '_ts']) {
      expect(sanitizer.body).not.toContain(`'${key}'`);
      expect(promoter.body).not.toContain(`'${key}'`);
    }
  });

  it('derives actor identity from auth.uid(), not from anything the caller sent', () => {
    const promoter = lastDefinitionOf('plotmap_promote_event_envelope');
    expect(promoter.body).toContain('auth.uid()');
    expect(promoter.body).toContain('new.actor_profile_id');
    expect(promoter.body).toContain('from public.profiles p');
  });

  it('reads _duration_ms as a number, never as a string', () => {
    // plotmap_event_metadata_has_secret rejects any STRING holding eight
    // consecutive digits, so a stringified duration would lose the whole event.
    expect(sanitizer.body).toContain("jsonb_typeof(v_input -> '_duration_ms') = 'number'");
  });
});

describe('telemetry envelope', () => {
  const envelope = { build: 'a1b2c3d', outcome: 'completed' as const, durationMs: 1234 };

  it('writes the system envelope on every event', () => {
    expect(buildEventMetadata(undefined, envelope)).toEqual({
      _build: 'a1b2c3d', _outcome: 'completed', _duration_ms: 1234,
    });
  });

  it('sends the duration as a number, not a string', () => {
    const built = buildEventMetadata(undefined, { build: 'dev', durationMs: 12_345_678 });
    expect(typeof built._duration_ms).toBe('number');
    expect(JSON.stringify(built)).not.toMatch(/"_duration_ms":"/);
  });

  it('cannot be spoofed: a caller setting reserved keys loses every one', () => {
    const spoof = Object.fromEntries(
      RESERVED_EVENT_METADATA_KEYS.map((key) => [key, 'attacker']),
    ) as Record<string, string>;
    const built = buildEventMetadata(spoof, envelope);
    expect(built._build).toBe('a1b2c3d');
    expect(built._outcome).toBe('completed');
    expect(built._duration_ms).toBe(1234);
    expect(built._dealer).toBeUndefined();
    expect(built._actor).toBeUndefined();
    expect(built._session).toBeUndefined();
    expect(built._ts).toBeUndefined();
  });

  it('keeps the caller keys the database keeps, with their types intact', () => {
    const built = buildEventMetadata(
      { flow: 'add', stage: 'on_sale', step: 4, published: true, downgraded: false },
      { build: 'dev' },
    );
    expect(built).toEqual({
      flow: 'add', stage: 'on_sale', step: 4, published: true, downgraded: false, _build: 'dev',
    });
  });

  it('drops keys the database would drop, so local behaviour matches production', () => {
    const built = buildEventMetadata(
      { not_a_known_key: 'x', flow: 'add' } as never,
      { build: 'dev' },
    );
    expect(built).toEqual({ flow: 'add', _build: 'dev' });
  });

  it('drops nested objects, functions, NaN and wrong-typed values', () => {
    const built = buildEventMetadata(
      {
        flow: { nested: true },
        step: Number.NaN,
        photo_count: Number.POSITIVE_INFINITY,
        published: 'yes',
      } as never,
      { build: 'dev' },
    );
    expect(built).toEqual({ _build: 'dev' });
  });

  it('drops a value the database secret scan would reject, rather than losing the event', () => {
    // plotmap_event_metadata_has_secret rejects any string containing eight
    // consecutive digits — the whole insert, not just the key.
    const built = buildEventMetadata({ error_kind: 'e12345678' } as never, { build: 'dev' });
    expect(built.error_kind).toBeUndefined();
  });

  it('drops an oversized or malformed text value', () => {
    const built = buildEventMetadata(
      { flow: 'A'.repeat(400), stage: 'Has Spaces And Caps' } as never,
      { build: 'dev' },
    );
    expect(built).toEqual({ _build: 'dev' });
  });

  it('bounds a hostile payload and never drops the envelope', () => {
    const hostile: Record<string, unknown> = {};
    for (let i = 0; i < 60; i += 1) hostile[`flow${i}`] = 'x'.repeat(400);
    const built = buildEventMetadata(hostile as never, envelope);
    expect(JSON.stringify(built).length).toBeLessThan(2048);
    expect(built._build).toBe('a1b2c3d');
    expect(built._outcome).toBe('completed');
  });

  it('rejects a build stamp the database column would reject', () => {
    expect(buildEventMetadata(undefined, { build: 'x'.repeat(64) })._build).toBeUndefined();
    expect(buildEventMetadata(undefined, { build: 'dev' })._build).toBe('dev');
  });

  it('clamps an absurd duration instead of failing the constraint', () => {
    expect(buildEventMetadata(undefined, { build: 'dev', durationMs: -5 })._duration_ms).toBe(0);
    expect(buildEventMetadata(undefined, { build: 'dev', durationMs: 1e12 })._duration_ms).toBe(86_400_000);
  });
});

describe('error classification', () => {
  it('passes through every repository error code and nothing else', () => {
    for (const code of REPO_ERROR_CODES) expect(errorKind(code)).toBe(code);
    expect(errorKind({ code: 'conflict' })).toBe('conflict');
  });

  it('never lets a raw error message through', () => {
    const raw = 'duplicate key value violates unique constraint "crm_records_pkey" for dealer DLR-9';
    expect(errorKind(raw)).toBe('unknown');
    expect(errorKind(new Error(raw))).toBe('unknown');
    expect(errorKind({ code: raw, message: raw })).toBe('unknown');
    expect(errorKind(undefined)).toBe('unknown');
    expect(errorKind(null)).toBe('unknown');
  });
});
