/*
 * Add Property is the first workflow DealSetu records truthfully, so these
 * tests are about truthfulness rather than coverage:
 *
 *   - a failed save must never look like a property
 *   - a raster mapPlacement must never look like a WGS84 coordinate
 *   - an abandonment must be observed, never inferred
 *   - and none of it may ever break saving a property
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddPropertyTelemetry } from '../src/apps/dealer/add-property-telemetry';
import type { PresentationEvent } from '../src/packages/data/contracts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** Source with comments removed, so an assertion about what the code DOES is
 *  not satisfied or defeated by prose describing what it must not do. */
const code = (path: string) =>
  source(path).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

function harness() {
  const events: PresentationEvent[] = [];
  let clock = 1_000;
  const telemetry = new AddPropertyTelemetry((event) => { events.push(event); }, () => clock);
  return {
    events,
    telemetry,
    advance: (ms: number) => { clock += ms; },
    kinds: () => events.map((e) => `${e.kind}/${e.outcome}`),
  };
}

describe('Add Property flow events', () => {
  it('records the start of a real add flow exactly once', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    expect(h.kinds()).toEqual(['property_add_clicked/started']);
    expect(h.events[0].metadata).toMatchObject({ flow: 'add' });
  });

  it('records a completed property only after persistence actually succeeded', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.advance(9_000);
    h.telemetry.persisted({ propertyId: 'P1', lifecycle: 'on-sale', hasMapPlacement: true, photoCount: 3 });
    expect(h.kinds()).toEqual(['property_add_clicked/started', 'property_added/completed']);
    const completed = h.events[1];
    expect(completed.propertyId).toBe('P1');
    expect(completed.durationMs).toBe(9_000);
    expect(completed.metadata).toMatchObject({
      flow: 'add', lifecycle: 'on-sale', has_map_placement: true, photo_count: 3,
    });
  });

  it('records completion once even though the Desk re-saves on every step', () => {
    // pNext calls savePlot(false) at each step advance. Those are updates to a
    // row that already exists, not four separate properties.
    const h = harness();
    h.telemetry.openedForAdd();
    for (let step = 0; step < 4; step += 1) {
      h.telemetry.persisted({ propertyId: 'P1', lifecycle: 'draft' });
    }
    expect(h.kinds()).toEqual(['property_add_clicked/started', 'property_added/completed']);
  });

  it('records a failure only after a real persistence attempt failed', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.telemetry.persistFailed('on_sale', 'network');
    expect(h.kinds()).toEqual(['property_add_clicked/started', 'property_added/failed']);
    expect(h.events[1].metadata).toMatchObject({ stage: 'on_sale', error_kind: 'network' });
  });

  it('records whether the saved row is geolocated, separately from confirming a pin', () => {
    // "Confirm this spot" is not a gate: desk-store persists a coordinate
    // whenever isRealCoordinate(lat, lng) holds, so a dealer can tap the map
    // and save without ever confirming. The boolean is the outcome; the
    // property_location_pinned event is the deliberate act. Both are facts,
    // and collapsing them would either overstate intent or lose the coverage.
    const h = harness();
    h.telemetry.openedForAdd();
    h.telemetry.persisted({ propertyId: 'P1', lifecycle: 'on-sale', hasLocation: true, hasMapPlacement: false });
    expect(h.kinds()).toEqual(['property_add_clicked/started', 'property_added/completed']);
    expect(h.events[1].metadata).toMatchObject({ has_location: true, has_map_placement: false });
    // No pin was confirmed, so no confirmation event exists to imply one was.
    expect(h.kinds()).not.toContain('property_location_pinned/completed');
  });

  it('marks the record as downgraded when On sale was held back as a Draft', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.telemetry.persisted({ propertyId: 'P1', lifecycle: 'draft', downgraded: true });
    expect(h.events[1].metadata).toMatchObject({ lifecycle: 'draft', downgraded: true });
  });

  it('still records the eventual success after a failure — both are facts', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.telemetry.persistFailed('on_sale', 'network');
    h.telemetry.persisted({ propertyId: 'P1', lifecycle: 'on-sale' });
    expect(h.kinds()).toEqual([
      'property_add_clicked/started', 'property_added/failed', 'property_added/completed',
    ]);
  });

  it('never carries a raw error message, only a closed failure code', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.telemetry.persistFailed('draft', {
      code: 'duplicate key value violates unique constraint "crm_records_pkey" for dealer DLR-9',
    } as never);
    expect(h.events[1].metadata).toMatchObject({ error_kind: 'unknown' });
    expect(JSON.stringify(h.events)).not.toContain('crm_records_pkey');
    expect(JSON.stringify(h.events)).not.toContain('DLR-9');
  });
});

