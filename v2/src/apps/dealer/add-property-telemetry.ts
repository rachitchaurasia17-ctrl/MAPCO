/* ═══════════════════════════════════════════════════════════════
   Dealer Desk — Add Property evidence
   ---------------------------------------------------------------
   The first real business workflow DealSetu records truthfully.

   This lives outside logic.ts on purpose. logic.ts is 437 KB under
   `// @ts-nocheck`; a decision buried in it cannot be typechecked
   and cannot be tested without standing up the whole Desk. Every
   decision about WHETHER an event is true is therefore made here,
   and logic.ts only reports what happened.

   Two rules the tests hold this module to:

     1. property_location_pinned is emitted only for a coordinate
        that passes the SAME predicate the canonical write uses
        (coordinateValidationError from property-location.ts, which
        is what desk-store's isRealCoordinate mirrors). A pin
        dropped on a raster sector sheet is a mapPlacement — an
        {mapId, x, y} image placement — and this module has no API
        that accepts one, so it can never produce this event.

     2. Nothing here can break Add Property. Every emit is wrapped;
        a sink that throws is swallowed, and no method returns a
        promise the caller could accidentally await.
   ═══════════════════════════════════════════════════════════════ */
import { coordinateValidationError } from '../../packages/data/property-location';
import type {
  PresentationEvent,
  PresentationEventMetadata,
  PresentationEventOutcome,
  RepoError,
  RepoErrorCode,
} from '../../packages/data/contracts';
import { errorKind } from '../../packages/data/telemetry';

/** How the dealer reached the coordinate. Recorded where it happens, because
 *  by the time Confirm is pressed the origin is no longer knowable. */
export type PinSource = 'click' | 'drag' | 'search';

/** Which persistence attempt failed. Not an error message. */
export type PersistStage = 'on_sale' | 'draft';

export type PropertyLifecycle = 'on-sale' | 'draft' | 'archived';

export type EmitEvent = (event: PresentationEvent) => void;

export interface PersistedFacts {
  readonly propertyId?: string;
  /** Lifecycle AT CREATION. The Desk re-saves on every step and the close
   *  button saves a draft, so this is not necessarily the final state. */
  readonly lifecycle: PropertyLifecycle;
  /** The dealer asked for On sale and the record was held back as a Draft. */
  readonly downgraded?: boolean;
  /** A normalised pin on an authored raster sheet. Not a coordinate. */
  readonly hasMapPlacement?: boolean;
  /** A canonical WGS84 coordinate persisted on the saved row.
   *
   *  Distinct from a property_location_pinned event. "Confirm this spot" is
   *  not a gate in the Desk — desk-store persists a coordinate whenever
   *  isRealCoordinate(lat, lng) holds — so a dealer can tap the map and save
   *  without confirming. The event means he deliberately confirmed; this
   *  boolean means the row ended up geolocated. Both are worth having, and
   *  collapsing them would overstate one or lose the other. */
  readonly hasLocation?: boolean;
  readonly photoCount?: number;
}

type Flow = 'add' | 'edit';

export class AddPropertyTelemetry {
  private flow: Flow | null = null;
  private startedAt = 0;
  private persistedOnce = false;
  private failedOnce = false;
  private propertyId: string | undefined;

  constructor(
    private readonly emit: EmitEvent,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** The dealer opened Add Property for a NEW record. */
  openedForAdd(): void {
    this.flow = 'add';
    this.startedAt = this.now();
    this.persistedOnce = false;
    this.failedOnce = false;
    this.propertyId = undefined;
    this.send('property_add_clicked', 'started', { flow: 'add' });
  }

  /** The same overlay opened on an existing property. Editing is not adding,
   *  so it produces no add-flow events at all. */
  openedForEdit(propertyId?: string): void {
    this.flow = 'edit';
    this.startedAt = this.now();
    this.persistedOnce = false;
    this.failedOnce = false;
    this.propertyId = propertyId;
  }

  /**
   * The dealer explicitly confirmed a WGS84 coordinate on the live satellite
   * map. Moving the marker, clicking the map or picking a search result only
   * produces a CANDIDATE; this is the moment it becomes canonical, and it is
   * the same moment the canonical location column becomes eligible to be
   * written. Returns whether the coordinate was accepted.
   */
  locationConfirmed(latitude: unknown, longitude: unknown, source?: PinSource): boolean {
    if (coordinateValidationError(latitude, longitude) !== null) return false;
    this.send('property_location_pinned', 'completed', {
      flow: this.flow ?? 'add',
      ...(source ? { pin_source: source } : {}),
      is_edit: this.flow === 'edit',
    });
    return true;
  }

  /** A property row genuinely persisted. Emitted once per add flow: the Desk
   *  re-saves on every step advance, and those are updates, not additions. */
  persisted(facts: PersistedFacts): void {
    if (facts.propertyId) this.propertyId = facts.propertyId;
    if (this.flow !== 'add' || this.persistedOnce) return;
    this.persistedOnce = true;
    this.send('property_added', 'completed', {
      flow: 'add',
      lifecycle: facts.lifecycle,
      ...(facts.downgraded === undefined ? {} : { downgraded: facts.downgraded }),
      ...(facts.hasMapPlacement === undefined ? {} : { has_map_placement: facts.hasMapPlacement }),
      ...(facts.hasLocation === undefined ? {} : { has_location: facts.hasLocation }),
      ...(facts.photoCount === undefined ? {} : { photo_count: facts.photoCount }),
    });
  }

  /** A persistence attempt actually failed. Only the error CODE travels, and
   *  errorKind() discards anything that is not one of the repository's own
   *  closed codes — so a raw message passed here becomes 'unknown'. */
  persistFailed(stage: PersistStage, error?: RepoErrorCode | Pick<RepoError, 'code'> | null): void {
    if (this.flow !== 'add' || this.failedOnce) return;
    this.failedOnce = true;
    this.send('property_added', 'failed', {
      flow: 'add',
      stage,
      error_kind: errorKind(error),
    });
  }

  /**
   * The dealer closed Add Property and nothing was written. This is the only
   * abandonment the Desk can observe: Close runs Save as Draft, so every other
   * exit persists a real row. A crash, a refresh, a lost network or a
   * backgrounded tab reaches no handler at all and is deliberately not guessed.
   */
  abandoned(step?: number): void {
    if (this.flow !== 'add' || this.persistedOnce) return;
    const flow = this.flow;
    this.flow = null;
    this.send('property_add_clicked', 'abandoned', {
      flow,
      ...(typeof step === 'number' ? { step } : {}),
    }, this.startedAt);
  }

  /** The overlay closed after a real write. Ends the flow without an event. */
  closed(): void {
    this.flow = null;
    this.startedAt = 0;
  }

  private send(
    kind: PresentationEvent['kind'],
    outcome: PresentationEventOutcome,
    metadata: PresentationEventMetadata,
    startedAt: number = this.startedAt,
  ): void {
    try {
      const at = new Date(this.now()).toISOString();
      this.emit({
        kind,
        outcome,
        at,
        metadata,
        ...(this.propertyId ? { propertyId: this.propertyId } : {}),
        ...(startedAt ? { durationMs: Math.max(0, this.now() - startedAt) } : {}),
      });
    } catch {
      // Evidence collection is best effort. A broken sink must never surface
      // as "could not save this property".
    }
  }
}
