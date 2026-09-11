/* ═══════════════════════════════════════════════════════════════
   MAPCO Desk — canonical data store
   ---------------------------------------------------------------
   The Desk UI (logic.ts + template.ts) is a synchronous render:
   `renderApp(props)` builds the whole screen from plain arrays hanging
   off the component. That design is approved and must not change.

   This store is the bridge. It loads canonical records through the
   repository boundary, keeps them in plain arrays shaped the way the
   existing view-models already read, and asks the component to
   re-render when they change. Screens keep reading `this.sellers`;
   they simply stop being fixtures.

   Rules this file exists to enforce:
     • Nothing here knows about Supabase. Everything goes through
       `adapter`, so mock and production behave identically.
     • Load state is explicit. A screen can render "loading", a real
       error, or a truthful empty state — never a fabricated row.
     • No value is invented. A field the dealer never filled in stays
       absent rather than becoming 0 or "—" at this layer; formatting
       for display is the view-model's job.
   ═══════════════════════════════════════════════════════════════ */

import { adapter, activeDataMode } from '../../packages/data/adapter';
import type {
  SellerDirectoryEntry, SellerWorkspace, SellerType, SellerRelationship,
  SellerAvailability, Property, PropertySeller, PropertyLifecycle,
  Client, ClientRequirements, PropertyPhotoStorageRef,
} from '../../packages/data/types';
import type { RepoError, RepoErrorCode } from '../../packages/data/contracts';
import { normalizePropertySpecs } from '../../packages/data/property-specs';
import { propertyLifecycle } from '../../packages/data/property-lifecycle';
import { normalizePropertyPhotoStorage } from '../../packages/data/property-photos';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface SectionStatus {
  state: LoadState;
  /** A message safe to show the dealer. Never a raw transport error. */
  error?: string;
}

/* ── Desk vocabulary ↔ canonical vocabulary ──────────────────────
   Contacts shows title-case labels ("Individual", "Authorized Seller")
   while the database uses lowercase enums with CHECK constraints. These
   maps are the only place that translation happens — sending a Desk
   label straight to the backend would fail the constraint. */

const SELLER_TYPE_TO_CANONICAL: Record<string, SellerType> = {
  individual: 'individual', builder: 'builder', broker: 'broker', company: 'company',
};
const SELLER_TYPE_TO_DESK: Record<SellerType, string> = {
  individual: 'Individual', builder: 'Builder', broker: 'Broker', company: 'Company',
};
const RELATION_TO_CANONICAL: Record<string, SellerRelationship> = {
  owner: 'owner', 'co-owner': 'co-owner', builder: 'builder',
  'authorized seller': 'authorized-seller', 'authorized-seller': 'authorized-seller',
};
const RELATION_TO_DESK: Record<SellerRelationship, string> = {
  owner: 'Owner', 'co-owner': 'Co-owner', builder: 'Builder',
  'authorized-seller': 'Authorized Seller',
};

export const toCanonicalSellerType = (label: string | undefined): SellerType =>
  SELLER_TYPE_TO_CANONICAL[String(label ?? '').trim().toLowerCase()] ?? 'individual';
export const toDeskSellerKind = (type: SellerType | undefined): string =>
  SELLER_TYPE_TO_DESK[type ?? 'individual'] ?? 'Individual';
export const toCanonicalRelationship = (label: string | undefined): SellerRelationship =>
  RELATION_TO_CANONICAL[String(label ?? '').trim().toLowerCase()] ?? 'owner';
export const toDeskRelation = (relationship: SellerRelationship | undefined): string =>
  RELATION_TO_DESK[relationship ?? 'owner'] ?? 'Owner';

/**
 * Contacts models availability as a tick-box plus a free-text "last
 * confirmed" label; the database models it as a three-state enum plus a
 * real timestamp. Confirming sets the timestamp to now — the label is
 * derived on read, never stored.
 */
/**
 * A usable geographic coordinate: both halves present, finite, in range,
 * and not the 0,0 null island that a partially-filled form produces.
 */
/**
 * Is this the same spot the record already holds? Compared at the six
 * decimals the coordinate is stored to — about 11 centimetres.
 *
 * Re-saving a property is not moving it. `location.updatedAt` is a
 * relocation marker: Property Intelligence folds it into its cache digest,
 * so a fresh timestamp means "this property is somewhere else now, throw
 * the intelligence away and generate it again" — a paid round of Places,
 * Routes and model calls. Stamping it on every save spent that on a dealer
 * correcting a typo.
 */
function sameCoordinate(
  existing: Property['location'] | undefined,
  lat: unknown,
  lng: unknown,
): boolean {
  if (!existing) return false;
  return +Number(existing.latitude).toFixed(6) === +Number(lat).toFixed(6)
    && +Number(existing.longitude).toFixed(6) === +Number(lng).toFixed(6);
}

function isRealCoordinate(lat: unknown, lng: unknown): boolean {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export const toCanonicalAvailability = (confirmed: boolean | undefined): SellerAvailability =>
  confirmed === true ? 'available' : 'unconfirmed';

/** "Today" / "2 days ago" / "3 weeks ago" from a real timestamp. */
export function confirmedLabel(iso: string | undefined): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 864e5);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? '1 month ago' : `${months} months ago`;
}

/* ── Desk-shaped seller ──────────────────────────────────────────
   Exactly the fields the approved Contacts view-models already read,
   plus the canonical relationship data the screens need so they never
   have to join against a separate property collection. */

export interface DeskSellerProperty {
  propertyId: string;
  loc: string;
  price?: number;
  askPrice?: number;
  sold: boolean;
  availConfirmed: boolean;
  lastConfirmed: string;
  isPrimary: boolean;
}

export interface DeskSeller {
  id: string;
  name: string;
  phone: string;
  phone2: string;
  business: string;
  kind: string;
  city: string;
  note: string;
  archived: boolean;
  /** Canonical counts, computed server-side — never from a local join. */
  liveCount: number;
  soldCount: number;
  lastConfirmed: string;
  anyUnconfirmed: boolean;
  props: readonly DeskSellerProperty[];
}

