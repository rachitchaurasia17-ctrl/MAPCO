/* ═══════════════════════════════════════════════════════════════
   MAPCO EARTH — Masterplan / 3D raster maps
   ---------------------------------------------------------------
   Earth's Masterplan and 3D views used to be placeholders ("the
   layout will appear here"). This module gives them the real thing:
   the authored raster maps served through the presentation catalog,
   rendered by the shared map engine (packages/maps) that the Client
   Presentation already uses — same pan/zoom, same cover-fit, same
   no-distortion coordinate system, same lazy 3D loading.

   CLIENT-SAFE: this surface is shown to buyers in a meeting. It
   renders map imagery and map titles only — never price, seller,
   commission or any internal status.
   ═══════════════════════════════════════════════════════════════ */
import {
  getMap, registerMaps, mountMapEngine,
  type MapEntry, type MapCatalogInput, type MountedMap, type RenderMode,
} from '../../packages/maps';
import { adapter } from '../../packages/data/adapter';

export type PlanMode = 'masterplan' | 'threeD';

const escapeHtml = (value: string): string => value.replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

let catalog: MapEntry[] = [];
let catalogState: 'idle' | 'loading' | 'ready' | 'empty' | 'error' = 'idle';
let mounted: MountedMap | null = null;
let stage: HTMLElement | null = null;
let observer: ResizeObserver | null = null;
let activeId = '';
let activeMode: RenderMode = 'original';

/** Published, client-visible maps only — the same list the presentation shows. */
export async function loadPlanCatalog(): Promise<void> {
  if (catalogState === 'loading' || catalogState === 'ready') return;
  catalogState = 'loading';
  try {
    const result = await adapter.presentation.listMaps();
    if (!result.ok) { catalogState = 'error'; return; }
    registerMaps(result.value as unknown as MapCatalogInput[]);
    catalog = result.value
      .filter((entry) => entry.published && !entry.hidden)
      .map((entry) => getMap(entry.id))
      .filter((entry): entry is MapEntry => Boolean(entry));
    catalogState = catalog.length ? 'ready' : 'empty';
  } catch {
    catalogState = 'error';
  }
}

export const planCatalog = (): MapEntry[] => catalog;
export const planCatalogState = (): typeof catalogState => catalogState;
export const activePlanMapId = (): string => activeId;

/** Masterplans first — a sector sheet is a drill-down, not a default hero. */
function defaultMapId(mode: PlanMode): string {
  const wants3d = mode === 'threeD';
  const usable = wants3d ? catalog.filter((entry) => entry.threeD) : catalog;
  const masterplan = usable.find((entry) => entry.kind === 'masterplan');
  return (masterplan ?? usable[0])?.id ?? '';
}

export function sectorMaps(): MapEntry[] {
  return catalog.filter((entry) => entry.kind === 'sector');
}

/** True when the requested mode can actually be rendered for the active map. */
export function planModeAvailable(mode: PlanMode): boolean {
  if (mode !== 'threeD') return catalog.length > 0;
  return catalog.some((entry) => entry.threeD);
}

function shell(message: string, icon: string, title: string): string {
  return `<div class="e-plan">
    <div class="e-plan-grid e-plan-grid--plan"></div>
    <div class="e-plan-inner">
      <div class="e-plan-ic"><i class="${icon}"></i></div>
      <div class="e-plan-title">${escapeHtml(title)}</div>
      <p class="e-plan-body">${escapeHtml(message)}</p>
    </div>
  </div>`;
}

export interface PlanViewCallbacks {
  onBackToSectors?: () => void;
  onSelectProperty?: (propertyId: string) => void;
  onToggleMode?: (mode: RenderMode) => void;
  getPlots?: (map: MapEntry) => any[];
}

/**
 * Render the Masterplan/3D surface into `host`.
 * `mapId` selects a specific sheet (a sector map, say); omit for the default.
 */
