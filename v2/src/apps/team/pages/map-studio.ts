/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Map Studio
   Map editor chrome with tools, panels, set rows
   Source: Team Workspace.dc.html (Publish Masterplan / Sector sections)
   ═══════════════════════════════════════════════════════════════ */

export function renderMapStudio(el: HTMLElement) {
  const TOOLS = [
    { icon: 'ph-fill ph-road-horizon', label: 'Roads', desc: 'Draw road center-lines on the masterplan' },
    { icon: 'ph-fill ph-bounding-box', label: 'Blocks', desc: 'Outline sector or block boundaries' },
    { icon: 'ph-fill ph-map-pin', label: 'Places', desc: 'Pin landmarks, projects, and amenities' },
    { icon: 'ph-fill ph-text-t', label: 'Labels', desc: 'Add text labels anywhere on the map' },
  ];

  const SETS = [
    { id: 'A', label: 'Set A', marks: 12, color: '#ffc93c' },
    { id: 'B', label: 'Set B', marks: 8, color: '#5b32c4' },
    { id: 'C', label: 'Set C', marks: 4, color: '#12a150' },
  ];

  el.innerHTML = `
<div style="display:flex;height:100%;min-height:0">
  <!-- Left: Map canvas area -->
  <div style="flex:1;min-width:0;position:relative;overflow:hidden;background:#f0e8ff;background-image:radial-gradient(58% 48% at 6% -2%,rgba(139,96,232,.3),transparent 62%),radial-gradient(52% 44% at 96% 6%,rgba(56,138,186,.25),transparent 62%)">
    <!-- Tools bar -->
    <div style="position:absolute;top:16px;left:16px;display:flex;gap:8px;z-index:10;animation:omRise .4s cubic-bezier(.2,.8,.2,1) both">
      ${TOOLS.map(t => `
      <button style="display:flex;align-items:center;gap:8px;height:42px;padding:0 14px;border-radius:12px;background:rgba(255,248,230,.9);backdrop-filter:blur(8px);border:1px solid #e4dbf7;font-size:13.5px;font-weight:800;color:#241f1c;box-shadow:0 4px 12px -6px rgba(30,28,22,.3);transition:all .15s" onmouseenter="this.style.background='#ffc93c'" onmouseleave="this.style.background='rgba(255,248,230,.9)'">
        <i class="${t.icon}" style="font-size:18px"></i>${t.label}
      </button>`).join('')}
    </div>

    <!-- Map placeholder -->
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <div style="text-align:center;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div style="width:120px;height:120px;margin:0 auto;border-radius:28px;background:#efe8fb;display:grid;place-items:center"><i class="ph-fill ph-image" style="font-size:54px;color:#b5a0e6"></i></div>
        <div style="margin-top:18px;font-family:var(--pm-font-display);font-weight:500;font-size:24px;color:#241f1c">Drop a masterplan image here</div>
        <p style="margin-top:8px;font-size:15px;color:#6b6156;max-width:380px">Upload your city masterplan PNG or JPG. It will fill the entire canvas and you can start marking roads, blocks, and places.</p>
        <button style="margin-top:16px;display:inline-flex;align-items:center;gap:9px;height:52px;padding:0 28px;border-radius:14px;background:#ffc93c;color:#241d0c;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-upload-simple" style="font-size:20px"></i>Upload masterplan</button>
      </div>
    </div>

    <!-- Bottom: set row -->
    <div style="position:absolute;bottom:16px;left:16px;right:16px;display:flex;align-items:center;gap:10px;z-index:10;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
      ${SETS.map((s, i) => `
      <button style="display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:11px;font-size:13.5px;font-weight:800;background:${i === 0 ? '#ffc93c' : 'rgba(255,248,230,.9)'};color:${i === 0 ? '#241d0c' : '#6b6156'};border:1px solid ${i === 0 ? '#f4ae14' : '#e4dbf7'};backdrop-filter:blur(8px);box-shadow:${i === 0 ? '0 8px 16px -8px rgba(255,194,30,.6)' : '0 4px 12px -6px rgba(30,28,22,.2)'};transition:all .15s">
        <span style="width:10px;height:10px;border-radius:50%;background:${s.color}"></span>${s.label} · ${s.marks} marks
      </button>`).join('')}
      <button style="display:flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:11px;font-size:13.5px;font-weight:800;background:rgba(255,248,230,.9);color:#5b32c4;border:1px solid #e4dbf7;backdrop-filter:blur(8px)">
        <i class="ph-bold ph-plus" style="font-size:14px"></i>New set
      </button>
    </div>

    <!-- Zoom controls -->
    <div style="position:absolute;bottom:16px;right:16px;display:flex;flex-direction:column;gap:6px;z-index:10">
      <button style="width:40px;height:40px;border-radius:11px;background:rgba(255,248,230,.9);backdrop-filter:blur(8px);border:1px solid #e4dbf7;display:grid;place-items:center;font-size:20px;color:#241f1c;box-shadow:0 4px 12px -6px rgba(30,28,22,.3)"><i class="ph-bold ph-plus"></i></button>
      <button style="width:40px;height:40px;border-radius:11px;background:rgba(255,248,230,.9);backdrop-filter:blur(8px);border:1px solid #e4dbf7;display:grid;place-items:center;font-size:20px;color:#241f1c;box-shadow:0 4px 12px -6px rgba(30,28,22,.3)"><i class="ph-bold ph-minus"></i></button>
      <button style="width:40px;height:40px;border-radius:11px;background:rgba(255,248,230,.9);backdrop-filter:blur(8px);border:1px solid #e4dbf7;display:grid;place-items:center;font-size:20px;color:#241f1c;box-shadow:0 4px 12px -6px rgba(30,28,22,.3)"><i class="ph-bold ph-arrows-out"></i></button>
    </div>
  </div>

  <!-- Right panel -->
  <aside style="width:340px;flex:none;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;background:rgba(252,250,255,.92);border-left:1px solid #ddd2f5;backdrop-filter:blur(12px);display:flex;flex-direction:column" data-scroll>
    <div style="padding:22px 22px 18px;border-bottom:1px solid #ddd2f5">
      <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8d8271">Editing</div>
      <div style="margin-top:6px;font-size:20px;font-weight:800;color:#241f1c">New Chandigarh</div>
      <div style="font-size:13.5px;color:#6b6156;margin-top:2px">Masterplan · Draft</div>
    </div>

    <div style="padding:16px 22px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        ${['Roads', 'Sectors', 'Blocks', 'Places'].map((tab, i) => `<button style="height:34px;padding:0 12px;border-radius:9px;font-size:13px;font-weight:800;${i === 0 ? 'background:#ffc93c;color:#241d0c' : 'background:rgba(255,248,230,.3);color:#6b6156'};transition:all .15s">${tab}</button>`).join('')}
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${['PR-7 Highway · 200ft', 'GMADA Expressway', 'Airport Road · 150ft', 'Madhya Marg Extension'].map((road, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='#f4ecdd'" onmouseleave="this.style.background='#faf7ff'">
          <div style="width:34px;height:34px;border-radius:9px;background:#fff3d1;color:#8a6a14;display:grid;place-items:center;flex:none"><i class="ph-fill ph-road-horizon" style="font-size:18px"></i></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${road}</div>
          </div>
          <button style="width:28px;height:28px;border-radius:8px;background:#f3eeff;color:#8a7a52;display:grid;place-items:center;flex:none"><i class="ph-bold ph-dots-three" style="font-size:14px"></i></button>
        </div>`).join('')}
      </div>

      <button style="width:100%;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:12px;background:#f3eeff;color:#5b32c4;font-size:14px;font-weight:800;border:1px dashed #ddd2f5"><i class="ph-bold ph-plus" style="font-size:16px"></i>Draw a new road</button>
    </div>

    <div style="margin-top:auto;padding:16px 22px;border-top:1px solid #ddd2f5">
      <button style="width:100%;height:52px;border-radius:14px;background:#ffc93c;color:#241d0c;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85);display:flex;align-items:center;justify-content:center;gap:10px"><i class="ph-fill ph-upload-simple" style="font-size:20px"></i>Publish this map</button>
    </div>
  </aside>
</div>`;
}
