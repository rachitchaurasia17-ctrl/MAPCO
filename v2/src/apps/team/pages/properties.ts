/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Properties
   Source: Team Workspace.dc.html (isProps)
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/mock-adapter-v2';

export async function renderTeamProperties(el: HTMLElement) {
  const res = await adapter.properties.list({ limit: 100 });
  const props = res.ok ? res.value.items : [];

  el.innerHTML = `
    <div style="max-width:1140px;margin:0 auto;padding:40px 34px 70px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div>
          <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:38px;letter-spacing:-.02em">Properties</h1>
          <p style="margin:9px 0 0;font-size:16.5px;color:#6b6156">Everything the team has entered. Toggle a plot to put it on the client screen.</p>
        </div>
        <button style="display:flex;align-items:center;gap:9px;padding:14px 20px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:15.5px;font-weight:800;box-shadow:0 14px 26px -16px rgba(168,121,42,.9)"><i class="ph-bold ph-plus" style="font-size:16px"></i>Add a property</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-top:26px">
        ${props.map(p => {
          const shots = p.photos.length;
          const isPub = p.published;
          const thumbStyle = p.photos[0] 
            ? `position:absolute;inset:0;background:url('${p.photos[0]}') center/cover` 
            : `position:absolute;inset:0;display:grid;place-items:center;background:#efdcb2;color:#b5924a;font-size:40px`;
          
          const badge = isPub ? 'Published' : (shots > 0 ? 'Ready' : 'Need photos');
          const badgeStyle = isPub 
            ? 'padding:6px 11px;border-radius:9px;background:#d9f5e3;font-size:12.5px;font-weight:700;color:#0b6f39;box-shadow:0 2px 8px rgba(0,0,0,.15)'
            : (shots > 0 ? 'padding:6px 11px;border-radius:9px;background:#fffaf0;font-size:12.5px;font-weight:700;color:#8a5a0c;box-shadow:0 2px 8px rgba(0,0,0,.15)' : 'padding:6px 11px;border-radius:9px;background:#ffe1e6;font-size:12.5px;font-weight:700;color:#c2185b;box-shadow:0 2px 8px rgba(0,0,0,.15)');

          const btnStyle = isPub
            ? 'display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:11px 14px;border-radius:12px;background:#dcf3e5;border:1px solid #b3e0c6;font-size:13.5px;font-weight:800;color:#12704a'
            : 'display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:11px 14px;border-radius:12px;background:#fffaf0;border:1px solid #f6d98d;font-size:13.5px;font-weight:800;color:#8a5a0c';
          const btnIcon = isPub ? 'ph-bold ph-eye' : 'ph-bold ph-eye-slash';
          const btnLabel = isPub ? 'Hide property' : 'Publish to clients';

          return `
          <div style="border-radius:22px;overflow:hidden;background:#fffaf0;border:1px solid #ddd2f5;box-shadow:0 2px 3px rgba(40,30,10,.04),0 22px 44px -36px rgba(60,44,12,.8);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
            <div style="position:relative;height:150px;background:#efdcb2">
              <div style="${thumbStyle}">${p.photos[0] ? '' : '<i class="ph-fill ph-image"></i>'}</div>
              <div style="position:absolute;top:12px;left:12px;display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:9px;background:rgba(24,16,4,.62);backdrop-filter:blur(8px);font-size:12.5px;font-weight:700;color:#faf7ff">${shots} photos</div>
              <div style="position:absolute;top:12px;right:12px"><span style="${badgeStyle}">${badge}</span></div>
            </div>
            <div style="padding:18px 20px 20px">
              <div style="font-size:17.5px;font-weight:800;letter-spacing:-.01em">${p.type}</div>
              <div style="margin-top:4px;font-size:14.5px;color:#6b6156">${p.loc}, ${p.area}</div>
              <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
                <span style="padding:6px 10px;border-radius:9px;background:#f0eaff;font-size:12.5px;font-weight:700;color:#6b5a34">${p.size || p.area}</span>
                <span style="padding:6px 10px;border-radius:9px;background:#f0eaff;font-size:12.5px;font-weight:700;color:#6b5a34">${p.facing} facing</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
                <button style="${btnStyle}"><i class="${btnIcon}" style="font-size:16px"></i>${btnLabel}</button>
                <button style="display:flex;align-items:center;gap:7px;padding:11px 14px;border-radius:12px;background:#efe8fb;border:1px solid #d6c6f5;font-size:13.5px;font-weight:800;color:#5b32c4;cursor:pointer" onmouseenter="this.style.borderColor='#5b32c4'" onmouseleave="this.style.borderColor='#d6c6f5'"><i class="ph-bold ph-pencil-simple" style="font-size:16px"></i>Edit</button>
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
