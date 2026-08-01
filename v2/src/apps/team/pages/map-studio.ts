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

type Flow = 'home' | 'masterplan' | 'sector' | 'manage';

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function renderMapStudio(el: HTMLElement): Promise<void> {
  const repo = getMapStudio();
  let flow: Flow = 'home';
  let maps: StudioMap[] = [];
  let props: Property[] = [];
  let selectedMapId = '';
  let overlay: SvgHighlightHandle | null = null;
  let overlayToken = 0;
  let sets: HighlightSet[] = [];
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
    handle.onSelectChange(() => { const c = el.querySelector('#ms-selcount'); if (c) c.textContent = String(handle.selection().length); const b = el.querySelector<HTMLButtonElement>('#ms-saveset'); if (b) b.disabled = handle.selection().length === 0; });
    host.appendChild(handle.el);
  }

  // ── flow openers ──────────────────────────────────────────────
  async function openMasterplan(mapId: string): Promise<void> {
    flow = 'masterplan'; selectedMapId = mapId;
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
      <div id="ms-stage" style="position:relative;width:100%;max-width:980px;margin:0 auto;aspect-ratio:${w}/${h};background:#0b0714;border-radius:18px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,248,230,.14),0 30px 60px -30px rgba(0,0,0,.7);${placing ? 'cursor:crosshair' : ''}">
        ${raster ? `<img src="${esc(raster)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;user-select:none;-webkit-user-drag:none">` : '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#8d8271">No image</div>'}
        <div id="ms-ovhost" style="position:absolute;inset:0;pointer-events:${flow === 'masterplan' ? 'auto' : 'none'}"></div>
        ${flow === 'sector' && pin ? `<div style="position:absolute;left:${pin.x * 100}%;top:${pin.y * 100}%;transform:translate(-50%,-100%);z-index:5"><i class="ph-fill ph-map-pin" style="font-size:34px;color:#2f7bff;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))"></i></div>` : ''}
        ${flow === 'masterplan' && noOverlay ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(24,16,4,.8);color:#fff8e6;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:700">This map has no aligned highlight layer yet.</div>` : ''}
      </div>`;
  }

  function homeHtml(): string {
    const liveCount = maps.filter((m) => m.status === 'published').length;
    const card = (n: string, tag: string, title: string, desc: string, act: string, cta: string, bg: string, ic: string, icbg: string) => `
      <button class="ms-card3" data-act="${act}" style="text-align:left;display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:#fffdf9;box-shadow:0 0 0 1px rgba(88,52,168,.1),0 20px 40px -28px rgba(60,40,10,.6);cursor:pointer;transition:transform .15s,box-shadow .15s" onmouseenter="this.style.transform='translateY(-6px)'" onmouseleave="this.style.transform='none'">
        <span style="position:relative;display:block;height:150px;background:${bg}">
          <span style="position:absolute;top:18px;left:18px;width:56px;height:56px;border-radius:16px;background:${icbg};display:grid;place-items:center"><i class="ph-fill ${ic}" style="font-size:26px;color:#241d0c"></i></span>
          <span style="position:absolute;top:16px;right:22px;font-family:var(--pm-font-display);font-size:30px;color:rgba(0,0,0,.18)">${n}</span>
        </span>
        <span style="display:block;padding:20px 22px 22px">
          <span style="display:block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a8792a">${tag}</span>
          <span style="display:block;font-family:var(--pm-font-display);font-weight:500;font-size:26px;color:#1c1533;margin-top:4px">${title}</span>
          <span style="display:block;margin-top:8px;font-size:14px;color:#6b6156;line-height:1.45">${desc}</span>
          <span style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:14.5px;font-weight:800;color:#5b32c4">${cta}<i class="ph-bold ph-arrow-right"></i></span>
        </span>
      </button>`;
    return `
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a8792a">MAP STUDIO</div>
          <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:40px;letter-spacing:-.02em;color:#241f1c;margin:4px 0 0">What are we publishing?</h1>
          <p style="margin:8px 0 0;font-size:15px;color:#6b6156">Everything here lands on the client screen the moment you save it.</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:26px">
        ${card('01', 'Big city map', 'Publish Masterplan', 'Pick roads, blocks and sectors that light up when your client taps a highlight set.', 'go-masterplan', 'Open', 'linear-gradient(135deg,#ffdc7a,#f4ae14)', 'ph-map-trifold', '#fff6d8')}
        ${card('02', 'Detailed proof map', 'Publish Sector Map', 'Drop a pin on the map and link it to one of your plots. That is it.', 'go-sector', 'Open', 'linear-gradient(135deg,#b79bf5,#7c4fe0)', 'ph-map-pin-area', '#efe6ff')}
        ${card('03', 'Everything live', 'Manage Published', `Every map a client can open right now — link a property, unlink one, or hide it.`, 'go-manage', `${liveCount} map${liveCount === 1 ? '' : 's'} live`, 'linear-gradient(135deg,#7fd3a6,#137a56)', 'ph-squares-four', '#d9f5e3')}
      </div>`;
  }

  function pickerHtml(kind: 'masterplan' | 'any', act: string): string {
    const list = kind === 'masterplan' ? masterplans() : maps.filter((m) => m.status !== 'archived');
    if (!list.length) return `<div class="ms-empty" style="padding:24px;color:#6b6156">No maps yet. Onboard maps first.</div>`;
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:18px">';
    for (const m of list) {
      const raster = m.assets?.original?.path || m.assets?.threeD?.path || '';
      html += `<button data-act="${act}" data-id="${esc(m.id)}" style="text-align:left;border-radius:16px;overflow:hidden;background:#fffdf9;box-shadow:0 0 0 1px rgba(88,52,168,.1);cursor:pointer">
        <span style="display:block;height:110px;background:#efe6da ${raster ? `url('${esc(raster)}') center/cover` : ''}"></span>
        <span style="display:block;padding:12px 14px">
          <span style="display:block;font-size:15px;font-weight:800;color:#1c1533">${esc(m.label)}</span>
          <span style="display:block;font-size:12.5px;color:#8d8271;margin-top:2px">${esc(m.city)} · ${m.kind}${m.status === 'published' ? ' · live' : ''}</span>
        </span></button>`;
    }
    return html + '</div>';
  }

  function masterplanFlowHtml(): string {
    const m = selectedMap();
    if (!m) return `<div>${headerHtml('Publish Masterplan')}${pickerHtml('masterplan', 'pick-master')}</div>`;
    const setChips = sets.length
      ? sets.map((sset) => `<div class="ms-setchip" style="display:inline-flex;align-items:center;gap:8px;background:#fff2cd;color:#8a5a0c;border-radius:999px;padding:7px 8px 7px 14px;font-size:13.5px;font-weight:800">
          <button data-act="play-set" data-id="${esc(sset.id)}" title="Preview this set" style="background:none;color:inherit;font-weight:800;cursor:pointer">${esc(sset.name)} · ${sset.itemIds.length}</button>
          <button data-act="del-set" data-id="${esc(sset.id)}" aria-label="Delete set" title="Delete" style="width:22px;height:22px;border-radius:50%;background:rgba(138,90,12,.15);display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:12px"></i></button>
        </div>`).join('')
      : `<span style="font-size:13.5px;color:#8d8271">No sets yet — tap roads/blocks on the map, name them, and save.</span>`;
    return `
      <div>
        ${headerHtml('Publish Masterplan', m.label)}
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:14px 0 16px">
          <div style="font-size:14px;color:#3a332c;font-weight:700"><i class="ph-fill ph-cursor-click" style="color:#a8792a;margin-right:6px"></i>Tap roads &amp; blocks on the map to build a set. <span style="color:#8d8271">Selected: <b id="ms-selcount">0</b></span></div>
          <span style="flex:1"></span>
          <input id="ms-setname" placeholder="Set name (e.g. Approach roads)" style="height:40px;border:1px solid #ddd2f5;border-radius:11px;padding:0 12px;font:inherit;font-size:14px;min-width:220px">
          <button id="ms-saveset" data-act="save-set" disabled style="height:40px;padding:0 16px;border-radius:11px;background:#ffc93c;color:#231a04;font-weight:800;cursor:pointer">Save set</button>
          <button data-act="clear-sel" style="height:40px;padding:0 14px;border-radius:11px;background:#f0eaff;color:#5b32c4;font-weight:800;cursor:pointer">Clear</button>
        </div>
        ${mapPreviewHtml(false)}
        <div style="margin-top:16px">
          <div style="font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin-bottom:8px">Saved highlight sets (client sees these on one cycling button)</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">${setChips}</div>
        </div>
      </div>`;
  }

  function sectorFlowHtml(): string {
    const m = selectedMap();
    if (!m) return `<div>${headerHtml('Publish Sector Map')}${pickerHtml('any', 'pick-sector')}</div>`;
    return `
      <div>
        ${headerHtml('Publish Sector Map', m.label)}
        <div style="font-size:14px;color:#3a332c;font-weight:700;margin:14px 0 16px"><i class="ph-fill ph-map-pin" style="color:#2f7bff;margin-right:6px"></i>Click the map to drop a pin, then pick the plot it belongs to.</div>
        ${mapPreviewHtml(true)}
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:16px;max-width:980px;margin-left:auto;margin-right:auto">
          <span style="font-size:14px;color:${pin ? '#137a56' : '#8d8271'};font-weight:800">${pin ? `Pin set at ${(pin.x * 100).toFixed(0)}%, ${(pin.y * 100).toFixed(0)}%` : 'No pin yet'}</span>
          <span style="flex:1"></span>
          <select id="ms-linkprop" style="height:42px;border:1px solid #ddd2f5;border-radius:11px;padding:0 12px;font:inherit;font-size:14px;min-width:240px;background:#fff">
            <option value="">Choose a plot…</option>
            ${props.map((p) => `<option value="${esc(p.id)}"${linkPropId === p.id ? ' selected' : ''}>${esc(p.area)}${p.size ? ` · ${esc(p.size)}` : ''}</option>`).join('')}
          </select>
          <button data-act="do-link" ${(!pin || !linkPropId) ? 'disabled' : ''} style="height:42px;padding:0 18px;border-radius:11px;background:#ffc93c;color:#231a04;font-weight:800;cursor:pointer;${(!pin || !linkPropId) ? 'opacity:.45' : ''}">Link plot to this pin</button>
        </div>
      </div>`;
  }

  function manageFlowHtml(): string {
    const live = maps.filter((m) => m.status === 'published');
    const propById = new Map(props.map((p) => [p.id, p]));
    const linkedFor = (mapId: string) => props.filter((p) => p.mapPlacement?.mapId === mapId);
    const rows = live.length ? live.map((m) => {
      const linked = linkedFor(m.id);
      return `<div style="background:#fffdf9;border:1px solid #eadff7;border-radius:16px;padding:16px 18px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="font-size:16px;font-weight:800;color:#1c1533">${esc(m.label)}</div>
          <span style="font-size:12px;font-weight:800;color:#137a56;background:#d9f5e3;border-radius:999px;padding:3px 10px">live${m.clientVisible ? '' : ' · hidden'}</span>
          <span style="flex:1"></span>
          <button data-act="unpublish" data-id="${esc(m.id)}" style="height:34px;padding:0 12px;border-radius:9px;background:#ffe1e6;color:#c2185b;font-weight:800;font-size:13px;cursor:pointer">Unpublish</button>
        </div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          ${linked.length ? linked.map((p) => `<span style="display:inline-flex;align-items:center;gap:7px;background:#eef4ff;color:#1a56c4;border-radius:999px;padding:6px 8px 6px 12px;font-size:13px;font-weight:700"><i class="ph-fill ph-map-pin"></i>${esc(propById.get(p.id)?.area ?? p.id)}<button data-act="unlink" data-id="${esc(p.id)}" aria-label="Unlink" title="Unlink" style="width:20px;height:20px;border-radius:50%;background:rgba(26,86,196,.15);display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:11px"></i></button></span>`).join('') : '<span style="font-size:13px;color:#8d8271">No plots linked yet.</span>'}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <select data-linkmap="${esc(m.id)}" style="height:38px;border:1px solid #ddd2f5;border-radius:10px;padding:0 10px;font:inherit;font-size:13.5px;background:#fff">
            <option value="">Link a plot…</option>
            ${props.filter((p) => p.mapPlacement?.mapId !== m.id).map((p) => `<option value="${esc(p.id)}">${esc(p.area)}</option>`).join('')}
          </select>
          <button data-act="link-here" data-id="${esc(m.id)}" style="height:38px;padding:0 14px;border-radius:10px;background:#f0eaff;color:#5b32c4;font-weight:800;font-size:13.5px;cursor:pointer">Link</button>
        </div>
      </div>`;
    }).join('') : '<div class="ms-empty" style="padding:24px;color:#6b6156">No published maps yet.</div>';
    return `<div>${headerHtml('Manage Published')}<div style="margin-top:18px">${rows}</div></div>`;
  }

  function headerHtml(title: string, sub?: string): string {
    return `<div style="display:flex;align-items:center;gap:14px">
      <button data-act="${flow === 'home' ? 'exit' : 'home'}" aria-label="Back" style="display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 13px;border-radius:11px;background:#f0eaff;color:#4b2ea6;font-weight:800;font-size:14px;cursor:pointer"><i class="ph-bold ph-arrow-left"></i>Back</button>
      <div><div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a8792a">Map Studio</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:26px;color:#241f1c">${esc(title)}${sub ? ` <span style="color:#8d8271;font-size:18px">· ${esc(sub)}</span>` : ''}</div></div>
    </div>`;
  }

  function render(): void {
    const body = flow === 'home' ? homeHtml()
      : flow === 'masterplan' ? masterplanFlowHtml()
      : flow === 'sector' ? sectorFlowHtml()
      : manageFlowHtml();
    el.innerHTML = `
      <div style="min-height:100%;background:#f5efff;background-image:radial-gradient(60% 50% at 0% 0%,rgba(139,96,232,.16),transparent 60%),radial-gradient(60% 50% at 100% 100%,rgba(255,201,60,.14),transparent 60%)">
        <div style="max-width:1180px;margin:0 auto;padding:28px 32px 60px">${body}</div>
      </div>
      ${toast ? `<div style="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1f4d3a;color:#fff;font-weight:700;padding:11px 20px;border-radius:999px;z-index:50;box-shadow:0 14px 30px -12px rgba(0,0,0,.4)">${esc(toast)}</div>` : ''}`;
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
      case 'exit': if (hasSafeInAppHistory()) window.history.back(); else window.location.assign('/admin/owner.html'); break;
      case 'home': disposeOverlay(); flow = 'home'; selectedMapId = ''; render(); break;
      case 'go-masterplan': flow = 'masterplan'; selectedMapId = ''; render(); break;
      case 'go-sector': flow = 'sector'; selectedMapId = ''; render(); break;
      case 'go-manage': flow = 'manage'; selectedMapId = ''; render(); break;
      case 'pick-master': await openMasterplan(id!); break;
      case 'pick-sector': await openSector(id!); break;
      case 'clear-sel': overlay?.clear(); break;
      case 'save-set': {
        if (!overlay) break;
        const ids = overlay.selection();
        if (!ids.length) { flash('Select some roads or blocks first'); break; }
        const nameEl = el.querySelector<HTMLInputElement>('#ms-setname');
        const name = (nameEl?.value || '').trim() || `Set ${sets.length + 1}`;
        const res = await repo.saveHighlightSet({ mapId: selectedMapId, name, itemIds: ids });
        if (res.ok) { const r = await repo.listHighlightSets(selectedMapId); sets = r.ok && r.data ? r.data : sets; overlay.clear(); render(); await mountOverlay(true); flash(`Saved “${name}”`); }
        else flash(res.error ?? 'Could not save');
        break;
      }
      case 'play-set': { const set = sets.find((x) => x.id === id); if (set && overlay) { overlay.setAccent(set.accent); overlay.setSelection(set.itemIds); } break; }
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

  render();
}
