/*
 * Contract for supabase/migrations/20260903000100_evidence_foundation.sql.
 *
 * Static-parse style, matching tests/security-phase1-database.test.ts: the
 * migration has not been applied anywhere, and these assertions are about what
 * it says, not about a live database. The live run is a separate, manual step.
 *
 * The invariants worth protecting are the ones that would quietly corrupt the
 * dataset rather than fail loudly:
 *   - an attempt must never be counted as a success
 *   - a staked prediction must never become editable
 *   - a founder's note about a dealer must never be readable by that dealer
 *   - and nothing here may fabricate a number that was not observed
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const FILE = '20260903000100_evidence_foundation.sql';
// Normalised: git may check this file out with CRLF on Windows, and the SQL's
// meaning does not depend on line endings. Without this, every multi-line
// assertion below would pass or fail based on the checkout, not the migration.
const sql = readFileSync(new URL(FILE, MIGRATIONS), 'utf8').replace(/\r\n/g, '\n');

/** What the database will actually execute: no `--` commentary and no
 *  COMMENT ON prose. An assertion that a concept is ABSENT has to run against
 *  this, or the migration's own explanation of why it avoided that concept
 *  would count as using it. */
const code = sql
  .replace(/comment on [\s\S]*?;\n/g, '')
  .replace(/^[ \t]*--.*$/gm, '')
  .replace(/[ \t]--.*$/gm, '');

/** The slice of the migration that defines one object. */
function section(startsWith: string, endsBefore: string): string {
  const from = sql.indexOf(startsWith);
  expect(from, `missing: ${startsWith}`).toBeGreaterThan(-1);
  const to = sql.indexOf(endsBefore, from + startsWith.length);
  return sql.slice(from, to === -1 ? sql.length : to);
}

describe('migration hygiene', () => {
  it('is the newest migration and applies as one transaction', () => {
    const all = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    expect(all[all.length - 1]).toBe(FILE);
    expect(code.trimStart().startsWith('begin;')).toBe(true);
    expect(code.trimEnd().endsWith('commit;')).toBe(true);
  });

  it('destroys nothing that already exists', () => {
    expect(sql).not.toMatch(/\bdrop table\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\bdrop column\b/i);
    expect(sql).not.toMatch(/\bdrop function\b/i);
  });

  it('is re-runnable', () => {
    for (const table of ['trials', 'evidence', 'predictions']) {
      expect(sql).toContain(`create table if not exists public.${table} (`);
    }
    expect(sql.match(/create index if not exists/g)?.length).toBeGreaterThan(8);
  });

  it('never weakens a policy or opens a table to anon', () => {
    expect(code).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(code).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    // No table or view is granted to anon. Every other mention of anon in the
    // file is a revoke. The single anon grant is execute on the existing
    // allowlist predicate, which the device ingestion door already required
    // and already had before this migration.
    expect(code).not.toMatch(/grant[^;]*\bon\s+(?:table\s+)?public\.[a-z_]+[^;]*\banon\b/i);
    const anonGrants = [...code.matchAll(/grant[^;]*\banon\b[^;]*;/gi)].map((m) => m[0]);
    expect(anonGrants).toEqual([
      'grant execute on function public.plotmap_event_name_allowed(text)\n  to anon, authenticated;',
    ]);
  });

  it('touches nothing outside the evidence boundary', () => {
    for (const untouched of [
      'property_intelligence', 'marketing_', 'crm_records', 'prebuilt_maps',
      'desk_deal_payments', 'plotmap_daily_usage', 'predictive_usage_events',
    ]) {
      expect(code).not.toContain(untouched);
    }
  });

  it('builds none of the things that need customers we do not have', () => {
    for (const premature of [
      'desk_events', 'archetype', 'cluster', 'market_brain', 'dealer_twin',
      'markov', 'interest_score', 'genome', 'experiment',
    ]) {
      expect(code.toLowerCase()).not.toContain(premature);
    }
  });
});

