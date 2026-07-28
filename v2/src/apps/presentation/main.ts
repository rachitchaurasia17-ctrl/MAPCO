/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Client Presentation
   Full-screen, framework-free presentation surface with three views:
   Masterplan, Properties, Sectors
   Source: Client Presentation.dc.html
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../packages/data/mock-adapter';
import { formatINR } from '../../packages/ui/utils';
import type { Property } from '../../packages/data/types';

type View = 'masterplan' | 'properties' | 'sectors';

const VIEWS = [
  { k: 'masterplan' as View, l: 'Masterplan' },
  { k: 'properties' as View, l: 'Properties' },
  { k: 'sectors' as View, l: 'Sector Maps' },
];

export async function initPresentation(container: HTMLElement) {
  const props = await dataAdapter.getProperties();
  const readyProps = props.filter(p => p.photos.length > 0 && !p.sold);
  let view: View = 'masterplan';
  let zoom = 1;
  let tx = 0, ty = 0, dragging = false;
  let sx = 0, sy = 0;
  let selectedProp: Property | null = null;
  let shotIdx = 0;

  function render() {
    const tab = (on: boolean) => `height:38px;display:flex;align-items:center;padding:0 14px;border-radius:10px;font-size:14.5px;font-weight:800;letter-spacing:.01em;white-space:nowrap;transition:all .15s;${on ? 'background:#ffc21e;color:#231a04;box-shadow:0 8px 18px -8px rgba(255,194,30,.95)' : 'background:transparent;color:#f4e5c4'}`;

    container.innerHTML = `
<style>
  .pm-pres{position:fixed;inset:0;overflow:hidden;font-family:var(--pm-font-ui);background:#1a0e2e;color:#fff}
  .pm-pres *{box-sizing:border-box}
  .pm-pres-map{flex:1;min-width:0;position:relative;overflow:hidden;background:#f0e8ff;background-image:radial-gradient(58% 48% at 6% -2%,rgba(139,96,232,.56),transparent 62%),radial-gradient(52% 44% at 96% 6%,rgba(56,138,186,.44),transparent 62%),radial-gradient(60% 46% at 50% 108%,rgba(255,190,48,.4),transparent 64%)}
  .pm-pres-rail{width:clamp(304px,30vw,520px);flex:none;display:flex;flex-direction:column;min-height:0;background:#f5efff;background-image:linear-gradient(180deg,#faf6ff,#ede4ff);box-shadow:inset 1px 0 0 rgba(139,96,232,.18),-18px 0 50px -30px rgba(42,31,77,.6);z-index:28}
  .pm-pres-card{flex:none;background:#fffdfb;border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px rgba(88,52,168,.14),0 14px 30px -22px rgba(42,31,77,.6)}
  .pm-pres-card:hover{border-color:rgba(255,194,30,.5)}
  @media(max-width:768px){
    .pm-pres{flex-direction:column!important}
    .pm-pres-rail{width:100%;height:40vh;min-height:200px}
  }
</style>
<div class="pm-pres" style="display:flex;height:100vh">
  <!-- MAP AREA -->
  <div class="pm-pres-map" id="pm-pres-stage">
    <!-- Glass chrome: top bar -->
    <div style="position:absolute;top:0;left:0;right:0;z-index:20;display:flex;align-items:center;gap:14px;padding:16px 22px;background:linear-gradient(180deg,rgba(20,12,40,.72),rgba(20,12,40,0));backdrop-filter:blur(6px)">
      <a href="#/" style="display:flex;align-items:center;gap:9px;text-decoration:none;flex:none">
        <svg viewBox="0 0 40 40" style="width:34px;height:34px"><rect width="40" height="40" rx="12" fill="#ffc21e"></rect><path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#231a04"></path><path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#231a04" opacity=".42"></path></svg>
        <span style="font-weight:800;font-size:18px;color:#ffc21e">PlotMap</span>
      </a>
      <div style="display:flex;align-items:center;gap:5px;background:rgba(255,248,230,.12);border-radius:12px;padding:4px" id="pm-pres-tabs">
        ${VIEWS.map(v => `<button data-view="${v.k}" style="${tab(v.k === view)}">${v.l}</button>`).join('')}
      </div>
      <div style="flex:1"></div>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="pm-zoom-out" style="width:36px;height:36px;border-radius:10px;background:rgba(255,248,230,.12);color:#f4e5c4;display:grid;place-items:center"><i class="ph-bold ph-minus" style="font-size:16px"></i></button>
        <span style="font-size:13px;font-weight:800;color:#f4e5c4;min-width:46px;text-align:center" id="pm-zoom-pct">${Math.round(zoom * 100)}%</span>
        <button id="pm-zoom-in" style="width:36px;height:36px;border-radius:10px;background:rgba(255,248,230,.12);color:#f4e5c4;display:grid;place-items:center"><i class="ph-bold ph-plus" style="font-size:16px"></i></button>
        <button id="pm-zoom-reset" style="height:36px;padding:0 14px;border-radius:10px;background:rgba(255,248,230,.12);color:#f4e5c4;font-size:13px;font-weight:800">Reset</button>
      </div>
      <a href="#/" style="width:36px;height:36px;border-radius:10px;background:rgba(255,248,230,.12);color:#f4e5c4;display:grid;place-items:center;text-decoration:none"><i class="ph-bold ph-x" style="font-size:16px"></i></a>
    </div>

    <!-- Map canvas -->
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:${dragging ? 'grabbing' : 'grab'}" id="pm-pres-canvas">
      <div style="position:relative;width:80%;max-width:900px;aspect-ratio:16/10;flex:none;transform-origin:center center;transition:transform ${dragging ? '0s' : '.45s'} cubic-bezier(.2,.8,.2,1);transform:translate(${tx}px,${ty}px) scale(${zoom})" id="pm-pres-map-inner">
        <div style="position:absolute;inset:0;border-radius:18px;overflow:hidden;background:#eee5d6;display:grid;place-items:center">
          <div style="text-align:center;opacity:.6">
            <i class="ph-fill ph-map-trifold" style="font-size:80px;color:#b5a0e6"></i>
            <div style="margin-top:12px;font-size:18px;font-weight:700;color:#6b6156">New Chandigarh · Masterplan</div>
            <div style="font-size:14px;color:#8d8271;margin-top:4px">Upload a masterplan in Map Studio to see it here</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PROPERTY RAIL (visible in properties/masterplan view) -->
  <aside class="pm-pres-rail" data-scroll id="pm-pres-rail" style="display:${view === 'sectors' ? 'none' : 'flex'}">
    <div style="padding:20px 22px 14px;border-bottom:1px solid rgba(139,96,232,.18)">
      <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9a8aad">${view === 'properties' ? 'Properties' : 'Pinned on map'}</div>
      <div style="font-size:22px;font-weight:800;color:#241f1c;margin-top:4px">${readyProps.length} plots ready</div>
    </div>
    <div style="flex:1;min-height:0;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:16px" data-scroll>
      ${readyProps.map((p, i) => `
      <div class="pm-pres-card" data-prop-id="${p.id}" style="cursor:pointer;animation:omSlide .4s cubic-bezier(.2,.8,.2,1) both;animation-delay:${(i * 0.04).toFixed(2)}s">
        <div style="display:block;width:100%;height:200px;background-image:url('${p.photos[0] || '/assets/ph-plot-1.png'}');background-size:cover;background-position:center;position:relative">
          <div style="position:absolute;bottom:12px;left:12px;display:flex;gap:7px">
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:5px 11px;border-radius:999px;background:rgba(20,14,4,.7);color:#ffc21e;backdrop-filter:blur(6px)"><i class="ph-fill ph-images" style="font-size:13px"></i>${p.photos.length} photos</span>
          </div>
        </div>
        <div style="padding:16px 18px">
          <div style="font-size:18px;font-weight:800;color:#241f1c">${p.area} · ${p.size}</div>
          <div style="font-size:14px;color:#6b6156;margin-top:3px">${p.facing} facing · ${p.position}</div>
          <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">
            ${p.approvals.map(a => `<span style="font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:#f7e7c6;color:#8a6a14">${a}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #f6e8c8">
            <span style="font-family:var(--pm-font-display);font-weight:600;font-size:22px;color:#c85a1a">${formatINR(p.price)}</span>
            <div style="display:flex;gap:6px">
              <button style="width:38px;height:38px;border-radius:11px;background:#fff3d1;color:#8a6a14;display:grid;place-items:center"><i class="ph-fill ph-map-pin-line" style="font-size:18px"></i></button>
              <button style="width:38px;height:38px;border-radius:11px;background:#efe8fb;color:#6b3fd4;display:grid;place-items:center"><i class="ph-fill ph-arrow-square-out" style="font-size:18px"></i></button>
            </div>
          </div>
        </div>
      </div>`).join('')}
      ${readyProps.length === 0 ? `<div style="padding:40px 20px;text-align:center;color:#8d8271;font-size:15px">No published properties yet. Add them in the Team Workspace.</div>` : ''}
    </div>
  </aside>

  <!-- PROPERTY DETAIL OVERLAY -->
  <div id="pm-pres-detail" style="display:none;position:fixed;inset:0;z-index:100"></div>
</div>`;

    // --- Event wiring ---
    // Tab switching
    document.getElementById('pm-pres-tabs')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-view]') as HTMLElement | null;
      if (!btn) return;
      view = btn.dataset.view as View;
      render();
    });

    // Zoom
    const zoomBy = (d: number) => {
      zoom = Math.min(3.4, Math.max(1, Math.round((zoom + d) * 100) / 100));
      if (zoom <= 1) { tx = 0; ty = 0; }
      const inner = document.getElementById('pm-pres-map-inner');
      if (inner) inner.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`;
      const pct = document.getElementById('pm-zoom-pct');
      if (pct) pct.textContent = Math.round(zoom * 100) + '%';
    };
    document.getElementById('pm-zoom-in')?.addEventListener('click', () => zoomBy(0.3));
    document.getElementById('pm-zoom-out')?.addEventListener('click', () => zoomBy(-0.3));
    document.getElementById('pm-zoom-reset')?.addEventListener('click', () => { zoom = 1; tx = 0; ty = 0; zoomBy(0); });

    // Pan
    const canvas = document.getElementById('pm-pres-canvas');
    canvas?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      sx = e.clientX - tx; sy = e.clientY - ty;
      dragging = true;
      canvas.style.cursor = 'grabbing';
    });
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      tx = e.clientX - sx; ty = e.clientY - sy;
      const inner = document.getElementById('pm-pres-map-inner');
      if (inner) inner.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`;
    };
    const onUp = () => {
      if (dragging) { dragging = false; if (canvas) canvas.style.cursor = 'grab'; }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas?.addEventListener('wheel', (e) => { zoomBy(e.deltaY < 0 ? 0.25 : -0.25); }, { passive: true });

    // Property card click → detail
    document.getElementById('pm-pres-rail')?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('[data-prop-id]') as HTMLElement | null;
      if (!card) return;
      const propId = card.dataset.propId!;
      const p = readyProps.find(pr => pr.id === propId);
      if (!p) return;
      selectedProp = p;
      shotIdx = 0;
      showDetail();
    });

    // ESC to close detail
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const det = document.getElementById('pm-pres-detail');
        if (det && det.style.display !== 'none') { det.style.display = 'none'; selectedProp = null; }
        else { window.location.hash = '#/'; }
      }
      if (selectedProp) {
        if (e.key === 'ArrowRight') { shotIdx = (shotIdx + 1) % selectedProp.photos.length; showDetail(); }
        if (e.key === 'ArrowLeft') { shotIdx = (shotIdx - 1 + selectedProp.photos.length) % selectedProp.photos.length; showDetail(); }
      }
    };
    window.addEventListener('keydown', onKey);

    // Cleanup
    const unbind = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }

  function showDetail() {
    const det = document.getElementById('pm-pres-detail');
    if (!det || !selectedProp) return;
    const p = selectedProp;
    det.style.display = 'block';
    det.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(10,6,20,.85);backdrop-filter:blur(12px);animation:omVeil .2s ease both" id="pm-detail-backdrop"></div>
    <div style="position:absolute;inset:40px;display:flex;gap:0;border-radius:26px;overflow:hidden;background:#fffdfb;box-shadow:0 40px 80px -30px rgba(0,0,0,.7);animation:omPop .3s cubic-bezier(.2,.8,.2,1) both;animation-delay:.05s">
      <!-- Photo -->
      <div style="flex:1.4;min-width:0;position:relative;background:#e7e0d2">
        <div style="position:absolute;inset:0;background-image:url('${p.photos[shotIdx] || '/assets/ph-plot-1.png'}');background-size:cover;background-position:center;transition:background-image .3s ease"></div>
        <div style="position:absolute;bottom:20px;left:20px;right:20px;display:flex;align-items:center;justify-content:space-between">
          <button style="width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,.5);color:#fff;display:grid;place-items:center;backdrop-filter:blur(8px)" id="pm-shot-prev"><i class="ph-bold ph-caret-left" style="font-size:20px"></i></button>
          <span style="font-size:14px;font-weight:800;color:#fff;background:rgba(0,0,0,.5);padding:6px 14px;border-radius:999px;backdrop-filter:blur(8px)">${shotIdx + 1} / ${p.photos.length}</span>
          <button style="width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,.5);color:#fff;display:grid;place-items:center;backdrop-filter:blur(8px)" id="pm-shot-next"><i class="ph-bold ph-caret-right" style="font-size:20px"></i></button>
        </div>
      </div>
      <!-- Info -->
      <div style="flex:1;min-width:0;padding:30px 32px;overflow-y:auto;display:flex;flex-direction:column" data-scroll>
        <button style="position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:12px;background:#f3eeff;color:#6b6156;display:grid;place-items:center;z-index:10" id="pm-detail-close"><i class="ph-bold ph-x" style="font-size:18px"></i></button>
        <div style="font-family:var(--pm-font-display);font-weight:500;font-size:32px;letter-spacing:-.02em;color:#241f1c">${p.area}</div>
        <div style="font-size:16px;color:#6b6156;margin-top:6px">${p.loc}</div>
        <div style="font-family:var(--pm-font-display);font-weight:600;font-size:34px;color:#c85a1a;margin-top:18px">${formatINR(p.price)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">
          <div style="background:#f7e7c6;border-radius:12px;padding:12px 16px;flex:1;min-width:100px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271">Size</div><div style="font-size:16px;font-weight:800;color:#241f1c;margin-top:3px">${p.size}</div></div>
          <div style="background:#f7e7c6;border-radius:12px;padding:12px 16px;flex:1;min-width:100px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271">Facing</div><div style="font-size:16px;font-weight:800;color:#241f1c;margin-top:3px">${p.facing}</div></div>
          <div style="background:#f7e7c6;border-radius:12px;padding:12px 16px;flex:1;min-width:100px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271">Position</div><div style="font-size:16px;font-weight:800;color:#241f1c;margin-top:3px">${p.position}</div></div>
        </div>
        <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin-top:22px">Nearby</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
          ${p.landmarks.map(lm => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:#faf7ff;border:1px solid #e4dbf7">
            <div style="width:36px;height:36px;border-radius:10px;background:#efe8fb;color:#6b3fd4;display:grid;place-items:center;flex:none"><i class="${lm.icon}" style="font-size:18px"></i></div>
            <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#241f1c">${lm.name}</div></div>
            <span style="font-size:13px;font-weight:700;color:#8d8271;flex:none">${lm.distance}</span>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:auto;padding-top:20px">
          <a href="https://wa.me/?text=${encodeURIComponent(p.area + ' — ' + p.size + ' · ' + p.facing + ' facing · ' + p.sector)}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:14px;background:#12a150;color:#fff;font-size:16px;font-weight:800;text-decoration:none"><i class="ph-fill ph-whatsapp-logo" style="font-size:20px"></i>Share</a>
          <a href="https://www.google.com/maps?q=${encodeURIComponent(p.sector + ', Punjab')}&layer=c" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:14px;background:#efe8fb;color:#5b32c4;font-size:16px;font-weight:800;text-decoration:none"><i class="ph-fill ph-street-segment" style="font-size:20px"></i>Street View</a>
        </div>
      </div>
    </div>`;

    // Detail events
    document.getElementById('pm-detail-close')?.addEventListener('click', () => { det.style.display = 'none'; selectedProp = null; });
    document.getElementById('pm-detail-backdrop')?.addEventListener('click', () => { det.style.display = 'none'; selectedProp = null; });
    document.getElementById('pm-shot-prev')?.addEventListener('click', () => { shotIdx = (shotIdx - 1 + p.photos.length) % p.photos.length; showDetail(); });
    document.getElementById('pm-shot-next')?.addEventListener('click', () => { shotIdx = (shotIdx + 1) % p.photos.length; showDetail(); });

    // Thumbnail strip
    const thumbs = det.querySelector('[data-scroll]');
    if (thumbs) {
      const strip = document.createElement('div');
      strip.style.cssText = 'display:flex;gap:8px;margin-top:14px;overflow-x:auto;padding-bottom:4px';
      p.photos.forEach((ph, i) => {
        const thumb = document.createElement('div');
        thumb.style.cssText = `width:72px;height:52px;flex:none;border-radius:10px;background-image:url('${ph}');background-size:cover;background-position:center;cursor:pointer;border:2px solid ${i === shotIdx ? '#ffc93c' : 'transparent'};transition:border-color .15s`;
        thumb.addEventListener('click', () => { shotIdx = i; showDetail(); });
        strip.appendChild(thumb);
      });
      // Insert after price
      const priceEl = thumbs.children[2];
      if (priceEl) priceEl.after(strip);
    }
  }

  render();
}

const app = document.getElementById('app');
if (app) {
  initPresentation(app);
}
