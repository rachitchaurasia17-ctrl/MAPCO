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

export function renderApp(state: any) {
  const { 
    tabs, navAccounts, contentStyle, isToday, timeOpen, timeOptions, barReady, timeChipStyle, activeTime,
    publishActive, publishBtnStyle, publishLabel, barPublishing, progressChannels, barPosted, postedLine,
    postedChannels, isReels, reelTabs, uploadBtnStyle, reelPrev, reel, reelNext, reelPending, reelPublishable,
    isLibrary, libWrapStyle, kindTabs, libCount, activeFilter, filterLabel, clearFilter, openLibFilter,
    libFilterBtnStyle, libGroups, isPerf, kpis, reachChart, donut, perfChannels, topPropStyle, topPropTitle,
    topPropLine, engagement, followerTotal, followerRows, picker, closePicker, stop, pickerItems,
    uploadOpen, closeUpload, stepLabel, quotaLabel, stepTitle, stepSub, dot1Style, dot2Style, isStep1,
    upProps, nextStep, nextStyle, isStep2, chosenPhotoStyle, chosenTitle, backStep, chooseFile, fileBtnStyle,
    fileIcon, fileTitle, fileSub, setNote, submitUpload, submitStyle, toast, postTabs, goPrev, active, goNext
  } = state;

  return `


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
    <a href="./Dealer Dashboard.dc.html" style="display:flex;align-items:center;gap:12px;flex:none;text-decoration:none" style-hover="opacity:.82">
      <img src="assets/mapco-logo.png" alt="MAPCO" style="height:36px;width:auto;display:block;filter:drop-shadow(0 7px 12px rgba(90,40,150,.3))">
      <div style="line-height:1"><div style="font-size:20px;font-weight:800;letter-spacing:-.01em;color:#241833">MAPCO</div><div style="font-size:9.5px;font-weight:800;letter-spacing:.42em;color:#7a2fe0;margin-top:2px">MARKETING</div></div>
    </a>

    <nav style="display:flex;align-items:center;gap:3px;margin:0 auto;background:rgba(255,255,255,.55);border:1px solid rgba(122,47,224,.16);border-radius:17px;padding:5px;box-shadow:0 14px 32px -22px rgba(60,30,90,.6);backdrop-filter:blur(8px)">
      ${ (tabs || []).map(t => `
        <button onClick="${t.go}" style="${t.style}">
          <i class="${t.icon}" style="font-size:17px"></i>
          <span>${t.label}</span>
        </button>
      `).join('') }
    </nav>

    <div style="display:flex;align-items:center;gap:14px;flex:none">
      <div style="display:flex;align-items:center;gap:7px">
        ${ (navAccounts || []).map(a => `
          <span style="${a.style}"><i class="${a.icon}" style="font-size:16px;color:${a.color}"></i></span>
        `).join('') }
      </div>
      <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7a2fe0,#22bf55);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;box-shadow:0 8px 18px -8px rgba(90,40,150,.6)">RC</div>
    </div>
  </header>

  <div data-scroll="" style="${contentStyle}">

  ${ isToday ? `
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;padding:0 32px 16px">

    <div style="flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 2px 10px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:9px;height:9px;border-radius:50%;background:#e0473a;box-shadow:0 0 0 4px rgba(224,71,58,.18)"></span>
        <div style="font-size:12.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#7a2fe0">Wednesday · 19 August — 2 posts ready</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex:none">
        ${ (postTabs || []).map(pt => `
          <button onClick="${pt.go}" style="${pt.style}">
            <span style="${pt.dotStyle}"></span>
            <div style="text-align:left;line-height:1.05"><div style="font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.75">Post ${pt.num}</div><div style="font-size:13.5px;font-weight:800">${pt.name}</div></div>
            ${ pt.live ? `<i class="ph-fill ph-check-circle" style="font-size:15px;color:#22c55e"></i>` : '' }
          </button>
        `).join('') }
      </div>
    </div>

    <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:14px">
      <button onClick="${goPrev}" title="Previous post" style="width:52px;height:52px;flex:none;border-radius:50%;background:rgba(255,255,255,.8);color:#7a2fe0;display:grid;place-items:center;box-shadow:0 14px 28px -14px rgba(90,40,150,.6);border:1px solid rgba(122,47,224,.18)" style-hover="background:#fff;transform:scale(1.06)"><i class="ph-bold ph-caret-left" style="font-size:22px"></i></button>

      <div style="${active.wrapStyle}">
        <div style="${active.creativeStyle}" style-hover="transform:translateY(-4px);box-shadow:0 54px 90px -34px rgba(40,15,70,.75)">
          ${ active.split ? `
            <div style="${active.photoStyle}"></div>
            <div style="position:absolute;left:0;right:0;bottom:0;height:55%;background:linear-gradient(155deg,#221a3e,#14101f);border-top-left-radius:26cqw;box-shadow:0 -30px 50px -30px rgba(0,0,0,.6);display:flex;flex-direction:column;justify-content:center;padding:2% 9% 9%;color:#fff">
              <div style="font-size:3.1cqw;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:#ffcb45">${active.eyebrow}</div>
              <div style="white-space:nowrap;font-family:'Newsreader',serif;font-weight:500;font-size:9.6cqw;line-height:1;letter-spacing:-.01em;margin-top:1.5%">${active.line1}</div>
              <div style="white-space:nowrap;font-family:'Newsreader',serif;font-weight:500;font-size:9.6cqw;line-height:1;letter-spacing:-.01em">${active.line2}</div>
              <div style="font-size:3.1cqw;font-weight:700;letter-spacing:.05em;color:#e0d6f0;margin-top:3.5%">${active.factA}</div>
              <div style="font-size:3.1cqw;font-weight:700;letter-spacing:.05em;color:#e0d6f0;margin-top:1%">${active.factB}</div>
              <div style="display:flex;gap:2%;margin-top:6%">
                ${ (active.features || []).map(f => `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;min-width:0"><i class="${f.icon}" style="font-size:5.2cqw;color:#ffcb45"></i><span style="font-size:2.2cqw;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#d4ad55;text-align:center;line-height:1.15">${f.label}</span></div>
                `).join('') }
              </div>
            </div>
            <div style="position:absolute;left:0;right:0;bottom:0;padding:1.6% 0;text-align:center;background:linear-gradient(90deg,#c8892a,#ffcb45);color:#241010;font-size:3cqw;font-weight:800;letter-spacing:.18em">${active.tagline}</div>
          ` : '' }

          ${ active.overlay ? `
            <div style="${active.photoStyle}"></div>
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(16,12,28,.96) 6%,rgba(16,12,28,.82) 46%,rgba(16,12,28,.12) 78%)"></div>
            <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;padding:0 8% 8%;color:#fff">
              <div style="font-family:'Newsreader',serif;font-weight:500;font-size:7.4cqw;letter-spacing:.02em;line-height:1">${active.line1}</div>
              <div style="font-size:3.1cqw;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#e0d6f0;margin-top:1.6%">${active.eyebrow}</div>
              <div style="font-family:'Newsreader',serif;font-weight:600;font-size:13cqw;line-height:.96;letter-spacing:-.01em;color:#ffcb45;margin-top:1.4%">${active.line2}</div>
              <div style="font-size:3.1cqw;font-weight:700;letter-spacing:.05em;color:#ece4f5;margin-top:3.4%">${active.factA}</div>
              <div style="font-size:3.1cqw;font-weight:700;letter-spacing:.05em;color:#ece4f5;margin-top:1%">${active.factB}</div>
              <div style="display:flex;gap:2%;margin-top:6%">
                ${ (active.features || []).map(f => `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;min-width:0"><i class="${f.icon}" style="font-size:5.2cqw;color:#ffcb45"></i><span style="font-size:2.2cqw;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#d4ad55;text-align:center;line-height:1.15">${f.label}</span></div>
                `).join('') }
              </div>
              <div style="display:flex;align-items:center;gap:10px;margin-top:6%"><span style="width:7%;height:1.5px;background:#c8892a"></span><span style="font-size:3cqw;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ffcb45">${active.tagline}</span></div>
            </div>
          ` : '' }

          ${ active.isPosted ? `
            <div style="position:absolute;top:0;right:0;z-index:5;display:inline-flex;align-items:center;gap:8px;padding:11px 18px 11px 15px;border-bottom-left-radius:18px;background:rgba(34,197,94,.96);color:#fff;font-size:14px;font-weight:800;animation:omPop .3s cubic-bezier(.2,.8,.2,1) both"><i class="ph-fill ph-check-circle" style="font-size:17px"></i>Live now</div>
          ` : '' }
          ${ active.isSkipped ? `
            <div style="position:absolute;inset:0;z-index:6;background:rgba(16,12,28,.72);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff"><i class="ph ph-moon-stars" style="font-size:40px;opacity:.85"></i><div style="font-size:20px;font-weight:800">Skipped for today</div><button onClick="${active.unskip}" style="padding:12px 22px;border-radius:12px;background:rgba(255,255,255,.16);color:#fff;font-size:15px;font-weight:800" style-hover="background:rgba(255,255,255,.28)">Bring it back</button></div>
          ` : '' }
        </div>
      </div>

      <button onClick="${goNext}" title="Next post" style="width:52px;height:52px;flex:none;border-radius:50%;background:rgba(255,255,255,.8);color:#7a2fe0;display:grid;place-items:center;box-shadow:0 14px 28px -14px rgba(90,40,150,.6);border:1px solid rgba(122,47,224,.18)" style-hover="background:#fff;transform:scale(1.06)"><i class="ph-bold ph-caret-right" style="font-size:22px"></i></button>
    </div>

    <div style="flex:none;max-width:1120px;width:100%;margin:12px auto 0;border-radius:20px;background:linear-gradient(120deg,rgba(255,240,196,.82),rgba(236,219,255,.82) 55%,rgba(214,251,227,.82));border:1px solid rgba(255,255,255,.7);padding:13px 18px;box-shadow:0 26px 54px -28px rgba(40,15,70,.55);backdrop-filter:blur(10px)">

      ${ timeOpen ? `
      <div style="display:flex;align-items:center;gap:9px;padding:2px 2px 13px;overflow-x:auto;animation:omRise .22s ease both">
        <span style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7a2fe0;flex:none">When?</span>
        ${ (timeOptions || []).map(o => `
          <button onClick="${o.pick}" style="${o.style}">${o.label}</button>
        `).join('') }
      </div>
      ` : '' }

      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        ${ barReady ? `
        <button onClick="${toggleTime}" style="${timeChipStyle}" style-hover="background:#fff;box-shadow:0 12px 24px -12px rgba(90,40,150,.5)"><i class="ph-fill ph-clock" style="font-size:17px;color:#e0473a"></i><span style="font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a8571e">Goes out</span><span style="font-size:14px;font-weight:800;color:#1c1430">${activeTime}</span><i class="ph-bold ph-caret-down" style="font-size:12px;color:#8a7862"></i></button>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap;min-width:0">
          ${ (active.channels || []).map(c => `
            <button onClick="${c.toggle}" title="${c.name}" style="${c.style}"><i class="${c.icon}" style="font-size:22px;color:${c.iconColor}"></i>${ c.on ? `<span style="position:absolute;top:-4px;right:-4px;width:17px;height:17px;border-radius:50%;background:#22c55e;border:2px solid #fff;display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:10px;color:#fff"></i></span>` : '' }</button>
          `).join('') }
        </div>

        <div style="flex:1"></div>
        <button onClick="${active.skip}" style="display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:11px;color:#8a7862;font-size:13px;font-weight:700;flex:none" style-hover="background:rgba(122,47,224,.08);color:#5a18c0"><i class="ph ph-moon" style="font-size:15px"></i>Not today</button>
        <button onClick="${publishActive}" style="${publishBtnStyle}" style-hover="transform:translateY(-2px);box-shadow:0 26px 46px -14px rgba(224,71,58,.7)" style-active="transform:translateY(0) scale(.99)"><i class="ph-fill ph-paper-plane-right" style="font-size:22px"></i>${publishLabel}</button>
        ` : '' }

        ${ barPublishing ? `
        <div style="font-size:16px;font-weight:800;color:#1c1430;flex:none">Sending…</div>
        <div style="display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap">
          ${ (progressChannels || []).map(c => `
            <div style="${c.style}">
              ${ c.done ? `<i class="ph-fill ph-check-circle" style="font-size:18px;color:#22c55e;animation:omCheck .4s cubic-bezier(.2,.8,.2,1) both"></i>` : '' }
              ${ c.active ? `<i class="ph-bold ph-spinner-gap" style="font-size:17px;color:#7a2fe0;animation:omSpin .8s linear infinite"></i>` : '' }
              ${ c.pending ? `<i class="${c.icon}" style="font-size:16px;color:#b8a68e"></i>` : '' }
              <span style="font-size:13px;font-weight:800;color:${c.textColor}">${c.name}</span>
            </div>
          `).join('') }
        </div>
        ` : '' }

        ${ barPosted ? `
        <span style="width:46px;height:46px;flex:none;border-radius:14px;background:rgba(34,197,94,.18);display:grid;place-items:center"><i class="ph-fill ph-check-circle" style="font-size:26px;color:#16a34a;animation:omCheck .5s cubic-bezier(.2,.8,.2,1) both"></i></span>
        <div style="flex:1;min-width:180px"><div style="font-size:16px;font-weight:800;color:#1c1430">This post is live.</div><div style="font-size:12.5px;color:#8a5a2e;margin-top:1px">${postedLine}</div></div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${ (postedChannels || []).map(c => `
            <span style="display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:11px;background:rgba(34,197,94,.14);color:#177a42;font-size:13px;font-weight:800"><i class="${c.icon}" style="font-size:15px;color:${c.color}"></i>${c.name}</span>
          `).join('') }
        </div>
        ` : '' }
      </div>
    </div>
  </div>
  ` : '' }

  ${ isReels ? `
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;padding:0 32px 16px">

    <div style="flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 2px 10px">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <span style="width:9px;height:9px;border-radius:50%;background:#7a2fe0;box-shadow:0 0 0 4px rgba(122,47,224,.18);flex:none"></span>
        
        <div style="display:flex;align-items:center;gap:8px;margin-left:6px;min-width:0">
          ${ (reelTabs || []).map(rt => `
            <button onClick="${rt.go}" style="${rt.style}">
              <span style="${rt.dotStyle}"></span>
              <div style="text-align:left;line-height:1.05"><div style="font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.75">${rt.stage}</div><div style="font-size:13.5px;font-weight:800">${rt.name}</div></div>
            </button>
          `).join('') }
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex:none">
        
        <button onClick="${openUpload}" style="${uploadBtnStyle}" style-hover="transform:translateY(-1px)"><i class="ph-bold ph-plus" style="font-size:16px"></i>Upload Video</button>
      </div>
    </div>

    <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:14px">
      <button onClick="${reelPrev}" title="Previous reel" style="width:52px;height:52px;flex:none;border-radius:50%;background:rgba(255,255,255,.8);color:#7a2fe0;display:grid;place-items:center;box-shadow:0 14px 28px -14px rgba(90,40,150,.6);border:1px solid rgba(122,47,224,.18)" style-hover="background:#fff;transform:scale(1.06)"><i class="ph-bold ph-caret-left" style="font-size:22px"></i></button>

      <div style="height:100%;min-width:0;display:flex;flex-direction:column;align-items:center;animation:omSlideX .3s cubic-bezier(.2,.8,.2,1) both">
        <div style="flex:1;min-height:0;aspect-ratio:9/16;position:relative;border-radius:26px;overflow:hidden;background:#14101f;box-shadow:0 44px 84px -34px rgba(40,15,70,.75)">
          <div style="${reel.photoStyle}"></div>
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(12,9,22,.9) 4%,rgba(12,9,22,.12) 42%,rgba(12,9,22,.45))"></div>

          ${ reel.isReady ? `
            <div style="position:absolute;top:14px;left:14px;right:14px;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              ${ reel.showStatus ? `<span style="${reel.statusPill}">${reel.eyebrow}</span>` : '' }
              <span style="margin-left:auto;flex:none;padding:6px 11px;border-radius:9px;background:rgba(12,9,22,.62);color:#fff;font-size:11.5px;font-weight:800;letter-spacing:.06em;backdrop-filter:blur(6px)">${reel.dur}</span>
            </div>
            <button onClick="${reel.togglePlay}" style="${reel.playStyle}" style-hover="transform:translate(-50%,-50%) scale(1.07)"><i class="${reel.playIcon}" style="font-size:30px;color:#1c1430;margin-left:${reel.playNudge}"></i></button>
            <div style="position:absolute;left:0;right:0;bottom:0;padding:16px 16px 18px;color:#fff">
              <div style="font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ffcb45">${reel.loc}</div>
              <div style="font-family:'Newsreader',serif;font-weight:500;font-size:21px;line-height:1.1;margin-top:2px;text-wrap:pretty">${reel.title}</div>
              <div style="font-size:11.5px;font-weight:700;color:#e0d6f0;margin-top:4px">${reel.sub}</div>
              <div style="height:4px;border-radius:3px;background:rgba(255,255,255,.24);margin-top:14px;overflow:hidden"><div style="${reel.barStyle}"></div></div>
            </div>
          ` : '' }

          ${ reel.isPending ? `
            <div style="position:absolute;inset:0;background:rgba(14,10,26,.74);backdrop-filter:blur(7px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:30px;text-align:center;color:#fff">
              <span style="width:64px;height:64px;border-radius:50%;background:rgba(255,203,69,.18);display:grid;place-items:center"><i class="${reel.stageIcon}" style="font-size:30px;color:#ffcb45"></i></span>
              <div style="font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#ffcb45">${reel.loc}</div>
              <div style="font-family:'Newsreader',serif;font-weight:500;font-size:24px;line-height:1.2;text-wrap:pretty">${reel.pendingLine}</div>
              <div style="font-size:13px;font-weight:700;color:#c9bcdf">${reel.sub}</div>
            </div>
          ` : '' }

          ${ reel.isSkipped ? `
            <div style="position:absolute;inset:0;z-index:6;background:rgba(16,12,28,.76);backdrop-filter:blur(3px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;padding:24px;text-align:center"><i class="ph ph-moon-stars" style="font-size:40px;opacity:.85"></i><div style="font-size:19px;font-weight:800">Not posting today</div><div style="font-size:12.5px;color:#c9bcdf;max-width:200px">The reel stays saved in your Library.</div><button onClick="${active.unskip}" style="padding:12px 22px;border-radius:12px;background:rgba(255,255,255,.16);color:#fff;font-size:15px;font-weight:800" style-hover="background:rgba(255,255,255,.28)">Bring it back</button></div>
          ` : '' }

          ${ reel.isPosted ? `
            <div style="position:absolute;top:0;left:0;z-index:5;display:inline-flex;align-items:center;gap:8px;padding:11px 16px 11px 14px;border-bottom-right-radius:18px;background:rgba(34,197,94,.96);color:#fff;font-size:13.5px;font-weight:800;animation:omPop .3s cubic-bezier(.2,.8,.2,1) both"><i class="ph-fill ph-check-circle" style="font-size:16px"></i>Live now</div>
          ` : '' }
        </div>
      </div>

      <button onClick="${reelNext}" title="Next reel" style="width:52px;height:52px;flex:none;border-radius:50%;background:rgba(255,255,255,.8);color:#7a2fe0;display:grid;place-items:center;box-shadow:0 14px 28px -14px rgba(90,40,150,.6);border:1px solid rgba(122,47,224,.18)" style-hover="background:#fff;transform:scale(1.06)"><i class="ph-bold ph-caret-right" style="font-size:22px"></i></button>
    </div>

    <div style="flex:none;max-width:1120px;width:100%;margin:12px auto 0;border-radius:20px;background:linear-gradient(120deg,rgba(255,240,196,.82),rgba(236,219,255,.82) 55%,rgba(214,251,227,.82));border:1px solid rgba(255,255,255,.7);padding:13px 18px;box-shadow:0 26px 54px -28px rgba(40,15,70,.55);backdrop-filter:blur(10px)">

      ${ reelPending ? `
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <span style="width:46px;height:46px;flex:none;border-radius:14px;background:rgba(122,47,224,.14);display:grid;place-items:center"><i class="${reel.stageIcon}" style="font-size:24px;color:#7a2fe0"></i></span>
        <div style="flex:1;min-width:200px"><div style="font-size:16px;font-weight:800;color:#1c1430">${reel.pendingLine}</div><div style="font-size:12.5px;color:#8a5a2e;margin-top:1px">Publishing options appear here once MAPCO marks it ready.</div></div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          ${ (reel.steps || []).map(st => `
            <span style="${st.style}"><i class="${st.icon}" style="font-size:14px"></i>${st.label}</span>
          `).join('') }
        </div>
      </div>
      ` : '' }

      ${ reelPublishable ? `
      <div>
        ${ timeOpen ? `
        <div style="display:flex;align-items:center;gap:9px;padding:2px 2px 13px;overflow-x:auto;animation:omRise .22s ease both">
          <span style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7a2fe0;flex:none">When?</span>
          ${ (timeOptions || []).map(o => `
            <button onClick="${o.pick}" style="${o.style}">${o.label}</button>
          `).join('') }
        </div>
        ` : '' }

        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          ${ barReady ? `
          <button onClick="${toggleTime}" style="${timeChipStyle}" style-hover="background:#fff;box-shadow:0 12px 24px -12px rgba(90,40,150,.5)"><i class="ph-fill ph-clock" style="font-size:17px;color:#e0473a"></i><span style="font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a8571e">Goes out</span><span style="font-size:14px;font-weight:800;color:#1c1430">${activeTime}</span><i class="ph-bold ph-caret-down" style="font-size:12px;color:#8a7862"></i></button>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap;min-width:0">
            ${ (active.channels || []).map(c => `
              <button onClick="${c.toggle}" title="${c.name}" style="${c.style}"><i class="${c.icon}" style="font-size:22px;color:${c.iconColor}"></i>${ c.on ? `<span style="position:absolute;top:-4px;right:-4px;width:17px;height:17px;border-radius:50%;background:#22c55e;border:2px solid #fff;display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:10px;color:#fff"></i></span>` : '' }</button>
            `).join('') }
            <span style="font-size:11.5px;font-weight:700;color:#8a7862;max-width:150px;line-height:1.2">Reels post to Instagram &amp; Facebook</span>
          </div>

          <div style="flex:1"></div>
          <button onClick="${active.skip}" style="display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:11px;color:#8a7862;font-size:13px;font-weight:700;flex:none" style-hover="background:rgba(122,47,224,.08);color:#5a18c0"><i class="ph ph-moon" style="font-size:15px"></i>Not today</button>
          <button onClick="${publishActive}" style="${publishBtnStyle}" style-hover="transform:translateY(-2px);box-shadow:0 26px 46px -14px rgba(224,71,58,.7)" style-active="transform:translateY(0) scale(.99)"><i class="ph-fill ph-paper-plane-right" style="font-size:22px"></i>${publishLabel}</button>
          ` : '' }

          ${ barPublishing ? `
          <div style="font-size:16px;font-weight:800;color:#1c1430;flex:none">Sending…</div>
          <div style="display:flex;align-items:center;gap:10px;flex:1;flex-wrap:wrap">
            ${ (progressChannels || []).map(c => `
              <div style="${c.style}">
                ${ c.done ? `<i class="ph-fill ph-check-circle" style="font-size:18px;color:#22c55e;animation:omCheck .4s cubic-bezier(.2,.8,.2,1) both"></i>` : '' }
                ${ c.active ? `<i class="ph-bold ph-spinner-gap" style="font-size:17px;color:#7a2fe0;animation:omSpin .8s linear infinite"></i>` : '' }
                ${ c.pending ? `<i class="${c.icon}" style="font-size:16px;color:#b8a68e"></i>` : '' }
                <span style="font-size:13px;font-weight:800;color:${c.textColor}">${c.name}</span>
              </div>
            `).join('') }
          </div>
          ` : '' }

          ${ barPosted ? `
          <span style="width:46px;height:46px;flex:none;border-radius:14px;background:rgba(34,197,94,.18);display:grid;place-items:center"><i class="ph-fill ph-check-circle" style="font-size:26px;color:#16a34a;animation:omCheck .5s cubic-bezier(.2,.8,.2,1) both"></i></span>
          <div style="flex:1;min-width:180px"><div style="font-size:16px;font-weight:800;color:#1c1430">This reel is live.</div><div style="font-size:12.5px;color:#8a5a2e;margin-top:1px">${postedLine}</div></div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${ (postedChannels || []).map(c => `
              <span style="display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:11px;background:rgba(34,197,94,.14);color:#177a42;font-size:13px;font-weight:800"><i class="${c.icon}" style="font-size:15px;color:${c.color}"></i>${c.name}</span>
            `).join('') }
          </div>
          ` : '' }
        </div>
      </div>
      ` : '' }
    </div>
  </div>
  ` : '' }

  ${ isLibrary ? `
  <div style="${libWrapStyle}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7a2fe0">The archive</div>
        <div style="display:flex;align-items:center;gap:3px;background:rgba(255,255,255,.58);border:1px solid rgba(122,47,224,.16);border-radius:13px;padding:4px;box-shadow:0 12px 26px -20px rgba(60,30,90,.6)">
          ${ (kindTabs || []).map(kt => `
            <button onClick="${kt.go}" style="${kt.style}"><i class="${kt.icon}" style="font-size:14px"></i>${kt.label}</button>
          `).join('') }
        </div>
        <span style="width:5px;height:5px;border-radius:50%;background:#c8a24e"></span>
        <div style="font-size:14px;font-weight:800;color:#5a3a1c">${libCount}</div>
        ${ activeFilter ? `
          <span style="display:inline-flex;align-items:center;gap:7px;padding:6px 8px 6px 13px;border-radius:11px;background:#1c1430;color:#ffcb45;font-size:12.5px;font-weight:800">${filterLabel}<button onClick="${clearFilter}" style="width:20px;height:20px;border-radius:7px;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center" style-hover="background:rgba(255,255,255,.3)"><i class="ph-bold ph-x" style="font-size:11px"></i></button></span>
        ` : '' }
      </div>
      <button onClick="${openLibFilter}" style="${libFilterBtnStyle}" style-hover="background:#fff;box-shadow:0 12px 26px -14px rgba(90,40,150,.5)"><i class="ph-fill ph-funnel" style="font-size:16px;color:#7a2fe0"></i>Filter by property<i class="ph-bold ph-caret-down" style="font-size:12px;color:#8a7862"></i></button>
    </div>

    ${ (libGroups || []).map(g => `
      <div style="${g.wrapStyle}">
        ${ g.showHeader ? `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:15px">
          <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#1c1430">${g.label}</div>
          <div style="font-size:12.5px;font-weight:800;color:#a8571e">${g.date}</div>
          <div style="flex:1;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(122,47,224,.32),transparent)"></div>
          <div style="font-size:12px;font-weight:800;color:#7a6a55">${g.count}</div>
        </div>
        ` : '' }
        ${ g.hasReels ? `
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:26px;margin:0 auto 8px;max-width:calc(max((100vh - 310px) * 9 / 16, 250px) * 2 + 30px)">
          ${ (g.reels || []).map(r => `
            <div style="width:max(calc((100vh - 310px) * 9 / 16), 250px);animation:omRise .4s cubic-bezier(.2,.8,.2,1) both">
              <div style="${r.mediaStyle}">
                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(12,9,22,.88) 2%,rgba(12,9,22,.05) 40%,rgba(12,9,22,.4))"></div>
                <span style="${r.statusStyle}"><i class="${r.statusIcon}" style="font-size:12px"></i>${r.statusLabel}</span>
                <span style="position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:11px;background:#fff;display:grid;place-items:center;z-index:2;box-shadow:0 6px 14px -6px rgba(0,0,0,.4)"><i class="${r.chanIcon}" style="font-size:16px;color:${r.chanColor}"></i></span>
                <button onClick="${r.play}" title="Play reel" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:78px;height:78px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;box-shadow:0 18px 38px -14px rgba(0,0,0,.7);transition:transform .18s" style-hover="transform:translate(-50%,-50%) scale(1.07)"><i class="ph-fill ph-play" style="font-size:31px;color:#1c1430;margin-left:4px"></i></button>
                <div style="position:absolute;left:0;right:0;bottom:0;padding:20px 22px 22px;color:#fff;display:flex;align-items:flex-end;gap:10px">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffcb45">${r.loc}</div>
                    <div style="font-family:'Newsreader',serif;font-weight:500;font-size:27px;line-height:1.05;margin-top:3px;text-wrap:pretty">${r.title}</div>
                  </div>
                  <span style="flex:none;padding:6px 11px;border-radius:9px;background:rgba(12,9,22,.66);color:#fff;font-size:12px;font-weight:800;backdrop-filter:blur(6px)">${r.dur}</span>
                </div>
              </div>
              <div style="border-radius:0 0 24px 24px;background:rgba(255,255,255,.66);border:1px solid rgba(122,47,224,.16);border-top:none;padding:11px 14px 13px;box-shadow:0 22px 44px -34px rgba(40,15,70,.6)">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#8a5a2e"><i class="ph-fill ph-calendar-blank" style="font-size:13px;color:#c8892a"></i>${r.when}</span>
                  <button onClick="${r.reuse}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;background:rgba(122,47,224,.14);color:#5a18c0;font-size:12px;font-weight:800" style-hover="background:rgba(122,47,224,.24)"><i class="ph-bold ph-arrow-clockwise" style="font-size:12px"></i>Reuse</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
                  ${ (r.stats || []).map(st => `
                    <div style="flex:1;min-width:0;border-radius:11px;background:rgba(255,255,255,.72);border:1px solid ${st.bd};padding:9px 4px;text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:5px"><i class="${st.icon}" style="font-size:14px;color:${st.fg}"></i><span style="font-size:16px;font-weight:800;color:#1c1430">${st.value}</span></div><div style="font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7a6a55;margin-top:2px">${st.label}</div></div>
                  `).join('') }
                </div>
              </div>
            </div>
          `).join('') }
        </div>
        ` : '' }

        ${ g.hasPosts ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
          ${ (g.posts || []).map(a => `
            <div style="${a.cardStyle}">
              <div style="${a.photoStyle}">
                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(16,12,28,.82),transparent 58%)"></div>
                <span style="${a.chipStyle}"><i class="${a.chanIcon}" style="font-size:16px;color:${a.chanColor}"></i></span>
                <span style="${a.statusStyle}"><i class="${a.statusIcon}" style="font-size:12px"></i>${a.statusLabel}</span>
                <div style="position:absolute;left:0;right:0;bottom:0;padding:18px 20px;color:#fff">
                  <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffcb45">${a.loc}</div>
                  <div style="font-family:'Newsreader',serif;font-weight:500;font-size:27px;line-height:1.05;margin-top:3px">${a.title}</div>
                </div>
              </div>
              <div style="padding:16px 18px 17px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:#8a5a2e"><i class="ph-fill ph-calendar-blank" style="font-size:14px;color:#c8892a"></i>${a.when}</span><button onClick="${a.reuse}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:10px;background:rgba(122,47,224,.14);color:#5a18c0;font-size:12.5px;font-weight:800" style-hover="background:rgba(122,47,224,.24)"><i class="ph-bold ph-arrow-clockwise" style="font-size:13px"></i>Reuse</button></div>
                <div style="display:flex;align-items:center;gap:9px;margin-top:14px">
                  ${ (a.stats || []).map(st => `
                    <div style="flex:1;min-width:0;border-radius:13px;background:${st.bg};padding:12px 6px;text-align:center;border:1px solid ${st.bd}"><div style="display:flex;align-items:center;justify-content:center;gap:5px"><i class="${st.icon}" style="font-size:15px;color:${st.fg}"></i><span style="font-size:18px;font-weight:800;color:#1c1430">${st.value}</span></div><div style="font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7a6a55;margin-top:3px">${st.label}</div></div>
                  `).join('') }
                </div>
              </div>
            </div>
          `).join('') }
        </div>
        ` : '' }
      </div>
    `).join('') }
  </div>
  ` : '' }

  ${ isPerf ? `
  <div style="max-width:1200px;margin:0 auto;padding:16px 34px 56px;width:100%">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:12px"><div style="font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7a2fe0">Performance</div><span style="width:5px;height:5px;border-radius:50%;background:#c8a24e"></span><div style="font-size:14px;font-weight:800;color:#5a3a1c">Last 30 days</div></div>
      <div style="display:flex;align-items:center;gap:8px;padding:11px 15px;border-radius:13px;background:rgba(255,255,255,.6);border:1px solid rgba(122,47,224,.14);font-size:12.5px;font-weight:800;color:#7a6a55"><i class="ph ph-link" style="font-size:15px;color:#7a2fe0"></i>Pulled from your connected accounts</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px">
      ${ (kpis || []).map(k => `
        <div style="${k.cardStyle}">
          <div style="display:flex;align-items:center;justify-content:space-between"><span style="width:38px;height:38px;border-radius:12px;background:${k.bg};color:${k.fg};display:grid;place-items:center"><i class="${k.icon}" style="font-size:20px"></i></span><span style="font-size:12px;font-weight:800;color:#16a34a">${k.delta}</span></div>
          <div style="font-family:'Newsreader',serif;font-size:42px;font-weight:500;color:#1c1430;line-height:1;margin-top:14px">${k.value}</div>
          <div style="font-size:12.5px;font-weight:700;color:#5a4a38;margin-top:4px">${k.label}</div>
        </div>
      `).join('') }
    </div>

    <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:16px;margin-top:16px">
      <div style="border-radius:24px;background:linear-gradient(160deg,#251b40,#151020);border:1px solid rgba(122,47,224,.4);padding:22px 24px;box-shadow:0 28px 58px -32px rgba(20,10,40,.8);position:relative;overflow:hidden">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><div><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffcb45">Reach over 30 days</div><div style="font-size:16px;font-weight:800;color:#fff;margin-top:4px">8,400 people · up 38% this month</div></div><div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#ffd873"><span style="width:14px;height:5px;border-radius:3px;background:linear-gradient(90deg,#ffd24d,#ff6b5c)"></span>Daily reach</div></div>
        <div style="margin-top:12px" data-om-raster="">${reachChart}</div>
      </div>

      <div style="border-radius:24px;background:linear-gradient(150deg,#ecdbff,#d3b8fa);border:1px solid rgba(122,47,224,.28);padding:22px 24px;display:flex;flex-direction:column;box-shadow:0 24px 50px -34px rgba(90,40,150,.5)">
        <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#5a18c0">Reach by channel</div>
        <div style="display:flex;align-items:center;gap:22px;margin-top:14px;flex:1">
          <div data-om-raster="" style="flex:none">${donut}</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:14px">
            ${ (perfChannels || []).map(c => `
              <div style="display:flex;align-items:center;gap:11px"><span style="width:14px;height:14px;border-radius:5px;background:${c.color};flex:none;box-shadow:0 3px 8px -3px ${c.color}"></span><span style="flex:1;font-size:14.5px;font-weight:800;color:#2a1e3d">${c.name}</span><span style="font-size:13px;font-weight:700;color:#7a6a8e">${c.reach}</span><span style="font-size:15px;font-weight:800;color:#1c1430;min-width:38px;text-align:right">${c.pct}</span></div>
            `).join('') }
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px">
      <div style="border-radius:22px;overflow:hidden;background:linear-gradient(150deg,#fff0c4,#ffd873);border:1px solid rgba(230,150,0,.35);box-shadow:0 24px 50px -34px rgba(230,150,0,.5)">
        <div style="${topPropStyle}"><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(16,12,28,.85),transparent 60%)"></div><div style="position:absolute;left:16px;right:16px;bottom:14px;color:#fff"><div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffcb45">Most-viewed property</div><div style="font-family:'Newsreader',serif;font-size:23px;font-weight:500;margin-top:2px">${topPropTitle}</div></div></div>
        <div style="padding:16px 18px;font-size:13.5px;font-weight:600;color:#6a4a1e;line-height:1.45">${topPropLine}</div>
      </div>

      <div style="border-radius:22px;background:linear-gradient(150deg,#dbfbe3,#8ce9a8);border:1px solid rgba(30,158,69,.3);padding:22px 24px;box-shadow:0 24px 50px -34px rgba(30,158,69,.5)">
        <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#166534">Engagement · from the platforms</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 10px;margin-top:16px">
          ${ (engagement || []).map(e => `
            <div style="display:flex;align-items:center;gap:10px"><span style="width:38px;height:38px;flex:none;border-radius:12px;background:${e.bg};color:${e.fg};display:grid;place-items:center"><i class="${e.icon}" style="font-size:18px"></i></span><div><div style="font-size:20px;font-weight:800;color:#1c1430;line-height:1">${e.value}</div><div style="font-size:11px;font-weight:700;color:#3a4d38">${e.label}</div></div></div>
          `).join('') }
        </div>
      </div>

      <div style="border-radius:22px;background:linear-gradient(150deg,#ffe3de,#ffb9b0);border:1px solid rgba(224,71,58,.3);padding:22px 24px;box-shadow:0 24px 50px -34px rgba(224,71,58,.5);display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c0402e">Follower growth</div><div style="font-size:13px;font-weight:800;color:#16a34a">${followerTotal}</div></div>
        <div style="display:flex;flex-direction:column;gap:16px;margin-top:18px;flex:1;justify-content:center">
          ${ (followerRows || []).map(r => `
            <div>
              <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px"><i class="${r.icon}" style="font-size:18px;color:${r.color}"></i><span style="flex:1;font-size:13.5px;font-weight:800;color:#2a1e3d">${r.name}</span><span style="font-size:15px;font-weight:800;color:#1c1430">${r.val}</span></div>
              <div style="height:9px;border-radius:6px;background:rgba(255,255,255,.55);overflow:hidden"><div style="${r.barStyle}"></div></div>
            </div>
          `).join('') }
        </div>
        <div style="font-size:11.5px;font-weight:700;color:#8a4a42;margin-top:14px">Net new followers across Instagram &amp; Facebook this month.</div>
      </div>
    </div>
  </div>
  ` : '' }

  </div>

  ${ picker ? `
  <div onClick="${closePicker}" style="position:fixed;inset:0;z-index:80;background:rgba(24,16,40,.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:32px;animation:omRise .2s ease both">
    <div onClick="${stop}" style="width:min(680px,100%);max-height:82vh;overflow-y:auto;border-radius:24px;background:linear-gradient(160deg,#fff6ec,#fdeefb);border:1px solid rgba(122,47,224,.18);box-shadow:0 40px 80px -30px rgba(24,16,40,.6);padding:26px 28px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7a2fe0">Filter by property</div><div style="font-size:21px;font-weight:800;color:#1c1430;margin-top:2px">Show posts for one property</div></div>
        <button onClick="${closePicker}" style="width:38px;height:38px;border-radius:11px;background:rgba(122,47,224,.1);color:#6a5b48;display:grid;place-items:center" style-hover="background:rgba(122,47,224,.2)"><i class="ph-bold ph-x" style="font-size:18px"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px">
        ${ (pickerItems || []).map(i => `
          <button onClick="${i.choose}" style="${i.style}" style-hover="border-color:#7a2fe0;transform:translateY(-2px)">
            <div style="${i.photoStyle}">${ i.isAll ? `<i class="ph-fill ph-squares-four" style="font-size:22px;color:#fff"></i>` : '' }</div>
            <div style="flex:1;min-width:0;text-align:left"><div style="font-size:14px;font-weight:800;color:#1c1430;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.title}</div><div style="font-size:12px;color:#8a7862">${i.sub}</div></div>
            ${ i.current ? `<span style="padding:4px 8px;border-radius:7px;background:rgba(230,173,69,.25);color:#a8571e;font-size:10px;font-weight:800;flex:none">CURRENT</span>` : '' }
          </button>
        `).join('') }
      </div>
    </div>
  </div>
  ` : '' }

  ${ uploadOpen ? `
  <div onClick="${closeUpload}" style="position:fixed;inset:0;z-index:85;background:rgba(24,16,40,.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:32px;animation:omRise .2s ease both">
    <div onClick="${stop}" style="width:min(560px,100%);max-height:86vh;overflow-y:auto;border-radius:24px;background:linear-gradient(160deg,#fff6ec,#fdeefb);border:1px solid rgba(122,47,224,.18);box-shadow:0 40px 80px -30px rgba(24,16,40,.6);padding:26px 28px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7a2fe0">${stepLabel} · ${quotaLabel}</div><div style="font-size:22px;font-weight:800;color:#1c1430;margin-top:3px">${stepTitle}</div><div style="font-size:13px;font-weight:600;color:#8a7862;margin-top:4px;max-width:400px">${stepSub}</div></div>
        <button onClick="${closeUpload}" style="width:38px;height:38px;flex:none;border-radius:11px;background:rgba(122,47,224,.1);color:#6a5b48;display:grid;place-items:center" style-hover="background:rgba(122,47,224,.2)"><i class="ph-bold ph-x" style="font-size:18px"></i></button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-top:18px">
        <span style="${dot1Style}"></span>
        <span style="${dot2Style}"></span>
      </div>

      ${ isStep1 ? `
      <div style="margin-top:18px;animation:omRise .22s ease both">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
          ${ (upProps || []).map(p => `
            <button onClick="${p.pick}" style="${p.style}" style-hover="border-color:#7a2fe0">
              <div style="${p.photoStyle}"></div>
              <div style="flex:1;min-width:0;text-align:left"><div style="font-size:13.5px;font-weight:800;color:#1c1430;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.title}</div><div style="font-size:11.5px;color:#8a7862;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.sub}</div></div>
              ${ p.on ? `<i class="ph-fill ph-check-circle" style="font-size:18px;color:#22c55e;flex:none"></i>` : '' }
            </button>
          `).join('') }
        </div>
        <button onClick="${nextStep}" style="${nextStyle}" style-hover="transform:translateY(-2px)">Continue<i class="ph-bold ph-arrow-right" style="font-size:18px"></i></button>
      </div>
      ` : '' }

      ${ isStep2 ? `
      <div style="margin-top:18px;animation:omRise .22s ease both">
        <div style="display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.7);border:1px solid rgba(122,47,224,.14)">
          <div style="${chosenPhotoStyle}"></div>
          <div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a8571e">Property</div><div style="font-size:14px;font-weight:800;color:#1c1430">${chosenTitle}</div></div>
          <button onClick="${backStep}" style="padding:7px 12px;border-radius:9px;background:rgba(122,47,224,.12);color:#5a18c0;font-size:12px;font-weight:800" style-hover="background:rgba(122,47,224,.22)">Change</button>
        </div>

        <button onClick="${chooseFile}" style="${fileBtnStyle}" style-hover="border-color:#7a2fe0;background:rgba(255,255,255,.92)">
          <span style="width:44px;height:44px;flex:none;border-radius:13px;background:rgba(122,47,224,.12);display:grid;place-items:center"><i class="${fileIcon}" style="font-size:22px;color:#7a2fe0"></i></span>
          <div style="text-align:left"><div style="font-size:14.5px;font-weight:800;color:#1c1430">${fileTitle}</div><div style="font-size:12px;color:#8a7862;margin-top:1px">${fileSub}</div></div>
        </button>

        <div style="margin-top:18px">
          <div style="font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a8571e">Note for the MAPCO team <span style="font-weight:700;letter-spacing:0;text-transform:none;color:#a99a86">· optional</span></div>
          <textarea onInput="${setNote}" placeholder="Anything we should know? e.g. show the park side first." style="width:100%;margin-top:10px;min-height:64px;resize:vertical;padding:13px 15px;border-radius:14px;border:1.5px solid rgba(122,47,224,.16);background:rgba(255,255,255,.8);font-size:14px;font-weight:600;color:#1c1430;outline:none"></textarea>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin-top:20px">
          <button onClick="${backStep}" style="display:inline-flex;align-items:center;gap:7px;padding:16px 18px;border-radius:16px;background:rgba(122,47,224,.1);color:#5a18c0;font-size:15px;font-weight:800;flex:none" style-hover="background:rgba(122,47,224,.2)"><i class="ph-bold ph-arrow-left" style="font-size:17px"></i>Back</button>
          <button onClick="${submitUpload}" style="${submitStyle}" style-hover="transform:translateY(-2px)"><i class="ph-fill ph-paper-plane-right" style="font-size:20px"></i>Submit video</button>
        </div>
      </div>
      ` : '' }
    </div>
  </div>
  ` : '' }

  ${ toast ? `
  <div style="position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:90;display:flex;align-items:center;gap:11px;padding:15px 22px;border-radius:15px;background:#1c1430;color:#f3ecff;font-size:14.5px;font-weight:700;box-shadow:0 24px 48px -18px rgba(28,15,56,.85);animation:omRise .26s ease both"><i class="ph-fill ph-check-circle" style="font-size:20px;color:#ffcb45"></i>${toast}</div>
  ` : '' }

</div>
`;
}

