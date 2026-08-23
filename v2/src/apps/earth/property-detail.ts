/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property detail (client presentation panel)
   Source: design-latest/Client Presentation.dc.html, the `pd` block
   (lines 268–427) and its view-model (viewVals → out.pd, ~736–815).

   A full-screen dark panel shown when a property is opened. Left is a
   five-view stage (Photos · MAPCO Earth · Sector map · Masterplan ·
   Street view); right is a Details / Intelligence card.

   CLIENT-SAFE: the "Client price" heading is a label only — no price
   figure, seller, commission or internal status is ever rendered.
   ═══════════════════════════════════════════════════════════════ */
import type { Property } from './config';
import { propertyPos } from './config';
import { productRoutes } from '../../packages/ui/product-routes';
import { hasGoogleConfig, loadGoogleMaps, importMapsLibrary, GOOGLE_MAPS_MAP_ID } from '../../packages/maps/google-loader';
import { showPlan, teardownPlan, sectorMaps } from './plan-maps';
import { RoadLayer, globalRoadLayerItems } from './road-layer';
import { ROAD_SPECS } from './intel/road-network';
import { fetchPropertyIntelligence, fetchRoute, type IntelClientResult } from './intel/property-intelligence-client';
import { decodePolyline } from '../../packages/property-intelligence';
import type { IntelligencePlace, PropertyIntelligenceViewModel } from '../../packages/property-intelligence';

export type { IntelligencePlace, PropertyIntelligenceViewModel };

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

const PCAPS = ['Site view', 'Approach road', 'Surroundings', 'Front road', 'Wide angle', 'Evening view'];

type SeeTab = 'photos' | 'earth' | 'sector' | 'plan' | 'street' | 'route';
type Mode = 'details' | 'intel';
type IntelMode = 'dayToDay' | 'cityReach';

interface DetailState {
  see: SeeTab;
  mode: Mode;
  shot: number;
  intelMode: IntelMode;
  intelRouteId: string | null;
  savedSeeBeforeRoute: SeeTab | null;
}

/* Property Intelligence is loaded lazily the first time the dealer opens the
   Intelligence tab, then held per property for the life of the panel. The
   server (dev middleware / edge function) returns instantly on a cache hit. */
type IntelStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
interface IntelLoad {
  status: IntelStatus;
  vm: IntelClientResult | null;
  propertyId: string | null;
  reason?: string;
}
let intel: IntelLoad = { status: 'idle', vm: null, propertyId: null };
let intelSeq = 0;

/** The loaded view-model, but only if it belongs to the open property. */
function currentVM(): IntelClientResult | null {
  return current && intel.propertyId === current.id ? intel.vm : null;
}

function getIntelPlace(id: string | null): IntelligencePlace | undefined {
  if (!id) return undefined;
  const vm = currentVM();
  if (!vm) return undefined;
  return vm.dayToDay.find((p) => p.id === id) || vm.cityReach.find((p) => p.id === id);
}

async function ensureIntelLoaded(p: Property, opts: { refresh?: boolean } = {}): Promise<void> {
  if (!opts.refresh && intel.propertyId === p.id && intel.status !== 'idle') return;
  const pos = propertyPos(p);
  // Canonical location ONLY. No coordinate is ever inferred from sector,
  // address, masterplan or map centre — without it, Intelligence is unavailable.
  if (!pos) {
    intel = { status: 'unavailable', vm: null, propertyId: p.id, reason: 'location_not_set' };
    render();
    return;
  }
  const seq = ++intelSeq;
  intel = { status: 'loading', vm: intel.propertyId === p.id ? intel.vm : null, propertyId: p.id };
  render();
  try {
    const vm = await fetchPropertyIntelligence(
      p.id,
      { latitude: pos.lat, longitude: pos.lng },
      p.canonicalRecord?.location?.updatedAt,
      { refresh: opts.refresh },
    );
    if (seq !== intelSeq || current?.id !== p.id) return;
    intel = {
      status: vm.status === 'ready' ? 'ready' : 'unavailable',
      vm, propertyId: p.id, reason: vm.reason,
    };
    render();
  } catch {
    if (seq !== intelSeq || current?.id !== p.id) return;
    intel = { status: 'error', vm: intel.vm, propertyId: p.id, reason: 'network' };
    render();
  }
}

function setIntelRoute(id: string | null) {
  if (id) {
    if (!state.intelRouteId) state.savedSeeBeforeRoute = state.see;
    state.intelRouteId = id;
    state.see = 'route';
  } else {
    state.intelRouteId = null;
    if (state.savedSeeBeforeRoute) {
      state.see = state.savedSeeBeforeRoute;
      state.savedSeeBeforeRoute = null;
    }
  }
}

interface Group { title: string; icon: string; rows: { k: string; v: string }[] }

let host: HTMLElement | null = null;
let current: Property | null = null;
const state: DetailState = { see: 'photos', mode: 'details', shot: 0, intelMode: 'dayToDay', intelRouteId: null, savedSeeBeforeRoute: null };

let panorama: any = null;
let streetViewService: any = null;

function ensureHost(): HTMLElement {
  if (host && host.isConnected) return host;
  host = document.createElement('div');
  host.id = 'mapco-pd';
  if (!document.getElementById('mapco-pd-styles')) {
    const style = document.createElement('style');
    style.id = 'mapco-pd-styles';
    style.textContent = `
      @keyframes pdVeil{from{opacity:0}to{opacity:1}}
      @keyframes pdPinIn{from{opacity:0;transform:translate(-50%,-90%) scale(.7)}to{opacity:1;transform:translate(-50%,-100%) scale(1)}}
      @keyframes pdRing{0%{transform:translate(-50%,0) scale(.5);opacity:.7}100%{transform:translate(-50%,0) scale(1.4);opacity:0}}
      #mapco-pd [data-scroll]::-webkit-scrollbar{width:10px}
      #mapco-pd [data-scroll]::-webkit-scrollbar-thumb{background:rgba(255,201,60,.3);border-radius:8px;border:3px solid transparent;background-clip:content-box}`;
    document.head.appendChild(style);
  }
  document.body.appendChild(host);
  return host;
}

