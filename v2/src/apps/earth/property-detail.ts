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

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

const PCAPS = ['Site view', 'Approach road', 'Surroundings', 'Front road', 'Wide angle', 'Evening view'];

type SeeTab = 'photos' | 'earth' | 'sector' | 'plan' | 'street';
type Mode = 'details' | 'intel';

interface DetailState {
  see: SeeTab;
  mode: Mode;
  shot: number;
}

interface Group { title: string; icon: string; rows: { k: string; v: string }[] }

let host: HTMLElement | null = null;
let current: Property | null = null;
const state: DetailState = { see: 'photos', mode: 'details', shot: 0 };

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
    mk('Ownership and status', 'ph-fill ph-shield-check', [
      ['Ownership', p.ownership],
      ['Approval', p.approval || record?.approvals?.join(', ')],
      ['Possession', p.possession],
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

async function initEarthMap(p: Property): Promise<void> {
  const mapHost = document.getElementById('pd-earth-map');
  if (!mapHost) return;

  const pos = propertyPos(p);
  if (!pos) {
    mapHost.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;background:#0f2018;color:#a99775"><div style="text-align:center"><i class="ph-fill ph-map-pin-area" style="font-size:40px;color:#ffd76b"></i><div style="margin-top:10px;font-size:15px;font-weight:700">Earth location not set</div></div></div>`;
    return;
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
  if (!google.maps || !document.getElementById('pd-earth-map')) return;

  earthMap = new google.maps.Map(mapHost, {
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
  controls.style.margin = '16px';
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.gap = '3px';
  controls.style.padding = '4px';
  controls.style.borderRadius = '14px';
  controls.style.background = 'rgba(28, 23, 10, .76)';
  controls.style.backdropFilter = 'blur(16px)';
  (controls.style as any).webkitBackdropFilter = 'blur(16px)';
  controls.style.border = '1px solid rgba(255, 255, 255, .15)';
  controls.style.boxShadow = '0 16px 38px -22px rgba(0, 0, 0, .85)';
  
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

  earthMap.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(controls);
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
    ['rgba(255,201,60,.1)', 'rgba(255,201,60,.3)', '#ffd76b'],
    ['rgba(151,110,235,.14)', 'rgba(151,110,235,.34)', '#c3a9ff'],
    ['rgba(123,224,164,.11)', 'rgba(123,224,164,.3)', '#7be0a4'],
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
          ${SEE.map(([k, label, icon]) => `<button data-pd="see" data-see="${k}" title="${label}" style="${seeBtn(state.see === k)}"><i class="${icon}" style="font-size:20px"></i></button>`).join('')}
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
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:13px">
            <span style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#a99775">Client price</span>
          </div>
          <div style="display:flex;gap:4px;padding:4px;border-radius:14px;background:rgba(255,201,60,.14)">
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
          }).join('') : `
            ${standoutFor(p).length ? `<div style="margin-top:18px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#e0c88a">Why this stands out</div>
            ${standoutFor(p).map((a) => `<div style="display:flex;align-items:flex-start;gap:11px;padding:10px 0;${rowShadow}"><i class="${a.icon}" style="font-size:18px;color:#7be0a4;flex:none;margin-top:1px"></i><span style="font-size:15px;font-weight:700;color:#fff;line-height:1.35;text-wrap:pretty">${esc(a.t)}</span></div>`).join('')}` : ''}

            ${landmarks.length ? `<div style="margin-top:20px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#e0c88a">Major places nearby</div>
            ${landmarks.map((l) => `<div style="display:flex;align-items:center;gap:11px;padding:10px 0;${rowShadow}"><i class="${esc(l.icon)}" style="font-size:17px;color:#ffd76b;flex:none"></i><span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:#fffdf7">${esc(l.name)}</span><span style="flex:none;font-size:14.5px;font-weight:800;color:#7be0a4">${esc(l.distance)}</span></div>`).join('')}` : ''}

            <div style="margin-top:20px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#e0c88a">Buyer considerations</div>
            ${checksFor(p).map((t) => `<div style="display:flex;align-items:flex-start;gap:11px;padding:10px 0;${rowShadow}"><i class="ph-bold ph-check-square-offset" style="font-size:17px;color:#ffd76b;flex:none;margin-top:2px"></i><span style="font-size:14.5px;font-weight:700;color:#e9dfc9;line-height:1.35;text-wrap:pretty">${esc(t)}</span></div>`).join('')}

            <div style="margin-top:16px;font-size:12px;font-weight:700;color:#8f8064;line-height:1.45;text-wrap:pretty">From MAPCO verified records, Earth location and road intelligence. Nothing estimated.</div>`}
        </div>
      </aside>
    </div>
  </div>`;

  host.querySelector('[data-pd="close"]')?.addEventListener('click', close);
  host.querySelectorAll<HTMLElement>('[data-pd="see"]').forEach((el) =>
    el.addEventListener('click', () => { state.see = el.dataset.see as SeeTab; render(); }));
  host.querySelectorAll<HTMLElement>('[data-pd="mode"]').forEach((el) =>
    el.addEventListener('click', () => { state.mode = el.dataset.mode as Mode; render(); }));
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
  } else {
    earthMap = null;
    earthRoads = null;
    earthPin = null;
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
  ensureHost();
  window.addEventListener('keydown', onKey);
  render();
}

/** Close and tear down the panel. */
export function close(): void {
  window.removeEventListener('keydown', onKey);
  current = null;
  teardownPlan();
  earthMap = null;
  earthRoads = null;
  earthPin = null;
  if (host) { host.remove(); host = null; }
}

export const isPropertyDetailOpen = (): boolean => current !== null;
