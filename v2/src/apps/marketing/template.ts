// @ts-nocheck
export const globalHead = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&amp;family=Hanken+Grotesk:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%}
  body{background:#fff4de;color:#241833;font-family:'Hanken Grotesk',system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden}
  a{color:#7a2fe0;text-decoration:none}
  a:hover{color:#5a18c0}
  ::selection{background:#ffd24d;color:#241833}
  button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
  textarea{font-family:inherit}
  [data-scroll]::-webkit-scrollbar{width:11px;height:11px}
  [data-scroll]::-webkit-scrollbar-thumb{background:rgba(122,47,224,.3);border-radius:9px;border:3px solid transparent;background-clip:content-box}
  [data-scroll]::-webkit-scrollbar-track{background:transparent}
  @keyframes omRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes omPop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
  @keyframes omSpin{to{transform:rotate(360deg)}}
  @keyframes omCheck{0%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1.14)}100%{opacity:1;transform:scale(1)}}
  @keyframes omDraw{from{stroke-dashoffset:1100}to{stroke-dashoffset:0}}
  @keyframes omSlideX{from{opacity:0;transform:translateX(24px) scale(.985)}to{opacity:1;transform:none}}
  @keyframes flA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6vw,-4vh) scale(1.14)}}
  @keyframes flB{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-5vw,5vh) scale(1.18)}}
  @keyframes flC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(4vw,6vh) scale(1.1)}}
  @keyframes flD{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-6vw,-5vh) scale(1.12)}}
  @keyframes flE{0%,100%{transform:translate(-50%,-50%) rotate(0deg)}50%{transform:translate(-46%,-54%) rotate(8deg)}}
  @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(2vw,3vh)}}
  @keyframes rot{to{transform:translate(-50%,-50%) rotate(360deg)}}
  @keyframes omZoom{from{transform:scale(1)}to{transform:scale(1.12)}}
  @keyframes omProg{from{width:0%}to{width:100%}}
  @keyframes omPulse{0%,100%{opacity:.5}50%{opacity:1}}
