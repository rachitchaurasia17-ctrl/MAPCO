/* ═══════════════════════════════════════════════════════════════
   MAPCO EARTH — standalone feature (real Google-powered experience)
   ---------------------------------------------------------------
   "Google Earth rebuilt for a property dealer."  This iteration adds
   the Location Advantage engine: a dealer opens a property, taps
   LOCATION ADVANTAGE, and MAPCO instantly shows the 6–7 things that
   make the spot valuable — pinned, labelled, and route-connected.

   • one live Google satellite map instance, focused/flown
   • search-first (MAPCO inventory + Google Places New) — no separate
     "jump to area"; empty search offers quick destinations
   • clean property card with DETAILS | LOCATION ADVANTAGE
   • Location Advantage: Places-discovered advantages, MAPCO context
     pins + auto labels, tap-to-route (Routes API) with drive time
   • universal Street View: a MAPCO tool, click anywhere on the map
   • pin → drag → save location (canonical property repository)

   Design source of truth: approved "MAPCO Earth.dc.html".
   Property geography is wired through the shared MAPCO data adapter.
   ═══════════════════════════════════════════════════════════════ */
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import './earth.css';
import {
  hasGoogleConfig, loadGoogleMaps, importMapsLibrary,
  GOOGLE_MAPS_MAP_ID,
} from '../../packages/maps/google-loader';
import {
  DEFAULT_CENTER, DEFAULT_ZOOM, FOCUS_ZOOM,
  JUMP_AREAS, SEARCH_INDEX,
  allProperties, placesStore, locationSource,
  type Property, type LatLng, type SearchEntry, type PlaceKind,
} from './config';
import { productRoutes, requestedPropertyId } from '../../packages/ui/product-routes';
import { showPlan, teardownPlan, resizePlan, loadPlanCatalog, sectorMaps } from './plan-maps';
import { openPropertyDetail } from './property-detail';
import {
  analyseLocation, intentOf, roadAdvantagesFor,
  type Advantage, type LocationIntel, type Section,
} from './location-advantage';
import {
  computeRoute, formatDistance, formatDuration, isRoutesApiDisabled, type RouteLeg,
} from './routes';
import { MAPCO_ANCHORS } from './intel/geo-data';
import { ROAD_SPECS } from './intel/road-network';
import { meter } from './intel/meter';
import {
  RoadLayer,
  globalRoadLayerItems,
  resolveRoadLayerMode,
} from './road-layer';

/* Load Phosphor icons (self-hosted, matches the rest of MAPCO). */
['/assets/phosphor/regular/style.css', '/assets/phosphor/fill/style.css', '/assets/phosphor/bold/style.css']
  .forEach((href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
  });

type View = 'earth' | 'map' | 'masterplan' | '3d';
/** Earth and Map are the SAME Google map instance, different basemap. */
const isLiveMapView = (v: View) => v === 'earth' || v === 'map';
type AddMode = null | 'place' | 'relocate';
type CardTab = 'details' | 'advantage';

const KMETA: Record<PlaceKind, { icon: string; bed: string; fg: string }> = {
  plot: { icon: 'ph-fill ph-map-pin', bed: '#fff3d1', fg: '#8a5a0c' },
  sector: { icon: 'ph-fill ph-square-half', bed: '#efe8fb', fg: '#5b32c4' },
  project: { icon: 'ph-fill ph-buildings', bed: '#dcf3e5', fg: '#1f4d3a' },
  landmark: { icon: 'ph-fill ph-flag-banner', bed: '#ffe1e6', fg: '#b23a56' },
  place: { icon: 'ph-fill ph-map-pin-area', bed: '#efe8fb', fg: '#5b32c4' },
};

interface State {
  view: View;
  selId: string | null;
  photoIdx: number;
  cardTab: CardTab;
  panelOpen: boolean;
  searchOpen: boolean;
  addMode: AddMode;
  relocateFor: string | null;
  svSelect: boolean;      // universal Street View pick mode
  activeAdvId: string | null;
  laLoading: boolean;     // Location Advantage discovery in flight
  laContext: Section;     // which of the three contexts is shown
  roadsOn: boolean;       // global Roads layer
  /** Sector/masterplan sheet chosen from the Sector picker; null = default. */
  planMapId: string | null;
  sectorOpen: boolean;    // the Sector maps picker
}

const state: State = {
  view: 'earth', selId: null, photoIdx: 0, cardTab: 'details',
  panelOpen: false, searchOpen: false,
  addMode: null, relocateFor: null, svSelect: false, activeAdvId: null, laLoading: false,
  laContext: 'around', roadsOn: false, planMapId: null, sectorOpen: false,
};
const requestedProperty = requestedPropertyId(window.location.search);

/* ── Google objects (populated lazily) ─────────────────────────── */
let map: any = null;
let AdvancedMarkerElement: any = null;
let placesLib: any = null;
let streetViewService: any = null;
let panorama: any = null;
let mapReady = false;
let roadLayer: RoadLayer | null = null;

const propMarkers = new Map<string, { marker: any; root: HTMLElement }>();
const placeMarkers = new Map<string, { marker: any; root: HTMLElement }>();
const advMarkers = new Map<string, { marker: any; root: HTMLElement }>();
let addMarker: any = null;
let routeGlow: any = null;
let routeCore: any = null;
let currentIntel: LocationIntel | null = null;
let currentAdvantages: Advantage[] = [];        // the section currently listed
let currentRoadNetwork: Advantage[] = [];
let currentRoadPropertyId: string | null = null;
const GLOBAL_ROAD_ITEMS = globalRoadLayerItems(ROAD_SPECS);
const routeCache = new Map<string, RouteLeg>(); // advId → computed route (per property)

/* ── DOM refs ──────────────────────────────────────────────────── */
const $ = (id: string) => document.getElementById(id)!;
let toastTimer: number | undefined;

/* ═══════════════════════════════════════════════════════════════
   SHELL
   ═══════════════════════════════════════════════════════════════ */
export function earthShellHtml(): string {
  return `
<div class="e-root">
  <div class="e-map" id="e-map"></div>
  <div class="e-vignette"></div>

  <div class="e-status" id="e-status"><div class="e-status-inner" id="e-status-inner"></div></div>

  <!-- masterplan / 3d overlay -->
  <div id="e-plan" style="display:none"></div>

  <!-- top bar -->
  <div class="e-top">
    <div class="e-top-left">
      <div class="e-brandrow">
        <!-- The brand IS the way back. No separate back control. -->
        <a class="e-brand e-glass" id="e-brand" href="${productRoutes.home}" aria-label="Back to MAPCO">
          <img class="e-brand-logo" src="/assets/mapco-logo.png" alt="" width="30" height="30"/>
          <div class="e-brand-text">
            <div class="e-brand-name">MAPCO</div>
            <div class="e-brand-sub">EARTH</div>
          </div>
          <i class="ph-bold ph-arrow-left e-brand-back" aria-hidden="true"></i>
        </a>
        <div class="e-browse" id="e-browse" role="toolbar" aria-label="Browse">
          <button class="e-sheetbtn" id="e-open-props" type="button"><i class="ph-fill ph-squares-four"></i><span>Properties</span></button>
          <button class="e-sheetbtn" id="e-open-sectors" type="button"><i class="ph-fill ph-map-trifold"></i><span>Sector</span></button>
        </div>
      </div>

      <div class="e-searchwrap">
        <div class="e-searchbox">
          <i class="ph ph-magnifying-glass" style="font-size:16px;color:#8d8271"></i>
          <input id="e-search" type="text" autocomplete="off" spellcheck="false"
                 placeholder="Search plot, sector, project or place…" aria-label="Search MAPCO Earth"/>
          <i class="ph ph-x e-clear" id="e-clear" style="display:none" title="Clear"></i>
        </div>
        <div class="e-results escroll" id="e-results" style="display:none"></div>
      </div>
      <div class="e-tools" id="e-tools" role="toolbar" aria-label="Map tools">
        <div class="e-tool e-tool--sv" id="e-svbtn" role="button" tabindex="0" aria-pressed="false" title="Street View">
          <i class="ph-fill ph-person-simple-walk"></i><span class="e-tool-label">Street View</span>
        </div>
        <div class="e-tool e-tool--roads" id="e-roads" role="button" tabindex="0" aria-pressed="false" title="Show MAPCO roads">
          <i class="ph-fill ph-road-horizon"></i><span class="e-tool-label">Roads</span>
        </div>
      </div>
    </div>

    <div class="e-topright">
      <div class="e-views" id="e-views"></div>
    </div>
  </div>

  <!-- Properties / Sector browse sheets -->
  <div id="e-sheet" style="display:none"></div>

  <!-- Browse openers moved to top left -->

  <!-- my properties -->
  <div class="e-mine">
    <div id="e-minepanel" style="display:none"></div>
    <div class="e-mine-btn" id="e-minebtn">
      <i class="ph-fill ph-stack-simple" style="font-size:19px;color:#ffc93c"></i>My properties
      <span class="e-count" id="e-minecount">0</span>
    </div>
  </div>

  <!-- controls — deliberately minimal: pinch/wheel handles zoom -->
  <div class="e-controls">
    <div class="e-ctl e-ctl--light" id="e-recenter" title="Reset view"><i class="ph-fill ph-crosshair" style="font-size:20px"></i></div>
  </div>

  <div id="e-cardwrap"></div>
  <div id="e-pickhint"></div>
  <div id="e-addhint"></div>
  <div id="e-addbar"></div>
  <div id="e-sv"></div>
  <div id="e-toastwrap"></div>
</div>`;
}

