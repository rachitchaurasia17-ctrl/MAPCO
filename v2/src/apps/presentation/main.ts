/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Client Presentation (approved map-first design)
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
import { adapter } from '../../packages/data/mock-adapter-v2';
import { getMaps, mountMapEngine, type RenderMode, type MountedMap } from '../../packages/maps';
import { streetViewUrl } from '../../packages/ui/utils';
import type { Mark, Property } from '../../packages/data/types';

type View = 'masterplan' | 'properties' | 'sectors';

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
  const maps = getMaps();
  let view: View = 'masterplan';
  let mode: RenderMode = 'original';
  let activeMapId = maps[0]?.id ?? '';
  let mapsOpen = false;
  let props: Property[] = [];
  let loadState: 'loading' | 'ready' | 'empty' | 'error' = 'loading';
  const pinned = new Set<string>();
  type PinPosition = { x: number; y: number; provenance: NonNullable<Mark['coordinateProvenance']> };
  const pinPositionsByMap = new Map<string, Map<string, PinPosition>>();

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
  </div>
  <aside class="pm-rail">
    <div class="pm-rail-head" id="pm-rail-head"></div>
    <div class="pm-rail-list" data-scroll id="pm-rail-list" aria-live="polite" aria-busy="true"></div>
  </aside>
