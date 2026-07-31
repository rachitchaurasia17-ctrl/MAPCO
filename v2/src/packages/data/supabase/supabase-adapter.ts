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
  type PropertyRepository, type CustomerRepository, type DealRepository,
  type DemandRepository, type DemandRecord, type DemandDraft, type DemandMatch,
  type MapRepository, type PresentationRepository, type PresentationState,
  type PresentationEventsRepository, type PresentationEvent,
  type ClientLinkRepository, type ClientLinkState, type ClientSafePayload,
  type MediaRepository, type MediaState,
  type DemandSignalsRepository,
} from '../contracts';
import type { Property, Client, Deal, ClientLink, MapData, DemandSignal } from '../types';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function aborted<T>(opts?: QueryOptions): Result<T> | null {
  return opts?.signal?.aborted ? err('aborted', 'Request cancelled') : null;
}

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
    return ok(mapEntity<T>(data as CrmRow));
  } catch (e) { return toErr(e); }
}

/* ── CRM repositories ─────────────────────────────────────────── */

class SupaProperties implements PropertyRepository {
  list(p?: PageParams, o?: QueryOptions) {
    return crmList<Property>('properties', p, o, (r, q) =>
      `${r.payload.area} ${r.payload.loc} ${r.payload.type}`.toLowerCase().includes(q));
  }
  get(id: string, o?: QueryOptions) { return crmGet<Property>('properties', id, o); }
}

class SupaCustomers implements CustomerRepository {
  list(p?: PageParams, o?: QueryOptions) {
    return crmList<Client>('clients', p, o, (r, q) =>
      `${r.payload.name} ${r.payload.city}`.toLowerCase().includes(q));
  }
  get(id: string, o?: QueryOptions) { return crmGet<Client>('clients', id, o); }
}

class SupaDeals implements DealRepository {
  list(p?: PageParams, o?: QueryOptions) {
    return crmList<Deal>('deals', p, o, (r, q) =>
      `${r.payload.name} ${r.payload.client}`.toLowerCase().includes(q));
  }
  get(id: string, o?: QueryOptions) { return crmGet<Deal>('deals', id, o); }
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

class SupaMaps implements MapRepository {
  async listRegistry(p?: PageParams, o?: QueryOptions): Promise<Result<Page<Omit<MapData, 'sets'>>>> {
    const a = aborted<Page<Omit<MapData, 'sets'>>>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.from('prebuilt_maps')
        .select('id,kind,city,sector,label,raster,dims,status,client_visible,deleted')
        .eq('deleted', false).order('created_at', { ascending: true }).limit(Math.min(p?.limit ?? MAX_LIMIT, 200));
      if (error) return toErr(error);
      const items = (data ?? []).map((m: Record<string, unknown>) => ({
        id: m.id, kind: m.kind, city: m.city ?? '', sector: m.sector ?? '', label: m.label ?? '',
        raster: m.raster ?? '', dims: (m.dims as object) ?? {},
        published: m.status === 'published', hidden: m.client_visible === false, linkedProperties: [],
      })) as unknown as Omit<MapData, 'sets'>[];
      return ok({ items, nextCursor: null, total: items.length });
    } catch (e) { return toErr(e); }
  }
  async get(id: string, o?: QueryOptions): Promise<Result<MapData>> {
    const a = aborted<MapData>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.from('prebuilt_maps').select('*').eq('id', id).maybeSingle();
      if (error) return toErr(error);
      if (!data) return err('not_found', 'Map not found');
      const ov = await c.from('map_overlays').select('id,name,payload').eq('map_id', id).eq('deleted', false);
      const sets = (ov.data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id, name: s.name ?? '', marks: ((s.payload as { marks?: unknown[] })?.marks ?? []),
      }));
      const m = data as Record<string, unknown>;
      return ok({
        id: m.id, kind: m.kind, city: m.city ?? '', sector: m.sector ?? '', label: m.label ?? '',
        raster: m.raster ?? '', dims: (m.dims as object) ?? {},
        published: m.status === 'published', hidden: m.client_visible === false,
        sets, linkedProperties: [],
      } as unknown as MapData);
    } catch (e) { return toErr(e); }
  }
}

