// @ts-nocheck
import { DCLogic } from '../../framework/dc';

export class Component extends DCLogic {
  CH = {
    ig: { name: 'Instagram', icon: 'ph-fill ph-instagram-logo', c: '#E1306C' },
    fb: { name: 'Facebook', icon: 'ph-fill ph-facebook-logo', c: '#1877F2' },
    gbp: { name: 'Google', icon: 'ph-fill ph-google-logo', c: '#EA4335' },
    wa: { name: 'WhatsApp', icon: 'ph-fill ph-whatsapp-logo', c: '#25D366' }
  };
  PROPS = [
    { code: 'S88214', title: 'Sector 88 · Plot 214', sub: 'Mohali · 250 sq yd', photo: '/assets/mkt-prop-3.webp' },
    { code: 'AER908', title: 'Aerocity · Plot 908', sub: '300 sq yd · corner', photo: '/assets/mkt-prop-2.jpg' },
    { code: 'S7861', title: 'Sector 78 · Plot 61', sub: 'Mohali · 150 sq yd', photo: '/assets/mkt-prop-4.jpg' },
    { code: 'S89142', title: 'Sector 89 · Plot 142', sub: 'Mohali · 200 sq yd', photo: '/assets/mkt-prop-4.jpg' },
    { code: 'NC12', title: 'New Chandigarh · Villa 12', sub: '500 sq yd villa plot', photo: '/assets/mkt-prop-1.jpg' },
    { code: 'AER77', title: 'Aerocity · Plot 77', sub: '240 sq yd', photo: '/assets/mkt-prop-3.webp' }
  ];
  TODAY = [
    {
      id: 'a', num: '01', accent: '#7a2fe0', layout: 'split', propName: 'Plot 214',
      photo: '/assets/mkt-prop-3.webp', eyebrow: 'Premium Plot', line1: 'SECTOR 88', line2: 'PLOT 214',
      factA: '250 SQ YD · PARK FACING', factB: '30 FT ROAD · GMADA APPROVED', tagline: 'READY TO REGISTER',
      features: [{ icon: 'ph-fill ph-map-pin', label: 'Prime Location' }, { icon: 'ph-fill ph-road-horizon', label: 'Wide Roads' }, { icon: 'ph-fill ph-tree', label: 'Park Facing' }, { icon: 'ph-fill ph-seal-check', label: 'Clear Title' }]
    },
    {
      id: 'b', num: '02', accent: '#e0473a', layout: 'overlay', propName: 'Plot 908',
      photo: '/assets/mkt-prop-2.jpg', eyebrow: 'Premium Corner Plot', line1: 'AEROCITY', line2: 'PLOT 908',
      factA: '300 SQ YD · 40 FT ROAD', factB: 'NEAR AIRPORT ROAD', tagline: 'Limited Inventory',
      features: [{ icon: 'ph-fill ph-corners-out', label: 'Corner Plot' }, { icon: 'ph-fill ph-road-horizon', label: '40 ft Road' }, { icon: 'ph-fill ph-trend-up', label: 'High Demand' }, { icon: 'ph-fill ph-chart-line-up', label: 'Great Investment' }]
    }
  ];
  TIMES = ['Now', '8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM'];
  GRAD = ['linear-gradient(155deg,#fff0c4,#ffd873)', 'linear-gradient(155deg,#dbfbe3,#8ce9a8)', 'linear-gradient(155deg,#ecdbff,#c6a3f5)', 'linear-gradient(155deg,#ffe3de,#ffb3a8)'];
  BORD = ['rgba(230,150,0,.4)', 'rgba(30,158,69,.36)', 'rgba(122,47,224,.34)', 'rgba(224,71,58,.34)'];

  state = {
    section: 'today',
    activePost: 'a',
    status: { a: 'ready', b: 'ready', r1: 'ready', r2: 'ready' },
    sel: { a: { ig: true, fb: true, gbp: true, wa: false }, b: { ig: true, fb: true, gbp: false, wa: true }, r1: { ig: true, fb: true }, r2: { ig: true, fb: false } },
    times: { a: '6:40 AM', b: '6:41 AM', r1: '7:10 PM', r2: '6:15 PM' },
    timeOpen: false,
    phase: 'ready', pubPost: null, chStep: 0, postedChans: {},
    picker: null, libProp: 'all', libKind: 'all', toast: '',
    reels: [
      { id: 'r1', pi: 0, prod: 'ready', dur: '0:28', sub: 'Edited by MAPCO · delivered Tuesday' },
      { id: 'r2', pi: 1, prod: 'ready', dur: '0:34', sub: 'Edited by MAPCO · delivered Monday' },
      { id: 'r3', pi: 2, prod: 'editing', dur: '', sub: 'Submitted yesterday' }
    ],
    reelIdx: 0, playing: false, used: 3,
    upload: false, upStep: 1, upPi: null, upFile: '', upNote: ''
  };