</div>`;

  const stage = container.querySelector<HTMLElement>('#pm-stage')!;
  const grid = container.querySelector<HTMLElement>('#pm-grid')!;
  const topbar = container.querySelector<HTMLElement>('#pm-topbar')!;
  const botleft = container.querySelector<HTMLElement>('#pm-botleft')!;
  const botright = container.querySelector<HTMLElement>('#pm-botright')!;
  const railHead = container.querySelector<HTMLElement>('#pm-rail-head')!;
  const railList = container.querySelector<HTMLElement>('#pm-rail-list')!;

  mounted = mountMapEngine(stage);
  const pinLayer = document.createElement('div');
  pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:2;transform-origin:0 0;';
  stage.appendChild(pinLayer);

  async function loadPinPositions(): Promise<void> {
    const registry = await adapter.maps.listRegistry({ limit: 100 }, { signal: controller.signal });
    if (!registry.ok) return;
    const details = await Promise.all(
      registry.value.items.map((entry) => adapter.maps.get(entry.id, { signal: controller.signal })),
    );
    details.forEach((result) => {
      if (!result.ok) return;
      result.value.sets.forEach((set) => {
        const positions = pinPositionsByMap.get(set.id) ?? new Map<string, PinPosition>();
        set.marks.forEach((mark) => {
          if (mark.kind !== 'pin' || !mark.propertyId || Array.isArray(mark.points) || !mark.coordinateProvenance) return;
          positions.set(mark.propertyId, { ...mark.points, provenance: mark.coordinateProvenance });
        });
        pinPositionsByMap.set(set.id, positions);
      });
    });
  }

  function pinPositionFor(propertyId: string): PinPosition | undefined {
    return pinPositionsByMap.get(activeMapId)?.get(propertyId);
  }

  let animFrame = 0;
  function updatePins() {
    animFrame = requestAnimationFrame(updatePins);
    if (!mounted || !pinLayer || view === 'properties') return;
    const t = mounted.engine.transform;
    if (!t) return;
    pinLayer.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`;

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
      const provenanceLabel = pt.provenance === 'development-mock'
        ? 'Development-only mock position; not survey coordinates'
        : pt.provenance === 'map-authored' ? 'Map-authored position' : 'Survey coordinate';
      const is3d = mode === 'threeD';
      const upright = is3d ? 'rotateZ(5deg) rotateX(-44deg)' : '';

      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${px}px;top:${py}px;z-index:6;transform-style:preserve-3d;pointer-events:none`;
      el.innerHTML = `
        <div style="position:absolute;left:0;top:0;width:70px;height:70px;border-radius:50%;background:rgba(255,194,30,.5);animation:ringPulse 1.8s ease-out infinite;transform:translate(-50%,-50%);pointer-events:none"></div>
        <div data-pin-marker role="img" aria-label="${propLabel}: ${provenanceLabel}" title="${provenanceLabel}" style="position:relative;transform:translate(-50%,-100%) ${upright};transform-origin:bottom center;display:flex;flex-direction:column;align-items:center;animation:pinIn .4s cubic-bezier(.2,.9,.3,1.3) both;pointer-events:auto">
          <span style="display:flex;align-items:center;gap:7px;background:#ffc21e;color:#231a04;border-radius:12px;padding:9px 14px;white-space:nowrap;font-size:15px;font-weight:800;border:2.5px solid #fffdf7;box-shadow:0 10px 22px -8px rgba(40,26,2,.7)"><i class="ph-fill ph-map-pin" style="font-size:15px"></i>${propLabel}</span>
          ${pt.provenance === 'development-mock' ? '<span style="margin-top:4px;padding:3px 7px;border-radius:7px;background:#241d0c;color:#fff8e6;font-size:9px;font-weight:800;white-space:nowrap">MOCK · NOT SURVEY</span>' : ''}
          <span style="display:block;width:3px;height:14px;background:#ffc21e"></span>
          <span style="display:block;width:14px;height:14px;border-radius:50%;background:#ffc21e;border:3px solid #fffdfb;margin-top:-2px"></span>
        </div>
      `;
      pinLayer.appendChild(el);
    });
  }

  // ── renderers ─────────────────────────────────────────────
  function renderTopbar(): void {
    const map = maps.find((m) => m.id === activeMapId);
    topbar.innerHTML = `
      <div class="pm-brand pm-glass">
        <svg viewBox="0 0 40 40" style="width:34px;height:34px;flex:none;display:block">
          <rect width="40" height="40" rx="12" fill="#ffc21e"></rect>
          <path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#231a04"></path>
          <path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#231a04" opacity=".45"></path>
        </svg>
        <span class="pm-brand-name">Plot<b>Map</b></span>
      </div>
      <div style="position:relative">
        <button class="pm-mapbtn pm-glass" data-act="toggle-maps" aria-haspopup="true" aria-expanded="${mapsOpen}">
          <i class="ph-fill ph-map-trifold" style="font-size:19px;color:#ffd76b"></i>
          <span class="pm-mapname">${esc(map?.title ?? 'Select map')}</span>
          <i class="ph-bold ph-caret-${mapsOpen ? 'up' : 'down'}" style="font-size:12px;color:#ffd76b"></i>
        </button>
        ${mapsOpen ? `<div class="pm-pop" role="menu">
          ${maps.map((m) => `<button class="pm-pop-item" role="menuitem" data-act="pick-map" data-id="${m.id}" ${m.status !== 'active' ? 'disabled' : ''}>
            <i class="ph-fill ph-${m.kind === 'masterplan' ? 'map-trifold' : 'squares-four'}" style="font-size:18px;color:#a8792a"></i>
            <span class="lbl">${esc(m.title)}</span>
            <span class="tag" style="background:${m.id === activeMapId ? '#dcf3e5' : '#f0eaff'};color:${m.id === activeMapId ? '#12704a' : '#5b32c4'}">${m.id === activeMapId ? 'Open' : m.kind}</span>
          </button>`).join('')}
        </div>` : ''}
      </div>
      <div class="pm-viewtabs pm-glass" role="tablist">
        ${VIEWS.map((v) => `<button class="pm-viewtab ${view === v.k ? 'active' : ''}" role="tab" aria-selected="${view === v.k}" aria-controls="pm-grid" tabindex="${view === v.k ? '0' : '-1'}" data-act="view" data-view="${v.k}">${v.l}</button>`).join('')}
      </div>`;
  }

  function renderMapControls(): void {
    const map = maps.find((m) => m.id === activeMapId);
    const has3D = !!map?.threeD;
    botleft.innerHTML = `
      <button class="pm-ctl ${mode === 'original' ? 'active' : ''}" data-act="mode" data-mode="original"><i class="ph-fill ph-map-trifold" style="font-size:15px"></i>Original</button>
      <button class="pm-ctl ${mode === 'threeD' ? 'active' : ''}" data-act="mode" data-mode="threeD" ${has3D ? '' : 'disabled style="opacity:.4"'}><i class="ph-fill ph-cube" style="font-size:15px"></i>3D Map</button>
      <span class="pm-ctl-sep"></span>
      <button class="pm-ctl" data-act="fit"><i class="ph-fill ph-corners-out" style="font-size:15px"></i>Fit Map</button>`;
    const hasMockPins = [...pinned].some((id) => pinPositionFor(id)?.provenance === 'development-mock');
    botright.innerHTML = `
      <button class="pm-zoombtn" data-act="zoom-out" aria-label="Zoom out"><i class="ph-bold ph-minus"></i></button>
      <button class="pm-zoombtn" data-act="zoom-in" aria-label="Zoom in"><i class="ph-bold ph-plus"></i></button>
      <span class="pm-ctl-sep"></span>
      <i class="ph-fill ph-map-pin" style="font-size:18px;color:#ffd76b"></i>
      <span class="pm-pincount">${pinned.size} pinned</span>
      ${hasMockPins ? '<span class="pm-coordinate-note">Mock positions · not survey coordinates</span>' : ''}`;
    const showMap = view === 'masterplan' || view === 'sectors';
    botleft.style.display = showMap ? 'flex' : 'none';
    botright.style.display = showMap ? 'flex' : 'none';
    stage.style.display = showMap ? 'block' : 'none';
    grid.style.display = (view === 'properties' || view === 'sectors') ? 'block' : 'none';
    if (view === 'properties' || view === 'sectors') renderGrid();
    syncPins();
  }

  function renderGrid(): void {
    if (view === 'properties') {
      grid.innerHTML = `
        <div style="position:absolute;inset:0;overflow-y:auto;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">
          <div style="max-width:1260px;margin:0 auto;padding:84px 34px 56px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;animation:rowIn .45s ease both">
              <button style="height:36px;padding:0 14px;border-radius:10px;font-size:15px;font-weight:800;background:#5b32c4;color:#fff;box-shadow:0 8px 18px -8px rgba(91,50,196,.95)">All properties<span style="font-size:12.5px;font-weight:800;color:#5b32c4;background:#fff;padding:2px 7px;border-radius:99px;margin-left:8px">${props.length}</span></button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(298px,1fr));gap:20px;margin-top:22px">
              ${props.map(p => {
                const photo = p.photos[0];
                const bg = photo ? `background:#efdcb2 url('${esc(photo)}') center/cover` : `background:#efe6da;display:grid;place-items:center;color:#b3a894`;
                return `
                <button data-act="open-prop" data-id="${esc(p.id)}" style="text-align:left;background:#fffdfb;border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(88,52,168,.1),0 14px 30px -22px rgba(42,31,77,.6);cursor:pointer;transition:transform .15s,box-shadow .15s" onmouseenter="this.style.transform='translateY(-8px)';this.style.boxShadow='0 0 0 1px rgba(139,96,232,.35),0 3px 4px rgba(40,26,2,.06),0 44px 66px -36px rgba(139,96,232,.6)'" onmouseleave="this.style.transform='none';this.style.boxShadow='0 0 0 1px rgba(88,52,168,.1),0 14px 30px -22px rgba(42,31,77,.6)'">
                  <span style="position:relative;display:block;overflow:hidden">
                    <span style="display:block;aspect-ratio:16/9;${bg}">${photo ? '' : '<i class="ph-fill ph-image" style="font-size:34px"></i>'}</span>
                    <span style="position:absolute;top:13px;left:13px;display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:8px;background:rgba(28,21,51,.72);backdrop-filter:blur(10px);font-size:12px;font-weight:800;letter-spacing:.02em;font-variant-numeric:tabular-nums;color:#fff8e6">${esc(p.size)}</span>
                    <span style="position:absolute;right:13px;bottom:13px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(255,253,249,.95);box-shadow:0 2px 8px -3px rgba(28,21,51,.4);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:#1c1533"><i class="ph-fill ph-images" style="font-size:13px"></i>${p.photos.length} photos</span>
                  </span>
                  <span style="display:block;padding:18px 20px 20px;text-align:left">
                    <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.025em;color:#1c1533;line-height:1.06">${esc(p.area)}</span>
                    <span style="display:block;margin-top:5px;font-size:14px;font-weight:600;letter-spacing:.005em;color:#6f6489">${esc(p.loc)}</span>
                    <span style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
                      <span style="padding:6px 11px;border-radius:8px;background:#fff2cd;box-shadow:inset 0 0 0 1px rgba(168,121,42,.22);font-size:12px;font-weight:800;letter-spacing:.02em;color:#8a5a0c">${esc(p.facing)} facing</span>
                      ${p.position === 'corner' ? `<span style="padding:6px 11px;border-radius:8px;background:#e0f2e7;box-shadow:inset 0 0 0 1px rgba(20,108,58,.2);font-size:12px;font-weight:800;letter-spacing:.02em;color:#146c3a">Corner plot</span>` : ''}
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
      const sectors = maps.filter(m => m.kind === 'sector');
      grid.innerHTML = `
        <div style="position:absolute;inset:0;overflow-y:auto;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">
          <div style="max-width:1260px;margin:0 auto;padding:84px 34px 56px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;animation:rowIn .45s ease both">
              <button style="height:36px;padding:0 14px;border-radius:10px;font-size:15px;font-weight:800;background:#5b32c4;color:#fff;box-shadow:0 8px 18px -8px rgba(91,50,196,.95)">All sectors<span style="font-size:12.5px;font-weight:800;color:#5b32c4;background:#fff;padding:2px 7px;border-radius:99px;margin-left:8px">${sectors.length}</span></button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:20px;margin-top:22px">
              ${sectors.map(m => `
                <button data-act="open-sec" data-id="${esc(m.id)}" style="text-align:left;background:#fffdfb;border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(88,52,168,.1),0 14px 30px -22px rgba(42,31,77,.6);cursor:pointer;transition:transform .15s,box-shadow .15s" onmouseenter="this.style.transform='translateY(-8px)';this.style.boxShadow='0 0 0 1px rgba(139,96,232,.42),0 3px 4px rgba(40,26,2,.06),0 44px 66px -36px rgba(107,63,212,.7)'" onmouseleave="this.style.transform='none';this.style.boxShadow='0 0 0 1px rgba(88,52,168,.1),0 14px 30px -22px rgba(42,31,77,.6)'">
                  <span style="position:relative;display:block;height:172px;overflow:hidden">
                    <span style="display:block;width:100%;height:100%;background:#efdcb2 url('${esc(m.original.src)}') center/cover"></span>
                    <span style="position:absolute;top:13px;left:13px;display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:8px;background:rgba(28,21,51,.72);backdrop-filter:blur(10px);font-size:12px;font-weight:800;letter-spacing:.02em;color:#fff8e6">${esc(m.city)}</span>
                    ${m.linkedPropertyIds.length > 0 ? `<span style="position:absolute;right:13px;bottom:13px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:6px 12px;border-radius:999px;background:#ffc21e;box-shadow:0 2px 8px -3px rgba(120,86,10,.6);font-size:12px;font-weight:800;color:#231a04"><i class="ph-fill ph-map-pin-area" style="font-size:13px"></i>${m.linkedPropertyIds.length} plots</span>` : ''}
                  </span>
                  <span style="display:block;padding:18px 20px 20px;text-align:left">
                    <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.025em;color:#1c1533;line-height:1.06">${esc(m.title)}</span>
                    <span style="display:block;margin-top:5px;font-size:14px;font-weight:600;color:#6f6489">${esc(m.sectorOrBlock)}</span>
                    <span style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:15px;font-weight:800;color:#8a5a0c">Open the layout <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
                  </span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  function pcard(p: Property): string {
    const photo = p.photos[0];
    const pin = pinPositionFor(p.id);
    const mockPin = pin?.provenance === 'development-mock';
    return `
    <article class="pm-pcard">
      <div class="pm-pcard-photo">
        ${photo ? `<img src="${esc(photo)}" alt="${esc(p.area)}" loading="lazy">` : `<div class="pm-pcard-noimg"><i class="ph-fill ph-image" style="font-size:34px"></i></div>`}
        ${p.photos.length ? `<span class="pm-pcard-count"><i class="ph-fill ph-images"></i>${p.photos.length}</span>` : ''}
      </div>
      <div class="pm-pcard-body">
        <div class="pm-pcard-area">${esc(p.area)}</div>
        <div class="pm-pcard-loc">${esc(p.loc)}</div>
        <div class="pm-pcard-facts">
          <span class="pm-pcard-fact">${esc(p.size)}</span>
          <span class="pm-pcard-fact">${esc(p.facing)}</span>
          <span class="pm-pcard-fact">${esc(p.position)}</span>
        </div>
        <div class="pm-pcard-actions">
          <button class="pm-pcard-act pm-pcard-act--pin" data-act="pin" data-id="${esc(p.id)}" ${mockPin ? 'title="Development-only mock position; not survey coordinates"' : ''}><i class="ph-fill ph-map-pin"></i>${pinned.has(p.id) ? 'Pinned' : mockPin ? 'Pin mock preview' : 'Pin on map'}</button>
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
      </div>`;
    if (loadState === 'loading') { railList.innerHTML = '<span class="pm-sr-only" role="status">Loading published plots…</span>' + '<div class="pm-skel"></div>'.repeat(3); return; }
    if (loadState === 'error') { railList.innerHTML = `<div class="pm-rail-state" role="alert"><i class="ph-fill ph-warning-circle"></i>Could not load plots.</div>`; return; }
    if (loadState === 'empty' || props.length === 0) { railList.innerHTML = `<div class="pm-rail-state"><i class="ph-fill ph-tray"></i>No published plots to show yet.</div>`; return; }
    railList.innerHTML = props.map(pcard).join('');
  }

  async function applyMap(): Promise<void> {
    if (!mounted) return;
    await mounted.engine.setMap(activeMapId, { mode });
  }

  // ── interaction (single delegated listener) ───────────────
  const onClick = (ev: Event) => {
    const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    const act = t.dataset.act;
    switch (act) {
      case 'toggle-maps': mapsOpen = !mapsOpen; renderTopbar(); break;
      case 'pick-map': {
        activeMapId = t.dataset.id!; mapsOpen = false; mode = 'original';
        const m = maps.find((x) => x.id === activeMapId);
        view = m?.kind === 'sector' ? 'sectors' : 'masterplan';
        renderTopbar(); renderMapControls(); void applyMap(); break;
      }
      case 'open-sec': {
        activeMapId = t.dataset.id!;
        const m = maps.find((x) => x.id === activeMapId);
        view = m?.kind === 'sector' ? 'sectors' : 'masterplan';
        renderTopbar(); renderMapControls(); void applyMap(); break;
      }
      case 'open-prop': {
        // Find property map
        const propId = t.dataset.id!;
        const p = props.find(x => x.id === propId);
        if (p) {
          // If property is pinned in a map, go to that map. Otherwise go to masterplan
          // For parity, just go to masterplan and select it for now
          view = 'masterplan';
          if (!pinned.has(p.id)) {
            pinned.add(p.id);
          }
          renderTopbar(); renderMapControls(); void applyMap();
        }
        break;
      }
      case 'view': view = t.dataset.view as View; mapsOpen = false; renderTopbar(); renderMapControls(); break;
      case 'mode': {
        if ((t as HTMLButtonElement).disabled) break;
        mode = t.dataset.mode as RenderMode; renderMapControls(); void mounted!.engine.setMode(mode); break;
      }
      case 'fit': mounted!.engine.fit(); break;
      case 'zoom-in': mounted!.engine.zoom(1.3); break;
      case 'zoom-out': mounted!.engine.zoom(1 / 1.3); break;
      case 'pin': {
        const id = t.dataset.id!;
        if (pinned.has(id)) pinned.delete(id); else pinned.add(id);
        if (view !== 'masterplan') { view = 'masterplan'; renderTopbar(); }
        renderMapControls(); renderRail(); break;
      }
    }
  };
  container.addEventListener('click', onClick);

  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && mapsOpen) { mapsOpen = false; renderTopbar(); } };
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
    if (mapsOpen && !(e.target as HTMLElement).closest('.pm-mapbtn, .pm-pop')) { mapsOpen = false; renderTopbar(); }
  };
  document.addEventListener('click', onDocClick, true);

  // ── initial paint ─────────────────────────────────────────
  renderTopbar();
  renderMapControls();
  renderRail();
  void applyMap();

  // load published plots (client-safe: price never read)
  const [res] = await Promise.all([
    adapter.properties.list({ limit: 24 }, { signal: controller.signal }),
    loadPinPositions(),
  ]);
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
    mounted?.dispose();
    mounted = null;
  };
  window.addEventListener('pagehide', cleanup, { once: true });
  return cleanup;
}

const app = document.getElementById('app');
if (app) void initPresentation(app);