const num = (value: string): number => {
  const match = String(value ?? '').match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : NaN;
};

/** Field groups (the design's groupsFor). Empty values are dropped. */
function groupsFor(p: Property): Group[] {
  const record = p.canonicalRecord;
  const mk = (title: string, icon: string, pairs: [string, string | undefined][]): Group | null => {
    const rows = pairs.filter((r) => !!r[1]).map((r) => ({ k: r[0], v: String(r[1]) }));
    return rows.length ? { title, icon, rows } : null;
  };
  const sector = (p.sector || '').split(',')[0]?.trim();
  const groups = [
    mk('The property', 'ph-fill ph-house-line', [
      ['Property type', p.type],
      ['Plot / unit', p.plotNo && p.plotNo !== p.type ? p.plotNo : undefined],
      ['Sector', sector],
      ['City', p.city],
      ['Position', p.road || record?.position],
      ['Facing', p.facing],
    ]),
    mk('Size and shape', 'ph-fill ph-ruler', [
      ['Plot size', p.size],
      ['Dimensions', p.dims],
      ['Facing', p.facing],
      ['Road width', p.road],
      ['Position', record?.position],
    ]),
  ];
  return groups.filter((g): g is Group => g !== null);
}

/** "Why this stands out" (design's standoutFor, trimmed to what we can source). */
function standoutFor(p: Property): { t: string; icon: string }[] {
  const out: { t: string; icon: string }[] = [];
  const pos = p.road || p.canonicalRecord?.position || '';
  if (/corner/i.test(pos)) out.push({ t: 'Corner plot — open on two sides', icon: 'ph-fill ph-arrows-out-cardinal' });
  if (/park/i.test(pos)) out.push({ t: 'Park facing', icon: 'ph-fill ph-tree' });
  const road = num(p.road);
  if (road && road >= 30) out.push({ t: `${road} ft road in front — wide approach`, icon: 'ph-fill ph-road-horizon' });
  if (/freehold/i.test(p.ownership || '')) out.push({ t: 'Freehold ownership', icon: 'ph-fill ph-certificate' });
  if (/ready/i.test(p.possession || '')) out.push({ t: `${p.possession} — no development wait`, icon: 'ph-fill ph-hammer' });
  (p.canonicalRecord?.approvals ?? []).forEach((a) => out.push({ t: `${a} approved`, icon: 'ph-fill ph-check-circle' }));
  return out.slice(0, 6);
}

function checksFor(p: Property): string[] {
  const common = [
    'Verify current title and ownership papers with the registry',
    'Confirm no authority dues are pending on the file',
  ];
  if (/plot/i.test(p.type)) return common.concat([
    'Get the plot physically demarcated before payment',
    'Confirm the sanctioned road width in front of the plot',
  ]);
  return common.concat(['Confirm the sanctioned plan matches what is built']);
}

const seeBtn = (on: boolean): string =>
  `width:44px;height:44px;border-radius:12px;display:grid;place-items:center;transition:background .18s,color .18s;${on ? 'background:#ffc21e;color:#231a04' : 'background:transparent;color:#e6d6ae'}`;
const modeBtn = (on: boolean): string =>
  `flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;height:42px;border-radius:11px;font-size:14.5px;font-weight:800;transition:background .18s,color .18s;${on ? 'background:#ffc21e;color:#241d0c' : 'background:transparent;color:#d8c294'}`;
const rowShadow = 'box-shadow:inset 0 -1px 0 rgba(255,201,60,.14)';

function pinMarkup(x: number, y: number, label: string): string {
  return `<div style="position:absolute;left:${x}%;top:${y}%;z-index:3;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;animation:pdPinIn .4s cubic-bezier(.2,.9,.3,1.3) both">
    <span style="position:absolute;left:50%;top:100%;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(255,194,30,.55),transparent 65%);animation:pdRing 2.4s ease-out infinite"></span>
    <span style="display:flex;align-items:center;gap:7px;background:#ffc21e;color:#231a04;border-radius:12px;padding:9px 14px;white-space:nowrap;font-size:15px;font-weight:800;box-shadow:0 14px 26px -12px rgba(0,0,0,.7)"><i class="ph-fill ph-map-pin" style="font-size:15px"></i>${esc(label)}</span>
    <span style="width:14px;height:14px;border-radius:50%;background:#ffc21e;box-shadow:0 0 0 4px rgba(255,194,30,.35);margin-top:6px"></span>
  </div>`;
}

function stageMarkup(p: Property): string {
  const idx = state.shot % Math.max(1, p.photos.length || 6);
  const photo = p.photos[idx];
  const sector = (p.sector || '').split(',')[0]?.trim() || p.city;

  if (state.see === 'photos') {
    return `<div style="position:absolute;inset:0;${photo ? `background-image:url('${esc(photo)}');background-size:cover;background-position:center` : 'background:#0f0b03;display:grid;place-items:center'}">${photo ? '' : '<i class="ph-fill ph-image" style="font-size:44px;color:#4a3f22"></i>'}</div>`;
  }
  if (state.see === 'earth') {
    return `<div id="pd-earth-map" style="position:absolute;inset:0;background:#0f2018"></div>`;
  }
  if (state.see === 'sector') {
    return `<div id="pd-plan-host" style="position:absolute;inset:0;background:#181207"></div>`;
  }
  if (state.see === 'plan') {
    return `<div id="pd-plan-host" style="position:absolute;inset:0;background:#1a130a"></div>`;
  }
  if (state.see === 'route') {
    // Real route drawn onto the Earth/Map surface by initRouteView().
    return `<div id="pd-earth-map" style="position:absolute;inset:0;background:#0f2018"></div>
      <div id="pd-route-status" style="position:absolute;left:50%;top:16px;transform:translateX(-50%);z-index:6;display:none;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:12px;background:rgba(14,10,2,.62);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,248,230,.16);color:#ffd76b;font-size:13.5px;font-weight:800"><i class="ph-fill ph-spinner-gap" style="font-size:16px"></i><span id="pd-route-status-text">Tracing route…</span></div>`;
  }
  // street
  return `<div id="pd-sv-pano" style="position:absolute;inset:0;background:#0e1512"></div>
    <div id="pd-sv-status" style="position:absolute;inset:0;background:radial-gradient(120% 120% at 60% 30%,#2a2416,#120d05);display:grid;place-items:center;color:#a99775;z-index:2">
      <div style="text-align:center"><i class="ph-fill ph-person-simple-walk" style="font-size:40px;color:#ffd76b"></i><div id="pd-sv-msg" style="margin-top:10px;font-size:15px;font-weight:700">Loading Street View…</div></div>
    </div>`;
}

