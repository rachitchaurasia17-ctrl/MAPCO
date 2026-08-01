/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Client Presentation (approved map-first design)
   ---------------------------------------------------------------
   The hero meeting screen. Full-bleed dark map with transparent glass
   chrome; compact right property rail. Integrates the real map engine
   (v2/src/packages/maps) with the pilot masterplan/sector/3D maps.

   CLIENT-SAFE: never renders price, seller, commission, notes, team,
   or internal status. Consumes DataAdapterV2 (published plots only).
   ═══════════════════════════════════════════════════════════════ */
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import './presentation.css';
import { adapter } from '../../packages/data/adapter';
import { cssMapTransform, getMap, registerMaps, mountMapEngine, loadSvgOverlay, type RenderMode, type MountedMap, type MapCatalogInput, type MapEntry, type SvgHighlightHandle } from '../../packages/maps';

/** A saved highlight combination (built in Map Studio). */
type SavedSet = { id: string; name: string; itemIds: string[]; accent?: string };
import { streetViewUrl } from '../../packages/ui/utils';
import { mountFullscreenButton } from '../../packages/ui/fullscreen';
import { hasSafeInAppHistory } from '../../packages/ui/back-button';
import type { Property } from '../../packages/data/types';

type View = 'masterplan' | 'properties' | 'sectors';

type SectorDef = { id: string; name: string; city: string; sub: string; propertyIds: string[] };

const SECTORS: SectorDef[] = [
  { id: 'S1', name: 'Eco City Zone 2', city: 'New Chandigarh', sub: 'Official layout plan', propertyIds: ['ecocity'] },
  { id: 'S2', name: 'Zone 2 · Omaxe side', city: 'New Chandigarh', sub: 'Official layout plan', propertyIds: ['block5', 'omx'] },
  { id: 'S3', name: 'Aerocity', city: 'Mohali', sub: 'GMADA layout plan', propertyIds: ['aero'] },
  { id: 'S4', name: 'Sector 79', city: 'Mohali', sub: 'GMADA layout plan', propertyIds: ['sec79'] },
  { id: 'S5', name: 'Sector 66', city: 'Mohali', sub: 'GMADA layout plan', propertyIds: ['sec66'] },
  { id: 'S6', name: 'Sector 28', city: 'Chandigarh', sub: 'Estate office layout', propertyIds: [] },
  { id: 'S7', name: 'Sector 20', city: 'Panchkula', sub: 'HUDA layout plan', propertyIds: [] },
  { id: 'S8', name: 'VIP Road belt', city: 'Zirakpur', sub: 'Approved layout', propertyIds: [] },
];

const PROPERTY_NAMES: Record<string, string> = {
  ecocity: 'Eco City plot', block5: 'Block 5 site', aero: 'Aerocity plot',
  sec79: 'Sector 79 plot', sec66: 'Sector 66 plot', omx: 'Omaxe kothi site',
};

const CAPTIONS = ['Site view', 'Approach road', 'Surroundings', 'Front road', 'Wide angle', 'Evening view'];

/** Preferred default hero map (per founder). Falls back to first masterplan. */
const DEFAULT_MAP_ID = 'mohali-master';

const VIEWS: { k: View; l: string }[] = [
  { k: 'masterplan', l: 'Masterplan' },
  { k: 'properties', l: 'Properties' },
  { k: 'sectors', l: 'Sector maps' },
];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function loadIcons(): void {
  ['regular', 'fill', 'bold'].forEach((w) => {
    const href = `/assets/phosphor/${w}/style.css`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  });
}

