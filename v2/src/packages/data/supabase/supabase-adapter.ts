/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Supabase adapter (implements DataAdapterV2)
   ---------------------------------------------------------------
   Real data over MAPCO-DEV. CRM entities live in the polymorphic
   `crm_records` table (entity_type + payload jsonb), dealer-scoped
   by RLS. Privileged/public paths go through SECURITY DEFINER RPCs.
   Every method returns a typed Result and NEVER throws to the UI.
   The screens are unchanged — they depend on the DataAdapterV2
   interface, not on this implementation.
   ═══════════════════════════════════════════════════════════════ */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './client';
import {
  ok, err,
  type Result, type Page, type PageParams, type QueryOptions,
  type DataAdapterV2,
  type AuthRepository, type ActivationState, type AccountState,
  type PropertyRepository, type CustomerRepository, type DealRepository, type RecordSaleInput,
  type StartDealInput, type SetDealStageInput, type RecordDealPaymentInput,
  type SellerRepository, type SaveSellerInput, type AssignPropertySellerInput,

  type PropertyDocumentRepository, type UploadPropertyDocumentInput,
  type DemandRepository, type DemandRecord, type DemandDraft, type DemandMatch,
  type MapRepository, type PresentationRepository, type PresentationState, type PresentationProperty,
  type PresentationEventsRepository, type PresentationEvent,
  type PredictiveRepository,
  type ClientLinkRepository, type ClientLinkState, type ClientSafePayload, type ClientSafeMap,
  type ClientLinkSummary, type ClientLinkWorkspace, type ClientLinkEventKind,
  type MediaRepository, type MediaState,
  type DemandSignalsRepository,
} from '../contracts';
import type { DealerPredictionSummary, PredictiveActionEvent } from '../../performance';
import { buildEventMetadata } from '../telemetry';
import { publishResourceInvalidation } from '../../performance';
import {
  toBuyerSafeIntelligence,
  type LocationVisibility,
  type PropertyIntelligenceViewModel,
} from '../../property-intelligence';
import type {
  Property,
  PropertyLocationInput,
  Client,
  Deal,
  ClientLink,
  MapData,
  DemandSignal,
  Seller,
  PropertySeller,
  SellerWithProperties,
  SellerDirectoryEntry,
  SellerWorkspace,
  PropertyLifecycle,
  PropertyDocument,
  PropertyDocumentType,
  PropertyDocumentVisibility,
  PropertyDocumentSafety,
  PipelineDeal,
  DealPayment,
  DealPaymentKind,
  DealWorkspace,
} from '../types';
import {
  PROPERTY_PHOTO_BUCKET,
  isPersistentExternalPhoto,
  normalizePropertyPhotoStorage,
  persistentPropertyPayload,
  propertyPhotoObjectPath,
  validatePropertyPhoto,
} from '../property-photos';
import { resolveMapAssetUrl } from '../map-assets';
import { normalizeCompletedDeal, normalizePipelineDeal, readDealStage } from '../deal-normalization';
import {
  normalizePropertyLocationOnRead,
  propertyLocationValidationError,
} from '../property-location';
import { SupabaseAiRepository } from './ai-repository';
import { canonicalPropertyLifecycle, propertyLifecycle, propertyLifecycleValidationError } from '../property-lifecycle';
import {
  PROPERTY_DOCUMENT_BUCKET,
  propertyDocumentObjectPath,
  validatePropertyDocument,
} from '../property-documents';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function aborted<T>(opts?: QueryOptions): Result<T> | null {
  return opts?.signal?.aborted ? err('aborted', 'Request cancelled') : null;
}

