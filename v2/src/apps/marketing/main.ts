/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Marketing
   Source: design-latest/MAPCO Marketing.dc.html

   The daily post desk. MAPCO prepares a creative per property; the
   dealer either sends it or skips it for the day. Price is a per-post
   dealer choice ("Price on request" vs the real figure).

   Real properties come from DataAdapterV2. Post state is per-session
   until the marketing backend is wired — nothing here fabricates
   reach, impressions or engagement.
   ═══════════════════════════════════════════════════════════════ */
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { adapter } from '../../packages/data/adapter';
import { getProfile, getInitials } from '../../packages/auth/auth';
import type { Property } from '../../packages/data/types';
import { listAllRecords } from '../../packages/data/list-all';
import { productRoutes } from '../../packages/ui/product-routes';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

const inr = (value: number): string => {
  const v = Math.round(value);
  if (v >= 1e7) return '₹' + (+(v / 1e7).toFixed(2)) + ' Cr';
  if (v >= 1e5) return '₹' + (+(v / 1e5).toFixed(2)) + ' L';
  return '₹' + v.toLocaleString('en-IN');
};

const TONES = [
  { bg: 'linear-gradient(150deg,#ffe08a,#ffc93c)', ink: '#5a4207', chip: 'rgba(90,66,7,.13)' },
  { bg: 'linear-gradient(150deg,#a8f0dc,#16c2a3)', ink: '#0a5545', chip: 'rgba(10,85,69,.14)' },
  { bg: 'linear-gradient(150deg,#e2d2ff,#b48cff)', ink: '#412a70', chip: 'rgba(65,42,112,.14)' },
  { bg: 'linear-gradient(150deg,#ffd0de,#ff8fb1)', ink: '#7a2444', chip: 'rgba(122,36,68,.14)' },
];

const CH = {
  ig: { name: 'Instagram', icon: 'ph-fill ph-instagram-logo', c: '#d6317f', soft: '#ffe9f3' },
  gbp: { name: 'Google', icon: 'ph-fill ph-storefront', c: '#2b6fd6', soft: '#e7f0ff' },
  wa: { name: 'WhatsApp', icon: 'ph-fill ph-whatsapp-logo', c: '#0f9c73', soft: '#e3f8f0' },
} as const;

type Status = 'ready' | 'posted' | 'skipped';
interface Post { property: Property; status: Status; priceHeld: boolean; art: string | null }

type Section = 'today' | 'library' | 'performance';

const state = {
  section: 'today' as Section,
  idx: 0,
  toast: '',
  posts: [] as Post[],
};

let toastTimer = 0;
const say = (message: string): void => {
  window.clearTimeout(toastTimer);
  state.toast = message;
  render();
  toastTimer = window.setTimeout(() => { state.toast = ''; render(); }, 2400);
};

function loadIcons(): void {
  ['regular', 'fill', 'bold'].forEach((weight) => {
    const href = `/assets/phosphor/${weight}/style.css`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  });
}

const NAV = [
  { label: 'Home', icon: 'ph-house', href: productRoutes.home },
  { label: 'Properties', icon: 'ph-buildings', href: productRoutes.properties() },
  { label: 'Deals', icon: 'ph-handshake', href: productRoutes.deals() },
  { label: 'Customers', icon: 'ph-users-three', href: productRoutes.customers() },
];

