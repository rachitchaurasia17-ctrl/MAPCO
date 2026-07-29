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
import type { Property } from '../../packages/data/types';

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

  let mounted: MountedMap | null = null;
  const controller = new AbortController();

  // ── static shell ──────────────────────────────────────────
  container.innerHTML = `
<div class="pm-pres">
  <div class="pm-pres-map">
    <div class="pm-pres-stage" id="pm-stage"></div>
    <div class="pm-pres-topbar" id="pm-topbar"></div>
    <div class="pm-botleft pm-glass-lite" id="pm-botleft"></div>
    <div class="pm-botright pm-glass" id="pm-botright"></div>
  </div>
  <aside class="pm-rail">
    <div class="pm-rail-head" id="pm-rail-head"></div>
    <div class="pm-rail-list" data-scroll id="pm-rail-list"></div>
  </aside>
</div>`;

  const stage = container.querySelector<HTMLElement>('#pm-stage')!;
  const topbar = container.querySelector<HTMLElement>('#pm-topbar')!;
  const botleft = container.querySelector<HTMLElement>('#pm-botleft')!;
  const botright = container.querySelector<HTMLElement>('#pm-botright')!;
  const railHead = container.querySelector<HTMLElement>('#pm-rail-head')!;
  const railList = container.querySelector<HTMLElement>('#pm-rail-list')!;

  mounted = mountMapEngine(stage);

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
        ${VIEWS.map((v) => `<button class="pm-viewtab ${view === v.k ? 'active' : ''}" role="tab" aria-selected="${view === v.k}" data-act="view" data-view="${v.k}">${v.l}</button>`).join('')}
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
    botright.innerHTML = `
      <button class="pm-zoombtn" data-act="zoom-out" aria-label="Zoom out"><i class="ph-bold ph-minus"></i></button>
      <button class="pm-zoombtn" data-act="zoom-in" aria-label="Zoom in"><i class="ph-bold ph-plus"></i></button>
      <span class="pm-ctl-sep"></span>
      <i class="ph-fill ph-map-pin" style="font-size:18px;color:#ffd76b"></i>
      <span class="pm-pincount">${pinned.size} pinned</span>`;
    const showMap = view === 'masterplan' || view === 'sectors';
    botleft.style.display = showMap ? 'flex' : 'none';
    botright.style.display = showMap ? 'flex' : 'none';
    stage.style.display = showMap ? 'block' : 'none';
  }

  function pcard(p: Property): string {
    const photo = p.photos[0];
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
          <button class="pm-pcard-act pm-pcard-act--pin" data-act="pin" data-id="${esc(p.id)}"><i class="ph-fill ph-map-pin"></i>${pinned.has(p.id) ? 'Pinned' : 'Pin on map'}</button>
          <a class="pm-pcard-act pm-pcard-act--sv" href="${esc(streetViewUrl(p.loc))}" target="_blank" rel="noopener"><i class="ph-fill ph-street-view"></i>Street view</a>
        </div>
      </div>
    </article>`;
  }

  function renderRail(): void {
    railHead.innerHTML = `
      <div class="pm-filter">
        <i class="ph-fill ph-squares-four" style="font-size:20px;color:#a8792a"></i>
        <span style="flex:1;min-width:0">
          <span class="pm-filter-eyebrow">SHOWING</span>
          <span class="pm-filter-label">Everything</span>
        </span>
        <span class="pm-filter-count">${loadState === 'ready' ? props.length : 0}</span>
      </div>`;
    if (loadState === 'loading') { railList.innerHTML = '<div class="pm-skel"></div>'.repeat(3); return; }
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
  const res = await adapter.properties.list({ limit: 24 }, { signal: controller.signal });
  if (res.ok) {
    props = res.value.items.filter((p) => p.published && !p.sold);
    loadState = props.length ? 'ready' : 'empty';
  } else if (res.error.code !== 'aborted') {
    loadState = 'error';
  }
  renderRail();

  // ── cleanup ───────────────────────────────────────────────
  const cleanup = () => {
    container.removeEventListener('click', onClick);
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