function toDeskSeller(entry: SellerDirectoryEntry): DeskSeller {
  const s = entry.seller;
  return {
    id: s.id,
    name: s.name,
    phone: s.primaryPhone,
    phone2: s.alternatePhone ?? '',
    business: s.business ?? '',
    kind: toDeskSellerKind(s.type),
    city: s.city ?? '',
    note: s.note ?? '',
    archived: s.archived === true,
    liveCount: entry.liveCount,
    soldCount: entry.soldCount,
    lastConfirmed: confirmedLabel(entry.lastConfirmedAt),
    anyUnconfirmed: entry.anyUnconfirmed,
    props: entry.properties.map((p) => ({
      propertyId: p.propertyId,
      loc: p.loc ?? '',
      ...(p.price !== undefined ? { price: p.price } : {}),
      ...(p.askingPrice !== undefined ? { askPrice: p.askingPrice } : {}),
      sold: p.lifecycle === 'sold',
      availConfirmed: p.availability === 'available',
      lastConfirmed: confirmedLabel(p.lastConfirmedAt),
      isPrimary: p.isPrimary,
    })),
  };
}

/** One property row inside a Seller profile, with its private relationship. */
export interface DeskSellerWorkspaceRow {
  property: Property;
  relationship: PropertySeller;
  /** Desk-vocabulary mirrors so view-models read what they already expect. */
  ps: {
    askPrice?: number;
    relation: string;
    availConfirmed: boolean;
    lastConfirmed: string;
    visitNote: string;
    note: string;
    docs: readonly string[];
  };
}

export interface DeskSellerWorkspace {
  seller: DeskSeller;
  active: readonly DeskSellerWorkspaceRow[];
  sold: readonly DeskSellerWorkspaceRow[];
}

function toWorkspaceRow(row: { property: Property; relationship: PropertySeller }): DeskSellerWorkspaceRow {
  const r = row.relationship;
  return {
    property: row.property,
    relationship: r,
    ps: {
      ...(r.askingPrice !== undefined ? { askPrice: r.askingPrice } : {}),
      relation: toDeskRelation(r.relationship),
      availConfirmed: r.availability === 'available',
      lastConfirmed: confirmedLabel(r.lastConfirmedAt),
      visitNote: r.siteVisitInstructions ?? '',
      note: r.note ?? '',
      docs: r.documentKinds ?? [],
    },
  };
}

/* ── Desk-shaped property ────────────────────────────────────────
   The Desk reads a property as ONE flat object: `pr.beds`, `pr.frontage`,
   `pr.cabins` all sit directly on the record, and hundreds of call sites
   in logic.ts/template.ts depend on that. Canonically those keys live in
   `specs`, scoped to the property's kind.

   These two functions are the round trip. Flattening on read keeps every
   existing view-model working; lifting on write keeps the stored record
   canonical, and drops keys that do not belong to the chosen type. */

/** "26 August" — the sale-date form the approved Sold cards use. */
export function saleDateLabel(iso: string | undefined): string {
  if (!iso) return '';
  const when = Date.parse(iso);
  if (Number.isNaN(when)) return String(iso);
  const d = new Date(when);
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
}

/** Desk status vocabulary ← canonical lifecycle. */
function toDeskStatus(lifecycle: PropertyLifecycle): string {
  if (lifecycle === 'sold') return 'sold';
  if (lifecycle === 'archived') return 'onhold';
  return 'available';
}

/** The Desk's "position" line, derived from the plot advantage flags. */
function derivePosition(specs: Record<string, unknown>, fallback: string): string {
  if (fallback && fallback !== '—') return fallback;
  if (specs.corner === true) return 'Corner plot';
  if (specs.parkFacing === true) return 'Park facing';
  if (specs.mainRoad === true) return 'On the main road';
  return 'Inside';
}

/** Canonical Property → the flat object every Desk view-model reads. */
/** Hand-ticked papers carried on the property record, if any. */
function paperChecklistOf(property: Property): { title: string; markedOn: string }[] {
  const raw = (property as unknown as { paperChecklist?: unknown }).paperChecklist;
  if (!Array.isArray(raw)) return [];
  const out: { title: string; markedOn: string }[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    if (title) out.push({ title, markedOn: String(row.markedOn ?? '') });
  }
  return out;
}

/**
 * The property-photo refs a form draft describes, in the dealer's chosen
 * order with the cover first — the Photos step says "the first one is what
 * buyers see", so the order is the promise.
 *
 * Returns undefined when the draft carries no photo model at all, so a
 * partial save (a step advance that never touched Photos) leaves whatever
 * the record already had untouched.
 */
function formPhotoStorage(
  form: PropertyFormDraft,
  existing?: Property,
): PropertyPhotoStorageRef[] | undefined {
  const keys = form.photos;
  if (!Array.isArray(keys)) return undefined;
  const refs = normalizePropertyPhotoStorage(form.photoStorage, undefined);
  if (!refs.length && !keys.length) return existing?.photoStorage?.length ? [] : undefined;
  const byPath = new Map(refs.map((ref) => [ref.path, ref]));
  const cover = typeof form.cover === 'string' ? form.cover : '';
  const ordered = keys.filter((key): key is string => typeof key === 'string');
  const withCoverFirst = cover && ordered.includes(cover)
    ? [cover, ...ordered.filter((key) => key !== cover)]
    : ordered;
  return withCoverFirst.flatMap((key) => { const ref = byPath.get(key); return ref ? [ref] : []; });
}