function sidebar(): string {
  const profile = getProfile();
  const name = profile?.name || 'Dealer';
  const business = profile?.dealerName || 'MAPCO';
  return `
  <aside style="width:258px;flex:none;height:100%;overflow:hidden;background:rgba(255,255,255,.82);backdrop-filter:blur(18px);border-right:1px solid rgba(255,255,255,.7);display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:11px;padding:22px 20px 16px">
      <img src="/assets/mapco-logo.png" alt="MAPCO" style="width:44px;height:auto;display:block">
      <div style="font-weight:800;font-size:24px;letter-spacing:-.01em;color:#241f1c">MAPCO</div>
    </div>
    <nav style="flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;padding:6px 14px 8px">
      ${NAV.map((n) => `<a href="${esc(n.href)}" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;color:#4c4437;text-decoration:none" onmouseover="this.style.background='#fff0cc';this.style.color='#1f1a12'" onmouseout="this.style.background='transparent';this.style.color='#4c4437'"><i class="ph ${n.icon}" style="font-size:23px;width:26px;text-align:center"></i><span style="font-size:16.5px;font-weight:700">${n.label}</span></a>`).join('')}
      <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:#ffc93c;color:#1f1a12;box-shadow:0 10px 22px -14px rgba(190,140,20,.95)">
        <i class="ph-fill ph-megaphone-simple" style="font-size:23px;width:26px;text-align:center"></i>
        <span style="font-size:16.5px;font-weight:800;flex:1">Marketing</span>
        <span style="width:9px;height:9px;border-radius:50%;background:#16c2a3;box-shadow:0 0 0 3px rgba(22,194,163,.28)"></span>
      </div>
    </nav>
    <div style="padding:14px 14px 18px;border-top:1px solid #f2e6cd">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:#fff8ea">
        <div style="width:40px;height:40px;border-radius:12px;background:#241d0c;color:#ffc93c;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none">${esc(getInitials(name || business))}</div>
        <div style="min-width:0"><div style="font-size:15px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div><div style="font-size:12.5px;color:#8a8070">${esc(business)}</div></div>
      </div>
    </div>
  </aside>`;
}

function tabsBar(): string {
  const ready = state.posts.filter((p) => p.status === 'ready').length;
  const TABS: { key: Section; label: string; icon: string; count: string }[] = [
    { key: 'today', label: 'Today', icon: 'ph-sun-horizon', count: ready ? String(ready) : '' },
    { key: 'library', label: 'Library', icon: 'ph-images-square', count: '' },
    { key: 'performance', label: 'Performance', icon: 'ph-chart-line-up', count: '' },
  ];
  return `<div style="flex:none;padding:11px 32px 9px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    ${TABS.map((t) => {
      const on = state.section === t.key;
      const style = `display:flex;align-items:center;gap:8px;padding:9px 15px;border-radius:13px;font-size:15.5px;font-weight:800;transition:transform .15s,box-shadow .15s;${on ? 'background:linear-gradient(135deg,#ffd45c,#ffb52e);color:#241f1c;box-shadow:0 12px 24px -14px rgba(190,140,20,.95)' : 'background:rgba(255,255,255,.72);color:#6b6157;box-shadow:0 8px 20px -18px rgba(120,90,20,.6)'}`;
      const countStyle = `min-width:22px;height:22px;padding:0 7px;border-radius:8px;background:${on ? 'rgba(36,29,12,.18)' : '#ffe6ae'};color:#3a2f16;font-size:13px;font-weight:800;display:grid;place-items:center`;
      return `<button data-act="tab" data-tab="${t.key}" style="${style}"><i class="${on ? 'ph-fill ' : 'ph '}${t.icon}" style="font-size:19px"></i><span>${t.label}</span>${t.count ? `<span style="${countStyle}">${t.count}</span>` : ''}</button>`;
    }).join('')}
  </div>`;
}

const propertyTitle = (p: Property): string => `${p.area || p.type} · ${p.size}`;
const propertySub = (p: Property): string =>
  [p.city, p.size, p.position].filter(Boolean).join(' · ');

function todayView(): string {
  if (!state.posts.length) {
    return `<div style="flex:1;display:grid;place-items:center;padding:40px"><div style="max-width:480px;text-align:center;padding:40px;border-radius:26px;background:rgba(255,255,255,.9)">
      <i class="ph-fill ph-megaphone-simple" style="font-size:44px;color:#c9a24a"></i>
      <div style="margin-top:14px;font-family:'Newsreader',serif;font-size:28px;color:#241f1c">Nothing to post yet</div>
      <p style="margin:10px 0 0;font-size:16px;color:#6b6156">Add a property and publish it — MAPCO prepares a post for each one.</p>
      <a href="${esc(productRoutes.properties())}" style="display:inline-block;margin-top:18px;padding:13px 22px;border-radius:14px;background:#ffc93c;color:#241d0c;font-weight:800;text-decoration:none">Go to Properties</a>
    </div></div>`;
  }

  const post = state.posts[state.idx]!;
  const property = post.property;
  const tone = TONES[state.idx % TONES.length]!;
  const isPosted = post.status === 'posted';
  const isSkipped = post.status === 'skipped';
  const ready = state.posts.filter((p) => p.status === 'ready').length;
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const thumbs = state.posts.map((p, i) => {
    const on = i === state.idx;
    const c = p.status === 'posted' ? '#0f9c73' : (p.status === 'skipped' ? '#b3a999' : 'rgba(0,0,0,.28)');
    return `<button data-act="goto" data-i="${i}" style="width:${on ? '40px' : '14px'};height:14px;border-radius:99px;transition:width .22s;display:grid;place-items:center;background:${on ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.55)'}"><span style="width:${on ? '9px' : '7px'};height:${on ? '9px' : '7px'};border-radius:50%;background:${p.status === 'ready' ? (on ? tone.ink : 'rgba(0,0,0,.28)') : c}"></span></button>`;
  }).join('');

  const channels = (['ig', 'gbp', 'wa'] as const).map((k) => {
    const c = CH[k];
    return `<div style="display:flex;align-items:center;gap:6px;padding:8px 11px;border-radius:12px;background:${c.soft};color:${c.c}"><i class="${c.icon}" style="font-size:18px"></i><span style="font-size:14px;font-weight:800">${c.name}</span></div>`;
  }).join('');

  const photo = property.photos?.[0] ?? '';
  const priceShown = post.priceHeld ? 'Price on request' : inr(property.price);

  return `<div style="flex:1;min-height:0;display:flex;gap:22px;padding:2px 32px 20px 0;align-items:stretch;overflow:hidden">

    <div style="flex:1 1 66%;min-width:340px;min-height:0;border-radius:0 36px 36px 0;padding:10px 12px 8px 14px;display:flex;flex-direction:column;gap:6px;background:${tone.bg};box-shadow:0 34px 70px -34px rgba(70,40,110,.72);transition:background .35s">
      <div style="flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span style="display:inline-flex;align-items:center;gap:9px;padding:10px 15px;border-radius:13px;background:rgba(255,255,255,.75);color:${tone.ink};font-size:15.5px;font-weight:800"><i class="ph-fill ph-sun-horizon" style="font-size:18px"></i>${esc(dateStr)}</span>
        <span style="display:inline-flex;align-items:center;padding:10px 15px;border-radius:13px;background:${tone.chip};color:${tone.ink};font-size:15.5px;font-weight:800">${state.idx + 1} of ${state.posts.length}</span>
      </div>

      <div style="flex:1;min-height:0;position:relative;display:grid;place-items:center;padding:4px 0 2px;perspective:1400px">
        <div style="position:relative;height:100%;width:100%;max-width:100%;max-height:100%;border-radius:20px;overflow:hidden;background:#fffdf8;color:#8a8070;transform:perspective(1600px) rotateX(1.4deg);transform-style:preserve-3d;border:1px solid rgba(255,255,255,.85);box-shadow:0 2px 0 rgba(255,255,255,.9) inset,0 -18px 30px -26px rgba(90,60,10,.5) inset,0 42px 70px -26px rgba(90,60,20,.55),0 90px 90px -60px rgba(60,35,90,.45);animation:omStage .32s cubic-bezier(.2,.8,.2,1) both">
          <div data-act="drop" data-drop style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;cursor:pointer;${post.art ? `background-image:url('${esc(post.art)}');background-size:cover;background-position:center` : ''}">
            ${post.art ? '' : `<div><i class="ph ph-image" style="font-size:34px;color:#c4b9a4"></i><div style="margin-top:10px;font-size:16px;font-weight:700;color:#8a8070">Drop your finished post here</div><div style="margin-top:4px;font-size:14px;color:#a89e8b;text-decoration:underline">or browse files</div></div>`}
          </div>
          ${isPosted ? `<span style="position:absolute;top:16px;left:16px;z-index:3;display:inline-flex;align-items:center;gap:8px;padding:11px 17px;border-radius:13px;background:#0f9c73;color:#fff;font-size:17px;font-weight:800;transform:rotate(-8deg);animation:omStamp .4s cubic-bezier(.2,.8,.2,1) both;box-shadow:0 12px 26px -12px rgba(15,156,115,.9)"><i class="ph-fill ph-check-circle" style="font-size:21px"></i>Posted</span>` : ''}
          ${isSkipped ? `<span style="position:absolute;inset:0;z-index:3;background:rgba(36,31,28,.58);display:grid;place-items:center;color:#fff;font-size:20px;font-weight:800">Not today</span>` : ''}
        </div>
        <button data-act="prev" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.9);color:${tone.ink};display:grid;place-items:center;transition:transform .15s;box-shadow:0 10px 22px -12px rgba(0,0,0,.35);z-index:4"><i class="ph-bold ph-caret-left" style="font-size:22px"></i></button>
        <button data-act="next" style="position:absolute;right:0;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.9);color:${tone.ink};display:grid;place-items:center;transition:transform .15s;box-shadow:0 10px 22px -12px rgba(0,0,0,.35);z-index:4"><i class="ph-bold ph-caret-right" style="font-size:22px"></i></button>
      </div>

      <div style="flex:none;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;min-width:0;padding:2px 4px">
        <button data-act="skip" style="display:flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;height:46px;padding:0 18px;border-radius:99px;background:#fff;color:#c9436b;transition:transform .15s;box-shadow:0 10px 22px -14px rgba(0,0,0,.4)"><i class="ph-bold ph-x" style="font-size:20px"></i><span style="font-size:15.5px;font-weight:800;white-space:nowrap">Not today</span></button>
        <div style="display:flex;align-items:center;gap:8px;flex:none">${thumbs}</div>
        <button data-act="post" style="display:flex;align-items:center;gap:9px;flex:0 1 auto;min-width:0;height:52px;padding:0 24px;border-radius:99px;background:${isPosted ? '#0b7d5c' : '#0f9c73'};color:#fff;transition:transform .15s;box-shadow:0 14px 28px -14px rgba(11,125,92,.9)"><i class="${isPosted ? 'ph-bold ph-arrows-clockwise' : 'ph-bold ph-check'}" style="font-size:21px"></i><span style="font-size:16.5px;font-weight:800;white-space:nowrap">${isPosted ? 'Post again' : 'Post it'}</span></button>
      </div>
    </div>

    <div style="flex:0 1 clamp(280px,31%,470px);min-width:280px;display:flex;flex-direction:column;justify-content:center;gap:14px;overflow:hidden">
      <div style="flex:none;border-radius:26px;background:rgba(255,255,255,.9);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.9);padding:18px;box-shadow:0 28px 56px -30px rgba(80,50,120,.55)">
        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          <div style="width:74px;height:74px;flex:none;border-radius:19px;${photo ? `background-image:url('${esc(photo)}');background-size:cover;background-position:center;` : ''}background-color:#efe6d6;box-shadow:0 12px 26px -14px rgba(80,50,120,.6)"></div>
          <div style="min-width:0;flex:1">
            <div style="font-size:21px;font-weight:800;color:#241f1c;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(propertyTitle(property))}</div>
            <div style="font-size:15px;color:#7c705d;margin-top:2px">${esc(propertySub(property))}</div>
          </div>
        </div>
        <button data-act="price" style="width:100%;margin-top:14px;display:flex;align-items:center;gap:11px;padding:12px 13px;border-radius:16px;background:#fdf7ff;border:2px solid #efe4fb;transition:border-color .15s" onmouseover="this.style.borderColor='#8c4af2'" onmouseout="this.style.borderColor='#efe4fb'">
          <span style="width:42px;height:42px;flex:none;border-radius:13px;display:grid;place-items:center;${post.priceHeld ? 'background:#fff3d6;color:#8a6d24' : 'background:#e6f9f2;color:#0c7a5a'}"><i class="${post.priceHeld ? 'ph-fill ph-lock-simple' : 'ph-fill ph-tag'}" style="font-size:19px"></i></span>
          <span style="flex:1;text-align:left"><span style="display:block;font-size:17.5px;font-weight:800;color:#241f1c">${esc(priceShown)}</span><span style="display:block;font-size:13.5px;color:#8a8070">${post.priceHeld ? 'Tap to show the price instead' : 'Tap to hide the price'}</span></span>
          <i class="ph-bold ph-arrows-left-right" style="font-size:16px;color:#a49a8a"></i>
        </button>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3ecdf;display:flex;flex-direction:column;gap:9px">
          <span style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a08c5c">Goes to</span>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${channels}</div>
        </div>
      </div>
      <button data-act="post-all" style="display:flex;align-items:center;justify-content:center;gap:11px;width:100%;height:64px;border-radius:22px;background:#241d0c;color:#ffdd85;font-size:18px;font-weight:800;transition:transform .15s;box-shadow:0 26px 50px -26px rgba(36,29,12,.95)"><i class="ph-fill ph-check-circle" style="font-size:24px"></i>${ready ? `Post all ${ready} at once` : 'Everything is handled'}</button>
    </div>
  </div>`;
}

function libraryView(): string {
  const made = state.posts;
  return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:6px 32px 40px">
    <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">Everything MAPCO made for you</h1>
    <p style="margin:8px 0 0;font-size:18px;color:#5f5648">Every post prepared from your published stock.</p>
    ${made.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:20px;margin-top:24px">
      ${made.map((p, i) => {
        const tone = TONES[i % TONES.length]!;
        const posted = p.status === 'posted';
        return `<div style="border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 22px 44px -28px rgba(120,90,20,.6)">
          <div style="position:relative;height:230px;background:${tone.bg};color:${tone.ink};display:grid;place-items:center">
            ${p.property.photos?.[0] ? `<img src="${esc(p.property.photos[0]!)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '<i class="ph ph-image" style="font-size:34px;opacity:.5"></i>'}
          </div>
          <div style="padding:16px 18px 18px">
            <div style="font-size:17px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(propertyTitle(p.property))}</div>
            <div style="margin-top:10px;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:10px;font-size:14.5px;font-weight:800;${posted ? 'background:#e6f9f2;color:#0c7a5a' : 'background:#fff3d6;color:#8a6d24'}"><i class="${posted ? 'ph-fill ph-check-circle' : 'ph-fill ph-clock'}" style="font-size:16px"></i>${posted ? 'Posted' : 'Not posted yet'}</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : `<div style="margin-top:24px;padding:40px;text-align:center;border-radius:22px;background:rgba(255,255,255,.85);color:#6b6156;font-size:15px">Nothing prepared yet.</div>`}
  </div>`;
}

