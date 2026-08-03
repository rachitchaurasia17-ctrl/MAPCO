/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Map Studio (light, in-shell — matches the approved design)
   ---------------------------------------------------------------
   Renders inside the Team Workspace shell (light cream/violet theme),
   not a dark full-screen overlay. Three flows off a "What are we
   publishing?" landing:
    1. Publish Masterplan — tap roads/blocks to build a highlight SET.
    2. Publish Sector Map  — pick a sector map (easy grid), drop a pin,
       link a plot.
    3. Manage Published    — every live map + its marks/linked plots.
   Throw-free; supabase RPCs via getMapStudio(); mock fixture offline.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';
import { getMapStudio, type StudioMap, type HighlightSet } from '../../../packages/data/map-studio';
import { loadSvgOverlay, type SvgHighlightHandle } from '../../../packages/maps';
import type { Property } from '../../../packages/data/types';

type Flow = 'masterplan' | 'sector' | 'manage';

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function renderMapStudio(el: HTMLElement): Promise<void> {
  const repo = getMapStudio();
  let onLanding = true;
  let flow: Flow = 'masterplan';
  let maps: StudioMap[] = [];
  let props: Property[] = [];
  let selectedMapId = '';
  let overlay: SvgHighlightHandle | null = null;
  let overlayToken = 0;
  let sets: HighlightSet[] = [];
  let labels: Record<string, string> = {};
  let toast = '';
  let manageFilter: 'all' | 'masterplan' | 'sector' = 'all';
  const setsByMap: Record<string, HighlightSet[]> = {};
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
  const sectorMaps = () => maps.filter((m) => m.kind === 'sector' && m.status !== 'archived');
  const selectedMap = () => maps.find((m) => m.id === selectedMapId);
  const flash = (msg: string) => { toast = msg; renderToast(); setTimeout(() => { toast = ''; renderToast(); }, 2200); };
  const raster = (m: StudioMap) => m.assets?.original?.path || m.assets?.threeD?.path || '';

  function disposeOverlay(): void { overlay?.destroy(); overlay = null; }

  /** Load the premium overlay for the selected map into #ms-ovhost. */
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

  function renderNameList(): void {
    const box = el.querySelector<HTMLElement>('#ms-namelist');
    if (!box || !overlay) return;
    const sel = overlay.selection();
    const items = overlay.items();
    box.innerHTML = sel.length
      ? sel.map((id) => { const it = items.find((x) => x.id === id); return `<div style="display:flex;align-items:center;gap:8px"><span style="width:92px;flex:none;font-size:12px;font-weight:800;color:#6b6156;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it?.label ?? id)}</span><input data-namefor="${esc(id)}" value="${esc(labels[id] ?? '')}" placeholder="Name (e.g. PR-7 Road)" style="flex:1;height:34px;border:1px solid #e4dbf7;border-radius:9px;padding:0 10px;font:inherit;font-size:13px;background:#fff"></div>`; }).join('')
      : '<div style="font-size:13px;color:#8d8271">Tap roads or blocks on the map, then name them here.</div>';
  }

  async function loadManageSets(): Promise<void> {
    for (const m of masterplans()) {
      const r = await repo.listHighlightSets(m.id);
      setsByMap[m.id] = r.ok && r.data ? r.data : [];
    }
    if (flow === 'manage' && !onLanding) render();
  }

  // ── flow openers ──────────────────────────────────────────────
  async function openMasterplan(mapId: string): Promise<void> {
    onLanding = false; flow = 'masterplan'; selectedMapId = mapId; labels = {};
    const r = await repo.listHighlightSets(mapId); sets = r.ok && r.data ? r.data : [];
    render();
    await mountOverlay(true);
  }
  async function openSector(mapId: string): Promise<void> {
    onLanding = false; flow = 'sector'; selectedMapId = mapId; pin = null; linkPropId = '';
    render();
    await mountOverlay(false);
  }

  // ── landing (screenshot 5) ────────────────────────────────────
  function landingHtml(): string {
    const liveCount = maps.filter((m) => m.status === 'published').length;
    const firstMaster = masterplans()[0];
    const card = (opts: { flow: Flow; num: string; grad: string; icon: string; iconBg: string; eyebrow: string; title: string; desc: string; cta: string; ctaColor: string }) =>
      `<button data-act="choose" data-flow="${opts.flow}" style="display:flex;flex-direction:column;min-width:0;text-align:left;border-radius:24px;overflow:hidden;background:#fffdf9;border:1px solid #ece3fb;box-shadow:0 2px 4px rgba(60,44,12,.05),0 26px 50px -38px rgba(60,44,12,.7);cursor:pointer;transition:transform .16s,box-shadow .16s" onmouseenter="this.style.transform='translateY(-6px)'" onmouseleave="this.style.transform='none'">
        <span style="position:relative;display:block;height:170px;background:${opts.grad}">
          <span style="position:absolute;top:18px;left:18px;width:56px;height:56px;border-radius:16px;background:${opts.iconBg};display:grid;place-items:center"><i class="ph-fill ${opts.icon}" style="font-size:28px;color:#231a04"></i></span>
          <span style="position:absolute;top:14px;right:20px;font-family:'Newsreader',serif;font-weight:500;font-size:34px;color:rgba(255,255,255,.55)">${opts.num}</span>
        </span>
        <span style="display:block;padding:20px 22px 22px">
          <span style="display:block;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a8792a">${esc(opts.eyebrow)}</span>
          <span style="display:block;font-family:'Newsreader',serif;font-weight:500;font-size:26px;color:#1c1533;margin-top:6px">${esc(opts.title)}</span>
          <span style="display:block;font-size:14px;line-height:1.55;color:#6f6489;margin-top:8px">${esc(opts.desc)}</span>
          <span style="display:inline-flex;align-items:center;gap:7px;margin-top:16px;font-size:14.5px;font-weight:800;color:${opts.ctaColor}">${esc(opts.cta)} <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
        </span>
      </button>`;
    return `<div style="max-width:1180px;margin:0 auto;padding:40px 34px 60px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a8792a">Map Studio</div>
          <h1 style="margin:6px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.01em;color:#1c1533">What are we publishing?</h1>
          <p style="margin:8px 0 0;font-size:16px;color:#6f6489">Everything here lands on the client screen the moment you save it.</p>
        </div>
        ${firstMaster ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:#fffdf9;border:1px solid #ece3fb;box-shadow:0 4px 12px rgba(91,50,196,.08)"><span style="width:34px;height:34px;border-radius:9px;background:#ffc93c;display:grid;place-items:center"><i class="ph-fill ph-book-open" style="font-size:17px;color:#231a04"></i></span><span style="min-width:0"><span style="display:block;font-size:14px;font-weight:800;color:#1c1533;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${esc(firstMaster.city || firstMaster.label)}</span><span style="display:block;font-size:11.5px;color:#8d8271">Masterplan</span></span></div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:30px">
        ${card({ flow: 'masterplan', num: '01', grad: 'linear-gradient(135deg,#ffdc7a,#f4ae14)', icon: 'ph-book-open', iconBg: '#241d0c', eyebrow: 'Big city map', title: 'Publish Masterplan', desc: 'Pick which traced roads, blocks and pins light up when your client taps a highlight button.', cta: 'Open', ctaColor: '#a8792a' })}
        ${card({ flow: 'sector', num: '02', grad: 'linear-gradient(135deg,#a888f0,#5b32c4)', icon: 'ph-pencil-simple-line', iconBg: '#efe6ff', eyebrow: 'Detailed proof map', title: 'Publish Sector Map', desc: 'Pick a sector layout, drop a pin on the plot, then link it to one of your plots.', cta: 'Open', ctaColor: '#5b32c4' })}
        ${card({ flow: 'manage', num: '03', grad: 'linear-gradient(135deg,#3f9b70,#155e3f)', icon: 'ph-squares-four', iconBg: '#dff3e8', eyebrow: 'Everything live', title: 'Manage Published', desc: 'Every map a client can open right now — edit its marks, link a property, or hide it.', cta: `${liveCount} map${liveCount === 1 ? '' : 's'} live`, ctaColor: '#12704a' })}
      </div>
    </div>`;
  }

  // ── shared light chrome (header row for a flow) ───────────────
  function flowHeader(title: string): string {
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <button data-act="exit" style="display:flex;align-items:center;gap:8px;height:42px;padding:0 15px;border-radius:12px;background:#f0eaff;color:#5b32c4;font-weight:800;cursor:pointer"><i class="ph-bold ph-arrow-left"></i>Back</button>
      <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:28px;color:#1c1533">${esc(title)}</h1>
    </div>`;
  }

  // ── easy map picker (light grid of thumbnails) ────────────────
  function pickerHtml(kind: 'masterplan' | 'sector', act: string): string {
    const list = kind === 'masterplan' ? masterplans() : sectorMaps();
    if (!list.length) return `<div style="padding:30px;text-align:center;color:#6f6489;background:#fffdf9;border:1px dashed #d9cdf5;border-radius:18px">No ${kind === 'masterplan' ? 'city masterplans' : 'sector maps'} yet.</div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px">${list.map((m) => {
      const r = raster(m);
      return `<button data-act="${act}" data-id="${esc(m.id)}" style="display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:#fffdf9;border:1px solid #ece3fb;box-shadow:0 20px 40px -34px rgba(60,40,5,.7);cursor:pointer;text-align:left;transition:transform .16s" onmouseenter="this.style.transform='translateY(-5px)'" onmouseleave="this.style.transform='none'">
        <span style="display:block;height:130px;background:#efe8fb ${r ? `url('${esc(r)}') center/cover` : ''}"></span>
        <span style="display:block;padding:13px 15px"><span style="display:block;font-size:15.5px;font-weight:800;color:#1c1533">${esc(m.city || m.label)}</span><span style="display:block;font-size:12.5px;color:#8d8271">${kind === 'sector' ? esc(m.sector || m.label) : 'City masterplan'}${m.status === 'published' ? ' · live' : ''}</span></span>
      </button>`;
    }).join('')}</div>`;
  }

  function mapStageHtml(placing: boolean): string {
    const m = selectedMap();
    const r = raster(m!);
    const noOverlay = !m?.assets?.overlay?.path;
    return `<div id="ms-stage" style="position:relative;width:100%;height:min(70vh,680px);background:#efe8fb;border-radius:20px;overflow:hidden;box-shadow:inset 0 0 0 1px #ddd0f5,0 30px 60px -40px rgba(60,40,5,.6);${placing ? 'cursor:crosshair' : ''}">
      ${r ? `<img src="${esc(r)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none">` : '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#8d8271">No image</div>'}
      <div id="ms-ovhost" style="position:absolute;inset:0;pointer-events:${flow === 'masterplan' ? 'auto' : 'none'}"></div>
      ${flow === 'sector' && pin ? `<div style="position:absolute;left:${pin.x * 100}%;top:${pin.y * 100}%;transform:translate(-50%,-100%);z-index:5"><i class="ph-fill ph-map-pin" style="font-size:34px;color:#5b32c4;filter:drop-shadow(0 3px 4px rgba(0,0,0,.4))"></i></div>` : ''}
      ${flow === 'masterplan' && noOverlay ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fffaf0;color:#6b6156;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:700;box-shadow:0 10px 30px -12px rgba(0,0,0,.3)">This map has no aligned highlight layer yet.</div>` : ''}
    </div>`;
  }

  function masterplanFlowHtml(): string {
    const m = selectedMap();
    if (!m) return `${flowHeader('Publish Masterplan')}<div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a8792a;margin-bottom:12px">Pick a city map</div>${pickerHtml('masterplan', 'pick-master')}`;
    const setChips = sets.length
      ? sets.map((sset) => `<span style="display:inline-flex;align-items:center;gap:7px;background:#fff2cd;color:#8a5a0c;border-radius:999px;padding:6px 8px 6px 12px;font-size:12.5px;font-weight:800"><button data-act="play-set" data-id="${esc(sset.id)}" title="Preview" style="background:none;color:inherit;font-weight:800;cursor:pointer">${esc(sset.name)} · ${sset.itemIds.length}</button><button data-act="del-set" data-id="${esc(sset.id)}" aria-label="Delete" style="width:20px;height:20px;border-radius:50%;background:rgba(168,121,42,.18);display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:11px"></i></button></span>`).join('')
      : '<span style="font-size:12.5px;color:#8d8271">No sets yet.</span>';
    return `${flowHeader('Publish Masterplan')}
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start">
        <div>${mapStageHtml(false)}</div>
        <aside style="background:#fffdf9;border:1px solid #ece3fb;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:14px;color:#3a332c;font-weight:700">Selected <b id="ms-selcount" style="color:#5b32c4">${overlay?.selection().length ?? 0}</b></div>
          <input id="ms-setname" placeholder="Set name (e.g. Approach roads)" style="height:42px;border:1px solid #e4dbf7;border-radius:11px;padding:0 12px;font:inherit;font-size:14px;background:#fff">
          <div style="display:flex;gap:8px"><button id="ms-saveset" data-act="save-set" disabled style="flex:1;height:42px;border-radius:11px;background:#ffc93c;color:#231a04;font-weight:800;cursor:pointer">Save set</button><button data-act="clear-sel" style="height:42px;padding:0 14px;border-radius:11px;background:#f0eaff;color:#5b32c4;font-weight:800;cursor:pointer">Clear</button></div>
          <div><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a8792a;margin-bottom:7px">Name the shapes</div><div id="ms-namelist" style="display:flex;flex-direction:column;gap:7px;max-height:230px;overflow-y:auto"></div></div>
          <div><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a8792a;margin-bottom:7px">Saved sets</div><div style="display:flex;flex-wrap:wrap;gap:7px">${setChips}</div></div>
        </aside>
      </div>`;
  }

  function sectorFlowHtml(): string {
    const m = selectedMap();
    if (!m) return `${flowHeader('Publish Sector Map')}<div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a8792a;margin-bottom:12px">Pick a sector map</div>${pickerHtml('sector', 'pick-sector')}`;
    return `${flowHeader('Publish Sector Map')}
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start">
        <div>${mapStageHtml(true)}</div>
        <aside style="background:#fffdf9;border:1px solid #ece3fb;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:14px;font-weight:800;color:${pin ? '#12704a' : '#8d8271'}">${pin ? `Pin at ${(pin.x * 100).toFixed(0)}%, ${(pin.y * 100).toFixed(0)}%` : 'Click the map to drop a pin'}</div>
          <select id="ms-linkprop" style="height:44px;border:1px solid #e4dbf7;border-radius:11px;padding:0 12px;font:inherit;font-size:14px;background:#fff">
            <option value="">Choose a plot…</option>
            ${props.map((p) => `<option value="${esc(p.id)}"${linkPropId === p.id ? ' selected' : ''}>${esc(p.area)}${p.size ? ` · ${esc(p.size)}` : ''}</option>`).join('')}
          </select>
          <button data-act="do-link" ${(!pin || !linkPropId) ? 'disabled' : ''} style="height:46px;border-radius:12px;background:#5b32c4;color:#fff;font-weight:800;cursor:pointer;${(!pin || !linkPropId) ? 'opacity:.4' : ''}">Link plot to this pin</button>
          <button data-act="pick-sector-again" style="height:42px;border-radius:11px;background:#f0eaff;color:#5b32c4;font-weight:800;cursor:pointer">Choose a different map</button>
        </aside>
      </div>`;
  }

  // ── Manage Published (screenshot 6) ───────────────────────────
  function manageHtml(): string {
    const live = maps.filter((m) => m.status === 'published');
    const shown = manageFilter === 'all' ? live : live.filter((m) => m.kind === manageFilter);
    const propById = new Map(props.map((p) => [p.id, p]));
    const linkedFor = (mapId: string) => props.filter((p) => p.mapPlacement?.mapId === mapId);
    const totalLinked = props.filter((p) => p.mapPlacement?.mapId && live.some((m) => m.id === p.mapPlacement!.mapId)).length;
    const filterTab = (key: typeof manageFilter, label: string, n: number) => `<button data-act="mfilter" data-filter="${key}" style="display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:12px;font-size:14.5px;font-weight:800;cursor:pointer;${manageFilter === key ? 'background:#241d0c;color:#ffd75e' : 'background:#fffdf9;color:#5b32c4;border:1px solid #ece3fb'}">${esc(label)}<span style="font-size:12px;font-weight:800;padding:2px 8px;border-radius:99px;${manageFilter === key ? 'background:rgba(255,215,94,.25);color:#ffd75e' : 'background:#ece3fb;color:#5b32c4'}">${n}</span></button>`;

    const cards = shown.length ? shown.map((m) => {
      const r = raster(m);
      const linked = linkedFor(m.id);
      const mSets = setsByMap[m.id] ?? [];
      const marks = mSets.reduce((s, x) => s + x.itemIds.length, 0);
      return `<div style="background:#fffdf9;border:1px solid #ece3fb;border-radius:22px;overflow:hidden;box-shadow:0 24px 46px -38px rgba(60,40,5,.7)">
        <div style="position:relative;height:170px;background:#efe8fb ${r ? `url('${esc(r)}') center/cover` : ''}">
          <span style="position:absolute;top:12px;left:12px;padding:5px 11px;border-radius:9px;background:rgba(28,21,51,.72);backdrop-filter:blur(8px);font-size:12px;font-weight:800;color:#fff8e6">${m.kind === 'masterplan' ? 'Masterplan' : 'Sector'}</span>
          <span style="position:absolute;top:12px;right:12px;padding:5px 11px;border-radius:9px;background:#dff3e8;font-size:12px;font-weight:800;color:#12704a">Live${m.clientVisible === false ? ' · hidden' : ''}</span>
          ${mSets.length ? `<div style="position:absolute;left:12px;bottom:12px;display:flex;gap:7px;flex-wrap:wrap">${mSets.map((s) => `<span style="padding:5px 10px;border-radius:8px;background:#ffc93c;font-size:12px;font-weight:800;color:#231a04">${esc(s.name)} · ${s.itemIds.length}</span>`).join('')}</div>` : ''}
        </div>
        <div style="padding:18px 20px">
          <div style="font-size:19px;font-weight:800;color:#1c1533">${esc(m.label)}</div>
          <div style="font-size:13px;color:#8d8271;margin-top:2px">${esc(m.city || '')} · ${marks} mark${marks === 1 ? '' : 's'}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">${linked.length ? linked.map((p) => `<span style="display:inline-flex;align-items:center;gap:7px;background:#eef4ff;color:#1a56c4;border-radius:999px;padding:6px 8px 6px 12px;font-size:12.5px;font-weight:700"><i class="ph-fill ph-map-pin"></i>${esc(propById.get(p.id)?.area ?? p.id)}<button data-act="unlink" data-id="${esc(p.id)}" aria-label="Unlink" style="width:20px;height:20px;border-radius:50%;background:rgba(26,86,196,.16);display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:11px"></i></button></span>`).join('') : '<span style="font-size:13px;color:#8d8271">No plots linked yet.</span>'}</div>
          <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
            <span style="display:grid;place-items:center;width:38px;height:44px;flex:none;border:1px solid #e4dbf7;border-radius:11px;background:#f6f0ff;color:#5b32c4"><i class="ph-fill ph-link-simple" style="font-size:16px"></i></span>
            <select data-linkmap="${esc(m.id)}" style="flex:1;height:44px;border:1px solid #e4dbf7;border-radius:11px;padding:0 12px;font:inherit;font-size:14px;background:#fff"><option value="">Link a plot…</option>${props.filter((p) => p.mapPlacement?.mapId !== m.id).map((p) => `<option value="${esc(p.id)}">${esc(p.area)}</option>`).join('')}</select>
            <button data-act="link-here" data-id="${esc(m.id)}" style="width:44px;height:44px;flex:none;border-radius:11px;background:#5b32c4;color:#fff;font-weight:800;font-size:20px;cursor:pointer">+</button>
          </div>
          <div style="display:flex;gap:10px;margin-top:14px">
            <button data-act="edit-marks" data-id="${esc(m.id)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:12px;background:#241d0c;color:#ffd75e;font-weight:800;cursor:pointer"><i class="ph-fill ph-pencil-simple"></i>Edit marks</button>
            <button data-act="unpublish" data-id="${esc(m.id)}" style="display:flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 18px;border-radius:12px;background:#ffe6cf;color:#c2622a;font-weight:800;cursor:pointer"><i class="ph-fill ph-eye-slash"></i>Hide</button>
          </div>
        </div>
      </div>`;
    }).join('') : '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#6f6489;background:#fffdf9;border:1px dashed #d9cdf5;border-radius:20px">No published maps in this filter yet.</div>';

    return `${flowHeader('Manage Published')}
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px">
        <div style="background:#dff3e8;border:1px solid #a6e3c0;border-radius:16px;padding:14px 20px"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:30px;color:#12704a;line-height:1">${live.length}</div><div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#12704a">Maps live</div></div>
        <div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:16px;padding:14px 20px"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:30px;color:#5b32c4;line-height:1">${totalLinked}</div><div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5b32c4">Plots linked</div></div>
      </div>
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:18px">
        ${filterTab('all', 'All maps', live.length)}
        ${filterTab('masterplan', 'Masterplans', live.filter((m) => m.kind === 'masterplan').length)}
        ${filterTab('sector', 'Sector maps', live.filter((m) => m.kind === 'sector').length)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px">${cards}</div>`;
  }

  function renderToast(): void {
    let t = el.querySelector<HTMLElement>('#ms-toast');
    if (!toast) { t?.remove(); return; }
    if (!t) { t = document.createElement('div'); t.id = 'ms-toast'; t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1f4d3a;color:#fff;font-weight:700;padding:11px 20px;border-radius:999px;z-index:70;box-shadow:0 14px 30px -12px rgba(0,0,0,.4)'; document.body.appendChild(t); }
    t.textContent = toast;
  }

  function render(): void {
    const body = onLanding ? landingHtml()
      : flow === 'manage' ? manageHtml()
      : flow === 'sector' ? sectorFlowHtml()
      : masterplanFlowHtml();
    el.innerHTML = `<div style="min-height:100%;padding:${onLanding ? '0' : '30px 34px 60px'};font-family:'Hanken Grotesk',sans-serif;color:#241f1c">${onLanding ? body : `<div style="max-width:1180px;margin:0 auto">${body}</div>`}</div>`;
    renderToast();
  }

  // ── interaction ───────────────────────────────────────────────
  el.addEventListener('click', async (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (flow === 'sector' && !onLanding && !t) {
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
      case 'choose': {
        const f = t.dataset.flow as Flow;
        disposeOverlay(); onLanding = false; flow = f; selectedMapId = ''; labels = {}; pin = null; linkPropId = '';
        render();
        if (f === 'manage') void loadManageSets();
        break;
      }
      case 'exit': disposeOverlay(); onLanding = true; selectedMapId = ''; labels = {}; pin = null; linkPropId = ''; sets = []; render(); break;
      case 'pick-master': await openMasterplan(id!); break;
      case 'pick-sector': await openSector(id!); break;
      case 'pick-sector-again': disposeOverlay(); selectedMapId = ''; pin = null; linkPropId = ''; render(); break;
      case 'clear-sel': overlay?.clear(); break;
      case 'save-set': {
        if (!overlay) break;
        const ids = overlay.selection();
        if (!ids.length) { flash('Select some roads or blocks first'); break; }
        const nameEl = el.querySelector<HTMLInputElement>('#ms-setname');
        const name = (nameEl?.value || '').trim() || `Set ${sets.length + 1}`;
        const setLabels: Record<string, string> = {};
        for (const sid of ids) if (labels[sid]) setLabels[sid] = labels[sid]!;
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
      case 'edit-marks': await openMasterplan(id!); break;
      case 'mfilter': manageFilter = (t.dataset.filter as typeof manageFilter) || 'all'; render(); break;
      case 'unpublish': { const res = await repo.setStatus(id!, 'hidden', false); if (res.ok) { const m = maps.find((x) => x.id === id); if (m) { m.status = 'hidden'; m.clientVisible = false; } flash('Map hidden'); render(); } else flash(res.error ?? 'Could not hide'); break; }
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