function stageMeta(p: Property): { mode: string; caption: string; counter: string; url?: string; urlLabel?: string; target?: string } {
  const idx = state.shot % Math.max(1, p.photos.length || 6);
  const sector = (p.sector || '').split(',')[0]?.trim() || p.city;
  switch (state.see) {
    case 'photos': return { mode: 'Photos', caption: `${PCAPS[idx % 6]} · ${p.plotNo || p.type}`, counter: `${idx + 1} of ${p.photos.length || 6}` };
    case 'earth': return { mode: 'MAPCO Earth', caption: 'Where this property physically sits', counter: `${p.sector}`, url: productRoutes.earth(p.id), urlLabel: 'Open MAPCO Earth', target: '_self' };
    case 'sector': return { mode: 'Sector map', caption: `Official sector layout · ${p.sector}`, counter: p.plotNo || p.tag };
    case 'plan': return { mode: 'Masterplan', caption: `Area masterplan · ${p.city}`, counter: sector };
    case 'route': {
      const place = getIntelPlace(state.intelRouteId);
      return {
        mode: 'Route',
        caption: place?.name || 'Route',
        counter: place ? `${place.distanceLabel}${place.durationLabel ? ` · ${place.durationLabel}` : ''}` : '',
      };
    }
    default: {
      const pos = propertyPos(p);
      const url = pos
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${pos.lat},${pos.lng}`
        : `https://www.google.com/maps?q=${encodeURIComponent((p.sector || p.city) + ', Punjab')}&layer=c`;
      return { mode: 'Street view', caption: 'Approach road and surroundings', counter: p.road ? `${p.road} front road` : 'Front road', url, urlLabel: 'Open in Google Maps', target: '_blank' };
    }
  }
}



function closeStreetView(): void {
  if (!host) return;
  const sv = host.querySelector('#pd-sv');
  if (sv) sv.innerHTML = '';
  panorama = null;
}

let earthMap: any = null;
let earthRoads: RoadLayer | null = null;
let earthPin: any = null;
let mapEl: HTMLElement | null = null;
let routePolyline: any = null;
let routeDestMarker: any = null;
let routeSeq = 0;

/** The single persistent map container. It is created once and MOVED between
 *  the Earth and Route stage placeholders with appendChild, so render()'s
 *  wholesale innerHTML rebuilds never destroy the live Google map. */
function mapContainer(): HTMLElement {
  if (!mapEl) {
    mapEl = document.createElement('div');
    mapEl.style.position = 'absolute';
    mapEl.style.inset = '0';
  }
  return mapEl;
}

