/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Map Studio (dealer-facing map management)
   ---------------------------------------------------------------
   Browse maps by city → masterplan → sector, preview Original/3D/
   overlay, publish/hide/archive/restore, link + place properties,
   and verify overlay alignment / spot missing assets. Wired to the
   real Supabase RPCs via getMapStudio(); mock mode uses a fixture.
   Clear and low-jargon for a non-technical dealer.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';
import { getMapStudio, type StudioMap, type MapStatus } from '../../../packages/data/map-studio';
import { hasSafeInAppHistory } from '../../../packages/ui/back-button';
import type { Property } from '../../../packages/data/types';

const STATUS_META: Record<MapStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: '#f0eaff', fg: '#5b32c4' },
  published: { label: 'Live', bg: '#dcf3e5', fg: '#12704a' },
  hidden: { label: 'Hidden', bg: '#fff3d1', fg: '#8a5a0c' },
  archived: { label: 'Archived', bg: '#f1ece4', fg: '#8d8271' },
};

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function renderMapStudio(el: HTMLElement): Promise<void> {
  const repo = getMapStudio();
  let maps: StudioMap[] = [];
  let properties: Property[] = [];
  let selectedId: string | null = null;
  let previewMode: 'original' | 'threeD' = 'original';
  let showOverlay = true;
  let statusFilter: MapStatus | 'all' = 'all';
  let placing = false;
  let linkProp = '';
  let toast: string | null = null;

  async function load(): Promise<void> {
    const [m, p] = await Promise.all([repo.listMaps(), adapter.properties.list({ limit: 50 })]);
    maps = m.ok ? (m.data ?? []) : [];
    properties = p.ok ? [...p.value.items] : [];
    if ((!selectedId || !maps.some((x) => x.id === selectedId)) && maps.length) selectedId = maps[0]!.id;
    render();
  }

  const selected = (): StudioMap | undefined => maps.find((m) => m.id === selectedId);

  function tree(): string {
    const shown = maps.filter((m) => statusFilter === 'all' || m.status === statusFilter);
    const byCity = new Map<string, StudioMap[]>();
    for (const m of shown) { const a = byCity.get(m.city); if (a) a.push(m); else byCity.set(m.city, [m]); }
    let html = '';
    for (const city of [...byCity.keys()].sort()) {
      const cm = byCity.get(city)!;
      const ordered = [...cm.filter((m) => m.kind === 'masterplan'), ...cm.filter((m) => m.kind === 'sector')];
      html += `<div class="ms-city">${esc(city)}<span>${cm.length}</span></div>`;
      for (const m of ordered) {
        const s = STATUS_META[m.status];
        html += `<button class="ms-row${m.id === selectedId ? ' sel' : ''}${m.kind === 'sector' ? ' sec' : ''}" data-act="select" data-id="${esc(m.id)}">
          <i class="ph-fill ph-${m.kind === 'masterplan' ? 'map-trifold' : 'squares-four'}"></i>
          <span class="ms-row-lbl">${esc(m.label)}</span>
          <span class="ms-badge" style="background:${s.bg};color:${s.fg}">${s.label}</span>
        </button>`;
      }
    }
    return html || `<div class="ms-empty">No maps in this filter.</div>`;
  }

  function assetRow(name: string, a?: { path?: string; w?: number; h?: number }): string {
    const present = !!a?.path;
    return `<div class="ms-asset"><i class="ph-fill ph-${present ? 'check-circle' : 'x-circle'}" style="color:${present ? '#12a150' : '#c2185b'}"></i>
      <span>${name}</span><span class="ms-asset-dim">${a?.w ? `${a.w}×${a.h}` : present ? '' : 'missing'}</span></div>`;
  }

  function detail(): string {
    const m = selected();
    if (!m) return `<div class="ms-empty" style="padding:60px">Select a map to manage it.</div>`;
    const asset = previewMode === 'threeD' ? m.assets.threeD : m.assets.original;
    const src = asset?.path;
    const has3d = !!m.assets.threeD?.path;
    const hasOverlay = !!m.assets.overlay?.path;
    const parent = m.parentMapId ? maps.find((x) => x.id === m.parentMapId) : undefined;
    const s = STATUS_META[m.status];
    const statusBtns: string[] = [];
    if (m.status !== 'published' && m.status !== 'archived') statusBtns.push(`<button class="ms-btn ms-btn-go" data-act="status" data-status="published">Publish</button>`);
    if (m.status === 'published') statusBtns.push(`<button class="ms-btn" data-act="status" data-status="hidden">Hide</button>`);
    if (m.status === 'hidden') statusBtns.push(`<button class="ms-btn ms-btn-go" data-act="status" data-status="published">Show again</button>`);
    if (m.status !== 'archived') statusBtns.push(`<button class="ms-btn ms-btn-warn" data-act="status" data-status="archived">Archive</button>`);
    if (m.status === 'archived') statusBtns.push(`<button class="ms-btn ms-btn-go" data-act="status" data-status="draft">Restore</button>`);

    return `
    <div class="ms-detail-head">
      <div>
        <div class="ms-eyebrow">${esc(m.city)}${m.sector ? ' · ' + esc(m.sector) : ''}</div>
        <h2>${esc(m.label)}</h2>
        <div class="ms-sub">${m.kind === 'masterplan' ? 'Masterplan' : 'Sector map'}${parent ? ` · under ${esc(parent.label)}` : m.kind === 'sector' ? ' · <b style="color:#c2185b">no parent masterplan</b>' : ''}</div>
      </div>
      <span class="ms-badge lg" style="background:${s.bg};color:${s.fg}">${s.label}${m.clientVisible ? ' · visible' : ''}</span>
    </div>

    <div class="ms-preview" data-act="preview">
      ${src ? `<img src="${esc(src)}" alt="${esc(m.label)} ${previewMode}" draggable="false">
        ${hasOverlay && showOverlay && previewMode === 'original' ? `<img class="ms-ov" src="${esc(m.assets.overlay!.path!)}" alt="overlay" draggable="false">` : ''}
        ${placing ? `<div class="ms-place-hint">Click on the map to drop the pin</div>` : ''}`
        : `<div class="ms-noimg"><i class="ph-fill ph-image-broken" style="font-size:40px"></i><div>No ${previewMode === 'threeD' ? '3D' : 'original'} asset</div></div>`}
    </div>

    <div class="ms-preview-ctl">
      <button class="ms-chip${previewMode === 'original' ? ' on' : ''}" data-act="mode" data-mode="original">Original</button>
      <button class="ms-chip${previewMode === 'threeD' ? ' on' : ''}" data-act="mode" data-mode="threeD" ${has3d ? '' : 'disabled'}>3D</button>
      ${hasOverlay ? `<button class="ms-chip${showOverlay ? ' on' : ''}" data-act="overlay">Overlay</button>` : ''}
      <span style="flex:1"></span>
      ${hasOverlay ? `<span class="ms-hint"><i class="ph-fill ph-info"></i>Check the overlay lines up with the roads/blocks.</span>` : ''}
    </div>

    <div class="ms-cols">
      <div class="ms-card">
        <h3>Assets</h3>
        ${assetRow('Original map', m.assets.original)}
        ${assetRow('3D map', m.assets.threeD)}
        ${assetRow('Overlay (SVG)', m.assets.overlay)}
        ${m.assets.original?.path && !m.assets.original?.w ? `<div class="ms-warn"><i class="ph-fill ph-warning"></i>Dimensions unknown — may not scale correctly.</div>` : ''}
      </div>
      <div class="ms-card">
        <h3>Publishing</h3>
        <p class="ms-note">${m.status === 'published' ? 'This map is on the client screen.' : m.status === 'archived' ? 'Archived maps are hidden everywhere.' : 'Not on the client screen yet.'}</p>
        <div class="ms-btns">${statusBtns.join('')}</div>
      </div>
      <div class="ms-card">
        <h3>Link a plot</h3>
        <p class="ms-note">Pick a plot, then click <b>Place pin</b> and tap the map.</p>
        <select class="ms-select" data-act="linkprop">
          <option value="">Choose a plot…</option>
          ${properties.map((p) => `<option value="${esc(p.id)}"${p.id === linkProp ? ' selected' : ''}>${esc(p.area)} — ${esc(p.loc)}</option>`).join('')}
        </select>
        <div class="ms-btns">
          <button class="ms-btn ${placing ? 'ms-btn-go' : ''}" data-act="place" ${linkProp ? '' : 'disabled'}>${placing ? 'Click the map…' : 'Place pin'}</button>
          <button class="ms-btn" data-act="link" ${linkProp ? '' : 'disabled'}>Link without pin</button>
        </div>
      </div>
    </div>`;
  }

  function render(): void {
    el.innerHTML = `
    <style>
      .ms-wrap{--b:#e4dbf7;display:flex;gap:18px;max-width:1240px;margin:0 auto;padding:26px 30px 60px;align-items:flex-start}
      .ms-side{width:300px;flex:none;background:#fffdf9;border:1px solid var(--b);border-radius:20px;padding:12px;position:sticky;top:18px;max-height:calc(100vh - 40px);overflow:auto}
      .ms-side h1{font-family:var(--pm-font-display);font-weight:500;font-size:24px;margin:8px 10px 4px;color:#241f1c}
      .ms-filters{display:flex;flex-wrap:wrap;gap:5px;padding:6px 8px 10px}
      .ms-fchip{font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:#f0eaff;color:#5b32c4}
      .ms-fchip.on{background:#5b32c4;color:#fff}
      .ms-city{display:flex;justify-content:space-between;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a8792a;padding:10px 10px 4px}
      .ms-city span{background:rgba(138,90,12,.1);color:#8a5a0c;border-radius:999px;padding:1px 7px;font-size:10.5px}
      .ms-row{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 10px;border-radius:11px;transition:background .12s}
      .ms-row:hover{background:#f6f1ff}.ms-row.sel{background:#efe8fb;box-shadow:inset 0 0 0 1px #d6c6f5}
      .ms-row.sec{padding-left:24px}.ms-row.sec .ms-row-lbl{font-weight:600;color:#3a332c}
      .ms-row i{font-size:16px;color:#a8792a;flex:none}.ms-row-lbl{flex:1;font-size:14px;font-weight:700;color:#241f1c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ms-badge{font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;flex:none}.ms-badge.lg{font-size:12px;padding:5px 12px}
      .ms-main{flex:1;min-width:0;background:#fffaf0;border:1px solid #ecdca6;border-radius:22px;padding:24px 26px;box-shadow:var(--pm-shadow-card)}
      .ms-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}
      .ms-eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a8792a}
      .ms-detail-head h2{font-family:var(--pm-font-display);font-weight:500;font-size:28px;margin:4px 0 2px;color:#241f1c}
      .ms-sub{font-size:13.5px;color:#6b6156}
      .ms-preview{position:relative;width:100%;aspect-ratio:16/10;background:#efe6da;border-radius:16px;overflow:hidden}
      .ms-preview img{width:100%;height:100%;object-fit:contain;display:block}
      .ms-preview .ms-ov{position:absolute;inset:0;object-fit:contain;pointer-events:none;mix-blend-mode:multiply}
      .ms-preview.placing{cursor:crosshair}
      .ms-noimg{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:8px;color:#b3a894;text-align:center;font-size:14px;font-weight:700}
      .ms-place-hint{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:rgba(24,16,4,.8);color:#fff8e6;font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px;z-index:3}
      .ms-preview-ctl{display:flex;align-items:center;gap:8px;margin:12px 0 18px;flex-wrap:wrap}
      .ms-chip{font-size:13px;font-weight:800;padding:7px 14px;border-radius:10px;background:#f0eaff;color:#5b32c4}
      .ms-chip.on{background:#ffc93c;color:#231a04}.ms-chip:disabled{opacity:.4}
      .ms-hint{font-size:12.5px;color:#8a5a0c;display:flex;align-items:center;gap:5px}
      .ms-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .ms-card{background:#fffdf9;border:1px solid var(--b);border-radius:16px;padding:16px}
      .ms-card h3{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8d8271;margin:0 0 10px}
      .ms-asset{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#3a332c;padding:4px 0}.ms-asset i{font-size:17px}.ms-asset-dim{margin-left:auto;font-size:12px;color:#8d8271;font-weight:700}
      .ms-note{font-size:13px;color:#6b6156;margin:0 0 12px;line-height:1.4}
      .ms-btns{display:flex;flex-wrap:wrap;gap:8px}
      .ms-btn{font-size:13.5px;font-weight:800;padding:9px 14px;border-radius:11px;background:#f0eaff;color:#5b32c4}
      .ms-btn-go{background:#ffc93c;color:#231a04}.ms-btn-warn{background:#ffe1e6;color:#c2185b}.ms-btn:disabled{opacity:.45}
      .ms-select{width:100%;height:42px;border:1px solid var(--b);border-radius:11px;padding:0 10px;font-family:inherit;font-size:14px;margin-bottom:12px;background:#fff}
      .ms-warn{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#c2185b;margin-top:8px}
      .ms-empty{color:#8d8271;font-size:14px;text-align:center;padding:20px}
      @media(max-width:900px){.ms-wrap{flex-direction:column}.ms-side{width:100%;position:static}.ms-cols{grid-template-columns:1fr}}
    </style>
    <div class="ms-wrap">
      <aside class="ms-side" data-scroll>
        <button class="ms-fchip" data-act="back" style="margin-bottom:10px;display:inline-flex;align-items:center;gap:6px" aria-label="Back to dashboard"><i class="ph-bold ph-arrow-left"></i>Back</button>
        <h1>Map Studio</h1>
        <div class="ms-filters">
          ${(['all', 'draft', 'published', 'hidden', 'archived'] as const).map((f) =>
            `<button class="ms-fchip${statusFilter === f ? ' on' : ''}" data-act="filter" data-filter="${f}">${f === 'all' ? 'All' : STATUS_META[f].label}</button>`).join('')}
        </div>
        ${tree()}
      </aside>
      <main class="ms-main">${detail()}</main>
    </div>
    ${toast ? `<div style="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1f4d3a;color:#fff;font-size:14px;font-weight:700;padding:11px 20px;border-radius:999px;z-index:50;box-shadow:0 14px 30px -12px rgba(0,0,0,.4)">${esc(toast)}</div>` : ''}`;
    if (placing) el.querySelector('.ms-preview')?.classList.add('placing');
  }

  function flash(msg: string): void { toast = msg; render(); setTimeout(() => { toast = null; render(); }, 2600); }

  el.addEventListener('click', async (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'back') { if (hasSafeInAppHistory()) window.history.back(); else window.location.assign('/admin/owner.html'); }
    else if (act === 'select') { selectedId = t.dataset.id!; previewMode = 'original'; placing = false; render(); }
    else if (act === 'filter') { statusFilter = t.dataset.filter as typeof statusFilter; render(); }
    else if (act === 'mode') { if (!(t as HTMLButtonElement).disabled) { previewMode = t.dataset.mode as 'original' | 'threeD'; render(); } }
    else if (act === 'overlay') { showOverlay = !showOverlay; render(); }
    else if (act === 'status') {
      const m = selected(); if (!m) return;
      const status = t.dataset.status as MapStatus;
      const res = await repo.setStatus(m.id, status, status === 'published' ? true : undefined);
      if (res.ok) { flash(`“${m.label}” → ${STATUS_META[status].label}`); await load(); }
      else flash(res.error ?? 'Could not update');
    }
    else if (act === 'place') { if (linkProp) { placing = !placing; render(); } }
    else if (act === 'link') {
      const m = selected(); if (!m || !linkProp) return;
      const res = await repo.linkProperty(linkProp, m.id);
      flash(res.ok ? 'Plot linked to this map' : (res.error ?? 'Could not link'));
      if (res.ok) { linkProp = ''; }
    }
    else if (act === 'preview' && placing) {
      const m = selected(); if (!m || !linkProp) return;
      const box = (t.closest('.ms-preview') as HTMLElement).getBoundingClientRect();
      const me = ev as MouseEvent;
      const x = Math.min(1, Math.max(0, (me.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (me.clientY - box.top) / box.height));
      const res = await repo.linkProperty(linkProp, m.id, +x.toFixed(4), +y.toFixed(4));
      placing = false;
      flash(res.ok ? `Pin placed at ${(x * 100).toFixed(0)}%, ${(y * 100).toFixed(0)}%` : (res.error ?? 'Could not place'));
    }
  });
  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-act="linkprop"]')) { linkProp = (t as HTMLSelectElement).value; render(); }
  });

  el.innerHTML = `<div class="ms-empty" style="padding:80px">Loading maps…</div>`;
  await load();
}
