import { getProfile } from '../../../packages/auth/auth';
import { formatDateShort, formatINR } from '../../../packages/ui/utils';
import { adapter } from '../../../packages/data/adapter';
import { openPropertyDrawer } from '../../../packages/ui/property-detail';
import type { WantType } from '../../../packages/data/types';

const errorState = (msg: string): string =>
  `<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446;font-size:15px;line-height:1.5">${msg}</div>`;

const WANTS: WantType[] = ['Plot', 'Flat', 'Kothi', 'Villa', 'Commercial'];
const PIE_COLORS = ['#f4ae14', '#6b3fd4', '#1b7a46', '#fb923c', '#c2185b', '#1f6f6b', '#e6cf9a'];

export async function renderHome(container: HTMLElement) {
  const profile = getProfile();
  const firstName = (profile.name || profile.dealerName || '').split(' ')[0] || 'There';
  
  const h = new Date().getHours();
  let greeting = 'Good morning';
  if (h >= 12 && h < 17) greeting = 'Good afternoon';
  else if (h >= 17) greeting = 'Good evening';

  container.innerHTML = '<div role="status" aria-live="polite" style="max-width:1120px;margin:0 auto;padding:40px;color:#6b6156">Loading your presentation activity…</div>';
  // A hard timeout guarantees the page never hangs forever if a call stalls.
  const withTimeout = <T,>(p: Promise<T>): Promise<T> => Promise.race([
    p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
  ]);
  let signalsResult, linksResult, propertiesResult;
  try {
    [signalsResult, linksResult, propertiesResult] = await Promise.all([
      withTimeout(adapter.demandSignals.get()),
      withTimeout(adapter.clientLinks.list({ limit: 100 })),
      withTimeout(adapter.properties.list({ limit: 100 })),
    ]);
  } catch {
    container.innerHTML = errorState('We could not reach your dashboard. Check your connection and refresh.');
    return;
  }
  if (!signalsResult.ok || !linksResult.ok || !propertiesResult.ok) {
    const unauth = [signalsResult, linksResult, propertiesResult].some((r) => !r.ok && r.error.code === 'unauthorized');
    container.innerHTML = unauth
      ? errorState('Your session has expired. <a href="?signout" style="color:#5b32c4;font-weight:800">Sign in again</a>.')
      : errorState('Your dashboard activity could not be loaded. Please refresh.');
    return;
  }

  try {
  const signals = [...signalsResult.value].sort((a, b) => b.opens - a.opens);
  const links = linksResult.value.items;
  const properties = propertiesResult.value.items;
  const dOpens = signals.reduce((sum, signal) => sum + signal.opens, 0);
  const dLinkOpens = links.reduce((sum, link) => sum + link.events.opens, 0);
  const activeLinks = links.filter((link) => link.status === 'active').length;
  const hot = signals[0] ?? { city: 'No activity yet', opens: 0, color: PIE_COLORS[0]! };
  const hotStock = properties.filter((property) => property.city === hot.city && !property.sold).length;
  const pieTotal = Math.max(1, dOpens);
  const CIRC = 2 * Math.PI * 62;
  let cumulative = 0;
  const stats = {
    dOpens,
    dLinkOpens,
    dLinkSub: String(activeLinks),
    dHot: hot.city,
    dHotSub: `${hot.opens} opens · ${hotStock} plots you can show`,
    segs: signals.slice(0, 6).map((signal, index) => {
      const pct = signal.opens / pieTotal;
      const segment = { city: signal.city, pct: Math.round(pct * 100), color: PIE_COLORS[index]!, dash: pct * CIRC, offset: -cumulative * CIRC };
      cumulative += pct;
      return segment;
    }),
    wantBars: (() => {
      const rows = WANTS.map((want) => ({
        want,
        opens: properties.filter((property) => property.want === want).reduce((sum, property) => sum + property.views, 0),
        stock: properties.filter((property) => property.want === want && !property.sold).length,
      })).sort((a, b) => b.opens - a.opens);
      const max = Math.max(1, ...rows.map((row) => row.opens));
      return rows.map((row) => ({
        ...row,
        tag: row.opens === 0 ? 'never opened yet' : `${row.stock} in stock`,
        tagStyle: `font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap;${row.opens === 0 ? 'background:#f3eeff;color:#8a7a52' : 'background:#ded0fa;color:#5b32c4'}`,
        barStyle: `height:100%;width:${Math.max(6, Math.round(row.opens / max * 100))}%;border-radius:999px;background:${row.opens === 0 ? '#c4b183' : '#6b3fd4'};transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both`,
      }));
    })(),
    vsCols: (() => {
      const maxOpens = Math.max(1, ...signals.map((signal) => signal.opens));
      const maxStock = Math.max(1, ...signals.map((signal) => properties.filter((property) => property.city === signal.city && !property.sold).length));
      return signals.slice(0, 6).map((signal) => {
        const stock = properties.filter((property) => property.city === signal.city && !property.sold).length;
        const short = signal.opens / maxOpens > stock / maxStock;
        const bar = (height: number, background: string) => `width:30px;height:${height}px;border-radius:9px 9px 4px 4px;background:${background};display:flex;align-items:flex-start;justify-content:center;padding-top:4px;transform-origin:bottom;animation:barGrow .8s cubic-bezier(.2,.8,.2,1) both`;
        return {
          city: signal.city,
          opens: signal.opens,
          stock,
          barA: bar(Math.max(16, Math.round(signal.opens / maxOpens * 146)), 'linear-gradient(180deg,#8a63e8,#5b32c4)'),
          labA: 'font-size:12px;font-weight:800;color:#fff',
          barB: bar(Math.max(16, Math.round(stock / maxStock * 146)), 'linear-gradient(180deg,#ffdc7a,#f4ae14)'),
          labB: 'font-size:12px;font-weight:800;color:#241d0c',
          chip: short ? 'Source more' : 'Covered',
          chipStyle: `font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;${short ? 'background:#ffd3de;color:#c2185b' : 'background:#c9f0d9;color:#0b8f45'}`,
        };
      });
    })(),
    attentionRows: properties.filter((property) => !property.sold).sort((a, b) => b.views - a.views).slice(0, 5).map((property, index) => ({
      id: property.id,
      hot: index < 3 && property.views > 0,
      rank: `#${index + 1}`,
      rankStyle: 'position:absolute;top:8px;left:8px;display:grid;place-items:center;min-width:26px;height:26px;padding:0 7px;border-radius:9px;background:rgba(255,253,247,.94);color:#241d0c;font-size:12.5px;font-weight:800',
      cardStyle: 'min-width:0;background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:18px;overflow:hidden;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 32px -26px rgba(30,28,22,.7);transition:transform .14s',
      photoStyle: `display:block;position:relative;height:112px;background-image:url('${property.photos[0] ?? ''}');background-color:#efe8fb;background-size:cover;background-position:center`,
      loc: `${property.size} · ${property.loc.split(', ')[0]}`,
      priceFmt: formatINR(property.price),
      views: property.views,
      dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;background:${property.photos.length ? '#12a150' : '#c2185b'}`,
      chip: property.photos.length ? 'Ready' : 'Add photo',
    }))
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
            <a href="/app/plotmap/index.html" style="display:flex;align-items:center;gap:11px;height:62px;padding:0 26px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)" onmouseover="this.style.background='#f4ae14'" onmouseout="this.style.background='#ffc93c'"><i class="ph-fill ph-projector-screen-chart" style="font-size:22px"></i>Show the map</a>
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
                  <div style="font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1;color:#241f1c">${stats.segs[0]?.pct ?? 0}%</div>
                  <div style="font-size:11.5px;font-weight:800;color:#8a6a14;text-align:center;max-width:96px;line-height:1.25;margin-top:3px">${stats.segs[0]?.city ?? 'No activity yet'}</div>
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
            <p style="margin:6px 0 0;font-size:17.5px;color:#6b5a34">${stats.dHot} is your most looked-at area with ${hot.opens} opens, and you have ${hotStock} plots ready. Lead with these.</p>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin:30px 0 14px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s">
          <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a8070">Plots pulling the most attention</div>
          <span style="font-size:12.5px;font-weight:800;color:#8a6a14;background:#fff3d1;border-radius:999px;padding:5px 13px">From your presentations</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.14s">
          ${stats.attentionRows.map((a: any) => `
            <button class="pm-hover-card${a.hot ? ' pm-hot-glow' : ''}" data-prop-id="${a.id}" style="${a.cardStyle}" >
              <span style="${a.photoStyle}">
                ${a.hot ? '<span style="position:absolute;top:8px;right:8px;z-index:2;display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;background:#f4ae14;color:#241d0c;font-size:11px;font-weight:800"><i class="ph-fill ph-fire" style="font-size:12px"></i>HOT</span>' : ''}
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
    // Clicking a hot/attention plot opens the SAME full detail as Client
    // Presentation, but internal (price + Edit). No page redirect.
    container.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-prop-id]');
      if (!card) return;
      const prop = properties.find((p) => p.id === card.dataset.propId);
      if (prop) openPropertyDrawer(prop, {
        onEdit: () => window.location.assign('/admin/properties.html'),
        onSendLink: () => window.location.assign('/admin/owner.html#links'),
      });
    });
  } catch {
    container.innerHTML = errorState('Something went wrong showing your dashboard. Please refresh.');
  }
}