export function toDeskProperty(property: Property): Record<string, unknown> {
  const lifecycle = propertyLifecycle(property);
  const specs = (property.specs ?? {}) as Record<string, unknown>;
  return {
    ...property,
    ...specs,
    status: toDeskStatus(lifecycle),
    draft: lifecycle === 'draft',
    published: lifecycle === 'on-sale',
    photoCount: (property.photos ?? []).length,
    // "Confirmed on Earth" means a canonical coordinate exists — never a
    // pin dropped on a picture.
    earth: !!property.location,
    highlights: [...(property.highlights ?? [])],
    videos: [...(property.videos ?? [])],
    video: (property.videos ?? []).length > 0,
    /* The Desk calls .toUpperCase()/.split() on these directly. Anything saved
       through toCanonicalProperty already has them as strings, but a seeded or
       imported row can be missing one entirely — and an undefined here threw
       inside renderVals(), which takes the WHOLE dashboard down rather than
       just the one card. Defaulted for the same reason as the fields below. */
    city: property.city ?? '',
    area: property.area ?? '',
    loc: property.loc ?? '',
    sector: property.sector ?? '',
    size: property.size ?? '',
    /* `type` belongs to that same list: the Desk calls pr.type.split(' ') and
       pr.type.includes(...) in six places, so an imported row without one took
       the whole screen down exactly as a missing `city` did. */
    type: property.type ?? '',
    want: property.want ?? '',
    facing: property.facing ?? '',
    rate: property.rate ?? '',
    society: property.society ?? '',
    address: property.address ?? '',
    notes: property.privateNotes ?? '',
    registry: property.registryRef ?? '',
    approval: property.approvalRef ?? '',
    unit: property.sizeUnit ?? 'sq yd',
    // Canonical sale is { finalPrice, soldAt, buyerId, dealId }; the Sold
    // cards read { price, date, buyerName, buyerId }. Without this mapping
    // they render ₹NaN and "sold to undefined". `comm` lives on the deal,
    // not the property, so it is left absent rather than guessed.
    ...(property.sale ? {
      sale: {
        price: property.sale.finalPrice,
        date: saleDateLabel(property.sale.soldAt),
        soldAt: property.sale.soldAt,
        buyerId: property.sale.buyerId,
        dealId: property.sale.dealId,
        buyerName: '',
        buyerPhone: '',
      },
      dealId: property.sale.dealId,
    } : {}),
    // Filled in by the seller directory / document loads, not invented here.
    ps: null,
    /* Papers the dealer ticked on this property. They ride on the record as
       `paperChecklist` (written by plotmap_set_property_paper), which is the
       same list the Deal room's property papers read. Uploaded files are a
       separate concern and arrive through loadPropertyDocuments. */
    photoStorage: [...(property.photoStorage ?? [])],
    docs: paperChecklistOf(property).map((mark, index) => ({
      id: 'mark:' + mark.title, kind: mark.title, name: mark.title,
      photos: [], img: index % 3, markedOn: mark.markedOn,
    })),
  };
}

export interface PropertyFormDraft {
  city?: string; area?: string; society?: string; address?: string;
  type?: string; size?: string; unit?: string; rate?: string; price?: string;
  facing?: string; sector?: string; avail?: string;
  highlights?: readonly string[]; videos?: readonly string[];
  notes?: string; registry?: string; approval?: string;
  [key: string]: unknown;
}

export interface PropertyWriteResult {
  property?: Property;
  /** Present when the record cannot go On Sale yet. */
  missing?: readonly string[];
  error?: string;
  /** Machine-readable failure class, for telemetry only. Never rendered —
   *  `error` above is the dealer-facing prose, and prose must not reach
   *  analytics because it can carry record data and Postgres internals. */
  errorCode?: RepoErrorCode;
}

const WANT_BY_TYPE = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes('plot')) return 'Plot';
  if (t.includes('sco') || t.includes('booth') || t.includes('office') || t.includes('showroom')) return 'Commercial';
  if (t.includes('kothi')) return 'Kothi';
  if (t.includes('villa')) return 'Villa';
  return 'Flat';
};

/** Fields the database requires before a property may be listed On Sale. */
export function missingForOnSale(property: Partial<Property>): string[] {
  const missing: string[] = [];
  if (!String(property.type ?? '').trim()) missing.push('property type');
  if (!String(property.city ?? '').trim()) missing.push('city');
  if (!String(property.area ?? '').trim()) missing.push('area');
  if (!String(property.size ?? '').trim()) missing.push('size');
  if (!String(property.facing ?? '').trim()) missing.push('facing');
  if (!String(property.position ?? '').trim()) missing.push('position');
  return missing;
}