export async function showPlan(
  host: HTMLElement,
  mode: PlanMode,
  mapId?: string,
  callbacks?: PlanViewCallbacks,
): Promise<void> {
  await loadPlanCatalog();

  if (catalogState === 'error') {
    teardownPlan(host);
    host.innerHTML = shell(
      'The map catalog could not be loaded. Check the connection and try again.',
      'ph-fill ph-warning', 'Maps unavailable');
    return;
  }
  if (catalogState === 'empty' || !catalog.length) {
    teardownPlan(host);
    host.innerHTML = shell(
      'No maps are published yet. Publish a masterplan or sector sheet in Map Studio and it will appear here.',
      'ph-fill ph-map-trifold', 'No maps published');
    return;
  }

  // Nothing in the catalog carries a 3D rendering — say that plainly rather
  // than falling through to a generic "map unavailable".
  if (mode === 'threeD' && !planModeAvailable('threeD')) {
    teardownPlan(host);
    host.innerHTML = shell(
      'No map has a 3D rendering yet. Add one in Map Studio and it will show here.',
      'ph-fill ph-cube', '3D not available');
    return;
  }

  const wanted = mode === 'threeD'
    ? (mapId && catalog.find((candidate) => candidate.id === mapId)?.threeD ? mapId : defaultMapId('threeD'))
    : (mapId && catalog.some((entry) => entry.id === mapId) ? mapId : defaultMapId(mode));
  const entry = catalog.find((candidate) => candidate.id === wanted);
  if (!entry) {
    teardownPlan(host);
    host.innerHTML = shell('That map is not available.', 'ph-fill ph-map-trifold', 'Map unavailable');
    return;
  }

  // 3D is optional per map — say so rather than silently showing the flat sheet.
  const renderMode: RenderMode = mode === 'threeD' && entry.threeD ? 'threeD' : 'original';
  if (mode === 'threeD' && !entry.threeD) {
    teardownPlan(host);
    host.innerHTML = shell(
      `${entry.title} has no 3D rendering yet. Add one in Map Studio to present it in 3D.`,
      'ph-fill ph-cube', '3D not available');
    return;
  }

  const isDedicatedSectorView = host.id === 'e-plan' && entry.kind === 'sector';
  const plots = isDedicatedSectorView && callbacks?.getPlots ? callbacks.getPlots(entry) : [];

  if (isDedicatedSectorView) {
    host.innerHTML = `
      <div class="e-sector-view">
        <div class="e-sector-topbar">
          <div class="e-sector-topbar-left">
            <a class="e-brand e-glass" id="e-sector-brand" href="javascript:void(0)" aria-label="Back to MAPCO Earth" style="padding:6px 12px 6px 8px;border-radius:12px">
              <img class="e-brand-logo" src="/assets/mapco-logo.png" alt="" width="34" height="34" />
              <div class="e-brand-text">
                <div class="e-brand-name" style="font-size:16px">MAPCO</div>
                <div class="e-brand-sub" style="font-size:8.5px">EARTH</div>
              </div>
              <i class="ph-bold ph-arrow-left e-brand-back" aria-hidden="true"></i>
            </a>
            <button class="e-sector-btn-back" id="e-sector-back" type="button">
              <i class="ph-bold ph-arrow-left"></i> All sectors
            </button>
            <div class="e-sector-badge">
              <i class="ph-fill ph-map-pin"></i> <span>${escapeHtml(entry.title)}</span>
            </div>
          </div>
          <div class="e-sector-topbar-right">
            <div class="e-sector-mode-toggle">
              <button class="e-sector-mode-btn ${renderMode === 'original' ? 'on' : ''}" data-plan-mode="original" type="button">
                <i class="ph-fill ph-book-open"></i> Original
              </button>
              <button class="e-sector-mode-btn ${renderMode === 'threeD' ? 'on' : ''}" data-plan-mode="threeD" type="button" ${entry.threeD ? '' : 'style="opacity:.45;cursor:not-allowed"'}>
                <i class="ph-fill ph-cube"></i> 3D map
              </button>
            </div>
          </div>
        </div>
        <div class="e-sector-body">
          <div class="e-sector-stage-wrap">
            <div class="e-plan-stage"></div>
          </div>
          <div class="e-sector-sidebar escroll">
            <div class="e-sector-sidebar-header">
              <div class="e-sector-kicker">IN THIS SECTOR</div>
              <div class="e-sector-title">${plots.length === 1 ? '1 plot of ours' : `${plots.length} plots of ours`}</div>
            </div>
            <div class="e-sector-plots">
              ${plots.length ? plots.map((p: any) => `
                <button class="e-sector-plot-card" data-plot-id="${escapeHtml(p.id)}" type="button">
                  <span class="e-sector-plot-media" style="display:block;${p.photos?.[0] ? `background-image:url('${escapeHtml(p.photos[0])}');background-size:cover;background-position:center` : 'background:#241d0c'}"></span>
                  <span class="e-sector-plot-info" style="display:block">
                    <span class="e-sector-plot-name" style="display:block">${escapeHtml(p.plotNo || p.tag)}</span>
                    <span class="e-sector-plot-specs" style="display:block">${escapeHtml([p.size, p.facing ? `${p.facing} facing` : ''].filter(Boolean).join(' · '))}</span>
                  </span>
                </button>
              `).join('') : `
                <div class="e-sector-empty-plots">
                  <i class="ph-fill ph-map-pin-area" style="font-size:28px;color:#d4a84f;display:block;margin-bottom:8px"></i>
                  <div>No inventory placed on this sheet yet.</div>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    host.querySelector('#e-sector-back')?.addEventListener('click', () => {
      callbacks?.onBackToSectors?.();
    });
    host.querySelector('#e-sector-brand')?.addEventListener('click', () => {
      callbacks?.onBackToSectors?.();
    });

    host.querySelectorAll<HTMLElement>('[data-plan-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.planMode as RenderMode;
        if (m === 'threeD' && !entry.threeD) return;
        callbacks?.onToggleMode?.(m);
      });
    });

    host.querySelectorAll<HTMLElement>('[data-plot-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.plotId;
        if (pid) callbacks?.onSelectProperty?.(pid);
      });
    });
  } else {
    host.innerHTML = '<div class="e-plan-stage"></div>';
  }

  stage = host.querySelector<HTMLElement>('.e-plan-stage')!;
  mounted = mountMapEngine(stage, { loaderGroup: 'earth-plan-raster' });
  // The host is toggled from display:none, so the stage can still measure
  // 0×0 when the engine first fits the raster. Re-fit as soon as it has
  // real layout, otherwise the map stays scaled/offset to a dead viewport.
  observer?.disconnect();
  observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box || box.width < 2 || box.height < 2) return;
    mounted?.engine.resize();
    mounted?.engine.cover();
  });
  observer.observe(stage);

  if (activeId !== entry.id) {
    const result = await mounted.engine.setMap(entry.id, { mode: renderMode });
    if (!result.ok) {
      teardownPlan(host);
      host.innerHTML = shell(
        `${entry.title} could not be loaded.`, 'ph-fill ph-warning', 'Map failed to load');
      return;
    }
    activeId = entry.id;
    activeMode = renderMode;
    mounted.engine.cover();
  } else if (activeMode !== renderMode) {
    await mounted.engine.setMode(renderMode);
    activeMode = renderMode;
    mounted.engine.cover();
  }
}

/** Recompute cover-fit after a viewport change (fullscreen, resize). */
export function resizePlan(): void {
  mounted?.engine.resize();
}

/** Release the engine, its listeners and cached imagery. */
export function teardownPlan(host?: HTMLElement): void {
  observer?.disconnect();
  observer = null;
  mounted?.dispose();
  mounted = null;
  stage = null;
  activeId = '';
  activeMode = 'original';
  if (host) host.innerHTML = '';
}
