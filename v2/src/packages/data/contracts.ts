/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Data Architecture Contracts
   ---------------------------------------------------------------
   The single boundary every UI module talks to. UI modules import
   ONLY from here (and types.ts). They must never import Supabase,
   IndexedDB, or know whether data is online/offline.

   Pass 2 will add:
     - SupabaseAdapter        (implements these same interfaces)
     - IndexedDbAdapter       (lightweight offline read cache)
     - SyncQueue              (controlled write queue)
   ...without touching a single screen component, because screens
   depend on the interfaces below, not on any concrete adapter.

   Sources: 08_DATA_MODEL_AND_ADAPTERS, 20_SECURITY_INVARIANTS,
            21_REUSE_ADAPT_REWRITE_PROHIBIT, 22_V2_ARCHITECTURE
   ═══════════════════════════════════════════════════════════════ */

import type {
  Property, PropertyLocationInput, Client, Deal, ClientLink, MapData, DemandSignal,
  Seller, PropertySeller, SellerWithProperties, SellerDirectoryEntry, SellerWorkspace,
  PropertyDocument, PropertyDocumentType,
  PropertyDocumentVisibility, PropertyDocumentSafety,
  LinkStatus,
  PipelineDeal, DealCommission, DealNextAction, DealStageTransition,
  DealPayment, DealPaymentKind, DealWorkspace,
} from './types';

/* ───────────────────────────────────────────────────────────────
   1. STRUCTURED RESULT / ERROR TYPES
   Async repo methods never throw for expected failures — they
   return a discriminated Result so the UI can render a real error
   state instead of an unhandled rejection.
   ─────────────────────────────────────────────────────────────── */

export type RepoErrorCode =
  | 'network'          // transport failed / offline with no cache
  | 'unauthorized'     // no/invalid session
  | 'forbidden'        // role/scope mismatch
  | 'not_found'        // resource absent
  | 'gone'             // link/token expired or revoked
  | 'rate_limited'
  | 'conflict'         // optimistic-concurrency clash (Pass 2 sync)
  | 'validation'       // bad input
  | 'aborted'          // AbortSignal fired
  | 'unavailable'      // asset/backend temporarily unavailable
  | 'unknown';

export interface RepoError {
  readonly code: RepoErrorCode;
  readonly message: string;
  /** true when a retry might succeed (network, rate_limited, unavailable). */
  readonly retryable: boolean;
  /** optional machine detail for logging — never rendered to buyers. */
  readonly detail?: string;
}

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err = { readonly ok: false; readonly error: RepoError };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (
  code: RepoErrorCode,
  message: string,
  opts: { retryable?: boolean; detail?: string } = {},
): Err => ({
  ok: false,
  error: {
    code,
    message,
    retryable: opts.retryable ?? (code === 'network' || code === 'rate_limited' || code === 'unavailable'),
    detail: opts.detail,
  },
});

/* ───────────────────────────────────────────────────────────────
   2. CURSOR PAGINATION
   Large collections (properties, clients, deals, demand, events)
   are paginated so screens never hold unbounded arrays and Pass 2
   can back this with Supabase keyset pagination unchanged.
   ─────────────────────────────────────────────────────────────── */

export interface PageParams {
  /** opaque cursor from a previous Page.nextCursor; undefined = first page. */
  readonly cursor?: string;
  /** hard page size cap enforced by the adapter. */
  readonly limit?: number;
  /** free-text search applied before pagination. */
  readonly query?: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  /** pass back as PageParams.cursor to fetch the next page; null = end. */
  readonly nextCursor: string | null;
  /** total is best-effort; may be undefined for expensive backends. */
  readonly total?: number;
}

/** Options shared by every async repo call. */
export interface QueryOptions {
  readonly signal?: AbortSignal;
}

/* ───────────────────────────────────────────────────────────────
   3. TYPED ASYNC STATE (for UI)
   Every page component receives one of these — never raw data and
   never backend logic. This is how loading/empty/error/no-result
   become first-class instead of alert() placeholders.
   ─────────────────────────────────────────────────────────────── */

export type AsyncState<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'empty' }              // loaded, nothing exists
  | { readonly kind: 'no-results' }         // loaded, filter/search excluded all
  | { readonly kind: 'error'; readonly error: RepoError };