async function initEarthMap(p: Property): Promise<void> {
  const mapHost = document.getElementById('pd-earth-map');
  if (!mapHost) return;

  const pos = propertyPos(p);
  if (!pos) {
    mapHost.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;background:#0f2018;color:#a99775"><div style="text-align:center"><i class="ph-fill ph-map-pin-area" style="font-size:40px;color:#ffd76b"></i><div style="margin-top:10px;font-size:15px;font-weight:700">Earth location not set</div></div></div>`;
    return;
  }

  // Mount (or re-mount) the persistent map container into the current stage.
  const container = mapContainer();
  if (container.parentElement !== mapHost) {
    mapHost.innerHTML = '';
    mapHost.appendChild(container);
    if (earthMap) google.maps.event.trigger(earthMap, 'resize');
  }

  // Reuse the existing map if already created
  if (earthMap) {
    earthMap.setCenter(pos);
    if (earthPin) {
      earthPin.position = pos;
      const el = document.createElement('div');
      el.innerHTML = pinMarkup(0, 0, p.plotNo || p.tag);
      const innerPin = el.firstElementChild as HTMLElement;
      if (innerPin) {
        innerPin.style.position = 'relative';
        innerPin.style.left = '0';
        innerPin.style.top = '0';
        innerPin.style.transform = 'translate(-50%, -100%)';
        earthPin.content = innerPin;
      }
    }
    return;
  }

  await loadGoogleMaps();
  if (!google.maps || container.parentElement !== document.getElementById('pd-earth-map')) return;

  earthMap = new google.maps.Map(container, {
    center: pos,
    zoom: 16,
    mapTypeId: 'satellite',
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    keyboardShortcuts: false,
    mapId: GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
  });

  const { AdvancedMarkerElement } = await (window as any).google.maps.importLibrary("marker");
  
  const el = document.createElement('div');
  el.innerHTML = pinMarkup(0, 0, p.plotNo || p.tag);
  const innerPin = el.firstElementChild as HTMLElement;
  if (innerPin) {
    innerPin.style.position = 'relative';
    innerPin.style.left = '0';
    innerPin.style.top = '0';
    innerPin.style.transform = 'translate(-50%, -100%)';
  }

  earthPin = new AdvancedMarkerElement({
    map: earthMap,
    position: pos,
    content: innerPin
  });

  const controls = document.createElement('div');
  controls.style.position = 'absolute';
  controls.style.left = '18px';
  controls.style.bottom = '18px';
  controls.style.zIndex = '10';
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.gap = '3px';
  controls.style.padding = '4px';
  controls.style.borderRadius = '15px';
  controls.style.background = 'rgba(20, 26, 22, .82)';
  controls.style.backdropFilter = 'blur(16px)';
  (controls.style as any).webkitBackdropFilter = 'blur(16px)';
  controls.style.border = '1px solid rgba(255, 255, 255, .14)';
  controls.style.boxShadow = '0 16px 40px -22px rgba(0, 0, 0, .85)';
  controls.style.animation = 'eRise .6s cubic-bezier(.2,.8,.2,1) both';
  
  const toolStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:40px;padding:0 13px;height:40px;border-radius:10px;font:800 12.5px "Hanken Grotesk",sans-serif;color:#cfc4a8;cursor:pointer;transition:all .16s ease;white-space:nowrap;user-select:none;background:transparent;border:none';
  
  controls.innerHTML = `
    <button id="btn-mapco-roads" style="${toolStyle}" onmouseover="this.style.color='#fffdf5';this.style.background='rgba(255,255,255,.09)'" onmouseout="if(!this.dataset.on){this.style.color='#cfc4a8';this.style.background='transparent'}"><i class="ph-bold ph-strategy" style="font-size:16px;color:currentColor"></i>MAPCO Roads</button>
    <button id="btn-map-type" style="${toolStyle}" onmouseover="this.style.color='#fffdf5';this.style.background='rgba(255,255,255,.09)'" onmouseout="if(!this.dataset.on){this.style.color='#cfc4a8';this.style.background='transparent'}"><i class="ph-bold ph-map-trifold" style="font-size:16px;color:currentColor"></i>Google Map</button>
  `;
  
  let roadsOn = false;
  earthRoads = new RoadLayer(earthMap, AdvancedMarkerElement);
  
  const btnRoads = controls.querySelector('#btn-mapco-roads') as HTMLButtonElement;
  btnRoads.addEventListener('click', () => {
    roadsOn = !roadsOn;
    if (roadsOn) {
      btnRoads.dataset.on = 'true';
      btnRoads.style.background = 'linear-gradient(180deg, #5ceffd, #22d3ee)';
      btnRoads.style.color = '#04121a';
      btnRoads.style.boxShadow = '0 0 0 1px rgba(125,249,255,.5), 0 8px 20px -8px rgba(34,211,238,.9)';
      btnRoads.innerHTML = `<i class="ph-bold ph-strategy" style="color:#04121a;font-size:16px"></i>MAPCO Roads`;
      earthRoads?.show(globalRoadLayerItems(ROAD_SPECS), null, pos);
    } else {
      delete btnRoads.dataset.on;
      btnRoads.style.background = 'transparent';
      btnRoads.style.color = '#cfc4a8';
      btnRoads.style.boxShadow = 'none';
      btnRoads.innerHTML = `<i class="ph-bold ph-strategy" style="color:currentColor;font-size:16px"></i>MAPCO Roads`;
      earthRoads?.show([], null, null);
    }
  });

  let mapType = 'satellite';
  const btnMapType = controls.querySelector('#btn-map-type') as HTMLButtonElement;
  btnMapType.addEventListener('click', () => {
    mapType = mapType === 'satellite' ? 'roadmap' : 'satellite';
    earthMap?.setMapTypeId(mapType);
    if (mapType === 'roadmap') {
      btnMapType.dataset.on = 'true';
      btnMapType.style.background = 'linear-gradient(180deg, #a983f5, #7c4ddb)';
      btnMapType.style.color = '#fff';
      btnMapType.style.boxShadow = '0 0 0 1px rgba(169,131,245,.45), 0 8px 20px -8px rgba(124,77,219,.9)';
      btnMapType.innerHTML = `<i class="ph-bold ph-globe-hemisphere-west" style="color:#fff;font-size:16px"></i>Satellite`;
    } else {
      delete btnMapType.dataset.on;
      btnMapType.style.background = 'transparent';
      btnMapType.style.color = '#cfc4a8';
      btnMapType.style.boxShadow = 'none';
      btnMapType.innerHTML = `<i class="ph-bold ph-map-trifold" style="color:currentColor;font-size:16px"></i>Google Map`;
    }
  });

  mapHost.appendChild(controls);
}

function destPinMarkup(label: string): string {
  return `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none">
    <span style="display:flex;align-items:center;gap:6px;background:#7be0a4;color:#06251a;border-radius:11px;padding:7px 12px;white-space:nowrap;font-size:13.5px;font-weight:800;box-shadow:0 12px 24px -12px rgba(0,0,0,.7)"><i class="ph-fill ph-flag-checkered" style="font-size:14px"></i>${esc(label)}</span>
    <span style="width:12px;height:12px;border-radius:50%;background:#7be0a4;box-shadow:0 0 0 4px rgba(123,224,164,.35);margin-top:5px"></span>
  </div>`;
}

function clearRoute(): void {
  if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
  if (routeDestMarker) { routeDestMarker.map = null; routeDestMarker = null; }
}

function setRouteStatus(text: string | null): void {
  const el = document.getElementById('pd-route-status');
  if (!el) return;
  el.style.display = text ? 'flex' : 'none';
  const label = document.getElementById('pd-route-status-text');
  if (label && text) label.textContent = text;
}

/** Draw the real Google route to the selected destination onto the map. Only
 *  one route is ever active — a new selection clears the previous one. */