/** The Desk's flat Add/Edit form → a canonical Property. */
export function toCanonicalProperty(
  form: PropertyFormDraft,
  existing?: Property,
  id?: string,
): Property {
  const type = String(form.type ?? existing?.type ?? 'Residential Plot');
  const unit = String(form.unit ?? 'sq yd');
  const rawSize = String(form.size ?? '').trim();
  const size = rawSize ? `${rawSize} ${unit}` : (existing?.size ?? '');
  const city = String(form.city ?? existing?.city ?? '').trim();
  const area = String(form.area ?? existing?.area ?? '').trim();
  const priceCrore = parseFloat(String(form.price ?? ''));
  const isCommercial = WANT_BY_TYPE(type) === 'Commercial';
  // normalizePropertySpecs picks exactly this type's keys out of the flat
  // form, so switching Flat → Plot cannot carry `beds` across.
  const specs = normalizePropertySpecs(type, form) ?? {};

  return {
    ...(existing ?? {}),
    id: id ?? existing?.id ?? '',
    type: type as Property['type'],
    want: WANT_BY_TYPE(type) as Property['want'],
    city,
    area,
    loc: [area, city].filter(Boolean).join(', ') || city || existing?.loc || '',
    sector: String(form.sector ?? existing?.sector ?? ''),
    size,
    sizeUnit: unit,
    facing: (isCommercial ? '—' : String(form.facing ?? existing?.facing ?? '')) as Property['facing'],
    position: derivePosition(specs as Record<string, unknown>, String(existing?.position ?? '')),
    approvals: existing?.approvals ?? [],
    landmarks: existing?.landmarks ?? [],
    price: Number.isFinite(priceCrore) ? Math.round(priceCrore * 1e7) : (existing?.price ?? 0),
    /* Uploaded photos are canonical as `photoStorage` object refs; `photos`
       carries display URLs at runtime and persistentPropertyPayload keeps
       only genuinely external ones. The form owns the order and which is
       the cover, so the refs are rebuilt from it rather than merged: a photo
       the dealer removed must not survive in the record. */
    photos: existing?.photos ?? [],
    ...(formPhotoStorage(form, existing) ? { photoStorage: formPhotoStorage(form, existing)! } : {}),
    views: existing?.views ?? 0,
    published: existing?.published ?? false,
    sold: existing?.sold ?? false,
    ...(Object.keys(specs).length ? { specs } : {}),
    ...(form.society ? { society: String(form.society) } : {}),
    ...(form.address ? { address: String(form.address) } : {}),
    ...(form.rate ? { rate: String(form.rate) } : {}),
    ...(form.highlights?.length ? { highlights: [...form.highlights] } : {}),
    ...(form.videos?.length ? { videos: [...form.videos] } : {}),
    ...(form.notes ? { privateNotes: String(form.notes) } : {}),
    ...(form.registry ? { registryRef: String(form.registry) } : {}),
    ...(form.approval ? { approvalRef: String(form.approval) } : {}),
    /* A placement is only real if the dealer actually dropped the pin.
       sectorMapId is auto-latched by a fuzzy name match on the typed area
       (logic.ts setP), so defaulting x/y to 0.5 invented a pin at the dead
       centre of a sheet nobody chose — and buyers were shown it on
       precise-location links. Same fabrication the Earth block below refuses
       to make for lat/lng; refused here too. No pin, no placement. */
    ...(form.mapPlacement
      ? { mapPlacement: form.mapPlacement }
      : (form.sectorMapId
        && typeof form.sectorPinX === 'number' && typeof form.sectorPinY === 'number'
        ? { mapPlacement: {
            mapId: form.sectorMapId,
            // 4dp, matching what logic.ts mapClick() already writes, so the
            // same pin has the same shape whichever path stored it.
            x: +(form.sectorPinX / 100).toFixed(4),
            y: +(form.sectorPinY / 100).toFixed(4),
          } }
        : (existing?.mapPlacement ? { mapPlacement: existing.mapPlacement } : {}))),
    ...(form.sectorMapId ? { sectorMapId: String(form.sectorMapId) } : (existing?.sectorMapId ? { sectorMapId: existing.sectorMapId } : {})),
    /* ── canonical Earth location ────────────────────────────────────
       ONE source of truth: a real WGS84 coordinate the dealer placed on
       the live Google satellite map in step 4 (logic.ts syncEarthMap
       writes it to pform.lat / pform.lng).

       A pin dropped on a RASTER sector sheet is NOT a geographic
       coordinate — it is an image placement, and it is carried by
       mapPlacement above. The previous build interpolated raster pin
       percentages into a hardcoded lat/lng box and stamped the result
       'dealer-selected', which produced plausible but wrong coordinates
       for every property. That fabrication is deliberately gone: if the
       dealer never placed a real map pin, the property simply has no
       Earth location and the UI says so.

       A coordinate must also be ACCEPTED, not merely selected. logic.ts
       recordEarthSelection() stores a click, drag or search result as a
       candidate and explicitly sets `earth = false`; only pEarthConfirm
       ("Confirm this spot") sets it true. Persisting an unconfirmed
       candidate would break that contract at the last step and would also
       break the round trip, because openEdit() reopens a property with
       `earth: !!pr.location` — so an unconfirmed save would come back
       showing "Confirmed" to a dealer who never confirmed it.

       When the coordinate is not accepted, any location already on the
       record survives untouched: declining to confirm a new pin must
       never erase a good one. */
    ...(form.location
      ? { location: form.location }
      : (form.earth === true && isRealCoordinate(form.lat, form.lng)
        ? (sameCoordinate(existing?.location, form.lat, form.lng)
          // Unmoved: keep the marker the relocation it describes gave it.
          ? { location: existing!.location }
          : {
              location: {
                latitude: +Number(form.lat).toFixed(6),
                longitude: +Number(form.lng).toFixed(6),
                source: 'dealer-selected' as const,
                updatedAt: new Date().toISOString(),
              },
            })
        : (existing?.location ? { location: existing.location } : {}))),
  } as Property;
}

/* ── Desk-shaped client ──────────────────────────────────────────
   Contacts reads a client flat (`c.types`, `c.areas`, `c.bFrom`), while
   canonically those live under `requirements`. Same round-trip shape as
   properties: flatten on read, lift on write. Budget is stored in RUPEES
   canonically and shown in crore by the Desk. */

export interface ClientFormDraft {
  name?: string; phone?: string; phone2?: string; business?: string; city?: string;
  types?: readonly string[]; areas?: readonly string[];
  budgetFrom?: string; budgetTo?: string;
  sizeFrom?: string; sizeTo?: string;
  preferences?: readonly string[]; prefs?: readonly string[];
  stage?: string; note?: string;
  [key: string]: unknown;
}

const CRORE = 1e7;
const crore = (rupees: number | undefined): string =>
  rupees === undefined || rupees === null ? '' : String(+(rupees / CRORE).toFixed(3));

/** "₹1.2–1.8 Cr" from what was actually recorded — never a made-up band. */
export function budgetLabel(min: number | undefined, max: number | undefined): string {
  const unit = (v: number) => (v / CRORE >= 1 ? 'Cr' : 'L');
  const fmt = (v: number) => {
    const cr = v / CRORE;
    return cr >= 1 ? `${+cr.toFixed(2)} Cr` : `${Math.round(v / 1e5)} L`;
  };
  if (min && max && min !== max) {
    /* Dropping the lower unit is only right when both ends share it
       ("₹1.2–1.8 Cr"). Across units it produced "₹80–1.5 Cr" for a
       80 lakh – 1.5 crore client: the 80 reads as crore, off by 100x.
       Legacy contacts hid this behind a stored budget string, so it only
       showed on clients created through the app. */
    const lower = unit(min) === unit(max) ? fmt(min).replace(/ (Cr|L)$/, '') : fmt(min);
    return `₹${lower}–${fmt(max)}`;
  }
  if (max) return `₹${fmt(max)}`;
  if (min) return `₹${fmt(min)}+`;
  return '';
}

export function toDeskClient(client: Client): Record<string, unknown> {
  const r = client.requirements ?? {};
  return {
    ...client,
    phone2: client.alternatePhone ?? '',
    business: client.business ?? '',
    types: [...(r.types ?? [])],
    areas: [...(r.areas ?? [])],
    bFrom: r.budgetMin !== undefined ? r.budgetMin / CRORE : null,
    bTo: r.budgetMax !== undefined ? r.budgetMax / CRORE : null,
    sizeFrom: r.sizeMin ?? '',
    sizeTo: r.sizeMax ?? '',
    prefs: [...(r.preferences ?? [])],
    stage: r.stage ?? '',
    // Desk renders `notes` as {t,x}; canonical stores {at,text}.
    /* `at` is a stored ISO timestamp. It used to be handed to the screen
       unchanged, so a dealer read their own note stamped
       '2026-09-10T22:05:51.656Z'. confirmedLabel is the same wording the
       rest of the Desk already uses for 'when did this happen'. */
    notes: (client.notes ?? []).map((n) => ({ t: confirmedLabel(n.at) || n.at, x: n.text })),
    budget: budgetLabel(r.budgetMin, r.budgetMax) || client.budget || '',
    budgetMax: client.budgetMax || r.budgetMax || 0,
    plots: [...(client.purchased ?? [])],
    hot: client.status === 'hot',
    archived: client.archived === true,
  };
}

