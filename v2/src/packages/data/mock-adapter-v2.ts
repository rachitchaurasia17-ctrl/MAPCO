/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Mock Adapter (implements DataAdapterV2)
   ---------------------------------------------------------------
   Deterministic, bounded fixtures. No randomness, no fabricated
   live market intelligence. Scenario-switchable in dev only.
   Implements exactly the interfaces future Supabase/IndexedDB
   adapters will implement — screens never change in Pass 2.
   ═══════════════════════════════════════════════════════════════ */

import type {
  Property, PropertyLocationInput, Client, Deal, ClientLink, MapData, DemandSignal,
} from './types';
import {
  PROPERTIES, CLIENTS, DEALS, CLIENT_LINKS, DEMAND_SIGNALS, persistMock,
} from './mock-adapter';
import {
  ok, err, activeScenario,
  type Scenario, type Result, type Page, type PageParams, type QueryOptions,
  type AuthRepository, type ActivationState, type AccountState,
  type PropertyRepository, type CustomerRepository, type DealRepository, type RecordSaleInput,
  type DemandRepository, type DemandRecord, type DemandDraft, type DemandMatch,
  type MapRepository, type PresentationRepository, type PresentationState, type PresentationProperty,
  type PresentationEventsRepository, type PresentationEvent,
  type PredictiveRepository,
  type ClientLinkRepository, type ClientLinkState, type ClientSafePayload, type ClientSafeProperty,
  type MediaRepository, type MediaState,
  type DemandSignalsRepository, type DataAdapterV2,
} from './contracts';
import type { DealerPredictionSummary, PredictiveActionEvent } from '../performance';
import { publishResourceInvalidation } from '../performance';
import {
  normalizePropertyPhotoStorage,
  persistentPropertyPayload,
  propertyPhotoObjectPath,
  validatePropertyPhoto,
} from './property-photos';
import {
  createPropertyLocation,
  normalizePropertyLocationOnRead,
  propertyLocationValidationError,
  propertyLocationPoint,
} from './property-location';
import { normalizeCompletedDeal } from './deal-normalization';

/* ── helpers ─────────────────────────────────────────────────── */

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MOCK_PROPERTY_PHOTOS = new Map<string, string>();

function hydrateMockProperty(property: Property): Property {
  const privatePhotos = normalizePropertyPhotoStorage(property.photoStorage, property.id)
    .flatMap((ref) => MOCK_PROPERTY_PHOTOS.get(ref.path) ?? []);
  return normalizePropertyLocationOnRead({
    ...property,
    photos: [...(property.photos ?? []), ...privatePhotos],
  });
}

/** Reject a call if its AbortSignal already fired. */
function aborted<T>(opts?: QueryOptions): Result<T> | null {
  return opts?.signal?.aborted ? err('aborted', 'Request cancelled') : null;
}