async function initRouteView(p: Property): Promise<void> {
  const place = getIntelPlace(state.intelRouteId);
  const origin = propertyPos(p);
  if (!place || !origin) return;
  const seq = ++routeSeq;
  setRouteStatus('Tracing route…');
  await initEarthMap(p); // ensures the persistent map + property pin, mounted here
  if (seq !== routeSeq || !earthMap) return;

  let line: Awaited<ReturnType<typeof fetchRoute>>;
  try {
    line = await fetchRoute({ latitude: origin.lat, longitude: origin.lng }, place.routeTarget);
  } catch {
    line = { ok: false };
  }
  if (seq !== routeSeq || !earthMap) return;

  clearRoute();
  if (!line.ok || !line.encodedPolyline) {
    setRouteStatus('Route unavailable');
    return;
  }
  setRouteStatus(null);

  const path = decodePolyline(line.encodedPolyline).map((pt) => ({ lat: pt.latitude, lng: pt.longitude }));
  routePolyline = new google.maps.Polyline({
    path, map: earthMap, strokeColor: '#ffc21e', strokeOpacity: 0.95, strokeWeight: 5, zIndex: 20,
  });
  try {
    const { AdvancedMarkerElement } = await (window as any).google.maps.importLibrary('marker');
    if (seq !== routeSeq || !earthMap) return;
    const el = document.createElement('div');
    el.innerHTML = destPinMarkup(place.name);
    routeDestMarker = new AdvancedMarkerElement({
      map: earthMap,
      position: { lat: place.latitude, lng: place.longitude },
      content: el.firstElementChild as HTMLElement,
    });
  } catch { /* destination marker is optional */ }

  const bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: origin.lat, lng: origin.lng });
  path.forEach((pt) => bounds.extend(pt));
  bounds.extend({ lat: place.latitude, lng: place.longitude });
  earthMap.fitBounds(bounds, 90);
}