  curId() {
    const s = this.state;
    if (s.section !== 'reels') return s.activePost;
    const r = s.reels[Math.min(s.reelIdx, s.reels.length - 1)];
    return r ? r.id : 'r1';
  }
  chanKeys() { return this.state.section === 'reels' ? ['ig', 'fb'] : ['ig', 'fb', 'gbp', 'wa']; }
  cycleReel(d) { this.setState(s => ({ reelIdx: (s.reelIdx + d + s.reels.length) % s.reels.length, playing: false, timeOpen: false })); }
  submitUpload() {
    const s = this.state;
    if (s.upPi === null) { this.say('Pick a property first.'); return; }
    if (!s.upFile) { this.say('Choose a video to upload.'); return; }
    const id = 'r' + (s.reels.length + 1);
    this.setState(st => ({
      reels: [...st.reels, { id, pi: st.upPi, prod: 'received', dur: '', sub: 'Submitted just now' }],
      used: Math.min(4, st.used + 1), reelIdx: st.reels.length,
      upload: false, upStep: 1, upPi: null, upFile: '', upNote: '', playing: false
    }));
    this.say('Video received. MAPCO will start editing.');
  }

  componentDidMount() {
    if (this.props?.startLive) {
      this.setState({ status: { a: 'posted', b: 'posted' }, postedChans: { a: ['ig', 'fb', 'gbp'], b: ['ig', 'wa'] } });
    }
  }
  componentWillUnmount() { clearTimeout(this._t); clearTimeout(this._pt); }

  say(t) {
    clearTimeout(this._t);
    this.setState({ toast: t });
    this._t = setTimeout(() => this.setState({ toast: '' }), 2600);
  }
  thumb(src, size, radius) {
    return `width:${size}px;height:${size}px;flex:none;border-radius:${radius}px;background-image:url("${src}");background-size:cover;background-position:center;background-color:#e6ddce`;
  }

  toggleChannel(pid, c) {
    this.setState(s => {
      const cur = s.sel[pid] || {};
      return { sel: { ...s.sel, [pid]: { ...cur, [c]: !cur[c] } } };
    });
  }
  switchPost(id) { this.setState({ activePost: id, timeOpen: false }); }
  cyclePost() { const next = this.state.activePost === 'a' ? 'b' : 'a'; this.setState({ activePost: next, timeOpen: false }); }

  publishActive() {
    const id = this.curId();
    const isReel = this.state.section === 'reels';
    if (this.state.phase !== 'ready') return;
    if ((this.state.status[id] || 'ready') !== 'ready') { this.say(isReel ? 'This reel is already live.' : 'This post is already live.'); return; }
    const sel = this.state.sel[id] || {}, order = this.chanKeys();
    const chans = order.filter(c => sel[c]);
    if (!chans.length) { this.say('Turn on at least one channel first.'); return; }
    this.setState({ phase: 'publishing', pubPost: id, chStep: 0, timeOpen: false });
    this._curChans = chans;
    const tick = () => {
      this.setState(s => ({ chStep: s.chStep + 1 }));
      if (this.state.chStep >= chans.length) {
        this.setState(s => ({ phase: 'ready', pubPost: null, status: { ...s.status, [id]: 'posted' }, postedChans: { ...s.postedChans, [id]: chans } }));
        this.say(isReel ? 'Done. Your reel is out.' : 'Done. This post is out.');
      } else this._pt = setTimeout(tick, 600);
    };
    this._pt = setTimeout(tick, 480);
  }

