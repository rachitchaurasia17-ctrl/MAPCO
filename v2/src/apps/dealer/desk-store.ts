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
  SellerAvailability, Property, PropertySeller,
} from '../../packages/data/types';
import type { RepoError } from '../../packages/data/contracts';

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

  /** Existing seller with the same 10-digit number, so Add does not duplicate. */
  findSellerByPhone(phone: string, skipId?: string): DeskSeller | null {
    const digits = String(phone ?? '').replace(/[^0-9]/g, '').slice(-10);
    if (digits.length < 10) return null;
    return this.sellers.find((s) =>
      s.id !== skipId && String(s.phone ?? '').replace(/[^0-9]/g, '').slice(-10) === digits) ?? null;
  }
}

export const deskStore = new DeskStore();