function intelRowMarkup(place: IntelligencePlace): string {
  const isSelected = state.intelRouteId === place.id;
  
  const coreIcon = place.icon.replace(/ph-(fill|bold|light|thin) /, '');
  const placePhotos: Record<string, string> = {
    'ph-tree': 'https://images.unsplash.com/photo-1542273917363-3b1817f69a5d?q=80&w=600',
    'ph-shopping-cart': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=600',
    'ph-barbell': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600',
    'ph-graduation-cap': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=600',
    'ph-airplane-tilt': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=600',
    'ph-train': 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600',
    'ph-buildings': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600',
    'ph-hospital': 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600',
    'ph-bus': 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600'
  };
  const photo = placePhotos[coreIcon] || 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=600';
  
  const border = isSelected ? '1px solid #ffc21e' : '1px solid rgba(255,201,60,.15)';
  const ring = isSelected ? 'box-shadow: 0 0 0 4px rgba(255,194,30,.2)' : 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2)';
  
  return `<div data-pd="intel-row" data-id="${place.id}" style="position:relative;height:240px;border-radius:18px;overflow:hidden;cursor:pointer;border:${border};${ring};transition:all .2s;background:#151006;margin-bottom:12px" onmouseover="if('${state.intelRouteId}'!=='${place.id}') this.style.border='1px solid rgba(255,201,60,.4)'" onmouseout="if('${state.intelRouteId}'!=='${place.id}') this.style.border='${border}'">
      
      <div style="position:absolute;inset:0;background:url('${photo}') center/cover;opacity:${isSelected ? '1' : '0.8'};transition:opacity .2s"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(to right, rgba(15,11,3,0.95) 15%, rgba(15,11,3,0.6) 60%, rgba(15,11,3,0.1) 100%)"></div>
      
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:16px">
        
        <div style="display:flex;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:#ffc21e;color:#151006;border-radius:12px;font-size:18px;font-weight:900;box-shadow:0 0 16px rgba(255,194,30,0.6), 0 4px 12px rgba(0,0,0,0.5);letter-spacing:0.02em">
            <i class="ph-bold ph-person-simple-walk" style="font-size:22px"></i>${esc(place.distanceLabel)}
          </div>
          ${(place as any).durationLabel ? `<div style="display:flex;align-items:center;gap:4px;padding:6px 12px;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fffdf7;border-radius:10px;font-size:14px;font-weight:700;border:1px solid rgba(255,255,255,0.15)"><i class="ph-bold ph-clock" style="font-size:16px"></i>${esc((place as any).durationLabel)}</div>` : ''}
        </div>
        
        <div style="display:flex;align-items:center;gap:10px;width:90%">
          <div style="flex:none;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.3)">
            <i class="${esc(place.icon)}" style="font-size:18px;color:#fffdf7"></i>
          </div>
          <h3 style="margin:0;font-size:17px;font-weight:700;color:#fffdf7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 4px rgba(0,0,0,0.8)">${esc(place.name)}</h3>
        </div>
        
      </div>
      
      ${isSelected ? `<div style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(255,201,60,0.2), transparent);pointer-events:none"></div>` : ''}
    </div>`;
}

function intelInfoMarkup(icon: string, title: string, body: string): string {
  return `<div style="margin-top:22px;padding:26px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;color:#a99775">
    <i class="${icon}" style="font-size:34px;color:#ffd76b;opacity:.9"></i>
    <div style="margin-top:12px;font-size:15.5px;font-weight:800;color:#f4ead0">${esc(title)}</div>
    <div style="margin-top:6px;font-size:13.5px;font-weight:600;line-height:1.5;max-width:290px">${esc(body)}</div>
  </div>`;
}

function intelUnavailableMarkup(reason?: string): string {
  switch (reason) {
    case 'location_not_set':
      return intelInfoMarkup('ph-fill ph-map-pin-area', 'Location not set',
        "Set this property's exact location on MAPCO Earth to unlock Property Intelligence.");
    case 'insufficient_results':
      return intelInfoMarkup('ph-fill ph-binoculars', 'Not enough nearby anchors',
        'This area is sparse — MAPCO could not verify enough genuine destinations to show.');
    case 'server_not_configured':
      return intelInfoMarkup('ph-fill ph-plugs', 'Not configured',
        'Property Intelligence is not configured on this server yet.');
    case 'busy':
      return intelInfoMarkup('ph-fill ph-hourglass-medium', 'MAPCO is busy',
        'The intelligence service is rate-limited right now. Try Refresh in a moment.');
    default:
      return intelInfoMarkup('ph-fill ph-warning-circle', 'Unavailable right now',
        "Property Intelligence couldn't be loaded. Try Refresh in a moment.");
  }
}

function intelLoadingMarkup(): string {
  const row = `<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;box-shadow:inset 0 -1px 0 rgba(255,201,60,.08)">
      <span style="width:20px;height:20px;border-radius:6px;background:rgba(255,201,60,.14)"></span>
      <span style="flex:1;height:13px;border-radius:6px;background:rgba(255,201,60,.12)"></span>
      <span style="width:52px;height:13px;border-radius:6px;background:rgba(123,224,164,.16)"></span>
    </div>`;
  return `<div style="margin-top:12px;display:flex;flex-direction:column;gap:4px;opacity:.75;animation:pdVeil .3s ease both">${row.repeat(6)}
    <div style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;color:#ffd76b;font-size:13px;font-weight:800"><i class="ph-fill ph-spinner-gap" style="font-size:15px"></i>Reading the neighbourhood…</div>
  </div>`;
}

function intelPanelMarkup(): string {
  const vm = currentVM();
  const list = state.intelMode === 'dayToDay' ? (vm?.dayToDay ?? []) : (vm?.cityReach ?? []);
  const loading = intel.status === 'loading';
  
  const tabBtn = (on: boolean, icon: string, label: string) => `
    <button data-pd="intel-mode" data-imode="${label === 'Day to Day' ? 'dayToDay' : 'cityReach'}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:34px;border-radius:999px;font-size:13.5px;font-weight:700;transition:all .2s;${
      on 
        ? 'background:rgba(255,255,255,.08);color:#fffdf7;box-shadow:0 2px 4px rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.1)' 
        : 'background:transparent;color:#a99775;border:1px solid transparent'
    }" onmouseover="if(!${on}) this.style.background='rgba(255,255,255,.04)';this.style.color='#e9dfc9'" onmouseout="if(!${on}) this.style.background='transparent';this.style.color='#a99775'">
      <i class="${icon}" style="font-size:16px"></i> ${label}
    </button>`;

  const toggle = `
    <div style="display:flex;align-items:center;gap:8px;margin-top:14px">
      <div style="flex:1;display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">
        ${tabBtn(state.intelMode === 'dayToDay', 'ph-bold ph-calendar-blank', 'Day to Day')}
        ${tabBtn(state.intelMode === 'cityReach', 'ph-bold ph-map-trifold', 'City Reach')}
      </div>
    </div>`;

  let body: string;
  if (intel.status === 'unavailable' && list.length === 0) {
    body = intelUnavailableMarkup(intel.reason ?? vm?.reason);
  } else if (intel.status === 'error' && list.length === 0) {
    body = intelUnavailableMarkup('error');
  } else if (loading && list.length === 0) {
    body = intelLoadingMarkup();
  } else {
    body = `<div style="margin-top:12px;display:flex;flex-direction:column;gap:4px;${loading ? 'opacity:.55' : ''}">${list.map(intelRowMarkup).join('')}</div>`;
  }
  return toggle + body;
}

function render(): void {
  if (!current || !host) return;
  const p = current;
  const meta = stageMeta(p);
  const SEE: [SeeTab, string, string][] = [
    ['photos', 'Photos', 'ph-fill ph-images'],
    ['earth', 'MAPCO Earth', 'ph-fill ph-globe-hemisphere-east'],
    ['sector', 'Sector map', 'ph-fill ph-map-pin-area'],
    ['plan', 'Masterplan', 'ph-fill ph-map-trifold'],
    ['street', 'Street view', 'ph-fill ph-person-simple-walk'],
  ];
  const groupColors = [
    ['rgba(123,224,164,.11)', 'rgba(123,224,164,.3)', '#7be0a4'], // green
    ['rgba(151,110,235,.14)', 'rgba(151,110,235,.34)', '#c3a9ff'], // purple
    ['rgba(255,201,60,.1)', 'rgba(255,201,60,.3)', '#ffd76b'], // yellow
  ];
  const landmarks = p.canonicalRecord?.landmarks ?? [];

  host.innerHTML = `
  <div style="position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;overflow:hidden;background:#150e03;background-image:radial-gradient(70% 50% at 88% -6%,rgba(255,201,60,.3),transparent 62%),radial-gradient(60% 45% at 2% 4%,rgba(151,110,235,.26),transparent 62%),radial-gradient(80% 55% at 50% 106%,rgba(31,161,110,.2),transparent 62%);animation:pdVeil .22s ease both;font-family:'Hanken Grotesk',system-ui,sans-serif">

    <header style="flex:none;display:flex;align-items:center;gap:13px;padding:13px 18px 10px">
      <button data-pd="close" style="flex:none;display:flex;align-items:center;gap:9px;height:46px;padding:0 17px;border-radius:14px;background:rgba(255,248,230,.13);color:#fff8e6;font-size:15.5px;font-weight:800" onmouseover="this.style.background='rgba(255,248,230,.24)'" onmouseout="this.style.background='rgba(255,248,230,.13)'"><i class="ph-bold ph-arrow-left" style="font-size:18px"></i>Back</button>
      <div style="min-width:0;flex:1;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-family:'Newsreader',serif;font-weight:500;font-size:31px;letter-spacing:-.03em;color:#fffdf7;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.plotNo || p.type)}</div>
        <span style="flex:none;padding:6px 12px;border-radius:9px;background:rgba(255,194,30,.16);color:#ffd76b;font-size:13px;font-weight:800;letter-spacing:.02em">${esc(p.type)}</span>
        <span style="flex:none;font-size:15.5px;color:#dcc79a">${esc(p.sector)}</span>
      </div>
    </header>

    <div style="flex:1;min-height:0;display:flex;gap:14px;padding:0 18px 18px">

      <section style="flex:1;min-width:0;position:relative;border-radius:26px;overflow:hidden;background:#0f0b03;box-shadow:0 44px 90px -36px rgba(0,0,0,.9),inset 0 0 0 1px rgba(255,248,230,.1)">
        ${stageMarkup(p)}

        <div style="position:absolute;top:14px;left:14px;z-index:5;display:flex;gap:5px;padding:5px;border-radius:16px;background:rgba(14,10,2,.5);backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,248,230,.14)">
          ${SEE.map(([k, label, icon]) => `<button data-pd="see" data-see="${k}" title="${label}" style="${seeBtn(state.see === k || (state.see === 'route' && state.savedSeeBeforeRoute === k))}"><i class="${icon}" style="font-size:20px"></i></button>`).join('')}
        </div>

        ${meta.url ? `<a href="${esc(meta.url)}" target="${meta.target}" rel="noopener" style="position:absolute;top:14px;right:14px;z-index:5;display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:14px;background:rgba(14,10,2,.5);backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,248,230,.18);color:#ffd76b;font-size:14.5px;font-weight:800;text-decoration:none">${esc(meta.urlLabel ?? '')}<i class="ph-bold ph-arrow-up-right" style="font-size:15px"></i></a>` : ''}

        ${state.see === 'photos' && p.photos.length > 1 ? `
          <button data-pd="prev" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(255,250,238,.9);color:#241d0c;display:grid;place-items:center;z-index:4"><i class="ph-bold ph-caret-left" style="font-size:23px"></i></button>
          <button data-pd="next" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(255,250,238,.9);color:#241d0c;display:grid;place-items:center;z-index:4"><i class="ph-bold ph-caret-right" style="font-size:23px"></i></button>` : ''}

        <div style="position:absolute;left:0;right:0;bottom:0;z-index:3;padding:74px 20px 18px;background:linear-gradient(180deg,rgba(14,10,2,0),rgba(14,10,2,.9));display:flex;flex-direction:column;gap:13px;pointer-events:none">
          ${state.see === 'photos' && p.photos.length ? `<div style="display:flex;gap:8px;pointer-events:auto">${p.photos.slice(0, 6).map((src, i) => `<button data-pd="shot" data-i="${i}" style="display:block;overflow:hidden;border-radius:10px;transition:box-shadow .2s;box-shadow:0 0 0 ${i === (state.shot % Math.max(1, p.photos.length)) ? '2.5px #ffc21e' : '1px rgba(255,248,230,.28)'}"><span style="display:block;width:72px;height:48px;background-image:url('${esc(src)}');background-size:cover;background-position:center"></span></button>`).join('')}</div>` : ''}
          ${state.see !== 'earth' ? `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;pointer-events:auto">
            <div style="min-width:0">
              <div style="font-size:11.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ffd76b">${esc(meta.mode)}</div>
              <div style="margin-top:3px;font-size:17.5px;font-weight:800;color:#fffdf7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta.caption)}</div>
            </div>
            <div style="flex:none;font-size:14.5px;font-weight:800;color:#e2cf9f">${esc(meta.counter)}</div>
          </div>` : ''}
        </div>
      </section>

      <aside style="width:404px;flex:none;display:flex;flex-direction:column;min-height:0;border-radius:26px;overflow:hidden;background:#241804;background-image:linear-gradient(168deg,#2e2007 0%,#231704 58%,#2b1e06 100%);box-shadow:inset 0 0 0 1px rgba(255,201,60,.3),0 30px 60px -34px rgba(0,0,0,.9)">
        <div style="flex:none;padding:16px 18px 14px;box-shadow:inset 0 -1px 0 rgba(255,201,60,.22)">
          <div style="display:flex;gap:4px;padding:4px;border-radius:14px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)">
            <button data-pd="mode" data-mode="details" style="${modeBtn(state.mode === 'details')}">Details</button>
            <button data-pd="mode" data-mode="intel" style="${modeBtn(state.mode === 'intel')}">Intelligence</button>
          </div>
        </div>

        <div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:4px 18px 22px">
          ${state.mode === 'details' ? groupsFor(p).map((g, gi) => {
            const c = groupColors[gi % 3]!;
            return `<div style="margin-top:14px;padding:14px 15px 6px;border-radius:18px;background:${c[0]};box-shadow:inset 0 0 0 1px ${c[1]}">
              <div style="display:flex;align-items:center;gap:8px;padding-bottom:8px">
                <i class="${g.icon}" style="font-size:15px;color:${c[2]}"></i>
                <span style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${c[2]}">${esc(g.title)}</span>
              </div>
              ${g.rows.map((r) => `<div style="display:flex;align-items:baseline;gap:14px;padding:9px 0;${rowShadow}"><span style="flex:none;width:142px;font-size:13.5px;font-weight:700;color:#a99775">${esc(r.k)}</span><span style="flex:1;min-width:0;font-size:15px;font-weight:800;color:#fff;text-align:right;text-wrap:pretty">${esc(r.v)}</span></div>`).join('')}
            </div>`;
          }).join('') : intelPanelMarkup()}
        </div>
      </aside>
    </div>
  </div>`;

  host.querySelector('[data-pd="close"]')?.addEventListener('click', close);
  host.querySelectorAll<HTMLElement>('[data-pd="see"]').forEach((el) =>
    el.addEventListener('click', () => {
      // Explicitly choosing a stage clears any active route focus and lands
      // on the chosen stage (not the pre-route saved one).
      state.intelRouteId = null;
      state.savedSeeBeforeRoute = null;
      state.see = el.dataset.see as SeeTab;
      render();
    }));
  host.querySelectorAll<HTMLElement>('[data-pd="mode"]').forEach((el) =>
    el.addEventListener('click', () => {
      const newMode = el.dataset.mode as Mode;
      if (newMode !== state.mode) {
        state.mode = newMode;
        if (newMode === 'details') setIntelRoute(null);
      }
      render();
      if (newMode === 'intel') void ensureIntelLoaded(p);
    }));
  host.querySelectorAll<HTMLElement>('[data-pd="intel-mode"]').forEach((el) =>
    el.addEventListener('click', () => { 
      const newMode = el.dataset.imode as IntelMode;
      if (newMode !== state.intelMode) {
        state.intelMode = newMode;
        setIntelRoute(null);
      }
      render(); 
    }));
  host.querySelectorAll<HTMLElement>('[data-pd="intel-row"]').forEach((el) =>
    el.addEventListener('click', () => {
      setIntelRoute(el.dataset.id as string);
      render();
    }));
  host.querySelector('[data-pd="intel-refresh"]')?.addEventListener('click', () => {
    void ensureIntelLoaded(p, { refresh: true });
  });
  host.querySelector('[data-pd="prev"]')?.addEventListener('click', () => { state.shot = (state.shot + (p.photos.length || 6) - 1) % (p.photos.length || 6); render(); });
  host.querySelector('[data-pd="next"]')?.addEventListener('click', () => { state.shot = (state.shot + 1) % (p.photos.length || 6); render(); });
  host.querySelectorAll<HTMLElement>('[data-pd="shot"]').forEach((el) =>
    el.addEventListener('click', () => { state.shot = Number(el.dataset.i) || 0; render(); }));

  if (state.see === 'street') {
    void initStreetView(p);
  } else {
    panorama = null;
  }

  if (state.see === 'earth') {
    void initEarthMap(p);
  } else if (state.see === 'route') {
    void initRouteView(p);
  } else {
    // Keep the map instance alive for reuse; only drop the drawn route.
    clearRoute();
  }

  if (state.see === 'sector' || state.see === 'plan') {
    let mapId = state.see === 'sector' 
      ? (p.canonicalRecord?.mapPlacement?.mapId || p.canonicalRecord?.sectorMapId)
      : p.canonicalRecord?.masterplanId;
      
    if (!mapId && state.see === 'sector') {
      const match = sectorMaps().find((m) => m.city === p.city && m.sectorOrBlock === p.sector);
      if (match) mapId = match.id;
    }
      
    if (mapId || state.see === 'plan') {
      void showPlan(document.getElementById('pd-plan-host')!, 'masterplan', mapId);
    } else {
      document.getElementById('pd-plan-host')!.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:#a99775"><div style="text-align:center"><i class="ph-fill ph-map-pin-area" style="font-size:40px;color:#ffd76b"></i><div style="margin-top:10px;font-size:15px;font-weight:700">Sector layout not linked yet</div></div></div>`;
    }
  } else {
    teardownPlan();
  }
}