</style>
`;

/* Built once and kept. `new Function` compiles its body from source, and
   that body is this entire screen — hundreds of kilobytes of it. It was
   being rebuilt on every render, and every keystroke in every form is a
   render, so each character typed made the engine parse and compile the
   whole app again before a single node could be written. */
let compiler: ((props: any) => string) | null = null;

export function renderApp(state: any) {
  if (!compiler) compiler = new Function('props', `
    with (props) {
      return \`


<div style="position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none">
  <div style="position:absolute;left:50%;top:50%;width:130vw;height:130vw;transform:translate(-50%,-50%);background:conic-gradient(from 0deg,rgba(255,203,69,.14),rgba(122,47,224,.13),rgba(34,191,85,.13),rgba(224,71,58,.14),rgba(255,203,69,.14));filter:blur(48px);opacity:.7;animation:rot 120s linear infinite"></div>
  <div style="position:absolute;width:56vw;height:56vw;left:-14vw;top:-18vw;border-radius:50%;background:radial-gradient(circle at 42% 42%,#ffe07a,#ffb000 52%,transparent 72%);filter:blur(30px);opacity:.58;animation:flA 22s ease-in-out infinite"></div>
  <div style="position:absolute;width:52vw;height:52vw;left:-12vw;bottom:-20vw;border-radius:50%;background:radial-gradient(circle at 50% 45%,#8cf0ad,#22bf55 52%,transparent 72%);filter:blur(32px);opacity:.5;animation:flB 26s ease-in-out infinite"></div>
  <div style="position:absolute;width:60vw;height:60vw;right:-20vw;top:-6vw;border-radius:50%;background:radial-gradient(circle at 55% 50%,#cba3ff,#7a2fe0 52%,transparent 72%);filter:blur(34px);opacity:.44;animation:flC 24s ease-in-out infinite"></div>
  <div style="position:absolute;width:42vw;height:42vw;right:4vw;bottom:-18vw;border-radius:50%;background:radial-gradient(circle at 50% 50%,#ffb0a8,#ff6b5c 55%,transparent 72%);filter:blur(30px);opacity:.42;animation:flD 20s ease-in-out infinite"></div>
  <div style="position:absolute;left:50%;top:50%;width:34vw;height:34vw;border-radius:46% 54% 60% 40%/52% 44% 56% 48%;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.55),transparent 70%);filter:blur(20px);animation:flE 28s ease-in-out infinite"></div>
  <svg viewBox="0 0 1440 900" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;opacity:.18;animation:drift1 30s ease-in-out infinite">
    <path d="M-40 230 C 260 130 420 350 720 250 S 1180 110 1500 240" fill="none" stroke="#7a2fe0" stroke-width="2.5"></path>
    <path d="M-40 500 C 300 420 560 600 880 520 S 1260 460 1500 560" fill="none" stroke="#1e9e45" stroke-width="2"></path>
    <path d="M-40 660 C 320 580 520 780 860 680 S 1240 580 1500 700" fill="none" stroke="#e0473a" stroke-width="2.5"></path>
    <path d="M120 60 C 380 -20 520 220 780 120" fill="none" stroke="#e89a00" stroke-width="2" stroke-dasharray="2 12" stroke-linecap="round"></path>
  </svg>
  <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(28,20,48,.06) 1px,transparent 1.4px);background-size:24px 24px;opacity:.55"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(125% 100% at 50% 24%,transparent 52%,rgba(60,30,90,.16))"></div>
</div>

<div style="position:relative;z-index:1;height:100vh;display:flex;flex-direction:column;overflow:hidden">

  <header style="flex:none;padding:14px 32px;display:flex;align-items:center;gap:22px">
    <a href="/" title="Return to MAPCO Homescreen" style="display:flex;align-items:center;gap:12px;flex:none;text-decoration:none;cursor:pointer;transition:transform .16s ease" style-hover="transform:scale(1.03)">
      <span style="width:34px;height:34px;border-radius:11px;background:rgba(122,47,224,.12);display:grid;place-items:center;color:#7a2fe0;flex:none"><i class="ph-bold ph-arrow-left" style="font-size:17px"></i></span>
      <img src="/assets/mapco-logo.png" alt="MAPCO" style="height:46px;width:auto;display:block;filter:drop-shadow(0 7px 12px rgba(90,40,150,.3))">
      <div style="line-height:1"><div style="font-size:22px;font-weight:800;letter-spacing:-.01em;color:#241833">MAPCO</div><div style="font-size:10px;font-weight:800;letter-spacing:.42em;color:#7a2fe0;margin-top:2px">MARKETING</div></div>
    </a>

    <nav style="display:flex;align-items:center;gap:3px;margin:0 auto;background:rgba(255,255,255,.55);border:1px solid rgba(122,47,224,.16);border-radius:17px;padding:5px;box-shadow:0 14px 32px -22px rgba(60,30,90,.6);backdrop-filter:blur(8px)">
      \${ (tabs || []).map(t => \`
        <button onClick="\${__b(t.go)}" style="\${t.style}">
          <i class="\${t.icon}" style="font-size:17px"></i>
          <span>\${t.label}</span>
        </button>
      \`).join('') }
    </nav>

    <div style="display:flex;align-items:center;gap:14px;flex:none">
      <div style="display:flex;align-items:center;gap:7px">
        \${ (navAccounts || []).map(a => \`
          <span style="\${a.style}"><i class="\${a.icon}" style="font-size:16px;color:\${a.color}"></i></span>
        \`).join('') }
      </div>
      <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7a2fe0,#22bf55);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;box-shadow:0 8px 18px -8px rgba(90,40,150,.6)">RC</div>
    </div>
  </header>

  <div data-scroll="" style="\${contentStyle}">

  \${ loading ? \`
    <div style="flex:1;display:grid;place-items:center;padding:60px">
      <div style="text-align:center;color:#6b5f80">
        <i class="ph-bold ph-circle-notch" style="font-size:34px;color:#7a2fe0;display:inline-block;animation:omSpin 1s linear infinite"></i>
        <div style="margin-top:14px;font-size:16px;font-weight:700">Loading your marketing workspace…</div>
      </div>
    </div>
  \` : '' }

  \${ (!loading && loadError) ? \`
    <div style="flex:1;display:grid;place-items:center;padding:60px">
      <div style="max-width:520px;text-align:center;background:#fff;border-radius:22px;padding:34px;border:1px solid rgba(224,71,58,.3);box-shadow:0 30px 60px -40px rgba(60,30,90,.6)">
        <i class="ph-fill ph-warning-circle" style="font-size:42px;color:#e0473a"></i>
        <div style="margin-top:12px;font-family:'Newsreader',serif;font-size:26px;color:#241833">This did not load</div>
        <div style="margin-top:8px;font-size:16px;line-height:1.55;color:#6b5f80">\${loadError}</div>
        <button onClick="\${__b(retry)}" style="margin-top:20px;height:46px;padding:0 22px;border-radius:13px;background:#7a2fe0;color:#fff;font-size:15.5px;font-weight:800">Try again</button>
      </div>
    </div>
  \` : '' }

  \${ (!loading && !loadError && !hasCreatives && (isToday || isReels)) ? \`
    <div style="flex:1;display:grid;place-items:center;padding:60px">
      <div style="max-width:560px;text-align:center">
        <span style="width:76px;height:76px;border-radius:24px;background:rgba(122,47,224,.1);color:#7a2fe0;display:inline-grid;place-items:center"><i class="ph-fill ph-megaphone" style="font-size:38px"></i></span>
        <div style="margin-top:18px;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.01em;color:#241833">\${emptyTitle}</div>
        <div style="margin-top:10px;font-size:16.5px;line-height:1.6;color:#6b5f80">\${emptyLine}</div>
      </div>
    </div>
  \` : '' }

  \${ (!loading && !loadError && hasCreatives && (isToday || isReels)) ? \`
  <div style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:26px;padding:4px 32px 24px;align-items:start">

    <div style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:14px">
      <div style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:9px;height:9px;border-radius:50%;background:#e0473a;box-shadow:0 0 0 4px rgba(224,71,58,.18)"></span>
          <div style="font-size:12.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#7a2fe0">\${active.kindLabel} · \${active.when}</div>
        </div>
        \${ canStep ? \`
          <div style="display:flex;align-items:center;gap:8px">
            <button onClick="\${__b(goPrev)}" title="Previous" style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.8);color:#7a2fe0;display:grid;place-items:center;border:1px solid rgba(122,47,224,.18)"><i class="ph-bold ph-caret-left" style="font-size:18px"></i></button>
            <span style="font-size:13px;font-weight:800;color:#6b5f80;min-width:62px;text-align:center">\${countLabel}</span>
            <button onClick="\${__b(goNext)}" title="Next" style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.8);color:#7a2fe0;display:grid;place-items:center;border:1px solid rgba(122,47,224,.18)"><i class="ph-bold ph-caret-right" style="font-size:18px"></i></button>
          </div>
        \` : '' }
      </div>

      <div style="width:min(420px,100%);animation:omPop .3s ease both">
        <div style="\${active.mediaStyle}">
          \${ active.isReel ? \`
            <span style="position:absolute;left:14px;top:14px;display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:11px;background:rgba(20,12,32,.72);color:#fff;font-size:13px;font-weight:800;backdrop-filter:blur(6px)"><i class="ph-fill ph-film-slate" style="font-size:15px"></i>Reel\${ active.durationLabel ? ' · ' + active.durationLabel : '' }</span>
          \` : '' }
        </div>
      </div>
    </div>

    <aside style="min-width:0;display:flex;flex-direction:column;gap:14px;background:rgba(255,255,255,.72);border:1px solid rgba(122,47,224,.16);border-radius:22px;padding:20px;box-shadow:0 26px 54px -36px rgba(60,30,90,.6);backdrop-filter:blur(8px)">
      <div>
        <div style="font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7a2fe0">Property</div>
        <div style="margin-top:5px;font-family:'Newsreader',serif;font-weight:500;font-size:25px;line-height:1.15;color:#241833">\${active.property}</div>
      </div>

      <div>
        <div style="font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7a2fe0">Caption</div>
        <div style="margin-top:6px;font-size:15.5px;line-height:1.6;color:\${ active.hasCaption ? '#241833' : '#948aa6' };white-space:pre-wrap">\${active.caption}</div>
      </div>

      <div>
        <div style="font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7a2fe0;margin-bottom:8px">Where it goes</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          \${ (channelRows || []).map(c => \`
            <div style="\${c.style}">
              <i class="\${c.icon}" style="font-size:20px;color:\${c.color};flex:none"></i>
              <div style="flex:1;min-width:0">
                <div style="font-size:14.5px;font-weight:800;color:#241833">\${c.label}</div>
                <div style="font-size:12.5px;color:#6b5f80;margin-top:1px">\${c.note}</div>
              </div>
              <span style="\${c.badgeStyle}">\${c.line}</span>
            </div>
          \`).join('') }
        </div>
      </div>

      <div style="margin-top:auto;padding-top:6px">
        <button onClick="\${__b(publish)}" style="\${publishBtnStyle}"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>\${publishLabel}</button>
        <div style="margin-top:9px;font-size:12.5px;line-height:1.5;color:#6b5f80">\${publishNote}</div>
        \${ hasQuota ? \`<div style="margin-top:10px;font-size:12.5px;font-weight:700;color:#7a2fe0">\${quotaLabel}</div>\` : '' }
      </div>
    </aside>
  </div>
  \` : '' }

  \${ (!loading && !loadError && isLibrary) ? \`
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;padding:4px 32px 24px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      \${ (libraryKinds || []).map(k => \`<button onClick="\${__b(k.go)}" style="\${k.style}">\${k.label}</button>\`).join('') }
      <span style="width:1px;height:24px;background:rgba(122,47,224,.18);margin:0 6px"></span>
      \${ (libraryProps || []).map(p => \`<button onClick="\${__b(p.go)}" style="\${p.style}">\${p.label}</button>\`).join('') }
      <span style="margin-left:auto;font-size:13px;font-weight:800;color:#6b5f80">\${libCount} item\${ libCount === 1 ? '' : 's' }</span>
    </div>

    \${ libCount === 0 ? \`
      <div style="flex:1;display:grid;place-items:center;color:#6b5f80;font-size:16px;text-align:center;padding:40px;line-height:1.6">\${libEmptyLine}</div>
    \` : \`
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:16px">
        \${ (library || []).map(item => \`
          <button onClick="\${__b(item.go)}" style="\${item.style};text-align:left;padding:0">
            <div style="\${item.thumbStyle}"></div>
            <div style="padding:11px 13px 13px">
              <div style="font-size:14.5px;font-weight:800;color:#241833;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${item.title}</div>
              <div style="margin-top:3px;font-size:12.5px;color:#6b5f80">\${item.kind} · \${item.when}</div>
            </div>
          </button>
        \`).join('') }
      </div>
    \` }
  </div>
  \` : '' }

  \${ (!loading && !loadError && isPerformance) ? \`
  <div style="flex:1;min-height:0;padding:4px 32px 24px">
    \${ hasPerformance ? \`
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
        \${ (performance || []).map(row => \`
          <div style="background:#fff;border-radius:18px;padding:18px;border:1px solid rgba(122,47,224,.14);box-shadow:0 18px 36px -30px rgba(60,30,90,.6)">
            <div style="font-size:15px;font-weight:800;color:#241833">\${row.provider}</div>
            <div style="font-size:12.5px;color:#6b5f80;margin-top:2px">\${row.scope} · \${row.period}</div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:7px">
              \${ (row.metrics || []).map(m => \`
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
                  <span style="font-size:13.5px;color:#6b5f80">\${m.name}</span>
                  <span style="font-family:'Newsreader',serif;font-size:22px;font-weight:600;color:#241833">\${m.value}</span>
                </div>
              \`).join('') }
            </div>
          </div>
        \`).join('') }
      </div>
    \` : \`
      <div style="height:100%;display:grid;place-items:center">
        <div style="max-width:520px;text-align:center">
          <span style="width:68px;height:68px;border-radius:22px;background:rgba(122,47,224,.1);color:#7a2fe0;display:inline-grid;place-items:center"><i class="ph-fill ph-chart-line-up" style="font-size:34px"></i></span>
          <div style="margin-top:16px;font-family:'Newsreader',serif;font-weight:500;font-size:30px;color:#241833">Nothing measured yet</div>
          <div style="margin-top:10px;font-size:16px;line-height:1.6;color:#6b5f80">\${noMetricsLine}</div>
        </div>
      </div>
    \` }
  </div>
  \` : '' }

  </div>

  \${ toast ? \`
    <div style="position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:40;max-width:min(620px,92vw);background:#241833;color:#fff;padding:14px 20px;border-radius:15px;font-size:15px;line-height:1.5;font-weight:600;box-shadow:0 26px 50px -24px rgba(0,0,0,.7);animation:omRise .24s ease both">\${toast}</div>
  \` : '' }

</div>
\`;
    }
  `) as (props: any) => string;

  return compiler(state);
}
