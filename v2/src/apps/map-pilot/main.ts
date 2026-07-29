/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Map Engine Pilot page (controlled demo)
   Exercises the reusable maps package: masterplan ↔ sector, 3D on
   demand, pan/zoom/Fit Map, overlays, single-active + cleanup.
   ═══════════════════════════════════════════════════════════════ */
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { getMaps, mountMapEngine, type RenderMode } from '../../packages/maps';

function initPilot(root: HTMLElement): void {
  root.innerHTML = `
<style>
  .mp-wrap{position:fixed;inset:0;display:flex;flex-direction:column;background:#0f0a1a;color:#f0eaff;font-family:var(--pm-font-ui)}
  .mp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:#150f24;border-bottom:1px solid rgba(139,96,232,.2)}
  .mp-bar select,.mp-bar button{font:inherit;border-radius:10px;border:1px solid rgba(139,96,232,.35);background:#1a1428;color:#f0eaff;padding:8px 12px;cursor:pointer}
  .mp-bar button:hover{background:#241a33}
  .mp-bar .mp-spacer{flex:1}
  .mp-stage{flex:1;min-height:0;background:#0b0714}
  .mp-hint{font-size:12px;color:#9a8aad}
</style>
<div class="mp-wrap">
  <div class="mp-bar">
    <label class="mp-hint" for="mp-map">Map</label>
    <select id="mp-map">${getMaps().map((m) => `<option value="${m.id}">${m.title}</option>`).join('')}</select>
    <label class="mp-hint" for="mp-mode">Mode</label>
    <select id="mp-mode"><option value="original">Original</option><option value="threeD">Easy / 3D</option></select>
    <button id="mp-zin" aria-label="Zoom in">＋</button>
    <button id="mp-zout" aria-label="Zoom out">－</button>
    <button id="mp-fit">Fit Map</button>
    <span class="mp-spacer"></span>
    <span class="mp-hint" id="mp-status">—</span>
  </div>
  <div class="mp-stage" id="mp-stage"></div>
</div>`;

  const stage = document.getElementById('mp-stage')!;
  const mapSel = document.getElementById('mp-map') as HTMLSelectElement;
  const modeSel = document.getElementById('mp-mode') as HTMLSelectElement;
  const status = document.getElementById('mp-status')!;
  const mounted = mountMapEngine(stage);

  const apply = async () => {
    status.textContent = 'Loading…';
    const res = await mounted.engine.setMap(mapSel.value, { mode: modeSel.value as RenderMode });
    status.textContent = res.ok ? `Active: ${res.mapId} · ${res.mode}` : `Unavailable (${res.reason})`;
  };

  mapSel.addEventListener('change', apply);
  modeSel.addEventListener('change', apply);
  document.getElementById('mp-zin')!.addEventListener('click', () => mounted.engine.zoom(1.3));
  document.getElementById('mp-zout')!.addEventListener('click', () => mounted.engine.zoom(1 / 1.3));
  document.getElementById('mp-fit')!.addEventListener('click', () => mounted.engine.fit());
  window.addEventListener('pagehide', () => mounted.dispose(), { once: true });

  void apply();
}

const app = document.getElementById('app');
if (app) initPilot(app);
