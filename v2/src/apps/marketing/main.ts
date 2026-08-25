// @ts-nocheck
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { requireSession } from '../../packages/data/session';
import { loadDealerMarketingFeed } from '../../packages/marketing/dealer-feed';
import { renderApp, globalHead } from './template';

const state: any = {
  feed: null,
  section: 'today',
  activePost: 'a',
  status: {},
  sel: {},
  times: {},
  timeOpen: false,
  phase: 'ready',
  pubPost: null,
  chStep: 0,
  postedChans: {},
  picker: false,
  libProp: 'all',
  libKind: 'all',
  toast: '',
  reels: [
    { id: 'r1', pi: 0, prod: 'ready', dur: '0:28', sub: 'Edited by MAPCO · delivered Tuesday' },
    { id: 'r2', pi: 1, prod: 'ready', dur: '0:34', sub: 'Edited by MAPCO · delivered Monday' },
    { id: 'r3', pi: 2, prod: 'editing', dur: '', sub: 'Submitted yesterday' }
  ],
  reelIdx: 0,
  playing: false,
  used: 3,
  uploadOpen: false,
  upStep: 1,
  upPi: null,
  upFile: '',
  upNote: '',
  loading: true
};

const CH: any = {
  ig: { name: 'Instagram', icon: 'ph-fill ph-instagram-logo', c: '#E1306C' },
  fb: { name: 'Facebook', icon: 'ph-fill ph-facebook-logo', c: '#1877F2' },
  gbp: { name: 'Google', icon: 'ph-fill ph-google-logo', c: '#EA4335' },
  wa: { name: 'WhatsApp', icon: 'ph-fill ph-whatsapp-logo', c: '#25D366' }
};

const PROPS = [
  { code: 'S88214', title: 'Sector 88 · Plot 214', sub: 'Mohali · 250 sq yd', photo: '/assets/mkt-prop-3.webp' },
  { code: 'AER908', title: 'Aerocity · Plot 908', sub: '300 sq yd · corner', photo: '/assets/mkt-prop-2.jpg' },
  { code: 'S7861', title: 'Sector 78 · Plot 61', sub: 'Mohali · 150 sq yd', photo: '/assets/mkt-prop-4.jpg' },
  { code: 'S89142', title: 'Sector 89 · Plot 142', sub: 'Mohali · 200 sq yd', photo: '/assets/mkt-prop-4.jpg' },
  { code: 'NC12', title: 'New Chandigarh · Villa 12', sub: '500 sq yd villa plot', photo: '/assets/mkt-prop-1.jpg' },
  { code: 'AER77', title: 'Aerocity · Plot 77', sub: '240 sq yd', photo: '/assets/mkt-prop-3.webp' }
];

const TODAY = [
  { id: 'a', num: '01', accent: '#7a2fe0', layout: 'split', propName: 'Plot 214',
    photo: '/assets/mkt-prop-3.webp', eyebrow: 'Premium Plot', line1: 'SECTOR 88', line2: 'PLOT 214',
    factA: '250 SQ YD · PARK FACING', factB: '30 FT ROAD · GMADA APPROVED', tagline: 'READY TO REGISTER',
    features: [{ icon: 'ph-fill ph-map-pin', label: 'Prime Location' }, { icon: 'ph-fill ph-road-horizon', label: 'Wide Roads' }, { icon: 'ph-fill ph-tree', label: 'Park Facing' }, { icon: 'ph-fill ph-seal-check', label: 'Clear Title' }] },
  { id: 'b', num: '02', accent: '#e0473a', layout: 'overlay', propName: 'Plot 908',
    photo: '/assets/mkt-prop-2.jpg', eyebrow: 'Premium Corner Plot', line1: 'AEROCITY', line2: 'PLOT 908',
    factA: '300 SQ YD · 40 FT ROAD', factB: 'NEAR AIRPORT ROAD', tagline: 'Limited Inventory',
    features: [{ icon: 'ph-fill ph-corners-out', label: 'Corner Plot' }, { icon: 'ph-fill ph-road-horizon', label: '40 ft Road' }, { icon: 'ph-fill ph-trend-up', label: 'High Demand' }, { icon: 'ph-fill ph-chart-line-up', label: 'Great Investment' }] }
];

const TIMES = ['Now', '8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM'];

let _t: any;
let _pt: any;
function say(t: string) { clearTimeout(_t); state.toast = t; render(); _t = setTimeout(() => { state.toast = ''; render(); }, 2600); }

function toggleChannel(pid: string, c: string) {
  const cur = state.sel[pid] || {};
  state.sel[pid] = { ...cur, [c]: !cur[c] };
  render();
}