export const State = {
  idle: <T>(): AsyncState<T> => ({ kind: 'idle' }),
  loading: <T>(): AsyncState<T> => ({ kind: 'loading' }),
  ready: <T>(data: T): AsyncState<T> => ({ kind: 'ready', data }),
  empty: <T>(): AsyncState<T> => ({ kind: 'empty' }),
  noResults: <T>(): AsyncState<T> => ({ kind: 'no-results' }),
  error: <T>(error: RepoError): AsyncState<T> => ({ kind: 'error', error }),
};

/** Map a Result into an AsyncState<T[]>, choosing empty vs no-results. */
export function pageToState<T>(
  r: Result<Page<T>>,
  opts: { filtered?: boolean } = {},
): AsyncState<Page<T>> {
  if (!r.ok) return { kind: 'error', error: r.error };
  if (r.value.items.length === 0) {
    return { kind: opts.filtered ? 'no-results' : 'empty' };
  }
  return { kind: 'ready', data: r.value };
}

/* ───────────────────────────────────────────────────────────────
   4. FUTURE SYNC METADATA (typed now, implemented in Pass 2)
   Screens may read these fields to show "offline / pending" chips
   later. No sync is implemented in Pass 1.
   ─────────────────────────────────────────────────────────────── */

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'local-only';

export interface SyncMeta {
  readonly status: SyncStatus;
  /** monotonic server revision, if known. */
  readonly rev?: number;
  /** ISO timestamp of last successful server sync. */
  readonly syncedAt?: string;
}

/** Wrap any entity with optional sync metadata without changing the entity. */
export type Synced<T> = T & { readonly _sync?: SyncMeta };

/* ───────────────────────────────────────────────────────────────
   5. AUTH / ACCOUNT / DEVICE STATE CONTRACTS
   Landing + gating screens render off these typed states only.
   ─────────────────────────────────────────────────────────────── */

export type ActivationState =
  | { readonly kind: 'required' }
  | { readonly kind: 'validating' }
  | { readonly kind: 'invalid-code' }
  | { readonly kind: 'expired-code' }
  | { readonly kind: 'device-approval-required' }
  | { readonly kind: 'device-limit-reached'; readonly max: number }
  | { readonly kind: 'activated' }
  | { readonly kind: 'error'; readonly error: RepoError };

export type AccountState =
  | { readonly kind: 'active' }
  | { readonly kind: 'trial'; readonly daysLeft: number }
  | { readonly kind: 'trial-ending'; readonly daysLeft: number }
  | { readonly kind: 'expired' }
  | { readonly kind: 'suspended' }
  | { readonly kind: 'access-denied' }
  | { readonly kind: 'role-mismatch'; readonly need: string };

export interface AuthRepository {
  getActivationState(opts?: QueryOptions): Promise<Result<ActivationState>>;
  submitActivationCode(code: string, opts?: QueryOptions): Promise<Result<ActivationState>>;
  getAccountState(opts?: QueryOptions): Promise<Result<AccountState>>;
}

/* ───────────────────────────────────────────────────────────────
   6. RECORD REPOSITORIES (properties / customers / deals)
   ─────────────────────────────────────────────────────────────── */

export interface PropertyRepository {
  list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Property>>>;
  get(id: string, opts?: QueryOptions): Promise<Result<Property>>;
  /** Create or update a property (dealer-scoped). */
  save(property: Property, opts?: QueryOptions): Promise<Result<Property>>;
  /**
   * DESTRUCTIVE. Take a dealer-scoped property out of the product for good:
   * after this the record is unreachable through every repository read.
   *
   * This is NOT the dealer's Delete. Removing a property the dealer never
   * sold is the 'unsold' lifecycle, written through `save`, and it is
   * recoverable. Call this only for a genuine permanent destruction — the
   * Desk reaches it solely from a record already in Unsold, after purging
   * that property's private papers and photo objects — or for internal
   * cleanup such as discarding a test fixture.
   */
  remove(id: string, opts?: QueryOptions): Promise<Result<void>>;
  /** Atomically set or clear the canonical real-world location. */
  setLocation(id: string, location: PropertyLocationInput | null, opts?: QueryOptions): Promise<Result<Property>>;
}