export function toCanonicalClient(
  form: ClientFormDraft,
  existing?: Client,
  id?: string,
): Client {
  const num = (v: unknown): number | undefined => {
    const parsed = parseFloat(String(v ?? ''));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * CRORE) : undefined;
  };
  const budgetMin = num(form.budgetFrom);
  const budgetMax = num(form.budgetTo);
  const types = [...(form.types ?? [])].filter(Boolean);
  const areas = [...(form.areas ?? [])].filter(Boolean);
  const preferences = [...(form.preferences ?? form.prefs ?? [])].filter(Boolean);
  const stage = String(form.stage ?? '').trim();
  const sizeMin = String(form.sizeFrom ?? '').trim();
  const sizeMax = String(form.sizeTo ?? '').trim();

  const requirements: ClientRequirements = {
    ...(types.length ? { types } : {}),
    ...(areas.length ? { areas } : {}),
    ...(budgetMin !== undefined ? { budgetMin } : {}),
    ...(budgetMax !== undefined ? { budgetMax } : {}),
    ...(sizeMin ? { sizeMin } : {}),
    ...(sizeMax ? { sizeMax } : {}),
    ...(preferences.length ? { preferences } : {}),
    ...(stage ? { stage } : {}),
  };
  const hasRequirements = Object.keys(requirements).length > 0;

  // A brand-new note is prepended; existing notes are preserved.
  const noteText = String(form.note ?? '').trim();
  const notes = noteText
    ? [{ at: new Date().toISOString(), text: noteText }, ...(existing?.notes ?? [])].slice(0, 200)
    : existing?.notes;

  const want = types[0] ? deskWantOf(types[0]) : '';

  return {
    ...(existing ?? {}),
    id: id ?? existing?.id ?? '',
    name: String(form.name ?? existing?.name ?? '').trim(),
    phone: String(form.phone ?? existing?.phone ?? '').trim(),
    city: String(form.city ?? existing?.city ?? '').trim(),
    want: want as Client['want'],
    budget: budgetLabel(budgetMin, budgetMax),
    budgetMax: budgetMax ?? 0,
    status: existing?.status ?? 'active',
    seen: existing?.seen ?? '',
    note: existing?.note ?? '',
    viewed: existing?.viewed ?? [],
    interest: existing?.interest ?? [],
    purchased: existing?.purchased ?? [],
    alternatePhone: String(form.phone2 ?? '').trim(),
    business: String(form.business ?? '').trim(),
    requirements: hasRequirements ? requirements : existing ? {} : undefined,
    ...(notes?.length ? { notes } : {}),
  } as Client;
}

/** Desk property type → the buyer's `want` bucket. */
function deskWantOf(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('plot')) return 'Plot';
  if (t.includes('kothi')) return 'Kothi';
  if (t.includes('villa')) return 'Villa';
  if (t.includes('sco') || t.includes('booth') || t.includes('office') || t.includes('showroom')) return 'Commercial';
  return 'Flat';
}

/**
 * How much the dealer actually knows about this buyer. Drives "Needs
 * attention": a client with a name and a number and nothing else needs
 * completing, and saying so is more useful than pretending otherwise.
 */
export function clientKnownDepth(client: Client): number {
  const r = client.requirements ?? {};
  let depth = 0;
  if ((r.types ?? []).length) depth++;
  if ((r.areas ?? []).length) depth++;
  if (r.budgetMin !== undefined || r.budgetMax !== undefined || client.budgetMax) depth++;
  if ((r.preferences ?? []).length) depth++;
  if ((client.notes ?? []).length) depth++;
  if (r.sizeMin || r.sizeMax) depth++;
  return depth;
}

/** The specific things still missing, so the UI can name them truthfully. */
export function clientMissingFields(client: Client): string[] {
  const r = client.requirements ?? {};
  const missing: string[] = [];
  if (!String(client.city ?? '').trim()) missing.push('city');
  if (!(r.types ?? []).length) missing.push('property type');
  if (!(r.areas ?? []).length) missing.push('preferred areas');
  if (r.budgetMin === undefined && r.budgetMax === undefined && !client.budgetMax) missing.push('budget');
  return missing;
}

/** A dealer-facing message. Transport detail never reaches the screen. */
function message(error: RepoError, fallback: string): string {
  switch (error.code) {
    case 'network': return 'Could not reach MAPCO. Check your connection and try again.';
    case 'unauthorized': return 'Your session has ended. Sign in again to continue.';
    case 'forbidden': return 'You do not have access to this.';
    case 'not_found': return 'This record is no longer available.';
    default: return error.message || fallback;
  }
}

/* ── the store ───────────────────────────────────────────────── */

export class DeskStore {
  /** Called whenever loaded data changes, so the component can re-render. */
  private notify: () => void = () => {};

  /* Mutated IN PLACE, never reassigned: the Desk component holds this exact
     array by reference and the synchronous renderer copies own properties
     once. Replacing the array would silently detach the screen. */
  readonly sellers: DeskSeller[] = [];
  sellersStatus: SectionStatus = { state: 'idle' };

  sellerWorkspace: DeskSellerWorkspace | null = null;
  sellerWorkspaceId: string | null = null;
  sellerWorkspaceStatus: SectionStatus = { state: 'idle' };

  /** Set by a write that failed, so the screen can show a real reason. */
  lastWriteError = '';

  bind(notify: () => void): void { this.notify = notify; }

  get isMock(): boolean { return activeDataMode() === 'mock'; }

  /* ── sellers ── */

  async loadSellers(): Promise<void> {
    this.sellersStatus = { state: 'loading' };
    this.notify();
    const result = await adapter.sellers.directory(false);
    if (!result.ok) {
      this.sellers.splice(0, this.sellers.length);
      this.sellersStatus = { state: 'error', error: message(result.error, 'Sellers could not be loaded') };
    } else {
      this.sellers.splice(0, this.sellers.length, ...result.value.map(toDeskSeller));
      this.sellersStatus = { state: 'ready' };
    }
    this.notify();
  }