function performanceView(): string {
  const posted = state.posts.filter((p) => p.status === 'posted').length;
  const skipped = state.posts.filter((p) => p.status === 'skipped').length;
  const ready = state.posts.filter((p) => p.status === 'ready').length;
  const tile = (value: string | number, label: string, sub: string, icon: string, bg: string, ink: string): string =>
    `<div style="border-radius:26px;padding:24px 26px 26px;background:${bg};box-shadow:0 22px 44px -28px rgba(120,90,20,.6)">
      <div style="width:52px;height:52px;border-radius:17px;background:rgba(255,255,255,.75);color:${ink};display:grid;place-items:center"><i class="${icon}" style="font-size:26px"></i></div>
      <div style="margin-top:16px;font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#241f1c">${esc(value)}</div>
      <div style="margin-top:6px;font-size:16px;font-weight:800;color:#241f1c">${esc(label)}</div>
      <div style="margin-top:4px;font-size:14px;color:${ink}">${esc(sub)}</div>
    </div>`;
  return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:6px 32px 40px">
    <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">How your posting is going</h1>
    <p style="margin:8px 0 0;font-size:18px;color:#5f5648">Counted from what you actually sent. Reach and enquiry numbers arrive when the channels are connected.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:24px">
      ${tile(posted, posted === 1 ? 'post went out' : 'posts went out', 'Sent from this desk.', 'ph-fill ph-paper-plane-right', 'linear-gradient(150deg,#ffe9a8,#ffc93c)', '#5a4207')}
      ${tile(ready, 'still waiting', 'Ready for you to send.', 'ph-fill ph-clock', 'linear-gradient(150deg,#d8e4ff,#9db6ff)', '#22406f')}
      ${tile(skipped, 'skipped', 'MAPCO will bring something else.', 'ph-fill ph-arrow-u-up-right', 'linear-gradient(150deg,#a8f0dc,#16c2a3)', '#0a5545')}
    </div>
    <div style="margin-top:22px;padding:22px 24px;border-radius:22px;background:rgba(255,255,255,.86);color:#6b6156;font-size:15px;line-height:1.55">
      Instagram, Google and WhatsApp reach is not connected yet, so nothing here estimates audience numbers.
    </div>
  </div>`;
}

function render(): void {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = `
  <style>
    @keyframes omStage{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
    @keyframes omStamp{0%{opacity:0;transform:scale(1.4) rotate(-8deg)}60%{opacity:1;transform:scale(.96) rotate(-8deg)}100%{opacity:1;transform:scale(1) rotate(-8deg)}}
    body{background:#fff2dd;background-image:radial-gradient(58% 46% at 0% -4%,rgba(255,193,26,.92),transparent 60%),radial-gradient(50% 46% at 102% 0%,rgba(140,74,242,.62),transparent 62%),radial-gradient(54% 48% at 92% 102%,rgba(0,200,166,.6),transparent 64%),radial-gradient(48% 42% at 12% 106%,rgba(255,110,158,.58),transparent 64%),radial-gradient(38% 34% at 48% 52%,rgba(255,255,255,.72),transparent 70%);background-attachment:fixed}
  </style>
  <div style="display:flex;height:100vh;min-height:0;width:100%;overflow:hidden">
    ${sidebar()}
    <main style="flex:1;min-width:0;height:100%;display:flex;flex-direction:column;overflow:hidden">
      ${tabsBar()}
      ${state.section === 'today' ? todayView() : state.section === 'library' ? libraryView() : performanceView()}
    </main>
  </div>
  ${state.toast ? `<div role="status" style="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:80;padding:13px 20px;border-radius:14px;background:#241d0c;color:#ffdd85;font-size:15px;font-weight:800;box-shadow:0 24px 48px -22px rgba(0,0,0,.7)">${esc(state.toast)}</div>` : ''}`;
}

function move(delta: number): void {
  if (!state.posts.length) return;
  state.idx = (state.idx + delta + state.posts.length) % state.posts.length;
  render();
}

function setStatus(status: Status, message: string): void {
  const post = state.posts[state.idx];
  if (!post) return;
  post.status = status;
  say(message);
  const next = state.posts.findIndex((p, i) => i > state.idx && p.status === 'ready');
  if (next > -1) { state.idx = next; render(); }
}

function wire(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    switch (target.dataset.act) {
      case 'tab': state.section = (target.dataset.tab as Section) || 'today'; render(); break;
      case 'prev': move(-1); break;
      case 'next': move(1); break;
      case 'goto': state.idx = Number(target.dataset.i) || 0; render(); break;
      case 'price': {
        const post = state.posts[state.idx];
        if (post) { post.priceHeld = !post.priceHeld; render(); }
        break;
      }
      case 'post': setStatus('posted', 'Posted. That plot is out there now.'); break;
      case 'skip': setStatus('skipped', 'Skipped. MAPCO will bring something else.'); break;
      case 'post-all': {
        const count = state.posts.filter((p) => p.status === 'ready').length;
        if (!count) { say('Everything for today is already handled.'); break; }
        for (const post of state.posts) if (post.status === 'ready') post.status = 'posted';
        say(`All ${count} posted.`);
        break;
      }
      case 'drop': pickArtwork(); break;
    }
  });

  window.addEventListener('keydown', (event) => {
    if (state.section !== 'today') return;
    if (event.key === 'ArrowRight') move(1);
    if (event.key === 'ArrowLeft') move(-1);
  });

  // Drag-and-drop the finished creative onto the frame.
  root.addEventListener('dragover', (event) => {
    if ((event.target as HTMLElement).closest('[data-drop]')) event.preventDefault();
  });
  root.addEventListener('drop', (event) => {
    const zone = (event.target as HTMLElement).closest('[data-drop]');
    if (!zone) return;
    event.preventDefault();
    const file = (event as DragEvent).dataTransfer?.files?.[0];
    if (file) attachArtwork(file);
  });
}

function attachArtwork(file: File): void {
  const post = state.posts[state.idx];
  if (!post || !file.type.startsWith('image/')) { say('That file is not an image.'); return; }
  const reader = new FileReader();
  reader.onload = () => { post.art = String(reader.result); render(); };
  reader.readAsDataURL(file);
}

function pickArtwork(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) attachArtwork(file);
  });
  input.click();
}

async function boot(): Promise<void> {
  loadIcons();
  const root = document.getElementById('app');
  if (!root) return;
  render();
  try {
    const result = await listAllRecords((params, opts) => adapter.properties.list(params, opts));
    if (result.ok) {
      state.posts = result.value
        .filter((property) => property.published && !property.sold)
        .slice(0, 4)
        .map((property) => ({ property, status: 'ready' as Status, priceHeld: true, art: null }));
    }
  } catch { /* the empty state explains itself */ }
  render();
  wire(root);
}

void boot();