function cryptoId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.round(Math.random() * 1e9)}`;
}

/** Which build the dealer is actually running. Injected by vite.config.ts from
 *  VERCEL_GIT_COMMIT_SHA, 'dev' locally. Stamped on every product event so a
 *  mid-trial deploy stays interpretable instead of silently changing the
 *  treatment. Not a secret. */
const BUILD_VERSION: string = import.meta.env.VITE_BUILD_VERSION ?? 'dev';

/** Translate any thrown/PostgREST error into a typed RepoError. */
function toErr(e: unknown): Result<never> {
  const msg = (e as { message?: string })?.message ?? String(e);
  const code = (e as { code?: string })?.code;
  if (code === 'PGRST301' || /jwt|auth/i.test(msg)) return err('unauthorized', 'Not signed in', { detail: msg });
  if (/permission denied|rls|row-level/i.test(msg)) return err('forbidden', 'Not allowed', { detail: msg });
  if (/fetch|network|failed to/i.test(msg)) return err('network', 'Network error', { retryable: true, detail: msg });
  return err('unknown', msg, { detail: code });
}

async function client(): Promise<SupabaseClient> {
  const c = await getSupabase();
  if (!c) throw new Error('Supabase not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  return c;
}

async function currentDealerId(c: SupabaseClient): Promise<Result<string>> {
  const { data: auth, error: authError } = await c.auth.getUser();
  if (authError || !auth.user) return err('unauthorized', 'Not signed in');
  let dealerId = String(auth.user.app_metadata?.plotmap_dealer_id ?? auth.user.app_metadata?.dealer_id ?? '').trim();
  if (!dealerId) {
    const { data: profile, error: profileError } = await c.from('profiles')
      .select('dealer_id').eq('id', auth.user.id).maybeSingle();
    if (profileError) return toErr(profileError);
    dealerId = String((profile as { dealer_id?: string } | null)?.dealer_id ?? '').trim();
  }
  return dealerId ? ok(dealerId) : err('forbidden', 'Dealer membership is unavailable');
}

/* ── generic crm_records read helpers ─────────────────────────── */

interface CrmRow { id: string; payload: Record<string, unknown>; updated_at: string; }

function mapEntity<T>(row: CrmRow): T {
  // crm_records stores the whole entity in payload; id is authoritative.
  return { ...(row.payload as object), id: row.id } as T;
}

async function crmList<T>(
  entity: string, params: PageParams | undefined, opts: QueryOptions | undefined,
  matches: (row: CrmRow, q: string) => boolean,
): Promise<Result<Page<T>>> {
  const a = aborted<Page<T>>(opts); if (a) return a;
  try {
    const c = await client();
    const limit = Math.min(params?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = params?.cursor ? parseInt(params.cursor, 10) || 0 : 0;
    let query = c.from('crm_records')
      .select('id,payload,updated_at', { count: 'estimated' })
      .eq('entity_type', entity)
      .eq('deleted', false)
      .order('updated_at', { ascending: false });
    // fetch one extra to know if there's a next page
    query = query.range(offset, offset + limit);
    const { data, error, count } = await query;
    if (error) return toErr(error);
    let rows = (data ?? []) as CrmRow[];
    const q = (params?.query ?? '').trim().toLowerCase();
    if (q) rows = rows.filter((r) => matches(r, q));
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    return ok({
      items: pageRows.map((r) => mapEntity<T>(r)),
      nextCursor: hasMore ? String(offset + limit) : null,
      total: count ?? undefined,
    });
  } catch (e) { return toErr(e); }
}

async function crmGet<T>(entity: string, id: string, opts?: QueryOptions): Promise<Result<T>> {
  const a = aborted<T>(opts); if (a) return a;
  try {
    const c = await client();
    const { data, error } = await c.from('crm_records')
      .select('id,payload,updated_at')
      .eq('entity_type', entity).eq('id', id).eq('deleted', false).maybeSingle();
    if (error) return toErr(error);
    if (!data) return err('not_found', `${entity} not found`);
    return ok(mapEntity<T>(data as CrmRow));
  } catch (e) { return toErr(e); }
}

async function crmUpsert<T extends { id?: string }>(
  entity: string, id: string, payload: object, opts?: QueryOptions,
): Promise<Result<T>> {
  const a = aborted<T>(opts); if (a) return a;
  try {
    const c = await client();
    const { data, error } = await c.from('crm_records')
      .upsert({ id, entity_type: entity, payload, deleted: false, updated_at: new Date().toISOString() })
      .select('id,payload,updated_at').single();
    if (error) return toErr(error);
    if (entity === 'properties') publishResourceInvalidation({ entity: 'property', id });
    if (entity === 'clients') publishResourceInvalidation({ entity: 'client', id });
    return ok(mapEntity<T>(data as CrmRow));
  } catch (e) { return toErr(e); }
}

/* ── CRM repositories ─────────────────────────────────────────── */

class SupaProperties implements PropertyRepository {
  private async hydratedMany(properties: readonly Property[], o?: QueryOptions): Promise<Property[]> {
    const normalized = properties.map((property) => ({
      property,
      refs: normalizePropertyPhotoStorage(property.photoStorage, property.id),
    }));
    const paths = [...new Set(normalized.flatMap((item) => item.refs.map((ref) => ref.path)))];
    const signed = new Map<string, string>();
    if (paths.length && !o?.signal?.aborted) {
      try {
        const c = await client();
        const { data } = await c.storage.from(PROPERTY_PHOTO_BUCKET).createSignedUrls(paths, 900);
        for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
      } catch { /* keep property data usable with a clean no-photo state */ }
    }
    return normalized.map(({ property, refs }) => ({
      ...canonicalPropertyLifecycle(normalizePropertyLocationOnRead(property)),
      photos: [
        ...(property.photos ?? []).filter(isPersistentExternalPhoto),
        ...refs.flatMap((ref) => signed.get(ref.path) ?? []),
      ],
      photoStorage: refs,
    }));
  }

  async list(p?: PageParams, o?: QueryOptions): Promise<Result<Page<Property>>> {
    const result = await crmList<Property>('properties', p, o, (r, q) =>
      `${r.payload.area} ${r.payload.loc} ${r.payload.type}`.toLowerCase().includes(q));
    if (!result.ok) return result;
    return ok({ ...result.value, items: await this.hydratedMany(result.value.items, o) });
  }
  async get(id: string, o?: QueryOptions): Promise<Result<Property>> {
    const result = await crmGet<Property>('properties', id, o);
    return result.ok ? ok((await this.hydratedMany([result.value], o))[0]!) : result;
  }
  async save(property: Property, o?: QueryOptions): Promise<Result<Property>> {
    const locationError = propertyLocationValidationError(property.location);
    if (locationError) return err('validation', locationError);
    const lifecycleError = propertyLifecycleValidationError(property);
    if (lifecycleError) return err('validation', lifecycleError);
    const id = property.id || `prop-${Date.now()}`;
    const canonical = persistentPropertyPayload({ ...property, id });
    const result = await crmUpsert<Property>('properties', id, canonical, o);
    return result.ok ? ok((await this.hydratedMany([result.value], o))[0]!) : result;
  }
  async remove(id: string, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.from('crm_records')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('entity_type', 'properties')
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) return toErr(error);
      if (!data) return err('not_found', 'Property not found');
      publishResourceInvalidation({ entity: 'property', id });
      return ok(undefined);
    } catch (error) { return toErr(error); }
  }
  async setLocation(
    id: string,
    location: PropertyLocationInput | null,
    o?: QueryOptions,
  ): Promise<Result<Property>> {
    const a = aborted<Property>(o); if (a) return a;
    if (location) {
      const locationError = propertyLocationValidationError(location);
      if (locationError) return err('validation', locationError);
    }
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_set_property_location', {
        p_property_id: id,
        p_latitude: location?.latitude ?? null,
        p_longitude: location?.longitude ?? null,
        p_source: location?.source ?? 'dealer-selected',
      });
      if (error) return toErr(error);
      const row = (Array.isArray(data) ? data[0] : data) as CrmRow | null;
      if (!row) return err('not_found', 'Property not found');
      publishResourceInvalidation({ entity: 'property', id });
      return ok((await this.hydratedMany([mapEntity<Property>(row)], o))[0]!);
    } catch (error) { return toErr(error); }
  }
}

class SupaCustomers implements CustomerRepository {
  list(p?: PageParams, o?: QueryOptions) {
    return crmList<Client>('clients', p, o, (r, q) =>
      `${r.payload.name} ${r.payload.city}`.toLowerCase().includes(q));
  }
  get(id: string, o?: QueryOptions) { return crmGet<Client>('clients', id, o); }
  save(client: Client, o?: QueryOptions) {
    const id = client.id || `client-${Date.now()}`;
    return crmUpsert<Client>('clients', id, { ...client, id }, o);
  }
}

interface SellerRow {
  id: string; name: string; primary_phone: string; alternate_phone: string | null;
  seller_type: Seller['type']; business?: string | null; city: string | null; note: string | null;
  archived?: boolean | null;
  created_at: string; updated_at: string;
}
interface PropertySellerRow {
  id: string; property_id: string; seller_id: string; asking_price: number | string | null;
  relationship: PropertySeller['relationship']; availability: PropertySeller['availability'];
  last_confirmed_at: string | null; site_visit_instructions: string | null;
  note: string | null; document_status: string | null; document_kinds?: unknown; is_primary: boolean;
}
interface PropertyDocumentRow {
  id: string; property_id: string; title: string; document_type: PropertyDocument['type'];
  storage_bucket: 'property-documents'; storage_path: string; mime_type: string; size_bytes: number;
  visibility: PropertyDocument['visibility']; safety: PropertyDocument['safety'];
  metadata: Record<string, string> | null; created_at: string; updated_at: string;
}

const mapSeller = (row: SellerRow): Seller => ({
  id: row.id, name: row.name, primaryPhone: row.primary_phone,
  alternatePhone: row.alternate_phone ?? undefined, type: row.seller_type,
  business: row.business ?? undefined,
  city: row.city ?? undefined, note: row.note ?? undefined,
  archived: row.archived === true,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
const readDocumentKinds = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const kinds = value.filter((v): v is string => typeof v === 'string' && !!v.trim());
  return kinds.length ? kinds : undefined;
};
const mapPropertySeller = (row: PropertySellerRow): PropertySeller => ({
  id: row.id, propertyId: row.property_id, sellerId: row.seller_id,
  askingPrice: row.asking_price == null ? undefined : Number(row.asking_price), relationship: row.relationship,
  availability: row.availability, lastConfirmedAt: row.last_confirmed_at ?? undefined,
  siteVisitInstructions: row.site_visit_instructions ?? undefined, note: row.note ?? undefined,
  documentStatus: row.document_status ?? undefined,
  ...(readDocumentKinds(row.document_kinds) ? { documentKinds: readDocumentKinds(row.document_kinds)! } : {}),
  isPrimary: row.is_primary,
});
const mapPropertyDocument = (row: PropertyDocumentRow): PropertyDocument => ({
  id: row.id, propertyId: row.property_id, title: row.title, type: row.document_type,
  storage: { bucket: row.storage_bucket, path: row.storage_path }, mimeType: row.mime_type,
  sizeBytes: row.size_bytes, visibility: row.visibility, safety: row.safety,
  metadata: row.metadata ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
});

class SupaSellers implements SellerRepository {
  async list(p?: PageParams, o?: QueryOptions): Promise<Result<Page<Seller>>> {
    const a = aborted<Page<Seller>>(o); if (a) return a;
    try {
      const c = await client();
      const limit = Math.min(p?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const offset = p?.cursor ? parseInt(p.cursor, 10) || 0 : 0;
      let query = c.from('desk_sellers').select('*', { count: 'estimated' }).order('updated_at', { ascending: false });
      const search = p?.query?.trim().replace(/[,()%]/g, ' ');
      if (search) query = query.or(`name.ilike.%${search}%,primary_phone.ilike.%${search}%,city.ilike.%${search}%`);
      const { data, error, count } = await query.range(offset, offset + limit);
      if (error) return toErr(error);
      const rows = (data ?? []) as SellerRow[];
      return ok({ items: rows.slice(0, limit).map(mapSeller), nextCursor: rows.length > limit ? String(offset + limit) : null, total: count ?? undefined });
    } catch (error) { return toErr(error); }
  }
  async get(id: string, o?: QueryOptions): Promise<Result<Seller>> {
    const a = aborted<Seller>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.from('desk_sellers').select('*').eq('id', id).maybeSingle();
      if (error) return toErr(error);
      return data ? ok(mapSeller(data as SellerRow)) : err('not_found', 'Seller not found');
    } catch (error) { return toErr(error); }
  }
  async getForProperty(propertyId: string, o?: QueryOptions) {
    const a = aborted<readonly { seller: Seller; relationship: PropertySeller }[]>(o); if (a) return a;
    try {
      const c = await client();
      // One join instead of a seller query per relation.
      const { data, error } = await c.from('desk_property_sellers')
        .select('*,seller:desk_sellers!inner(*)')
        .eq('property_id', propertyId).order('is_primary', { ascending: false });
      if (error) return toErr(error);
      const rows = (data ?? []) as (PropertySellerRow & { seller: SellerRow | null })[];
      return ok(rows.flatMap((row) => row.seller
        ? [{ seller: mapSeller(row.seller), relationship: mapPropertySeller(row) }]
        : []));
    } catch (error) { return toErr(error); }
  }
  async getWithProperties(id: string, o?: QueryOptions): Promise<Result<SellerWithProperties>> {
    const workspace = await this.workspace(id, o);
    if (!workspace.ok) return workspace;
    return ok({
      seller: workspace.value.seller,
      properties: [...workspace.value.active, ...workspace.value.sold],
    });
  }

  async directory(includeArchived = false, o?: QueryOptions): Promise<Result<readonly SellerDirectoryEntry[]>> {
    const a = aborted<readonly SellerDirectoryEntry[]>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_seller_directory', {
        p_include_archived: includeArchived,
      });
      if (error) return toErr(error);
      const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
      return ok(rows.map((row) => ({
        seller: mapSeller({
          id: String(row.id), name: String(row.name), primary_phone: String(row.primary_phone),
          alternate_phone: (row.alternate_phone ?? null) as string | null,
          seller_type: row.seller_type as Seller['type'],
          business: (row.business ?? null) as string | null,
          city: (row.city ?? null) as string | null,
          note: (row.note ?? null) as string | null,
          archived: row.archived === true,
          created_at: String(row.created_at ?? ''), updated_at: String(row.updated_at ?? ''),
        }),
        liveCount: Number(row.live_count ?? 0),
        soldCount: Number(row.sold_count ?? 0),
        ...(row.last_confirmed_at ? { lastConfirmedAt: String(row.last_confirmed_at) } : {}),
        anyUnconfirmed: row.any_unconfirmed === true,
        properties: (Array.isArray(row.properties) ? row.properties : [])
          .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
          .map((p) => ({
            propertyId: String(p.propertyId ?? ''),
            lifecycle: String(p.lifecycle ?? 'draft') as PropertyLifecycle,
            ...(p.loc ? { loc: String(p.loc) } : {}),
            ...(p.price != null ? { price: Number(p.price) } : {}),
            ...(p.askingPrice != null ? { askingPrice: Number(p.askingPrice) } : {}),
            availability: String(p.availability ?? 'unconfirmed') as PropertySeller['availability'],
            ...(p.lastConfirmedAt ? { lastConfirmedAt: String(p.lastConfirmedAt) } : {}),
            isPrimary: p.isPrimary === true,
          })),
      })));
    } catch (error) { return toErr(error); }
  }

  async workspace(sellerId: string, o?: QueryOptions): Promise<Result<SellerWorkspace>> {
    const a = aborted<SellerWorkspace>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_seller_workspace', { p_seller_id: sellerId });
      if (error) return toErr(error);
      const env = (data ?? {}) as Record<string, unknown>;
      if (env.ok !== true) return err('not_found', 'Seller not found');

      const pairs = (Array.isArray(env.properties) ? env.properties : [])
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
        .flatMap((entry) => {
          const wrapper = entry.property as { id?: unknown; payload?: unknown } | undefined;
          const payload = wrapper?.payload;
          if (!payload || typeof payload !== 'object') return [];
          const property = normalizePropertyLocationOnRead(canonicalPropertyLifecycle({
            ...(payload as Property), id: String(wrapper?.id ?? (payload as Property).id ?? ''),
          }));
          return [{
            property,
            relationship: mapPropertySeller(entry.relationship as PropertySellerRow),
          }];
        });

      return ok({
        seller: mapSeller(env.seller as SellerRow),
        active: pairs.filter((p) => propertyLifecycle(p.property) !== 'sold'),
        sold: pairs.filter((p) => propertyLifecycle(p.property) === 'sold'),
      });
    } catch (error) { return toErr(error); }
  }

  async setArchived(sellerId: string, archived: boolean, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_set_seller_archived', {
        p_payload: { sellerId, archived },
      });
      if (error) return toErr(error);
      const env = (data ?? {}) as { ok?: boolean; reason?: string };
      if (env.ok === true) return ok(undefined);
      return env.reason === 'not_found'
        ? err('not_found', 'Seller not found')
        : err('validation', env.reason ?? 'Could not archive this seller');
    } catch (error) { return toErr(error); }
  }
  async save(input: SaveSellerInput, o?: QueryOptions): Promise<Result<Seller>> {
    const a = aborted<Seller>(o); if (a) return a;
    if (!input.name.trim() || !input.primaryPhone.trim()) return err('validation', 'Seller name and primary phone are required');
    try {
      const c = await client();
      const dealer = await currentDealerId(c); if (!dealer.ok) return dealer;
      const id = input.id || `seller-${cryptoId()}`;
      const { data, error } = await c.from('desk_sellers').upsert({
        id, dealer_id: dealer.value, name: input.name.trim(), primary_phone: input.primaryPhone.trim(),
        alternate_phone: input.alternatePhone?.trim() || null, seller_type: input.type,
        business: input.business?.trim() || null,
        city: input.city?.trim() || null, note: input.note?.trim() || null,
      }).select('*').single();
      return error ? toErr(error) : ok(mapSeller(data as SellerRow));
    } catch (error) { return toErr(error); }
  }
  async assignToProperty(input: AssignPropertySellerInput, o?: QueryOptions): Promise<Result<PropertySeller>> {
    const a = aborted<PropertySeller>(o); if (a) return a;
    if (input.askingPrice !== undefined && input.askingPrice <= 0) return err('validation', 'Asking price must be positive');
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_assign_property_seller', { p_payload: input });
      if (error) return toErr(error);
      const envelope = data as { ok?: boolean; reason?: string; relationship?: PropertySellerRow };
      return envelope.ok && envelope.relationship ? ok(mapPropertySeller(envelope.relationship))
        : err(envelope.reason === 'not_found' ? 'not_found' : 'validation', envelope.reason ?? 'Could not assign seller');
    } catch (error) { return toErr(error); }
  }
  async removeFromProperty(propertyId: string, sellerId: string, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      const { error, count } = await c.from('desk_property_sellers').delete({ count: 'exact' })
        .eq('property_id', propertyId).eq('seller_id', sellerId);
      if (error) return toErr(error);
      return count ? ok(undefined) : err('not_found', 'Seller relationship not found');
    } catch (error) { return toErr(error); }
  }
}

class SupaPropertyDocuments implements PropertyDocumentRepository {
  async listForProperty(propertyId: string, o?: QueryOptions) {
    const a = aborted<readonly PropertyDocument[]>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.from('desk_property_documents').select('*')
        .eq('property_id', propertyId).order('created_at', { ascending: false });
      return error ? toErr(error) : ok(((data ?? []) as PropertyDocumentRow[]).map(mapPropertyDocument));
    } catch (error) { return toErr(error); }
  }
  async get(id: string, o?: QueryOptions): Promise<Result<PropertyDocument>> {
    const a = aborted<PropertyDocument>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.from('desk_property_documents').select('*').eq('id', id).maybeSingle();
      if (error) return toErr(error);
      return data ? ok(mapPropertyDocument(data as PropertyDocumentRow)) : err('not_found', 'Property document not found');
    } catch (error) { return toErr(error); }
  }
  async upload(input: UploadPropertyDocumentInput, file: File, o?: QueryOptions): Promise<Result<PropertyDocument>> {
    const a = aborted<PropertyDocument>(o); if (a) return a;
    if (!input.title.trim()) return err('validation', 'Document title is required');
    const validation = validatePropertyDocument(file); if (validation) return err('validation', validation);
    try {
      const c = await client();
      const dealer = await currentDealerId(c); if (!dealer.ok) return dealer;
      const id = `property-document-${cryptoId()}`;
      const path = propertyDocumentObjectPath(dealer.value, input.propertyId, id, file.type);
      const uploaded = await c.storage.from(PROPERTY_DOCUMENT_BUCKET).upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      });
      if (uploaded.error) return toErr(uploaded.error);
      const { data, error } = await c.from('desk_property_documents').insert({
        id, dealer_id: dealer.value, property_id: input.propertyId, title: input.title.trim(),
        document_type: input.type, storage_bucket: PROPERTY_DOCUMENT_BUCKET, storage_path: path,
        mime_type: file.type, size_bytes: file.size, visibility: input.visibility ?? 'private',
        safety: input.safety ?? 'private', metadata: input.metadata ?? {},
      }).select('*').single();
      if (error) {
        await c.storage.from(PROPERTY_DOCUMENT_BUCKET).remove([path]);
        return toErr(error);
      }
      return ok(mapPropertyDocument(data as PropertyDocumentRow));
    } catch (error) { return toErr(error); }
  }
  async remove(id: string, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    const existing = await this.get(id, o); if (!existing.ok) return existing;
    try {
      const c = await client();
      const { error } = await c.from('desk_property_documents').delete().eq('id', id);
      if (error) return toErr(error);
      await c.storage.from(PROPERTY_DOCUMENT_BUCKET).remove([existing.value.storage.path]);
      return ok(undefined);
    } catch (error) { return toErr(error); }
  }
}

type UnknownDeal = Record<string, unknown> & { id?: unknown };

class SupaDeals implements DealRepository {
  async list(p?: PageParams, o?: QueryOptions): Promise<Result<Page<Deal>>> {
    /*
     * Legacy crm_records can contain the retired opportunity pipeline under
     * entity_type=deals. Paginating those raw rows before normalization can
     * produce an empty completed-sales page even when older completed rows
     * exist. Read the dealer-scoped register, normalize first, then paginate
     * the completed-only result. RLS remains the authority for every chunk.
     */
    const raw: UnknownDeal[] = [];
    let rawCursor: string | undefined;
    do {
      const page = await crmList<UnknownDeal>('deals', { cursor: rawCursor, limit: MAX_LIMIT }, o, () => true);
      if (!page.ok) return page;
      raw.push(...page.value.items);
      rawCursor = page.value.nextCursor ?? undefined;
    } while (rawCursor);

    const query = (p?.query ?? '').trim().toLowerCase();
    const completedById = new Map<string, Deal>();
    for (const payload of raw) {
      const deal = normalizeCompletedDeal(String(payload.id ?? ''), payload);
      if (!deal) continue;
      if (query && !`${deal.prop} ${deal.buyer} ${deal.seller} ${deal.city} ${deal.sector}`.toLowerCase().includes(query)) continue;
      completedById.set(deal.id, deal);
    }
    const completed = [...completedById.values()];
    const limit = Math.min(p?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = p?.cursor ? parseInt(p.cursor, 10) || 0 : 0;
    const items = completed.slice(offset, offset + limit);
    return ok({
      items,
      nextCursor: offset + limit < completed.length ? String(offset + limit) : null,
      total: completed.length,
    });
  }
  async get(id: string, o?: QueryOptions): Promise<Result<Deal>> {
    const result = await crmGet<UnknownDeal>('deals', id, o);
    if (!result.ok) return result;
    const deal = normalizeCompletedDeal(id, result.value);
    return deal ? ok(deal) : err('not_found', 'Completed sale not found');
  }

  async record(input: RecordSaleInput, o?: QueryOptions): Promise<Result<Deal>> {
    const a = aborted<Deal>(o); if (a) return a;
    try {
      const c = await client();
      // Single atomic SECURITY DEFINER RPC: marks the property sold (removing it
      // from inventory / presentation / future client links), creates the deal,
      // and appends to the buyer's purchased history — all in one transaction.
      const { data, error } = await c.rpc('plotmap_record_completed_sale', {
        p_payload: {
          propertyId: input.propertyId,
          buyerId: input.buyerId ?? null,
          newBuyer: input.newBuyer ?? null,
          seller: input.seller ?? null,
          sellerPhone: input.sellerPhone ?? null,
          soldPrice: input.soldPrice,
          saleDate: input.saleDate,
          registrationDate: input.registrationDate ?? null,
          brokerage: input.brokerage ?? null,
          commission: input.commission ?? null,
          commissionReceived: input.commission === undefined ? null : (input.commissionReceived ?? false),
          paymentReceived: input.paymentReceived ?? null,
          documents: input.documents ?? [],
        },
      });
      if (error) return toErr(error);
      const env = (data ?? {}) as { ok?: boolean; reason?: string; deal?: Record<string, unknown> };
      if (env.ok !== true || !env.deal) {
        if (env.reason === 'already_sold') return err('conflict', 'That property is already marked sold');
        if (env.reason === 'not_found') return err('not_found', 'That property is no longer available');
        return err('validation', env.reason ?? 'Could not record the sale');
      }
      const deal = normalizeCompletedDeal(String(env.deal.id ?? ''), env.deal);
      if (!deal) return err('unknown', 'Completed sale response was invalid');
      publishResourceInvalidation({ entity: 'inventory', id: input.propertyId });
      return ok(deal);
    } catch (e) { return toErr(e); }
  }

  /* ── pipeline ── */

  async listPipeline(p?: PageParams, o?: QueryOptions): Promise<Result<Page<PipelineDeal>>> {
    const raw: UnknownDeal[] = [];
    let rawCursor: string | undefined;
    do {
      const page = await crmList<UnknownDeal>('deals', { cursor: rawCursor, limit: MAX_LIMIT }, o, () => true);
      if (!page.ok) return page;
      raw.push(...page.value.items);
      rawCursor = page.value.nextCursor ?? undefined;
    } while (rawCursor);

    const query = (p?.query ?? '').trim().toLowerCase();
    const byId = new Map<string, PipelineDeal>();
    for (const payload of raw) {
      const deal = normalizePipelineDeal(String(payload.id ?? ''), payload);
      if (!deal) continue;
      if (query && !`${deal.prop} ${deal.buyer} ${deal.seller ?? ''} ${deal.city} ${deal.sector}`.toLowerCase().includes(query)) continue;
      byId.set(deal.id, deal);
    }
    const all = [...byId.values()];
    const limit = Math.min(p?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = p?.cursor ? parseInt(p.cursor, 10) || 0 : 0;
    return ok({
      items: all.slice(offset, offset + limit),
      nextCursor: offset + limit < all.length ? String(offset + limit) : null,
      total: all.length,
    });
  }

  async start(input: StartDealInput, o?: QueryOptions): Promise<Result<PipelineDeal>> {
    const a = aborted<PipelineDeal>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_start_deal', {
        p_payload: {
          propertyId: input.propertyId,
          buyerId: input.buyerId ?? null,
          newBuyer: input.newBuyer ?? null,
          stage: input.stage ?? 'negotiating',
          value: input.value ?? null,
          commission: input.commission ?? null,
          nextAction: input.nextAction ?? null,
        },
      });
      if (error) return toErr(error);
      const env = (data ?? {}) as { ok?: boolean; reason?: string; deal?: Record<string, unknown> };
      if (env.ok !== true || !env.deal) {
        if (env.reason === 'not_found') return err('not_found', 'That property is no longer available');
        return err('validation', env.reason ?? 'Could not start the deal');
      }
      const deal = normalizePipelineDeal(String(env.deal.id ?? ''), env.deal);
      if (!deal) return err('unknown', 'Deal response was invalid');
      publishResourceInvalidation({ entity: 'inventory', id: input.propertyId });
      return ok(deal);
    } catch (e) { return toErr(e); }
  }

  async setStage(input: SetDealStageInput, o?: QueryOptions): Promise<Result<PipelineDeal>> {
    const a = aborted<PipelineDeal>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_set_deal_stage', {
        p_payload: {
          dealId: input.dealId,
          stage: input.stage,
          reason: input.reason ?? null,
          tokenDate: input.tokenDate ?? null,
          registryDate: input.registryDate ?? null,
          note: input.note ?? null,
        },
      });
      if (error) return toErr(error);
      const env = (data ?? {}) as { ok?: boolean; reason?: string; deal?: Record<string, unknown> };
      if (env.ok !== true || !env.deal) {
        if (env.reason === 'not_found') return err('not_found', 'That deal is no longer available');
        return err('validation', env.reason ?? 'Could not move the deal');
      }
      const deal = normalizePipelineDeal(String(env.deal.id ?? input.dealId), env.deal);
      if (!deal) return err('unknown', 'Deal response was invalid');
      return ok(deal);
    } catch (e) { return toErr(e); }
  }

  async recordPayment(input: RecordDealPaymentInput, o?: QueryOptions): Promise<Result<DealPayment>> {
    const a = aborted<DealPayment>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_record_deal_payment', {
        p_payload: {
          dealId: input.dealId,
          kind: input.kind,
          amount: input.amount,
          receivedOn: input.receivedOn ?? null,
          note: input.note ?? null,
        },
      });
      if (error) return toErr(error);
      const env = (data ?? {}) as { ok?: boolean; reason?: string; payment?: Record<string, unknown> };
      if (env.ok !== true || !env.payment) {
        if (env.reason === 'not_found') return err('not_found', 'That deal is no longer available');
        return err('validation', env.reason ?? 'Could not record the payment');
      }
      const row = env.payment as Record<string, unknown>;
      return ok({
        id: String(row.id ?? ''),
        kind: String(row.kind ?? 'token') as DealPaymentKind,
        amount: Number(row.amount ?? 0),
        receivedOn: String(row.received_on ?? row.receivedOn ?? ''),
        ...(row.note ? { note: String(row.note) } : {}),
      });
    } catch (e) { return toErr(e); }
  }

  async workspace(dealId: string, o?: QueryOptions): Promise<Result<DealWorkspace>> {
    const a = aborted<DealWorkspace>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_deal_workspace', { p_deal_id: dealId });
      if (error) return toErr(error);
      const env = (data ?? {}) as Record<string, unknown>;
      if (env.ok !== true) {
        return env.reason === 'not_found'
          ? err('not_found', 'That deal is no longer available')
          : err('unknown', 'Could not load the deal');
      }
      return readDealWorkspace(dealId, env);
    } catch (e) { return toErr(e); }
  }
}

/** Shape the deal-workspace RPC envelope into the contract type. */
function readDealWorkspace(dealId: string, env: Record<string, unknown>): Result<DealWorkspace> {
  const dealPayload = (env.deal ?? {}) as Record<string, unknown>;
  const deal = normalizePipelineDeal(String(dealPayload.id ?? dealId), dealPayload)
    ?? normalizeCompletedPipelineView(String(dealPayload.id ?? dealId), dealPayload);
  if (!deal) return err('unknown', 'Deal response was invalid');

  const wrapped = (value: unknown): Record<string, unknown> | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const outer = value as Record<string, unknown>;
    const payload = outer.payload;
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : outer;
  };
  const list = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

  const money = (env.money ?? {}) as Record<string, unknown>;
  const num = (key: string): number => Number(money[key] ?? 0) || 0;

  return ok({
    deal,
    property: wrapped(env.property) as unknown as DealWorkspace['property'],
    buyer: wrapped(env.buyer) as unknown as DealWorkspace['buyer'],
    seller: env.seller ? (env.seller as unknown as DealWorkspace['seller']) : undefined,
    stageHistory: list(env.stageHistory).map((e) => ({
      stage: readDealStage(e.stage),
      occurredAt: String(e.occurredAt ?? ''),
      ...(e.note ? { note: String(e.note) } : {}),
    })),
    payments: list(env.payments).map((p) => ({
      id: String(p.id ?? ''),
      kind: String(p.kind ?? 'token') as DealPaymentKind,
      amount: Number(p.amount ?? 0),
      receivedOn: String(p.receivedOn ?? ''),
      ...(p.note ? { note: String(p.note) } : {}),
    })),
    money: {
      value: num('value'), token: num('token'),
      expectedBuyer: num('expectedBuyer'), expectedSeller: num('expectedSeller'),
      expected: num('expected'),
      receivedBuyer: num('receivedBuyer'), receivedSeller: num('receivedSeller'),
      received: num('received'), due: num('due'),
      fullySettled: money.fullySettled === true,
    },
    dealPapers: list(env.dealPapers).map((d) => ({
      id: String(d.id ?? ''), title: String(d.title ?? ''), type: String(d.type ?? 'other'),
      bucket: String(d.bucket ?? 'deal-documents'), path: String(d.path ?? ''),
      mimeType: String(d.mimeType ?? ''), sizeBytes: Number(d.sizeBytes ?? 0),
      ...(d.createdAt ? { createdAt: String(d.createdAt) } : {}),
    })),
    propertyPapers: list(env.propertyPapers).map((d) => ({
      id: String(d.id ?? ''),
      propertyId: deal.propertyId,
      title: String(d.title ?? ''),
      type: String(d.type ?? 'other') as PropertyDocumentType,
      storage: { bucket: 'property-documents' as const, path: String(d.path ?? '') },
      mimeType: String(d.mimeType ?? ''),
      sizeBytes: Number(d.sizeBytes ?? 0),
      visibility: String(d.visibility ?? 'private') as PropertyDocumentVisibility,
      safety: String(d.safety ?? 'private') as PropertyDocumentSafety,
      ...(d.createdAt ? { createdAt: String(d.createdAt) } : {}),
    })),
  });
}

/**
 * A completed sale opened from the Deal room still needs a PipelineDeal-shaped
 * header. Its recordType is 'completed-sale', so the pipeline normalizer
 * declines it — read the same fields at stage 'closed' instead. No value the
 * dealer never recorded is invented.
 */
function normalizeCompletedPipelineView(id: string, payload: Record<string, unknown>): PipelineDeal | null {
  const propertyId = String(payload.propertyId ?? payload.propId ?? '');
  const buyerId = String(payload.buyerId ?? '');
  if (!id || !propertyId || !buyerId) return null;
  return normalizePipelineDeal(id, { ...payload, recordType: 'pipeline', stage: payload.stage ?? 'closed' });
}

class SupaDemand implements DemandRepository {
  list(p?: PageParams, o?: QueryOptions) {
    return crmList<DemandRecord>('demand', p, o, (r, q) =>
      `${r.payload.customerName} ${(r.payload.preferredLocations as string[] ?? []).join(' ')}`.toLowerCase().includes(q));
  }
  get(id: string, o?: QueryOptions) { return crmGet<DemandRecord>('demand', id, o); }

  async match(id: string, o?: QueryOptions): Promise<Result<DemandMatch[]>> {
    const rec = await this.get(id, o);
    if (!rec.ok) return rec;
    const props = await crmList<Property>('properties', { limit: MAX_LIMIT }, o, () => true);
    if (!props.ok) return props;
    const d = rec.value;
    const matches: DemandMatch[] = [];
    for (const p of props.value.items) {
      if (p.sold || !p.published) continue;
      const reasons: string[] = []; let score = 0;
      if (p.type === d.propertyType) { score += 0.4; reasons.push('Property type matches'); }
      if (d.preferredLocations.some((l) => p.city === l || p.loc?.includes(l))) { score += 0.35; reasons.push('In a preferred location'); }
      if (p.price >= d.budgetMin && p.price <= d.budgetMax) { score += 0.25; reasons.push('Within budget'); }
      else if (p.price <= d.budgetMax) { score += 0.1; reasons.push('Below max budget'); }
      if (score >= 0.5) matches.push({ property: p, score: Math.min(score, 1), reasons });
    }
    matches.sort((x, y) => y.score - x.score);
    return ok(matches);
  }

  async save(draft: DemandDraft, o?: QueryOptions): Promise<Result<DemandRecord>> {
    const id = draft.id ?? `demand-${Date.now()}`;
    let customerName = '';
    const cust = await crmGet<Client>('clients', draft.customerId, o);
    if (cust.ok) customerName = cust.value.name;
    const payload = { ...draft, id, customerName };
    return crmUpsert<DemandRecord>('demand', id, payload, o);
  }
}

class SupaDemandSignals implements DemandSignalsRepository {
  async get(o?: QueryOptions): Promise<Result<DemandSignal[]>> {
    const a = aborted<DemandSignal[]>(o); if (a) return a;
    try {
      const c = await client();
      // Real signal: presentation opens grouped by area (the only permitted metric).
      const { data, error } = await c.from('presentation_events')
        .select('area').not('area', 'is', null).limit(1000);
      if (error) return toErr(error);
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { area: string }[]) {
        counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
      }
      const palette = ['#ffc93c', '#5b32c4', '#12a150', '#e8763a', '#3d8fb8', '#c9b48a'];
      const signals = [...counts.entries()]
        .sort((x, y) => y[1] - x[1]).slice(0, 6)
        .map(([city, opens], i) => ({ city, opens, color: palette[i % palette.length]! }));
      return ok(signals);
    } catch (e) { return toErr(e); }
  }
}

/* ── maps / presentation / events ─────────────────────────────── */

function rowToMapMeta(
  m: Record<string, unknown>,
  resolveAsset: (value: string | undefined) => string | undefined = (value) => value,
): Omit<MapData, 'sets'> {
  const rawAssets = (m.assets as MapData['assets']) ?? {};
  const assets: MapData['assets'] = {
    ...(rawAssets.original ? { original: { ...rawAssets.original, path: resolveAsset(rawAssets.original.path) ?? rawAssets.original.path } } : {}),
    ...(rawAssets.threeD ? { threeD: { ...rawAssets.threeD, path: resolveAsset(rawAssets.threeD.path) ?? rawAssets.threeD.path } } : {}),
    ...(rawAssets.overlay ? { overlay: { ...rawAssets.overlay, path: resolveAsset(rawAssets.overlay.path) ?? rawAssets.overlay.path } } : {}),
  };
  const dims = (m.dims as { original?: { w: number; h: number }; threeD?: { w: number; h: number } }) ?? {};
  const payload = (m.payload as { calibration?: MapData['calibration'] }) ?? {};
  return {
    id: m.id, kind: m.kind, city: m.city ?? '', sector: m.sector ?? '',
    area: (m.area as string) ?? undefined,
    parentMapId: (m.parent_map_id as string) ?? undefined,
    label: m.label ?? m.area ?? '', raster: assets.original?.path ?? resolveAsset(m.raster as string | undefined) ?? '',
    assets,
    calibration: (m.calibration as MapData['calibration']) ?? payload.calibration,
    dims: {
      original: dims.original ?? { w: assets.original?.w ?? 0, h: assets.original?.h ?? 0 },
      ...(assets.threeD || dims.threeD ? { threeD: dims.threeD ?? { w: assets.threeD!.w ?? 0, h: assets.threeD!.h ?? 0 } } : {}),
    },
    published: m.published === true || m.status === 'published',
    hidden: m.hidden === true || m.client_visible === false,
    linkedProperties: [],
  } as unknown as Omit<MapData, 'sets'>;
}

class SupaMaps implements MapRepository {
  assetResolver(c: SupabaseClient) {
    return (value: string | undefined) => resolveMapAssetUrl(
      value,
      (path) => c.storage.from('maps').getPublicUrl(path).data.publicUrl,
    );
  }

  async listRegistry(p?: PageParams, o?: QueryOptions): Promise<Result<Page<Omit<MapData, 'sets'>>>> {
    const a = aborted<Page<Omit<MapData, 'sets'>>>(o); if (a) return a;
    try {
      const c = await client();
      // Authenticated presentation path: dealer's published + client-visible maps only.
      const { data, error } = await c.rpc('plotmap_published_maps');
      if (error) return toErr(error);
      const resolveAsset = this.assetResolver(c);
      const items = ((data ?? []) as Record<string, unknown>[]).map((row) => rowToMapMeta(row, resolveAsset));
      return ok({ items, nextCursor: null, total: items.length });
    } catch (e) { return toErr(e); }
  }

  async listPlacementCatalog(_p?: PageParams, o?: QueryOptions): Promise<Result<Page<Omit<MapData, 'sets'>>>> {
    const a = aborted<Page<Omit<MapData, 'sets'>>>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_dealer_maps');
      if (error) return toErr(error);
      const resolveAsset = this.assetResolver(c);
      const items = ((data ?? []) as Record<string, unknown>[])
        .filter((row) => row.deleted !== true && row.status !== 'archived')
        .map((row) => rowToMapMeta(row, resolveAsset));
      return ok({ items, nextCursor: null, total: items.length });
    } catch (e) { return toErr(e); }
  }

  async get(id: string, o?: QueryOptions): Promise<Result<MapData>> {
    const a = aborted<MapData>(o); if (a) return a;
    try {
      const c = await client();
      // Full dealer catalog (all states) so Map Studio + detail can open any map.
      const { data, error } = await c.rpc('plotmap_dealer_maps');
      if (error) return toErr(error);
      const m = ((data ?? []) as Record<string, unknown>[]).find((x) => x.id === id);
      if (!m) return err('not_found', 'Map not found');
      const ov = await c.rpc('plotmap_published_overlays', { p_map_id: id });
      const sets = ((ov.data ?? []) as Record<string, unknown>[]).map((s) => {
        const p = (s.payload as { itemIds?: unknown[]; marks?: unknown[]; accent?: string; labels?: Record<string, string> }) ?? {};
        return { id: s.id, name: s.name ?? '', marks: p.itemIds ?? p.marks ?? [], accent: p.accent, labels: p.labels ?? {} };
      });
      return ok({ ...rowToMapMeta(m, this.assetResolver(c)), sets } as unknown as MapData);
    } catch (e) { return toErr(e); }
  }
}

class SupaPresentation implements PresentationRepository {
  private normalizedProperties(rows: readonly PresentationProperty[]): PresentationProperty[] {
    return rows.map((row) => ({
      id: String(row.id ?? ''),
      type: row.type,
      city: String(row.city ?? ''),
      area: String(row.area ?? ''),
      loc: String(row.loc ?? ''),
      sector: String(row.sector ?? ''),
      size: String(row.size ?? ''),
      facing: row.facing,
      position: String(row.position ?? ''),
      approvals: Array.isArray(row.approvals) ? row.approvals.map(String) : [],
      landmarks: Array.isArray(row.landmarks) ? row.landmarks.map((landmark) => ({
        name: String(landmark?.name ?? ''),
        distance: String(landmark?.distance ?? ''),
        icon: String(landmark?.icon ?? ''),
      })) : [],
      // Broker output is runtime-only: it may contain short-lived signed HTTPS
      // URLs. Persistence filtering belongs at the write boundary, not here.
      photos: Array.isArray(row.photos) ? row.photos.map(String).filter((url) => {
        try { return new URL(url).protocol === 'https:'; } catch { return false; }
      }) : [],
      ...(row.masterplanId ? { masterplanId: String(row.masterplanId) } : {}),
      ...(row.sectorMapId ? { sectorMapId: String(row.sectorMapId) } : {}),
      ...(row.mapPlacement ? { mapPlacement: {
        mapId: String(row.mapPlacement.mapId),
        x: Number(row.mapPlacement.x),
        y: Number(row.mapPlacement.y),
      } } : {}),
      hasEarthLocation: row.hasEarthLocation === true,
    }));
  }

  private async readProperties(
    input: { limit: number; offset: number; propertyId: string | null },
    o?: QueryOptions,
  ): Promise<Result<{ items: PresentationProperty[]; total: number; nextOffset: number | null }>> {
    const a = aborted<{ items: PresentationProperty[]; total: number; nextOffset: number | null }>(o); if (a) return a;
    try {
      const c = await client();
      const fn = await c.functions.invoke('presentation-properties', { body: input });
      if (fn.error || !fn.data || typeof fn.data !== 'object') return fn.error ? toErr(fn.error) : err('unavailable', 'Presentation properties unavailable');
      const envelope = fn.data as { ok?: boolean; items?: PresentationProperty[]; total?: number; nextOffset?: number | null };
      if (envelope.ok !== true) return err('unavailable', 'Presentation properties unavailable');
      return ok({
        items: this.normalizedProperties(envelope.items ?? []),
        total: Number(envelope.total) || 0,
        nextOffset: envelope.nextOffset === null || Number.isInteger(envelope.nextOffset) ? envelope.nextOffset ?? null : null,
      });
    } catch (e) { return toErr(e); }
  }

  async getState(o?: QueryOptions): Promise<Result<PresentationState>> {
    const maps = await this.listMaps(o);
    if (!maps.ok) return err('network', 'Presentation failed to load', { retryable: true });
    if (maps.value.length === 0) return ok({ kind: 'no-map' });
    return ok({ kind: 'ready', maps: maps.value });
  }

  async listMaps(o?: QueryOptions): Promise<Result<readonly Omit<MapData, 'sets'>[]>> {
    const a = aborted<readonly Omit<MapData, 'sets'>[]>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_presentation_maps', { p_map_id: null });
      if (error) return toErr(error);
      const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
      return ok(rows.map((row) => rowToMapMeta(row, new SupaMaps().assetResolver(c))));
    } catch (e) { return toErr(e); }
  }

  async getMap(id: string, o?: QueryOptions): Promise<Result<MapData>> {
    const a = aborted<MapData>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_presentation_map', { p_map_id: id });
      if (error) return toErr(error);
      const envelope = data && typeof data === 'object' ? data as {
        ok?: boolean;
        map?: Record<string, unknown>;
        sets?: Record<string, unknown>[];
      } : {};
      if (envelope.ok !== true || !envelope.map) return err('not_found', 'Presentation map not found');
      const sets = (envelope.sets ?? []).map((set) => {
        const payload = (set.payload as { itemIds?: unknown[]; marks?: unknown[]; accent?: string; labels?: Record<string, string> }) ?? {};
        return { id: set.id, name: set.name ?? '', marks: payload.itemIds ?? payload.marks ?? [], accent: payload.accent, labels: payload.labels ?? {} };
      });
      return ok({ ...rowToMapMeta(envelope.map, new SupaMaps().assetResolver(c)), sets } as unknown as MapData);
    } catch (e) { return toErr(e); }
  }

  async listProperties(p?: PageParams, o?: QueryOptions): Promise<Result<Page<PresentationProperty>>> {
    const limit = Math.min(p?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = p?.cursor ? parseInt(p.cursor, 10) || 0 : 0;
    const result = await this.readProperties({ limit, offset, propertyId: null }, o);
    return result.ok ? ok({
      items: result.value.items,
      nextCursor: result.value.nextOffset === null ? null : String(result.value.nextOffset),
      total: result.value.total,
    }) : result;
  }

  async getProperty(id: string, o?: QueryOptions): Promise<Result<PresentationProperty>> {
    const result = await this.readProperties({ limit: 1, offset: 0, propertyId: id }, o);
    if (!result.ok) return result;
    return result.value.items[0] ? ok(result.value.items[0]) : err('not_found', 'Presentation property not found');
  }
}

/** Stable for the life of the tab. plotmap_record_presentation_event caps
 *  p_session_id at 128 characters and rejects anything longer. */
const deskSessionId = `${cryptoId()}${cryptoId()}`;

/** Resolved once per tab, then reused. Without this every product event would
 *  cost an auth round-trip plus a profiles read on the critical path. A failed
 *  lookup is deliberately not cached, so an event fired after the dealer signs
 *  in can still succeed. */
let deskDealerId: Promise<Result<string>> | null = null;
function cachedDealerId(c: SupabaseClient): Promise<Result<string>> {
  if (!deskDealerId) {
    deskDealerId = currentDealerId(c).then((r) => { if (!r.ok) deskDealerId = null; return r; });
  }
  return deskDealerId;
}

/** Test seam only: forget the cached dealer between cases. */
export function resetTelemetryIdentityCache(): void {
  deskDealerId = null;
}

class SupaPresentationEvents implements PresentationEventsRepository {
  async record(ev: PresentationEvent, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      // The RPC checks the caller's profile against p_dealer_id, so it must be
      // the real dealer. The previous emitter sent an empty string, which never
      // matches a profile, so every event it ever fired was rejected.
      const dealer = await cachedDealerId(c);
      if (!dealer.ok) return ok(undefined);

      const metadata = buildEventMetadata(ev.metadata, {
        build: BUILD_VERSION,
        ...(ev.outcome ? { outcome: ev.outcome } : {}),
        ...(typeof ev.durationMs === 'number' ? { durationMs: ev.durationMs } : {}),
      });

      // Best-effort, fire-and-forget: never block the UI on analytics.
      const { error } = await c.rpc('plotmap_record_presentation_event', {
        p_dealer_id: dealer.value,
        p_session_id: deskSessionId,
        p_event_type: ev.kind,
        p_map_id: ev.mapId ?? null,
        p_property_id: ev.propertyId ?? null,
        p_client_id: ev.clientId ?? null,
        p_metadata: metadata,
        p_created_at: ev.at,
      });
      // Swallowing this in production is deliberate. Swallowing it in
      // development is how the previous pipeline stayed dead for months.
      if (error && import.meta.env.DEV) {
        console.warn('[presentation-events] dropped', ev.kind, error.message);
      }
      return ok(undefined);
    } catch { return ok(undefined); }
  }
}

class SupaPredictive implements PredictiveRepository {
  async record(ev: PredictiveActionEvent, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      const { error } = await c.rpc('plotmap_record_predictive_event', {
        p_event_type: ev.eventType,
        p_session_id: ev.sessionId,
        p_from_type: ev.fromType ?? null,
        p_from_id: ev.fromId ?? null,
        p_to_type: ev.toType ?? null,
        p_to_id: ev.toId ?? null,
        p_resource_type: ev.resourceType ?? null,
        p_resource_id: ev.resourceId ?? null,
        p_created_at: ev.at,
      });
      if (error) return toErr(error);
      return ok(undefined);
    } catch (e) { return toErr(e); }
  }

  async summaries(o?: QueryOptions): Promise<Result<readonly DealerPredictionSummary[]>> {
    const a = aborted<readonly DealerPredictionSummary[]>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_predictive_summaries', { p_limit: 100 });
      if (error) return toErr(error);
      return ok(((data ?? []) as Record<string, unknown>[]).map((row) => ({
        fromType: String(row.from_type ?? ''), fromId: String(row.from_id ?? ''),
        toType: String(row.to_type ?? ''), toId: String(row.to_id ?? ''),
        count: Number(row.transition_count ?? 0), recentScore: Number(row.recent_score ?? 0),
        lastUsedAt: String(row.last_used_at ?? new Date(0).toISOString()),
      })));
    } catch (e) { return toErr(e); }
  }
}

/* ── client links (dealer list + buyer resolve via RPC) ───────── */

// The list RPC returns {id,label,status,propertyCount,tokenHint,expiresAt,
// createdAt,openedAt,lastOpenedAt,hasAudio,events:{opens,audioPlays,calls,
// whatsapp,visits}} — map it to the ClientLink shape the dealer pages expect
// so rendering never crashes on missing fields (e.g. clientName).
function rowToClientLink(r: Record<string, unknown>): ClientLink {
  const now = Date.now();
  const ev = (r.events as Record<string, number>) ?? {};
  const exp = r.expiresAt ? Math.max(0, Math.ceil((Date.parse(String(r.expiresAt)) - now) / 86400000)) : null;
  const last = r.lastOpenedAt ? new Date(String(r.lastOpenedAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'not yet';
  return {
    id: String(r.id), clientId: String(r.clientId ?? ''), clientName: String(r.clientName ?? r.label ?? 'Client'),
    props: Array.isArray(r.propertyIds) ? r.propertyIds.map(String) : [],
    propNames: Array.isArray(r.propertyNames) ? r.propertyNames.map(String) : [],
    propertyCount: Number(r.propertyCount ?? 0),
    expiry: exp === null ? '—' : `${exp}d`,
    createdAt: r.createdAt ? new Date(String(r.createdAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
    loc: (r.locationVisibility as ClientLink['loc']) ?? 'area',
    price: (r.priceVisibility as ClientLink['price']) ?? 'hidden',
    audio: r.hasAudio ? 'done' : 'none', audioSecs: Number(r.audioSeconds ?? 0),
    status: (r.status as ClientLink['status']) ?? 'active',
    events: { opens: ev.opens ?? 0, played: ev.audioPlays ?? 0, called: ev.calls ?? 0, wa: ev.whatsapp ?? 0, visit: ev.visits ?? 0 },
    lastOpen: last,
  } as ClientLink;
}

/** Shape one directory row from the read model into the contract type. */
function mapLinkSummary(row: Record<string, unknown>): ClientLinkSummary {
  const n = (key: string) => Number(row[key] ?? 0) || 0;
  return {
    id: String(row.id ?? ''),
    clientId: String(row.client_id ?? ''),
    clientName: String(row.client_name ?? ''),
    clientPhone: String(row.client_phone ?? ''),
    propertyIds: Array.isArray(row.property_ids) ? row.property_ids.map(String) : [],
    status: (String(row.status ?? 'active') as ClientLink['status']),
    ...(row.created_at ? { createdAt: String(row.created_at) } : {}),
    ...(row.expires_at ? { expiresAt: String(row.expires_at) } : {}),
    ...(row.revoked_at ? { revokedAt: String(row.revoked_at) } : {}),
    activity: {
      opens: n('opens'),
      propertyViews: n('property_views'),
      photoViews: n('photo_views'),
      mapOpens: n('map_opens'),
      audioPlays: n('audio_plays'),
      calls: n('calls'),
      whatsapp: n('whatsapp'),
      visitRequests: n('visit_requests'),
    },
    ...(row.last_activity_at ? { lastActivityAt: String(row.last_activity_at) } : {}),
    ...(row.first_opened_at ? { firstOpenedAt: String(row.first_opened_at) } : {}),
  };
}

class SupaClientLinks implements ClientLinkRepository {
  private readonly publicSessionId = `${cryptoId()}${cryptoId()}`;

  async directory(o?: QueryOptions): Promise<Result<readonly ClientLinkSummary[]>> {
    const a = aborted<readonly ClientLinkSummary[]>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_client_link_directory');
      if (error) return toErr(error);
      const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
      return ok(rows.map(mapLinkSummary));
    } catch (error) { return toErr(error); }
  }

  async workspace(linkId: string, o?: QueryOptions): Promise<Result<ClientLinkWorkspace>> {
    const a = aborted<ClientLinkWorkspace>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_client_link_workspace', { p_link_id: linkId });
      if (error) return toErr(error);
      const env = (data ?? {}) as Record<string, unknown>;
      if (env.ok !== true) return err('not_found', 'That link is no longer available');

      const link = (env.link ?? {}) as Record<string, unknown>;
      const clientRow = (env.client ?? null) as { payload?: Record<string, unknown> } | null;
      const summary = mapLinkSummary({
        id: link.id, client_id: link.clientId,
        client_name: clientRow?.payload?.name ?? '',
        client_phone: clientRow?.payload?.phone ?? '',
        property_ids: link.propertyIds,
        status: link.status, created_at: link.createdAt,
        expires_at: link.expiresAt, revoked_at: link.revokedAt,
      });

      const list = (v: unknown): Record<string, unknown>[] =>
        Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

      const properties = list(env.properties).map((p) => ({
        propertyId: String(p.propertyId ?? ''),
        name: String(p.name ?? 'Property'),
        ...(p.loc ? { loc: String(p.loc) } : {}),
        ...(p.price != null ? { price: Number(p.price) } : {}),
        lifecycle: String(p.lifecycle ?? 'draft'),
        views: Number(p.views ?? 0) || 0,
        photoViews: Number(p.photoViews ?? 0) || 0,
        mapOpens: Number(p.mapOpens ?? 0) || 0,
        ...(p.lastViewedAt ? { lastViewedAt: String(p.lastViewedAt) } : {}),
      }));

      const history = list(env.history).map((h) => ({
        kind: String(h.kind ?? 'opened') as ClientLinkEventKind,
        ...(h.propertyId ? { propertyId: String(h.propertyId) } : {}),
        at: String(h.at ?? ''),
      }));

      // Counts on the summary come from the per-property + history data,
      // so the detail view and the list can never disagree.
      const count = (kind: ClientLinkEventKind) => history.filter((h) => h.kind === kind).length;
      return ok({
        summary: {
          ...summary,
          activity: {
            opens: count('opened'),
            propertyViews: count('property_viewed'),
            photoViews: count('photos_viewed'),
            mapOpens: count('map_opened'),
            audioPlays: count('audio_played'),
            calls: count('call_clicked'),
            whatsapp: count('whatsapp_clicked'),
            visitRequests: count('visit_requested'),
          },
          ...(history[0]?.at ? { lastActivityAt: history[0].at } : {}),
        },
        properties,
        history,
      });
    } catch (error) { return toErr(error); }
  }

  async list(p?: PageParams, o?: QueryOptions): Promise<Result<Page<ClientLink>>> {
    const a = aborted<Page<ClientLink>>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_list_client_links');
      if (error) return toErr(error);
      const items = ((data ?? []) as Record<string, unknown>[]).map(rowToClientLink);
      return ok({ items, nextCursor: null, total: items.length });
    } catch (e) { return toErr(e); }
  }

  async listForProperty(propertyId: string, o?: QueryOptions): Promise<Result<ClientLink[]>> {
    const a = aborted<ClientLink[]>(o); if (a) return a;
    try {
      const c = await client();
      // The list RPC already accepts a property filter (p_property_id) and returns
      // only the dealer's own links containing that plot.
      const { data, error } = await c.rpc('plotmap_list_client_links', { p_property_id: propertyId });
      if (error) return toErr(error);
      return ok(((data ?? []) as Record<string, unknown>[]).map(rowToClientLink));
    } catch (e) { return toErr(e); }
  }

  async create(input: import('../contracts').CreateClientLinkInput, o?: QueryOptions): Promise<Result<import('../contracts').CreatedClientLink>> {
    const a = aborted<import('../contracts').CreatedClientLink>(o); if (a) return a;
    try {
      const c = await client();
      let audio: { objectPath: string; seconds: number } | undefined;
      if (input.audioBlob && input.audioBlob.size > 0) {
        if (input.audioBlob.size <= 44) return err('validation', 'The voice note did not contain any audio');
        if (input.audioBlob.size > 5 * 1024 * 1024) return err('validation', 'The voice note is too large; record a shorter message');
        const { data: ds } = await c.from('dealer_settings').select('dealer_id').maybeSingle();
        const dealerId = (ds as { dealer_id?: string } | null)?.dealer_id;
        if (!dealerId) return err('forbidden', 'Could not resolve your dealer account for the audio note');
        const rawMime = input.audioBlob.type || 'audio/wav';
        const mime = /audio\/(x-)?wav/i.test(rawMime) ? 'audio/wav' : rawMime.toLowerCase();
        if (!['audio/wav', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm'].includes(mime)) {
          return err('validation', 'This audio format is not supported');
        }
        const ext = mime.includes('wav') ? 'wav' : mime.includes('mp4') || mime.includes('mpeg') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
        const path = `dealers/${dealerId}/client-links/${cryptoId()}.${ext}`;
        const up = await c.storage.from('client-link-audio').upload(path, input.audioBlob, { contentType: mime, upsert: false });
        if (up.error) return err('unknown', `Audio upload failed: ${up.error.message}`);
        audio = { objectPath: path, seconds: Math.max(1, Math.min(120, Math.round(input.audioSeconds ?? 1))) };
      }
      const payload = {
        clientId: input.clientId || null,
        propertyIds: input.propertyIds,
        priceVisibility: input.priceVisibility,
        locationVisibility: input.locationVisibility,
        customPrices: input.customPrices ?? {},
        expiresInDays: input.expiresInDays,
        photoSelections: input.photoSelections,
        ...(audio ? { audio } : {}),
      };
      const { data, error } = await c.rpc('plotmap_create_client_link', { p_payload: payload });
      if (error) {
        if (audio) await c.storage.from('client-link-audio').remove([audio.objectPath]);
        return toErr(error);
      }
      const env = (data ?? {}) as { ok?: boolean; id?: string; token?: string; url?: string; expiresAt?: string };
      if (env.ok !== true || !env.token) {
        if (audio) await c.storage.from('client-link-audio').remove([audio.objectPath]);
        return err('unknown', 'Could not create the link');
      }
      const created = { id: String(env.id ?? ''), token: env.token, url: env.url ?? `/client/?token=${env.token}`, expiresAt: env.expiresAt };
      publishResourceInvalidation({ entity: 'client-link', id: created.id });
      return ok(created);
    } catch (e) { return toErr(e); }
  }

  async revoke(id: string, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      const { error } = await c.rpc('plotmap_revoke_client_link', { p_link_id: id });
      if (error) return toErr(error);
      publishResourceInvalidation({ entity: 'client-link', id });
      return ok(undefined);
    } catch (e) { return toErr(e); }
  }

  async recordEvent(
    token: string,
    event: 'opened' | 'audio_played' | 'call_clicked' | 'whatsapp_clicked' | 'visit_requested',
    propertyPublicId?: string,
    o?: QueryOptions,
  ): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    if (!/^[0-9a-f]{64}$/.test(token)) return err('validation', 'Invalid client link token');
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_record_client_link_event', {
        p_token: token,
        p_event_type: event,
        p_session_id: this.publicSessionId,
        p_idempotency_key: `${cryptoId()}${cryptoId()}`,
        p_metadata: propertyPublicId ? { propertyId: propertyPublicId } : {},
      });
      if (error) return toErr(error);
      const envelope = (data ?? {}) as { ok?: boolean };
      return envelope.ok === true ? ok(undefined) : err('unknown', 'Could not record client-link activity');
    } catch (e) { return toErr(e); }
  }

  async resolve(token: string, o?: QueryOptions): Promise<Result<ClientLinkState>> {
    const a = aborted<ClientLinkState>(o); if (a) return a;
    if (!token) return ok({ kind: 'invalid-token' });
    try {
      const c = await client();
      // PREFERRED: the resolve-client-link edge function runs with the service
      // role and returns SIGNED short-lived URLs for stored photos AND the voice
      // note — so the recording actually plays on the client's phone. It only
      // accepts allow-listed origins (PLOTMAP_CLIENT_LINK_ALLOWED_ORIGINS); if it
      // isn't reachable we fall back to the anon RPC (no audio / storage photos).
      try {
        const fn = await c.functions.invoke('resolve-client-link', { body: { token } });
        if (!fn.error && fn.data && typeof fn.data === 'object') {
          const env = fn.data as { ok?: boolean; reason?: string; link?: Record<string, unknown> };
          if (env.ok === true && env.link) return ok(snapshotToState(env.link));
          if (env.ok === false && env.reason) return ok(reasonToState(env.reason));
        }
      } catch { /* fall back to the RPC below */ }

      const { data, error } = await c.rpc('plotmap_resolve_client_link', { p_token: token });
      if (error) return ok({ kind: 'unavailable' });
      const env = (data ?? {}) as { ok?: boolean; reason?: string; link?: Record<string, unknown> };
      if (env.ok !== true) return ok(reasonToState(env.reason));
      return ok(snapshotToState(env.link ?? {}));
    } catch { return ok({ kind: 'unavailable' }); }
  }
}

function reasonToState(reason?: string): ClientLinkState {
  switch (reason) {
    case 'expired': return { kind: 'expired' };
    case 'revoked': return { kind: 'revoked' };
    case 'rate_limited':
    case 'unavailable': return { kind: 'unavailable' };
    default: return { kind: 'invalid-token' };
  }
}

/** Map a resolved client-link snapshot (from the edge function OR the RPC) to a
 *  ClientLinkState. Both return the same snapshot shape. */
export function snapshotToState(snap: Record<string, unknown>): ClientLinkState {
  const vis = (snap.visibility as { price?: string; location?: string }) ?? {};
  const intelligenceVisibility: LocationVisibility =
    vis.location === 'exact' || vis.location === 'approx'
      || vis.location === 'area' || vis.location === 'hidden'
      ? vis.location
      : 'area';
  const priceVisible = vis.price === 'shown';
  const locationVisible = vis.location === 'area' || vis.location === 'exact';
  const precise = vis.location === 'exact';
  const branding = (snap.branding as { brandName?: string; phone?: string; whatsapp?: string }) ?? {};
  const customer = (snap.customer as { name?: string }) ?? {};
  const audio = snap.audio as { available?: boolean; seconds?: number; url?: string } | null;
  const rawProps = (snap.properties as Record<string, unknown>[]) ?? [];
  const rawMaps = Array.isArray(snap.maps) ? snap.maps as Record<string, unknown>[] : [];
  const payload: ClientSafePayload = {
    dealerDisplayName: String(branding.brandName ?? 'Your dealer'),
    priceVisible, locationVisible,
    ...(branding.phone ? { dealerPhone: String(branding.phone) } : {}),
    ...(branding.whatsapp ? { dealerWhatsapp: String(branding.whatsapp) } : {}),
    ...(customer.name ? { buyerName: String(customer.name) } : {}),
    ...(audio?.url && /^https:\/\//i.test(audio.url) ? { voiceNote: { url: audio.url, seconds: Number(audio.seconds ?? 0) } } : {}),
    ...(precise && rawMaps.length ? { maps: rawMaps.map((m) => ({
      id: String(m.id ?? ''),
      kind: m.kind === 'sector' ? 'sector' as const : 'masterplan' as const,
      city: String(m.city ?? ''), sector: String(m.sector ?? ''), area: String(m.area ?? ''),
      label: String(m.label ?? ''), parentMapId: m.parentMapId ? String(m.parentMapId) : undefined,
      raster: String(m.raster ?? ''),
      assets: (m.assets && typeof m.assets === 'object') ? m.assets as ClientSafeMap['assets'] : undefined,
      dims: (m.dims && typeof m.dims === 'object') ? m.dims as ClientSafeMap['dims'] : undefined,
    })).filter((m) => m.id && m.raster) } : {}),
    properties: rawProps.map((p) => {
      const placement = p.placement as { mapId?: string; x?: number; y?: number } | undefined;
      const placementMapId = typeof placement?.mapId === 'string' ? placement.mapId.trim() : '';
      const placementX = typeof placement?.x === 'number' ? placement.x : Number.NaN;
      const placementY = typeof placement?.y === 'number' ? placement.y : Number.NaN;
      const hasValidPlacement = precise && Boolean(placementMapId)
        && Number.isFinite(placementX) && placementX >= 0 && placementX <= 1
        && Number.isFinite(placementY) && placementY >= 0 && placementY <= 1;
      const rawIntelligence = p.intelligence;
      const intelligence = rawIntelligence && typeof rawIntelligence === 'object'
        && Array.isArray((rawIntelligence as { local?: unknown }).local)
        && Array.isArray((rawIntelligence as { city?: unknown }).city)
        ? toBuyerSafeIntelligence(
          rawIntelligence as PropertyIntelligenceViewModel,
          intelligenceVisibility,
        )
        : undefined;
      return {
        id: String(p.id ?? ''),
        area: String(p.area ?? p.title ?? ''),
        size: String(p.size ?? ''), facing: String(p.facing ?? ''),
        position: String(p.roadWidth ?? p.plotNumber ?? ''),
        photos: ((p.photos as { url?: string }[]) ?? []).map((x) => x.url).filter((u): u is string => !!u),
        approvals: [], landmarks: [],
        ...(locationVisible && p.area ? { loc: String(p.area) } : {}),
        ...(priceVisible && p.price != null ? { price: Number(p.price) } : {}),
        // Precise location: carry the maps + pin so the client page can show
        // the property on its sector map and city masterplan.
        ...(precise && p.city ? { mapCity: String(p.city) } : {}),
        ...(precise && p.sector ? { mapSector: String(p.sector) } : {}),
        ...(precise && p.masterplanId ? { masterplanId: String(p.masterplanId) } : {}),
        ...(precise && p.sectorMapId ? { sectorMapId: String(p.sectorMapId) } : {}),
        ...(hasValidPlacement ? { placement: { mapId: placementMapId, x: placementX, y: placementY } } : {}),
        ...(intelligence ? { intelligence } : {}),
      };
    }),
  };
  const anyPhotos = payload.properties.some((p) => p.photos.length > 0);
  return anyPhotos ? { kind: 'valid', payload } : { kind: 'no-approved-photos', payload };
}

/* ── media (private storage signed URLs) ──────────────────────── */

class SupaMedia implements MediaRepository {
  thumb(assetId: string): string { return assetId; }
  async full(assetId: string, o?: QueryOptions): Promise<Result<MediaState>> {
    const a = aborted<MediaState>(o); if (a) return a;
    if (/^https?:\/\//.test(assetId) || assetId.startsWith('/')) return ok({ kind: 'ready', url: assetId });
    try {
      const c = await client();
      const [bucket, ...rest] = assetId.split('/');
      const { data, error } = await c.storage.from(bucket || 'property-photos').createSignedUrl(rest.join('/'), 900);
      if (error || !data) return ok({ kind: 'image-unavailable' });
      return ok({ kind: 'ready', url: data.signedUrl });
    } catch { return ok({ kind: 'image-unavailable' }); }
  }

  async uploadPropertyPhoto(propertyId: string, file: File, o?: QueryOptions) {
    const a = aborted<import('../types').PropertyPhotoStorageRef>(o); if (a) return a;
    const validation = validatePropertyPhoto(file);
    if (validation) return err('validation', validation);
    try {
      const c = await client();
      const dealer = await currentDealerId(c); if (!dealer.ok) return dealer;
      const dealerId = dealer.value;
      const objectId = cryptoId();
      const path = propertyPhotoObjectPath(dealerId, propertyId, objectId, file.type);
      const { error } = await c.storage.from(PROPERTY_PHOTO_BUCKET).upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      });
      if (error) return toErr(error);
      return ok({ kind: 'storage' as const, id: objectId, path });
    } catch (e) { return toErr(e); }
  }

  async removePropertyPhotos(paths: readonly string[], o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    const safe = [...new Set(paths.map((path) => String(path).trim()).filter((path) =>
      path.startsWith('dealers/') && path.includes('/properties/') && !path.includes('..') && !path.startsWith('/')))];
    if (!safe.length) return ok(undefined);
    try {
      const c = await client();
      const { error } = await c.storage.from(PROPERTY_PHOTO_BUCKET).remove(safe);
      return error ? toErr(error) : ok(undefined);
    } catch (e) { return toErr(e); }
  }
}

/* ── auth / account / device ──────────────────────────────────── */

class SupaAuth implements AuthRepository {
  async getActivationState(o?: QueryOptions): Promise<Result<ActivationState>> {
    const a = aborted<ActivationState>(o); if (a) return a;
    try {
      const c = await client();
      const { data } = await c.auth.getSession();
      // With no device-token gate wired client-side yet, a live session ⇒ activated.
      return ok(data.session ? { kind: 'activated' } : { kind: 'required' });
    } catch (e) { return err('unknown', (e as Error).message); }
  }
  async submitActivationCode(_code: string, o?: QueryOptions): Promise<Result<ActivationState>> {
    const a = aborted<ActivationState>(o); if (a) return a;
    // Device activation RPC wiring is the next phase; fail closed for now.
    return ok({ kind: 'device-approval-required' });
  }
  async getAccountState(o?: QueryOptions): Promise<Result<AccountState>> {
    const a = aborted<AccountState>(o); if (a) return a;
    try {
      const c = await client();
      const { data: sess } = await c.auth.getSession();
      if (!sess.session) return ok({ kind: 'access-denied' });
      const { data, error } = await c.from('dealer_settings')
        .select('subscription_status,account_status,trial_end').maybeSingle();
      if (error || !data) return ok({ kind: 'active' });
      const d = data as { subscription_status?: string; account_status?: string; trial_end?: string };
      if (d.account_status === 'suspended') return ok({ kind: 'suspended' });
      if (d.account_status === 'expired' || d.subscription_status === 'expired') return ok({ kind: 'expired' });
      if (d.subscription_status === 'trial') {
        const daysLeft = d.trial_end
          ? Math.max(0, Math.ceil((Date.parse(d.trial_end) - Date.now()) / 86400000)) : 14;
        return ok(daysLeft <= 3 ? { kind: 'trial-ending', daysLeft } : { kind: 'trial', daysLeft });
      }
      return ok({ kind: 'active' });
    } catch { return ok({ kind: 'active' }); }
  }
}

/* ── root adapter ─────────────────────────────────────────────── */

export class SupabaseDataAdapter implements DataAdapterV2 {
  readonly auth = new SupaAuth();
  readonly ai = new SupabaseAiRepository();
  readonly properties = new SupaProperties();
  readonly sellers = new SupaSellers();
  readonly propertyDocuments = new SupaPropertyDocuments();
  readonly customers = new SupaCustomers();
  readonly deals = new SupaDeals();
  readonly demand = new SupaDemand();
  readonly demandSignals = new SupaDemandSignals();
  readonly maps = new SupaMaps();
  readonly presentation = new SupaPresentation();
  readonly presentationEvents = new SupaPresentationEvents();
  readonly predictive = new SupaPredictive();
  readonly clientLinks = new SupaClientLinks();
  readonly media = new SupaMedia();
}
