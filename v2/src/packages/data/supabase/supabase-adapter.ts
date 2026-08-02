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

function cryptoId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.round(Math.random() * 1e9)}`;
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

function rowToMapMeta(m: Record<string, unknown>): Omit<MapData, 'sets'> {
  const assets = (m.assets as MapData['assets']) ?? {};
  const dims = (m.dims as { original?: { w: number; h: number }; threeD?: { w: number; h: number } }) ?? {};
  const payload = (m.payload as { calibration?: MapData['calibration'] }) ?? {};
  return {
    id: m.id, kind: m.kind, city: m.city ?? '', sector: m.sector ?? '',
    area: (m.area as string) ?? undefined,
    parentMapId: (m.parent_map_id as string) ?? undefined,
    label: m.label ?? m.area ?? '', raster: assets.original?.path ?? m.raster ?? '',
    assets,
    calibration: payload.calibration,
    dims: {
      original: dims.original ?? { w: assets.original?.w ?? 0, h: assets.original?.h ?? 0 },
      ...(assets.threeD || dims.threeD ? { threeD: dims.threeD ?? { w: assets.threeD!.w ?? 0, h: assets.threeD!.h ?? 0 } } : {}),
    },
    published: m.status === 'published', hidden: m.client_visible === false,
    linkedProperties: [],
  } as unknown as Omit<MapData, 'sets'>;
}

class SupaMaps implements MapRepository {
  async listRegistry(p?: PageParams, o?: QueryOptions): Promise<Result<Page<Omit<MapData, 'sets'>>>> {
    const a = aborted<Page<Omit<MapData, 'sets'>>>(o); if (a) return a;
    try {
      const c = await client();
      // Authenticated presentation path: dealer's published + client-visible maps only.
      const { data, error } = await c.rpc('plotmap_published_maps');
      if (error) return toErr(error);
      const items = ((data ?? []) as Record<string, unknown>[]).map(rowToMapMeta);
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
      return ok({ ...rowToMapMeta(m), sets } as unknown as MapData);
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
      // The list RPC returns {id,label,status,propertyCount,tokenHint,expiresAt,
      // createdAt,openedAt,lastOpenedAt,hasAudio,events:{opens,audioPlays,calls,
      // whatsapp,visits}} — map it to the ClientLink shape the dealer pages expect
      // so rendering never crashes on missing fields (e.g. clientName).
      const now = Date.now();
      const items: ClientLink[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
        const ev = (r.events as Record<string, number>) ?? {};
        const exp = r.expiresAt ? Math.max(0, Math.ceil((Date.parse(String(r.expiresAt)) - now) / 86400000)) : null;
        const last = r.lastOpenedAt ? new Date(String(r.lastOpenedAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'not yet';
        return {
          id: String(r.id), clientId: '', clientName: String(r.label ?? 'Client'),
          props: [], propNames: [], propertyCount: Number(r.propertyCount ?? 0),
          expiry: exp === null ? '—' : `${exp}d`,
          loc: 'area', price: 'hidden',
          audio: r.hasAudio ? 'done' : 'none', audioSecs: 0,
          status: (r.status as ClientLink['status']) ?? 'active',
          events: { opens: ev.opens ?? 0, played: ev.audioPlays ?? 0, called: ev.calls ?? 0, wa: ev.whatsapp ?? 0, visit: ev.visits ?? 0 },
          lastOpen: last,
        } as ClientLink;
      });
      return ok({ items, nextCursor: null, total: items.length });
    } catch (e) { return toErr(e); }
  }

  async create(input: import('../contracts').CreateClientLinkInput, o?: QueryOptions): Promise<Result<import('../contracts').CreatedClientLink>> {
    const a = aborted<import('../contracts').CreatedClientLink>(o); if (a) return a;
    try {
      const c = await client();
      let audio: { objectPath: string; seconds: number } | undefined;
      if (input.audioBlob && input.audioBlob.size > 0) {
        // The audio path MUST be dealers/<dealerId>/client-links/<file>.webm.
        const { data: ds } = await c.from('dealer_settings').select('dealer_id').maybeSingle();
        const dealerId = (ds as { dealer_id?: string } | null)?.dealer_id;
        if (!dealerId) return err('forbidden', 'Could not resolve your dealer account for the audio note');
        const path = `dealers/${dealerId}/client-links/${cryptoId()}.webm`;
        const up = await c.storage.from('client-link-audio').upload(path, input.audioBlob, { contentType: 'audio/webm', upsert: true });
        if (up.error) return err('unknown', `Audio upload failed: ${up.error.message}`);
        audio = { objectPath: path, seconds: Math.max(1, Math.min(120, Math.round(input.audioSeconds ?? 1))) };
      }
      const payload = {
        clientId: input.clientId || null,
        propertyIds: input.propertyIds,
        priceVisibility: input.priceVisibility,
        locationVisibility: input.locationVisibility,
        expiresInDays: input.expiresInDays,
        photoSelections: input.photoSelections,
        ...(audio ? { audio } : {}),
      };
      const { data, error } = await c.rpc('plotmap_create_client_link', { p_payload: payload });
      if (error) return toErr(error);
      const env = (data ?? {}) as { ok?: boolean; id?: string; token?: string; url?: string; expiresAt?: string };
      if (env.ok !== true || !env.token) return err('unknown', 'Could not create the link');
      return ok({ id: String(env.id ?? ''), token: env.token, url: env.url ?? `/client/?token=${env.token}`, expiresAt: env.expiresAt });
    } catch (e) { return toErr(e); }
  }

  async revoke(id: string, o?: QueryOptions): Promise<Result<void>> {
    const a = aborted<void>(o); if (a) return a;
    try {
      const c = await client();
      const { error } = await c.rpc('plotmap_revoke_client_link', { p_link_id: id });
      if (error) return toErr(error);
      return ok(undefined);
    } catch (e) { return toErr(e); }
  }

  async resolve(token: string, o?: QueryOptions): Promise<Result<ClientLinkState>> {
    const a = aborted<ClientLinkState>(o); if (a) return a;
    if (!token) return ok({ kind: 'invalid-token' });
    try {
      const c = await client();
      const { data, error } = await c.rpc('plotmap_resolve_client_link', { p_token: token });
      if (error) return ok({ kind: 'unavailable' });
      const env = (data ?? {}) as { ok?: boolean; reason?: string; link?: Record<string, unknown> };
      if (env.ok !== true) {
        switch (env.reason) {
          case 'expired': return ok({ kind: 'expired' });
          case 'revoked': return ok({ kind: 'revoked' });
          case 'rate_limited':
          case 'unavailable': return ok({ kind: 'unavailable' });
          default: return ok({ kind: 'invalid-token' });
        }
      }
      const snap = env.link ?? {};
      const vis = (snap.visibility as { price?: string; location?: string }) ?? {};
      const priceVisible = vis.price === 'shown';
      const locationVisible = vis.location === 'area' || vis.location === 'exact';
      const branding = (snap.branding as { brandName?: string }) ?? {};
      const audio = snap.audio as { available?: boolean; seconds?: number } | null;
      const rawProps = (snap.properties as Record<string, unknown>[]) ?? [];
      const payload: ClientSafePayload = {
        dealerDisplayName: String(branding.brandName ?? 'Your dealer'),
        priceVisible, locationVisible,
        ...(audio?.available ? { voiceNote: { url: '', seconds: Number(audio.seconds ?? 0) } } : {}),
        properties: rawProps.map((p) => ({
          id: String(p.id ?? ''),
          area: String(p.area ?? p.title ?? ''),
          size: String(p.size ?? ''), facing: String(p.facing ?? ''),
          position: String(p.roadWidth ?? p.plotNumber ?? ''),
          photos: ((p.photos as { url?: string }[]) ?? []).map((x) => x.url).filter((u): u is string => !!u),
          approvals: [], landmarks: [],
          ...(locationVisible && p.area ? { loc: String(p.area) } : {}),
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