function renderShell(container: HTMLElement): void {
  container.innerHTML = earthShellHtml();
  renderViews();
  renderMineButton();
  wireStaticEvents();
  wireSheetButtons();
}

/* ═══════════════════════════════════════════════════════════════
   BROWSE SHEETS — Properties and Sector maps
   Source: Client Presentation.dc.html lines 154–185 (isProps) and
   187–215 (isSectors). Client-safe: no price, seller or internals.
   ═══════════════════════════════════════════════════════════════ */
type Sheet = null | 'props' | 'sectors';
let sheet: Sheet = null;
let sheetCity = 'all';

function wireSheetButtons(): void {
  $('e-open-props').addEventListener('click', () => openSheet('props'));
  $('e-open-sectors').addEventListener('click', () => openSheet('sectors'));
}

function openSheet(next: Sheet): void {
  sheet = sheet === next ? null : next;
  sheetCity = 'all';
  if (sheet) {
    state.selId = null; // hide sidebar if opening sheet
  }
  closeSearch();
  document.querySelector('.e-root')?.classList.toggle('e-root--sheet', !!sheet);
  void renderSheet();
  renderCard();
}

/** Dismiss any open browse sheet without re-rendering the map views. */
function closeSheets(): void {
  if (!sheet) return;
  sheet = null;
  document.querySelector('.e-root')?.classList.remove('e-root--sheet');
  void renderSheet();
  renderCard();
}

const chip = (label: string, count: number, on: boolean): string =>
  `<button data-chip="${escapeHtml(label)}" style="display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:999px;border:none;cursor:pointer;font:800 14px 'Hanken Grotesk',sans-serif;letter-spacing:.01em;${
    on ? 'background:#1c1533;color:#fff8e6' : 'background:rgba(255,253,249,.86);color:#4a4160;box-shadow:inset 0 0 0 1px rgba(139,96,232,.22)'
  }">${escapeHtml(label)}<span style="font-variant-numeric:tabular-nums;font-size:12.5px;${on ? 'color:#c8b9f5' : 'color:#8a7fae'}">${count}</span></button>`;

const SHEET_WRAP = 'position:absolute;inset:0;overflow-y:auto;z-index:40;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)';