  /**
   * Create or update a seller. `id` present = update, so editing never
   * creates a duplicate of the same person.
   */
  async saveSeller(input: {
    id?: string; name: string; phone: string; phone2?: string;
    business?: string; kind?: string; city?: string; note?: string;
  }): Promise<string | null> {
    this.lastWriteError = '';
    const result = await adapter.sellers.save({
      ...(input.id ? { id: input.id } : {}),
      name: input.name.trim(),
      primaryPhone: input.phone.trim(),
      ...(input.phone2?.trim() ? { alternatePhone: input.phone2.trim() } : {}),
      ...(input.business?.trim() ? { business: input.business.trim() } : {}),
      type: toCanonicalSellerType(input.kind),
      ...(input.city?.trim() ? { city: input.city.trim() } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not save this seller');
      this.notify();
      return null;
    }
    await this.loadSellers();
    // A seller edited from its own profile must show the new values there too.
    if (this.sellerWorkspaceId === result.value.id) await this.loadSellerWorkspace(result.value.id);
    return result.value.id;
  }

  async archiveSeller(sellerId: string, archived = true): Promise<boolean> {
    this.lastWriteError = '';
    const result = await adapter.sellers.setArchived(sellerId, archived);
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not archive this seller');
      this.notify();
      return false;
    }
    await this.loadSellers();
    return true;
  }

  async loadSellerWorkspace(sellerId: string): Promise<void> {
    this.sellerWorkspaceId = sellerId;
    this.sellerWorkspaceStatus = { state: 'loading' };
    this.notify();
    const result = await adapter.sellers.workspace(sellerId);
    if (this.sellerWorkspaceId !== sellerId) return; // a newer open won
    if (!result.ok) {
      this.sellerWorkspace = null;
      this.sellerWorkspaceStatus = { state: 'error', error: message(result.error, 'Seller could not be loaded') };
    } else {
      this.sellerWorkspace = this.toDeskWorkspace(result.value);
      this.sellerWorkspaceStatus = { state: 'ready' };
    }
    this.notify();
  }

  closeSellerWorkspace(): void {
    this.sellerWorkspaceId = null;
    this.sellerWorkspace = null;
    this.sellerWorkspaceStatus = { state: 'idle' };
  }

  private toDeskWorkspace(workspace: SellerWorkspace): DeskSellerWorkspace {
    const listed = this.sellers.find((s) => s.id === workspace.seller.id);
    const active = workspace.active.map(toWorkspaceRow);
    const sold = workspace.sold.map(toWorkspaceRow);
    const seller: DeskSeller = listed ?? toDeskSeller({
      seller: workspace.seller,
      liveCount: active.length,
      soldCount: sold.length,
      anyUnconfirmed: active.some((r) => !r.ps.availConfirmed),
      properties: [],
    });
    return { seller: { ...seller, liveCount: active.length, soldCount: sold.length }, active, sold };
  }

  /**
   * Attach a seller to a property with the property-specific private
   * facts. The same seller can be attached to any number of properties;
   * this never duplicates the seller record.
   */
  async assignSellerToProperty(input: {
    propertyId: string; sellerId: string; askPrice?: number; relation?: string;
    availConfirmed?: boolean; visitNote?: string; note?: string;
    docs?: readonly string[]; isPrimary?: boolean;
  }): Promise<boolean> {
    this.lastWriteError = '';
    const result = await adapter.sellers.assignToProperty({
      propertyId: input.propertyId,
      sellerId: input.sellerId,
      ...(input.askPrice !== undefined && input.askPrice > 0 ? { askingPrice: input.askPrice } : {}),
      relationship: toCanonicalRelationship(input.relation),
      availability: toCanonicalAvailability(input.availConfirmed),
      // Confirming availability stamps a real time; the UI label is derived.
      ...(input.availConfirmed ? { lastConfirmedAt: new Date().toISOString() } : {}),
      ...(input.visitNote?.trim() ? { siteVisitInstructions: input.visitNote.trim() } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.docs?.length ? { documentKinds: [...input.docs] } : {}),
      isPrimary: input.isPrimary !== false,
    });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not attach this seller');
      this.notify();
      return false;
    }
    await this.loadSellers();
    if (this.sellerWorkspaceId) await this.loadSellerWorkspace(this.sellerWorkspaceId);
    return true;
  }

  /* ── properties ── */

  /** Mutated in place, for the same reason `sellers` is. */
  readonly properties: Record<string, unknown>[] = [];
  propertiesStatus: SectionStatus = { state: 'idle' };

  /**
   * Load the dealer's whole inventory, then attach each property's seller
   * relationship from the seller directory already in memory — one extra
   * pass instead of a query per property.
   */
  async loadProperties(): Promise<void> {
    this.propertiesStatus = { state: 'loading' };
    this.notify();
    const result = await adapter.properties.list({ limit: 200 });
    if (!result.ok) {
      this.properties.splice(0, this.properties.length);
      this.propertiesStatus = { state: 'error', error: message(result.error, 'Properties could not be loaded') };
      this.notify();
      return;
    }
    const rows = result.value.items.map(toDeskProperty);
    this.attachSellerRelationships(rows);
    this.properties.splice(0, this.properties.length, ...rows);
    this.propertiesStatus = { state: 'ready' };
    this.notify();
  }

  /** Invert the seller directory into propertyId → relationship. */
  private attachSellerRelationships(rows: Record<string, unknown>[]): void {
    const byProperty = new Map<string, Record<string, unknown>>();
    for (const seller of this.sellers) {
      for (const p of seller.props) {
        byProperty.set(p.propertyId, {
          sellerId: seller.id,
          sellerName: seller.name,
          askPrice: p.askPrice,
          availConfirmed: p.availConfirmed,
          lastConfirmed: p.lastConfirmed,
          isPrimary: p.isPrimary,
        });
      }
    }
    for (const row of rows) {
      const relationship = byProperty.get(String(row.id));
      if (relationship) row.ps = relationship;
      // Resolve the buyer's name for a sold property from the canonical
      // client already loaded — never a name stored twice on the property.
      const sale = row.sale as { buyerId?: string; buyerName?: string; buyerPhone?: string } | undefined;
      if (sale?.buyerId) {
        const buyer = this.clients.find((c) => c.id === sale.buyerId);
        if (buyer) {
          sale.buyerName = String(buyer.name ?? '');
          sale.buyerPhone = String(buyer.phone ?? '');
        }
      }
    }
  }