export async function initPresentation(container: HTMLElement): Promise<() => void> {
  loadIcons();
  // Client Presentation is fully catalog-driven: the map list + default hero
  // come from the real Supabase catalog (loadCatalog). No pilot placeholder.
  let maps: MapEntry[] = [];
  let view: View = 'masterplan';
  let mode: RenderMode = 'original';
  let activeMapId = '';
  let mapsOpen = false;
  let railHidden = false;
  let props: Property[] = [];
  let selectedPropertyId: string | null = null;
  let selectedSectorId: string | null = null;
  let propertyShot = 0;
  let sectorMode: 'original' | 'threeD' = 'original';
  // Highlight state — the live selection lives in the overlay handle; it
  // persists across Original↔3D↔Original, zoom, pan, and opening/closing detail.
  // Saved sets (built in Map Studio) drive the single cycling Highlights button.
  let savedSets: SavedSet[] = [];
  let activeSetIndex = -1;
  let mapLoadState: 'idle' | 'loading' | 'ready' | 'unavailable' = 'idle';
  let loadState: 'loading' | 'ready' | 'empty' | 'error' = 'loading';
  const pinned = new Set<string>();

  // The premium authored-SVG highlight overlay for the active Original map.
  let overlay: SvgHighlightHandle | null = null;
  let overlayMapId: string | null = null;
  let overlayToken = 0;
  // A property→sector highlight queued while the overlay is still loading.
  let pendingSpotQuery: string | null = null;

  let mounted: MountedMap | null = null;
  const controller = new AbortController();

  // ── static shell ──────────────────────────────────────────
  container.innerHTML = `
<div class="pm-pres">
  <div class="pm-pres-map">
    <div class="pm-pres-stage" id="pm-stage"></div>
    <div class="pm-pres-grid pm-glass-bg" id="pm-grid" data-scroll role="tabpanel" aria-live="polite" style="display:none"></div>
    <div class="pm-pres-topbar" id="pm-topbar"></div>
    <div class="pm-botleft pm-glass-lite" id="pm-botleft"></div>
    <div class="pm-botright pm-glass" id="pm-botright"></div>
    <div id="pm-fs" style="position:absolute;top:14px;right:14px;z-index:35"></div>
    <button class="pm-rail-reopen pm-glass" id="pm-rail-reopen" data-act="rail-show" aria-label="Show properties panel" style="display:none"><i class="ph-fill ph-list-dashes" style="font-size:17px;color:#ffd76b"></i>Properties</button>
  </div>
  <aside class="pm-rail" id="pm-rail">
    <div class="pm-rail-head" id="pm-rail-head"></div>
    <div class="pm-rail-list" data-scroll id="pm-rail-list" aria-live="polite" aria-busy="true"></div>
  </aside>
  <div id="pm-detail"></div>
</div>`;

  const stage = container.querySelector<HTMLElement>('#pm-stage')!;
  const grid = container.querySelector<HTMLElement>('#pm-grid')!;
  const topbar = container.querySelector<HTMLElement>('#pm-topbar')!;
  const botleft = container.querySelector<HTMLElement>('#pm-botleft')!;
  const botright = container.querySelector<HTMLElement>('#pm-botright')!;
  const railHead = container.querySelector<HTMLElement>('#pm-rail-head')!;
  const railList = container.querySelector<HTMLElement>('#pm-rail-list')!;
  const rail = container.querySelector<HTMLElement>('#pm-rail')!;
  const railReopen = container.querySelector<HTMLElement>('#pm-rail-reopen')!;
  const detail = container.querySelector<HTMLElement>('#pm-detail')!;

  mounted = mountMapEngine(stage);
  const highlightLayer = document.createElement('div');
  highlightLayer.className = 'pm-map-smooth';
  highlightLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:1;transform-origin:0 0;';
  const pinLayer = document.createElement('div');
  pinLayer.className = 'pm-map-smooth';
  pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:2;transform-origin:0 0;';
  stage.append(highlightLayer, pinLayer);

  // Full Screen (small floating control). On enter/exit/Esc, recompute the
  // map's cover-fit for the new viewport; the pin/highlight rAF loop follows.
  const fsCleanup = mountFullscreenButton(container.querySelector<HTMLElement>('#pm-fs')!, {
    variant: 'floating', onResize: () => mounted?.engine.resize(),
  });

  type PinPosition = { x: number; y: number; provenance: 'map-authored' };

  /** Pins come ONLY from a property's real stored normalized placement on the
   *  active map. Never invented — an unplaced property simply has no pin. */
  function pinPositionFor(propertyId: string): PinPosition | undefined {
    const prop = props.find((p) => p.id === propertyId);
    if (prop?.mapPlacement?.mapId === activeMapId) {
      return { x: prop.mapPlacement.x, y: prop.mapPlacement.y, provenance: 'map-authored' };
    }
    return undefined;
  }

  /** True when the property has a real placement on the active map (pinnable). */
  function isPinnable(propertyId: string): boolean {
    return !!pinPositionFor(propertyId);
  }

  function propertyName(property: Property): string {
    return PROPERTY_NAMES[property.id] || property.area;
  }

  function plotPhoto(property: Property, index: number): string {
    return property.photos[index % Math.max(property.photos.length, 1)]
      || `/assets/ph-plot-${((property.id.length + index) % 3) + 1}.png`;
  }

  function motifStyle(index: number, gridSize = 16): string {
    const palettes = [
      ['#ffc93c', '#976eeb', '#5fa845', '#e8763a', '#3d8fb8'],
      ['#5fa845', '#e8763a', '#3d8fb8', '#ffc93c', '#976eeb'],
      ['#976eeb', '#ffc93c', '#e8763a', '#3d8fb8', '#5fa845'],
      ['#3d8fb8', '#5fa845', '#d9a520', '#976eeb', '#e8763a'],
    ];
    const boxes = [
      [[6, 10, 20, 16], [30, 8, 16, 22], [52, 14, 22, 12], [10, 52, 26, 18], [44, 58, 30, 22]],
      [[8, 14, 24, 20], [38, 10, 18, 16], [62, 10, 20, 26], [14, 58, 20, 16], [40, 62, 34, 20]],
      [[10, 8, 18, 24], [34, 16, 26, 14], [64, 20, 18, 18], [8, 60, 22, 20], [48, 54, 28, 24]],
      [[6, 16, 22, 18], [32, 6, 20, 20], [58, 16, 24, 20], [16, 54, 24, 22], [46, 60, 26, 18]],
    ];
    const palette = palettes[index % palettes.length]!;
    const shape = boxes[index % boxes.length]!;
    const angles = [24, 68, 112, 152, 38, 96, 132, 14];
    const a1 = angles[index % angles.length]!;
    const a2 = (a1 + 68) % 180;
    const layers = [
      `linear-gradient(90deg,rgba(120,92,40,.13) 0 1px,transparent 1px ${gridSize}px)`,
      `linear-gradient(0deg,rgba(120,92,40,.13) 0 1px,transparent 1px ${gridSize}px)`,
      `linear-gradient(${a1}deg,transparent 45%,rgba(196,186,164,.95) 45% 49.5%,transparent 49.5%)`,
      `linear-gradient(${a2}deg,transparent 62%,rgba(196,186,164,.9) 62% 65.5%,transparent 65.5%)`,
      ...shape.map((box, shapeIndex) => `linear-gradient(${palette[shapeIndex % palette.length]}d9,${palette[shapeIndex % palette.length]}d9)`),
    ];
    const sizes = [`${gridSize}px ${gridSize}px`, `${gridSize}px ${gridSize}px`, '100% 100%', '100% 100%', ...shape.map((box) => `${box[2]}% ${box[3]}%`)];
    const positions = ['0 0', '0 0', 'center', 'center', ...shape.map((box) => `${box[0]}% ${box[1]}%`)];
    const repeats = ['repeat', 'repeat', 'no-repeat', 'no-repeat', ...shape.map(() => 'no-repeat')];
    return `background-color:#f8efda;background-image:${layers.join(',')};background-size:${sizes.join(',')};background-position:${positions.join(',')};background-repeat:${repeats.join(',')}`;
  }

  let animFrame = 0;
  function updatePins() {
    animFrame = requestAnimationFrame(updatePins);
    if (!mounted || !pinLayer || view === 'properties') return;
    const t = mounted.engine.transform;
    if (!t) return;
    const sharedTransform = cssMapTransform(t);
    highlightLayer.style.transform = sharedTransform;
    pinLayer.style.transform = sharedTransform;

    const inv = 1 / t.scale;
    const is3d = mode === 'threeD';
    const upright = is3d ? 'rotateZ(5deg) rotateX(-44deg)' : '';

    for (let i = 0; i < pinLayer.children.length; i++) {
      const p = pinLayer.children[i] as HTMLElement;
      const inner = p.querySelector<HTMLElement>('[data-pin-marker]');
      if (inner) {
        inner.style.transform = `translate(-50%, -100%) scale(${inv}) ${upright}`;
      }
    }
  }
  updatePins();

  const activeMap = (): MapEntry | undefined => maps.find((item) => item.id === activeMapId);
  /** Highlights are only trustworthy when the overlay is calibrated. */
  const highlightsAvailable = (): boolean => activeMap()?.calibration?.status === 'calibrated' && !!activeMap()?.overlay;

  /** Load (or reuse) the premium highlight overlay for the active Original map.
   *  Clicking a road/block on the map highlights it instantly (multi-select).
   *  Never loads for uncalibrated maps; hidden on 3D. */
  async function ensureOverlay(): Promise<void> {
    const map = activeMap();
    if (overlayMapId === activeMapId && overlay) { applyPendingSpot(); return; } // already loaded
    // active map changed → drop the old overlay + its selection/sets
    overlay?.destroy(); overlay = null; overlayMapId = activeMapId;
    activeSetIndex = -1;
    if (!map || !highlightsAvailable()) { pendingSpotQuery = null; renderMapControls(); return; }
    const spec = map.overlay!;
    const myToken = ++overlayToken;
    const handle = await loadSvgOverlay(spec.src, spec.viewBox, { signal: controller.signal });
    if (myToken !== overlayToken || activeMapId !== map.id) { handle?.destroy(); return; } // superseded
    if (!handle) { pendingSpotQuery = null; return; }          // fetch failed → raster-only
    overlay = handle;
    highlightLayer.appendChild(handle.el);
    // Re-render controls when the selection changes (keeps the count/Clear fresh).
    handle.onSelectChange(() => renderMapControls());
    applyHighlights();
    applyPendingSpot();
    renderMapControls();
  }

  /** Center + zoom the map onto an authored shape by id (property-linked focus). */
  function focusOnSpot(id: string): void {
    if (!overlay || !mounted) return;
    const el = overlay.el.querySelector(`[data-hit="${id.replace(/["\\]/g, '\\$&')}"]`) as SVGGraphicsElement | null;
    if (!el || typeof el.getBBox !== 'function') return;
    try { const b = el.getBBox(); if (b.width && b.height) mounted.engine.focusOn({ x: b.x, y: b.y, w: b.width, h: b.height }); } catch { /* not measurable */ }
  }

  /** Resolve a queued property→sector highlight once the overlay is ready:
   *  match the property's sector/area to an authored shape id/label. */
  function applyPendingSpot(): void {
    if (!overlay || !pendingSpotQuery) return;
    const q = pendingSpotQuery.trim().toLowerCase();
    pendingSpotQuery = null;
    const num = q.match(/(\d+[a-z]?)/)?.[1];
    const target = overlay.items().find((it) => it.id.toLowerCase() === q)
      ?? (num ? overlay.items().find((it) => it.id.toLowerCase() === num) : undefined)
      ?? overlay.items().find((it) => it.label.toLowerCase().includes(q));
    if (!target) return;                                       // no authored shape — pin still shows
    activeSetIndex = -1;
    overlay.setSelection([target.id]);
    applyHighlights();
    focusOnSpot(target.id);
    renderMapControls();
  }

  /** Toggle overlay visibility + interactivity. SVG geometry is hidden on the
   *  3D rendering and off the masterplan view; the selection is preserved. */
  function applyHighlights(): void {
    if (!overlay) return;
    const showOverlay = view === 'masterplan' && mode === 'original' && !selectedPropertyId && !selectedSectorId;
    overlay.setVisible(showOverlay);
    overlay.setInteractive(showOverlay);
  }

  /** Cycle the saved highlight sets: off → set₁ → … → setₙ → off. One button. */
  function cycleSet(): void {
    if (!overlay) return;
    if (!savedSets.length) return;
    activeSetIndex = activeSetIndex + 1 >= savedSets.length ? -1 : activeSetIndex + 1;
    if (activeSetIndex < 0) overlay.setSelection([]);
    else {
      const set = savedSets[activeSetIndex]!;
      overlay.setAccent(set.accent || '#F59E0B');
      overlay.setSelection(set.itemIds);
    }
    renderMapControls();
  }

  /** Load the map's saved highlight sets (built in Map Studio). A set is a
   *  map_overlays row whose payload.marks is a list of authored shape ids. */
  async function loadSavedSets(mapId: string): Promise<void> {
    savedSets = [];
    if (!mapId) { renderMapControls(); return; }
    const res = await adapter.maps.get(mapId, { signal: controller.signal });
    if (res.ok) {
      savedSets = (res.value.sets ?? []).map((s) => {
        const marks = (s.marks ?? []) as unknown[];
        const itemIds = marks.filter((m): m is string => typeof m === 'string');
        const accent = (s as { accent?: string }).accent;
        return { id: s.id, name: s.name || 'Highlights', itemIds, accent };
      }).filter((s) => s.itemIds.length > 0);
    }
    renderMapControls();
  }

  function syncPins(): void {
    const map = maps.find((m) => m.id === activeMapId);
    pinLayer.innerHTML = '';
    if (!map || !map.original) return;

    pinned.forEach(id => {
      const pt = pinPositionFor(id);
      if (!pt) return;
      const px = pt.x * map.original.dims.w;
      const py = pt.y * map.original.dims.h;
      const prop = props.find(x => x.id === id);
      const propLabel = prop ? esc(prop.area) : 'Pinned property';
      const provenanceLabel = 'Placed from its stored map position';
      const is3d = mode === 'threeD';
      const upright = is3d ? 'rotateZ(5deg) rotateX(-44deg)' : '';

      // Visual language: property pins are BLUE (distinct from gold highlights).
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${px}px;top:${py}px;z-index:6;transform-style:preserve-3d;pointer-events:none`;
      el.innerHTML = `
        <div style="position:absolute;left:0;top:0;width:70px;height:70px;border-radius:50%;background:rgba(47,123,255,.45);animation:ringPulse 1.8s ease-out infinite;transform:translate(-50%,-50%);pointer-events:none"></div>
        <div data-pin-marker role="img" aria-label="${propLabel}: ${provenanceLabel}" title="${provenanceLabel}" style="position:relative;transform:translate(-50%,-100%) ${upright};transform-origin:bottom center;display:flex;flex-direction:column;align-items:center;animation:pinIn .4s cubic-bezier(.2,.9,.3,1.3) both;pointer-events:auto">
          <span style="display:flex;align-items:center;gap:7px;background:#2f7bff;color:#fff;border-radius:12px;padding:9px 14px;white-space:nowrap;font-size:15px;font-weight:800;border:2.5px solid #eaf1ff;box-shadow:0 10px 22px -8px rgba(10,30,80,.7)"><i class="ph-fill ph-map-pin" style="font-size:15px"></i>${propLabel}</span>
          <span style="display:block;width:3px;height:14px;background:#2f7bff"></span>
          <span style="display:block;width:14px;height:14px;border-radius:50%;background:#2f7bff;border:3px solid #eaf1ff;margin-top:-2px"></span>
        </div>
      `;
      pinLayer.appendChild(el);
    });
  }

  // ── renderers ─────────────────────────────────────────────
  /** Map picker grouped by city → masterplans then sectors. */
  function mapPickerHtml(): string {
    const byCity = new Map<string, typeof maps[number][]>();
    for (const m of maps) {
      const c = m.city || 'Other';
      const arr = byCity.get(c); if (arr) arr.push(m); else byCity.set(c, [m]);
    }
    let html = '';
    for (const city of [...byCity.keys()].sort()) {
      const cityMaps = byCity.get(city)!;
      const ordered = [...cityMaps.filter((m) => m.kind === 'masterplan'), ...cityMaps.filter((m) => m.kind === 'sector')];
      html += `<div class="pm-pop-city">${esc(city)}<span>${cityMaps.length}</span></div>`;
      for (const m of ordered) {
        const active = m.id === activeMapId;
        html += `<button class="pm-pop-item${m.kind === 'sector' ? ' is-sector' : ''}" role="menuitem" data-act="pick-map" data-id="${esc(m.id)}">
          <i class="ph-fill ph-${m.kind === 'masterplan' ? 'map-trifold' : 'squares-four'}" style="font-size:16px;color:#a8792a"></i>
          <span class="lbl">${esc(m.title)}</span>
          <span class="tag" style="background:${active ? '#dcf3e5' : '#f0eaff'};color:${active ? '#12704a' : '#5b32c4'}">${active ? 'Open' : m.kind === 'masterplan' ? 'master' : 'sector'}</span>
        </button>`;
      }
    }
    return html;
  }

  function renderTopbar(): void {
    const map = maps.find((m) => m.id === activeMapId);
    topbar.innerHTML = `
      <button class="pm-glass pm-topback" data-act="back" aria-label="Back to dashboard" title="Back to dashboard">
        <i class="ph-bold ph-arrow-left" style="font-size:18px;color:#ffd76b"></i>
      </button>
      <div class="pm-brand pm-glass">
        <img src="/assets/mapco-logo.png" alt="MAPCO" class="pm-brand-logo">
      </div>
      <div style="position:relative">
        <button class="pm-mapbtn pm-glass" data-act="toggle-maps" aria-haspopup="true" aria-expanded="${mapsOpen}">
          <i class="ph-fill ph-map-trifold" style="font-size:19px;color:#ffd76b"></i>
          <span class="pm-mapname">${esc(map?.title ?? 'Select map')}</span>
          <i class="ph-bold ph-caret-${mapsOpen ? 'up' : 'down'}" style="font-size:12px;color:#ffd76b"></i>
        </button>
        ${mapsOpen ? `<div class="pm-pop" role="menu">${mapPickerHtml()}</div>` : ''}
      </div>
      <div class="pm-viewtabs pm-glass" role="tablist">
        ${VIEWS.map((v) => `<button class="pm-viewtab ${view === v.k ? 'active' : ''}" role="tab" aria-selected="${view === v.k}" aria-controls="pm-grid" tabindex="${view === v.k ? '0' : '-1'}" data-act="view" data-view="${v.k}">${v.l}</button>`).join('')}
      </div>`;
  }

  /** The Highlights control:
   *   • "Alignment pending" chip when the overlay isn't calibrated;
   *   • ONE cycling button through the saved sets (off → set₁ → … → off);
   *   • a small Clear when anything is highlighted (saved set or manual clicks).
   *  Clicking roads/blocks on the map itself always highlights instantly. */
  function highlightsControlHtml(): string {
    if (mode !== 'original') return '';                        // 3D never shows SVG
    if (!highlightsAvailable()) {
      return `<span class="pm-ctl pm-ctl--pending" title="This map has no aligned highlight layer yet." aria-disabled="true"><i class="ph-fill ph-highlighter-circle" style="font-size:16px;opacity:.6"></i>Alignment pending</span>`;
    }
    const selCount = overlay?.selection().length ?? 0;
    let html = '<span class="pm-ctl-sep"></span>';
    if (savedSets.length) {
      const label = activeSetIndex >= 0 ? (savedSets[activeSetIndex]?.name ?? 'Highlights') : 'Highlights';
      html += `<button class="pm-ctl ${activeSetIndex >= 0 ? 'active' : ''}" data-act="cycle-set" title="Tap to show the next saved highlight set"><i class="ph-fill ph-highlighter-circle" style="font-size:16px"></i>${esc(label)}<i class="ph-bold ph-arrows-clockwise" style="font-size:12px;opacity:.7;margin-left:3px"></i></button>`;
    } else {
      html += `<span class="pm-ctl" style="opacity:.85;cursor:default" title="Tap roads or blocks on the map to highlight them"><i class="ph-fill ph-cursor-click" style="font-size:15px"></i>Tap map to highlight</span>`;
    }
    if (selCount > 0) {
      html += `<button class="pm-ctl" data-act="hl-clear" title="Clear highlights"><i class="ph-bold ph-x" style="font-size:14px"></i>Clear${selCount > 1 ? ` (${selCount})` : ''}</button>`;
    }
    return html;
  }

  function renderMapControls(): void {
    const map = maps.find((m) => m.id === activeMapId);
    const has3D = !!map?.threeD;
    // ONE cycling view button: shows the current view; a tap flips Original ↔ 3D.
    const modeBtn = has3D
      ? `<button class="pm-ctl active" data-act="mode-toggle" aria-label="Switch between Original and 3D map" title="Tap to switch Original ↔ 3D"><i class="ph-fill ph-${mode === 'original' ? 'map-trifold' : 'cube'}" style="font-size:15px"></i>${mode === 'original' ? 'Original' : '3D Map'}<i class="ph-bold ph-arrows-clockwise" style="font-size:12px;opacity:.7;margin-left:3px"></i></button>`
      : `<button class="pm-ctl active" disabled title="Only the original map is available for this map"><i class="ph-fill ph-map-trifold" style="font-size:15px"></i>Original</button>`;
    botleft.innerHTML = `${modeBtn}${highlightsControlHtml()}`;
    botright.innerHTML = `
      <i class="ph-fill ph-map-pin" style="font-size:18px;color:#ffd76b"></i>
      <span class="pm-pincount">${pinned.size} pinned</span>
      <button data-act="clear-pins" style="height:38px;padding:0 14px;border-radius:11px;background:rgba(255,248,230,.16);color:#fff8e6;font-size:14px;font-weight:800">Clear all</button>`;
    const detailOpen = Boolean(selectedPropertyId || selectedSectorId);
    const showMap = view === 'masterplan' && !detailOpen;
    botleft.style.display = showMap ? 'flex' : 'none';
    botright.style.display = showMap && pinned.size > 0 ? 'flex' : 'none';
    stage.style.display = showMap ? 'block' : 'none';
    grid.style.display = !detailOpen && (view === 'properties' || view === 'sectors') ? 'block' : 'none';
    rail.style.display = showMap && !railHidden ? 'flex' : 'none';
    // Floating "Show properties" chip when the rail is hidden (map view only).
    railReopen.style.display = showMap && railHidden ? 'inline-flex' : 'none';
    topbar.style.display = detailOpen ? 'none' : 'flex';
    if (!detailOpen && (view === 'properties' || view === 'sectors')) renderGrid();
    renderDetail();
    applyHighlights();
    // The map's usable width changed when the rail toggles → recompute cover-fit.
    if (showMap) requestAnimationFrame(() => mounted?.engine.resize());
    syncPins();
  }

  function renderGrid(): void {
    if (view === 'properties') {
      grid.innerHTML = `
        <div style="position:absolute;inset:0;overflow-y:auto;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">
          <div style="max-width:1260px;margin:0 auto;padding:84px 34px 56px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;animation:rowIn .45s ease both">
              <button style="height:36px;padding:0 14px;border-radius:10px;font-size:15px;font-weight:800;background:#2c224b;color:#f0eaff;box-shadow:0 8px 18px -8px rgba(44,34,75,.95)">All properties<span style="font-size:12.5px;font-weight:800;color:#f0eaff;background:#5b32c4;padding:2px 7px;border-radius:99px;margin-left:8px">${props.length}</span></button>
              <button style="height:36px;padding:0 14px;border-radius:10px;font-size:15px;font-weight:800;background:#f5efff;color:#5b32c4;box-shadow:0 4px 12px rgba(91,50,196,.06)">New Chandigarh<span style="font-size:12.5px;font-weight:800;color:#5b32c4;background:#e5d9f2;padding:2px 7px;border-radius:99px;margin-left:8px">3</span></button>
              <button style="height:36px;padding:0 14px;border-radius:10px;font-size:15px;font-weight:800;background:#f5efff;color:#5b32c4;box-shadow:0 4px 12px rgba(91,50,196,.06)">Mohali<span style="font-size:12.5px;font-weight:800;color:#5b32c4;background:#e5d9f2;padding:2px 7px;border-radius:99px;margin-left:8px">3</span></button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(298px,1fr));gap:20px;margin-top:22px">
              ${props.map(p => {
                const photo = p.photos[0];
                const bg = photo ? `background:#efdcb2 url('${esc(photo)}') center/cover` : `background:#efe6da;display:grid;place-items:center;color:#b3a894`;
                const pName = p.id === 'ecocity' ? 'Eco City plot' : p.id === 'block5' ? 'Block 5 site' : p.id === 'aero' ? 'Aerocity plot' : p.id === 'sec79' ? 'Sector 79 plot' : p.id === 'sec66' ? 'Sector 66 plot' : p.area;
                return `
                <button data-act="open-prop" data-id="${esc(p.id)}" style="text-align:left;background:#fffdfb;border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(88,52,168,.1),0 14px 30px -22px rgba(42,31,77,.6);cursor:pointer;transition:transform .15s,box-shadow .15s" onmouseenter="this.style.transform='translateY(-8px)';this.style.boxShadow='0 0 0 1px rgba(139,96,232,.35),0 3px 4px rgba(40,26,2,.06),0 44px 66px -36px rgba(139,96,232,.6)'" onmouseleave="this.style.transform='none';this.style.boxShadow='0 0 0 1px rgba(88,52,168,.1),0 14px 30px -22px rgba(42,31,77,.6)'">
                  <span style="position:relative;display:block;overflow:hidden">
                    <span style="display:block;aspect-ratio:16/9;${bg}">${photo ? '' : '<i class="ph-fill ph-image" style="font-size:34px"></i>'}</span>
                    <span style="position:absolute;top:13px;left:13px;display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:8px;background:rgba(28,21,51,.72);backdrop-filter:blur(10px);font-size:12px;font-weight:800;letter-spacing:.02em;font-variant-numeric:tabular-nums;color:#fff8e6">${esc(p.size)}</span>
                    <span style="position:absolute;right:13px;bottom:13px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(255,253,249,.95);box-shadow:0 2px 8px -3px rgba(28,21,51,.4);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:#1c1533"><i class="ph-fill ph-images" style="font-size:13px"></i>${p.photos.length} photos</span>
                  </span>
                  <span style="display:block;padding:18px 20px 20px;text-align:left">
                    <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.025em;color:#1c1533;line-height:1.06">${esc(pName)}</span>
                    <span style="display:block;margin-top:5px;font-size:14px;font-weight:600;letter-spacing:.005em;color:#6f6489">${esc(p.loc)}</span>
                    <span style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
                      <span style="padding:6px 11px;border-radius:8px;background:#fff2cd;box-shadow:inset 0 0 0 1px rgba(168,121,42,.22);font-size:12px;font-weight:800;letter-spacing:.02em;color:#8a5a0c">${esc(p.facing)} facing</span>
                      ${['Corner plot', 'Park facing'].includes(p.position) ? `<span style="padding:6px 11px;border-radius:8px;background:#e0f2e7;box-shadow:inset 0 0 0 1px rgba(20,108,58,.2);font-size:12px;font-weight:800;letter-spacing:.02em;color:#146c3a">${esc(p.position)}</span>` : ''}
                    </span>
                    <span style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:14.5px;font-weight:800;letter-spacing:.01em;color:#8a5a0c">See everything <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
                  </span>
                </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (view === 'sectors') {
      // ALL maps in the catalog, grouped by city; tap a card to open that map.
      const byCity = new Map<string, MapEntry[]>();
      for (const m of maps) { const c = m.city || 'Other'; const a = byCity.get(c); if (a) a.push(m); else byCity.set(c, [m]); }
      const plotCount = (mapId: string) => props.filter((p) => p.mapPlacement?.mapId === mapId).length;
      const cityBlocks = [...byCity.keys()].sort().map((city) => {
        const cityMaps = [...byCity.get(city)!].sort((a, b) => (a.kind === 'masterplan' ? -1 : 1) - (b.kind === 'masterplan' ? -1 : 1));
        return `<div style="margin-top:26px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a8792a;margin-bottom:12px">${esc(city)} <span style="color:#8d8271">· ${cityMaps.length} map${cityMaps.length === 1 ? '' : 's'}</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(266px,1fr));gap:18px">
            ${cityMaps.map((m) => {
              const raster = m.original?.src || '';
              const n = plotCount(m.id);
              const isActive = m.id === activeMapId;
              return `<button data-act="pick-map" data-id="${esc(m.id)}" style="display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:#fffdf9;box-shadow:0 0 0 ${isActive ? '2px #ffc21e' : '1px rgba(88,52,168,.1)'},0 24px 46px -36px rgba(60,40,5,.8);cursor:pointer;text-align:left;transition:transform .18s" onmouseenter="this.style.transform='translateY(-5px)'" onmouseleave="this.style.transform='none'">
                <span style="position:relative;display:block;height:160px;background:#0b0714 ${raster ? `url('${esc(raster)}') center/cover` : ''}">
                  <span style="position:absolute;top:12px;left:12px;padding:5px 10px;border-radius:8px;background:rgba(28,21,51,.72);backdrop-filter:blur(8px);font-size:11.5px;font-weight:800;color:#fff8e6">${m.kind === 'masterplan' ? 'Masterplan' : 'Sector'}</span>
                  ${n ? `<span style="position:absolute;right:12px;bottom:12px;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:#2f7bff;font-size:12px;font-weight:800;color:#fff"><i class="ph-fill ph-map-pin" style="font-size:12px"></i>${n} plot${n === 1 ? '' : 's'}</span>` : ''}
                </span>
                <span style="display:block;padding:16px 18px 18px">
                  <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:23px;letter-spacing:-.02em;color:#1c1533;line-height:1.1">${esc(m.title)}</span>
                  <span style="display:flex;align-items:center;gap:7px;margin-top:12px;font-size:14px;font-weight:800;color:#8a5a0c">${isActive ? 'Showing now' : 'Open this map'} <i class="ph-bold ph-arrow-right" style="font-size:14px"></i></span>
                </span></button>`;
            }).join('')}
          </div></div>`;
      }).join('');
      grid.innerHTML = `
        <div style="position:absolute;inset:0;overflow-y:auto;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">
          <div style="max-width:1260px;margin:0 auto;padding:80px 34px 56px">
            <h2 style="font-family:'Newsreader',serif;font-weight:500;font-size:30px;color:#1c1533;margin:0">All maps</h2>
            <p style="margin:6px 0 0;font-size:14px;color:#6f6489">Every published map — tap one to show it on the main screen.</p>
            ${cityBlocks || '<div style="margin-top:24px;color:#6f6489">No maps published yet.</div>'}
          </div>
        </div>`;
    }
  }

  function renderDetail(): void {
    if (selectedPropertyId) {
      const property = props.find((item) => item.id === selectedPropertyId);
      if (!property) { selectedPropertyId = null; detail.innerHTML = ''; return; }
      const photo = plotPhoto(property, propertyShot);
      const sector = SECTORS.find((item) => item.propertyIds.includes(property.id));
      const facts = [
        ['Plot size', property.size],
        ['Facing', property.facing],
        ['Position', property.position || 'Inside plot'],
        ['Sector', property.area],
      ];
      const approval = property.approvals.length ? `${property.approvals.join(' + ')} approved` : 'Approved listing';
      const waUrl = `https://wa.me/?text=${encodeURIComponent(`${propertyName(property)} — ${property.size} · ${property.facing} facing · ${property.loc}`)}`;
      detail.innerHTML = `<div style="position:absolute;inset:0;z-index:60;overflow:hidden;display:flex;flex-direction:column;background:#1d1405;background-image:radial-gradient(75% 55% at 88% -4%,rgba(255,201,60,.34),transparent 60%),radial-gradient(65% 50% at 4% 10%,rgba(151,110,235,.28),transparent 60%),radial-gradient(80% 60% at 50% 106%,rgba(31,161,110,.22),transparent 60%);animation:veil .22s ease both">
        <div style="flex:1;min-height:0;width:100%;max-width:1340px;margin:0 auto;padding:18px 26px 22px;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;gap:14px;flex:none"><button data-act="close-prop" style="display:flex;align-items:center;gap:9px;height:44px;padding:0 17px;border-radius:13px;background:rgba(255,248,230,.14);color:#fff8e6;font-size:15px;font-weight:800"><i class="ph-bold ph-arrow-left" style="font-size:17px"></i>Back</button><div style="flex:1"></div><div style="display:flex;align-items:center;gap:9px;height:44px;padding:0 15px;border-radius:13px;background:rgba(255,248,230,.1)"><i class="ph-fill ph-seal-check" style="font-size:19px;color:#7be0a4"></i><span style="font-size:14.5px;font-weight:800;color:#e9f7ee">${esc(approval)}</span></div></div>
          <div style="flex:1;min-height:0;margin-top:16px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;animation:lbIn .3s cubic-bezier(.2,.8,.2,1) both">
            <div style="min-height:0;display:flex;flex-direction:column"><div style="position:relative;flex:1;min-height:0;border-radius:24px;overflow:hidden;box-shadow:0 40px 80px -34px rgba(0,0,0,.8)"><div style="position:absolute;inset:0;background-image:url('${esc(photo)}');background-size:cover;background-position:center"></div><div style="position:absolute;left:0;right:0;bottom:0;padding:44px 26px 20px;background:linear-gradient(180deg,rgba(18,12,2,0),rgba(18,12,2,.85));display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="font-size:18px;font-weight:800;color:#fffdf7">${CAPTIONS[propertyShot]}</div><div style="font-size:14.5px;font-weight:800;color:#e2cf9f;flex:none">${propertyShot + 1} of 6</div></div><button data-act="prop-prev" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,250,238,.92);color:#241d0c;display:grid;place-items:center"><i class="ph-bold ph-caret-left" style="font-size:23px"></i></button><button data-act="prop-next" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,250,238,.92);color:#241d0c;display:grid;place-items:center"><i class="ph-bold ph-caret-right" style="font-size:23px"></i></button></div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:11px;flex:none">${[0, 1, 2, 3, 4, 5].map((index) => `<button data-act="prop-shot" data-index="${index}" style="display:block;overflow:hidden;border-radius:13px;box-shadow:0 0 0 ${index === propertyShot ? '3px #ffc21e' : '1.5px rgba(255,248,230,.2)'}"><span style="display:block;width:100%;height:64px;background-image:url('${esc(plotPhoto(property, index))}');background-size:cover;background-position:center"></span></button>`).join('')}</div></div>
            <div style="min-height:0;display:flex;flex-direction:column"><div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding-right:4px"><div style="font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#ffd76b">${esc(property.city)}</div><h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:clamp(30px,4.4vh,44px);line-height:1;letter-spacing:-.035em;color:#fffdf7">${esc(propertyName(property))}</h1><div style="margin-top:8px;font-size:16px;color:#e2cf9f">${esc(property.loc)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">${facts.map(([key, value]) => `<div style="padding:13px 16px;border-radius:15px;background:rgba(255,248,230,.09);box-shadow:inset 0 0 0 1px rgba(255,248,230,.14)"><div style="font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c8b58a">${esc(key!)}</div><div style="margin-top:4px;font-family:'Newsreader',serif;font-weight:500;font-size:22px;color:#fffdf7;line-height:1.1">${esc(value!)}</div></div>`).join('')}</div><div style="margin-top:16px;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#e2cf9f">What is close by</div><div style="display:flex;flex-direction:column;gap:7px;margin-top:10px">${property.landmarks.map((landmark) => `<div style="display:flex;align-items:center;gap:11px;padding:10px 14px;border-radius:13px;background:rgba(255,248,230,.07)"><i class="${esc(landmark.icon)}" style="font-size:19px;color:#ffd76b;flex:none"></i><span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:#fff8e6">${esc(landmark.name)}</span><span style="font-size:14.5px;font-weight:800;color:#7be0a4;flex:none">${esc(landmark.distance)}</span></div>`).join('')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px;flex:none"><button data-act="prop-plan" style="display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:15px;background:#ffc21e;color:#231a04;font-size:15px;font-weight:800;box-shadow:0 18px 34px -18px rgba(255,194,30,.95)"><i class="ph-fill ph-map-trifold" style="font-size:19px"></i>Masterplan</button><button data-act="prop-sector" data-id="${sector?.id || ''}" style="display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:15px;background:rgba(255,248,230,.14);color:#fff8e6;font-size:15px;font-weight:800"><i class="ph-fill ph-map-pin-area" style="font-size:19px"></i>Sector map</button><a href="${esc(streetViewUrl(property.loc))}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:15px;background:#e8f0fe;color:#1a56c4;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-person-simple-walk" style="font-size:19px"></i>Street view</a><a href="${esc(waUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:15px;background:#12a150;color:#fff;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-whatsapp-logo" style="font-size:19px"></i>WhatsApp</a></div></div>
          </div>
        </div>
      </div>`;
      return;
    }

    if (selectedSectorId) {
      const sector = SECTORS.find((item) => item.id === selectedSectorId);
      if (!sector) { selectedSectorId = null; detail.innerHTML = ''; return; }
      const sectorProps = sector.propertyIds.map((id) => props.find((property) => property.id === id)).filter((property): property is Property => Boolean(property));
      const sectorIndex = SECTORS.indexOf(sector);
      const pinPositions = [[48, 44], [66, 36], [43, 58]];
      detail.innerHTML = `<div style="position:absolute;inset:0;z-index:30;display:flex;background:#1d1405;background-image:radial-gradient(75% 55% at 88% -4%,rgba(255,201,60,.34),transparent 60%),radial-gradient(65% 50% at 4% 10%,rgba(151,110,235,.28),transparent 60%),radial-gradient(80% 60% at 50% 106%,rgba(31,161,110,.22),transparent 60%);animation:veil .2s ease both">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;padding:22px 24px 22px 26px;gap:16px;min-height:0"><div style="flex:none;display:flex;align-items:center;gap:10px"><button data-act="close-sec" style="flex:none;white-space:nowrap;display:flex;align-items:center;gap:8px;height:44px;padding:0 17px;border-radius:14px;background:rgba(255,248,230,.12);color:#fff8e6;font-size:15px;font-weight:800"><i class="ph-bold ph-arrow-left" style="font-size:16px"></i>All sectors</button><div style="flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:9px;height:44px;padding:0 17px;border-radius:14px;background:rgba(255,248,230,.09);box-shadow:inset 0 0 0 1px rgba(255,248,230,.14)"><i class="ph-fill ph-map-pin-area" style="font-size:18px;color:#ffc21e;flex:none"></i><span style="font-size:15.5px;font-weight:800;color:#fff8e6">${esc(sector.name)}</span></div><button data-act="sector-to-plan" style="flex:none;white-space:nowrap;display:flex;align-items:center;gap:8px;height:44px;padding:0 15px;border-radius:14px;background:rgba(255,248,230,.12);color:#fff8e6;font-size:14.5px;font-weight:800"><i class="ph-fill ph-map-trifold" style="font-size:17px;color:#ffd76b"></i>On masterplan</button><div style="flex:1"></div><div style="display:flex;align-items:center;gap:5px;padding:5px;border-radius:15px;background:rgba(255,248,230,.09);box-shadow:inset 0 0 0 1px rgba(255,248,230,.14)"><button data-act="sector-mode" data-mode="original" style="display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;font-size:13.5px;font-weight:800;${sectorMode === 'original' ? 'background:#ffc21e;color:#231a04' : 'background:rgba(255,248,230,.14);color:#fff8e6'}"><i class="ph-fill ph-map-trifold" style="font-size:16px"></i>Original</button><button data-act="sector-mode" data-mode="threeD" style="display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;font-size:13.5px;font-weight:800;${sectorMode === 'threeD' ? 'background:#ffc21e;color:#231a04' : 'background:rgba(255,248,230,.14);color:#fff8e6'}"><i class="ph-fill ph-cube" style="font-size:16px"></i>3D map</button></div></div><div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center"><div style="position:relative;flex:1 1 auto;min-width:0;width:100%;height:100%;max-width:1040px;border-radius:20px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,248,230,.14),0 40px 80px -34px rgba(0,0,0,.85);transition:transform .5s cubic-bezier(.2,.8,.2,1);transform:${sectorMode === 'threeD' ? 'perspective(1500px) rotateX(42deg) rotateZ(-4deg) scale(.86)' : 'none'}"><div style="position:absolute;inset:0;pointer-events:none;${motifStyle(sectorIndex, 34)}"></div>${sectorProps.map((property, index) => { const pos = pinPositions[index % pinPositions.length]!; return `<div style="position:absolute;left:${pos[0]}%;top:${pos[1]}%;z-index:6"><button data-act="open-prop" data-id="${esc(property.id)}" style="position:relative;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center"><span style="display:flex;align-items:center;gap:7px;background:#ffc21e;color:#231a04;border-radius:12px;padding:9px 14px;white-space:nowrap;font-size:15px;font-weight:800;border:2.5px solid #fffdf7;box-shadow:0 10px 22px -8px rgba(40,26,2,.7)"><i class="ph-fill ph-map-pin-area" style="font-size:15px"></i>${esc(propertyName(property))}</span><span style="display:block;width:3px;height:14px;background:#ffc21e"></span><span style="display:block;width:14px;height:14px;border-radius:50%;background:#ffc21e;border:3px solid #fffdfb;margin-top:-2px"></span></button></div>`; }).join('')}</div></div></div>
        <aside data-scroll style="width:344px;flex:none;overflow-y:auto;background:rgba(255,248,230,.06);box-shadow:inset 1px 0 0 rgba(255,248,230,.14);padding:26px 22px 24px"><div style="font-size:11.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ffc93c">In this sector</div><div style="margin-top:4px;font-family:'Newsreader',serif;font-weight:500;font-size:29px;letter-spacing:-.028em;color:#fffdf7">${sectorProps.length ? `${sectorProps.length} ${sectorProps.length === 1 ? 'plot' : 'plots'} of ours` : 'No plots here'}</div><div style="display:flex;flex-direction:column;gap:13px;margin-top:16px">${sectorProps.map((property) => `<button data-act="open-prop" data-id="${esc(property.id)}" style="display:block;width:100%;overflow:hidden;border-radius:16px;background:rgba(255,248,230,.09);box-shadow:inset 0 0 0 1px rgba(255,248,230,.16)"><span style="display:block;width:100%;height:150px;background-image:url('${esc(plotPhoto(property, 1))}');background-size:cover;background-position:center"></span><span style="display:block;padding:13px 15px 15px;text-align:left"><span style="display:block;font-size:17.5px;font-weight:800;color:#fffdf7">${esc(propertyName(property))}</span><span style="display:block;margin-top:5px;font-size:13.5px;font-weight:600;color:#e2cf9f">${esc(property.size)} · ${esc(property.facing)} facing</span></span></button>`).join('') || '<div style="padding:22px 14px;text-align:center;font-size:15px;background:rgba(255,248,230,.07);border-radius:16px;color:#e2cf9f">No plots of ours in this sector yet.</div>'}</div></aside>
      </div>`;
      return;
    }

    detail.innerHTML = '';
  }

  function pcard(p: Property): string {
    const photo = p.photos[0];
    // A property is pinnable only if it has a real stored placement on SOME
    // published map. Unplaced properties never get an invented pin.
    const placed = !!p.mapPlacement?.mapId && maps.some((m) => m.id === p.mapPlacement!.mapId);
    return `
    <article class="pm-pcard">
      <button class="pm-pcard-title" data-act="open-prop" data-id="${esc(p.id)}">${esc(p.area)} · ${esc(p.size)}</button>
      <button class="pm-pcard-photo" data-act="open-prop" data-id="${esc(p.id)}" aria-label="Open ${esc(propertyName(p))}" style="display:block;width:100%;text-align:left">
        ${photo ? `<img src="${esc(photo)}" alt="${esc(p.area)}" loading="lazy">` : `<div class="pm-pcard-noimg"><i class="ph-fill ph-image" style="font-size:34px"></i></div>`}
        ${p.photos.length ? `<span class="pm-pcard-count"><i class="ph-fill ph-images"></i>${p.photos.length} photos</span>` : ''}
      </button>
      <div class="pm-pcard-body">
        <div class="pm-pcard-actions">
          ${placed
            ? `<button class="pm-pcard-act pm-pcard-act--pin" data-act="pin" data-id="${esc(p.id)}"><i class="ph-fill ph-map-pin"></i>${pinned.has(p.id) ? 'Pinned' : 'Pin on map'}</button>`
            : `<button class="pm-pcard-act pm-pcard-act--pin" disabled title="No map position set for this plot yet" style="opacity:.45;cursor:not-allowed"><i class="ph-fill ph-map-pin"></i>Not on map</button>`}
          <a class="pm-pcard-act pm-pcard-act--sv" href="${esc(streetViewUrl(p.loc))}" target="_blank" rel="noopener"><i class="ph-fill ph-street-view"></i>Street view</a>
        </div>
      </div>
    </article>`;
  }

  function renderRail(): void {
    railList.setAttribute('aria-busy', String(loadState === 'loading'));
    railHead.innerHTML = `
      <div class="pm-filter">
        <i class="ph-fill ph-squares-four" style="font-size:20px;color:#a8792a"></i>
        <span style="flex:1;min-width:0">
          <span class="pm-filter-eyebrow">SHOWING</span>
          <span class="pm-filter-label">Everything</span>
        </span>
        <span class="pm-filter-count">${loadState === 'ready' ? props.length : 0}</span>
        <button class="pm-rail-close" data-act="rail-hide" aria-label="Hide properties panel" title="Hide panel"><i class="ph-bold ph-x" style="font-size:15px"></i></button>
      </div>`;
    if (loadState === 'loading') { railList.innerHTML = '<span class="pm-sr-only" role="status">Loading published plots…</span>' + '<div class="pm-skel"></div>'.repeat(3); return; }
    if (loadState === 'error') { railList.innerHTML = `<div class="pm-rail-state" role="alert"><i class="ph-fill ph-warning-circle"></i>Could not load plots.</div>`; return; }
    if (loadState === 'empty' || props.length === 0) { railList.innerHTML = `<div class="pm-rail-state"><i class="ph-fill ph-tray"></i>No published plots to show yet.</div>`; return; }
    railList.innerHTML = props.map(pcard).join('');
  }

  /** Show/clear a centered glass message over the map (load failures). */
  function mapMsg(text: string | null): void {
    let el = container.querySelector<HTMLElement>('#pm-mapmsg');
    if (!text) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'pm-mapmsg';
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;padding:14px 20px;border-radius:14px;background:rgba(24,16,4,.72);backdrop-filter:blur(10px);color:#fff8e6;font-size:15px;font-weight:700;text-align:center;max-width:340px';
      container.querySelector('.pm-pres-map')?.appendChild(el);
    }
    const loading = /loading/i.test(text);
    const icon = loading ? 'ph-circle-notch pm-spin' : 'ph-warning-circle';
    el.innerHTML = `<i class="ph-fill ${icon}" style="font-size:20px;display:block;margin-bottom:6px;color:#ffd76b"></i>${esc(text)}`;
  }

  async function applyMap(): Promise<void> {
    if (!mounted || !activeMapId) return;
    mapMsg(null);
    const result = await mounted.engine.setMap(activeMapId, { mode });
    if (result.ok) {
      if (view === 'masterplan') mounted.engine.cover();
      // Load the authored SVG overlay for the (Original) map; hidden on 3D.
      void ensureOverlay();
    } else if (result.reason !== 'superseded' && result.reason !== 'disposed') {
      mapMsg(result.reason === 'no-rendering' ? 'This view is not available for this map.' : 'This map could not be loaded.');
    }
  }

  /** Pick the default hero map: the founder's preferred map, else the first
   *  published masterplan, else the first available map. */
  function pickDefaultMapId(): string {
    if (maps.some((m) => m.id === DEFAULT_MAP_ID)) return DEFAULT_MAP_ID;
    return (maps.find((m) => m.kind === 'masterplan') ?? maps[0])?.id ?? '';
  }

  /** Load the real Supabase catalog and drive the FIRST map render from it.
   *  The presentation is fully catalog-driven — no pilot placeholder. */
  async function loadCatalog(): Promise<void> {
    mapLoadState = 'loading';
    const reg = await adapter.maps.listRegistry({ limit: 300 }, { signal: controller.signal });
    if (!reg.ok) {
      if (reg.error.code === 'aborted') return;
      mapLoadState = 'unavailable';
      mapMsg('Maps could not be loaded. Check the connection and refresh.');
      return;
    }
    registerMaps(reg.value.items as unknown as MapCatalogInput[]);
    // Only client-visible, published maps belong in the presentation picker.
    maps = reg.value.items
      .filter((m) => m.published && !m.hidden)
      .map((m) => getMap(m.id))
      .filter((m): m is MapEntry => !!m);
    if (!maps.length) { mapLoadState = 'unavailable'; mapMsg('No maps are published yet.'); return; }
    mapLoadState = 'ready';
    if (!activeMapId || !maps.some((m) => m.id === activeMapId)) activeMapId = pickDefaultMapId();
    void loadSavedSets(activeMapId);
    renderTopbar();
    renderMapControls();
    await applyMap();
  }

  // ── interaction (single delegated listener) ───────────────
  const onClick = (ev: Event) => {
    const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    const act = t.dataset.act;
    switch (act) {
      case 'back': {
        // Close an open overlay first (stays in the presentation, keeps
        // fullscreen); otherwise return to the dealer surface. Never exposes
        // dealer-private routes beyond a normal same-origin history entry.
        if (selectedPropertyId) { selectedPropertyId = null; renderMapControls(); break; }
        if (selectedSectorId) { selectedSectorId = null; view = 'sectors'; renderTopbar(); renderMapControls(); break; }
        if (overlay && overlay.selection().length) { activeSetIndex = -1; overlay.clear(); renderMapControls(); break; }
        if (mapsOpen) { mapsOpen = false; renderTopbar(); break; }
        if (view !== 'masterplan') { view = 'masterplan'; renderTopbar(); renderMapControls(); void applyMap(); break; }
        if (hasSafeInAppHistory()) window.history.back();
        else window.location.assign('/admin/owner.html');
        break;
      }
      case 'toggle-maps': mapsOpen = !mapsOpen; renderTopbar(); break;
      case 'pick-map': {
        if (t.dataset.id === activeMapId) { mapsOpen = false; renderTopbar(); break; }
        activeMapId = t.dataset.id!; mapsOpen = false; mode = 'original';
        activeSetIndex = -1; pendingSpotQuery = null;
        view = 'masterplan'; // show the chosen map on the main stage
        void loadSavedSets(activeMapId);
        renderTopbar(); renderMapControls(); void applyMap(); break;
      }
      case 'open-sec': {
        selectedSectorId = t.dataset.id!;
        selectedPropertyId = null;
        sectorMode = 'original';
        renderMapControls();
        break;
      }
      case 'open-prop': {
        selectedPropertyId = t.dataset.id!;
        selectedSectorId = null;
        propertyShot = 0;
        renderMapControls();
        break;
      }
      case 'view': {
        selectedPropertyId = null; selectedSectorId = null; view = t.dataset.view as View; mapsOpen = false;
        renderTopbar(); renderMapControls();
        if (view === 'masterplan') void applyMap();
        break;
      }
      case 'close-prop': selectedPropertyId = null; renderMapControls(); break;
      case 'close-sec': selectedSectorId = null; view = 'sectors'; renderTopbar(); renderMapControls(); break;
      case 'prop-prev': propertyShot = (propertyShot + 5) % 6; renderDetail(); break;
      case 'prop-next': propertyShot = (propertyShot + 1) % 6; renderDetail(); break;
      case 'prop-shot': propertyShot = Number(t.dataset.index || 0); renderDetail(); break;
      case 'prop-plan': {
        // View this property on its masterplan: switch to the linked map, pin
        // it, and spotlight its sector (property-linked highlighting).
        const property = props.find((item) => item.id === selectedPropertyId);
        selectedPropertyId = null; selectedSectorId = null; view = 'masterplan'; mode = 'original';
        if (property) {
          pinned.add(property.id);
          const targetMapId = property.mapPlacement?.mapId;
          const sameMap = !targetMapId || targetMapId === activeMapId;
          if (!sameMap && maps.some((m) => m.id === targetMapId)) {
            activeMapId = targetMapId!; activeSetIndex = -1; void loadSavedSets(activeMapId);
          }
          pendingSpotQuery = property.sector || property.area || null;
          renderTopbar(); renderMapControls();
          if (sameMap) { void ensureOverlay(); if (activeMapId) void applyMap(); }
          else void applyMap();
        } else { renderTopbar(); renderMapControls(); void applyMap(); }
        break;
      }
      case 'prop-sector': selectedPropertyId = null; selectedSectorId = t.dataset.id || null; sectorMode = 'original'; renderMapControls(); break;
      case 'sector-to-plan': {
        // Return from a sector layout to its parent masterplan, highlighting it.
        const sector = SECTORS.find((s) => s.id === selectedSectorId);
        selectedSectorId = null; view = 'masterplan'; mode = 'original';
        if (sector) {
          const parent = maps.find((m) => m.kind === 'masterplan' && m.city === sector.city);
          if (parent && parent.id !== activeMapId) { activeMapId = parent.id; activeSetIndex = -1; void loadSavedSets(activeMapId); }
          pendingSpotQuery = sector.name;
        }
        renderTopbar(); renderMapControls(); void applyMap();
        break;
      }
      case 'sector-mode': sectorMode = t.dataset.mode === 'threeD' ? 'threeD' : 'original'; renderDetail(); break;
      case 'mode':
      case 'mode-toggle': {
        if ((t as HTMLButtonElement).disabled) break;
        const m = maps.find((x) => x.id === activeMapId);
        // Combined button flips Original ↔ 3D; legacy 'mode' honors data-mode.
        const next: RenderMode = act === 'mode-toggle'
          ? (mode === 'original' ? 'threeD' : 'original')
          : (t.dataset.mode as RenderMode);
        if (next === 'threeD' && !m?.threeD) break;
        if (next === mode) break;
        mode = next;
        // The overlay selection is preserved; the SVG is simply hidden on 3D
        // and restored on Original.
        renderMapControls();
        void mounted!.engine.setMode(mode).then(() => { if (view === 'masterplan') mounted!.engine.cover(); applyHighlights(); });
        break;
      }
      case 'rail-hide': railHidden = true; renderMapControls(); break;
      case 'rail-show': railHidden = false; renderMapControls(); break;
      case 'fit': mounted!.engine.fit(); break;
      case 'cycle-set': cycleSet(); break;
      case 'hl-clear': activeSetIndex = -1; overlay?.clear(); renderMapControls(); break;
      case 'zoom-in': mounted!.engine.zoom(1.3); break;
      case 'zoom-out': mounted!.engine.zoom(1 / 1.3); break;
      case 'clear-pins': pinned.clear(); renderMapControls(); renderRail(); break;
      case 'pin': {
        const id = t.dataset.id!;
        const prop = props.find((p) => p.id === id);
        const placedMap = prop?.mapPlacement?.mapId;
        if (pinned.has(id)) { pinned.delete(id); }
        else {
          pinned.add(id);
          // Show the pin where it actually lives: switch to its map if needed.
          if (placedMap && placedMap !== activeMapId && maps.some((m) => m.id === placedMap)) {
            activeMapId = placedMap; mode = 'original'; activeSetIndex = -1; view = 'masterplan'; void loadSavedSets(placedMap);
            renderTopbar(); renderMapControls(); void applyMap(); renderRail(); break;
          }
        }
        if (view !== 'masterplan') { view = 'masterplan'; renderTopbar(); }
        renderMapControls(); renderRail(); break;
      }
    }
  };
  container.addEventListener('click', onClick);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (selectedPropertyId) { selectedPropertyId = null; renderMapControls(); return; }
    if (selectedSectorId) { selectedSectorId = null; view = 'sectors'; renderTopbar(); renderMapControls(); return; }
    if (mapsOpen) { mapsOpen = false; renderTopbar(); }
  };
  document.addEventListener('keydown', onKey);

  const onTabKey = (e: KeyboardEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    if (!target || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const current = VIEWS.findIndex((item) => item.k === target.dataset.view);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? VIEWS.length - 1
      : (current + (e.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length;
    view = VIEWS[next]!.k;
    renderTopbar(); renderMapControls();
    topbar.querySelector<HTMLElement>(`[data-view="${view}"]`)?.focus();
  };
  container.addEventListener('keydown', onTabKey);

  const onDocClick = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (mapsOpen && !el.closest('.pm-mapbtn, .pm-pop')) { mapsOpen = false; renderTopbar(); }
  };
  document.addEventListener('click', onDocClick, true);

  // ── initial paint ─────────────────────────────────────────
  renderTopbar();
  renderMapControls();
  renderRail();
  mapMsg('Loading maps…');
  // Catalog drives the first map render (no pilot placeholder).
  void loadCatalog();

  // load published plots (client-safe: price never read)
  const res = await adapter.properties.list({ limit: 24 }, { signal: controller.signal });
  if (res.ok) {
    props = res.value.items.filter((p) => p.published && !p.sold);
    loadState = props.length ? 'ready' : 'empty';
  } else if (res.error.code !== 'aborted') {
    loadState = 'error';
  }
  renderRail();
  syncPins();

  // ── cleanup ───────────────────────────────────────────────
  const cleanup = () => {
    cancelAnimationFrame(animFrame);
    container.removeEventListener('click', onClick);
    container.removeEventListener('keydown', onTabKey);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onDocClick, true);
    controller.abort();
    fsCleanup();
    overlay?.destroy();
    overlay = null;
    mounted?.dispose();
    mounted = null;
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  return cleanup;
}

const app = document.getElementById('app');
if (app) void initPresentation(app);