class SupaPresentation implements PresentationRepository {
  async getState(o?: QueryOptions): Promise<Result<PresentationState>> {
    const maps = await new SupaMaps().listRegistry({ limit: 200 }, o);
    if (!maps.ok) return err('network', 'Presentation failed to load', { retryable: true });
    if (maps.value.items.length === 0) return ok({ kind: 'no-map' });
    return ok({ kind: 'ready', maps: maps.value.items });
  }
}

class SupaPresentationEvents implements PresentationEventsRepository {
  async record(ev: PresentationEvent, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      // Best-effort, fire-and-forget: never block the UI on analytics.
      await c.rpc('plotmap_record_presentation_event', {
        p_dealer_id: '', p_session_id: '', p_event_type: ev.kind,
        p_map_id: ev.mapId ?? null, p_property_id: ev.propertyId ?? null,
        p_created_at: ev.at,
      });
      return ok(undefined);
    } catch { return ok(undefined); }
  }
}

/* ── client links (dealer list + buyer resolve via RPC) ───────── */

class SupaClientLinks implements ClientLinkRepository {
  async list(p?: PageParams, o?: QueryOptions): Promise<Result<Page<ClientLink>>> {
    const a = aborted<Page<ClientLink>>(o); if (a) return a;
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_list_client_links');
      if (error) return toErr(error);
      const items = (data ?? []) as ClientLink[];
      return ok({ items, nextCursor: null, total: items.length });
    } catch (e) { return toErr(e); }
  }

  async resolve(token: string, o?: QueryOptions): Promise<Result<ClientLinkState>> {
    const a = aborted<ClientLinkState>(o); if (a) return a;
    if (!token) return ok({ kind: 'invalid-token' });
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_resolve_client_link', { p_token: token });
      if (error) {
        if (/expired/i.test(error.message)) return ok({ kind: 'expired' });
        if (/revoked/i.test(error.message)) return ok({ kind: 'revoked' });
        return ok({ kind: 'unavailable' });
      }
      if (!data) return ok({ kind: 'invalid-token' });
      const snap = data as Record<string, unknown>;
      const status = String(snap.status ?? '');
      if (status === 'expired') return ok({ kind: 'expired' });
      if (status === 'revoked') return ok({ kind: 'revoked' });
      const rawProps = (snap.properties as Record<string, unknown>[]) ?? [];
      const priceVisible = snap.price === 'shown' || snap.price_visible === true;
      const locationVisible = snap.loc !== 'hidden' && snap.location_visible !== false;
      const payload: ClientSafePayload = {
        dealerDisplayName: String(snap.dealer_name ?? snap.dealerDisplayName ?? 'Your dealer'),
        priceVisible, locationVisible,
        properties: rawProps.map((p) => ({
          id: String(p.id ?? ''), area: String(p.area ?? ''),
          size: String(p.size ?? ''), facing: String(p.facing ?? ''), position: String(p.position ?? ''),
          photos: (p.photos as string[]) ?? [],
          approvals: (p.approvals as string[]) ?? [],
          landmarks: ((p.landmarks as { name: string; distance: string; icon?: string }[]) ?? [])
            .map((l) => ({ name: l.name, distance: l.distance, icon: l.icon ?? 'ph-fill ph-map-pin' })),
          ...(locationVisible && p.loc ? { loc: String(p.loc) } : {}),
          ...(priceVisible && p.price != null ? { price: Number(p.price) } : {}),
        })),
      };
      const anyPhotos = payload.properties.some((p) => p.photos.length > 0);
      return ok(anyPhotos ? { kind: 'valid', payload } : { kind: 'no-approved-photos', payload });
    } catch { return ok({ kind: 'unavailable' }); }
  }
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
  readonly properties = new SupaProperties();
  readonly customers = new SupaCustomers();
  readonly deals = new SupaDeals();
  readonly demand = new SupaDemand();
  readonly demandSignals = new SupaDemandSignals();
  readonly maps = new SupaMaps();
  readonly presentation = new SupaPresentation();
  readonly presentationEvents = new SupaPresentationEvents();
  readonly clientLinks = new SupaClientLinks();
  readonly media = new SupaMedia();
}