async function renderSheet(): Promise<void> {
  const host = $('e-sheet');
  if (!sheet) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = 'block';

  // Bottom-right: clear of the top bar's view tabs and of the recenter
  // control, so the sheet never covers Earth's own chrome.
  
  if (sheet === 'props') {
    const all = allProperties();
    const cities = [...new Set(all.map((p) => p.city).filter(Boolean))];
    const shown = sheetCity === 'all' ? all : all.filter((p) => p.city === sheetCity);
    host.innerHTML = `<div data-scroll style="${SHEET_WRAP}"><div style="max-width:1260px;margin:0 auto;padding:84px 34px 56px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${chip('All', all.length, sheetCity === 'all')}
        ${cities.map((c) => chip(c, all.filter((p) => p.city === c).length, sheetCity === c)).join('')}
      </div>
      ${shown.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(298px,1fr));gap:20px;margin-top:22px">
        ${shown.map((p) => {
          const shot = p.photos[0] || '';
          return `<button data-prop="${escapeHtml(p.id)}" style="min-width:0;display:block;padding:0;border:none;cursor:pointer;text-align:left;border-radius:22px;overflow:hidden;background:rgba(255,253,249,.96);box-shadow:0 0 0 1px rgba(139,96,232,.16),0 3px 4px rgba(40,26,2,.05),0 30px 54px -34px rgba(139,96,232,.5);transition:transform .28s cubic-bezier(.2,.8,.2,1),box-shadow .28s ease" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='none'">
            <span style="position:relative;display:block;overflow:hidden">
              <span style="display:block;height:186px;${shot ? `background-image:url('${escapeHtml(shot)}');background-size:cover;background-position:center` : 'background:#efe8fb'}"></span>
              <span style="position:absolute;top:13px;left:13px;display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:8px;background:rgba(28,21,51,.72);backdrop-filter:blur(10px);font-size:12px;font-weight:800;letter-spacing:.02em;font-variant-numeric:tabular-nums;color:#fff8e6">${escapeHtml(p.size)}</span>
              <span style="position:absolute;right:13px;bottom:13px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(255,253,249,.95);box-shadow:0 2px 8px -3px rgba(28,21,51,.4);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:#1c1533"><i class="ph-fill ph-images" style="font-size:13px"></i>${p.photos.length} photos</span>
            </span>
            <span style="display:block;padding:18px 20px 20px;text-align:left">
              <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.025em;color:#1c1533;line-height:1.06">${escapeHtml(p.plotNo)}</span>
              <span style="display:block;margin-top:5px;font-size:14px;font-weight:600;letter-spacing:.005em;color:#6f6489">${escapeHtml(p.sector)}</span>
              <span style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
                ${p.facing ? `<span style="padding:6px 11px;border-radius:8px;background:#fff2cd;box-shadow:inset 0 0 0 1px rgba(168,121,42,.22);font-size:12px;font-weight:800;letter-spacing:.02em;color:#8a5a0c">${escapeHtml(p.facing)} facing</span>` : ''}
                ${p.road ? `<span style="padding:6px 11px;border-radius:8px;background:#e0f2e7;box-shadow:inset 0 0 0 1px rgba(20,108,58,.2);font-size:12px;font-weight:800;letter-spacing:.02em;color:#146c3a">${escapeHtml(p.road)}</span>` : ''}
              </span>
              <span style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:14.5px;font-weight:800;letter-spacing:.01em;color:#8a5a0c">See everything <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
            </span>
          </button>`;
        }).join('')}
      </div>` : `<div style="margin-top:22px;padding:40px;text-align:center;border-radius:20px;background:rgba(255,253,249,.8);color:#6f6489;font-size:15px">No properties here yet.</div>`}
    </div></div>`;
  } else {
    await loadPlanCatalog();
    const maps = sectorMaps();
    const cities = [...new Set(maps.map((m) => m.city).filter(Boolean))];
    const shown = sheetCity === 'all' ? maps : maps.filter((m) => m.city === sheetCity);
    const plotsOn = (mapId: string): number =>
      allProperties().filter((p) => p.canonicalRecord?.mapPlacement?.mapId === mapId).length;
    host.innerHTML = `<div data-scroll style="${SHEET_WRAP}"><div style="max-width:1260px;margin:0 auto;padding:84px 34px 56px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${chip('All', maps.length, sheetCity === 'all')}
        ${cities.map((c) => chip(c, maps.filter((m) => m.city === c).length, sheetCity === c)).join('')}
      </div>
      ${shown.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:20px;margin-top:22px">
        ${shown.map((m) => {
          const plots = plotsOn(m.id);
          return `<button data-sector="${escapeHtml(m.id)}" style="min-width:0;display:block;padding:0;border:none;cursor:pointer;text-align:left;border-radius:22px;overflow:hidden;background:rgba(255,253,249,.96);box-shadow:0 0 0 1px rgba(139,96,232,.16),0 3px 4px rgba(40,26,2,.05),0 30px 54px -34px rgba(107,63,212,.55);transition:transform .28s cubic-bezier(.2,.8,.2,1)" onmouseover="this.style.transform='translateY(-8px)'" onmouseout="this.style.transform='none'">
            <span style="position:relative;display:block;height:172px;overflow:hidden">
              <span style="display:block;height:100%;background-image:url('${escapeHtml(m.original.src)}');background-size:cover;background-position:center"></span>
              <span style="position:absolute;top:13px;left:13px;display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:8px;background:rgba(28,21,51,.72);backdrop-filter:blur(10px);font-size:12px;font-weight:800;letter-spacing:.02em;color:#fff8e6">${escapeHtml(m.city)}</span>
              ${plots ? `<span style="position:absolute;right:13px;bottom:13px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:6px 12px;border-radius:999px;background:#ffc21e;box-shadow:0 2px 8px -3px rgba(120,86,10,.6);font-size:12px;font-weight:800;color:#231a04"><i class="ph-fill ph-map-pin-area" style="font-size:13px"></i>${plots} plot${plots === 1 ? '' : 's'}</span>` : ''}
            </span>
            <span style="display:block;padding:18px 20px 20px;text-align:left">
              <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.025em;color:#1c1533;line-height:1.06">${escapeHtml(m.title)}</span>
              <span style="display:block;margin-top:5px;font-size:14px;font-weight:600;color:#6f6489">${escapeHtml(m.sectorOrBlock || m.city)}</span>
              <span style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:15px;font-weight:800;color:#8a5a0c">Open the layout <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
            </span>
          </button>`;
        }).join('')}
      </div>` : `<div style="margin-top:22px;padding:40px;text-align:center;border-radius:20px;background:rgba(255,253,249,.8);color:#6f6489;font-size:15px">No sector maps are published yet.</div>`}
    </div></div>`;
  }

  host.querySelectorAll<HTMLElement>('[data-chip]').forEach((el) => {
    el.addEventListener('click', () => {
      sheetCity = el.dataset.chip === 'All' ? 'all' : (el.dataset.chip ?? 'all');
      void renderSheet();
    });
  });
  host.querySelectorAll<HTMLElement>('[data-prop]').forEach((el) => {
    el.addEventListener('click', () => {
      const property = allProperties().find((candidate) => candidate.id === el.dataset.prop);
      if (property) openPropertyDetail(property);
    });
  });
  host.querySelectorAll<HTMLElement>('[data-sector]').forEach((el) => {
    el.addEventListener('click', () => {
      state.planMapId = el.dataset.sector ?? null;
      openSheet(null);
      setView('masterplan');
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAP (single instance, lazily created)
   ═══════════════════════════════════════════════════════════════ */
async function ensureMap(): Promise<void> {
  if (mapReady || !hasGoogleConfig()) return;
  setStatus('loading');
  try {
    await loadGoogleMaps();
    const { Map } = await importMapsLibrary<any>('maps');
    const markerLib = await importMapsLibrary<any>('marker');
    AdvancedMarkerElement = markerLib.AdvancedMarkerElement;

    map = new Map($('e-map'), {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapId: GOOGLE_MAPS_MAP_ID || undefined,
      mapTypeId: 'hybrid',
      tilt: 0,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      keyboardShortcuts: false,
    });

    map.addListener('click', onMapClick);
    map.addListener('dragstart', () => closeSearch());
    map.addListener('zoom_changed', applyZoomDeclutter);
    roadLayer = new RoadLayer(map, AdvancedMarkerElement);

    meter('maps.dynamic', 1, { note: 'map load' });
    hideStatus();
    mapReady = true;
    renderPropMarkers();
    if (state.roadsOn) syncRoadLayerForContext();
    // NOTE: important-place pins are deliberately NOT drawn by default.
    // A default Earth view must be clean — no field of context markers.
    renderMineButton();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    setStatus(reason === 'missing-api-key' ? 'no-key' : 'error', reason);
  }
}

/** Padding that keeps a target clear of the right-hand card / bottom sheet. */
function cardPadding(): { top: number; right: number; bottom: number; left: number } {
  return window.innerWidth > 720
    ? { top: 90, right: 440, bottom: 60, left: 60 }
    : { top: 80, right: 30, bottom: Math.round(window.innerHeight * 0.5), left: 30 };
}

function flyTo(pos: LatLng, zoom: number, offsetForCard = false): void {
  if (!map) return;
  map.panTo(pos);
  map.setZoom(zoom);
  if (offsetForCard && window.innerWidth > 720) window.setTimeout(() => map.panBy(210, 0), 60);
}

/* ═══════════════════════════════════════════════════════════════
   PROPERTY + PLACE MARKERS
   ═══════════════════════════════════════════════════════════════ */
function buildPin(kind: 'prop' | 'place' | 'add', label: string, selected: boolean): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'e-pin' + (kind === 'prop' ? ' e-pin-prop' : '') + (kind === 'place' ? ' e-pin-place' : '') + (kind === 'add' ? ' e-pin-add' : '') + (selected ? ' e-pin--sel' : '');
  const icon = kind === 'place' ? 'ph-fill ph-flag-banner' : 'ph-fill ph-house-line';
  wrap.innerHTML =
    `<div class="e-pin-pill"><span class="e-pin-badge"><span class="${icon}" style="font-size:13px"></span></span>` +
    `<span>${escapeHtml(label)}</span></div><div class="e-pin-stem"></div><div class="e-pin-ground"></div>`;
  return wrap;
}

function renderPropMarkers(): void {
  if (!mapReady) return;
  for (const [id, m] of propMarkers) {
    if (!allProperties().some((p) => p.id === id)) { m.marker.map = null; propMarkers.delete(id); }
  }
  for (const p of allProperties()) {
    const selected = p.id === state.selId;
    const pos = geographicOriginForProperty(p);
    const existing = propMarkers.get(p.id);
    if (!pos) {
      if (existing) { existing.marker.map = null; propMarkers.delete(p.id); }
      continue;
    }
    if (existing) {
      existing.marker.position = pos;
      existing.root.className = 'e-pin' + (selected ? ' e-pin--sel' : '');
      existing.marker.zIndex = selected ? 3000 : 2000;
      continue;
    }
    const rootEl = buildPin('prop', p.tag, selected);
    const marker = new AdvancedMarkerElement({ map, position: pos, content: rootEl, zIndex: selected ? 3000 : 2000, gmpClickable: true });
    marker.addListener('gmp-click', () => selectProperty(p.id));
    propMarkers.set(p.id, { marker, root: rootEl });
  }
}

function renderPlaceMarkers(): void {
  if (!mapReady) return;
  const all = placesStore.all();
  for (const [id, m] of placeMarkers) {
    if (!all.some((pl) => pl.id === id)) { m.marker.map = null; placeMarkers.delete(id); }
  }
  for (const pl of all) {
    if (placeMarkers.has(pl.id)) continue;
    const rootEl = buildPin('place', pl.name, false);
    const marker = new AdvancedMarkerElement({ map, position: pl.pos, content: rootEl, zIndex: 1500, gmpClickable: true });
    marker.addListener('gmp-click', () => { flyTo(pl.pos, 16); showToast(pl.name); });
    placeMarkers.set(pl.id, { marker, root: rootEl });
  }
}

/* ═══════════════════════════════════════════════════════════════
   VIEW TOGGLE (Earth / Masterplan / 3D)
   ═══════════════════════════════════════════════════════════════ */
export const EARTH_VIEW_MODES: { k: View; label: string; icon: string }[] = [
  { k: 'earth', label: 'Earth', icon: 'ph-fill ph-globe-hemisphere-east' },
  { k: 'map', label: 'Map', icon: 'ph-fill ph-map-pin-area' },
  { k: 'masterplan', label: 'Masterplan', icon: 'ph-fill ph-map-trifold' },
  { k: '3d', label: '3D', icon: 'ph-fill ph-cube' },
];
function renderViews(): void {
  $('e-views').innerHTML = EARTH_VIEW_MODES.map((v) =>
    `<div class="e-view ${v.k === state.view ? 'on' : ''}" data-view="${v.k}"><span class="${v.icon} i" style="font-size:16px"></span><span>${v.label}</span></div>`,
  ).join('');
  $('e-views').querySelectorAll<HTMLElement>('.e-view').forEach((el) => {
    el.addEventListener('click', () => setView(el.dataset.view as View));
  });
}
function setView(v: View): void {
  const wasLive = isLiveMapView(state.view);
  state.view = v;
  closeSearch();
  // Picking a map view leaves any open browse sheet — the view tabs are the
  // way out of Properties/Sector, exactly as in the presentation design.
  closeSheets();

  // Earth ↔ Map is a basemap swap on the SAME instance: camera, markers,
  // property card, Location Advantage and overlays all survive untouched.
  if (isLiveMapView(v)) {
    if (map) map.setMapTypeId(v === 'earth' ? 'hybrid' : 'roadmap');
    document.querySelector('.e-root')?.classList.toggle('e-root--map', v === 'map');
  } else {
    laDeactivate();
  }

  renderViews();
  renderPlanOverlay();
  renderCard();
  renderMinePanel();
  renderControls();
  // returning from Masterplan/3D with the Advantage tab open → rebuild (cached, instant)
  if (isLiveMapView(v) && !wasLive && state.selId && state.cardTab === 'advantage') void laActivate();
}
function renderPlanOverlay(): void {
  const plan = $('e-plan');
  if (isLiveMapView(state.view)) {
    plan.style.display = 'none';
    // Free the raster engine, its listeners and cached imagery while the
    // live Google map is the visible surface.
    teardownPlan(plan);
    return;
  }
  plan.style.display = 'block';
  // The real authored masterplan / 3D sheets, rendered by the shared map
  // engine. A specific sector sheet can be requested from the Sector picker.
  void showPlan(plan, state.view === '3d' ? 'threeD' : 'masterplan', state.planMapId ?? undefined);
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH  (single entry: MAPCO local index + Google Places New)
   ═══════════════════════════════════════════════════════════════ */
function buildLocalIndex(): SearchEntry[] {
  const propertyEntries: SearchEntry[] = allProperties().map((p) => ({
    kind: 'plot', label: `${p.tag} · ${p.plotNo}`, sub: `${p.sector} · your inventory`, pid: p.id,
  }));
  const placeEntries: SearchEntry[] = placesStore.all().map((pl) => ({
    kind: 'place', label: pl.name, sub: 'Important place', pos: pl.pos, zoom: 16,
  }));
  // MAPCO already knows the Tri-City's roads and major anchors —
  // never pay Google to rediscover them.
  const roadEntries: SearchEntry[] = ROAD_SPECS.map((r) => ({
    kind: 'landmark', label: r.name, sub: r.connects,
    pos: r.path[Math.floor(r.path.length / 2)], zoom: 14,
  }));
  const anchorEntries: SearchEntry[] = MAPCO_ANCHORS.map((a) => ({
    kind: 'project', label: a.name, sub: 'Known landmark', pos: a.pos, zoom: 16,
  }));
  return [
    ...propertyEntries,
    ...SEARCH_INDEX.filter((entry) => !entry.pid),
    ...placeEntries,
    ...roadEntries,
    ...anchorEntries,
  ];
}
/** Quick destinations shown when the search is opened without a query. */
function quickEntries(): SearchEntry[] {
  return JUMP_AREAS.map((a) => ({ kind: 'sector', label: a.label, sub: a.sub ?? 'Area', pos: a.pos, zoom: a.zoom }));
}

let searchSeq = 0;
async function onSearchInput(): Promise<void> {
  const input = $('e-search') as HTMLInputElement;
  const q = input.value.trim();
  ($('e-clear')).style.display = q ? 'block' : 'none';
  state.searchOpen = true;
  const seq = ++searchSeq;

  if (!q) { renderResults(quickEntries(), [], '', 'Quick destinations'); return; }

  const ql = q.toLowerCase();
  const local = buildLocalIndex().filter((s) => (s.label + ' ' + s.sub).toLowerCase().includes(ql)).slice(0, 7);
  renderResults(local, [], q);

  if (q.length < 3) return;
  const google = await fetchGooglePlaces(q).catch(() => []);
  if (seq !== searchSeq) return;
  renderResults(local, google, q);
}

interface GResult { label: string; sub: string; placeId: string; }
let autocompleteSession: any = null;
async function fetchGooglePlaces(input: string): Promise<GResult[]> {
  if (!hasGoogleConfig()) return [];
  if (!placesLib) placesLib = await importMapsLibrary<any>('places');
  const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLib;
  if (!AutocompleteSuggestion) return [];
  // Proper session token: predictions + the eventual details call bill as one session.
  if (!autocompleteSession) autocompleteSession = new AutocompleteSessionToken();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input, sessionToken: autocompleteSession, includedRegionCodes: ['in'],
    locationBias: { center: DEFAULT_CENTER, radius: 40000 },
  });
  meter('places.autocomplete', 1, { note: 'session' });
  return (suggestions || [])
    .map((s: any) => s.placePrediction).filter(Boolean).slice(0, 5)
    .map((p: any) => ({
      label: p.mainText?.text || p.text?.text || 'Place',
      sub: p.secondaryText?.text || 'Google place',
      placeId: p.placeId,
    }));
}

function renderResults(local: SearchEntry[], google: GResult[], q: string, localHead = 'MAPCO'): void {
  const box = $('e-results');
  if (!state.searchOpen) { box.style.display = 'none'; return; }
  if (!local.length && !google.length) {
    box.innerHTML = `<div class="e-res-empty">No matches for “${escapeHtml(q)}”.<br>Try a plot number, sector, project or place.</div>`;
    box.style.display = 'block'; return;
  }
  let html = '';
  if (local.length) {
    html += `<div class="e-res-head">${escapeHtml(localHead)}</div>`;
    html += local.map((s, i) => {
      const m = KMETA[s.kind];
      return `<div class="e-res" data-kind="local" data-i="${i}">
        <div class="e-res-ic" style="background:${m.bed};color:${m.fg}"><span class="${m.icon}" style="font-size:20px"></span></div>
        <div style="min-width:0;flex:1"><div class="e-res-label">${escapeHtml(s.label)}</div><div class="e-res-sub">${escapeHtml(s.sub)}</div></div>
        <span class="ph-bold ph-arrow-up-right" style="font-size:15px;color:#b8ab98"></span></div>`;
    }).join('');
  }
  if (google.length) {
    html += `<div class="e-res-head">Google places</div>`;
    html += google.map((g, i) =>
      `<div class="e-res" data-kind="google" data-i="${i}">
        <div class="e-res-ic" style="background:#eef3ff;color:#3a66c4"><span class="ph-fill ph-map-pin" style="font-size:20px"></span></div>
        <div style="min-width:0;flex:1"><div class="e-res-label">${escapeHtml(g.label)}</div><div class="e-res-sub">${escapeHtml(g.sub)}</div></div>
        <span class="ph-bold ph-arrow-up-right" style="font-size:15px;color:#b8ab98"></span></div>`).join('');
  }
  box.innerHTML = html;
  box.style.display = 'block';
  box.querySelectorAll<HTMLElement>('.e-res').forEach((el) => {
    el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      if (el.dataset.kind === 'local') onPickLocal(local[i]); else onPickGoogle(google[i]);
    });
  });
}

function onPickLocal(s: SearchEntry): void {
  closeSearch();
  if (s.pid) { selectProperty(s.pid); return; }
  if (s.pos) {
    if (!isLiveMapView(state.view)) setView('earth');
    flyTo(s.pos, s.zoom ?? 15);
    showToast(s.label);
  }
}
async function onPickGoogle(g: GResult): Promise<void> {
  closeSearch();
  try {
    if (!placesLib) placesLib = await importMapsLibrary<any>('places');
    const place = new placesLib.Place({ id: g.placeId });
    await place.fetchFields({ fields: ['location', 'displayName', 'viewport'] });
    meter('places.details', 1, { note: 'search-pick' });
    autocompleteSession = null;                 // session closes on selection
    if (!isLiveMapView(state.view)) setView('earth');
    if (place.viewport && map) map.fitBounds(place.viewport);
    else if (place.location) flyTo({ lat: place.location.lat(), lng: place.location.lng() }, 16);
    showToast(place.displayName || g.label);
  } catch { showToast('Could not open that place'); }
}

/* ═══════════════════════════════════════════════════════════════
   PROPERTY SELECTION + CARD
   ═══════════════════════════════════════════════════════════════ */
function currentProp(): Property | null {
  return allProperties().find((p) => p.id === state.selId) ?? null;
}

/** The only property-origin read used by every Earth geographic consumer. */
export function geographicOriginForProperty(property: Property): LatLng | null {
  return locationSource.get(property.id);
}

function selectProperty(id: string): void {
  const p = allProperties().find((x) => x.id === id);
  if (!p) return;
  const keepRoads = state.roadsOn;
  laDeactivate();                         // start clean
  routeCache.clear();                     // routes are per-origin
  state.selId = id; state.photoIdx = 0; state.view = 'earth'; state.cardTab = 'details';
  state.roadsOn = keepRoads;
  state.panelOpen = false; state.addMode = null;
  window.history.replaceState(null, '', productRoutes.earth(id));
  closeSearch();
  syncRoadLayerForContext();
  renderViews(); renderPlanOverlay(); renderMinePanel(); renderControls();
  renderPropMarkers();
  const origin = geographicOriginForProperty(p);
  if (origin) flyTo(origin, FOCUS_ZOOM, true);
  else showToast('Set an exact property location to use geographic features');
  renderCard();
}

function closeCard(): void {
  const keepRoads = state.roadsOn;
  laDeactivate();
  state.selId = null;
  window.history.replaceState(null, '', productRoutes.earth());
  state.roadsOn = keepRoads;
  syncRoadLayerForContext();
  renderCard(); renderPropMarkers(); renderControls();
}

function setCardTab(tab: CardTab): void {
  if (state.cardTab === tab) return;
  state.cardTab = tab;
  if (tab === 'advantage') void laActivate(); else laDeactivate();
  renderCard();
}

function renderCard(): void {
  const wrap = $('e-cardwrap');
  const p = currentProp();
  if (!p || !isLiveMapView(state.view) || state.addMode || state.svSelect || sheet) { wrap.innerHTML = ''; return; }

  const hero = p.photos[state.photoIdx] ?? p.photos[0] ?? null;
  const canPresent = Boolean(p.canonicalRecord?.published && !p.canonicalRecord.sold);
  wrap.innerHTML = `
  <div class="e-card">
    <div class="e-card-scroll escroll">
      <div class="e-hero">
        ${hero
          ? `<img src="${escapeHtml(hero)}" alt="${escapeHtml(p.plotNo)}" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
          : `<div style="position:absolute;inset:0;display:grid;place-items:center;background:#e9e4da;color:#706858"><span style="text-align:center"><i class="ph-fill ph-image" style="font-size:42px"></i><br><b>No property photo</b></span></div>`}
        <div class="e-hero-grad"></div>
        <div class="e-hero-top">
          <span class="e-hero-btn gold" id="e-share" title="Share"><span class="ph-fill ph-share-network"></span></span>
          <span class="e-hero-btn" id="e-close" title="Close"><span class="ph ph-x"></span></span>
        </div>
        ${p.photos.length > 1 ? `<div class="e-hero-next" id="e-next" title="Next photo"><span class="ph-bold ph-caret-right" style="font-size:21px"></span></div>` : ''}
        <div class="e-hero-cap">
          <div class="e-hero-tag"><span class="ph-fill ph-map-pin"></span>${escapeHtml(p.tag)}</div>
          <div class="e-hero-title">${escapeHtml(p.plotNo)}</div>
          <div class="e-hero-loc"><span class="ph-fill ph-map-pin-area" style="font-size:16px"></span>${escapeHtml(p.sector)} · ${escapeHtml(p.city)}</div>
        </div>
      </div>
      ${p.photos.length > 1 ? `<div class="e-thumbs">${p.photos.map((src, i) =>
        `<button class="e-thumb ${i === state.photoIdx ? 'on' : ''}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;object-fit:cover"></button>`).join('')}</div>` : ''}

      <div class="e-card-body">
        <div class="e-seg" role="tablist">
          <button class="e-seg-btn ${state.cardTab === 'details' ? 'on' : ''}" id="e-tab-details" role="tab"><i class="ph-fill ph-list-bullets"></i>Details</button>
          <button class="e-seg-btn ${state.cardTab === 'advantage' ? 'on' : ''}" id="e-tab-adv" role="tab"><i class="ph-fill ph-map-trifold"></i>Location advantage</button>
        </div>
        <div id="e-tabbody">${state.cardTab === 'details' ? detailsHtml(p) : advantageBodyHtml()}</div>
        <button class="e-primary" id="e-details">Open dealer property<span class="ph-bold ph-arrow-right" style="font-size:16px"></span></button>
        <button class="e-primary" id="e-relocate" style="margin-top:8px;background:#f0eadf;color:#392f20">Update Earth location<span class="ph-fill ph-crosshair" style="font-size:16px"></span></button>
      </div>
    </div>
    </div>`;

  $('e-close').addEventListener('click', closeCard);
  $('e-share').addEventListener('click', () => void copyEarthLink(p.id));
  $('e-details').addEventListener('click', () => window.location.assign(productRoutes.properties(p.id)));
  $('e-relocate').addEventListener('click', () => startRelocate(p.id));
  $('e-tab-details').addEventListener('click', () => setCardTab('details'));
  $('e-tab-adv').addEventListener('click', () => setCardTab('advantage'));
  const next = document.getElementById('e-next');
  if (next) next.addEventListener('click', () => { state.photoIdx = (state.photoIdx + 1) % p.photos.length; renderCard(); });
  wrap.querySelectorAll<HTMLElement>('.e-thumb').forEach((t) =>
    t.addEventListener('click', () => { state.photoIdx = Number(t.dataset.i); renderCard(); }));
  if (state.cardTab === 'advantage') wireAdvList();
}

async function copyEarthLink(id: string): Promise<void> {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(new URL(productRoutes.earth(id), window.location.origin).href);
    showToast('Earth link copied');
  } catch {
    showToast('Could not copy the Earth link');
  }
}

function detailsHtml(p: Property): string {
  const specs: { k: string; v: string; icon: string }[] = [
    { k: 'Plot size', v: p.size, icon: 'ph-fill ph-ruler' },
    { k: 'Dimensions', v: p.dims, icon: 'ph-fill ph-frame-corners' },
    { k: 'Facing', v: p.facing, icon: 'ph-fill ph-compass' },
    { k: 'Road width', v: p.road, icon: 'ph-fill ph-road-horizon' },
    { k: 'Plot type', v: p.type, icon: 'ph-fill ph-house-line' },
    { k: 'Approval', v: p.approval, icon: 'ph-fill ph-certificate' },
    { k: 'Ownership', v: p.ownership, icon: 'ph-fill ph-scroll' },
    { k: 'Possession', v: p.possession, icon: 'ph-fill ph-key' },
  ];
  return `<div class="e-specs">${specs.filter((s) => s.v.trim().length > 0).map((s) =>
    `<div class="e-spec"><div class="e-spec-k"><span class="${s.icon}" style="font-size:16px;color:#b39a63"></span>${s.k}</div><div class="e-spec-v">${escapeHtml(s.v)}</div></div>`).join('')}</div>`;
}

/* ── Location Advantage — card body ────────────────────────────── */
function advMeta(a: Advantage): string {
  const dist = formatDistance(a.distanceMeters);
  if (a.kind === 'road') return a.distanceMeters < 40 ? 'Adjacent' : `${dist} to access`;
  const time = formatDuration(a.durationSec);
  if (a.section === 'around') return dist;                  // close by — distance is enough
  return time ? `${dist} · ${time}` : dist;
}
/** Does tapping this advantage draw a road-following route? */
function advHasRoute(a: Advantage): boolean {
  return a.kind === 'poi' && a.section === 'nearby';
}
function advItemHtml(a: Advantage): string {
  const active = a.id === state.activeAdvId;
  const right = active
    ? `<span class="e-adv-go on" title="Clear from map"><i class="ph-bold ph-x"></i></span>`
    : advHasRoute(a)
      ? `<span class="e-adv-go" title="Show route"><i class="ph-fill ph-path"></i></span>`
      : a.kind === 'road'
        ? `<span class="e-adv-go" title="Highlight this road"><i class="ph-fill ph-road-horizon"></i></span>`
        : `<span class="e-adv-go" title="Show on map"><i class="ph-fill ph-map-pin"></i></span>`;
  return `
    <div class="e-adv e-adv--${a.section} ${active ? 'on' : ''}" data-id="${escapeHtml(a.id)}">
      <div class="e-adv-ic" style="background:${a.color}1f;color:${a.color}"><span class="${a.icon}"></span></div>
      <div style="min-width:0;flex:1">
        <div class="e-adv-name">${escapeHtml(a.name)}</div>
        <div class="e-adv-meta">${advMeta(a)}</div>
      </div>
      ${right}
    </div>`;
}

const LA_TABS: { key: Section; label: string }[] = [
  { key: 'around', label: 'Around sector' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'roads', label: 'Roads' },
];
function sectionItems(s: Section): Advantage[] {
  if (!currentIntel) return [];
  return s === 'around' ? currentIntel.around : s === 'nearby' ? currentIntel.nearby : currentIntel.roads;
}
function laTabsHtml(): string {
  return `<div class="e-lactx">${LA_TABS.map((t) => {
    const n = sectionItems(t.key).length;
    return `<button class="e-lactx-btn ${state.laContext === t.key ? 'on' : ''}" data-ctx="${t.key}">${t.label}${n ? `<span class="e-lactx-n">${n}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
function advantageBodyHtml(): string {
  if (state.laLoading) {
    return `<div class="e-adv-head">Studying this neighbourhood…</div>
      <div class="e-adv-loading">${'<div class="e-adv-skel"></div>'.repeat(6)}</div>`;
  }
  const tabs = laTabsHtml();
  const items = sectionItems(state.laContext);
  currentAdvantages = items;
  if (!items.length) {
    const msg = state.laContext === 'around'
      ? 'Nothing strong enough to highlight right around here — try Nearby.'
      : state.laContext === 'nearby'
        ? 'No major destinations within range — try Roads.'
        : 'No major connecting roads mapped near this location yet.';
    return `${tabs}<div class="e-adv-empty"><span class="ph-fill ph-compass-tool"></span>
      <div><b>Nothing to highlight here</b><div>${msg}</div></div></div>`;
  }
  const hint = state.laContext === 'roads'
    ? `<div class="e-adv-hint"><span class="ph-fill ph-info"></span>All connecting roads are shown together — tap one to focus it.</div>`
    : '';
  return `${tabs}${hint}<div class="e-adv-list">${items.map(advItemHtml).join('')}</div>`;
}
function wireAdvList(): void {
  document.querySelectorAll<HTMLElement>('#e-tabbody .e-lactx-btn').forEach((el) => {
    el.addEventListener('click', () => setLaContext(el.dataset.ctx as Section));
  });
  document.querySelectorAll<HTMLElement>('#e-tabbody .e-adv').forEach((el) => {
    el.addEventListener('click', () => {
      const a = currentAdvantages.find((x) => x.id === el.dataset.id);
      if (a) void activateAdvantage(a);
    });
  });
}
/** Switch context: clean the map, reset selection, show the new list. */
function setLaContext(ctx: Section): void {
  if (state.laContext === ctx) return;
  state.laContext = ctx;
  clearActiveContext();
  const p = currentProp();
  const origin = p ? geographicOriginForProperty(p) : null;
  if (ctx === 'roads' && currentIntel) {
    state.roadsOn = true;
    currentRoadNetwork = currentIntel.roads;
    currentRoadPropertyId = p?.id ?? null;
    drawRoadNetwork(currentRoadNetwork, null);
  } else if (origin) {
    state.roadsOn = false;
    clearRoadOverlay();
    flyTo(origin, 15, true);
  }
  renderControls();
  renderCardTabBody();
}

/* ═══════════════════════════════════════════════════════════════
   LOCATION ADVANTAGE — engine + map overlays
   ═══════════════════════════════════════════════════════════════ */
async function laActivate(): Promise<void> {
  const p = currentProp();
  if (!p || !mapReady) return;
  const origin = geographicOriginForProperty(p);
  if (!origin) {
    state.laLoading = false;
    renderCardTabBody();
    showToast('Set an exact property location before studying it');
    return;
  }
  const forId = p.id;
  // The map stays CLEAN — the property stays the focus, no context pins yet.
  clearActiveContext();
  currentIntel = null;
  currentAdvantages = [];
  state.laLoading = true;
  renderCardTabBody();                    // show skeletons
  flyTo(origin, 15, true);
  try {
    const intel = await analyseLocation(p, origin);
    if (state.selId !== forId || state.cardTab !== 'advantage') return; // changed while loading
    // clone so per-session route refinements never mutate the stored analysis
    currentIntel = {
      ...intel,
      around: intel.around.map((a) => ({ ...a })),
      nearby: intel.nearby.map((a) => ({ ...a })),
      roads: intel.roads.map((a) => ({ ...a })),
    };
    currentRoadNetwork = currentIntel.roads;
    currentRoadPropertyId = forId;
    state.laLoading = false;
    if (state.laContext === 'roads') {
      state.roadsOn = true;
      drawRoadNetwork(currentRoadNetwork, null);
      renderControls();
    }
    renderCardTabBody();                  // list only — nothing else added to the map
  } catch {
    state.laLoading = false;
    renderCardTabBody();
    showToast('Could not study this location');
  }
}

function laDeactivate(): void {
  state.roadsOn = false;
  clearActiveContext();
  currentIntel = null;
  currentAdvantages = [];
  currentRoadNetwork = [];
  currentRoadPropertyId = null;
  state.laLoading = false;
  state.laContext = 'around';
  clearRoadOverlay();
  renderControls();
}
/** Remove the active context pin, route and any LA road network. */
function clearActiveContext(): void {
  clearAdvMarkers();
  clearRoute();
  state.activeAdvId = null;
  if (state.roadsOn && currentRoadNetwork.length) {
    drawRoadNetwork(currentRoadNetwork, null);
  } else if (!state.roadsOn) {
    clearRoadOverlay();
  }
}

function renderCardTabBody(): void {
  const body = document.getElementById('e-tabbody');
  if (!body) return;
  const p = currentProp();
  if (!p) return;
  body.innerHTML = state.cardTab === 'details' ? detailsHtml(p) : advantageBodyHtml();
  if (state.cardTab === 'advantage') wireAdvList();
}

function buildContextPin(a: Advantage, active: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'e-ctx e-ctx--' + a.section + (active ? ' on' : '');
  el.innerHTML =
    `<div class="e-ctx-pill" style="--c:${a.color}">
       <span class="e-ctx-ic"><span class="${a.icon}"></span></span>
       <span class="e-ctx-name">${escapeHtml(a.name)}</span>
     </div>
     <div class="e-ctx-stem"></div>`;
  return el;
}
/** Put exactly ONE context pin on the map (clearing any previous). */
function showAdvPin(a: Advantage): void {
  clearAdvMarkers();
  const root = buildContextPin(a, true);
  const marker = new AdvancedMarkerElement({ map, position: a.pos, content: root, zIndex: 4000, gmpClickable: true });
  marker.addListener('gmp-click', () => void activateAdvantage(a));
  advMarkers.set(a.id, { marker, root });
}
function clearAdvMarkers(): void {
  for (const [, m] of advMarkers) m.marker.map = null;
  advMarkers.clear();
}

/** Clicking a result reveals just that one on Earth. Clicking it again (or its
 *  X) clears back to the clean, property-focused view. */
async function activateAdvantage(a: Advantage): Promise<void> {
  const p = currentProp();
  if (!p) return;
  const origin = geographicOriginForProperty(p);
  if (!origin) {
    showToast('Set an exact property location before using Location Advantage');
    return;
  }

  // toggle off → clean map, property back in focus
  if (state.activeAdvId === a.id) {
    state.activeAdvId = null;
    clearRoute();
    if (a.kind === 'road') drawRoadNetwork(currentRoadNetwork, null);
    else { clearAdvMarkers(); flyTo(origin, 15, true); }
    renderCardTabBody();
    return;
  }

  state.activeAdvId = a.id;
  clearRoute();

  // A road is a corridor, not a point: strengthen it inside the network view.
  if (a.kind === 'road') {
    clearAdvMarkers();
    drawRoadNetwork(currentRoadNetwork, a.id);
    renderCardTabBody();
    return;
  }

  showAdvPin(a);
  renderCardTabBody();

  // immediate amenities (and roads) don't need a driving route — frame is enough
  if (!advHasRoute(a)) { flyToBoth(origin, a.pos); return; }

  const cached = routeCache.get(a.id);
  if (!cached) meter('routes.computeRoutes', 1, { propertyId: p.id, note: a.category });
  const leg = cached ?? await computeRoute(origin, a.pos);
  if (state.activeAdvId !== a.id) return;               // switched while loading
  if (!leg || leg.path.length < 2) {
    flyToBoth(origin, a.pos);
    if (isRoutesApiDisabled()) { renderCardTabBody(); showToast('Enable Routes API for live drive routes'); }
    else showToast('No drive route available');
    return;
  }
  if (!cached) routeCache.set(a.id, leg);
  drawRoute(leg.path);
  a.distanceMeters = leg.distanceMeters || a.distanceMeters;
  a.durationSec = leg.durationSec ?? a.durationSec;
  a.aerial = false;
  renderCardTabBody();
  fitPath(leg.path);
}

function drawRoute(path: LatLng[]): void {
  clearRoute();
  routeGlow = new google.maps.Polyline({
    path, map, geodesic: true,
    strokeColor: '#fffdf5', strokeOpacity: 0.95, strokeWeight: 10, zIndex: 5,
  });
  routeCore = new google.maps.Polyline({
    path, map, geodesic: true,
    strokeColor: '#f4ae14', strokeOpacity: 1, strokeWeight: 5, zIndex: 6,
  });
}
function clearRoute(): void {
  if (routeGlow) { routeGlow.setMap(null); routeGlow = null; }
  if (routeCore) { routeCore.setMap(null); routeCore = null; }
}
function fitPath(path: LatLng[]): void {
  if (!map || !path.length) return;
  const b = new google.maps.LatLngBounds();
  for (const pt of path) b.extend(pt);
  map.fitBounds(b, cardPadding());
}
function flyToBoth(a: LatLng, b: LatLng): void {
  if (!map) return;
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(a); bounds.extend(b);
  map.fitBounds(bounds, cardPadding());
}

/* ═══════════════════════════════════════════════════════════════
   MAPCO ROAD LAYER
   Geometry is authoritative MAPCO-owned GeoJSON (intel/road-network).
   Roads are a deliberate NETWORK view: every connecting road at once.
   ═══════════════════════════════════════════════════════════════ */
function clearRoadOverlay(): void {
  roadLayer?.hide();
}

/** Draw every supplied road together; `activeId` gets full strength.
 *  Electric-cyan core over a soft dark casing reads cleanly on both
 *  bright and dark satellite imagery without becoming neon spaghetti. */
function drawRoadNetwork(roads: Array<{
  id: string;
  name: string;
  path?: LatLng[];
  accessPoint?: LatLng;
  distanceMeters?: number;
  roadImportance?: number;
  roadScore?: number;
  roadRelation?: 'direct' | 'connected';
  roadNetworkMeters?: number;
  roadTier?: 'primary' | 'secondary' | 'tertiary';
}>, activeId: string | null): void {
  if (!mapReady || !roadLayer) return;
  const property = currentProp();
  if (!property) { clearRoadOverlay(); return; }
  const origin = geographicOriginForProperty(property);
  if (!origin) { clearRoadOverlay(); return; }
  roadLayer.show(roads
    .filter((road): road is typeof road & { path: LatLng[] } => Boolean(road.path?.length && road.path.length >= 2))
    .map((road) => ({
      id: road.id,
      name: road.name,
      path: road.path,
      accessPoint: road.accessPoint,
      accessMeters: road.distanceMeters,
      networkMeters: road.roadNetworkMeters,
      importance: road.roadImportance,
      score: road.roadScore,
      relation: road.roadRelation,
      tier: road.roadTier,
    })), activeId, origin);
}

function syncRoadLayerForContext(): void {
  const p = currentProp();
  const mode = resolveRoadLayerMode(state.roadsOn, Boolean(p));
  if (mode === 'off') {
    clearRoadOverlay();
    return;
  }
  if (mode === 'global') {
    currentRoadNetwork = [];
    currentRoadPropertyId = null;
    if (mapReady && roadLayer) roadLayer.show(GLOBAL_ROAD_ITEMS, null, null);
    return;
  }

  if (!p) return;
  const origin = geographicOriginForProperty(p);
  if (!origin) {
    state.roadsOn = false;
    clearRoadOverlay();
    showToast('Set an exact property location before ranking roads');
    return;
  }
  if (currentRoadPropertyId !== p.id) {
    currentRoadNetwork = roadAdvantagesFor(origin, intentOf(p));
    currentRoadPropertyId = p.id;
  }
  if (!currentRoadNetwork.length) {
    state.roadsOn = false;
    clearRoadOverlay();
    showToast('No mapped road geometry is relevant here yet');
    return;
  }
  drawRoadNetwork(currentRoadNetwork, null);
}

/** Roads tool: all registered roads globally, or the ranked set for a property. */
function toggleRoadsLayer(): void {
  const p = currentProp();
  state.roadsOn = !state.roadsOn;
  state.activeAdvId = null;
  syncRoadLayerForContext();
  if (!state.roadsOn && p && state.cardTab === 'advantage' && state.laContext === 'roads') {
    state.laContext = 'around';
    renderCardTabBody();
  }
  renderControls();
}

/** Collapse context-pin labels to dots when zoomed far out. */
function applyZoomDeclutter(): void {
  if (!map) return;
  const low = map.getZoom() < 13;
  for (const [, m] of advMarkers) m.root.classList.toggle('e-ctx--dot', low);
}

/* ═══════════════════════════════════════════════════════════════
   MY PROPERTIES
   ═══════════════════════════════════════════════════════════════ */
function renderMineButton(): void { $('e-minecount').textContent = String(allProperties().length); }
function renderMinePanel(): void {
  const panel = $('e-minepanel');
  if (!state.panelOpen || !isLiveMapView(state.view) || state.addMode) { panel.style.display = 'none'; return; }
  const props = allProperties();
  panel.className = 'e-mine-panel escroll';
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="e-mine-head">
      <div class="e-mine-title">MY PROPERTIES · ${props.length}</div>
      <span class="ph ph-x e-mine-x" id="e-mineclose"></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${props.map((p) => `
        <div class="e-mine-row ${p.id === state.selId ? 'on' : ''}" data-id="${p.id}">
          <div class="e-mine-tag">${escapeHtml(p.tag)}</div>
          <div style="min-width:0;flex:1"><div class="e-mine-plot">${escapeHtml(p.plotNo)}</div><div class="e-mine-sub">${escapeHtml(p.sector)} · ${escapeHtml(p.size)}</div></div>
          <span class="ph-fill ph-arrow-fat-right" style="font-size:15px;color:#7f978a"></span>
        </div>`).join('')}
    </div>`;
  $('e-mineclose').addEventListener('click', () => { state.panelOpen = false; renderMinePanel(); });
  panel.querySelectorAll<HTMLElement>('.e-mine-row').forEach((r) =>
    r.addEventListener('click', () => selectProperty(r.dataset.id!)));
}

/* ═══════════════════════════════════════════════════════════════
   CONTROLS visibility
   ═══════════════════════════════════════════════════════════════ */
function renderControls(): void {
  const live = isLiveMapView(state.view) && !state.addMode;
  const tools = document.getElementById('e-tools');
  if (tools) tools.style.display = live ? 'flex' : 'none';

  const roads = document.getElementById('e-roads');
  const sv = document.getElementById('e-svbtn');
  roads?.classList.toggle('on', state.roadsOn);
  roads?.setAttribute('aria-pressed', String(state.roadsOn));
  sv?.classList.toggle('on', state.svSelect || !!panorama);
  sv?.setAttribute('aria-pressed', String(state.svSelect || !!panorama));
}

/* ═══════════════════════════════════════════════════════════════
   ADD / RELOCATE  (pin → drag → save)  — single location source
   ═══════════════════════════════════════════════════════════════ */
function startRelocate(id: string): void {
  if (!mapReady) { showToast('Map still loading…'); return; }
  const property = allProperties().find((item) => item.id === id);
  if (!property) return;
  laDeactivate();
  state.addMode = 'relocate'; state.relocateFor = id; state.selId = null; state.panelOpen = false;
  closeSearch();
  dropAddPin(geographicOriginForProperty(property) ?? map.getCenter());
  renderCard(); renderMinePanel(); renderControls(); renderAddUI();
}

function startAdd(mode: Exclude<AddMode, null | 'relocate'>): void {
  if (!mapReady) { showToast('Map still loading…'); return; }
  laDeactivate();
  state.addMode = mode; state.selId = null; state.panelOpen = false;
  closeSearch();
  dropAddPin(map.getCenter());
  renderCard(); renderMinePanel(); renderControls(); renderAddUI();
}
function dropAddPin(pos: any): void {
  clearAddPin();
  const relocating = state.relocateFor ? allProperties().find((item) => item.id === state.relocateFor) : null;
  const rootEl = buildPin('add', state.addMode === 'place' ? 'New place' : relocating?.tag ?? 'Property', false);
  addMarker = new AdvancedMarkerElement({ map, position: pos, content: rootEl, gmpDraggable: true, zIndex: 60 });
}
function clearAddPin(): void { if (addMarker) { addMarker.map = null; addMarker = null; } }

function renderAddUI(): void {
  const hint = $('e-addhint'); const bar = $('e-addbar');
  if (!state.addMode) { hint.innerHTML = ''; bar.innerHTML = ''; return; }
  const isPlace = state.addMode === 'place';
  const label = isPlace ? 'Tap the map or drag the pin onto the place' : 'Tap the map or drag the pin onto the plot';
  hint.innerHTML = `<div class="e-pick-banner"><span class="ph-fill ph-hand-pointing" style="font-size:20px"></span>${label}</div>`;
  bar.innerHTML = `<div class="e-add-bar">
    ${isPlace ? `<input class="e-add-name" id="e-placename" placeholder="Name this place…" maxlength="40"/>` : ''}
    <button class="e-add-skip" id="e-addcancel">Cancel</button>
    <button class="e-add-confirm ${isPlace ? 'violet' : ''}" id="e-addconfirm"><span class="ph-bold ph-check"></span>${isPlace ? 'Save place' : 'Save location'}</button>
  </div>`;
  $('e-addcancel').addEventListener('click', cancelAdd);
  $('e-addconfirm').addEventListener('click', () => void confirmAdd());
  const nameInput = document.getElementById('e-placename') as HTMLInputElement | null;
  if (nameInput) nameInput.focus();
}

function onMapClick(e: any): void {
  if (state.svSelect && e.latLng) { void handleSvPick({ lat: e.latLng.lat(), lng: e.latLng.lng() }); return; }
  if (state.addMode && addMarker && e.latLng) addMarker.position = e.latLng;
}

async function confirmAdd(): Promise<void> {
  if (!addMarker) return;
  const pos = addMarker.position;
  const latLng: LatLng = { lat: typeof pos.lat === 'function' ? pos.lat() : pos.lat, lng: typeof pos.lng === 'function' ? pos.lng() : pos.lng };
  if (state.addMode === 'place') {
    const nameInput = document.getElementById('e-placename') as HTMLInputElement | null;
    const place = placesStore.add(nameInput?.value || 'New place', latLng);
    finishAdd(); renderPlaceMarkers(); showToast(`Saved place — ${place.name}`); return;
  }
  const propertyId = state.relocateFor;
  if (!propertyId) { finishAdd(); return; }
  try {
    const record = await locationSource.set(propertyId, latLng);
    finishAdd(); renderPropMarkers(); renderMineButton(); selectProperty(record.id); showToast('Earth location updated');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not update the Earth location');
  }
}
function cancelAdd(): void { finishAdd(); showToast('Cancelled'); }
function finishAdd(): void {
  clearAddPin();
  state.addMode = null; state.relocateFor = null;
  renderControls(); renderAddUI(); renderMinePanel();
}

/* ═══════════════════════════════════════════════════════════════
   UNIVERSAL STREET VIEW — a MAPCO map tool (no property needed)
   ═══════════════════════════════════════════════════════════════ */
function toggleSvSelect(): void {
  if (panorama) { closeStreetView(); return; }
  // A property is open → the dealer means "show me THIS plot from the road".
  // Don't make them click the map again.
  const p = currentProp();
  if (p && !state.svSelect) {
    const origin = geographicOriginForProperty(p);
    if (!origin) { showToast('Set an exact property location before opening Street View'); return; }
    void openStreetViewFor(origin, `${p.tag} · ${p.sector}`);
    return;
  }
  state.svSelect = !state.svSelect;
  $('e-svbtn').classList.toggle('on', state.svSelect);
  if (map) map.setOptions({ draggableCursor: state.svSelect ? 'crosshair' : null });
  renderControls(); renderCard();
  $('e-pickhint').innerHTML = state.svSelect
    ? `<div class="e-pick-banner"><span class="ph-fill ph-person-simple-walk" style="font-size:20px"></span>Click anywhere — MAPCO drops you into the nearest Street View</div>`
    : '';
  if (state.svSelect) closeSearch();
}
function exitSvSelect(): void {
  state.svSelect = false;
  $('e-svbtn').classList.remove('on');
  $('e-pickhint').innerHTML = '';
  if (map) map.setOptions({ draggableCursor: null });
  renderControls(); renderCard();
}

async function handleSvPick(point: LatLng): Promise<void> {
  exitSvSelect();
  await openStreetViewFor(point, 'Street View');
}

/** Find the nearest covered road to `target` and look back toward it. */
async function openStreetViewFor(target: LatLng, title: string): Promise<void> {
  showToast('Finding the nearest Street View…');
  try {
    await importMapsLibrary('streetView');
    if (!streetViewService) streetViewService = new google.maps.StreetViewService();
    // Tight-first, then widen — never jump to a pano kilometres away.
    for (const radius of [80, 200, 500, 1200]) {
      const resp = await streetViewService
        .getPanorama({ location: target, radius, source: google.maps.StreetViewSource.OUTDOOR })
        .catch(() => null);
      meter('streetview.metadata', 1, { note: 'getPanorama r=' + radius });
      const data = resp?.data;
      const loc = data?.location;
      if (loc?.pano) {
        const from = loc.latLng
          ? { lat: typeof loc.latLng.lat === 'function' ? loc.latLng.lat() : loc.latLng.lat,
              lng: typeof loc.latLng.lng === 'function' ? loc.latLng.lng() : loc.latLng.lng }
          : null;
        openPanorama(loc.pano, title, from ? bearing(from, target) : null);
        return;
      }
    }
    showToast('Street View is unavailable near there');
  } catch { showToast('Street View is unavailable right now'); }
}

/** Compass bearing from a → b, so the panorama faces the property. */
function bearing(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad)
    - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function openPanorama(pano: string, title = 'Street View', heading: number | null = null): void {
  const sv = $('e-sv');
  sv.innerHTML = `
    <div class="e-sv">
      <div class="e-sv-pano" id="e-sv-pano"></div>
      <div class="e-sv-close" id="e-sv-close"><span class="ph-bold ph-arrow-left"></span>Back to map</div>
      <div class="e-sv-title"><span class="ph-fill ph-person-simple-walk" style="font-size:16px"></span>${escapeHtml(title)}</div>
    </div>`;
  panorama = new google.maps.StreetViewPanorama($('e-sv-pano'), {
    pano, visible: true, addressControl: false, fullscreenControl: false,
    motionTracking: false, motionTrackingControl: false, panControl: true,
    zoomControl: true, enableCloseButton: false,
    ...(heading != null ? { pov: { heading, pitch: 0 }, zoom: 0.6 } : {}),
  });
  $('e-sv-close').addEventListener('click', closeStreetView);
}
function closeStreetView(): void { $('e-sv').innerHTML = ''; panorama = null; }

/* ═══════════════════════════════════════════════════════════════
   TOAST / STATIC EVENTS
   ═══════════════════════════════════════════════════════════════ */
function closeSearch(): void {
  state.searchOpen = false;
  const box = document.getElementById('e-results');
  if (box) box.style.display = 'none';
}
function showToast(msg: string): void {
  const wrap = $('e-toastwrap');
  wrap.innerHTML = `<div class="e-toast"><span class="ph-fill ph-check-circle"></span>${escapeHtml(msg)}</div>`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { wrap.innerHTML = ''; }, 2400);
}

function wireStaticEvents(): void {
  const search = $('e-search') as HTMLInputElement;
  let debounce: number | undefined;
  search.addEventListener('input', () => { if (debounce) clearTimeout(debounce); debounce = window.setTimeout(() => void onSearchInput(), 180); });
  search.addEventListener('focus', () => { void onSearchInput(); });
  $('e-clear').addEventListener('click', () => { search.value = ''; ($('e-clear')).style.display = 'none'; void onSearchInput(); search.focus(); });

  $('e-brand').addEventListener('click', (e) => {
    if (sheet) {
      e.preventDefault();
      closeSheets();
    }
  });

  const bindTool = (id: string, action: () => void) => {
    const tool = $(id);
    tool.addEventListener('click', action);
    tool.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      action();
    });
  };
  bindTool('e-svbtn', toggleSvSelect);
  $('e-minebtn').addEventListener('click', () => { state.panelOpen = !state.panelOpen; renderMinePanel(); });
  $('e-recenter').addEventListener('click', () => {
    laDeactivate(); clearRoadOverlay(); state.roadsOn = false;
    state.selId = null; setView('earth'); flyTo(DEFAULT_CENTER, DEFAULT_ZOOM);
    renderCard(); renderPropMarkers(); renderControls();
  });
  bindTool('e-roads', toggleRoadsLayer);

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.e-searchwrap') && state.searchOpen) closeSearch();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (panorama) { closeStreetView(); return; }
    if (state.svSelect) { exitSvSelect(); return; }
    if (state.addMode) { cancelAdd(); return; }
    if (state.selId) { closeCard(); return; }
    closeSearch();
  });
}

/* ── utils ─────────────────────────────────────────────────────── */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/* ═══════════════════════════════════════════════════════════════
   STATUS
   ═══════════════════════════════════════════════════════════════ */
function setStatus(kind: 'loading' | 'no-key' | 'error', detail = ''): void {
  const wrap = $('e-status'); const inner = $('e-status-inner');
  wrap.style.display = 'flex';
  if (kind === 'loading') {
    inner.innerHTML = `<div class="e-spinner"></div><div class="e-status-title">Opening MAPCO Earth…</div><div class="e-status-body">Loading live satellite imagery for the Tri-City.</div>`;
  } else if (kind === 'no-key') {
    inner.innerHTML = `<div class="e-status-ic"><i class="ph-fill ph-plug"></i></div>
      <div class="e-status-title">Map key not found</div>
      <div class="e-status-body">Add <code>VITE_GOOGLE_MAPS_API_KEY</code> and <code>VITE_GOOGLE_MAPS_MAP_ID</code> to <code>v2/.env.local</code> (or the repo-root <code>.env.local</code>), then restart the dev server.</div>`;
  } else {
    inner.innerHTML = `<div class="e-status-ic"><i class="ph-fill ph-warning"></i></div>
      <div class="e-status-title">Couldn’t load the map</div>
      <div class="e-status-body">Google Maps failed to start. Check the API key, enabled APIs and billing.<br><span style="opacity:.7;font-size:13px">${escapeHtml(detail)}</span></div>`;
  }
}
function hideStatus(): void { $('e-status').style.display = 'none'; }

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
const appEl = document.getElementById('app');
if (appEl) {
  renderShell(appEl);
  renderControls();
  void (async () => {
    const mapLoad = ensureMap();
    try {
      await locationSource.load();
      const requested = requestedProperty ? await locationSource.resolve(requestedProperty) : null;
      renderMineButton();
      renderMinePanel();
      await mapLoad;
      renderPropMarkers();
      if (requested) selectProperty(requested.id);
      else if (requestedProperty) showToast('That property is not available in your inventory');
      if (state.roadsOn) syncRoadLayerForContext();
    } catch (error) {
      await mapLoad;
      showToast(error instanceof Error ? error.message : 'Could not load properties');
    }
  })();
}