  reachChartSvg() {
    const data = [210, 240, 190, 260, 300, 280, 340, 320, 380, 360, 300, 410, 430, 390, 460, 440, 510, 480, 540, 520, 590, 560, 620, 600, 660, 640, 700, 680, 740, 760];
    const W = 580, H = 246, padX = 12, padTop = 34, padBot = 38, min = 150, max = 800;
    const x = i => padX + i * (W - 2 * padX) / (data.length - 1);
    const y = v => H - padBot - (v - min) / (max - min) * (H - padTop - padBot);
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
  donutSvg() {
    const segs = [{ c: '#E1306C', v: 52 }, { c: '#1877F2', v: 31 }, { c: '#EA4335', v: 11 }, { c: '#25D366', v: 6 }];
    const R = 64, SW = 26, C = 84, circ = 2 * Math.PI * R, gap = 9; let off = 0;
    const rings = segs.map(s => { const len = circ * s.v / 100; const draw = Math.max(len - gap, 3); const el = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${s.c}" stroke-width="${SW}" stroke-dasharray="${draw.toFixed(1)} ${(circ - draw).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${C} ${C})" stroke-linecap="round"/>`; off += len; return el; }).join('');
    return `<svg viewBox="0 0 168 168" style="width:172px;height:172px;display:block">${rings}<text x="84" y="80" text-anchor="middle" font-family="Newsreader,serif" font-size="34" font-weight="500" fill="#1c1430">8.4k</text><text x="84" y="100" text-anchor="middle" font-family="Hanken Grotesk,sans-serif" font-size="10.5" font-weight="800" fill="#7a6a8e" letter-spacing="1">TOTAL REACH</text></svg>`;
  }

  renderVals() {
    const s = this.state, CH = this.CH, P = this.PROPS;

    const TABS = [
      { key: 'today', label: 'Today', icon: 'ph-sun-horizon' },
      { key: 'reels', label: 'Reels', icon: 'ph-film-reel' },
      { key: 'library', label: 'Library', icon: 'ph-cards-three' },
      { key: 'performance', label: 'Performance', icon: 'ph-chart-bar' }
    ];
    const tabs = TABS.map(t => {
      const on = s.section === t.key; return {
        label: t.label, icon: (on ? 'ph-fill ' : 'ph ') + t.icon,
        style: `display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:13px;font-size:14.5px;font-weight:800;transition:all .16s;${on ? 'background:#1c1430;color:#ffcb45;box-shadow:0 10px 22px -12px rgba(28,20,48,.7)' : 'color:#5a3a1c;background:transparent'}`,
        go: () => this.setState({ section: t.key })
      };
    });

    const navAccounts = [
      { icon: CH.ig.icon, color: '#fff', grad: 'linear-gradient(45deg,#f9ce34,#ee2a7b 45%,#6228d7)' },
      { icon: CH.fb.icon, color: '#1877F2' }, { icon: CH.gbp.icon, color: '#EA4335' }, { icon: CH.wa.icon, color: '#25D366' }
    ].map(a => ({
      icon: a.icon, color: a.color,
      style: `width:30px;height:30px;border-radius:9px;display:grid;place-items:center;${a.grad ? 'background:' + a.grad : 'background:#fff'};box-shadow:0 5px 12px -6px rgba(40,15,70,.5);border:1.5px solid rgba(255,255,255,.85)`
    }));

    // ---- TODAY / REELS (shared creative + publishing bar) ----
    const isReels = s.section === 'reels';
    const cid = this.curId(), keys = this.chanKeys();
    const buildChannels = (id) => keys.map(k => {
      const c = CH[k], on = !!(s.sel[id] || {})[k]; return {
        name: c.name, icon: c.icon, on, iconColor: on ? c.c : '#b7a58f',
        style: `position:relative;width:52px;height:52px;flex:none;border-radius:15px;display:grid;place-items:center;transition:all .15s;${on ? 'background:#fff;box-shadow:0 10px 20px -8px ' + c.c + 'aa' : 'background:rgba(255,255,255,.45);opacity:.6'}`,
        toggle: () => this.toggleChannel(id, k)
      };
    });
    const at = this.TODAY.find(t => t.id === s.activePost) || this.TODAY[0];
    const curSt = s.status[cid] || 'ready', posted = curSt === 'posted', skipped = curSt === 'skipped';
    const shared = {
      channels: buildChannels(cid),
      skip: () => { this.setState(st2 => ({ status: { ...st2.status, [cid]: 'skipped' } })); this.say(isReels ? 'Skipped. The reel stays in your Library.' : 'Skipped. MAPCO will bring another property.'); },
      unskip: () => this.setState(st2 => ({ status: { ...st2.status, [cid]: 'ready' } }))
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
    const postTabs = this.TODAY.map(t => {
      const on = s.activePost === t.id, live = s.status[t.id] === 'posted'; return {
        num: t.num, name: t.propName, live,
        dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;background:${t.accent};${on ? 'box-shadow:0 0 0 4px ' + t.accent + '44' : ''}`,
        style: `display:flex;align-items:center;gap:9px;padding:8px 14px;border-radius:14px;transition:all .16s;${on ? 'background:#fff;box-shadow:0 12px 26px -14px rgba(90,40,150,.55);border:1px solid rgba(122,47,224,.2)' : 'background:rgba(255,255,255,.4);border:1px solid transparent;opacity:.72'}`,
        go: () => this.switchPost(t.id)
      };
    });

    const phase = s.phase;
    const barPublishing = phase === 'publishing' && s.pubPost === cid;
    const barPosted = posted && !barPublishing;
    const barReady = !barPublishing && !barPosted;
    const selChans = keys.filter(c => (s.sel[cid] || {})[c]);
    const chList = barPublishing ? (this._curChans || []) : selChans;
    const progressChannels = chList.map((k, i) => {
      const done = i < s.chStep, act = i === s.chStep; return {
        name: CH[k].name, icon: CH[k].icon, done, active: act, pending: !done && !act,
        textColor: done ? '#177a42' : (act ? '#1c1430' : '#b8a68e'),
        style: `display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:11px;background:${done ? 'rgba(34,197,94,.14)' : (act ? 'rgba(122,47,224,.12)' : 'rgba(122,47,224,.05)')};transition:background .3s`
      };
    });
    const postedChannels = (s.postedChans[cid] || selChans).map(k => ({ name: CH[k].name, icon: CH[k].icon, color: CH[k].c }));

    const timeOptions = this.TIMES.map(o => {
      const on = s.times[cid] === o; return {
        label: o,
        style: `flex:none;padding:9px 15px;border-radius:11px;font-size:13px;font-weight:800;transition:all .14s;${on ? 'background:#1c1430;color:#ffcb45' : 'background:rgba(255,255,255,.7);border:1px solid rgba(122,47,224,.16);color:#4a3d33'}`,
        pick: () => { this.setState(st2 => ({ times: { ...st2.times, [cid]: o }, timeOpen: false })); this.say(o === 'Now' ? 'Set to post now.' : 'Scheduled for ' + o + '.'); }
      };
    });

    // ---- REELS ----
    const STAGE = { received: { label: 'Received', icon: 'ph-fill ph-tray-arrow-down', line: 'We have your video' }, editing: { label: 'In editing', icon: 'ph-fill ph-scissors', line: 'Your video is being edited' }, ready: { label: 'Ready', icon: 'ph-fill ph-check-circle', line: 'Your reel is ready' } };
    const cr = s.reels[Math.min(s.reelIdx, s.reels.length - 1)] || s.reels[0];
    const crp = P[cr.pi] || P[0];
    const crReady = cr.prod === 'ready';
    const reel = {
      eyebrow: crReady ? (posted ? 'Live' : (skipped ? 'Saved' : 'Ready to post')) : STAGE[cr.prod].line,
      showStatus: crReady && !posted && !skipped,
      statusPill: 'display:inline-flex;align-items:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 11px;border-radius:10px;background:rgba(255,255,255,.92);color:#5a18c0;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;box-shadow:0 8px 18px -10px rgba(0,0,0,.6)',
      photoStyle: `position:absolute;inset:0;background-image:url("${crp.photo}");background-size:cover;background-position:center;${s.playing && crReady ? 'animation:omZoom 9s ease-in-out infinite alternate' : ''}`,
      isReady: crReady && !skipped, isPending: !crReady, isSkipped: crReady && skipped, isPosted: crReady && posted && !skipped,
      playing: s.playing,
      playIcon: s.playing ? 'ph-fill ph-pause' : 'ph-fill ph-play',
      playNudge: s.playing ? '0' : '4px',
      playStyle: `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:76px;height:76px;border-radius:50%;background:rgba(255,255,255,${s.playing ? '.72' : '.92'});display:grid;place-items:center;box-shadow:0 18px 38px -14px rgba(0,0,0,.7);transition:transform .18s,background .18s`,
      barStyle: `height:100%;border-radius:3px;background:linear-gradient(90deg,#ffd24d,#ff6b5c);${s.playing ? 'animation:omProg 22s linear forwards' : 'width:0%'}`,
      togglePlay: () => this.setState(st2 => ({ playing: !st2.playing })),
      dur: cr.dur || '—', loc: crp.sub.split(' · ')[0], title: crp.title, sub: cr.sub,
      pendingLine: STAGE[cr.prod].line, stageIcon: STAGE[cr.prod].icon,
      caption: crReady ? (crp.sub + ' · vertical reel · ' + cr.dur) : 'MAPCO is producing this reel — nothing for you to do.',
      steps: ['received', 'editing', 'ready'].map(k => {
        const order = ['received', 'editing', 'ready'], ai = order.indexOf(cr.prod), i = order.indexOf(k), done = i < ai, on = i === ai; return {
          label: STAGE[k].label, icon: done ? 'ph-fill ph-check' : (on ? STAGE[k].icon : 'ph ph-circle'),
          style: `display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:11px;font-size:12.5px;font-weight:800;${on ? 'background:#1c1430;color:#ffcb45' : (done ? 'background:rgba(34,197,94,.16);color:#177a42' : 'background:rgba(255,255,255,.5);color:#a99a86')}`
        };
      })
    };
    const reelTabs = s.reels.map((r, i) => {
      const on = i === Math.min(s.reelIdx, s.reels.length - 1), rp = P[r.pi] || P[0], live = s.status[r.id] === 'posted'; return {
        name: rp.title.split(' · ')[1] || rp.title, stage: r.prod === 'ready' ? (live ? 'Live' : 'Ready') : STAGE[r.prod].label,
        dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;background:${r.prod === 'ready' ? (live ? '#22c55e' : '#7a2fe0') : '#e6ad45'};${on ? 'box-shadow:0 0 0 4px ' + (r.prod === 'ready' ? (live ? 'rgba(34,197,94,.28)' : 'rgba(122,47,224,.28)') : 'rgba(230,173,69,.3)') : ''}`,
        style: `display:flex;align-items:center;gap:9px;padding:8px 13px;border-radius:14px;flex:none;transition:all .16s;${on ? 'background:#fff;box-shadow:0 12px 26px -14px rgba(90,40,150,.55);border:1px solid rgba(122,47,224,.2)' : 'background:rgba(255,255,255,.4);border:1px solid transparent;opacity:.72'}`,
        go: () => this.setState({ reelIdx: i, playing: false, timeOpen: false })
      };
    });
    const quotaFull = s.used >= 4;
    const upProps = P.map((p, i) => ({
      title: p.title, sub: p.sub, on: s.upPi === i,
      photoStyle: this.thumb(p.photo, 42, 10),
      style: `display:flex;align-items:center;gap:10px;padding:9px;border-radius:13px;background:#fff;border:1.5px solid ${s.upPi === i ? '#7a2fe0' : 'rgba(122,47,224,.14)'};transition:all .15s;cursor:pointer`,
      pick: () => this.setState({ upPi: i })
    }));

    // ---- LIBRARY (date-grouped, scroll, property popup) ----
    const LP = [
      { pi: 0, when: '6:40 AM', ch: 'ig', pub: false, reach: '—', likes: '—', opens: '—', grp: 'today' },
      { pi: 1, when: '6:41 AM', ch: 'fb', pub: false, reach: '—', likes: '—', opens: '—', grp: 'today' },
      { pi: 3, when: '5:12 PM', ch: 'ig', pub: true, reach: '2.1k', likes: '142', opens: '71', grp: 'yesterday' },
      { pi: 2, when: '9:03 AM', ch: 'wa', pub: true, reach: '1.2k', likes: '86', opens: '40', grp: 'yesterday' },
      { pi: 4, when: 'Sat 17 Aug', ch: 'gbp', pub: true, reach: '640', likes: '31', opens: '22', grp: 'week' },
      { pi: 0, when: 'Fri 16 Aug', ch: 'fb', pub: true, reach: '1.9k', likes: '118', opens: '63', grp: 'week' },
      { pi: 5, when: 'Tue 13 Aug', ch: 'ig', pub: true, reach: '2.4k', likes: '167', opens: '88', grp: 'last' },
      { pi: 2, when: 'Mon 12 Aug', ch: 'wa', pub: true, reach: '980', likes: '54', opens: '33', grp: 'last' },
      { pi: 1, when: 'Tue 6 Aug', ch: 'ig', pub: true, reach: '1.6k', likes: '99', opens: '47', grp: 'earlier' },
      { pi: 4, when: 'Mon 5 Aug', ch: 'gbp', pub: true, reach: '720', likes: '38', opens: '25', grp: 'earlier' },
      { pi: 0, when: 'Tue 18 Aug', ch: 'ig', pub: true, reach: '3.4k', likes: '286', shares: '64', grp: 'yesterday', kind: 'reel', dur: '0:28' },
      { pi: 1, when: 'Sat 17 Aug', ch: 'fb', pub: true, reach: '2.8k', likes: '201', shares: '47', grp: 'week', kind: 'reel', dur: '0:34' },
      { pi: 4, when: 'Tue 13 Aug', ch: 'ig', pub: true, reach: '4.1k', likes: '333', shares: '88', grp: 'last', kind: 'reel', dur: '0:22' },
      { pi: 5, when: 'Wed 7 Aug', ch: 'ig', pub: true, reach: '2.2k', likes: '174', shares: '39', grp: 'earlier', kind: 'reel', dur: '0:31' }
    ];
    const GRP = [
      { k: 'today', label: 'Today', date: 'Wed · 19 Aug' },
      { k: 'yesterday', label: 'Yesterday', date: 'Tue · 18 Aug' },
      { k: 'week', label: 'Earlier this week', date: '16–17 Aug' },
      { k: 'last', label: 'Last week', date: '12–13 Aug' },
      { k: 'earlier', label: 'Earlier this month', date: '5–6 Aug' }
    ];
    const libVisible = LP.filter(a => (s.libProp === 'all' || String(a.pi) === s.libProp) && (s.libKind === 'all' || (s.libKind === 'reels' ? a.kind === 'reel' : a.kind !== 'reel')));
    let gci = 0;
    const mkCard = (a) => {
      const pr = P[a.pi], c = CH[a.ch], gi = gci++ % 4; return {
        cardStyle: `border-radius:24px;overflow:hidden;background:${this.GRAD[gi]};border:1.5px solid ${this.BORD[gi]};box-shadow:0 30px 60px -34px rgba(40,15,70,.55);animation:omRise .4s cubic-bezier(.2,.8,.2,1) both`,
        photoStyle: `position:relative;height:280px;background-image:url("${pr.photo}");background-size:cover;background-position:center`,
        chipStyle: `position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:11px;background:#fff;display:grid;place-items:center;z-index:2;box-shadow:0 6px 14px -6px rgba(0,0,0,.4)`,
        chanIcon: c.icon, chanColor: c.c,
        statusStyle: `position:absolute;top:14px;left:14px;display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;z-index:2;font-size:11px;font-weight:800;${a.pub ? 'background:rgba(34,197,94,.94);color:#fff' : 'background:rgba(255,255,255,.94);color:#7a2fe0'}`,
        statusIcon: a.pub ? 'ph-fill ph-check' : 'ph-fill ph-clock', statusLabel: a.pub ? 'Published' : 'Not posted',
        loc: pr.sub.split(' · ')[0], title: pr.title, when: a.when,
        reuse: () => this.say('Reusing this creative — pick where to send it.'),
        stats: [
          { icon: 'ph-fill ph-eye', value: a.reach, label: 'Reach', bg: 'rgba(255,255,255,.66)', bd: 'rgba(122,47,224,.14)', fg: '#7a2fe0' },
          { icon: 'ph-fill ph-heart', value: a.likes, label: 'Likes', bg: 'rgba(255,255,255,.66)', bd: 'rgba(224,48,108,.18)', fg: '#E1306C' },
          { icon: 'ph-fill ph-cursor-click', value: a.opens, label: 'Opens', bg: 'rgba(255,255,255,.66)', bd: 'rgba(230,150,0,.2)', fg: '#b07d1e' }
        ]
      };
    };
    const mkReel = (a) => {
      const pr = P[a.pi], c = CH[a.ch]; return {
        mediaStyle: `position:relative;width:100%;aspect-ratio:9/16;border-radius:24px 24px 0 0;overflow:hidden;background-image:url("${pr.photo}");background-size:cover;background-position:center;background-color:#14101f;box-shadow:0 36px 70px -32px rgba(40,15,70,.75)`,
        chanIcon: c.icon, chanColor: c.c, dur: a.dur || '—',
        statusStyle: `position:absolute;top:14px;left:14px;display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;z-index:2;font-size:11px;font-weight:800;${a.pub ? 'background:rgba(34,197,94,.94);color:#fff' : 'background:rgba(255,255,255,.94);color:#7a2fe0'}`,
        statusIcon: a.pub ? 'ph-fill ph-check' : 'ph-fill ph-clock', statusLabel: a.pub ? 'Published' : 'Not posted',
        loc: pr.sub.split(' · ')[0], title: pr.title, when: a.when,
        play: () => this.say('Playing reel · ' + pr.title),
        reuse: () => this.say('Reusing this reel — pick where to send it.'),
        stats: [
          { icon: 'ph-fill ph-eye', value: a.reach, label: 'Reach', fg: '#7a2fe0', bd: 'rgba(122,47,224,.16)' },
          { icon: 'ph-fill ph-heart', value: a.likes, label: 'Likes', fg: '#E1306C', bd: 'rgba(224,48,108,.2)' },
          { icon: 'ph-fill ph-share-fat', value: a.shares || '—', label: 'Shares', fg: '#16a34a', bd: 'rgba(22,163,74,.22)' }
        ]
      };
    };
    const noun = (n) => { const w = s.libKind === 'reels' ? 'reel' : (s.libKind === 'posts' ? 'post' : 'item'); return n + ' ' + w + (n === 1 ? '' : 's'); };
    const grpWrap = 'margin-top:26px;animation:omRise .45s cubic-bezier(.2,.8,.2,1) both';
    const libGroups = (s.libKind === 'reels')
      ? (libVisible.length ? [{ label: 'Finished reels', date: 'August', count: noun(libVisible.length), showHeader: false, wrapStyle: 'margin-top:14px;animation:omRise .45s cubic-bezier(.2,.8,.2,1) both', hasReels: true, reels: libVisible.map(mkReel), hasPosts: false, posts: [] }] : [])
      : GRP.map(g => {
        const items = libVisible.filter(a => a.grp === g.k); if (!items.length) return null;
        const ps = items.filter(a => a.kind !== 'reel'), rs = items.filter(a => a.kind === 'reel');
        return {
          label: g.label, date: g.date, count: noun(items.length), showHeader: true, wrapStyle: grpWrap,
          hasReels: rs.length > 0, reels: rs.map(mkReel),
          hasPosts: ps.length > 0, posts: ps.map(mkCard)
        };
      }).filter(Boolean);
    const kindTabs = [{ k: 'all', label: 'All', icon: 'ph-squares-four' }, { k: 'posts', label: 'Posts', icon: 'ph-image' }, { k: 'reels', label: 'Reels', icon: 'ph-film-reel' }].map(t => {
      const on = s.libKind === t.k; return {
        label: t.label, icon: (on ? 'ph-fill ' : 'ph ') + t.icon,
        style: `display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;font-size:13px;font-weight:800;transition:all .15s;${on ? 'background:#1c1430;color:#ffcb45' : 'color:#5a3a1c;background:transparent'}`,
        go: () => this.setState({ libKind: t.k })
      };
    });

    // ---- LIBRARY filter popup ----
    let pickerItems = [];
    if (s.picker) {
      const withPosts = [...new Set(LP.map(a => a.pi))];
      pickerItems.push({
        isAll: true, title: 'All properties', sub: 'Show every post', current: s.libProp === 'all',
        photoStyle: 'width:48px;height:48px;flex:none;border-radius:11px;background:linear-gradient(135deg,#7a2fe0,#22bf55);display:grid;place-items:center',
        style: `display:flex;align-items:center;gap:12px;padding:11px;border-radius:14px;background:#fff;border:1.5px solid ${s.libProp === 'all' ? '#e6ad45' : 'rgba(122,47,224,.14)'};transition:all .15s;cursor:pointer`,
        choose: () => this.setState({ libProp: 'all', picker: null })
      });
      withPosts.forEach(pi => {
        const pr = P[pi]; pickerItems.push({
          isAll: false, title: pr.title, sub: pr.sub, current: String(pi) === s.libProp,
          photoStyle: this.thumb(pr.photo, 48, 11),
          style: `display:flex;align-items:center;gap:12px;padding:11px;border-radius:14px;background:#fff;border:1.5px solid ${String(pi) === s.libProp ? '#e6ad45' : 'rgba(122,47,224,.14)'};transition:all .15s;cursor:pointer`,
          choose: () => { this.setState({ libProp: String(pi), picker: null }); this.say('Showing ' + pr.title + '.'); }
        });
      });
    }
    const filterLabel = s.libProp === 'all' ? '' : (P[Number(s.libProp)] ? P[Number(s.libProp)].title : '');

    // ---- PERFORMANCE ----
    const kpis = [
      { icon: 'ph-fill ph-paper-plane-right', value: '42', label: 'Posts published', delta: '↑ 5', bg: 'rgba(255,255,255,.6)', fg: '#7a2fe0' },
      { icon: 'ph-fill ph-eye', value: '8,400', label: 'People reached', delta: '↑ 38%', bg: 'rgba(255,255,255,.6)', fg: '#E1306C' },
      { icon: 'ph-fill ph-cursor-click', value: '610', label: 'Property opens', delta: '↑ 44%', bg: 'rgba(255,255,255,.6)', fg: '#b07d1e' },
      { icon: 'ph-fill ph-user-plus', value: '312', label: 'New followers', delta: '↑ 18%', bg: 'rgba(255,255,255,.6)', fg: '#16a34a' }
    ].map((k, i) => ({ ...k, cardStyle: `border-radius:20px;background:${this.GRAD[i % 4]};border:1.5px solid ${this.BORD[i % 4]};padding:20px 22px;box-shadow:0 22px 46px -34px rgba(40,15,70,.5)` }));
    const engagement = [
      { icon: 'ph-fill ph-heart', value: '430', label: 'Likes', bg: 'rgba(255,255,255,.7)', fg: '#E1306C' },
      { icon: 'ph-fill ph-chat-circle', value: '58', label: 'Comments', bg: 'rgba(255,255,255,.7)', fg: '#1877F2' },
      { icon: 'ph-fill ph-share-fat', value: '41', label: 'Shares', bg: 'rgba(255,255,255,.7)', fg: '#7c3aed' },
      { icon: 'ph-fill ph-bookmark-simple', value: '83', label: 'Saves', bg: 'rgba(255,255,255,.7)', fg: '#b07d1e' }
    ];
    const perfChannels = [{ k: 'ig', pct: '52%', reach: '4.4k' }, { k: 'fb', pct: '31%', reach: '2.6k' }, { k: 'gbp', pct: '11%', reach: '0.9k' }, { k: 'wa', pct: '6%', reach: '0.5k' }]
      .map(c => ({ name: CH[c.k].name, color: CH[c.k].c, pct: c.pct, reach: c.reach }));
    const fmax = 214;
    const followerRows = [
      { k: 'ig', val: '+214', n: 214 }, { k: 'fb', val: '+98', n: 98 }
    ].map(r => ({
      name: CH[r.k].name, icon: CH[r.k].icon, color: CH[r.k].c, val: r.val,
      barStyle: `height:100%;width:${Math.round(r.n / fmax * 100)}%;border-radius:6px;background:${CH[r.k].c}`
    }));

    return {
      isToday: s.section === 'today', isReels: isReels, isLibrary: s.section === 'library', isPerf: s.section === 'performance',
      contentStyle: (s.section === 'today' || isReels) ? 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;position:relative' : 'flex:1;min-height:0;overflow-y:auto;position:relative',

      reel, reelTabs,
      reelPrev: () => this.cycleReel(-1), reelNext: () => this.cycleReel(1),
      reelPublishable: crReady, reelPending: !crReady,
      quotaLabel: s.used + ' of 4 reels used this month',
      quotaStyle: `display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:12px;background:rgba(255,255,255,.55);border:1px solid rgba(230,150,0,.24);font-size:12.5px;font-weight:800;color:${quotaFull ? '#c0402e' : '#8a5a2e'}`,
      uploadBtnStyle: `display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:13px;font-size:14px;font-weight:800;transition:transform .16s;${quotaFull ? 'background:rgba(122,47,224,.12);color:#9a8aa8;cursor:not-allowed' : 'background:#1c1430;color:#ffcb45;box-shadow:0 14px 28px -14px rgba(28,20,48,.8)'}`,
      openUpload: () => { if (s.used >= 4) { this.say('All 4 reels for this month are used.'); return; } this.setState({ upload: true, upStep: 1 }); },
      uploadOpen: !!s.upload, closeUpload: () => this.setState({ upload: false }),
      upProps,
      isStep1: (s.upStep || 1) === 1, isStep2: (s.upStep || 1) === 2,
      stepLabel: (s.upStep || 1) === 1 ? 'Step 1 of 2' : 'Step 2 of 2',
      stepTitle: (s.upStep || 1) === 1 ? 'Which property?' : 'Upload the raw video',
      stepSub: (s.upStep || 1) === 1 ? 'Pick the plot this video is of.' : 'Send us footage straight from your phone — MAPCO edits it into a finished reel.',
      dot1Style: 'height:4px;border-radius:3px;flex:1;background:#7a2fe0',
      dot2Style: `height:4px;border-radius:3px;flex:1;background:${(s.upStep || 1) === 2 ? '#7a2fe0' : 'rgba(122,47,224,.2)'}`,
      nextStep: () => { if (s.upPi === null) { this.say('Pick a property first.'); return; } this.setState({ upStep: 2 }); },
      backStep: () => this.setState({ upStep: 1 }),
      nextStyle: `width:100%;margin-top:20px;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:15px 24px;border-radius:16px;font-size:16px;font-weight:800;transition:transform .16s;${s.upPi !== null ? 'background:#1c1430;color:#ffcb45;box-shadow:0 20px 38px -18px rgba(28,20,48,.9)' : 'background:rgba(122,47,224,.14);color:#9a8aa8'}`,
      chosenTitle: s.upPi !== null ? P[s.upPi].title : '',
      chosenPhotoStyle: s.upPi !== null ? this.thumb(P[s.upPi].photo, 42, 10) : 'width:42px;height:42px;border-radius:10px;background:#e6ddce',
      fileBtnStyle: `width:100%;margin-top:10px;display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:16px;border:1.5px dashed ${s.upFile ? '#22c55e' : 'rgba(122,47,224,.35)'};background:rgba(255,255,255,.7);transition:all .15s;cursor:pointer`,
      fileIcon: s.upFile ? 'ph-fill ph-check-circle' : 'ph-fill ph-video-camera',
      fileTitle: s.upFile || 'Choose video',
      fileSub: s.upFile ? 'Ready to send · tap to replace' : 'MP4 or MOV straight from your phone',
      chooseFile: () => this.setState({ upFile: 'IMG_4821.MOV · 42 MB' }),
      setNote: e => { this._note = e.target.value; },
      submitStyle: `width:100%;margin-top:22px;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:16px 24px;border-radius:16px;font-size:16.5px;font-weight:800;transition:transform .16s;${(s.upPi !== null && s.upFile) ? 'background:linear-gradient(100deg,#7a2fe0,#e0473a 55%,#f0a83c);color:#fff;box-shadow:0 22px 40px -14px rgba(224,71,58,.6)' : 'background:rgba(122,47,224,.14);color:#9a8aa8'}`,
      submitUpload: () => this.submitUpload(),
      kindTabs,
      libWrapStyle: 'max-width:1240px;margin:0 auto;width:100%;padding:' + (s.libKind === 'reels' ? '16px 34px 14px' : '16px 34px 56px'),
      tabs, navAccounts,

      active, postTabs,
      goPrev: () => this.cyclePost(), goNext: () => this.cyclePost(),
      barReady, barPublishing, barPosted,
      progressChannels, postedChannels,
      postedLine: 'Sent to ' + postedChannels.length + ' channel' + (postedChannels.length > 1 ? 's' : '') + ' · tracked via go.mapco.in',
      activeTime: s.times[at.id], timeOpen: s.timeOpen, toggleTime: () => this.setState(st2 => ({ timeOpen: !st2.timeOpen })), timeOptions,
      timeChipStyle: 'display:inline-flex;align-items:center;gap:8px;padding:11px 15px;border-radius:14px;background:rgba(255,255,255,.75);border:1px solid rgba(122,47,224,.16);flex:none;transition:all .15s',
      publishLabel: selChans.length ? 'Post now' : 'Pick a channel',
      publishBtnStyle: `display:inline-flex;align-items:center;gap:12px;padding:16px 34px;border-radius:16px;font-size:18px;font-weight:800;flex:none;transition:transform .16s,box-shadow .16s;${selChans.length ? 'background:linear-gradient(100deg,#7a2fe0,#e0473a 55%,#f0a83c);color:#fff;box-shadow:0 22px 40px -14px rgba(224,71,58,.65)' : 'background:rgba(122,47,224,.14);color:#9a8aa8;cursor:default'}`,
      publishActive: () => this.publishActive(),

      libGroups,
      libCount: noun(libVisible.length),
      activeFilter: s.libProp !== 'all', filterLabel,
      clearFilter: () => this.setState({ libProp: 'all' }),
      openLibFilter: () => this.setState({ picker: true }),
      libFilterBtnStyle: 'display:inline-flex;align-items:center;gap:9px;padding:11px 16px;border-radius:14px;background:rgba(255,255,255,.7);border:1px solid rgba(122,47,224,.18);color:#1c1430;font-size:13.5px;font-weight:800;transition:all .15s',

      picker: !!s.picker, pickerItems, closePicker: () => this.setState({ picker: null }), stop: e => { e.stopPropagation && e.stopPropagation(); },

      kpis, engagement, perfChannels,
      reachChart: this.reachChartSvg(),
      donut: this.donutSvg(),
      topPropStyle: 'position:relative;height:150px;background-image:url("/assets/mkt-prop-3.webp");background-size:cover;background-position:center',
      topPropTitle: 'Sector 88 · Plot 214',
      topPropLine: '1,900 people reached · 138 opened the property page. Your most-viewed listing this month.',
      followerRows, followerTotal: '+312 this month',
      toast: s.toast
    };
  }
}