describe('abandonment is observed, never guessed', () => {
  it('records an abandonment when the flow closed having written nothing', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.advance(4_000);
    h.telemetry.abandoned(2);
    expect(h.kinds()).toEqual(['property_add_clicked/started', 'property_add_clicked/abandoned']);
    expect(h.events[1].metadata).toMatchObject({ flow: 'add', step: 2 });
    expect(h.events[1].durationMs).toBe(4_000);
  });

  it('never calls a real save an abandonment', () => {
    const h = harness();
    h.telemetry.openedForAdd();
    h.telemetry.persisted({ propertyId: 'P1', lifecycle: 'draft' });
    h.telemetry.abandoned(3);
    expect(h.kinds()).toEqual(['property_add_clicked/started', 'property_added/completed']);
  });

  it('records nothing at all when no flow was ever opened', () => {
    const h = harness();
    h.telemetry.abandoned(1);
    h.telemetry.persisted({ lifecycle: 'draft' });
    h.telemetry.persistFailed('draft', 'network');
    expect(h.events).toEqual([]);
  });

  it('does not guess at a crash, a refresh, a lost network or a hidden tab', () => {
    // The Desk cannot distinguish any of those from a deliberate close, so
    // nothing in this code may listen for them.
    const module = source('src/apps/dealer/add-property-telemetry.ts');
    const wiring = source('src/apps/dealer/logic.ts');
    for (const guess of ['beforeunload', 'visibilitychange', 'pagehide', 'unload']) {
      expect(module).not.toContain(guess);
      expect(wiring).not.toContain(guess);
    }
  });
});

describe('editing a property is not adding one', () => {
  it('emits no add-flow events for an edit', () => {
    const h = harness();
    h.telemetry.openedForEdit('P7');
    h.telemetry.persisted({ propertyId: 'P7', lifecycle: 'on-sale' });
    h.telemetry.persistFailed('on_sale', 'network');
    h.telemetry.abandoned(1);
    expect(h.events).toEqual([]);
  });

  it('still records a genuine location confirmation during an edit', () => {
    const h = harness();
    h.telemetry.openedForEdit('P7');
    expect(h.telemetry.locationConfirmed(30.7046, 76.7179, 'drag')).toBe(true);
    expect(h.kinds()).toEqual(['property_location_pinned/completed']);
    expect(h.events[0].metadata).toMatchObject({ flow: 'edit', is_edit: true, pin_source: 'drag' });
  });
});

describe('property_location_pinned means a real WGS84 coordinate', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); h.telemetry.openedForAdd(); h.events.length = 0; });

  it('fires for a confirmed coordinate, and records how it was reached', () => {
    expect(h.telemetry.locationConfirmed(30.7046, 76.7179, 'search')).toBe(true);
    expect(h.kinds()).toEqual(['property_location_pinned/completed']);
    expect(h.events[0].metadata).toMatchObject({ pin_source: 'search', is_edit: false });
  });

  it('refuses null island — the sentinel a raster placement degrades into', () => {
    expect(h.telemetry.locationConfirmed(0, 0)).toBe(false);
    expect(h.events).toEqual([]);
  });

  it('refuses a normalised mapPlacement pin passed as if it were a coordinate', () => {
    // mapPlacement is {mapId, x, y} with x and y in 0..1 on an authored image.
    // Those numbers are inside the legal latitude/longitude range, which is
    // exactly why the concepts must never be interchanged — so the guard here
    // is the API shape, checked below, not the numbers.
    const placement = { mapId: 'sector-79', x: 0.42, y: 0.61 };
    // @ts-expect-error a mapPlacement is not a coordinate and cannot be passed as one
    expect(h.telemetry.locationConfirmed(placement)).toBe(false);
    expect(h.events).toEqual([]);
  });

  it('has no code path that turns a map placement into a coordinate', () => {
    const module = code('src/apps/dealer/add-property-telemetry.ts');
    // The confirmation path may not so much as name a raster placement.
    const confirm = module.slice(
      module.indexOf('locationConfirmed('),
      module.indexOf('persisted(facts'),
    );
    for (const raster of ['mapPlacement', 'sectorPin', 'pinX', 'pinY', 'sectorMapId']) {
      expect(confirm).not.toContain(raster);
    }
    // Elsewhere the placement appears only as a boolean fact about a property
    // that already saved — `hasMapPlacement` — never as a coordinate input.
    expect(module).not.toMatch(/mapPlacement\s*[.[]/);
    expect(module).not.toContain('mapPlacement.x');
    expect(module).not.toContain('mapPlacement.y');
  });

  it('refuses non-finite, out-of-range and non-numeric input', () => {
    for (const [lat, lng] of [
      [Number.NaN, 76.7], [30.7, Number.POSITIVE_INFINITY],
      [91, 76.7], [-91, 76.7], [30.7, 181], [30.7, -181],
      ['30.7', '76.7'], [undefined, undefined], [null, null],
    ] as const) {
      expect(h.telemetry.locationConfirmed(lat, lng)).toBe(false);
    }
    expect(h.events).toEqual([]);
  });

  it('uses the same validator the canonical location write uses', () => {
    // desk-store gates the canonical `location` column on isRealCoordinate,
    // which is coordinateValidationError with the same bounds. The event and
    // the column therefore become eligible at exactly the same instant.
    const module = source('src/apps/dealer/add-property-telemetry.ts');
    expect(module).toContain('coordinateValidationError');
    const store = source('src/apps/dealer/desk-store.ts');
    expect(store).toContain('isRealCoordinate(form.lat, form.lng)');
  });
});