export interface CustomerRepository {
  list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Client>>>;
  get(id: string, opts?: QueryOptions): Promise<Result<Client>>;
  /** Create or update a customer (dealer-scoped). */
  save(client: Client, opts?: QueryOptions): Promise<Result<Client>>;
}

export interface SaveSellerInput extends Omit<Seller, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export interface AssignPropertySellerInput extends Omit<PropertySeller, 'id'> {
  id?: string;
}

/** Dealer-private reusable sellers and their canonical property relationships. */
export interface SellerRepository {
  list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Seller>>>;
  get(id: string, opts?: QueryOptions): Promise<Result<Seller>>;
  getWithProperties(id: string, opts?: QueryOptions): Promise<Result<SellerWithProperties>>;
  getForProperty(propertyId: string, opts?: QueryOptions): Promise<Result<readonly { seller: Seller; relationship: PropertySeller }[]>>;
  save(input: SaveSellerInput, opts?: QueryOptions): Promise<Result<Seller>>;
  assignToProperty(input: AssignPropertySellerInput, opts?: QueryOptions): Promise<Result<PropertySeller>>;
  removeFromProperty(propertyId: string, sellerId: string, opts?: QueryOptions): Promise<Result<void>>;

  /**
   * The whole Sellers list with live/sold counts per seller, assembled in
   * one round trip. Prefer this over list() + a query per seller.
   */
  directory(includeArchived?: boolean, opts?: QueryOptions): Promise<Result<readonly SellerDirectoryEntry[]>>;
  /** A Seller profile — the seller plus its active and sold properties. */
  workspace(sellerId: string, opts?: QueryOptions): Promise<Result<SellerWorkspace>>;
  /**
   * Archive or restore. Non-destructive: relationships, documents and deal
   * references survive. Refused while the seller still holds active
   * properties, so sold history can never be orphaned by accident.
   */
  setArchived(sellerId: string, archived: boolean, opts?: QueryOptions): Promise<Result<void>>;
}

export interface UploadPropertyDocumentInput {
  propertyId: string;
  title: string;
  type: PropertyDocumentType;
  visibility?: PropertyDocumentVisibility;
  safety?: PropertyDocumentSafety;
  metadata?: Readonly<Record<string, string>>;
}

/** Documents remain private records even when the property becomes sold. */
export interface PropertyDocumentRepository {
  listForProperty(propertyId: string, opts?: QueryOptions): Promise<Result<readonly PropertyDocument[]>>;
  get(id: string, opts?: QueryOptions): Promise<Result<PropertyDocument>>;
  upload(input: UploadPropertyDocumentInput, file: File, opts?: QueryOptions): Promise<Result<PropertyDocument>>;
  remove(id: string, opts?: QueryOptions): Promise<Result<void>>;
}

/**
 * Input for recording a COMPLETED sale. This is the only way a Deal is
 * created — there is no free-form "add deal". On success the adapter must,
 * as one atomic unit: mark the property Sold (removing it from available
 * inventory, Client Presentation and future Client Links), create the Deal,
 * and add the property to the buyer's purchased history.
 */
export interface RecordSaleInput {
  propertyId: string;
  /** existing customer id, or provide newBuyer to create one. */
  buyerId?: string;
  newBuyer?: { name: string; phone: string; city?: string };
  /** seller confirmed from the property's private owner details, when recorded. */
  seller?: string;
  sellerPhone?: string;
  soldPrice: number;
  saleDate: string;            // ISO yyyy-mm-dd
  registrationDate?: string;   // ISO yyyy-mm-dd
  brokerage?: number;
  commission?: number;
  commissionReceived?: boolean;
  paymentReceived?: number;
  documents?: { name: string; kind?: string }[];
}

/** Start a deal from an existing Client + Property. Neither is duplicated. */
export interface StartDealInput {
  propertyId: string;
  /** existing canonical client id, or provide newBuyer to create a minimal one. */
  buyerId?: string;
  newBuyer?: { name: string; phone?: string };
  /** A deal may open at negotiating, token or registry — never at closed. */
  stage?: 'negotiating' | 'token' | 'registry';
  value?: number;
  commission?: Partial<DealCommission>;
  nextAction?: DealNextAction;
}