describe('presentation_events is extended, not duplicated', () => {
  it('adds the six evidence columns to the existing table', () => {
    for (const column of [
      'actor_profile_id', 'actor_role', 'actor_device_hash',
      'outcome', 'duration_ms', 'build_version',
    ]) {
      expect(sql).toContain(`add column if not exists ${column}`);
    }
    expect(sql).toContain('alter table public.presentation_events');
  });

  it('bounds the new columns', () => {
    expect(sql).toContain("outcome in ('started', 'completed', 'abandoned', 'failed')");
    expect(sql).toContain('duration_ms >= 0 and duration_ms <= 86400000');
    expect(sql).toContain('presentation_events_build_version_check');
  });

  it('names device identity as a device and never as a human', () => {
    expect(sql).toMatch(/actor_device_hash is\s*\n?\s*'Which device\. NOT which human/);
  });

  it('derives the actor server-side and runs after the tenant guard', () => {
    const trigger = section('create or replace function public.plotmap_promote_event_envelope', 'revoke all on function public.plotmap_promote_event_envelope');
    expect(trigger).toContain('auth.uid()');
    expect(trigger).toContain('from public.profiles p');
    expect(sql).toContain('create trigger plotmap_10_presentation_events_envelope');
    expect(sql).toContain('plotmap_00_authenticated_tenant_guard');
  });

  it('keeps the two ingestion RPC signatures untouched', () => {
    expect(sql).not.toContain('create or replace function public.plotmap_record_presentation_event');
    expect(sql).not.toContain('create or replace function public.plotmap_record_device_presentation_event');
  });
});

describe('the metadata envelope actually survives the sanitizer', () => {
  const sanitizer = section(
    'create or replace function public.plotmap_sanitize_event_metadata',
    'revoke all on function public.plotmap_sanitize_event_metadata',
  );

  it('reproduces every check the live sanitizer already made', () => {
    expect(sanitizer).toContain("raise exception 'metadata must be an object'");
    expect(sanitizer).toContain('octet_length(v_input::text) > 2048');
    expect(sanitizer).toContain('plotmap_event_metadata_has_secret(v_input, 0)');
    expect(sanitizer).toMatch(/jsonb_build_object\(\s*\n?\s*'surface'/);
    expect(sanitizer).toContain("array['page', 'role', 'view', 'kind', 'via', 'group', 'itemId', 'mapId', 'name']");
    expect(sanitizer).toContain("p_event_type in ('app_error', 'asset_load_failure', 'slow_operation')");
  });

  it('preserves the envelope the trigger promotes, which it previously discarded', () => {
    for (const key of ['_build', '_outcome', '_duration_ms']) {
      expect(sanitizer).toContain(`'${key}'`);
    }
  });

  it('reads the duration as a number so the eight-digit secret scan cannot eat the event', () => {
    expect(sanitizer).toContain("jsonb_typeof(v_input -> '_duration_ms') = 'number'");
    expect(sanitizer).not.toMatch(/_duration_ms[^\n]*::text/);
  });

  it('never lets a caller name itself', () => {
    for (const key of ['_dealer', '_actor', '_session', '_ts']) {
      expect(sanitizer).not.toContain(`'${key}'`);
    }
  });
});

describe('trials: three axes, never collapsed', () => {
  const trials = section('create table if not exists public.trials (', 'create index if not exists trials_dealer_idx');

  it('stores the commercial axis only', () => {
    expect(trials).toContain('commercial_outcome');
    expect(trials).toContain("commercial_outcome in ('open', 'won', 'lost', 'deferred', 'churned')");
    expect(trials).not.toContain('engagement_level');
    expect(trials).not.toContain('activated');
    expect(trials).not.toContain('buyer_opened');
  });

  it('records the treatment so dealers 1-20 stay interpretable', () => {
    expect(trials).toContain('pitch_version           text not null');
    expect(trials).toContain('build_version_at_start  text not null');
    expect(trials).toContain('protocol_version');
  });

  it('records the referral graph at acquisition, not from memory later', () => {
    expect(trials).toContain("acquisition_source in ('family', 'referral', 'cold', 'walk_in', 'inbound')");
    expect(trials).toContain('referred_by_dealer_id');
    expect(trials).toContain('trials_no_self_referral');
  });

  it('records the biggest buyer-side confound at the time it happens', () => {
    expect(trials).toContain('buyer_contact_prompted');
  });

  it('does not restate account state that dealer_settings already owns', () => {
    expect(trials).not.toContain('subscription_status');
    expect(trials).not.toContain('account_status');
    expect(trials).not.toContain('paid ');
  });

  it('never infers commission from inventory', () => {
    expect(code).not.toMatch(/\*\s*0\.01|brokerage|commission_estimate|expected_commission/i);
    expect(code).not.toContain('commission');
    // And the warning against doing it later is written down where the column is.
    expect(sql).toContain('NOT expected commission');
  });
});

describe('evidence: verbatim, with provenance and two clocks', () => {
  const evidence = section('create table if not exists public.evidence (', 'create index if not exists evidence_dealer_idx');

  it('keeps six provenance kinds and no ontology beyond them', () => {
    expect(evidence).toContain(
      "provenance in ('system_observed', 'founder_observed', 'dealer_stated',\n                          'buyer_observed', 'derived', 'backfilled')");
  });

  it('separates when it happened from when it was written down', () => {
    expect(evidence).toContain('occurred_at  timestamptz not null');
    expect(evidence).toContain('recorded_at  timestamptz not null default');
    expect(evidence).toContain('evidence_not_future');
  });

  it('stores the body verbatim and non-empty', () => {
    expect(evidence).toContain('body         text not null');
    expect(evidence).toContain('length(btrim(body)) > 0');
    expect(sql).toContain('Never summarised at write time');
  });
});

describe('predictions: a stake that cannot be rewritten', () => {
  const guard = section(
    'create or replace function public.plotmap_guard_prediction_immutability',
    'drop trigger if exists plotmap_predictions_immutable',
  );

  it('freezes every field of the stake', () => {
    for (const column of ['statement', 'confidence', 'domain', 'horizon_at', 'created_at', 'dealer_id', 'trial_id', 'created_by']) {
      expect(guard).toContain(`new.${column}`);
      expect(guard).toContain(`old.${column}`);
    }
    expect(guard).toContain('a staked prediction cannot be edited');
  });

  it('refuses to flip a terminal resolution', () => {
    expect(guard).toContain("old.resolution in ('true', 'false')");
    expect(guard).toContain('new.resolution is distinct from old.resolution');
    expect(guard).toContain('cannot be re-resolved');
  });

  it('refuses to reopen a resolved prediction', () => {
    expect(guard).toContain("old.resolution <> 'pending' and new.resolution = 'pending'");
    expect(guard).toContain('cannot be reopened');
  });

  it('is installed as a before-update trigger', () => {
    expect(sql).toContain('create trigger plotmap_predictions_immutable');
    expect(sql).toContain('before update on public.predictions');
  });

  it('supports the five resolution states calibration needs', () => {
    expect(sql).toContain("resolution in ('pending', 'true', 'false', 'unresolvable', 'expired')");
    expect(sql).toContain('confidence between 1 and 99');
    expect(sql).toContain('horizon_at > created_at');
  });
});

describe('provider-owned: a dealer cannot read what the founder wrote about him', () => {
  it('enables and forces RLS on all three tables', () => {
    for (const table of ['trials', 'evidence', 'predictions']) {
      expect(code).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`));
      // force, not just enable: RLS must bind the table owner too.
      expect(code).toMatch(new RegExp(`alter table public\\.${table}\\s+force row level security`));
    }
  });

  it('gates every policy on platform admin', () => {
    for (const table of ['trials', 'evidence', 'predictions']) {
      expect(sql).toMatch(new RegExp(`create policy ${table}_platform_admin_all on public\\.${table}`));
    }
    expect(sql.match(/using \(public\.plotmap_is_platform_admin\(\)\)/g)).toHaveLength(3);
    expect(sql.match(/with check \(public\.plotmap_is_platform_admin\(\)\)/g)).toHaveLength(3);
  });

  it('revokes blanket access before granting anything back', () => {
    for (const table of ['trials', 'evidence', 'predictions']) {
      const revokeAt = sql.indexOf(`revoke all on public.${table}`);
      const grantAt = sql.indexOf(`grant select, insert, update, delete on public.${table}`);
      expect(revokeAt).toBeGreaterThan(-1);
      expect(grantAt).toBeGreaterThan(revokeAt);
    }
  });
});

describe('derived views: an attempt is not a success', () => {
  const milestones = section('create view public.trial_milestones_v', 'comment on view public.trial_milestones_v');

  it('counts a property only when persistence actually succeeded', () => {
    // Every property_added filter must state an outcome. A bare filter would
    // count a failed save as a milestone and quietly inflate every trial.
    const filters = [...milestones.matchAll(/filter \(\s*\n?\s*where ([^)]*property_added[^)]*)\)/g)]
      .map((m) => m[1].replace(/\s+/g, ' ').trim());
    expect(filters.length).toBeGreaterThanOrEqual(3);
    for (const filter of filters) {
      expect(filter).toMatch(/outcome = '(completed|failed)'/);
    }
    expect(filters.some((f) => f.includes("outcome = 'completed'"))).toBe(true);
    expect(filters.some((f) => f.includes("outcome = 'failed'"))).toBe(true);
  });

  it('keeps failures, starts and abandonments as separate columns', () => {
    expect(milestones).toContain('properties_added');
    expect(milestones).toContain('property_add_failures');
    expect(milestones).toContain('add_started');
    expect(milestones).toContain('add_abandoned');
    expect(milestones).toContain("pe.event_type = 'property_add_clicked' and pe.outcome = 'abandoned'");
  });

  it('exposes who acted and which builds they saw', () => {
    expect(milestones).toContain('count(distinct pe.actor_profile_id)');
    expect(milestones).toContain('count(distinct pe.build_version)');
  });

  it('admits the attribution limit rather than hiding it', () => {
    expect(sql).toContain('a dealer with two trials leaves the gap between them attributed to neither');
  });

  it('grades buyer behaviour from the events that already exist, with no new table', () => {
    const buyer = section('create view public.buyer_engagement_v', 'comment on view public.buyer_engagement_v');
    expect(buyer).toContain('public.client_link_events');
    expect(buyer).toContain('public.share_links');
    for (const kind of ['opened', 'audio_played', 'call_clicked', 'whatsapp_clicked', 'visit_requested', 'property_viewed', 'photos_viewed', 'map_opened']) {
      expect(buyer).toContain(`'${kind}'`);
    }
    // A ladder, not a boolean, and not a score.
    for (const rung of ['none', 'incidental', 'engaged', 'deep']) {
      expect(buyer).toContain(`'${rung}'`);
    }
    expect(buyer).not.toMatch(/score|weight|points/i);
  });

  it('calls buyer behaviour independent, never uncontaminated', () => {
    expect(sql).toContain('highest-INDEPENDENCE');
    expect(sql).toContain('not truth');
    expect(sql).not.toMatch(/uncontaminated|objective truth|ground truth/i);
  });

  it('computes calibration per domain and never averages across them', () => {
    const calibration = section('create view public.founder_calibration_v', 'comment on view public.founder_calibration_v');
    expect(calibration).toContain('group by domain');
    expect(calibration).toContain('brier');
    expect(calibration).toContain("where resolution in ('true', 'false')");
    expect(sql).toContain('Do not render a bucket with n < 3');
  });

  it('keeps the caller’s RLS in force inside every view', () => {
    expect(sql.match(/with \(security_invoker = true\)/g)).toHaveLength(3);
  });

  it('stores no derived judgement back onto a row', () => {
    const trials = section('create table if not exists public.trials (', 'create index if not exists trials_dealer_idx');
    expect(trials).not.toContain('engagement');
    expect(trials).not.toContain('milestone');
    expect(trials).not.toContain('brier');
  });
});