  /**
   * Create or update a property. `lifecycle` decides whether it lands as a
   * draft or as active inventory; a record that cannot legally go On Sale
   * is kept as a draft and the caller is told exactly what is missing,
   * rather than the save failing opaquely.
   */
  async saveProperty(
    form: PropertyFormDraft,
    options: { id?: string; lifecycle?: PropertyLifecycle } = {},
  ): Promise<PropertyWriteResult> {
    this.lastWriteError = '';
    const existing = options.id ? await this.readCanonical(options.id) : undefined;
    if (options.id && !existing) {
      this.lastWriteError = 'Could not load this property. Please retry before saving changes.';
      this.notify();
      return { error: this.lastWriteError, errorCode: 'not_found' };
    }

    const wanted: PropertyLifecycle = options.lifecycle
      ?? (form.avail === 'onhold' ? 'archived' : 'on-sale');
    const draft = toCanonicalProperty(form, existing, options.id);
    const missing = missingForOnSale(draft);
    const lifecycle: PropertyLifecycle =
      wanted === 'on-sale' && missing.length ? 'draft' : wanted;

    const result = await adapter.properties.save({ ...draft, lifecycle });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not save this property');
      this.notify();
      return { error: this.lastWriteError, errorCode: result.error.code };
    }
    await this.loadProperties();
    return { property: result.value, ...(missing.length ? { missing } : {}) };
  }

  private async readCanonical(id: string): Promise<Property | undefined> {
    const result = await adapter.properties.get(id);
    return result.ok ? result.value : undefined;
  }

  async updatePropertyPrice(id: string, price: number): Promise<boolean> {
    this.lastWriteError = '';
    if (!Number.isFinite(price) || price <= 0) {
      this.lastWriteError = 'Enter a price greater than zero.';
      this.notify();
      return false;
    }
    const property = await this.readCanonical(id);
    if (!property) {
      this.lastWriteError = 'Could not load this property. Please retry.';
      this.notify();
      return false;
    }
    const result = await adapter.properties.save({ ...property, price });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not update this price');
      this.notify();
      return false;
    }
    await this.loadProperties();
    return true;
  }

  /** Off-market / archive. Non-destructive — history and media survive. */
  async archiveProperty(id: string, reason?: string): Promise<boolean> {
    this.lastWriteError = '';
    const existing = await this.readCanonical(id);
    if (!existing) { this.lastWriteError = 'This property is no longer available.'; this.notify(); return false; }
    const result = await adapter.properties.save({ ...existing, lifecycle: 'archived',
      ...(reason !== undefined ? { offMarketReason: reason.trim() } : {}) });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not take this property off the market');
      this.notify();
      return false;
    }
    await this.loadProperties();
    return true;
  }

  /** Put an archived property back on the market. */
  async restoreProperty(id: string): Promise<boolean> {
    this.lastWriteError = '';
    const existing = await this.readCanonical(id);
    if (!existing) { this.lastWriteError = 'This property is no longer available.'; this.notify(); return false; }
    const missing = missingForOnSale(existing);
    if (missing.length) {
      this.lastWriteError = `Add ${missing.join(', ')} before putting this back on sale.`;
      this.notify();
      return false;
    }
    const result = await adapter.properties.save({ ...existing, lifecycle: 'on-sale' });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not put this property back on sale');
      this.notify();
      return false;
    }
    await this.loadProperties();
    return true;
  }

  /**
   * Mark Sold. One atomic command marks the property sold, completes a
   * matching open deal (or writes a canonical completed one), and appends
   * to the buyer's purchase history — never three separate writes.
   */
  async markSold(input: {
    propertyId: string; soldPrice: number; saleDate: string;
    buyerId?: string; newBuyer?: { name: string; phone?: string };
    commission?: number;
  }): Promise<boolean> {
    this.lastWriteError = '';
    const result = await adapter.deals.record({
      propertyId: input.propertyId,
      ...(input.buyerId ? { buyerId: input.buyerId } : {}),
      ...(input.newBuyer?.name ? { newBuyer: { name: input.newBuyer.name, phone: input.newBuyer.phone ?? '' } } : {}),
      soldPrice: input.soldPrice,
      saleDate: input.saleDate,
      ...(input.commission !== undefined ? { commission: input.commission } : {}),
    });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not record this sale');
      this.notify();
      return false;
    }
    // A sale changes inventory, seller history and client history together.
    await this.loadSellers();
    await this.loadProperties();
    return true;
  }

  /* ── clients ──
     Mark Sold needs a CANONICAL buyer: the sale command resolves the buyer
     id server-side and appends to that client's purchase history. A fixture
     id would simply not exist. Full Contacts→Clients functionalization
     (requirements, needs-attention, profile tabs) is its own slice; this
     loads the canonical records the rest of the Desk already reads. */

  readonly clients: Record<string, unknown>[] = [];
  clientsStatus: SectionStatus = { state: 'idle' };

  async loadClients(): Promise<void> {
    this.clientsStatus = { state: 'loading' };
    this.notify();
    const result = await adapter.customers.list({ limit: 200 });
    if (!result.ok) {
      this.clients.splice(0, this.clients.length);
      this.clientsStatus = { state: 'error', error: message(result.error, 'Clients could not be loaded') };
    } else {
      this.clients.splice(0, this.clients.length,
        ...result.value.items.filter((c) => !c.archived).map(toDeskClient));
      this.clientsStatus = { state: 'ready' };
    }
    this.notify();
  }

  /**
   * Create or update a client. `id` present = update, so correcting a
   * number never creates a second copy of the same person.
   */
  async saveClient(form: ClientFormDraft, id?: string): Promise<string | null> {
    this.lastWriteError = '';
    if (!String(form.name ?? '').trim() || !String(form.phone ?? '').trim()) {
      this.lastWriteError = 'A client needs at least a name and a phone number.';
      this.notify();
      return null;
    }
    const existing = id ? await this.readCanonicalClient(id) : undefined;
    if (id && !existing) {
      this.lastWriteError = 'Could not load this client. Please retry before saving changes.';
      this.notify();
      return null;
    }
    const result = await adapter.customers.save(toCanonicalClient(form, existing, id));
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not save this client');
      this.notify();
      return null;
    }
    await this.loadClients();
    if (this.clientWorkspaceId === result.value.id) await this.loadClientWorkspace(result.value.id);
    return result.value.id;
  }

  private async readCanonicalClient(id: string): Promise<Client | undefined> {
    const result = await adapter.customers.get(id);
    return result.ok ? result.value : undefined;
  }

  /** Append a dated note. Notes are dealer-private and never client-safe. */
  async addClientNote(id: string, text: string): Promise<boolean> {
    this.lastWriteError = '';
    const trimmed = text.trim();
    if (!trimmed) return false;
    const existing = await this.readCanonicalClient(id);
    if (!existing) { this.lastWriteError = 'This client is no longer available.'; this.notify(); return false; }
    const result = await adapter.customers.save({
      ...existing,
      notes: [{ at: new Date().toISOString(), text: trimmed }, ...(existing.notes ?? [])].slice(0, 200),
    });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not save this note');
      this.notify();
      return false;
    }
    await this.loadClients();
    if (this.clientWorkspaceId === id) await this.loadClientWorkspace(id);
    return true;
  }

  /** Archive is non-destructive: links, deals and purchases all survive. */
  async archiveClient(id: string): Promise<boolean> {
    this.lastWriteError = '';
    const existing = await this.readCanonicalClient(id);
    if (!existing) { this.lastWriteError = 'This client is no longer available.'; this.notify(); return false; }
    const result = await adapter.customers.save({ ...existing, archived: true });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not archive this client');
      this.notify();
      return false;
    }
    await this.loadClients();
    return true;
  }

  /** Shortlist toggle. Persisted so it survives a refresh. */
  async setClientInterest(id: string, propertyIds: readonly string[]): Promise<boolean> {
    this.lastWriteError = '';
    const existing = await this.readCanonicalClient(id);
    if (!existing) {
      this.lastWriteError = 'Could not load this client. Please retry before updating the shortlist.';
      this.notify();
      return false;
    }
    const result = await adapter.customers.save({ ...existing, interest: [...propertyIds] });
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not update the shortlist');
      this.notify();
      return false;
    }
    await this.loadClients();
    return true;
  }

  /** Existing client with the same 10-digit number, so Add does not duplicate. */
  findClientByPhone(phone: string, skipId?: string): Record<string, unknown> | null {
    const digits = String(phone ?? '').replace(/[^0-9]/g, '').slice(-10);
    if (digits.length < 10) return null;
    return this.clients.find((c) =>
      c.id !== skipId && String(c.phone ?? '').replace(/[^0-9]/g, '').slice(-10) === digits) ?? null;
  }

  /* ── client profile ── */

  clientWorkspace: Record<string, unknown> | null = null;
  clientWorkspaceId: string | null = null;
  clientWorkspaceStatus: SectionStatus = { state: 'idle' };

  /**
   * A client profile assembled from canonical relationships: the client,
   * the properties they have actually bought, and their deals. Link
   * activity joins this when Client Links is wired — until then the
   * behaviour panel shows a truthful empty state rather than invented
   * opens.
   */
  async loadClientWorkspace(clientId: string): Promise<void> {
    this.clientWorkspaceId = clientId;
    this.clientWorkspaceStatus = { state: 'loading' };
    this.notify();
    const client = await adapter.customers.get(clientId);
    if (this.clientWorkspaceId !== clientId) return;
    if (!client.ok) {
      this.clientWorkspace = null;
      this.clientWorkspaceStatus = { state: 'error', error: message(client.error, 'Client could not be loaded') };
      this.notify();
      return;
    }
    const purchasedIds = new Set(client.value.purchased ?? []);
    const purchased = this.properties.filter((p) => purchasedIds.has(String(p.id)));
    this.clientWorkspace = {
      client: toDeskClient(client.value),
      purchased,
      canonical: client.value,
    };
    this.clientWorkspaceStatus = { state: 'ready' };
    this.notify();
  }

  closeClientWorkspace(): void {
    this.clientWorkspaceId = null;
    this.clientWorkspace = null;
    this.clientWorkspaceStatus = { state: 'idle' };
  }

  /** Remove a property that has not sold. Sold records keep their history. */
  async deleteProperty(id: string): Promise<boolean> {
    this.lastWriteError = '';
    const result = await adapter.properties.remove(id);
    if (!result.ok) {
      this.lastWriteError = message(result.error, 'Could not delete this property');
      this.notify();
      return false;
    }
    await this.loadProperties();
    return true;
  }

  /** Documents for one property, loaded only when a detail view opens. */
  propertyDocuments: Record<string, unknown>[] = [];
  propertyDocumentsId: string | null = null;
  propertyDocumentsStatus: SectionStatus = { state: 'idle' };

  async loadPropertyDocuments(propertyId: string): Promise<void> {
    this.propertyDocumentsId = propertyId;
    this.propertyDocumentsStatus = { state: 'loading' };
    this.notify();
    const result = await adapter.propertyDocuments.listForProperty(propertyId);
    if (this.propertyDocumentsId !== propertyId) return;
    if (!result.ok) {
      this.propertyDocuments = [];
      this.propertyDocumentsStatus = { state: 'error', error: message(result.error, 'Papers could not be loaded') };
    } else {
      this.propertyDocuments = result.value.map((d) => ({
        id: d.id, name: d.title, kind: d.type, path: d.storage.path,
        sizeBytes: d.sizeBytes, createdAt: d.createdAt,
      }));
      this.propertyDocumentsStatus = { state: 'ready' };
      const row = this.properties.find((p) => p.id === propertyId);
      if (row) row.docs = this.propertyDocuments;
    }
    this.notify();
  }

  /** Existing seller with the same 10-digit number, so Add does not duplicate. */
  findSellerByPhone(phone: string, skipId?: string): DeskSeller | null {
    const digits = String(phone ?? '').replace(/[^0-9]/g, '').slice(-10);
    if (digits.length < 10) return null;
    return this.sellers.find((s) =>
      s.id !== skipId && String(s.phone ?? '').replace(/[^0-9]/g, '').slice(-10) === digits) ?? null;
  }
}

export const deskStore = new DeskStore();