export interface SetDealStageInput {
  dealId: string;
  stage: DealStageTransition;
  /** Required when moving to `lost`; persisted so the deal never disappears. */
  reason?: string;
  tokenDate?: string;
  registryDate?: string;
  note?: string;
}

export interface RecordDealPaymentInput {
  dealId: string;
  kind: DealPaymentKind;
  amount: number;
  /** ISO yyyy-mm-dd; defaults to today when omitted. */
  receivedOn?: string;
  note?: string;
}

export interface DealRepository {
  /** The completed-sales register. */
  list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Deal>>>;
  get(id: string, opts?: QueryOptions): Promise<Result<Deal>>;
  /**
   * Record a completed sale as a single safe transaction. Partial completion
   * must be impossible: either the property, deal and buyer history all update,
   * or none do. When an open pipeline deal already exists for the same buyer
   * and property it is COMPLETED in place rather than duplicated.
   */
  record(input: RecordSaleInput, opts?: QueryOptions): Promise<Result<Deal>>;

  /* ── pipeline ── */

  /** Deals in flight, newest first. Completed sales are not included. */
  listPipeline(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<PipelineDeal>>>;
  /**
   * Open a deal on a canonical Client + Property. Seller context is inherited
   * through the property↔seller relationship — never re-entered. Re-issuing
   * the same start returns the existing open deal instead of a duplicate.
   */
  start(input: StartDealInput, opts?: QueryOptions): Promise<Result<PipelineDeal>>;
  /** Persist a stage transition and append it to the deal's history. */
  setStage(input: SetDealStageInput, opts?: QueryOptions): Promise<Result<PipelineDeal>>;
  /** Append a token or commission receipt to the deal's money ledger. */
  recordPayment(input: RecordDealPaymentInput, opts?: QueryOptions): Promise<Result<DealPayment>>;
  /** Everything the Deal room renders, in one dealer-private round trip. */
  workspace(dealId: string, opts?: QueryOptions): Promise<Result<DealWorkspace>>;
}

/* ───────────────────────────────────────────────────────────────
   7. DEMAND (full frontend contract)
   Placement per blueprint: Demand is a dealer record surface, not a
   standalone public URL. It lives inside the dealer app alongside
   Properties/Customers/Deals and is matched against the property
   repository. Fixtures are deterministic — never fabricated live
   market intelligence or random matches.
   ─────────────────────────────────────────────────────────────── */

export type RequirementCategory = 'buy' | 'rent' | 'invest';
export type Urgency = 'immediate' | 'this-quarter' | 'exploring';
export type FollowUpStatus = 'new' | 'contacted' | 'visit-planned' | 'closed';
export type DemandInternalStatus = 'open' | 'on-hold' | 'fulfilled' | 'lost';

export interface DemandRecord {
  readonly id: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly category: RequirementCategory;
  readonly preferredLocations: readonly string[];
  readonly propertyType: Property['type'];
  readonly sizeMin?: string;
  readonly sizeMax?: string;
  readonly configuration?: string;      // e.g. "3 BHK", "1 kanal"
  readonly budgetMin: number;
  readonly budgetMax: number;
  readonly urgency: Urgency;
  readonly followUp: FollowUpStatus;
  readonly status: DemandInternalStatus;
  readonly note?: string;
}

export interface DemandMatch {
  readonly property: Property;
  /** 0..1 deterministic score derived from budget/type/location overlap. */
  readonly score: number;
  readonly reasons: readonly string[];
}

/** Input for create/edit drawer. id omitted → create. */
export type DemandDraft = Omit<DemandRecord, 'id' | 'customerName'> & {
  readonly id?: string;
};

export interface DemandRepository {
  list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<DemandRecord>>>;
  get(id: string, opts?: QueryOptions): Promise<Result<DemandRecord>>;
  /** Deterministic matching against the property repository. */
  match(id: string, opts?: QueryOptions): Promise<Result<DemandMatch[]>>;
  save(draft: DemandDraft, opts?: QueryOptions): Promise<Result<DemandRecord>>;
}

/* ───────────────────────────────────────────────────────────────
   8. MAP REGISTRY / PRESENTATION / EVENTS
   ─────────────────────────────────────────────────────────────── */

export interface MapRepository {
  /** metadata only — never the raster bytes, so lists stay light. */
  listRegistry(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Omit<MapData, 'sets'>>>>;
  /** Dealer-scoped editor catalog, including drafts needed for exact placement relationships. */
  listPlacementCatalog(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Omit<MapData, 'sets'>>>>;
  /** full map with mark sets, loaded only when a map is opened. */
  get(id: string, opts?: QueryOptions): Promise<Result<MapData>>;
}

export type PresentationState =
  | { readonly kind: 'maps-loading' }
  | { readonly kind: 'no-map' }
  | { readonly kind: 'no-properties' }
  | { readonly kind: 'ready'; readonly maps: readonly Omit<MapData, 'sets'>[] }
  | { readonly kind: 'selected-unavailable' }
  | { readonly kind: 'map-asset-failed' }
  | { readonly kind: 'overlay-unavailable' }
  | { readonly kind: 'error'; readonly error: RepoError };

/**
 * Server-projected property shape for the dealer's client-facing presentation.
 * It deliberately cannot carry price, owner, views, internal status, canonical
 * coordinates, or storage object paths. Earth availability is a boolean; the
 * product handoff remains the property ID.
 */
export interface PresentationProperty {
  readonly id: string;
  readonly type: string;
  readonly city: string;
  readonly area: string;
  readonly loc: string;
  readonly sector: string;
  readonly size: string;
  readonly facing: string;
  readonly position: string;
  readonly approvals: readonly string[];
  readonly landmarks: readonly { readonly name: string; readonly distance: string; readonly icon: string }[];
  readonly photos: readonly string[];
  readonly masterplanId?: string;
  readonly sectorMapId?: string;
  readonly mapPlacement?: { readonly mapId: string; readonly x: number; readonly y: number };
  readonly hasEarthLocation: boolean;
}

export interface PresentationRepository {
  getState(opts?: QueryOptions): Promise<Result<PresentationState>>;
  /** Published, client-visible map registry projected by the server. */
  listMaps(opts?: QueryOptions): Promise<Result<readonly Omit<MapData, 'sets'>[]>>;
  /** One published client-visible map plus published highlight sets only. */
  getMap(id: string, opts?: QueryOptions): Promise<Result<MapData>>;
  /** Published, unsold, client-visible properties projected by the server. */
  listProperties(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<PresentationProperty>>>;
  /** Safe deep-link resolution; never falls back to the dealer CRM payload. */
  getProperty(id: string, opts?: QueryOptions): Promise<Result<PresentationProperty>>;
}

export type PresentationEventKind =
  | 'opened' | 'map-changed' | 'property-viewed' | 'gallery-opened' | 'closed';

export interface PresentationEvent {
  readonly kind: PresentationEventKind;
  readonly propertyId?: string;
  readonly mapId?: string;
  /** ISO timestamp supplied by caller (Date is not created inside repos). */
  readonly at: string;
}

export interface PresentationEventsRepository {
  /** fire-and-forget analytics; never blocks the UI. */
  record(event: PresentationEvent, opts?: QueryOptions): Promise<Result<void>>;
}

/** Dealer-only operational telemetry used by the transparent priority loader.
 * It is intentionally separate from customer-facing presentation analytics. */
export interface PredictiveRepository {
  record(event: import('../performance').PredictiveActionEvent, opts?: QueryOptions): Promise<Result<void>>;
  summaries(opts?: QueryOptions): Promise<Result<readonly import('../performance').DealerPredictionSummary[]>>;
}

/* ───────────────────────────────────────────────────────────────
   9. CLIENT LINKS + CLIENT-SAFE (BUYER) TYPES
   SECURITY INVARIANT (20_SECURITY_INVARIANTS):
   The buyer payload TYPE cannot contain seller phone/identity,
   commission, negotiation/internal notes, team info, owner-only
   info, or internal property status. These fields are ABSENT from
   the type and the payload — not hidden with CSS.
   ─────────────────────────────────────────────────────────────── */

/** A single landmark, safe to show a buyer. */
export interface ClientSafeLandmark {
  readonly name: string;
  readonly distance: string;
  readonly icon: string;
}

/**
 * The ONLY property shape a buyer page may ever receive.
 * Note what is deliberately NOT here: no `views`, no `published`,
 * no `sold` (internal status), no owner/seller phone, no price
 * unless the link explicitly reveals it, no commission, no notes.
 */
export interface ClientSafeProperty {
  readonly id: string;
  readonly area: string;
  /** Present only when the link's location visibility permits it. */
  readonly loc?: string;
  readonly size: string;
  readonly facing: string;
  readonly position: string;
  /** approved photos only. */
  readonly photos: readonly string[];
  /** Present only when the link's price visibility is 'shown'. */
  readonly price?: number;
  readonly approvals: readonly string[];
  readonly landmarks: readonly ClientSafeLandmark[];
  /** Precise-location only: the property's city + sector so the client page can
   *  show it on the city masterplan and the sector map, with its pin if placed. */
  readonly mapCity?: string;
  readonly mapSector?: string;
  readonly masterplanId?: string;
  readonly sectorMapId?: string;
  readonly placement?: { readonly mapId: string; readonly x: number; readonly y: number };
  /**
   * Buyer-safe Property Intelligence, attached server-side by
   * resolve-client-link. It has already passed through
   * toBuyerSafeIntelligence, so with anything other than an exact
   * location it carries no origin, no coordinates, no polylines and no
   * distances — exact distances to several known places would
   * trilaterate the property. Absent when the property has no generated
   * intelligence.
   */
  readonly intelligence?: import('../property-intelligence').PropertyIntelligenceViewModel;
}

/** Token-scoped, client-visible map metadata. No overlays or dealer catalog rows. */
export interface ClientSafeMap {
  readonly id: string;
  readonly kind: 'masterplan' | 'sector';
  readonly city?: string;
  readonly sector?: string;
  readonly area?: string;
  readonly label?: string;
  readonly parentMapId?: string;
  readonly raster: string;
  readonly assets?: {
    readonly original?: { readonly path: string; readonly w?: number; readonly h?: number };
    readonly threeD?: { readonly path: string; readonly w?: number; readonly h?: number };
  };
  readonly dims?: {
    readonly original?: { readonly w: number; readonly h: number };
    readonly threeD?: { readonly w: number; readonly h: number };
  };
}

export interface ClientSafePayload {
  readonly dealerDisplayName: string;      // display name only, never phone/identity record
  /** The DEALER's own public contact so the buyer can reach them (Call/WhatsApp).
   *  This is the dealer's contact, never the seller's — the seller stays private. */
  readonly dealerPhone?: string;
  readonly dealerWhatsapp?: string;
  /** The first name the link was personalised for (footer: "for <name>"). */
  readonly buyerName?: string;
  readonly properties: readonly ClientSafeProperty[];
  /** Only maps reachable through this link's exact-location properties. */
  readonly maps?: readonly ClientSafeMap[];
  readonly voiceNote?: { readonly url: string; readonly seconds: number };
  readonly priceVisible: boolean;
  readonly locationVisible: boolean;
}

/**
 * Compile-time proof that ClientSafeProperty cannot carry forbidden
 * keys. If someone adds `phone`, `commission`, `note`, `sold`,
 * `published`, `views`, `owner`, or `internalStatus` to the type,
 * this assignment fails to compile. (Used by the type tests.)
 */
export type ForbiddenClientKey =
  | 'phone' | 'commission' | 'note' | 'notes' | 'sold' | 'published'
  | 'views' | 'owner' | 'seller' | 'sellerId' | 'sellerPhone' | 'internalStatus'
  | 'primaryPhone' | 'alternatePhone' | 'askingPrice' | 'siteVisitInstructions' | 'availability'
  | 'lifecycle' | 'clientVisible' | 'sale' | 'documents' | 'documentStatus' | 'storage'
  | 'visibility' | 'safety' | 'metadata' | 'team';
type _AssertNoForbidden = Extract<keyof ClientSafeProperty, ForbiddenClientKey>;
/** Must be `never`. Enforced in tests/type-guard below. */
export const _clientSafeHasNoForbiddenKeys: _AssertNoForbidden extends never ? true : never = true;

export type ClientLinkState =
  | { readonly kind: 'resolving' }
  | { readonly kind: 'valid'; readonly payload: ClientSafePayload }
  | { readonly kind: 'invalid-token' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'revoked' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'no-approved-photos'; readonly payload: ClientSafePayload };

/** Dealer-side input for creating a private client link. */
export interface CreateClientLinkInput {
  clientId?: string;
  propertyIds: string[];                 // 1–4 client-visible properties
  priceVisibility: 'shown' | 'hidden';
  locationVisibility: 'area' | 'exact' | 'hidden';
  /** Per-property price the dealer typed for THIS link (₹). Overrides the
   *  property's stored price (which changes daily). Absent = "Price on call". */
  customPrices?: Record<string, number>;
  /** ON → show the property pin on its sector map + city masterplan (exact).
   *  OFF → area-level location only. */
  locationPrecise?: boolean;
  expiresInDays: number;
  /** per-property photo refs, e.g. { "<propId>": ["external:0","external:1"] } */
  photoSelections: Record<string, string[]>;
  /** optional recorded voice note (uploaded to the private audio bucket). */
  audioBlob?: Blob | null;
  audioSeconds?: number;
}

export interface CreatedClientLink { id: string; url: string; token: string; expiresAt?: string; }

export interface ClientLinkRepository {
  /** dealer-side listing of links (record surface). */
  list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<ClientLink>>>;
  /** every client link that contains a given property (property analytics). */
  listForProperty(propertyId: string, opts?: QueryOptions): Promise<Result<ClientLink[]>>;
  /**
   * Buyer-side resolution. Returns ONLY client-safe data. The token
   * is passed as an argument and never stored or echoed back.
   */
  resolve(token: string, opts?: QueryOptions): Promise<Result<ClientLinkState>>;
  /** Create a private client link (dealer). Returns the raw token ONCE. */
  create(input: CreateClientLinkInput, opts?: QueryOptions): Promise<Result<CreatedClientLink>>;
  /** Deactivate (revoke) a link so it can no longer be opened. */
  revoke(id: string, opts?: QueryOptions): Promise<Result<void>>;
  /** Public engagement event. The raw token remains closure-scoped in /client. */
  recordEvent(
    token: string,
    event: ClientLinkEventKind,
    propertyPublicId?: string,
    opts?: QueryOptions,
  ): Promise<Result<void>>;

  /* ── dealer read models ── */

  /** Every link with its client, status and real activity counts. */
  directory(opts?: QueryOptions): Promise<Result<readonly ClientLinkSummary[]>>;
  /** One link with per-property activity and chronological history. */
  workspace(linkId: string, opts?: QueryOptions): Promise<Result<ClientLinkWorkspace>>;
}

/**
 * Every interaction the client page genuinely performs and can attribute.
 * Nothing here is inferred: an event exists because the buyer did the
 * thing. There is no interest score and no "warm/hot" derivation.
 */
export type ClientLinkEventKind =
  | 'opened'
  | 'property_viewed'
  | 'photos_viewed'
  | 'map_opened'
  | 'audio_played'
  | 'call_clicked'
  | 'whatsapp_clicked'
  | 'visit_requested';

export interface ClientLinkActivityCounts {
  opens: number;
  propertyViews: number;
  photoViews: number;
  mapOpens: number;
  audioPlays: number;
  calls: number;
  whatsapp: number;
  visitRequests: number;
}

export interface ClientLinkSummary {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  propertyIds: readonly string[];
  status: LinkStatus;
  createdAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  activity: ClientLinkActivityCounts;
  /** Most recent real event of any kind. Absent when never touched. */
  lastActivityAt?: string;
  firstOpenedAt?: string;
}

export interface ClientLinkPropertyActivity {
  propertyId: string;
  name: string;
  loc?: string;
  price?: number;
  lifecycle: string;
  views: number;
  photoViews: number;
  mapOpens: number;
  lastViewedAt?: string;
}

export interface ClientLinkHistoryEntry {
  kind: ClientLinkEventKind;
  propertyId?: string;
  at: string;
}

export interface ClientLinkWorkspace {
  summary: ClientLinkSummary;
  properties: readonly ClientLinkPropertyActivity[];
  history: readonly ClientLinkHistoryEntry[];
}

/**
 * A reason to contact this buyer, derived ONLY from something factual
 * that happened (or provably did not). Never a score.
 */
export type FollowUpReason =
  | 'visit-requested'
  | 'called-you'
  | 'whatsapp-tapped'
  | 'viewed-again'
  | 'expiring-soon'
  | 'never-opened';

export interface ClientLinkFollowUp {
  link: ClientLinkSummary;
  reason: FollowUpReason;
  /** Plain-language explanation of the fact behind it. */
  detail: string;
  /** The property the fact is about, when it is about one. */
  propertyId?: string;
  at?: string;
}

/* ───────────────────────────────────────────────────────────────
   10. MEDIA
   ─────────────────────────────────────────────────────────────── */

export type MediaState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly url: string }
  | { readonly kind: 'image-unavailable' }
  | { readonly kind: 'audio-unavailable' };

export interface MediaRepository {
  /** thumbnail URL for list cards (small). */
  thumb(assetId: string): string;
  /** full-resolution URL, resolved only when opened. */
  full(assetId: string, opts?: QueryOptions): Promise<Result<MediaState>>;
  /** Upload one image to the authenticated dealer/property private folder. */
  uploadPropertyPhoto(propertyId: string, file: File, opts?: QueryOptions): Promise<Result<import('./types').PropertyPhotoStorageRef>>;
  /** Best-effort cleanup for failed/cancelled property-photo writes. */
  removePropertyPhotos(paths: readonly string[], opts?: QueryOptions): Promise<Result<void>>;
}

/* ───────────────────────────────────────────────────────────────
   11. DEMAND SIGNALS (dashboard aggregate)
   ─────────────────────────────────────────────────────────────── */

export interface DemandSignalsRepository {
  get(opts?: QueryOptions): Promise<Result<DemandSignal[]>>;
}

/* ───────────────────────────────────────────────────────────────
   12. THE ROOT ADAPTER
   One object exposing every repository. Mock now, Supabase/IndexedDB
   in Pass 2 — screens depend on this shape, not the implementation.
   ─────────────────────────────────────────────────────────────── */

export interface DataAdapterV2 {
  readonly auth: AuthRepository;
  /**
   * MAPCO Intelligence read surface. Every method is safe to call at any
   * time: with AI off, or with no backend, it reports `unavailable`
   * rather than failing. No dealer screen consumes it yet — see
   * `packages/ai/contracts.ts`.
   */
  readonly ai: import('../ai/contracts').AiRepository;
  readonly properties: PropertyRepository;
  readonly sellers: SellerRepository;
  readonly propertyDocuments: PropertyDocumentRepository;
  readonly customers: CustomerRepository;
  readonly deals: DealRepository;
  readonly demand: DemandRepository;
  readonly demandSignals: DemandSignalsRepository;
  readonly maps: MapRepository;
  readonly presentation: PresentationRepository;
  readonly presentationEvents: PresentationEventsRepository;
  readonly predictive: PredictiveRepository;
  readonly clientLinks: ClientLinkRepository;
  readonly media: MediaRepository;
}

/* ───────────────────────────────────────────────────────────────
   13. DEV-ONLY SCENARIO CONTRACT
   Every empty/loading/error/expired/etc. state is reachable by
   switching a scenario. Wired ONLY in dev (import.meta.env.DEV).
   ─────────────────────────────────────────────────────────────── */

export type Scenario =
  // records
  | 'default'
  | 'empty' | 'loading' | 'error' | 'no-results'
  // account / activation
  | 'trial' | 'trial-ending' | 'account-expired' | 'account-suspended'
  | 'access-denied' | 'role-mismatch'
  | 'activation-required' | 'activation-invalid' | 'activation-expired'
  | 'device-approval' | 'device-limit'
  // client link
  | 'link-valid' | 'link-invalid' | 'link-expired' | 'link-revoked'
  | 'link-unavailable' | 'link-no-photos' | 'link-price-hidden' | 'link-location-hidden'
  // presentation
  | 'maps-loading' | 'no-map' | 'no-properties' | 'selected-unavailable'
  | 'map-asset-failed' | 'overlay-unavailable';

export function activeScenario(): Scenario {
  // dev-only: ?scenario=empty  → deterministic mock behaviour.
  if (typeof window === 'undefined') return 'default';
  const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;
  if (!isDev) return 'default';
  const raw = new URLSearchParams(window.location.search).get('scenario');
  return (raw as Scenario) || 'default';
}