function publishActive(cid: string, keys: string[], isReels: boolean) {
  if (state.phase !== 'ready') return;
  if ((state.status[cid] || 'ready') !== 'ready') { say(isReels ? 'This reel is already live.' : 'This post is already live.'); return; }
  const sel = state.sel[cid] || {};
  const chans = keys.filter(c => sel[c]);
  if (!chans.length) { say('Turn on at least one channel first.'); return; }
  state.phase = 'publishing'; state.pubPost = cid; state.chStep = 0; state.timeOpen = false;
  
  const tick = () => {
    state.chStep++;
    if (state.chStep >= chans.length) {
      state.phase = 'ready'; state.pubPost = null; state.status[cid] = 'posted'; state.postedChans[cid] = chans;
      say(isReels ? 'Done. Your reel is out.' : 'Done. This post is out.');
    } else _pt = setTimeout(tick, 600);
    render();
  };
  render();
  _pt = setTimeout(tick, 480);
}

function reachChartSvg() {
  const data = [210,240,190,260,300,280,340,320,380,360,300,410,430,390,460,440,510,480,540,520,590,560,620,600,660,640,700,680,740,760];
  const W = 580, H = 246, padX = 12, padTop = 34, padBot = 38, min = 150, max = 800;
  const x = (i: number) => padX + i * (W - 2 * padX) / (data.length - 1);
  const y = (v: number) => H - padBot - (v - min) / (max - min) * (H - padTop - padBot);
  let line = 'M' + x(0).toFixed(1) + ' ' + y(data[0]).toFixed(1);
  data.forEach((v, i) => { if (i) line += ' L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
  const area = line + ` L${x(data.length - 1).toFixed(1)} ${H - padBot} L${x(0).toFixed(1)} ${H - padBot} Z`;
  const grid = [0, 1, 2, 3].map(i => { const gy = (padTop + i * (H - padTop - padBot) / 3).toFixed(1); return `<line x1="${padX}" y1="${gy}" x2="${W - padX}" y2="${gy}" stroke="rgba(255,255,255,.09)" stroke-width="1"/>`; }).join('');
  const labelIdx = [0, 7, 14, 21, 29], labels = ['21 Jul', '28 Jul', '4 Aug', '11 Aug', '19 Aug'];
  const xlabels = labelIdx.map((li, k) => `<text x="${x(li).toFixed(1)}" y="${H - 14}" text-anchor="${k === 0 ? 'start' : (k === labelIdx.length - 1 ? 'end' : 'middle')}" font-family="Hanken Grotesk,sans-serif" font-size="11" font-weight="700" fill="rgba(255,255,255,.5)">${labels[k]}</text>`).join('');
  const ai = 16, ax = x(ai), ay = y(data[ai]);
  const anno = `<line x1="${ax.toFixed(1)}" y1="${(padTop + 2).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="rgba(255,203,69,.5)" stroke-width="1.3" stroke-dasharray="3 4"/>` +
    `<rect x="${(ax - 72).toFixed(1)}" y="${(padTop - 16).toFixed(1)}" width="144" height="20" rx="10" fill="rgba(255,203,69,.16)" stroke="rgba(255,203,69,.4)" stroke-width="1"/>` +
    `<text x="${ax.toFixed(1)}" y="${(padTop - 2).toFixed(1)}" text-anchor="middle" font-family="Hanken Grotesk,sans-serif" font-size="10.5" font-weight="800" fill="#ffe08a">6 Aug · reels launched</text>` +
    `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="4.5" fill="#ffcb45" stroke="#151020" stroke-width="2"/>`;
  const ex = x(data.length - 1), ey = y(data[data.length - 1]);
  const endLabel = `<text x="${(ex - 6).toFixed(1)}" y="${(ey - 12).toFixed(1)}" text-anchor="end" font-family="Newsreader,serif" font-size="17" font-weight="600" fill="#fff">760</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block"><defs>` +
    `<linearGradient id="rln" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd24d"/><stop offset=".5" stop-color="#ff9a4d"/><stop offset="1" stop-color="#ff6b5c"/></linearGradient>` +
    `<linearGradient id="rfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a4d" stop-opacity=".38"/><stop offset="1" stop-color="#ff6b5c" stop-opacity="0"/></linearGradient></defs>` +
    grid +
    `<path d="${area}" fill="url(#rfl)"/>` +
    `<path d="${line}" fill="none" stroke="url(#rln)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1100" style="animation:omDraw 1.3s cubic-bezier(.4,0,.2,1) both"/>` +
    anno + xlabels + endLabel +
    `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="6" fill="#ffd24d" stroke="#151020" stroke-width="2.5"/></svg>`;
}

function donutSvg() {
  const segs = [{ c: '#E1306C', v: 52 }, { c: '#1877F2', v: 31 }, { c: '#EA4335', v: 11 }, { c: '#25D366', v: 6 }];
  const R = 64, SW = 26, C = 84, circ = 2 * Math.PI * R, gap = 9; let off = 0;
  const rings = segs.map(s => { const len = circ * s.v / 100; const draw = Math.max(len - gap, 3); const el = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${s.c}" stroke-width="${SW}" stroke-dasharray="${draw.toFixed(1)} ${(circ - draw).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${C} ${C})" stroke-linecap="round"/>`; off += len; return el; }).join('');
  return `<svg viewBox="0 0 168 168" style="width:172px;height:172px;display:block">${rings}<text x="84" y="80" text-anchor="middle" font-family="Newsreader,serif" font-size="34" font-weight="500" fill="#1c1430">8.4k</text><text x="84" y="100" text-anchor="middle" font-family="Hanken Grotesk,sans-serif" font-size="10.5" font-weight="800" fill="#7a6a8e" letter-spacing="1">TOTAL REACH</text></svg>`;
}

function computeViewProps() {
  const s = state;
  const isReels = s.section === 'reels';
  const curId = s.section === 'reels' ? (s.reels[Math.min(s.reelIdx, s.reels.length - 1)]?.id || 'r1') : s.activePost;
  const keys = isReels ? ['ig', 'fb'] : ['ig', 'fb', 'gbp', 'wa'];
  const buildChannels = (id: string) => keys.map(k => {
    const c = CH[k]; const on = !!(s.sel[id] || {})[k];
    return { name: c.name, icon: c.icon, on, iconColor: on ? c.c : '#b7a58f',
      style: `position:relative;width:52px;height:52px;flex:none;border-radius:15px;display:grid;place-items:center;transition:all .15s;${on ? 'background:#fff;box-shadow:0 10px 20px -8px ' + c.c + 'aa' : 'background:rgba(255,255,255,.45);opacity:.6'}`,
      toggle: `__toggleChannel('${id}','${k}')`
    };
  });
  
  const at = TODAY.find(t => t.id === s.activePost) || TODAY[0];
  const curSt = s.status[curId] || 'ready', posted = curSt === 'posted', skipped = curSt === 'skipped';
  
  const shared = {
    channels: buildChannels(curId),
    skip: `__skip('${curId}', ${isReels})`,
    unskip: `__unskip('${curId}')`
  };
  
  const active = isReels ? shared : {
    wrapStyle: 'position:relative;height:100%;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;animation:omSlideX .3s cubic-bezier(.2,.8,.2,1) both',
    creativeStyle: 'position:relative;height:100%;width:auto;aspect-ratio:4/5;max-width:100%;container-type:inline-size;border-radius:22px;overflow:hidden;background:#14101f;transition:transform .22s,box-shadow .22s;box-shadow:0 44px 84px -34px rgba(40,15,70,.7)',
    split: at.layout === 'split', overlay: at.layout === 'overlay',
    photoStyle: at.layout === 'split'
      ? `position:absolute;left:0;right:0;top:0;height:50%;background-image:url("${at.photo}");background-size:cover;background-position:center`
      : `position:absolute;inset:0;background-image:url("${at.photo}");background-size:cover;background-position:center`,
    eyebrow: at.eyebrow, line1: at.line1, line2: at.line2, factA: at.factA, factB: at.factB, tagline: at.tagline, features: at.features,
    isPosted: posted, isSkipped: skipped, ...shared
  };

  const phase = s.phase;
  const barPublishing = phase === 'publishing' && s.pubPost === curId;
  const barPosted = posted && !barPublishing;
  const barReady = !barPublishing && !barPosted;
  
  const selChans = keys.filter(c => (s.sel[curId] || {})[c]);
  const chList = barPublishing ? (selChans) : selChans; // simplified
  const progressChannels = chList.map((k, i) => {
    const done = i < s.chStep, act = i === s.chStep;
    return { name: CH[k].name, icon: CH[k].icon, done, active: act, pending: !done && !act,
      textColor: done ? '#177a42' : (act ? '#1c1430' : '#b8a68e'),
      style: `display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:11px;background:${done ? 'rgba(34,197,94,.14)' : (act ? 'rgba(122,47,224,.12)' : 'rgba(122,47,224,.05)')};transition:background .3s`
    };
  });
  
  const postedChannels = (s.postedChans[curId] || selChans).map((k: string) => ({ name: CH[k].name, icon: CH[k].icon, color: CH[k].c }));
  
  const r = s.reels[Math.min(s.reelIdx, s.reels.length - 1)] || s.reels[0];
  const STAGE: any = { received: { label: 'Received', icon: 'ph-fill ph-tray-arrow-down', line: 'We have your video' }, editing: { label: 'In editing', icon: 'ph-fill ph-scissors', line: 'Your video is being edited' }, ready: { label: 'Ready', icon: 'ph-fill ph-check-circle', line: 'Your reel is ready' } };
  const p = PROPS[r.pi];
  const cst = STAGE[r.prod];
  
  const reelObj = {
    photoStyle: `position:absolute;inset:0;background-image:url("${p.photo}");background-size:cover;background-position:center;transition:transform .4s;transform:scale(${s.playing ? 1.05 : 1})`,
    isReady: r.prod === 'ready', showStatus: curSt !== 'posted' && curSt !== 'skipped',
    statusPill: `display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.94);color:#1c1430;font-size:11.5px;font-weight:800;letter-spacing:.06em`,
    eyebrow: '<i class="ph-fill ph-check-circle" style="color:#22c55e"></i>Ready',
    dur: r.dur, loc: p.title, title: p.sub, sub: r.sub,
    playIcon: s.playing ? 'ph-fill ph-pause' : 'ph-fill ph-play',
    playNudge: s.playing ? '0' : '4px',
    playStyle: 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.88);display:grid;place-items:center;z-index:4;transition:all .18s;box-shadow:0 14px 28px -14px rgba(0,0,0,.6)',
    togglePlay: '__togglePlay()',
    barStyle: `height:100%;background:#ffcb45;transition:width .2s;width:${s.playing ? '35%' : '0%'}`,
    isPending: r.prod !== 'ready',
    stageIcon: cst.icon, pendingLine: cst.line,
    isSkipped: curSt === 'skipped', isPosted: curSt === 'posted',
    steps: [
      { label: 'Received', icon: 'ph-bold ph-check', style: `display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:5px 9px;border-radius:8px;${r.prod === 'received' ? 'background:#1c1430;color:#ffcb45' : 'background:rgba(34,197,94,.16);color:#177a42'}` },
      { label: 'Editing', icon: r.prod === 'editing' ? 'ph-bold ph-spinner-gap' : 'ph-bold ph-check', style: `display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:5px 9px;border-radius:8px;${r.prod === 'editing' ? 'background:#1c1430;color:#ffcb45' : (r.prod === 'ready' ? 'background:rgba(34,197,94,.16);color:#177a42' : 'background:rgba(255,255,255,.5);color:#b8a68e')}` },
      { label: 'Ready', icon: r.prod === 'ready' ? 'ph-fill ph-check-circle' : 'ph-bold ph-clock', style: `display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:5px 9px;border-radius:8px;${r.prod === 'ready' ? 'background:rgba(34,197,94,.16);color:#177a42' : 'background:rgba(255,255,255,.5);color:#b8a68e'}` }
    ]
  };

  const GRAD = ['linear-gradient(155deg,#fff0c4,#ffd873)', 'linear-gradient(155deg,#dbfbe3,#8ce9a8)', 'linear-gradient(155deg,#ecdbff,#c6a3f5)', 'linear-gradient(155deg,#ffe3de,#ffb3a8)'];
  const BORD = ['rgba(230,150,0,.4)', 'rgba(30,158,69,.36)', 'rgba(122,47,224,.34)', 'rgba(224,71,58,.34)'];

  const props = {
    tabs: [
      { key: 'today', label: 'Today', icon: 'ph-sun-horizon' },
      { key: 'reels', label: 'Reels', icon: 'ph-film-reel' },
      { key: 'library', label: 'Library', icon: 'ph-cards-three' },
      { key: 'performance', label: 'Performance', icon: 'ph-chart-bar' }
    ].map(t => ({
      ...t,
      icon: (s.section === t.key ? 'ph-fill ' : 'ph ') + t.icon,
      style: `display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:13px;font-size:14.5px;font-weight:800;transition:all .16s;${s.section === t.key ? 'background:#1c1430;color:#ffcb45;box-shadow:0 10px 22px -12px rgba(28,20,48,.7)' : 'color:#5a3a1c;background:transparent'}`,
      go: `__nav('${t.key}')`
    })),
    navAccounts: [
      { icon: CH.ig.icon, color: '#fff', grad: 'linear-gradient(45deg,#f9ce34,#ee2a7b 45%,#6228d7)' },
      { icon: CH.fb.icon, color: '#1877F2' },
      { icon: CH.gbp.icon, color: '#EA4335' },
      { icon: CH.wa.icon, color: '#25D366' }
    ].map(a => ({
      ...a,
      style: `width:30px;height:30px;border-radius:9px;display:grid;place-items:center;${a.grad ? 'background:' + a.grad : 'background:#fff'};box-shadow:0 5px 12px -6px rgba(40,15,70,.5);border:1.5px solid rgba(255,255,255,.85)`
    })),
    contentStyle: s.section === 'today' || isReels ? 'flex:1;min-height:0;display:flex;flex-direction:column' : 'flex:1;min-height:0;display:flex;flex-direction:column',
    isToday: s.section === 'today',
    isReels: isReels,
    isLibrary: s.section === 'library',
    isPerf: s.section === 'performance',
    postTabs: TODAY.map(t => {
      const on = s.activePost === t.id;
      return {
        num: t.num, name: t.propName, live: s.status[t.id] === 'posted',
        dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;background:${t.accent};${on ? 'box-shadow:0 0 0 4px ' + t.accent + '44' : ''}`,
        style: `display:flex;align-items:center;gap:9px;padding:8px 14px;border-radius:14px;transition:all .16s;${on ? 'background:#fff;box-shadow:0 12px 26px -14px rgba(90,40,150,.55);border:1px solid rgba(122,47,224,.2)' : 'background:rgba(255,255,255,.4);border:1px solid transparent;opacity:.72'}`,
        go: `__switchPost('${t.id}')`
      };
    }),
    goPrev: '__cyclePost()', goNext: '__cyclePost()',
    active,
    timeOpen: s.timeOpen, timeOptions: TIMES.map(o => ({
      label: o,
      style: `flex:none;padding:9px 15px;border-radius:11px;font-size:13px;font-weight:800;transition:all .14s;${s.times[curId] === o ? 'background:#1c1430;color:#ffcb45' : 'background:rgba(255,255,255,.7);border:1px solid rgba(122,47,224,.16);color:#4a3d33'}`,
      pick: `__pickTime('${o}')`
    })),
    barReady,
    toggleTime: '__toggleTime()',
    timeChipStyle: 'display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:11px;background:rgba(255,255,255,.6);border:1px solid rgba(122,47,224,.18);box-shadow:0 4px 10px -4px rgba(40,15,70,.25);transition:all .12s',
    activeTime: s.times[curId] || 'Now',
    publishActive: `__publishActive('${curId}', ${isReels})`,
    publishBtnStyle: 'display:inline-flex;align-items:center;gap:8px;padding:11px 18px 11px 15px;border-radius:13px;background:linear-gradient(135deg,#e0473a,#bd291d);color:#fff;font-size:15px;font-weight:800;transition:transform .12s,box-shadow .12s;box-shadow:0 14px 28px -10px rgba(224,71,58,.5)',
    publishLabel: isReels ? 'Post Reel' : 'Publish',
    barPublishing, progressChannels, barPosted,
    postedLine: isReels ? 'Your reel is up on connected channels.' : 'Your post is out to connected channels.',
    postedChannels,
    reelTabs: s.reels.map((rt: any, i: number) => {
      const on = i === Math.min(s.reelIdx, s.reels.length - 1);
      return {
        stage: rt.prod === 'editing' ? 'Editing' : 'Reel', name: PROPS[rt.pi].propName || PROPS[rt.pi].title,
        dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;background:#7a2fe0;${on ? 'box-shadow:0 0 0 4px rgba(122,47,224,.28)' : ''}`,
        style: `display:flex;align-items:center;gap:9px;padding:8px 14px;border-radius:14px;transition:all .16s;${on ? 'background:#fff;box-shadow:0 12px 26px -14px rgba(90,40,150,.55);border:1px solid rgba(122,47,224,.2)' : 'background:rgba(255,255,255,.4);border:1px solid transparent;opacity:.72'}`,
        go: `__switchReel(${i})`
      };
    }),
    uploadBtnStyle: 'display:flex;align-items:center;gap:7px;padding:10px 16px;border-radius:12px;background:#1c1430;color:#ffcb45;font-size:13.5px;font-weight:800;box-shadow:0 12px 24px -12px rgba(28,20,48,.8);transition:transform .12s',
    reelPrev: '__cycleReel(-1)', reelNext: '__cycleReel(1)',
    reel: reelObj, reelPending: r.prod !== 'ready', reelPublishable: r.prod === 'ready',
    libWrapStyle: 'padding:14px 32px 46px;overflow-y:auto;flex:1',
    kindTabs: [{ k: 'all', l: 'All', i: 'ph-squares-four' }, { k: 'posts', l: 'Posts', i: 'ph-image' }, { k: 'reels', l: 'Reels', i: 'ph-film-reel' }].map(kt => ({
      label: kt.l, icon: (s.libKind === kt.k ? 'ph-fill ' : 'ph ') + kt.i,
      style: `display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;font-size:12.5px;font-weight:800;transition:all .12s;${s.libKind === kt.k ? 'background:#fff;color:#5a18c0;box-shadow:0 6px 14px -6px rgba(40,15,70,.4)' : 'color:#6a5b48;background:transparent'}`,
      go: `__setLibKind('${kt.k}')`
    })),
    libCount: '4 past creatives', activeFilter: s.libProp !== 'all',
    filterLabel: s.libProp !== 'all' ? (PROPS.find(p => p.code === s.libProp)?.title || 'Property') : '',
    clearFilter: "__setLibProp('all')", openLibFilter: "__openPicker()",
    libFilterBtnStyle: 'display:flex;align-items:center;gap:8px;padding:9px 15px;border-radius:12px;background:rgba(255,255,255,.6);border:1px solid rgba(122,47,224,.18);color:#1c1430;font-size:13.5px;font-weight:800;transition:all .16s;box-shadow:0 12px 24px -16px rgba(40,15,70,.4)',
    libGroups: [{
      wrapStyle: 'margin-top:28px', showHeader: true, label: 'THIS WEEK', date: '12 – 18 Aug', count: '4 items',
      hasReels: s.libKind === 'all' || s.libKind === 'reels', hasPosts: s.libKind === 'all' || s.libKind === 'posts',
      reels: [{
        mediaStyle: `position:absolute;inset:0;background-image:url("${PROPS[4].photo}");background-size:cover;background-position:center;transition:transform .4s;transform:scale(1)`,
        statusStyle: 'position:absolute;top:14px;left:14px;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;background:rgba(255,255,255,.94);color:#1c1430;font-size:11.5px;font-weight:800;letter-spacing:.06em;z-index:2',
        statusIcon: 'ph-fill ph-check-circle', statusLabel: 'Ready', chanIcon: CH.ig.icon, chanColor: CH.ig.c,
        play: '', loc: PROPS[4].title, title: PROPS[4].sub, dur: '0:42', when: 'Tue, 13 Aug', reuse: '',
        stats: [{ bg: '', bd: 'rgba(34,197,94,.3)', icon: 'ph-fill ph-eye', fg: '#16a34a', value: '4.2k', label: 'VIEWS' }, { bg: '', bd: 'rgba(122,47,224,.2)', icon: 'ph-fill ph-heart', fg: '#7a2fe0', value: '384', label: 'LIKES' }]
      }],
      posts: [TODAY[0], TODAY[1]].map((t, i) => ({
        cardStyle: 'border-radius:22px;background:rgba(255,255,255,.75);border:1px solid rgba(122,47,224,.14);box-shadow:0 24px 48px -36px rgba(40,15,70,.65);overflow:hidden',
        photoStyle: `height:240px;position:relative;background-image:url("${t.photo}");background-size:cover;background-position:center`,
        chipStyle: 'position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;background:#fff;display:grid;place-items:center;z-index:2;box-shadow:0 6px 14px -6px rgba(0,0,0,.4)',
        chanIcon: i === 0 ? CH.fb.icon : CH.ig.icon, chanColor: i === 0 ? CH.fb.c : CH.ig.c,
        statusStyle: 'position:absolute;top:14px;left:14px;display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;background:rgba(255,255,255,.94);color:#1c1430;font-size:11px;font-weight:800;letter-spacing:.06em;z-index:2',
        statusIcon: 'ph-fill ph-check-circle', statusLabel: 'Live', loc: t.line1, title: t.line2, when: i === 0 ? 'Wed, 14 Aug' : 'Mon, 12 Aug', reuse: '',
        stats: [{ bg: 'rgba(34,197,94,.12)', bd: 'rgba(34,197,94,.2)', icon: 'ph-fill ph-eye', fg: '#16a34a', value: i === 0 ? '1,204' : '3,450', label: 'REACH' }, { bg: 'rgba(122,47,224,.08)', bd: 'rgba(122,47,224,.15)', icon: 'ph-fill ph-heart', fg: '#7a2fe0', value: i === 0 ? '89' : '412', label: 'ENGAGED' }]
      }))
    }],
    kpis: [
      { cardStyle: `border-radius:24px;background:${GRAD[0]};border:1px solid ${BORD[0]};padding:22px 24px;box-shadow:0 24px 50px -34px rgba(230,150,0,.5)`, bg: 'rgba(255,255,255,.6)', fg: '#c8892a', icon: 'ph-fill ph-users', delta: '+12%', value: '8.4k', label: 'Accounts reached' },
      { cardStyle: `border-radius:24px;background:${GRAD[1]};border:1px solid ${BORD[1]};padding:22px 24px;box-shadow:0 24px 50px -34px rgba(30,158,69,.5)`, bg: 'rgba(255,255,255,.6)', fg: '#166534', icon: 'ph-fill ph-cursor-click', delta: '+4%', value: '1.2k', label: 'Content interactions' },
      { cardStyle: `border-radius:24px;background:${GRAD[2]};border:1px solid ${BORD[2]};padding:22px 24px;box-shadow:0 24px 50px -34px rgba(90,40,150,.5)`, bg: 'rgba(255,255,255,.6)', fg: '#5a18c0', icon: 'ph-fill ph-user-plus', delta: '+28%', value: '142', label: 'New followers' },
      { cardStyle: `border-radius:24px;background:${GRAD[3]};border:1px solid ${BORD[3]};padding:22px 24px;box-shadow:0 24px 50px -34px rgba(224,71,58,.5)`, bg: 'rgba(255,255,255,.6)', fg: '#c0402e', icon: 'ph-fill ph-link', delta: '+2%', value: '38', label: 'Link clicks' }
    ],
    reachChart: reachChartSvg(),
    donut: donutSvg(),
    perfChannels: [
      { name: 'Instagram', reach: '4,368', pct: '52%', color: '#E1306C' },
      { name: 'Facebook', reach: '2,604', pct: '31%', color: '#1877F2' },
      { name: 'Google', reach: '924', pct: '11%', color: '#EA4335' },
      { name: 'WhatsApp', reach: '504', pct: '6%', color: '#25D366' }
    ],
    topPropStyle: `height:210px;position:relative;background-image:url("${PROPS[0].photo}");background-size:cover;background-position:center`,
    topPropTitle: PROPS[0].title, topPropLine: 'The recent post for this property drove 40% of all link clicks last week.',
    engagement: [
      { bg: 'rgba(255,255,255,.6)', fg: '#166534', icon: 'ph-fill ph-heart', value: '890', label: 'Likes' },
      { bg: 'rgba(255,255,255,.6)', fg: '#166534', icon: 'ph-fill ph-chat-circle', value: '124', label: 'Comments' },
      { bg: 'rgba(255,255,255,.6)', fg: '#166534', icon: 'ph-fill ph-share-network', value: '145', label: 'Shares' },
      { bg: 'rgba(255,255,255,.6)', fg: '#166534', icon: 'ph-fill ph-bookmark-simple', value: '41', label: 'Saves' }
    ],
    followerTotal: '142 total',
    followerRows: [
      { icon: CH.ig.icon, color: CH.ig.c, name: 'Instagram', val: '+98', barStyle: 'width:69%;height:100%;border-radius:6px;background:' + CH.ig.c },
      { icon: CH.fb.icon, color: CH.fb.c, name: 'Facebook', val: '+44', barStyle: 'width:31%;height:100%;border-radius:6px;background:' + CH.fb.c }
    ],
    picker: s.picker,
    closePicker: "__closePicker()", stop: "event.stopPropagation()",
    pickerItems: [{ title: 'All properties', sub: 'Show everything', code: 'all', isAll: true, photoStyle: 'width:52px;height:52px;border-radius:13px;background:#1c1430;display:grid;place-items:center;flex:none' }].concat(
      PROPS.map(p => ({ title: p.title, sub: p.sub, code: p.code, isAll: false, photoStyle: `width:52px;height:52px;border-radius:13px;flex:none;background-image:url("${p.photo}");background-size:cover;background-position:center` }))
    ).map(pi => ({
      ...pi,
      current: s.libProp === pi.code,
      style: `display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;background:rgba(255,255,255,.65);border:1.5px solid ${s.libProp === pi.code ? '#7a2fe0' : 'rgba(122,47,224,.12)'};transition:all .15s;box-shadow:0 8px 16px -8px rgba(40,15,70,.15)`,
      choose: `__setLibProp('${pi.code}')`
    })),
    uploadOpen: s.uploadOpen, closeUpload: "__closeUpload()",
    stepLabel: 'Upload Reel', quotaLabel: `${s.used} of 4 this month`,
    stepTitle: s.upStep === 1 ? 'Which property is this for?' : 'Select your video',
    stepSub: s.upStep === 1 ? 'Your video should highlight one specific listing or project.' : 'Upload the raw or edited clip. Our team will review and finalize it for publishing.',
    dot1Style: `width:26px;height:4px;border-radius:2px;background:${s.upStep >= 1 ? '#7a2fe0' : 'rgba(122,47,224,.2)'}`,
    dot2Style: `width:26px;height:4px;border-radius:2px;background:${s.upStep >= 2 ? '#7a2fe0' : 'rgba(122,47,224,.2)'}`,
    isStep1: s.upStep === 1,
    upProps: PROPS.map((p, i) => {
      const on = s.upPi === i;
      return {
        title: p.title, sub: p.sub, on,
        photoStyle: `width:40px;height:40px;border-radius:10px;flex:none;background-image:url("${p.photo}");background-size:cover;background-position:center`,
        style: `display:flex;align-items:center;gap:10px;padding:9px;border-radius:14px;background:rgba(255,255,255,.7);border:1.5px solid ${on ? '#7a2fe0' : 'rgba(122,47,224,.1)'};transition:all .1s`,
        pick: `__setUpPi(${i})`
      };
    }),
    nextStep: '__setUpStep(2)', nextStyle: `display:inline-flex;align-items:center;gap:6px;margin-top:20px;padding:14px 20px;border-radius:14px;background:#1c1430;color:#ffcb45;font-size:15px;font-weight:800;transition:transform .12s;${s.upPi === null ? 'opacity:.4;pointer-events:none' : ''}`,
    isStep2: s.upStep === 2,
    chosenPhotoStyle: `width:46px;height:46px;border-radius:10px;flex:none;background-image:url("${PROPS[s.upPi || 0].photo}");background-size:cover;background-position:center`,
    chosenTitle: PROPS[s.upPi || 0].title,
    backStep: '__setUpStep(1)', chooseFile: "__chooseFile()",
    fileBtnStyle: `display:flex;align-items:center;gap:12px;width:100%;margin-top:16px;padding:14px;border-radius:16px;background:rgba(255,255,255,.6);border:1.5px dashed rgba(122,47,224,.26);transition:all .14s`,
    fileIcon: s.upFile ? 'ph-fill ph-video' : 'ph-bold ph-upload-simple',
    fileTitle: s.upFile ? 'video_walkthrough_88.mp4' : 'Click to browse',
    fileSub: s.upFile ? '24 MB · Ready to send' : 'MP4 or MOV · Max 100MB',
    setNote: '__setNote(event.target.value)',
    submitUpload: '__submitUpload()',
    submitStyle: `display:inline-flex;align-items:center;gap:8px;padding:16px 20px 16px 17px;border-radius:16px;background:linear-gradient(135deg,#e0473a,#bd291d);color:#fff;font-size:15px;font-weight:800;flex:1;justify-content:center;transition:transform .12s;box-shadow:0 12px 24px -10px rgba(224,71,58,.5);${!s.upFile ? 'opacity:.4;pointer-events:none' : ''}`,
    toast: s.toast
  };

  return renderApp(props);
}

function expose(name: string, fn: any) {
  (window as any)[name] = (...args: any[]) => { fn(...args); render(); };
}

expose('__toggleChannel', toggleChannel);
expose('__skip', (cid: string, isReels: boolean) => { state.status[cid] = 'skipped'; say(isReels ? 'Skipped. The reel stays in your Library.' : 'Skipped. MAPCO will bring another property.'); });
expose('__unskip', (cid: string) => { state.status[cid] = 'ready'; });
expose('__nav', (key: string) => { state.section = key; });
expose('__switchPost', (id: string) => { state.activePost = id; state.timeOpen = false; });
expose('__cyclePost', () => { state.activePost = state.activePost === 'a' ? 'b' : 'a'; state.timeOpen = false; });
expose('__pickTime', (o: string) => { state.times[state.section === 'reels' ? (state.reels[Math.min(state.reelIdx, state.reels.length - 1)]?.id || 'r1') : state.activePost] = o; state.timeOpen = false; say(o === 'Now' ? 'Set to post now.' : 'Scheduled for ' + o + '.'); });
expose('__toggleTime', () => { state.timeOpen = !state.timeOpen; });
expose('__publishActive', publishActive);
expose('__switchReel', (idx: number) => { state.reelIdx = idx; state.playing = false; state.timeOpen = false; });
expose('__cycleReel', (d: number) => { state.reelIdx = (state.reelIdx + d + state.reels.length) % state.reels.length; state.playing = false; state.timeOpen = false; });
expose('__togglePlay', () => { state.playing = !state.playing; });
expose('__setLibKind', (k: string) => { state.libKind = k; });
expose('__openPicker', () => { state.picker = true; });
expose('__closePicker', () => { state.picker = false; });
expose('__setLibProp', (code: string) => { state.libProp = code; state.picker = false; });
expose('__closeUpload', () => { state.uploadOpen = false; });
expose('__setUpPi', (i: number) => { state.upPi = i; });
expose('__setUpStep', (s: number) => { state.upStep = s; });
expose('__chooseFile', () => { state.upFile = 'yes'; });
expose('__setNote', (note: string) => { state.upNote = note; });
expose('__submitUpload', () => {
  if (state.upPi === null) { say('Pick a property first.'); return; }
  if (!state.upFile) { say('Choose a video to upload.'); return; }
  const id = 'r' + (state.reels.length + 1);
  state.reels.push({ id, pi: state.upPi, prod: 'received', dur: '', sub: 'Submitted just now' });
  state.used = Math.min(4, state.used + 1);
  state.reelIdx = state.reels.length - 1;
  state.uploadOpen = false; state.upStep = 1; state.upPi = null; state.upFile = ''; state.upNote = ''; state.playing = false;
  say('Video received. MAPCO will start editing.');
});
// also expose openUpload, although wait, openUpload isn't exposed.
expose('openUpload', () => { state.uploadOpen = true; });


function render() {
  const root = document.getElementById('app');
  if (!root) return;
  if (!document.getElementById('global-head')) {
    const d = document.createElement('div');
    d.id = 'global-head';
    d.innerHTML = globalHead;
    document.head.appendChild(d);
  }
  
  root.innerHTML = computeViewProps();
}

async function boot() {
  render();
  const root = document.getElementById('app');
  if (!root) return;
  await requireSession(root, async () => {
    try {
      state.feed = await loadDealerMarketingFeed();
    } catch (e) {
      console.error(e);
    }
    state.loading = false;
    render();
  });
}

boot();



