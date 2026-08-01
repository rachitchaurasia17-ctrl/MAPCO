/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Map Studio data layer
   ---------------------------------------------------------------
   Dealer-side map management over the real Supabase RPCs
   (plotmap_dealer_maps / _set_map_status / _link_property_to_map /
   _upsert_map). Mock mode returns a small in-memory fixture so the
   studio is navigable without a backend. All methods are throw-free.
   ═══════════════════════════════════════════════════════════════ */
import { getSupabase } from './supabase/client';
import { activeDataMode } from './adapter';

export type MapStatus = 'draft' | 'published' | 'hidden' | 'archived';

export interface StudioAsset { path?: string; w?: number; h?: number; }
export interface StudioMap {
  id: string;
  kind: 'masterplan' | 'sector';
  city: string;
  area?: string;
  sector?: string;
  label: string;
  status: MapStatus;
  clientVisible: boolean;
  parentMapId?: string | null;
  assets: { original?: StudioAsset; threeD?: StudioAsset; overlay?: StudioAsset };
  dims?: { original?: { w: number; h: number }; threeD?: { w: number; h: number } };
}

export interface StudioResult<T> { ok: boolean; data?: T; error?: string; }

function rowToStudioMap(m: Record<string, unknown>): StudioMap {
  const status = ((m.deleted ? 'archived' : m.status) as MapStatus) ?? 'draft';
  return {
    id: String(m.id), kind: m.kind as StudioMap['kind'],
    city: (m.city as string) ?? 'Other', area: (m.area as string) ?? undefined,
    sector: (m.sector as string) ?? undefined, label: (m.label as string) ?? String(m.id),
    status, clientVisible: m.client_visible === true, parentMapId: (m.parent_map_id as string) ?? null,
    assets: (m.assets as StudioMap['assets']) ?? {},
    dims: (m.dims as StudioMap['dims']) ?? {},
  };
}

/* ── mock fixture (dev, no backend) ────────────────────────────── */
const MOCK: StudioMap[] = [
  { id: 'mohali-master', kind: 'masterplan', city: 'Mohali', area: 'Master Plan', label: 'Mohali — Master Plan', status: 'published', clientVisible: true, parentMapId: null, assets: { original: { path: '/maps-pilot/mohali-masterplan.png', w: 1603, h: 1278 }, threeD: { path: '/maps-pilot/mohali-3d.png', w: 1448, h: 1086 }, overlay: { path: '/maps-pilot/mohali-masterplan-overlays.svg' } }, dims: { original: { w: 1603, h: 1278 } } },
  { id: 'mohali-sec-90-91', kind: 'sector', city: 'Mohali', sector: 'Sector 90-91', area: 'Janta Township', label: 'Mohali — Sector 90-91', status: 'draft', clientVisible: false, parentMapId: 'mohali-master', assets: { original: { path: '/maps-pilot/mohali-sector-90-91.jpg', w: 1024, h: 724 } }, dims: { original: { w: 1024, h: 724 } } },
];

export interface MapStudioRepo {
  listMaps(): Promise<StudioResult<StudioMap[]>>;
  setStatus(id: string, status: MapStatus, clientVisible?: boolean): Promise<StudioResult<StudioMap>>;
  linkProperty(propertyId: string, mapId: string, x?: number, y?: number): Promise<StudioResult<void>>;
}

class SupabaseMapStudio implements MapStudioRepo {
  async listMaps(): Promise<StudioResult<StudioMap[]>> {
    try {
      const c = await getSupabase(); if (!c) return { ok: false, error: 'not configured' };
      const { data, error } = await c.rpc('plotmap_dealer_maps');
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(rowToStudioMap) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  }
  async setStatus(id: string, status: MapStatus, clientVisible?: boolean): Promise<StudioResult<StudioMap>> {
    try {
      const c = await getSupabase(); if (!c) return { ok: false, error: 'not configured' };
      const { data, error } = await c.rpc('plotmap_set_map_status', { p_map_id: id, p_status: status, p_client_visible: clientVisible ?? null });
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: data ? rowToStudioMap(data as Record<string, unknown>) : undefined };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  }
  async linkProperty(propertyId: string, mapId: string, x?: number, y?: number): Promise<StudioResult<void>> {
    try {
      const c = await getSupabase(); if (!c) return { ok: false, error: 'not configured' };
      const { error } = await c.rpc('plotmap_link_property_to_map', { p_property_id: propertyId, p_map_id: mapId, p_x: x ?? null, p_y: y ?? null });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  }
}

class MockMapStudio implements MapStudioRepo {
  private maps = MOCK.map((m) => ({ ...m }));
  async listMaps(): Promise<StudioResult<StudioMap[]>> { return { ok: true, data: this.maps.map((m) => ({ ...m })) }; }
  async setStatus(id: string, status: MapStatus, clientVisible?: boolean): Promise<StudioResult<StudioMap>> {
    const m = this.maps.find((x) => x.id === id);
    if (!m) return { ok: false, error: 'not found' };
    m.status = status;
    m.clientVisible = clientVisible ?? (status === 'published');
    return { ok: true, data: { ...m } };
  }
  async linkProperty(): Promise<StudioResult<void>> { return { ok: true }; }
}

export function getMapStudio(): MapStudioRepo {
  return activeDataMode() === 'supabase' ? new SupabaseMapStudio() : new MockMapStudio();
}
