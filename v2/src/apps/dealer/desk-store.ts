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
} from '../../packages/data/types';
import type { RepoError } from '../../packages/data/contracts';
import { normalizePropertySpecs } from '../../packages/data/property-specs';
import { propertyLifecycle } from '../../packages/data/property-lifecycle';

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
    docs: [],
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
    photos: existing?.photos ?? [],
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
  } as Property;
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
    const existingRow = options.id
      ? this.properties.find((p) => p.id === options.id)
      : undefined;
    const existing = existingRow
      ? await this.readCanonical(String(existingRow.id))
      : undefined;

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
      return { error: this.lastWriteError };
    }
    await this.loadProperties();
    return { property: result.value, ...(missing.length ? { missing } : {}) };
  }

  private async readCanonical(id: string): Promise<Property | undefined> {
    const result = await adapter.properties.get(id);
    return result.ok ? result.value : undefined;
  }

  /** Off-market / archive. Non-destructive — history and media survive. */
  async archiveProperty(id: string): Promise<boolean> {
    this.lastWriteError = '';
    const existing = await this.readCanonical(id);
    if (!existing) { this.lastWriteError = 'This property is no longer available.'; this.notify(); return false; }
    const result = await adapter.properties.save({ ...existing, lifecycle: 'archived' });
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
      this.clients.splice(0, this.clients.length, ...result.value.items.map((c) => ({
        ...c,
        // The Desk reads these two names; canonical uses purchased/note.
        plots: [...(c.purchased ?? [])],
        hot: c.status === 'hot',
      })));
      this.clientsStatus = { state: 'ready' };
    }
    this.notify();
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
