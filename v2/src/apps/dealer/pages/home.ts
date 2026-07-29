import { getProfile } from '../../../packages/auth/auth';
import { formatDateShort } from '../../../packages/ui/utils';
import { MockDataAdapterV2 } from '../../../packages/data/mock-adapter-v2';

export function renderHome(container: HTMLElement) {
  const profile = getProfile();
  const firstName = (profile.name || profile.dealerName || '').split(' ')[0] || 'There';
  
  const h = new Date().getHours();
  let greeting = 'Good morning';
  if (h >= 12 && h < 17) greeting = 'Good afternoon';
  else if (h >= 17) greeting = 'Good evening';

  const CIRC = 2 * Math.PI * 62;
  const stats = {
    dOpens: 192,
    dLinkOpens: 24,
    dLinkSub: '3',
    dHot: 'New Chandigarh',
    dHotSub: '83 opens this month',
    segs: [
      { city: 'New Chandigarh', pct: 43, color: '#ffc93c', dash: CIRC * 0.43, offset: 0 },
      { city: 'Mohali', pct: 27, color: '#8a63e8', dash: CIRC * 0.27, offset: -CIRC * 0.43 },
      { city: 'Chandigarh', pct: 15, color: '#12a150', dash: CIRC * 0.15, offset: -CIRC * 0.70 },
      { city: 'Panchkula', pct: 7, color: '#d97b38', dash: CIRC * 0.07, offset: -CIRC * 0.85 }
    ],
    wantBars: [
      { want: 'New Chandigarh', tag: 'Source stock', tagStyle: 'font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b5322a;background:#ffe1e6;padding:3px 9px;border-radius:999px', opens: '83', barStyle: 'width:83%;height:100%;background:#ffc93c' },
      { want: 'Mohali', tag: 'Source stock', tagStyle: 'font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b5322a;background:#ffe1e6;padding:3px 9px;border-radius:999px', opens: '51', barStyle: 'width:51%;height:100%;background:#8a63e8' },
      { want: 'Chandigarh', tag: 'Stock is fine', tagStyle: 'font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a6a14;background:#fff3d1;padding:3px 9px;border-radius:999px', opens: '29', barStyle: 'width:29%;height:100%;background:#12a150' },
      { want: 'Panchkula', tag: 'Quiet', tagStyle: 'font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a8070;background:#f5f0e6;padding:3px 9px;border-radius:999px', opens: '14', barStyle: 'width:14%;height:100%;background:#d97b38' }
    ],
    vsCols: [
      { city: 'New Chandigarh', opens: 46, stock: 2, barA: 'flex:1;min-width:0;height:92%;background:#8a63e8;border-radius:4px 4px 0 0;position:relative', labA: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#5b32c4', barB: 'flex:1;min-width:0;height:4%;background:#ffc93c;border-radius:4px 4px 0 0;position:relative', labB: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#a8600c', chipStyle: 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#ffe1e6;color:#b5322a', chip: 'Source more' },
      { city: 'Aerocity', opens: 41, stock: 2, barA: 'flex:1;min-width:0;height:82%;background:#8a63e8;border-radius:4px 4px 0 0;position:relative', labA: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#5b32c4', barB: 'flex:1;min-width:0;height:4%;background:#ffc93c;border-radius:4px 4px 0 0;position:relative', labB: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#a8600c', chipStyle: 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#ffe1e6;color:#b5322a', chip: 'Source more' },
      { city: 'Mohali', opens: 34, stock: 12, barA: 'flex:1;min-width:0;height:68%;background:#8a63e8;border-radius:4px 4px 0 0;position:relative', labA: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#5b32c4', barB: 'flex:1;min-width:0;height:24%;background:#ffc93c;border-radius:4px 4px 0 0;position:relative', labB: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#a8600c', chipStyle: 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#c9f0d9;color:#0b8f45', chip: 'Covered' },
      { city: 'Chandigarh', opens: 26, stock: 1, barA: 'flex:1;min-width:0;height:52%;background:#8a63e8;border-radius:4px 4px 0 0;position:relative', labA: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#5b32c4', barB: 'flex:1;min-width:0;height:2%;background:#ffc93c;border-radius:4px 4px 0 0;position:relative', labB: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#a8600c', chipStyle: 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#ffe1e6;color:#b5322a', chip: 'Source more' },
      { city: 'Aerotropolis', opens: 22, stock: 2, barA: 'flex:1;min-width:0;height:44%;background:#8a63e8;border-radius:4px 4px 0 0;position:relative', labA: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#5b32c4', barB: 'flex:1;min-width:0;height:4%;background:#ffc93c;border-radius:4px 4px 0 0;position:relative', labB: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#a8600c', chipStyle: 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#c9f0d9;color:#0b8f45', chip: 'Covered' },
      { city: 'Zirakpur', opens: 18, stock: 1, barA: 'flex:1;min-width:0;height:36%;background:#8a63e8;border-radius:4px 4px 0 0;position:relative', labA: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#5b32c4', barB: 'flex:1;min-width:0;height:2%;background:#ffc93c;border-radius:4px 4px 0 0;position:relative', labB: 'position:absolute;bottom:100%;left:50%;transform:translate(-50%, -4px);font-size:12px;font-weight:800;color:#a8600c', chipStyle: 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#ffe1e6;color:#b5322a', chip: 'Source more' }
    ],
    attentionRows: [
      { rank: 1, rankStyle: 'position:absolute;top:-10px;left:-10px;width:32px;height:32px;border-radius:50%;background:#1f1a12;color:#ffc93c;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(31,26,18,.2);z-index:2', cardStyle: 'position:relative;background:#fff;border-radius:20px;padding:12px;text-align:left;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(31,26,18,.05);transition:transform .2s, box-shadow .2s', photoStyle: 'display:block;position:relative;width:100%;aspect-ratio:4/3;background:#f5f0e6 url(https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80) center/cover;border-radius:12px', plotNo: 'Plot 104', size: '500 sq yd', price: '₹2.35 Cr', loc: 'Eco City', views: 31, viewsStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#ff5e4d;background:#fff0f0;padding:4px 8px;border-radius:999px;margin-top:10px' },
      { rank: 2, rankStyle: 'position:absolute;top:-10px;left:-10px;width:32px;height:32px;border-radius:50%;background:#1f1a12;color:#ffc93c;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(31,26,18,.2);z-index:2', cardStyle: 'position:relative;background:#fff;border-radius:20px;padding:12px;text-align:left;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(31,26,18,.05);transition:transform .2s, box-shadow .2s', photoStyle: 'display:block;position:relative;width:100%;aspect-ratio:4/3;background:#f5f0e6 url(https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=600&q=80) center/cover;border-radius:12px', plotNo: 'Plot 45', size: '300 sq yd', price: '₹2.75 Cr', loc: 'Aerocity', views: 27, viewsStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#ff5e4d;background:#fff0f0;padding:4px 8px;border-radius:999px;margin-top:10px' },
      { rank: 3, rankStyle: 'position:absolute;top:-10px;left:-10px;width:32px;height:32px;border-radius:50%;background:#1f1a12;color:#ffc93c;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(31,26,18,.2);z-index:2', cardStyle: 'position:relative;background:#fff;border-radius:20px;padding:12px;text-align:left;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(31,26,18,.05);transition:transform .2s, box-shadow .2s', photoStyle: 'display:block;position:relative;width:100%;aspect-ratio:4/3;background:#f5f0e6 url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80) center/cover;border-radius:12px', plotNo: 'Plot 112', size: '250 sq yd', price: '₹1.65 Cr', loc: 'Sector 79', views: 24, viewsStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#a8600c;background:#fff3d1;padding:4px 8px;border-radius:999px;margin-top:10px' },
      { rank: 4, rankStyle: 'position:absolute;top:-10px;left:-10px;width:32px;height:32px;border-radius:50%;background:#e0d8c8;color:#4c463d;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(31,26,18,.1);z-index:2', cardStyle: 'position:relative;background:#fff;border-radius:20px;padding:12px;text-align:left;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(31,26,18,.05);transition:transform .2s, box-shadow .2s', photoStyle: 'display:block;position:relative;width:100%;aspect-ratio:4/3;background:#f5f0e6 url(https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80) center/cover;border-radius:12px', plotNo: 'Plot 8', size: '400 sq yd', price: '₹4.8 Cr', loc: 'Omaxe', views: 21, viewsStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#4c463d;background:#f5f0e6;padding:4px 8px;border-radius:999px;margin-top:10px' },
      { rank: 5, rankStyle: 'position:absolute;top:-10px;left:-10px;width:32px;height:32px;border-radius:50%;background:#e0d8c8;color:#4c463d;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(31,26,18,.1);z-index:2', cardStyle: 'position:relative;background:#fff;border-radius:20px;padding:12px;text-align:left;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(31,26,18,.05);transition:transform .2s, box-shadow .2s', photoStyle: 'display:block;position:relative;width:100%;aspect-ratio:4/3;background:#f5f0e6 url(https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80) center/cover;border-radius:12px', plotNo: 'Plot 9', size: '300 sq yd', price: '₹3.2 Cr', loc: 'Sector 9', views: 18, viewsStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#4c463d;background:#f5f0e6;padding:4px 8px;border-radius:999px;margin-top:10px' }
    ]
  };

  container.innerHTML = `
    
      <div style="max-width:1120px;margin:0 auto;padding:30px 40px 70px">

        <div style="border-radius:28px;padding:32px 34px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">${formatDateShort()}</div>
              <h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">${greeting}, ${firstName}.</h1>
              <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Only from your own presentations and the links you sent.</p>
            </div>
            <a href="Client Presentation.dc.html" style="display:flex;align-items:center;gap:11px;height:62px;padding:0 26px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)" onmouseover="this.style.background='#f4ae14'" onmouseout="this.style.background='#ffc93c'"><i class="ph-fill ph-projector-screen-chart" style="font-size:22px"></i>Show the map</a>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px">
            <div style="border-radius:20px;padding:20px 22px;background:#ffc93c;background-image:linear-gradient(140deg,#ffdc7a,#f4ae14)">
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a6a14"><i class="ph-fill ph-cursor-click" style="font-size:16px"></i>Opened while presenting</div>
              <div style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#241d0c;margin-top:6px">${stats.dOpens}</div>
            </div>
            <div style="border-radius:20px;padding:20px 22px;background:#6b3fd4;background-image:linear-gradient(140deg,#8a63e8,#5b32c4)">
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#d8c8ff"><i class="ph-fill ph-paper-plane-tilt" style="font-size:16px"></i>Link opens</div>
              <div style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#fff;margin-top:6px">${stats.dLinkOpens}</div>
              <div style="font-size:13px;font-weight:700;color:#d8c8ff;margin-top:4px">${stats.dLinkSub} active links</div>
            </div>
            <div style="border-radius:20px;padding:20px 22px;background:#12a150;background-image:linear-gradient(140deg,#2ec06b,#0b8f45)">
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9f0d9"><i class="ph-fill ph-fire" style="font-size:16px"></i>Hottest area</div>
              <div style="font-family:'Newsreader',serif;font-weight:600;font-size:27px;line-height:1.15;color:#fff;margin-top:12px">${stats.dHot}</div>
              <div style="font-size:14px;font-weight:700;color:#c9f0d9;margin-top:3px">${stats.dHotSub}</div>
            </div>
          </div>
        </div>

        <h2 style="font-family:'Newsreader',serif;font-weight:500;font-size:29px;letter-spacing:-.02em;color:#1f1a12;margin:36px 0 16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.04s">Buyer interests</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
          <div style="min-width:0;background:#fff3d1;border:1.5px solid #f6e3ab;border-radius:24px;padding:24px 26px">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
              <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">Where buyers look</h3>
              <span style="font-size:12.5px;font-weight:800;color:#8a6a14;white-space:nowrap">${stats.dOpens + stats.dLinkOpens} opens</span>
            </div>
            <div style="display:flex;align-items:center;gap:18px;margin-top:16px;flex-wrap:wrap">
              <div style="position:relative;width:158px;height:158px;flex:none">
                <svg viewBox="0 0 180 180" style="width:158px;height:158px;transform:rotate(-90deg);filter:drop-shadow(0 10px 20px rgba(31,26,18,.2))">
                  ${stats.segs.map((g: any) => `
                    <circle cx="90" cy="90" r="62" fill="none" stroke="${g.color}" stroke-width="34" stroke-dasharray="${g.dash} ${CIRC - g.dash}" stroke-dashoffset="${g.offset}"></circle>
                  `).join('')}
                </svg>
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
                  <div style="font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1;color:#241f1c">${stats.segs[0].pct}%</div>
                  <div style="font-size:11.5px;font-weight:800;color:#8a6a14;text-align:center;max-width:96px;line-height:1.25;margin-top:3px">${stats.segs[0].city}</div>
                </div>
              </div>
              <div style="flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:8px">
                ${stats.segs.slice(0, 5).map((l: any) => `
                  <div style="display:flex;align-items:center;gap:10px;padding:5px 7px;border-radius:10px;cursor:pointer;transition:background .1s" onmouseover="this.style.background='#ffe9a8'" onmouseout="this.style.background='transparent'">
                    <span style="width:12px;height:12px;border-radius:50%;background:${l.color};flex:none"></span>
                    <span style="flex:1;min-width:0;text-align:left;font-size:15px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.city}</span>
                    <span style="font-family:'Newsreader',serif;font-size:18px;font-weight:600;color:#241f1c;flex:none">${l.pct}%</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="min-width:0;background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:24px;padding:24px 26px">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
              <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">What gets opened most</h3>
              <span style="font-size:12.5px;font-weight:800;color:#5b32c4;white-space:nowrap">by type</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:11px;margin-top:16px">
              ${stats.wantBars.map((w: any) => `
                <div>
                  <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
                    <span style="font-size:15.5px;font-weight:800;color:#241f1c">${w.want}</span>
                    <span style="${w.tagStyle}">${w.tag}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:9px;margin-top:6px">
                    <div style="flex:1;min-width:70px;height:16px;border-radius:999px;background:#ded0fa;overflow:hidden"><div style="${w.barStyle}"></div></div>
                    <span style="font-family:'Newsreader',serif;font-size:20px;font-weight:600;color:#5b32c4;flex:none">${w.opens}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div style="background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:24px;padding:24px 26px;margin-top:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.08s">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="min-width:0">
              <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">Interest on the map vs plots you hold</h3>
              <p style="margin:4px 0 0;font-size:14px;color:#8a8070">Opens are counted while you present. Nothing here comes from outside.</p>
            </div>
            <div style="display:flex;align-items:center;gap:14px">
              <span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#5b32c4"><span style="width:12px;height:12px;border-radius:4px;background:#6b3fd4"></span>Opens</span>
              <span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#a8600c"><span style="width:12px;height:12px;border-radius:4px;background:#ffc93c"></span>Your plots</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:12px;margin-top:20px;align-items:end">
            ${stats.vsCols.map((v: any) => `
              <div style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:9px">
                <div style="display:flex;align-items:flex-end;gap:6px;height:150px">
                  <div style="${v.barA}"><span style="${v.labA}">${v.opens}</span></div>
                  <div style="${v.barB}"><span style="${v.labB}">${v.stock}</span></div>
                </div>
                <div style="font-size:12.5px;font-weight:800;color:#4c463d;text-align:center;line-height:1.25;max-width:100%;overflow:hidden;text-overflow:ellipsis">${v.city}</div>
                <span style="${v.chipStyle}">${v.chip}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:18px;padding:26px 30px;background:#fff6dd;background-image:linear-gradient(90deg,#fff3d1,#fff8e6);border-radius:24px;border:1px solid #f6d98d;box-shadow:0 8px 24px -12px rgba(120,86,10,.35);margin-top:18px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
          <div style="width:50px;height:50px;border-radius:14px;background:#f6d98d;color:#a8600c;display:grid;place-items:center;flex:none;box-shadow:0 4px 12px rgba(168,96,12,.2)">
            <i class="ph-fill ph-fire" style="font-size:26px"></i>
          </div>
          <div>
            <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a8600c">Hottest Area · ${stats.dHot}</div>
            <p style="margin:6px 0 0;font-size:17.5px;color:#6b5a34">New Chandigarh is your most looked-at area with 46 opens, and you have 2 plots ready. Lead with these.</p>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin:30px 0 14px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s">
          <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a8070">Plots pulling the most attention</div>
          <span style="font-size:12.5px;font-weight:800;color:#8a6a14;background:#fff3d1;border-radius:999px;padding:5px 13px">From your presentations</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.14s">
          ${stats.attentionRows.map((a: any) => `
            <button class="pm-hover-card" style="${a.cardStyle}" >
              <span style="${a.photoStyle}">
                <span style="${a.rankStyle}">${a.rank}</span>
                <span style="position:absolute;left:0;right:0;bottom:0;padding:22px 10px 9px;background:linear-gradient(180deg,rgba(20,14,2,0),rgba(20,14,2,.86));display:flex;align-items:flex-end;justify-content:space-between;gap:6px">
                  <span style="font-family:'Newsreader',serif;font-weight:600;font-size:23px;line-height:1;color:#ffd75e">${a.views}</span>
                  <span style="font-size:11px;font-weight:800;color:#f4e5c4;letter-spacing:.04em">OPENS</span>
                </span>
              </span>
              <span style="display:block;padding:10px 12px 4px;font-size:14.5px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">${a.loc}</span>
              <span style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 12px">
                <span style="font-family:'Newsreader',serif;font-weight:600;font-size:17px;color:#c85a1a">${a.priceFmt}</span>
                <span style="${a.dotStyle}" title="${a.chip}"></span>
              </span>
            </button>
          `).join('')}
        </div>
      </div>
      
  `;
}