describe('telemetry can never break Add Property', () => {
  it('swallows a sink that throws', () => {
    const telemetry = new AddPropertyTelemetry(() => { throw new Error('analytics is down'); });
    expect(() => {
      telemetry.openedForAdd();
      telemetry.locationConfirmed(30.7, 76.7, 'click');
      telemetry.persisted({ propertyId: 'P1', lifecycle: 'on-sale' });
      telemetry.persistFailed('draft', 'network');
      telemetry.abandoned(1);
    }).not.toThrow();
  });

  it('returns nothing awaitable, so no caller can block on it', () => {
    const telemetry = new AddPropertyTelemetry(() => {});
    expect(telemetry.openedForAdd()).toBeUndefined();
    expect(telemetry.persisted({ lifecycle: 'draft' })).toBeUndefined();
    expect(telemetry.persistFailed('draft', 'network')).toBeUndefined();
    expect(telemetry.abandoned(1)).toBeUndefined();
    expect(telemetry.closed()).toBeUndefined();
  });

  it('is wired into the Desk without ever being awaited', () => {
    const wiring = source('src/apps/dealer/logic.ts');
    expect(wiring).toMatch(/void Promise\.resolve\(\)[\s\S]{0,160}\.catch\(\(\) => \{\}\)/);
    expect(wiring).not.toMatch(/await\s+addPropertyTelemetry/);
  });

  it('is wired at every boundary the workflow actually crosses', () => {
    const wiring = source('src/apps/dealer/logic.ts');
    expect(wiring).toContain('addPropertyTelemetry.openedForAdd()');
    expect(wiring).toContain('addPropertyTelemetry.openedForEdit(id)');
    expect(wiring).toContain("addPropertyTelemetry.persistFailed('on_sale', result.errorCode)");
    expect(wiring).toContain("addPropertyTelemetry.persistFailed('draft', result.errorCode)");
    expect(wiring).toContain('addPropertyTelemetry.abandoned(this.state.pstep)');
    // The single confirmation point, inside pEarthConfirm and after its check.
    expect(wiring).toContain('addPropertyTelemetry.locationConfirmed(Number(f.lat), Number(f.lng), f.pinSource)');
    expect(wiring.match(/addPropertyTelemetry\.locationConfirmed/g)).toHaveLength(1);
  });

  it('emits the success only after the store returned a saved property', () => {
    const wiring = source('src/apps/dealer/logic.ts');
    const savePlot = wiring.slice(wiring.indexOf('async savePlot('), wiring.indexOf('async saveDraft('));
    const failedAt = savePlot.indexOf("persistFailed('on_sale'");
    const savedAt = savePlot.indexOf('const saved = result.property;');
    const completedAt = savePlot.indexOf('addPropertyTelemetry.persisted({');
    expect(failedAt).toBeGreaterThan(-1);
    expect(savedAt).toBeGreaterThan(failedAt);
    expect(completedAt).toBeGreaterThan(savedAt);
  });
});