async function initStreetView(p: Property): Promise<void> {
  const panoEl = document.getElementById('pd-sv-pano');
  const statusEl = document.getElementById('pd-sv-status');
  const msgEl = document.getElementById('pd-sv-msg');
  if (!panoEl || !statusEl || !msgEl) return;

  if (!hasGoogleConfig()) {
    msgEl.textContent = 'Google Maps API key missing';
    return;
  }

  const target = propertyPos(p);
  if (!target) {
    msgEl.textContent = 'Property location not set';
    return;
  }

  try {
    await loadGoogleMaps();
    await importMapsLibrary('streetView');
    
    if (!streetViewService) {
      streetViewService = new google.maps.StreetViewService();
    }

    let foundPano = null;
    let foundLoc = null;
    for (const radius of [80, 200, 500, 1200]) {
      const resp = await streetViewService.getPanorama({ location: target, radius, source: google.maps.StreetViewSource.OUTDOOR }).catch(() => null);
      if (resp?.data?.location?.pano) {
        foundPano = resp.data.location.pano;
        foundLoc = resp.data.location.latLng;
        break;
      }
    }

    if (!foundPano) {
      msgEl.textContent = 'Street View is unavailable near there';
      return;
    }

    statusEl.style.display = 'none';

    let heading = 0;
    if (foundLoc) {
      const from = { lat: typeof foundLoc.lat === 'function' ? foundLoc.lat() : foundLoc.lat, lng: typeof foundLoc.lng === 'function' ? foundLoc.lng() : foundLoc.lng };
      
      const rad = Math.PI / 180;
      const y = Math.sin((target.lng - from.lng) * rad) * Math.cos(target.lat * rad);
      const x = Math.cos(from.lat * rad) * Math.sin(target.lat * rad)
        - Math.sin(from.lat * rad) * Math.cos(target.lat * rad) * Math.cos((target.lng - from.lng) * rad);
      heading = (Math.atan2(y, x) / rad + 360) % 360;
    }

    // Since we don't have the google namespace statically available before load, we cast panoEl as HTMLElement
    // wait, google is global after loadGoogleMaps.
    panorama = new google.maps.StreetViewPanorama(panoEl as HTMLElement, {
      pano: foundPano,
      visible: true,
      addressControl: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      panControl: true,
      zoomControl: true,
      enableCloseButton: false,
      pov: { heading, pitch: 0 },
      zoom: 0.6
    });

  } catch (err) {
    msgEl.textContent = 'Street View is unavailable right now';
  }
}

function onKey(event: KeyboardEvent): void {
  if (!current) return;
  if (event.key === 'Escape') close();
  if (state.see !== 'photos') return;
  const n = current.photos.length || 6;
  if (event.key === 'ArrowLeft') { state.shot = (state.shot + n - 1) % n; render(); }
  if (event.key === 'ArrowRight') { state.shot = (state.shot + 1) % n; render(); }
}

/** Open the detail panel for a property. */
export function openPropertyDetail(property: Property): void {
  current = property;
  state.see = 'photos';
  state.mode = 'details';
  state.shot = 0;
  state.intelMode = 'dayToDay';
  state.intelRouteId = null;
  state.savedSeeBeforeRoute = null;
  intel = { status: 'idle', vm: null, propertyId: null };
  ensureHost();
  window.addEventListener('keydown', onKey);
  render();
}

/** Close and tear down the panel. */
export function close(): void {
  window.removeEventListener('keydown', onKey);
  current = null;
  teardownPlan();
  clearRoute();
  earthMap = null;
  earthRoads = null;
  earthPin = null;
  mapEl = null;
  intel = { status: 'idle', vm: null, propertyId: null };
  if (host) { host.remove(); host = null; }
}

export const isPropertyDetailOpen = (): boolean => current !== null;
