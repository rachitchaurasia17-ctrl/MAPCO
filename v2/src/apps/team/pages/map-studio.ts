/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Map Studio (three flows)
   ---------------------------------------------------------------
   "What are we publishing?" landing → three flows:
    1. Publish Masterplan  — click roads/blocks on the map to build a
       highlight SET (combination), name + save it. Save many; delete any.
       Each set becomes a state of the cycling Highlights button in
       Client Presentation. No sidebar — you select directly on the map.
    2. Publish Sector Map  — place a pin on the map, pick a property, link.
    3. Manage Published    — every live map + its linked properties;
       unlink a property, link one, or unpublish the map.
   Throw-free; supabase RPCs via getMapStudio(); mock fixture offline.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';
import { getMapStudio, type StudioMap, type HighlightSet } from '../../../packages/data/map-studio';
import { loadSvgOverlay, type SvgHighlightHandle } from '../../../packages/maps';
import { hasSafeInAppHistory } from '../../../packages/ui/back-button';
import type { Property } from '../../../packages/data/types';

type Flow = 'masterplan' | 'sector' | 'manage';

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function renderMapStudio(el: HTMLElement): Promise<void> {
  const repo = getMapStudio();
  // Map Studio opens on a chooser landing (the "old" 3-big-button screen).
  // Picking a flow enters it; the three options are not shown together again
  // until the user steps back to the landing.
  let onLanding = true;
  let flow: Flow = 'masterplan';
  let maps: StudioMap[] = [];
  let props: Property[] = [];
  let selectedMapId = '';
  let overlay: SvgHighlightHandle | null = null;
  let overlayToken = 0;
  let sets: HighlightSet[] = [];
  let labels: Record<string, string> = {};  // per-shape names for the set being built
  let toast = '';
  // sector-link flow state
  let pin: { x: number; y: number } | null = null;
  let linkPropId = '';

  const [mapsRes, propsRes] = await Promise.all([
    repo.listMaps(),
    adapter.properties.list({ limit: 50 }),
  ]);
  if (mapsRes.ok && mapsRes.data) maps = mapsRes.data;
  if (propsRes.ok) props = [...propsRes.value.items];

  const masterplans = () => maps.filter((m) => m.kind === 'masterplan' && m.status !== 'archived');
  const selectedMap = () => maps.find((m) => m.id === selectedMapId);
  const flash = (msg: string) => { toast = msg; render(); setTimeout(() => { toast = ''; render(); }, 2200); };

  function disposeOverlay(): void { overlay?.destroy(); overlay = null; }

  /** Load the premium overlay for the selected map into #ms-ovhost (interactive). */
  async function mountOverlay(interactive: boolean): Promise<void> {
    disposeOverlay();
    const m = selectedMap();
    const host = el.querySelector<HTMLElement>('#ms-ovhost');
    const ov = m?.assets?.overlay;
    if (!m || !ov?.path || !host) return;
    const vb = { w: ov.w || m.dims?.original?.w || 1000, h: ov.h || m.dims?.original?.h || 1000 };
    const token = ++overlayToken;
    const handle = await loadSvgOverlay(ov.path, vb);
    if (token !== overlayToken || !handle) { handle?.destroy(); return; }
    overlay = handle;
    handle.el.style.width = '100%'; handle.el.style.height = '100%';
    handle.setInteractive(interactive);
    handle.setLabels(labels);
    handle.onSelectChange(() => {
      const c = el.querySelector('#ms-selcount'); if (c) c.textContent = String(handle.selection().length);
      const b = el.querySelector<HTMLButtonElement>('#ms-saveset'); if (b) b.disabled = handle.selection().length === 0;
      renderNameList();
    });
    host.appendChild(handle.el);
    renderNameList();
  }

  /** Rebuild the per-shape name inputs for the current selection (no full re-render). */
  function renderNameList(): void {
    const box = el.querySelector<HTMLElement>('#ms-namelist');
    if (!box || !overlay) return;
    const sel = overlay.selection();
    const items = overlay.items();
    box.innerHTML = sel.length
      ? sel.map((id) => { const it = items.find((x) => x.id === id); return `<div style="display:flex;align-items:center;gap:8px"><span style="width:96px;flex:none;font-size:12px;font-weight:800;color:#8d8271;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it?.label ?? id)}</span><input data-namefor="${esc(id)}" value="${esc(labels[id] ?? '')}" placeholder="Add a name (e.g. PR-7 Road)" style="flex:1;height:34px;border:1px solid #ddd2f5;border-radius:9px;padding:0 10px;font:inherit;font-size:13px"></div>`; }).join('')
      : '<div style="font-size:13px;color:#8d8271">Tap shapes on the map, then name them here.</div>';
  }

  // ── flow openers ──────────────────────────────────────────────
  async function openMasterplan(mapId: string): Promise<void> {
    flow = 'masterplan'; selectedMapId = mapId; labels = {};
    const r = await repo.listHighlightSets(mapId); sets = r.ok && r.data ? r.data : [];
    render();
    await mountOverlay(true);
  }
  async function openSector(mapId: string): Promise<void> {
    flow = 'sector'; selectedMapId = mapId; pin = null; linkPropId = '';
    render();
    await mountOverlay(false); // overlay shown non-interactive for context
  }

  // ── views ─────────────────────────────────────────────────────
  function mapPreviewHtml(placing: boolean): string {
    const m = selectedMap();
    const raster = m?.assets?.original?.path || m?.assets?.threeD?.path || '';
    const w = m?.dims?.original?.w || 4, h = m?.dims?.original?.h || 3;
    const noOverlay = !m?.assets?.overlay?.path;
    return `
      <div id="ms-stage" data-wh="${w}x${h}" style="position:relative;width:100%;height:100%;min-height:260px;background:#0b0714;border-radius:18px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,248,230,.14),0 30px 60px -30px rgba(0,0,0,.7);${placing ? 'cursor:crosshair' : ''}">
        ${raster ? `<img src="${esc(raster)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;user-select:none;-webkit-user-drag:none">` : '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#8d8271">No image</div>'}
        <div id="ms-ovhost" style="position:absolute;inset:0;pointer-events:${flow === 'masterplan' ? 'auto' : 'none'}"></div>
        ${flow === 'sector' && pin ? `<div style="position:absolute;left:${pin.x * 100}%;top:${pin.y * 100}%;transform:translate(-50%,-100%);z-index:5"><i class="ph-fill ph-map-pin" style="font-size:34px;color:#2f7bff;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))"></i></div>` : ''}
        ${flow === 'masterplan' && noOverlay ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(24,16,4,.8);color:#fff8e6;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:700">This map has no aligned highlight layer yet.</div>` : ''}
      </div>`;
  }

  // ── dark full-screen editor (item 7) ──────────────────────────
  function darkPicker(kind: 'masterplan' | 'sector', act: string): string {
    const list = kind === 'masterplan' ? masterplans() : maps.filter((m) => m.kind === 'sector' && m.status !== 'archived');
    if (!list.length) return `<div style="color:#b7ab90;font-size:13px;padding:10px">No ${kind === 'masterplan' ? 'city masterplans' : 'sector maps'} yet.</div>`;
    return `<div data-scroll style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1;min-height:0">${list.map((m) => {
      const r = m.assets?.original?.path || m.assets?.threeD?.path || '';
      return `<button data-act="${act}" data-id="${esc(m.id)}" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:12px;background:rgba(255,248,230,.06);text-align:left;cursor:pointer"><span style="width:48px;height:38px;border-radius:8px;flex:none;background:#0b0714 ${r ? `url('${esc(r)}') center/cover` : ''}"></span><span style="flex:1;min-width:0"><span style="display:block;font-size:13.5px;font-weight:800;color:#fff8e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.city || m.label)}${kind === 'sector' ? ` · ${esc(m.sector || m.label)}` : ''}</span><span style="display:block;font-size:11.5px;color:#b7ab90">${m.kind}${m.status === 'published' ? ' · live' : ''}</span></span></button>`;
    }).join('')}</div>`;
  }

  /** Sidebar controls for the active flow. */
  function sidebarBodyHtml(): string {
    const m = selectedMap();
    if (flow === 'masterplan') {
      if (!m) return `<div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c9b477;margin-bottom:8px">Pick a city map</div>${darkPicker('masterplan', 'pick-master')}`;
      const setChips = sets.length
        ? sets.map((sset) => `<div style="display:inline-flex;align-items:center;gap:7px;background:rgba(255,201,60,.16);color:#ffd76b;border-radius:999px;padding:6px 7px 6px 12px;font-size:12.5px;font-weight:800"><button data-act="play-set" data-id="${esc(sset.id)}" title="Preview" style="background:none;color:inherit;font-weight:800;cursor:pointer">${esc(sset.name)} · ${sset.itemIds.length}</button><button data-act="del-set" data-id="${esc(sset.id)}" aria-label="Delete" style="width:20px;height:20px;border-radius:50%;background:rgba(255,201,60,.22);display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:11px"></i></button></div>`).join('')
        : '<span style="font-size:12.5px;color:#b7ab90">No sets yet.</span>';
      return `
        <div style="flex:none;display:flex;flex-direction:column;gap:9px">
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#e7dcc4;font-weight:700">Selected <b id="ms-selcount" style="color:#ffd76b">0</b></div>
          <input id="ms-setname" placeholder="Set name" style="height:40px;border:1px solid rgba(255,248,230,.16);border-radius:11px;padding:0 12px;font:inherit;font-size:14px;background:rgba(255,248,230,.06);color:#fff8e6">
          <div style="display:flex;gap:8px"><button id="ms-saveset" data-act="save-set" disabled style="flex:1;height:40px;border-radius:11px;background:#ffc93c;color:#231a04;font-weight:800;cursor:pointer">Save set</button><button data-act="clear-sel" style="height:40px;padding:0 13px;border-radius:11px;background:rgba(255,248,230,.1);color:#fff8e6;font-weight:800;cursor:pointer">Clear</button></div>
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;margin-top:12px">
          <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c9b477;margin-bottom:7px">Name the shapes</div>
          <div id="ms-namelist" data-scroll style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:7px"></div>
        </div>
        <div style="flex:none;margin-top:12px"><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c9b477;margin-bottom:7px">Saved sets</div><div style="display:flex;flex-wrap:wrap;gap:7px">${setChips}</div></div>`;
    }
    if (flow === 'sector') {
      if (!m) return `<div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c9b477;margin-bottom:8px">Pick a sector map</div>${darkPicker('sector', 'pick-sector')}`;
      return `
        <div style="display:flex;flex-direction:column;gap:11px">
          <div style="font-size:13.5px;color:${pin ? '#7be0a4' : '#b7ab90'};font-weight:800">${pin ? `Pin at ${(pin.x * 100).toFixed(0)}%, ${(pin.y * 100).toFixed(0)}%` : 'Click the map to drop a pin'}</div>
          <select id="ms-linkprop" style="height:42px;border:1px solid rgba(255,248,230,.16);border-radius:11px;padding:0 12px;font:inherit;font-size:14px;background:rgba(255,248,230,.06);color:#fff8e6">
            <option value="">Choose a plot…</option>
            ${props.map((p) => `<option value="${esc(p.id)}"${linkPropId === p.id ? ' selected' : ''} style="color:#111">${esc(p.area)}${p.size ? ` · ${esc(p.size)}` : ''}</option>`).join('')}
          </select>
          <button data-act="do-link" ${(!pin || !linkPropId) ? 'disabled' : ''} style="height:44px;border-radius:12px;background:#ffc93c;color:#231a04;font-weight:800;cursor:pointer;${(!pin || !linkPropId) ? 'opacity:.4' : ''}">Link plot to this pin</button>
        </div>`;
    }
    return `<div style="font-size:13px;color:#b7ab90;line-height:1.5">Every live map and its linked plots are listed on the right. Unlink a plot, link one, or unpublish a map.</div>`;
  }

  /** Manage-published list (matches the handoff card layout). */
  function manageMainHtml(): string {
    const live = maps.filter((m) => m.status === 'published');
    const propById = new Map(props.map((p) => [p.id, p]));
    const linkedFor = (mapId: string) => props.filter((p) => p.mapPlacement?.mapId === mapId);
    const rows = live.length ? live.map((m) => {
      const linked = linkedFor(m.id);
      const raster = m.assets?.original?.path || m.assets?.threeD?.path || '';
      return `<div style="background:rgba(255,248,230,.05);border:1px solid rgba(255,248,230,.12);border-radius:18px;padding:16px 18px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:13px;flex-wrap:wrap">
          <span style="width:58px;height:44px;border-radius:10px;flex:none;background:#0b0714 ${raster ? `url('${esc(raster)}') center/cover` : ''}"></span>
          <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#fff8e6">${esc(m.label)}</div><div style="font-size:12.5px;color:#b7ab90">${esc(m.city)} · ${m.kind}</div></div>
          <span style="font-size:12px;font-weight:800;color:#7be0a4;background:rgba(123,224,164,.14);border-radius:999px;padding:4px 11px">live${m.clientVisible ? '' : ' · hidden'}</span>
          <button data-act="unpublish" data-id="${esc(m.id)}" style="height:34px;padding:0 13px;border-radius:10px;background:rgba(255,120,120,.16);color:#ff9b9b;font-weight:800;font-size:13px;cursor:pointer">Unpublish</button>
        </div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          ${linked.length ? linked.map((p) => `<span style="display:inline-flex;align-items:center;gap:7px;background:rgba(47,123,255,.16);color:#9dc1ff;border-radius:999px;padding:6px 8px 6px 12px;font-size:13px;font-weight:700"><i class="ph-fill ph-map-pin"></i>${esc(propById.get(p.id)?.area ?? p.id)}<button data-act="unlink" data-id="${esc(p.id)}" aria-label="Unlink" style="width:20px;height:20px;border-radius:50%;background:rgba(157,193,255,.2);display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:11px"></i></button></span>`).join('') : '<span style="font-size:13px;color:#b7ab90">No plots linked yet.</span>'}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <select data-linkmap="${esc(m.id)}" style="height:38px;border:1px solid rgba(255,248,230,.16);border-radius:10px;padding:0 10px;font:inherit;font-size:13.5px;background:rgba(255,248,230,.06);color:#fff8e6">
            <option value="">Link a plot…</option>
            ${props.filter((p) => p.mapPlacement?.mapId !== m.id).map((p) => `<option value="${esc(p.id)}" style="color:#111">${esc(p.area)}</option>`).join('')}
          </select>
          <button data-act="link-here" data-id="${esc(m.id)}" style="height:38px;padding:0 15px;border-radius:10px;background:rgba(255,248,230,.1);color:#fff8e6;font-weight:800;font-size:13.5px;cursor:pointer">Link</button>
        </div>
      </div>`;
    }).join('') : '<div style="padding:30px;color:#b7ab90;text-align:center">No published maps yet.</div>';
    return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:2px">${rows}</div>`;
  }

  /** The 3-big-button chooser shown when Map Studio first opens. */
  function landingHtml(): string {
    const card = (f: Flow, title: string, sub: string, icon: string, tint: string) =>
      `<button data-act="choose" data-flow="${f}" style="flex:1;min-width:240px;max-width:340px;display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:30px 28px;border-radius:24px;background:rgba(255,248,230,.05);border:1px solid rgba(255,248,230,.14);color:#fff8e6;text-align:left;cursor:pointer;transition:transform .16s,background .16s">
        <span style="width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:${tint};color:#231a04"><i class="ph-fill ${icon}" style="font-size:32px"></i></span>
        <span style="font-family:var(--pm-font-display,'Newsreader',serif);font-weight:500;font-size:26px;line-height:1.1">${esc(title)}</span>
        <span style="font-size:14px;color:#b7ab90;line-height:1.5">${esc(sub)}</span>
        <span style="margin-top:6px;display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#ffd76b">Open<i class="ph-bold ph-arrow-right"></i></span>
      </button>`;
    return `
      <div style="position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#0f0a1a;background-image:radial-gradient(60% 50% at 100% 0%,rgba(145,97,0,.22),transparent 60%),radial-gradient(60% 50% at 0% 100%,rgba(91,50,196,.22),transparent 60%);font-family:var(--pm-font-ui,'Hanken Grotesk',sans-serif)">
        <div style="display:flex;align-items:center;gap:12px;padding:20px 26px">
          <button data-act="exit" aria-label="Close Map Studio" style="width:42px;height:42px;border-radius:12px;background:rgba(255,248,230,.1);color:#fff8e6;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-arrow-left" style="font-size:18px"></i></button>
          <img src="/assets/mapco-logo.png" alt="MAPCO" style="width:38px;height:38px;object-fit:contain">
          <div><div style="font-size:16px;font-weight:800;color:#fff8e6;line-height:1">Map Studio</div><div style="font-size:12px;color:#c9b477">What are we publishing?</div></div>
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px">
          <div style="width:100%;max-width:1120px">
            <h1 style="margin:0 0 6px;font-family:var(--pm-font-display,'Newsreader',serif);font-weight:500;font-size:38px;color:#fff8e6;letter-spacing:-.01em">Map Studio</h1>
            <p style="margin:0 0 30px;font-size:16px;color:#b7ab90">Pick one flow to begin. You can step back here anytime.</p>
            <div style="display:flex;gap:18px;flex-wrap:wrap">
              ${card('masterplan', 'Publish Masterplan', 'Highlight roads and blocks on a city map, name them, and save highlight sets clients can cycle through.', 'ph-map-trifold', '#ffc93c')}
              ${card('sector', 'Publish Sector Map', 'Drop a pin on a sector map and link one of your plots so it shows in Client Presentation.', 'ph-map-pin-area', '#7be0a4')}
              ${card('manage', 'Manage Published', 'Review every live map and its linked plots — link, unlink, or unpublish a map.', 'ph-squares-four', '#c4b5fd')}
            </div>
          </div>
        </div>
      </div>
      ${toast ? `<div style="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1f4d3a;color:#fff;font-weight:700;padding:11px 20px;border-radius:999px;z-index:70;box-shadow:0 14px 30px -12px rgba(0,0,0,.4)">${esc(toast)}</div>` : ''}`;
  }

  function render(): void {
    if (onLanding) { el.innerHTML = landingHtml(); return; }
    const title = flow === 'masterplan' ? 'Publish Masterplan' : flow === 'sector' ? 'Publish Sector Map' : 'Manage Published';
    const main = flow === 'manage' ? manageMainHtml() : mapPreviewHtml(flow === 'sector');
    el.innerHTML = `
      <div style="position:fixed;inset:0;z-index:60;display:flex;background:#0f0a1a;background-image:radial-gradient(60% 50% at 100% 0%,rgba(145,97,0,.22),transparent 60%),radial-gradient(60% 50% at 0% 100%,rgba(91,50,196,.22),transparent 60%);font-family:var(--pm-font-ui,'Hanken Grotesk',sans-serif)">
        <aside style="width:326px;flex:none;display:flex;flex-direction:column;min-height:0;background:rgba(18,12,26,.72);backdrop-filter:blur(14px);border-right:1px solid rgba(255,248,230,.1);padding:16px 16px 18px">
          <div style="flex:none;display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <button data-act="exit" aria-label="Close Map Studio" style="width:40px;height:40px;border-radius:12px;background:rgba(255,248,230,.1);color:#fff8e6;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-arrow-left" style="font-size:18px"></i></button>
            <img src="/assets/mapco-logo.png" alt="MAPCO" style="width:34px;height:34px;object-fit:contain">
            <div><div style="font-size:15px;font-weight:800;color:#fff8e6;line-height:1">Map Studio</div><div style="font-size:11.5px;color:#c9b477">${esc(title)}</div></div>
          </div>
          <div style="flex:1;min-height:0;display:flex;flex-direction:column">${sidebarBodyHtml()}</div>
        </aside>
        <main style="flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;padding:16px">${main}</main>
      </div>
      ${toast ? `<div style="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1f4d3a;color:#fff;font-weight:700;padding:11px 20px;border-radius:999px;z-index:70;box-shadow:0 14px 30px -12px rgba(0,0,0,.4)">${esc(toast)}</div>` : ''}`;
  }

  // ── interaction ───────────────────────────────────────────────
  el.addEventListener('click', async (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    // pin placement (sector flow) — clicking the stage
    if (flow === 'sector' && !t) {
      const stage = (ev.target as HTMLElement).closest('#ms-stage') as HTMLElement | null;
      if (stage) {
        const r = stage.getBoundingClientRect();
        pin = { x: Math.min(1, Math.max(0, ((ev as MouseEvent).clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, ((ev as MouseEvent).clientY - r.top) / r.height)) };
        render(); await mountOverlay(false);
      }
      return;
    }
    if (!t) return;
    const act = t.dataset.act; const id = t.dataset.id;
    switch (act) {
      case 'exit':
        // From inside a flow, step back to the landing chooser; from the landing,
        // leave Map Studio entirely.
        if (!onLanding) {
          disposeOverlay(); onLanding = true; selectedMapId = ''; labels = {}; pin = null; linkPropId = ''; sets = [];
          render();
        } else if (hasSafeInAppHistory()) {
          window.history.back();
        } else {
          window.location.assign('/admin/team.html');
        }
        break;
      case 'choose': {
        const f = t.dataset.flow as Flow;
        disposeOverlay(); onLanding = false; flow = f; selectedMapId = ''; labels = {}; pin = null; linkPropId = '';
        render();
        break;
      }
      case 'pick-master': await openMasterplan(id!); break;
      case 'pick-sector': await openSector(id!); break;
      case 'clear-sel': overlay?.clear(); break;
      case 'save-set': {
        if (!overlay) break;
        const ids = overlay.selection();
        if (!ids.length) { flash('Select some roads or blocks first'); break; }
        const nameEl = el.querySelector<HTMLInputElement>('#ms-setname');
        const name = (nameEl?.value || '').trim() || `Set ${sets.length + 1}`;
        const setLabels: Record<string, string> = {};
        for (const id of ids) if (labels[id]) setLabels[id] = labels[id]!;
        const res = await repo.saveHighlightSet({ mapId: selectedMapId, name, itemIds: ids, labels: setLabels });
        if (res.ok) { const r = await repo.listHighlightSets(selectedMapId); sets = r.ok && r.data ? r.data : sets; overlay.clear(); render(); await mountOverlay(true); flash(`Saved “${name}”`); }
        else flash(res.error ?? 'Could not save');
        break;
      }
      case 'play-set': { const set = sets.find((x) => x.id === id); if (set && overlay) { labels = { ...set.labels }; overlay.setAccent(set.accent); overlay.setSelection(set.itemIds); overlay.setLabels(labels); renderNameList(); } break; }
      case 'del-set': { const res = await repo.deleteHighlightSet(id!); if (res.ok) { sets = sets.filter((x) => x.id !== id); render(); await mountOverlay(true); flash('Set deleted'); } else flash(res.error ?? 'Could not delete'); break; }
      case 'do-link': {
        if (!pin || !linkPropId) break;
        const res = await repo.linkProperty(linkPropId, selectedMapId, pin.x, pin.y);
        if (res.ok) { const p = props.find((x) => x.id === linkPropId); if (p) p.mapPlacement = { mapId: selectedMapId, x: pin.x, y: pin.y }; flash('Plot linked to the map'); pin = null; linkPropId = ''; render(); await mountOverlay(false); }
        else flash(res.error ?? 'Could not link');
        break;
      }
      case 'unlink': { const res = await repo.unlinkProperty(id!); if (res.ok) { const p = props.find((x) => x.id === id); if (p) delete p.mapPlacement; flash('Plot unlinked'); render(); } else flash(res.error ?? 'Could not unlink'); break; }
      case 'link-here': {
        const sel = el.querySelector<HTMLSelectElement>(`select[data-linkmap="${id}"]`);
        const pid = sel?.value; if (!pid) { flash('Choose a plot first'); break; }
        const res = await repo.linkProperty(pid, id!);
        if (res.ok) { const p = props.find((x) => x.id === pid); if (p) p.mapPlacement = { mapId: id!, x: p.mapPlacement?.x ?? 0.5, y: p.mapPlacement?.y ?? 0.5 }; flash('Plot linked'); render(); } else flash(res.error ?? 'Could not link');
        break;
      }
      case 'unpublish': { const res = await repo.setStatus(id!, 'hidden', false); if (res.ok) { const m = maps.find((x) => x.id === id); if (m) { m.status = 'hidden'; m.clientVisible = false; } flash('Map unpublished'); render(); } else flash(res.error ?? 'Could not unpublish'); break; }
    }
  });
  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.id === 'ms-linkprop') linkPropId = (t as HTMLSelectElement).value;
  });
  el.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    const forId = t.getAttribute?.('data-namefor');
    if (forId) { labels[forId] = t.value; overlay?.setLabels(labels); }
  });

  render();
}