describe('the emitter reaches the database as the real dealer', () => {
  const rpc = vi.fn();

  async function emitterWithClient(client: unknown) {
    vi.resetModules();
    vi.doMock('../src/packages/data/supabase/client', () => ({
      getSupabase: async () => client,
      readEnv: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
      assertPublishableKey: () => {},
    }));
    const mod = await import('../src/packages/data/supabase/supabase-adapter');
    mod.resetTelemetryIdentityCache();
    return new mod.SupabaseDataAdapter().presentationEvents;
  }

  function signedInClient() {
    return {
      rpc,
      auth: { getUser: async () => ({ data: { user: { id: 'u1', app_metadata: { dealer_id: 'DLR-1' } } }, error: null }) },
    };
  }

  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });

  it('sends the real dealer, a stable session and the build stamp', async () => {
    const events = await emitterWithClient(signedInClient());
    const result = await events.record({
      kind: 'property_added', outcome: 'completed', at: '2026-09-04T00:00:00.000Z',
      propertyId: 'P1', durationMs: 1_500, metadata: { flow: 'add', lifecycle: 'on-sale' },
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('plotmap_record_presentation_event');
    expect(args.p_dealer_id).toBe('DLR-1');
    expect(args.p_dealer_id).not.toBe('');
    expect(args.p_session_id).toMatch(/^[a-z0-9]{16,128}$/);
    expect(args.p_event_type).toBe('property_added');
    expect(args.p_property_id).toBe('P1');
    expect(args.p_created_at).toBe('2026-09-04T00:00:00.000Z');
    expect(args.p_metadata).toEqual({
      flow: 'add', lifecycle: 'on-sale', _build: 'dev', _outcome: 'completed', _duration_ms: 1_500,
    });
  });

  it('resolves the dealer once per tab, not once per event', async () => {
    const client = signedInClient();
    const getUser = vi.spyOn(client.auth, 'getUser');
    const events = await emitterWithClient(client);
    for (let i = 0; i < 5; i += 1) {
      await events.record({ kind: 'property_add_clicked', outcome: 'started', at: '2026-09-04T00:00:00.000Z' });
    }
    expect(rpc).toHaveBeenCalledTimes(5);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('keeps the same session id across events in one tab', async () => {
    const events = await emitterWithClient(signedInClient());
    await events.record({ kind: 'app_open', at: '2026-09-04T00:00:00.000Z' });
    await events.record({ kind: 'app_open', at: '2026-09-04T00:00:01.000Z' });
    expect(rpc.mock.calls[0][1].p_session_id).toBe(rpc.mock.calls[1][1].p_session_id);
  });

  it('does not cache a failed lookup, so a later signed-in event still works', async () => {
    let user: unknown = null;
    const events = await emitterWithClient({
      rpc,
      auth: { getUser: async () => ({ data: { user }, error: null }) },
    });
    await events.record({ kind: 'app_open', at: '2026-09-04T00:00:00.000Z' });
    expect(rpc).not.toHaveBeenCalled();

    user = { id: 'u1', app_metadata: { dealer_id: 'DLR-1' } };
    await events.record({ kind: 'app_open', at: '2026-09-04T00:00:01.000Z' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('reports ok when the RPC rejects the event', async () => {
    const events = await emitterWithClient(signedInClient());
    rpc.mockResolvedValue({ error: { message: 'unknown event type' } });
    await expect(events.record({ kind: 'property_added', at: 'x' })).resolves.toEqual({ ok: true, value: undefined });
  });

  it('reports ok when the transport throws, so a save is never blocked', async () => {
    const events = await emitterWithClient({
      rpc: vi.fn().mockRejectedValue(new Error('offline')),
      auth: { getUser: async () => ({ data: { user: { id: 'u1', app_metadata: { dealer_id: 'DLR-1' } } }, error: null }) },
    });
    await expect(events.record({ kind: 'property_added', at: 'x' })).resolves.toEqual({ ok: true, value: undefined });
  });

  it('reports ok when Supabase is not configured at all', async () => {
    const events = await emitterWithClient(null);
    await expect(events.record({ kind: 'property_added', at: 'x' })).resolves.toEqual({ ok: true, value: undefined });
  });

  it('never returns an error result on any path', async () => {
    const source = readFileSync(
      new URL('../src/packages/data/supabase/supabase-adapter.ts', import.meta.url), 'utf8');
    const body = source.slice(
      source.indexOf('class SupaPresentationEvents'),
      source.indexOf('class SupaPredictive'),
    );
    expect(body).toContain('return ok(undefined)');
    expect(body).not.toContain('return err(');
    expect(body).not.toContain('toErr(');
    expect(body).not.toContain('throw');
  });
});