/** Deterministic keyset pagination over a bounded in-memory array. */
function paginate<T extends { id: string }>(
  all: readonly T[],
  params: PageParams | undefined,
  matches: (item: T, q: string) => boolean,
): Page<T> {
  const q = (params?.query ?? '').trim().toLowerCase();
  const filtered = q ? all.filter((i) => matches(i, q)) : all.slice();
  const limit = Math.min(params?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const start = params?.cursor ? filtered.findIndex((i) => i.id === params.cursor) + 1 : 0;
  const items = filtered.slice(start, start + limit);
  const nextIndex = start + limit;
  return {
    items,
    nextCursor: nextIndex < filtered.length ? items[items.length - 1]!.id : null,
    total: filtered.length,
  };
}

const sc = (): Scenario => activeScenario();

/* ═══════════════════════════════════════════════════════════════
   AUTH / ACCOUNT / DEVICE
   ═══════════════════════════════════════════════════════════════ */

class MockAuthRepository implements AuthRepository {
  async getActivationState(opts?: QueryOptions): Promise<Result<ActivationState>> {
    const a = aborted<ActivationState>(opts); if (a) return a;
    switch (sc()) {
      case 'activation-required': return ok({ kind: 'required' });
      case 'activation-invalid': return ok({ kind: 'invalid-code' });
      case 'activation-expired': return ok({ kind: 'expired-code' });
      case 'device-approval': return ok({ kind: 'device-approval-required' });
      case 'device-limit': return ok({ kind: 'device-limit-reached', max: 3 });
      case 'error': return err('network', 'Could not reach activation service', { retryable: true });
      default: return ok({ kind: 'activated' });
    }
  }

  async submitActivationCode(code: string, opts?: QueryOptions): Promise<Result<ActivationState>> {
    const a = aborted<ActivationState>(opts); if (a) return a;
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) return ok({ kind: 'invalid-code' });
    // Deterministic dev outcomes by prefix — never a live check.
    if (clean.startsWith('000')) return ok({ kind: 'expired-code' });
    if (clean.startsWith('111')) return ok({ kind: 'device-limit-reached', max: 3 });
    if (clean.startsWith('222')) return ok({ kind: 'device-approval-required' });
    if (clean === '123456') return ok({ kind: 'activated' });
    return ok({ kind: 'invalid-code' });
  }

  async getAccountState(opts?: QueryOptions): Promise<Result<AccountState>> {
    const a = aborted<AccountState>(opts); if (a) return a;
    switch (sc()) {
      case 'trial': return ok({ kind: 'trial', daysLeft: 9 });
      case 'trial-ending': return ok({ kind: 'trial-ending', daysLeft: 2 });
      case 'account-expired': return ok({ kind: 'expired' });
      case 'account-suspended': return ok({ kind: 'suspended' });
      case 'access-denied': return ok({ kind: 'access-denied' });
      case 'role-mismatch': return ok({ kind: 'role-mismatch', need: 'owner' });
      default: return ok({ kind: 'active' });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   GENERIC RECORD REPO (properties / customers / deals)
   ═══════════════════════════════════════════════════════════════ */

function scenarioResult<T>(): Result<Page<T>> | null {
  switch (sc()) {
    case 'error': return err('network', 'Could not load records', { retryable: true });
    case 'empty': return ok({ items: [], nextCursor: null, total: 0 });
    default: return null;
  }
}

class MockPropertyRepository implements PropertyRepository {
  async list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Property>>> {
    const a = aborted<Page<Property>>(opts); if (a) return a;
    const s = scenarioResult<Property>(); if (s) return s;
    const page = paginate(PROPERTIES, params, (p, q) =>
      p.area.toLowerCase().includes(q) || p.loc.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
    return ok({ ...page, items: page.items.map(hydrateMockProperty) });
  }
  async get(id: string, opts?: QueryOptions): Promise<Result<Property>> {
    const a = aborted<Property>(opts); if (a) return a;
    const found = PROPERTIES.find((p) => p.id === id);
    return found ? ok(hydrateMockProperty(found)) : err('not_found', 'Property not found');
  }
  async save(property: Property, opts?: QueryOptions): Promise<Result<Property>> {
    const a = aborted<Property>(opts); if (a) return a;
    const locationError = propertyLocationValidationError(property.location);
    if (locationError) return err('validation', locationError);
    const id = property.id || `prop-${Date.now()}`;
    const row = persistentPropertyPayload({ ...property, id });
    const i = PROPERTIES.findIndex((p) => p.id === id);
    if (i >= 0) PROPERTIES[i] = row; else PROPERTIES.unshift(row);
    persistMock();
    publishResourceInvalidation({ entity: 'property', id });
    return ok(hydrateMockProperty(row));
  }
  async remove(id: string, opts?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    const index = PROPERTIES.findIndex((property) => property.id === id);
    if (index < 0) return err('not_found', 'Property not found');
    PROPERTIES.splice(index, 1);
    persistMock();
    publishResourceInvalidation({ entity: 'property', id });
    return ok(undefined);
  }
  async setLocation(
    id: string,
    location: PropertyLocationInput | null,
    opts?: QueryOptions,
  ): Promise<Result<Property>> {
    const a = aborted<Property>(opts); if (a) return a;
    if (location) {
      const locationError = propertyLocationValidationError(location);
      if (locationError) return err('validation', locationError);
    }
    const index = PROPERTIES.findIndex((property) => property.id === id);
    if (index < 0) return err('not_found', 'Property not found');
    const property = PROPERTIES[index]!;
    if (location) PROPERTIES[index] = { ...property, location: createPropertyLocation(location) };
    else {
      const { location: _removed, ...withoutLocation } = property;
      PROPERTIES[index] = withoutLocation as Property;
    }
    persistMock();
    publishResourceInvalidation({ entity: 'property', id });
    return ok(hydrateMockProperty(PROPERTIES[index]!));
  }
}

class MockCustomerRepository implements CustomerRepository {
  async list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Client>>> {
    const a = aborted<Page<Client>>(opts); if (a) return a;
    const s = scenarioResult<Client>(); if (s) return s;
    return ok(paginate(CLIENTS, params, (c, q) =>
      c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)));
  }
  async get(id: string, opts?: QueryOptions): Promise<Result<Client>> {
    const a = aborted<Client>(opts); if (a) return a;
    const found = CLIENTS.find((c) => c.id === id);
    return found ? ok(found) : err('not_found', 'Customer not found');
  }
  async save(client: Client, opts?: QueryOptions): Promise<Result<Client>> {
    const a = aborted<Client>(opts); if (a) return a;
    const id = client.id || `client-${Date.now()}`;
    const row = { ...client, id };
    const i = CLIENTS.findIndex((c) => c.id === id);
    if (i >= 0) CLIENTS[i] = row; else CLIENTS.unshift(row);
    persistMock();
    publishResourceInvalidation({ entity: 'client', id });
    return ok(row);
  }
}

class MockDealRepository implements DealRepository {
  async list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<Deal>>> {
    const a = aborted<Page<Deal>>(opts); if (a) return a;
    const s = scenarioResult<Deal>(); if (s) return s;
    const completed = DEALS.flatMap((payload) => {
      const deal = normalizeCompletedDeal(String(payload.id ?? ''), payload as unknown as Record<string, unknown>);
      return deal ? [deal] : [];
    });
    return ok(paginate(completed, params, (d, q) =>
      `${d.prop} ${d.buyer} ${d.seller} ${d.city} ${d.sector}`.toLowerCase().includes(q)));
  }
  async get(id: string, opts?: QueryOptions): Promise<Result<Deal>> {
    const a = aborted<Deal>(opts); if (a) return a;
    const found = DEALS.find((d) => d.id === id);
    if (!found) return err('not_found', 'Deal not found');
    const deal = normalizeCompletedDeal(String(found.id ?? id), found as unknown as Record<string, unknown>);
    return deal ? ok(deal) : err('not_found', 'Completed sale not found');
  }

  /**
   * Record a completed sale. In-memory mutations are synchronous, so the three
   * writes (property→sold, deal created, buyer history) either all apply or the
   * method returns a validation error before any of them run — no partial state.
   */
  async record(input: RecordSaleInput, opts?: QueryOptions): Promise<Result<Deal>> {
    const a = aborted<Deal>(opts); if (a) return a;

    const prop = PROPERTIES.find((p) => p.id === input.propertyId);
    if (!prop) return err('not_found', 'That property is no longer available');
    if (prop.sold) return err('conflict', 'That property is already marked sold');
    if (!(input.soldPrice > 0)) return err('validation', 'Enter a final sold price');
    if (!input.saleDate) return err('validation', 'Enter the sale date');

    // Resolve the buyer (existing customer or a freshly created one).
    let buyer = input.buyerId ? CLIENTS.find((c) => c.id === input.buyerId) : undefined;
    if (!buyer) {
      if (!input.newBuyer?.name) return err('validation', 'Choose or add a buyer');
      buyer = {
        id: `client-${Date.now()}`, name: input.newBuyer.name, phone: input.newBuyer.phone || '',
        city: input.newBuyer.city || prop.city, want: prop.want, budget: '', budgetMax: input.soldPrice,
        status: 'active', seen: '', note: '', viewed: [], interest: [], purchased: [],
      };
      CLIENTS.unshift(buyer);
    }

    const deal: Deal = {
      id: `deal-${Date.now()}`,
      propId: prop.id, prop: `${prop.area} ${prop.type.toLowerCase().includes('plot') ? 'plot' : 'site'}`,
      propSub: `${prop.size} · ${prop.facing}`, city: prop.city, sector: prop.sector || prop.loc,
      buyerId: buyer.id, buyer: buyer.name,
      seller: input.seller || '', sellerPhone: input.sellerPhone,
      soldPrice: input.soldPrice, brokerage: input.brokerage ?? 0, commission: input.commission ?? 0,
      commissionReceived: input.commissionReceived ?? false,
      paymentReceived: input.paymentReceived ?? 0,
      soldDate: input.saleDate, registrationDate: input.registrationDate,
      dealer: 'Chaurasia Properties',
      documents: (input.documents ?? []).map((d) => ({ name: d.name, kind: d.kind })),
      timeline: [
        { at: input.saleDate, label: 'Sold price recorded' },
        ...(input.registrationDate ? [{ at: input.registrationDate, label: 'Registration completed' }] : []),
      ],
      fieldPresence: {
        soldPrice: true,
        brokerage: input.brokerage !== undefined,
        commission: input.commission !== undefined,
        commissionReceived: input.commission !== undefined,
        paymentReceived: input.paymentReceived !== undefined,
        soldDate: true,
        documents: input.documents !== undefined,
        timeline: true,
      },
    };

    // Commit — mark sold (removes it from inventory, presentation and links),
    // create the deal, and append to the buyer's purchased history.
    prop.sold = true;
    prop.published = false;
    DEALS.unshift(deal);
    buyer.purchased = [...(buyer.purchased ?? []), prop.id];
    persistMock();
    publishResourceInvalidation({ entity: 'inventory', id: prop.id });

    return ok(deal);
  }
}

/* ═══════════════════════════════════════════════════════════════
   DEMAND — deterministic fixtures + matching
   ═══════════════════════════════════════════════════════════════ */

export const DEMAND_RECORDS: DemandRecord[] = [
  {
    id: 'dm1', customerId: 'c1', customerName: 'Rajiv Sharma', category: 'buy',
    preferredLocations: ['New Chandigarh', 'Mohali'], propertyType: 'Residential Plot',
    sizeMin: '300 sq yd', sizeMax: '500 sq yd', configuration: 'Park facing preferred',
    budgetMin: 8000000, budgetMax: 12000000, urgency: 'immediate',
    followUp: 'contacted', status: 'open', note: 'Ready to move on a corner/park-facing plot.',
  },
  {
    id: 'dm2', customerId: 'c2', customerName: 'Priya Mehta', category: 'buy',
    preferredLocations: ['Mohali'], propertyType: 'Residential Plot',
    sizeMin: '200 sq yd', sizeMax: '300 sq yd', configuration: 'East facing',
    budgetMin: 4000000, budgetMax: 6000000, urgency: 'this-quarter',
    followUp: 'visit-planned', status: 'open',
  },
  {
    id: 'dm3', customerId: 'c3', customerName: 'Amandeep Singh', category: 'invest',
    preferredLocations: ['New Chandigarh'], propertyType: 'Kothi',
    configuration: '1 kanal', budgetMin: 12000000, budgetMax: 20000000,
    urgency: 'exploring', followUp: 'new', status: 'on-hold',
  },
  {
    id: 'dm4', customerId: 'c4', customerName: 'Neha Kapoor', category: 'buy',
    preferredLocations: ['Panchkula', 'Mohali'], propertyType: 'Flat',
    configuration: '3 BHK', budgetMin: 6000000, budgetMax: 9000000,
    urgency: 'this-quarter', followUp: 'new', status: 'open',
  },
];

class MockDemandRepository implements DemandRepository {
  async list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<DemandRecord>>> {
    const a = aborted<Page<DemandRecord>>(opts); if (a) return a;
    const s = scenarioResult<DemandRecord>(); if (s) return s;
    return ok(paginate(DEMAND_RECORDS, params, (d, q) =>
      d.customerName.toLowerCase().includes(q) ||
      d.preferredLocations.some((l) => l.toLowerCase().includes(q))));
  }

  async get(id: string, opts?: QueryOptions): Promise<Result<DemandRecord>> {
    const a = aborted<DemandRecord>(opts); if (a) return a;
    const found = DEMAND_RECORDS.find((d) => d.id === id);
    return found ? ok(found) : err('not_found', 'Demand record not found');
  }

  async match(id: string, opts?: QueryOptions): Promise<Result<DemandMatch[]>> {
    const a = aborted<DemandMatch[]>(opts); if (a) return a;
    if (sc() === 'error') return err('network', 'Matching service unavailable', { retryable: true });
    const rec = DEMAND_RECORDS.find((d) => d.id === id);
    if (!rec) return err('not_found', 'Demand record not found');

    // Deterministic scoring — pure function of the fixtures, no randomness.
    const matches: DemandMatch[] = [];
    for (const p of PROPERTIES) {
      if (p.sold || !p.published) continue;
      const reasons: string[] = [];
      let score = 0;
      if (p.type === rec.propertyType) { score += 0.4; reasons.push('Property type matches'); }
      if (rec.preferredLocations.some((l) => p.city === l || p.loc.includes(l))) {
        score += 0.35; reasons.push('In a preferred location');
      }
      if (p.price >= rec.budgetMin && p.price <= rec.budgetMax) {
        score += 0.25; reasons.push('Within budget');
      } else if (p.price <= rec.budgetMax) {
        score += 0.1; reasons.push('Below max budget');
      }
      if (score >= 0.5) matches.push({ property: p, score: Math.min(score, 1), reasons });
    }
    matches.sort((x, y) => y.score - x.score);
    return ok(matches); // may be [] → UI shows deterministic "no-match" state
  }

  async save(draft: DemandDraft, opts?: QueryOptions): Promise<Result<DemandRecord>> {
    const a = aborted<DemandRecord>(opts); if (a) return a;
    const customer = CLIENTS.find((c) => c.id === draft.customerId);
    if (!customer) return err('validation', 'Unknown customer');
    if (draft.budgetMin > draft.budgetMax) return err('validation', 'Min budget exceeds max');
    // Pass 1 is read-only against fixtures; echo the persisted shape.
    const rec: DemandRecord = { ...draft, id: draft.id ?? 'dm-new', customerName: customer.name };
    return ok(rec);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAPS / PRESENTATION / EVENTS
   ═══════════════════════════════════════════════════════════════ */

const MAP_REGISTRY: MapData[] = [
  {
    id: 'mohali-master', kind: 'masterplan', city: 'Mohali', sector: 'Master Plan',
    label: 'Mohali — Master Plan', raster: '/maps-pilot/mohali-masterplan.png',
    dims: { original: { w: 1603, h: 1278 }, threeD: { w: 1448, h: 1086 } },
    assets: { original: { path: '/maps-pilot/mohali-masterplan.png', w: 1603, h: 1278 }, threeD: { path: '/maps-pilot/mohali-3d.png', w: 1448, h: 1086 } },
    // Mock mode has no aligned overlay asset → highlights show "Alignment pending".
    calibration: { status: 'unavailable', overlayViewBox: null, raster: { w: 1603, h: 1278 } },
    published: true, hidden: false,
    linkedProperties: ['ecocity', 'block5', 'omx'],
    sets: [
      {
        id: 'masterplan-mohali',
        name: 'Master Plan',
        // Development-only normalized preview positions invented in fa6642b.
        // They were not measured from a survey or approved map artwork.
        marks: [
          { kind: 'pin', coordinateProvenance: 'development-mock', points: { x: 0.45, y: 0.35 }, label: 'Eco City', propertyId: 'ecocity' },
          { kind: 'pin', coordinateProvenance: 'development-mock', points: { x: 0.65, y: 0.75 }, label: 'Block 5', propertyId: 'block5' },
          { kind: 'pin', coordinateProvenance: 'development-mock', points: { x: 0.55, y: 0.55 }, label: 'Omaxe', propertyId: 'omx' }
        ]
      }
    ]
  },
];

const MAP_PLACEMENT_REGISTRY: MapData[] = [
  ...MAP_REGISTRY,
  {
    id: 'mohali-sector-90-91', kind: 'sector', city: 'Mohali', sector: 'Sector 90-91',
    area: 'Janta Township', parentMapId: 'mohali-master', label: 'Mohali — Sector 90-91',
    raster: '/maps-pilot/mohali-sector-90-91.jpg',
    dims: { original: { w: 1024, h: 724 } },
    assets: { original: { path: '/maps-pilot/mohali-sector-90-91.jpg', w: 1024, h: 724 } },
    calibration: { status: 'unavailable', overlayViewBox: null, raster: { w: 1024, h: 724 } },
    published: true, hidden: false, linkedProperties: [], sets: [],
  },
];

class MockMapRepository implements MapRepository {
  async listRegistry(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<MapData>>> {
    const a = aborted<Page<MapData>>(opts); if (a) return a;
    if (sc() === 'no-map') return ok({ items: [], nextCursor: null, total: 0 });
    return ok(paginate(MAP_REGISTRY, params, (m, q) => m.label.toLowerCase().includes(q)));
  }
  async listPlacementCatalog(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<MapData>>> {
    const a = aborted<Page<MapData>>(opts); if (a) return a;
    if (sc() === 'no-map') return ok({ items: [], nextCursor: null, total: 0 });
    return ok(paginate(MAP_PLACEMENT_REGISTRY, params, (m, q) => m.label.toLowerCase().includes(q)));
  }
  async get(id: string, opts?: QueryOptions): Promise<Result<MapData>> {
    const a = aborted<MapData>(opts); if (a) return a;
    if (sc() === 'map-asset-failed') return err('unavailable', 'Map asset failed to load');
    const meta = MAP_REGISTRY.find((m) => m.id === id);
    if (!meta) return err('not_found', 'Map not found');
    return ok({ ...meta });
  }
}

class MockPresentationRepository implements PresentationRepository {
  async listMaps(opts?: QueryOptions): Promise<Result<readonly Omit<MapData, 'sets'>[]>> {
    const a = aborted<readonly Omit<MapData, 'sets'>[]>(opts); if (a) return a;
    return ok(MAP_REGISTRY.filter((map) => map.published && !map.hidden).map(({ sets: _sets, ...map }) => map));
  }

  async getState(opts?: QueryOptions): Promise<Result<PresentationState>> {
    const a = aborted<PresentationState>(opts); if (a) return a;
    switch (sc()) {
      case 'maps-loading': return ok({ kind: 'maps-loading' });
      case 'no-map': return ok({ kind: 'no-map' });
      case 'no-properties': return ok({ kind: 'no-properties' });
      case 'selected-unavailable': return ok({ kind: 'selected-unavailable' });
      case 'map-asset-failed': return ok({ kind: 'map-asset-failed' });
      case 'overlay-unavailable': return ok({ kind: 'overlay-unavailable' });
      case 'error': return err('network', 'Presentation failed to load', { retryable: true });
      default: return ok({ kind: 'ready', maps: MAP_REGISTRY });
    }
  }

  async getMap(id: string, opts?: QueryOptions): Promise<Result<MapData>> {
    const a = aborted<MapData>(opts); if (a) return a;
    const map = MAP_REGISTRY.find((candidate) => candidate.id === id && candidate.published && !candidate.hidden);
    return map ? ok({ ...map, sets: map.sets.map((set) => ({ ...set })) }) : err('not_found', 'Presentation map not found');
  }

  async listProperties(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<PresentationProperty>>> {
    const a = aborted<Page<PresentationProperty>>(opts); if (a) return a;
    if (sc() === 'empty' || sc() === 'no-properties') return ok({ items: [], nextCursor: null, total: 0 });
    const visible = PROPERTIES.filter((property) => property.published && !property.sold);
    const page = paginate(visible, params, (property, query) =>
      `${property.area} ${property.loc} ${property.type} ${property.city}`.toLowerCase().includes(query));
    return ok({
      ...page,
      items: page.items.map(projectPresentationProperty),
    });
  }

  async getProperty(id: string, opts?: QueryOptions): Promise<Result<PresentationProperty>> {
    const a = aborted<PresentationProperty>(opts); if (a) return a;
    const property = PROPERTIES.find((candidate) => candidate.id === id && candidate.published && !candidate.sold);
    return property ? ok(projectPresentationProperty(property)) : err('not_found', 'Presentation property not found');
  }
}

function projectPresentationProperty(property: Property): PresentationProperty {
  const hydrated = hydrateMockProperty(property);
  return {
    id: hydrated.id,
    type: hydrated.type,
    city: hydrated.city,
    area: hydrated.area,
    loc: hydrated.loc,
    sector: hydrated.sector,
    size: hydrated.size,
    facing: hydrated.facing,
    position: hydrated.position,
    approvals: [...hydrated.approvals],
    landmarks: hydrated.landmarks.map(({ name, distance, icon }) => ({ name, distance, icon })),
    photos: [...hydrated.photos],
    masterplanId: hydrated.masterplanId,
    sectorMapId: hydrated.sectorMapId,
    mapPlacement: hydrated.mapPlacement ? { ...hydrated.mapPlacement } : undefined,
    hasEarthLocation: propertyLocationPoint(hydrated.location) !== null,
  };
}

class MockPresentationEventsRepository implements PresentationEventsRepository {
  async record(_event: PresentationEvent, opts?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    return ok(undefined); // fire-and-forget; no fabricated analytics
  }
}

class MockPredictiveRepository implements PredictiveRepository {
  async record(_event: PredictiveActionEvent, opts?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    return ok(undefined);
  }
  async summaries(opts?: QueryOptions): Promise<Result<readonly DealerPredictionSummary[]>> {
    const a = aborted<readonly DealerPredictionSummary[]>(opts); if (a) return a;
    return ok([]);
  }
}

/* ═══════════════════════════════════════════════════════════════
   CLIENT LINKS + CLIENT-SAFE MAPPER  (security boundary)
   ═══════════════════════════════════════════════════════════════ */

/**
 * The ONE place a full internal Property is projected down to the
 * buyer-safe shape. Forbidden fields (phone, commission, notes,
 * sold, published, views, owner, team, internal status) are simply
 * never copied — the output TYPE cannot hold them.
 */
export function toClientSafeProperty(
  p: Property,
  vis: { price: boolean; location: boolean },
): ClientSafeProperty {
  const safe: ClientSafeProperty = {
    id: p.id,
    area: p.area,
    size: p.size,
    facing: p.facing,
    position: p.position,
    photos: p.photos.slice(),           // approved photos only in fixtures
    approvals: p.approvals.slice(),
    landmarks: p.landmarks.map((l) => ({ name: l.name, distance: l.distance, icon: l.icon })),
    ...(vis.location ? { loc: p.loc } : {}),
    ...(vis.price ? { price: p.price } : {}),
  };
  return safe;
}

function buildPayload(link: ClientLink): ClientSafePayload {
  const priceVisible = link.price === 'shown';
  const locationVisible = link.loc !== 'hidden';
  const props = link.props
    .map((id) => PROPERTIES.find((p) => p.id === id))
    .filter((p): p is Property => !!p)
    .map((p) => toClientSafeProperty(p, { price: priceVisible, location: locationVisible }));
  return {
    dealerDisplayName: 'Chaurasia Properties', // display name only — never a seller identity record
    dealerPhone: '+919876500000',              // the DEALER's own contact (not the seller's)
    dealerWhatsapp: '+919876500000',
    buyerName: (link.clientName || '').split(' ')[0] || undefined,
    properties: props,
    priceVisible,
    locationVisible,
    ...(link.audio === 'done' ? { voiceNote: { url: '', seconds: link.audioSecs } } : {}),
  };
}

class MockClientLinkRepository implements ClientLinkRepository {
  async list(params?: PageParams, opts?: QueryOptions): Promise<Result<Page<ClientLink>>> {
    const a = aborted<Page<ClientLink>>(opts); if (a) return a;
    const s = scenarioResult<ClientLink>(); if (s) return s;
    return ok(paginate(CLIENT_LINKS, params, (l, q) => l.clientName.toLowerCase().includes(q)));
  }

  async listForProperty(propertyId: string, opts?: QueryOptions): Promise<Result<ClientLink[]>> {
    const a = aborted<ClientLink[]>(opts); if (a) return a;
    return ok(CLIENT_LINKS.filter((l) => l.props.includes(propertyId)));
  }

  async resolve(token: string, opts?: QueryOptions): Promise<Result<ClientLinkState>> {
    const a = aborted<ClientLinkState>(opts); if (a) return a;

    // Scenario override (dev) takes precedence so every state is reachable.
    switch (sc()) {
      case 'link-invalid': return ok({ kind: 'invalid-token' });
      case 'link-expired': return ok({ kind: 'expired' });
      case 'link-revoked': return ok({ kind: 'revoked' });
      case 'link-unavailable': return ok({ kind: 'unavailable' });
      case 'link-no-photos': {
        const p = buildPayload(CLIENT_LINKS[0]!);
        return ok({ kind: 'no-approved-photos', payload: { ...p, properties: p.properties.map((x) => ({ ...x, photos: [] })) } });
      }
      case 'link-price-hidden': {
        const link = { ...CLIENT_LINKS[0]!, price: 'hidden' as const };
        return ok({ kind: 'valid', payload: buildPayload(link) });
      }
      case 'link-location-hidden': {
        const link = { ...CLIENT_LINKS[0]!, loc: 'hidden' as const };
        return ok({ kind: 'valid', payload: buildPayload(link) });
      }
    }

    if (!token) return ok({ kind: 'invalid-token' });
    // Deterministic resolution by token → link id mapping.
    const link = CLIENT_LINKS.find((l) => l.id === token || token === `tok-${l.id}`);
    if (!link) return ok({ kind: 'invalid-token' });
    if (link.status === 'expired') return ok({ kind: 'expired' });
    if (link.status === 'revoked') return ok({ kind: 'revoked' });
    return ok({ kind: 'valid', payload: buildPayload(link) });
  }

  async create(input: import('./contracts').CreateClientLinkInput, opts?: QueryOptions): Promise<Result<import('./contracts').CreatedClientLink>> {
    const a = aborted<import('./contracts').CreatedClientLink>(opts); if (a) return a;
    const id = `link-${Date.now()}`;
    const token = `tok-${id}`;
    CLIENT_LINKS.unshift({
      id, clientId: input.clientId ?? '', clientName: 'New client', props: input.propertyIds, propNames: [],
      propertyCount: input.propertyIds.length, expiry: `${input.expiresInDays}d`, loc: input.locationVisibility === 'hidden' ? 'hidden' : 'area',
      price: input.priceVisibility, audio: input.audioBlob ? 'done' : 'none', audioSecs: input.audioSeconds ?? 0,
      status: 'active', events: { opens: 0, played: 0, called: 0, wa: 0, visit: 0 }, lastOpen: 'not yet',
    } as ClientLink);
    persistMock();
    publishResourceInvalidation({ entity: 'client-link', id });
    return ok({ id, token, url: `/client/?token=${token}`, expiresAt: '' });
  }

  async revoke(id: string, opts?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    const link = CLIENT_LINKS.find((l) => l.id === id);
    if (link) link.status = 'revoked';
    persistMock();
    publishResourceInvalidation({ entity: 'client-link', id });
    return ok(undefined);
  }

  async recordEvent(
    token: string,
    event: 'opened' | 'audio_played' | 'call_clicked' | 'whatsapp_clicked' | 'visit_requested',
    _propertyPublicId?: string,
    opts?: QueryOptions,
  ): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    const link = CLIENT_LINKS.find((l) => l.id === token || token === `tok-${l.id}`);
    if (!link) return ok(undefined);
    const key = event === 'opened' ? 'opens' : event === 'audio_played' ? 'played'
      : event === 'call_clicked' ? 'called' : event === 'whatsapp_clicked' ? 'wa' : 'visit';
    link.events[key] += 1;
    persistMock();
    return ok(undefined);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MEDIA
   ═══════════════════════════════════════════════════════════════ */

class MockMediaRepository implements MediaRepository {
  thumb(assetId: string): string {
    // In fixtures the asset id IS the path; a real adapter would append ?w=thumb.
    return assetId;
  }
  async full(assetId: string, opts?: QueryOptions): Promise<Result<MediaState>> {
    const a = aborted<MediaState>(opts); if (a) return a;
    if (sc() === 'error') return ok({ kind: 'image-unavailable' });
    return ok({ kind: 'ready', url: MOCK_PROPERTY_PHOTOS.get(assetId.replace(/^property-photos\//, '')) ?? assetId });
  }
  async uploadPropertyPhoto(propertyId: string, file: File, opts?: QueryOptions) {
    const a = aborted<import('./types').PropertyPhotoStorageRef>(opts); if (a) return a;
    const validation = validatePropertyPhoto(file);
    if (validation) return err('validation', validation);
    const id = `mock${Date.now()}${MOCK_PROPERTY_PHOTOS.size}`;
    const path = propertyPhotoObjectPath('dealer-mock', propertyId, id, file.type);
    MOCK_PROPERTY_PHOTOS.set(path, URL.createObjectURL(file));
    return ok({ kind: 'storage' as const, id, path });
  }
  async removePropertyPhotos(paths: readonly string[], opts?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(opts); if (a) return a;
    for (const path of paths) {
      const url = MOCK_PROPERTY_PHOTOS.get(path);
      if (url) URL.revokeObjectURL(url);
      MOCK_PROPERTY_PHOTOS.delete(path);
    }
    return ok(undefined);
  }
}

class MockDemandSignalsRepository implements DemandSignalsRepository {
  async get(opts?: QueryOptions): Promise<Result<DemandSignal[]>> {
    const a = aborted<DemandSignal[]>(opts); if (a) return a;
    if (sc() === 'empty') return ok([]);
    if (sc() === 'error') return err('network', 'Signals unavailable', { retryable: true });
    return ok(DEMAND_SIGNALS);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ROOT ADAPTER
   ═══════════════════════════════════════════════════════════════ */

export class MockDataAdapterV2 implements DataAdapterV2 {
  readonly auth = new MockAuthRepository();
  readonly properties = new MockPropertyRepository();
  readonly customers = new MockCustomerRepository();
  readonly deals = new MockDealRepository();
  readonly demand = new MockDemandRepository();
  readonly demandSignals = new MockDemandSignalsRepository();
  readonly maps = new MockMapRepository();
  readonly presentation = new MockPresentationRepository();
  readonly presentationEvents = new MockPresentationEventsRepository();
  readonly predictive = new MockPredictiveRepository();
  readonly clientLinks = new MockClientLinkRepository();
  readonly media = new MockMediaRepository();
}

/** The single adapter instance every screen imports. Pass 2 swaps
 *  this construction for an environment-selected real adapter. */
export const adapter: DataAdapterV2 = new MockDataAdapterV2();
