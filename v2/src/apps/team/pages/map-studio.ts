/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Map Studio
   Integrates MapEngine for the editor canvas.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';
import { mountMapEngine, type MountedMap } from '../../../packages/maps/dom-surface';

export async function renderMapStudio(el: HTMLElement) {
  let view: 'hub' | 'editor' = 'hub';
  let mountedMap: MountedMap | null = null;
  let currentMapId = 'mohali';
  let activeTool = 'select';
  let activeSet = 'A';

  const tools = [
    { id: 'select', icon: 'ph-bold ph-cursor', label: 'Select' },
    { id: 'road', icon: 'ph-fill ph-road-horizon', label: 'Road' },
    { id: 'block', icon: 'ph-fill ph-bounding-box', label: 'Block' },
    { id: 'pin', icon: 'ph-fill ph-map-pin', label: 'Pin' },
    { id: 'text', icon: 'ph-fill ph-text-t', label: 'Text' }
  ];

  const sets = [
    { id: 'A', n: 12 },
    { id: 'B', n: 5 },
    { id: 'C', n: 0 },
  ];

  const goEditor = (mapId: string) => {
    currentMapId = mapId;
    view = 'editor';
    render();
  };

  const goHub = () => {
    if (mountedMap) {
      mountedMap.dispose();
      mountedMap = null;
    }
    view = 'hub';
    render();
  };

  function render() {
    if (view === 'hub') {
      el.innerHTML = `
        <div class="pm-map-hub" style="max-width:1180px;margin:0 auto;padding:38px 34px 70px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#a8792a">Map Studio</div>
              <h1 style="margin:10px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1.02;letter-spacing:-.03em">What are we publishing?</h1>
              <p style="margin:12px 0 0;max-width:540px;font-size:16.5px;line-height:1.5;color:#6b6156;text-wrap:pretty">Everything here lands on the client screen the moment you save it.</p>
            </div>
          </div>

          <div class="pm-map-hub-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:34px">
            <button id="btn-master" style="text-align:left;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:26px;background:#fffaf0;border:1px solid #f6d98d;box-shadow:0 2px 3px rgba(40,30,10,.04),0 30px 56px -40px rgba(120,86,10,.9);transition:transform .34s cubic-bezier(.2,.8,.2,1),box-shadow .34s,border-color .3s;animation:wRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s" onmouseenter="this.style.transform='translateY(-8px)';this.style.borderColor='#ffc93c';this.style.boxShadow='0 2px 3px rgba(40,30,10,.05),0 44px 68px -34px rgba(255,175,20,.95)'" onmouseleave="this.style.transform='none';this.style.borderColor='#f6d98d';this.style.boxShadow='0 2px 3px rgba(40,30,10,.04),0 30px 56px -40px rgba(120,86,10,.9)'">
              <span style="position:relative;display:block;height:152px;overflow:hidden;background:#ffc93c;background-image:radial-gradient(120% 130% at 12% 8%,#ffe28a,#f7b21f 62%,#e79a0c)">
                <span style="position:absolute;inset:0;background:repeating-linear-gradient(58deg,rgba(255,255,255,.22) 0 2px,transparent 2px 26px)"></span>
                <span style="position:absolute;right:-22px;bottom:-36px;width:134px;height:134px;border-radius:50%;background:rgba(255,255,255,.26)"></span>
                <span style="position:absolute;left:22px;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:17px;background:#1a2f24;color:#ffd75e;display:grid;place-items:center;box-shadow:0 16px 28px -14px rgba(26,47,36,.85)"><i class="ph-fill ph-map-trifold" style="font-size:29px"></i></span>
                <span style="position:absolute;top:16px;right:20px;font-family:'Newsreader',serif;font-size:27px;color:rgba(26,47,36,.4)">01</span>
              </span>
              <span style="display:flex;flex-direction:column;flex:1;padding:6px 24px 24px">
                <span style="display:block;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a8792a">Big city map</span>
                <span style="display:block;margin-top:8px;font-family:'Newsreader',serif;font-weight:500;font-size:29px;letter-spacing:-.02em">Publish Masterplan</span>
                <span style="display:block;margin-top:9px;font-size:15px;line-height:1.5;color:#6b6156">Pick which traced roads, blocks and pins light up when your client taps a highlight button.</span>
                <span style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:20px;font-size:15px;font-weight:800;color:#8a5a0c">Open <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
              </span>
            </button>

            <button id="btn-editor" style="text-align:left;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:26px;background:#fffaf0;border:1px solid #d6c6f5;box-shadow:0 2px 3px rgba(40,30,10,.04),0 30px 56px -40px rgba(70,40,150,.8);transition:transform .34s cubic-bezier(.2,.8,.2,1),box-shadow .34s,border-color .3s;animation:wRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s" onmouseenter="this.style.transform='translateY(-8px)';this.style.borderColor='#976eeb';this.style.boxShadow='0 2px 3px rgba(40,30,10,.05),0 44px 68px -34px rgba(151,110,235,.85)'" onmouseleave="this.style.transform='none';this.style.borderColor='#d6c6f5';this.style.boxShadow='0 2px 3px rgba(40,30,10,.04),0 30px 56px -40px rgba(70,40,150,.8)'">
              <span style="position:relative;display:block;height:152px;overflow:hidden;background:#5b32c4;background-image:radial-gradient(120% 130% at 18% 4%,#a983f5,#6a3ed6 58%,#4a26a8)">
                <span style="position:absolute;inset:0;background:repeating-linear-gradient(58deg,rgba(255,255,255,.16) 0 2px,transparent 2px 26px)"></span>
                <span style="position:absolute;right:-20px;top:-36px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.18)"></span>
                <span style="position:absolute;left:22px;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:17px;background:#ffe1e6;color:#5b32c4;display:grid;place-items:center;box-shadow:0 16px 28px -14px rgba(40,20,90,.75)"><i class="ph-fill ph-pen-nib" style="font-size:29px"></i></span>
                <span style="position:absolute;top:16px;right:20px;font-family:'Newsreader',serif;font-size:27px;color:rgba(239,232,251,.5)">02</span>
              </span>
              <span style="display:flex;flex-direction:column;flex:1;padding:6px 24px 24px">
                <span style="display:block;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#5b32c4">Detailed proof map</span>
                <span style="display:block;margin-top:8px;font-family:'Newsreader',serif;font-weight:500;font-size:29px;letter-spacing:-.02em">Publish Sector Map</span>
                <span style="display:block;margin-top:9px;font-size:15px;line-height:1.5;color:#6b6156">Trace roads, draw blocks, drop pins and labels on the layout, then link a pin to a plot.</span>
                <span style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:20px;font-size:15px;font-weight:800;color:#5b32c4">Open <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
              </span>
            </button>

            <button id="btn-manage" style="text-align:left;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:26px;background:#fffaf0;border:1px solid #b3e0c6;box-shadow:0 2px 3px rgba(40,30,10,.04),0 30px 56px -40px rgba(18,120,70,.85);transition:transform .34s cubic-bezier(.2,.8,.2,1),box-shadow .34s,border-color .3s;animation:wRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s" onmouseenter="this.style.transform='translateY(-8px)';this.style.borderColor='#12a150';this.style.boxShadow='0 2px 3px rgba(40,30,10,.05),0 44px 68px -34px rgba(18,161,80,.85)'" onmouseleave="this.style.transform='none';this.style.borderColor='#b3e0c6';this.style.boxShadow='0 2px 3px rgba(40,30,10,.04),0 30px 56px -40px rgba(18,120,70,.85)'">
              <span style="position:relative;display:block;height:152px;overflow:hidden;background:#1f4d3a;background-image:radial-gradient(120% 130% at 88% 6%,#37876a,#1f4d3a 58%,#143528)">
                <span style="position:absolute;inset:0;background:repeating-linear-gradient(122deg,rgba(255,255,255,.12) 0 2px,transparent 2px 26px)"></span>
                <span style="position:absolute;left:-26px;bottom:-36px;width:134px;height:134px;border-radius:50%;background:rgba(122,224,164,.24)"></span>
                <span style="position:absolute;left:22px;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:17px;background:#ffc93c;color:#1a2f24;display:grid;place-items:center;box-shadow:0 16px 28px -14px rgba(0,0,0,.6)"><i class="ph-fill ph-squares-four" style="font-size:29px"></i></span>
                <span style="position:absolute;top:16px;right:20px;font-family:'Newsreader',serif;font-size:27px;color:rgba(154,207,182,.4)">03</span>
              </span>
              <span style="display:flex;flex-direction:column;flex:1;padding:6px 24px 24px">
                <span style="display:block;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#12a150">See what's live</span>
                <span style="display:block;margin-top:8px;font-family:'Newsreader',serif;font-weight:500;font-size:29px;letter-spacing:-.02em">Manage Published</span>
                <span style="display:block;margin-top:9px;font-size:15px;line-height:1.5;color:#6b6156">Take maps offline, track how many plots are linked, and see client usage.</span>
                <span style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:20px;font-size:15px;font-weight:800;color:#12704a">Open <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
              </span>
            </button>
          </div>
        </div>
      `;
      
      el.querySelector('#btn-master')?.addEventListener('click', () => goEditor('mohali'));
      el.querySelector('#btn-editor')?.addEventListener('click', () => goEditor('mohali'));
      el.querySelector('#btn-manage')?.addEventListener('click', () => goEditor('mohali'));

    } else {
      el.innerHTML = `
        <div class="pm-map-editor" style="position:absolute;inset:0;display:flex;flex-direction:column;background:#f0e8ff;background-image:radial-gradient(58% 48% at 6% -2%,rgba(139,96,232,.56),transparent 62%),radial-gradient(52% 44% at 96% 6%,rgba(56,138,186,.44),transparent 62%),radial-gradient(60% 46% at 50% 108%,rgba(255,190,48,.4),transparent 64%)">
          <div class="pm-map-editor-toolbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#fffaf0;background-image:linear-gradient(90deg,#fff6dd,#fffaf0 55%,#f6f0ff);border-bottom:1px solid #ddd2f5;flex:none;z-index:20;min-height:62px">
            <button id="btn-back" style="display:flex;align-items:center;gap:7px;padding:10px 14px;border-radius:12px;background:#f0eaff;font-size:14.5px;font-weight:800;color:#4c463d;flex:none;cursor:pointer;border:none" onmouseenter="this.style.background='#ddd2f5'" onmouseleave="this.style.background='#f0eaff'"><i class="ph-bold ph-arrow-left" style="font-size:15px"></i>Back</button>
            <div style="display:flex;align-items:center;gap:11px;padding:6px 14px;border-radius:14px;background:#fffaf0;border:1px solid #e4dbf7;box-shadow:0 4px 12px -6px rgba(30,28,22,.1)">
              <span style="width:24px;height:24px;border-radius:7px;background:#ffc93c;color:#1a2f24;display:grid;place-items:center;flex:none"><i class="ph-fill ph-map-trifold" style="font-size:14px"></i></span>
              <span style="font-size:14.5px;font-weight:800;color:#241f1c">Mohali</span>
            </div>
            <div style="flex:1"></div>
            <button style="display:flex;align-items:center;gap:7px;padding:11px 13px;border-radius:12px;background:#dcf3e5;border:1px solid #b3e0c6;font-size:13.5px;font-weight:800;color:#12704a;cursor:pointer"><i class="ph-bold ph-link-simple" style="font-size:17px"></i>Link property</button>
            <button title="Undo" style="display:flex;align-items:center;gap:7px;padding:11px 14px;border-radius:12px;background:#f0eaff;font-size:14.5px;font-weight:800;color:#4c463d;flex:none;white-space:nowrap;cursor:pointer;border:none" onmouseenter="this.style.background='#ddd2f5'" onmouseleave="this.style.background='#f0eaff'"><i class="ph-bold ph-arrow-counter-clockwise" style="font-size:15px"></i>Undo</button>
          </div>

          <div class="pm-map-editor-body" style="flex:1;min-height:0;display:flex">
            <div style="flex:1;min-width:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
              <!-- MAP ENGINE CANVAS -->
              <div id="map-engine-canvas" role="img" aria-label="Interactive map editor canvas" style="position:absolute;inset:0"></div>
            </div>

            <!-- RIGHT SIDEBAR: Tools & Sets -->
            <div class="pm-map-editor-sidebar" style="width:340px;flex:none;background:#fffaf0;border-left:1px solid #ddd2f5;overflow:hidden;display:flex;flex-direction:column">
              <div style="padding:16px 18px;background:#fff3d1;border-bottom:1px solid #f6d98d;flex:none">
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
                  <div style="font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a5a0c">Drawing tools</div>
                  <button title="Clear drawn marks" style="font-size:12px;font-weight:700;color:#b8914b;cursor:pointer;background:none;border:none;padding:0" onmouseenter="this.style.color='#8a5a0c'" onmouseleave="this.style.color='#b8914b'">Clear all</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:10px">
                  ${tools.map(t => `
                    <button class="tool-btn" data-id="${t.id}" title="${t.label}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-radius:12px;border:1px solid ${activeTool === t.id ? '#f4ae14' : 'transparent'};background:${activeTool === t.id ? '#ffc93c' : 'rgba(255,255,255,.5)'};color:${activeTool === t.id ? '#241f1c' : '#8a6a14'};transition:all .15s;cursor:pointer">
                      <i class="${t.icon}" style="font-size:20px"></i>
                      <span style="font-size:11px;font-weight:800">${t.label}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
              <div style="padding:14px 18px;background:#efe8fb;border-bottom:1px solid #d6c6f5;flex:none">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                  <div style="font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#5b32c4">Saving into</div>
                  <button style="display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:800;color:#976eeb;background:none;border:none;cursor:pointer;padding:0" onmouseenter="this.style.color='#5b32c4'" onmouseleave="this.style.color='#976eeb'"><i class="ph-bold ph-eye" style="font-size:15px"></i>Hide</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
                  ${sets.map(s => `
                    <button class="set-btn" data-id="${s.id}" style="display:flex;align-items:center;gap:6px;padding:0 12px;height:40px;border-radius:12px;font-size:15px;font-weight:800;border:1px solid ${activeSet === s.id ? '#5b32c4' : '#d6c6f5'};background:${activeSet === s.id ? '#5b32c4' : '#fffaf0'};color:${activeSet === s.id ? '#fff' : '#5b32c4'};transition:all .15s;cursor:pointer">
                      ${s.id}<span style="padding:2px 6px;border-radius:8px;font-size:11.5px;background:${activeSet === s.id ? 'rgba(255,255,255,.25)' : '#f0eaff'}">${s.n}</span>
                    </button>
                  `).join('')}
                  <button title="New set" aria-label="Create a new mark set" style="width:40px;height:40px;border-radius:12px;background:#fffaf0;border:1px dashed #c3a6f0;color:#5b32c4;display:grid;place-items:center;flex:none;cursor:pointer" onmouseenter="this.style.borderColor='#5b32c4'" onmouseleave="this.style.borderColor='#c3a6f0'"><i class="ph-bold ph-plus" style="font-size:15px"></i></button>
                </div>
              </div>

              <div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:16px 18px">
                <div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">In set ${activeSet}</div>
                <div style="margin-top:12px;padding:22px 18px;border-radius:16px;background:#faf7ff;border:1px dashed #e6cf9a;text-align:center">
                  <i class="ph-fill ph-cursor-click" style="font-size:26px;color:#c3ab72"></i>
                  <div style="margin-top:9px;font-size:14.5px;font-weight:800;color:#6b6156">Set ${activeSet} is empty</div>
                  <div style="margin-top:5px;font-size:13.5px;color:#8d8271;line-height:1.45">Pick Road, Block, Pin or Text under the map, then tap the map.</div>
                </div>
              </div>

              <div style="padding:14px 18px;border-top:1px solid #e4dbf7;background:#dcf3e5;display:flex;align-items:center;gap:10px;flex:none">
                <i class="ph-fill ph-broadcast" style="font-size:19px;color:#12704a;flex:none"></i>
                <div style="font-size:13.5px;line-height:1.4;color:#12704a;font-weight:600">Client sees these right now.</div>
              </div>
              <div style="padding:0 18px 18px;background:#dcf3e5;flex:none">
                <button style="width:100%;padding:14px;border-radius:14px;background:#ffc93c;color:#1f1a12;border:none;cursor:pointer;font-size:16px;font-weight:800;box-shadow:0 14px 26px -16px rgba(168,121,42,.95);display:flex;align-items:center;justify-content:center;gap:10px" onmouseenter="this.style.background='#ffd75e'" onmouseleave="this.style.background='#ffc93c'">Publish</button>
              </div>
            </div>
          </div>
        </div>
      `;

      el.querySelector('#btn-back')?.addEventListener('click', goHub);
      
      el.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          activeTool = (e.currentTarget as HTMLElement).dataset.id!;
          render();
        });
      });
      el.querySelectorAll('.set-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          activeSet = (e.currentTarget as HTMLElement).dataset.id!;
          render();
        });
      });

      // Mount Map Engine
      const canvasEl = el.querySelector('#map-engine-canvas') as HTMLElement;
      if (canvasEl && !mountedMap) {
        mountedMap = mountMapEngine(canvasEl);
        mountedMap.engine.setMap(currentMapId, { mode: 'original' });
      } else if (canvasEl && mountedMap) {
        mountedMap.dispose();
        mountedMap = mountMapEngine(canvasEl);
        mountedMap.engine.setMap(currentMapId, { mode: 'original' });
      }
    }
  }

  render();
}
