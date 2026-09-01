// @ts-nocheck
export const globalHead = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&amp;family=Hanken+Grotesk:wght@400;500;600;700;800&amp;display=swap"
        rel="stylesheet">
      <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
      <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css">
      <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css">
      <script src="./image-slot.js"></script>
      <style>
        * {
          box-sizing: border-box
        }

        html,
        body {
          margin: 0;
          padding: 0
        }

        body {
          background: #f5efff;
          background-image: radial-gradient(62% 50% at -2% -4%, rgba(139, 96, 232, .5), transparent 62%), radial-gradient(54% 44% at 101% 4%, rgba(56, 138, 186, .4), transparent 62%), radial-gradient(66% 48% at 46% 108%, rgba(255, 190, 48, .44), transparent 64%), radial-gradient(40% 34% at 86% 66%, rgba(236, 120, 168, .22), transparent 68%);
          background-attachment: fixed;
          color: #241f1c;
          font-family: 'Hanken Grotesk', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility
        }

        a {
          color: #d95d1e;
          text-decoration: none
        }

        a:hover {
          color: #bd4d16
        }

        ::selection {
          background: #f8a800;
          color: #241f1c
        }

        button {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit
        }

        input,
        select,
        textarea {
          font-family: inherit
        }

        [data-scroll]::-webkit-scrollbar {
          width: 11px;
          height: 11px
        }

        [data-scroll]::-webkit-scrollbar-thumb {
          background: #d8d1c1;
          border-radius: 9px;
          border: 3px solid transparent;
          background-clip: content-box
        }

        [data-scroll]::-webkit-scrollbar-track {
          background: transparent
        }

        image-slot {
          --radius: 14px
        }

        @keyframes omRise {
          from {
            opacity: 0;
            transform: translateY(18px)
          }

          to {
            opacity: 1;
            transform: none
          }
        }

        @keyframes omSlide {
          from {
            opacity: 0;
            transform: translateX(34px)
          }

          to {
            opacity: 1;
            transform: none
          }
        }

        @keyframes omPop {
          from {
            opacity: 0;
            transform: scale(.96)
          }

          to {
            opacity: 1;
            transform: none
          }
        }

        @keyframes omVeil {
          from {
            opacity: 0
          }

          to {
            opacity: 1
          }
        }

        @keyframes barGrow {
          from {
            transform: scaleX(0)
          }

          to {
            transform: scaleX(1)
          }
        }

        @keyframes omGlow {

          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(240, 168, 60, .45)
          }

          50% {
            box-shadow: 0 0 0 10px rgba(240, 168, 60, 0)
          }
        }

        @keyframes dashDraw {
          from {
            stroke-dashoffset: 440
          }
        }

        @keyframes moneyWash {
          from {
            opacity: 0
          }

          to {
            opacity: 1
          }
        }

        @keyframes moneyHalo {

          0%,
          100% {
            transform: scale(1);
            opacity: .42
          }

          50% {
            transform: scale(1.3);
            opacity: .12
          }
        }

        @keyframes moneyRise {
          0% {
            transform: translateY(10vh) rotate(-6deg);
            opacity: 0
          }

          14% {
            opacity: .85
          }

          100% {
            transform: translateY(-115vh) rotate(18deg);
            opacity: 0
          }
        }

        @keyframes stampIn {
          0% {
            transform: scale(2.5) rotate(-16deg);
            opacity: 0
          }

          62% {
            transform: scale(.95) rotate(-7deg);
            opacity: 1
          }

          100% {
            transform: scale(1) rotate(-7deg);
            opacity: 1
          }
        }

        @keyframes moneyUp {
          from {
            opacity: 0;
            transform: translateY(26px)
          }

          to {
            opacity: 1;
            transform: none
          }
        }

        @keyframes noteFloat {
          0% {
            transform: translateY(30%) rotate(-10deg);
            opacity: 0
          }

          14% {
            opacity: .55
          }

          100% {
            transform: translateY(-320%) rotate(16deg);
            opacity: 0
          }
        }

        @keyframes moneyShine {
          0% {
            transform: translateX(-140%) skewX(-18deg)
          }

          55%,
          100% {
            transform: translateX(150%) skewX(-18deg)
          }
        }

        @keyframes coinPop {
          from {
            transform: scale(.84) translateY(10px);
            opacity: 0
          }

          to {
            transform: none;
            opacity: 1
          }
        }

        @keyframes coinShimmer {

          0%,
          100% {
            box-shadow: inset 0 2px 0 rgba(255, 255, 255, .7), inset 0 -6px 12px rgba(140, 90, 0, .45), 0 12px 26px -12px rgba(0, 0, 0, .6)
          }

          50% {
            box-shadow: inset 0 2px 0 rgba(255, 255, 255, .95), inset 0 -6px 12px rgba(140, 90, 0, .35), 0 16px 32px -12px rgba(0, 0, 0, .55)
          }
        }
      </style>
    `;

export function renderApp(state: any) {
  const compiler = new Function('props', `
    with (props) {
      return \`
    
    <div ref="\${shellRef}"
      style="display:flex;height:100vh;min-height:0;width:100%;overflow:hidden;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">

      <aside ref="\${asideRef}"
        style="width:212px;flex:none;height:100%;min-height:0;overflow:hidden;background:rgba(252,250,255,.82);background-image:linear-gradient(180deg,rgba(253,251,255,.95),rgba(243,236,255,.76) 55%,rgba(236,227,255,.66));backdrop-filter:blur(16px);box-shadow:inset -1px 0 0 rgba(88,52,168,.14);display:flex;flex-direction:column;border-right:1px solid #ddd2f5">
        <a href="/" title="Back to Homescreen" style="display:flex;align-items:center;gap:11px;padding:18px 16px 14px;text-decoration:none;cursor:pointer;transition:transform .15s" style-hover="transform:scale(1.03)">
          <img src="/assets/mapco-logo.png" alt="MAPCO" style="width:44px;height:auto;flex:none;display:block;mix-blend-mode:multiply;filter:drop-shadow(0 4px 10px rgba(90,40,150,.25))">
          <div style="\${logoTextStyle}">MAPCO</div>
        </a>
        <nav data-scroll=""
          style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:3px;padding:4px 11px 8px">
          \${ (navItems || []).map(n => \`
            <button onClick="\${__b(n.go)}" style="\${n.style}" style-hover="background:#fdefc9;color:#1f1a12">
              <i class="\${n.icon}" style="font-size:23px;line-height:1;width:25px;text-align:center"></i>
              <span style="font-size:17.5px;font-weight:700;letter-spacing:-.01em">\${n.label}</span>
              <span style="\${n.badgeStyle}">\${n.badge}</span>
            </button>
          \`).join('') }
        </nav>
        <div
          style="flex:none;display:flex;align-items:center;gap:10px;padding:11px 14px 14px;border-top:1px solid #ddd2f5">
          <div
            style="width:36px;height:36px;border-radius:50%;background:#f8a800;color:#3a2410;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none">
            \${ownerInitials}</div>
          <div style="min-width:0;flex:1">
            <div style="\${ownerNameStyle}">\${ownerName}</div>
            <div style="\${bizNameStyle}">\${bizName}</div>
          </div>
          <i class="ph ph-gear-six" style="\${gearStyle}"></i>
        </div>
      </aside>

      <main style="flex:1;min-width:0;min-height:0;display:flex;flex-direction:column">


        <div data-scroll="" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden">

          \${ isDeals ? \`
            <div style="max-width:1680px;margin:0 auto;padding:20px 40px 70px">

              <div
                style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                <div style="\${dealSegWrap}">
                  \${ (dvTabs || []).map(t => \`<button onClick="\${__b(t.go)}"
                      style="\${t.style}"><i class="\${t.icon}" style="font-size:19px"></i>\${t.label}<span
                        style="\${t.num}">\${t.count}</span></button>\`).join('') }
                </div>
                <div style="flex:1"></div>
                <label
                  style="display:flex;align-items:center;gap:10px;width:280px;height:52px;padding:0 16px;border-radius:15px;background:#fff8e6;box-shadow:inset 0 0 0 1.5px #f0d493">
                  <i class="ph-bold ph-magnifying-glass" style="font-size:19px;color:#a3541b"></i>
                  <input value="\${dealSearch}" onInput="\${__b(onDealSearch)}" placeholder="Buyer or property…"
                    style="border:none;outline:none;background:none;width:100%;font-size:16px;font-weight:600;color:#241f1c">
                </label>
                <button onClick="\${__b(openAdd)}"
                  style="display:flex;align-items:center;gap:9px;height:52px;padding:0 22px;border-radius:15px;background:#f8a800;color:#241d0c;white-space:nowrap;font-size:16.5px;font-weight:800;box-shadow:0 12px 24px -14px rgba(248,168,0,.95)"
                  style-hover="background:#e69a00"><i class="ph-bold ph-plus" style="font-size:19px"></i>Start a
                  deal</button>
              </div>

              <div style="\${dSumWrap}">
                \${ (dSummary || []).map(k => \`
                  <div style="flex:1 1 200px;min-width:170px">
                    <div style="\${k.label}">\${k.title}</div>
                    <div style="\${k.valStyle}">\${k.value}</div>
                    <div style="\${k.subStyle}">\${k.sub}</div>
                  </div>
                \`).join('') }
              </div>

              \${ dvActive ? \`
                <div
                  style="display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:16px;margin-top:20px">
                  \${ (activeDeals || []).map(d => \`
                    <div style="\${d.cardStyle}">
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">

                        \${ d.hasNote ? \`\` : '' }
                      </div>

                      <button onClick="\${__b(d.open)}" style="display:block;width:100%;text-align:left;margin-top:14px"
                        style-hover="opacity:.75">
                        <span
                          style="display:block;font-size:24px;font-weight:800;color:#241f1c;line-height:1.2;text-wrap:balance">\${d.buyer}</span>
                        <span
                          style="display:flex;align-items:center;gap:8px;font-size:16.5px;font-weight:700;color:#7a6f60;margin-top:4px"><i
                            class="ph-fill ph-buildings" style="font-size:18px;color:#1a5aa8;flex:none"></i>\${d.propTitle}</span>
                        <span
                          style="display:block;font-size:15.5px;font-weight:600;color:#8a7f6e;margin-top:1px;padding-left:26px">\${d.propLoc}</span>
                      </button>

                      <div style="\${d.moneyStyle}">
                        <div style="flex:1;min-width:120px">
                          <div
                            style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e">
                            Deal price</div>
                          <div
                            style="font-family:'Newsreader',serif;font-weight:600;font-size:31px;line-height:1.05;color:#241f1c">
                            \${d.priceFmt}</div>
                        </div>
                        <div style="flex:1;min-width:120px;text-align:right">
                          <div
                            style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0a6634">
                            Your commission</div>
                          <div
                            style="font-family:'Newsreader',serif;font-weight:600;font-size:31px;line-height:1.05;color:#0a6634">
                            \${d.commFmt}</div>
                        </div>
                      </div>



                      <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
                        <button onClick="\${__b(d.update)}"
                          style="display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:54px;border-radius:15px;background:#241d0c;color:#f8c200;font-size:17px;font-weight:800"
                          style-hover="background:#3a2f14"><i class="ph-fill ph-pencil-simple"
                            style="font-size:18px"></i>Update</button>
                        <button onClick="\${__b(d.open)}"
                          style="display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:54px;border-radius:15px;background:#fff0d6;color:#a3541b;font-size:17px;font-weight:800"
                          style-hover="background:#ffe6bd">Full details<i class="ph-bold ph-arrow-right"
                            style="font-size:17px"></i></button>
                      </div>
                    </div>
                  \`).join('') }
                </div>
                \${ noActiveDeals ? \`
                  <div
                    style="margin-top:16px;padding:52px 36px;text-align:center;border-radius:22px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                    <i class="ph-fill ph-handshake" style="font-size:44px;color:#c8b795"></i>
                    <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">\${noActiveMsg}</div>
                  </div>
                \` : '' }
              \` : '' }

              \${ dvDone ? \`
                <div
                  style="display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:16px;margin-top:20px">
                  \${ (ledgerRows || []).map(r => \`
                    <div
                      style="border-radius:24px;background:#fff;padding:20px 22px 22px;box-shadow:0 0 0 2.5px #0f7a45,0 20px 40px -26px rgba(10,80,45,.75)">
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                        <span
                          style="display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:999px;background:#0a6634;color:#eafff2;font-size:15px;font-weight:800"><i
                            class="ph-fill ph-seal-check" style="font-size:17px"></i>Sold</span>
                        <span style="\${r.statusStyle}"><i class="\${r.statusIcon}" style="font-size:15px"></i>\${r.statusLabel}</span>
                      </div>

                      <button onClick="\${__b(r.open)}" style="display:block;width:100%;text-align:left;margin-top:14px"
                        style-hover="opacity:.75">
                        <span
                          style="display:block;font-size:23px;font-weight:800;color:#241f1c;line-height:1.2;text-wrap:balance">\${r.propTitle}</span>
                        <span
                          style="display:block;font-size:16px;font-weight:700;color:#5c7a68;margin-top:3px;text-wrap:pretty">\${r.line}</span>
                      </button>

                      <div
                        style="display:flex;align-items:flex-end;gap:16px;margin-top:16px;padding:14px 16px;border-radius:17px;background:#e6f6ec;box-shadow:inset 0 0 0 1.5px #a9dcc0;flex-wrap:wrap">
                        <div style="flex:1;min-width:120px">
                          <div
                            style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7a8f82">
                            Sold for</div>
                          <div
                            style="font-family:'Newsreader',serif;font-weight:600;font-size:31px;line-height:1.05;color:#241f1c">
                            \${r.soldFmt}</div>
                        </div>
                        <div style="flex:1;min-width:120px;text-align:right">
                          <div
                            style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0a6634">
                            Commission</div>
                          <div
                            style="font-family:'Newsreader',serif;font-weight:600;font-size:31px;line-height:1.05;color:#0a6634">
                            \${r.commFmt}</div>
                          <div style="font-size:14px;font-weight:700;color:#5c7a68;margin-top:2px">\${r.receivedLine}
                          </div>
                        </div>
                      </div>

                      <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
                        \${ r.showCollect ? \`<button onClick="\${__b(r.collect)}"
                            style="display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:54px;border-radius:15px;background:#0a6634;color:#fff;font-size:17px;font-weight:800"
                            style-hover="background:#075229"><i class="ph-fill ph-hand-coins"
                              style="font-size:19px"></i>Money received</button>\` : '' }
                        <button onClick="\${__b(r.open)}"
                          style="display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:54px;border-radius:15px;background:#e3f4e9;color:#0a6634;font-size:17px;font-weight:800"
                          style-hover="background:#d3ecdc">Full details<i class="ph-bold ph-arrow-right"
                            style="font-size:17px"></i></button>
                      </div>
                    </div>
                  \`).join('') }
                </div>
                \${ noLedger ? \`
                  <div
                    style="margin-top:16px;padding:52px 36px;text-align:center;border-radius:22px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                    <i class="ph-fill ph-seal-check" style="font-size:44px;color:#c8b795"></i>
                    <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">\${noLedgerMsg}</div>
                  </div>
                \` : '' }

                \${ hasLost ? \`
                  <div style="margin-top:26px">
                    <div
                      style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e;margin-bottom:12px">
                      Did not happen — kept for the record</div>
                    <div style="display:flex;flex-direction:column;gap:9px">
                      \${ (lostDeals || []).map(d => \`
                        <button onClick="\${__b(d.open)}"
                          style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;text-align:left;padding:15px 18px;border-radius:16px;background:#fff6f6;box-shadow:inset 0 0 0 1.5px #f3c7cc"
                          style-hover="background:#ffeff0">
                          <span style="flex:1;min-width:180px">
                            <span style="display:block;font-size:17.5px;font-weight:800;color:#241f1c">\${d.client}</span>
                            <span style="display:block;font-size:14.5px;font-weight:600;color:#7a6f60">\${d.propLine}</span>
                          </span>
                          <span
                            style="display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px;border-radius:11px;background:#ffdfe2;color:#b02a37;font-size:14.5px;font-weight:800;flex:none"><i
                              class="ph-fill ph-x-circle" style="font-size:16px"></i>\${d.reason}</span>
                          <span
                            style="flex:none;font-size:14.5px;font-weight:700;color:#8a7f6e;min-width:70px;text-align:right">\${d.when}</span>
                        </button>
                      \`).join('') }
                    </div>
                  </div>
                \` : '' }
              \` : '' }

            </div>
          \` : '' }

          \${ stgOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:94;display:flex;align-items:center;justify-content:center;padding:20px">
              <div onClick="\${__b(stg.cancel)}"
                style="position:absolute;inset:0;background:rgba(26,18,6,.66);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:520px;max-width:100%;background:#fdf8ee;border-radius:26px;overflow:hidden;box-shadow:0 46px 100px -30px rgba(0,0,0,.66);">
                <div style="\${stg.headStyle}">
                  <div style="display:flex;align-items:center;gap:13px">
                    <span style="\${stg.iconBox}"><i class="\${stg.icon}" style="font-size:24px"></i></span>
                    <div style="flex:1;min-width:0">
                      <div
                        style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;\${stg.kickerColor}">
                        \${stg.kicker}</div>
                      <div style="font-size:25px;font-weight:800;color:#241f1c;margin-top:2px;line-height:1.2">\${stg.title}</div>
                    </div>
                  </div>
                  <div style="font-size:16.5px;font-weight:600;color:#7a6f60;margin-top:12px;text-wrap:pretty">\${stg.body}</div>
                </div>
                <div style="padding:18px 24px 22px">
                  \${ stg.askAmt ? \`
                    <div>
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e">
                        Token amount (optional)</div>
                      <label
                        style="display:flex;align-items:center;gap:10px;margin-top:9px;height:58px;padding:0 18px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                        <span style="font-family:'Newsreader',serif;font-size:24px;color:#a3541b;flex:none">₹</span>
                        <input value="\${stg.amt}" onInput="\${__b(stg.onAmt)}" placeholder="5"
                          style="border:none;outline:none;background:none;width:100%;font-size:22px;font-weight:800;color:#241f1c">
                        <span style="font-size:16px;font-weight:800;color:#8a7f6e;flex:none">lakh</span>
                      </label>
                    </div>
                  \` : '' }
                  \${ stg.askDate ? \`
                    <div>
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e">
                        \${stg.dateLabel}</div>
                      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">
                        \${ (stg.dayOpts || []).map(o => \`<button onClick="\${__b(o.go)}"
                            style="\${o.style}">\${o.label}</button>\`).join('') }
                      </div>
                    </div>
                  \` : '' }
                  <div style="display:flex;gap:10px;margin-top:20px">
                    <button onClick="\${__b(stg.cancel)}"
                      style="flex:1;height:56px;border-radius:15px;background:#f3ece0;color:#4c463d;font-size:17px;font-weight:800"
                      style-hover="background:#eadfcb">Cancel</button>
                    <button onClick="\${__b(stg.confirm)}" style="\${stg.okStyle}"><i class="\${stg.okIcon}"
                        style="font-size:19px"></i>\${stg.okLabel}</button>
                  </div>
                </div>
              </div>
            </div>
          \` : '' }

          \${ upOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:93;display:flex;align-items:center;justify-content:center;padding:20px">
              <div onClick="\${__b(upClose)}"
                style="position:absolute;inset:0;background:rgba(26,18,6,.62);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:620px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;background:#fdf8ee;border-radius:26px;box-shadow:0 46px 100px -30px rgba(0,0,0,.66);">
                <div
                  style="flex:none;padding:20px 24px 18px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14,#1a1406)">
                  <div style="display:flex;align-items:center;gap:14px">
                    <div style="flex:1;min-width:0">
                      <div
                        style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9a94a">
                        Update deal</div>
                      <div style="font-size:24px;font-weight:800;color:#fff8e8;margin-top:3px;line-height:1.2">\${up.who}</div>
                      <div style="font-size:15.5px;font-weight:600;color:#c9b48a;margin-top:2px">\${up.what}</div>
                    </div>
                    <button onClick="\${__b(upClose)}" title="Close"
                      style="width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.12);color:#f4e5c4;display:grid;place-items:center;flex:none"
                      style-hover="background:rgba(255,255,255,.22)"><i class="ph-bold ph-x"
                        style="font-size:21px"></i></button>
                  </div>
                </div>
                <div data-scroll="" style="flex:1;min-height:0;overflow-y:auto;padding:20px 24px 8px">
                  <div
                    style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e">
                    Stage</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                    \${ (up.stages || []).map(o => \`<button onClick="\${__b(o.go)}"
                        style="\${o.style}"><i class="\${o.icon}" style="font-size:16px"></i>\${o.label}</button>\`).join('') }
                  </div>

                  <div
                    style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e;margin-top:20px">
                    Current deal price</div>
                  <div style="display:flex;align-items:center;gap:11px;margin-top:10px">
                    <label
                      style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;height:58px;padding:0 18px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                      <span style="font-family:'Newsreader',serif;font-size:24px;color:#a3541b;flex:none">₹</span>
                      <input value="\${up.price}" onInput="\${__b(up.onPrice)}" placeholder="1.60"
                        style="border:none;outline:none;background:none;width:100%;font-size:22px;font-weight:800;color:#241f1c">
                      <span style="font-size:16px;font-weight:800;color:#8a7f6e;flex:none">crore</span>
                    </label>
                    <div style="flex:none;text-align:right">
                      <div style="font-size:13px;font-weight:700;color:#8a7f6e">Now</div>
                      <div style="font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:#241f1c">\${up.priceNow}</div>
                    </div>
                  </div>

                  \${ up.needToken ? \`
                    <div
                      style="margin-top:20px;padding:16px 18px;border-radius:18px;background:#eef4fd;box-shadow:inset 0 0 0 1.5px #d0e0f5">
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#1a5aa8">
                        Token taken</div>
                      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">
                        <label
                          style="display:flex;align-items:center;gap:9px;flex:1;min-width:180px;height:54px;padding:0 16px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1.5px #cddff2">
                          <span style="font-family:'Newsreader',serif;font-size:21px;color:#1a5aa8;flex:none">₹</span>
                          <input value="\${up.token}" onInput="\${__b(up.onToken)}" placeholder="5"
                            style="border:none;outline:none;background:none;width:100%;font-size:19px;font-weight:800;color:#241f1c">
                          <span style="font-size:15px;font-weight:800;color:#7a8797;flex:none">lakh</span>
                        </label>
                        <div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center">
                          \${ (up.tokenDays || []).map(o => \`<button
                              onClick="\${__b(o.go)}" style="\${o.style}">\${o.label}</button>\`).join('') }
                        </div>
                      </div>
                      <div style="font-size:14.5px;font-weight:700;color:#1a5aa8;margin-top:9px">\${up.tokenNote}
                      </div>
                    </div>
                  \` : '' }

                  \${ up.needRegistry ? \`
                    <div
                      style="margin-top:20px;padding:16px 18px;border-radius:18px;background:#f4efff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b32c4">
                        Registry date</div>
                      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px">
                        \${ (up.regDays || []).map(o => \`<button onClick="\${__b(o.go)}"
                            style="\${o.style}">\${o.label}</button>\`).join('') }
                      </div>
                    </div>
                  \` : '' }

                  <div
                    style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e;margin-top:20px">
                    What will you do next</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                    \${ (up.nextOpts || []).map(o => \`<button onClick="\${__b(o.go)}"
                        style="\${o.style}"><i class="\${o.icon}" style="font-size:16px"></i>\${o.label}</button>\`).join('') }
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                    \${ (up.nextDays || []).map(o => \`<button onClick="\${__b(o.go)}"
                        style="\${o.style}">\${o.label}</button>\`).join('') }
                  </div>
                  <input value="\${up.note}" onInput="\${__b(up.onNote)}"
                    placeholder="Short note — only if it helps you remember"
                    style="width:100%;height:54px;padding:0 17px;border-radius:14px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4;border:none;outline:none;font-size:16.5px;font-weight:600;color:#241f1c;margin-top:11px">

                  \${ up.hasDue ? \`
                    <div
                      style="margin-top:20px;padding:16px 18px;border-radius:18px;background:#eaf7ef;box-shadow:inset 0 0 0 1.5px #b7e0c8">
                      <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
                        <div style="flex:1;min-width:170px">
                          <div
                            style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0a6634">
                            Commission received</div>
                          <div style="font-size:15.5px;font-weight:700;color:#0a6634;margin-top:3px">\${up.dueLine}
                          </div>
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px">
                          \${ (up.commBtns || []).map(o => \`<button
                              onClick="\${__b(o.go)}" style="\${o.style}"><i class="ph-fill ph-hand-coins"
                                style="font-size:16px"></i>\${o.label}</button>\`).join('') }
                        </div>
                      </div>
                    </div>
                  \` : '' }

                  <button onClick="\${__b(up.lost)}"
                    style="display:flex;align-items:center;gap:8px;height:50px;padding:0 17px;border-radius:14px;background:#fff1f2;color:#b02a37;font-size:16px;font-weight:800;margin-top:18px"
                    style-hover="background:#ffe3e6"><i class="ph-fill ph-x-circle" style="font-size:18px"></i>This deal
                    fell through</button>
                </div>
                <div style="flex:none;display:flex;gap:11px;padding:16px 24px 20px;background:#f6efe2">
                  <button onClick="\${__b(upClose)}"
                    style="flex:none;height:58px;padding:0 22px;border-radius:15px;background:#eadfcb;color:#6b6156;font-size:17px;font-weight:800">Cancel</button>
                  <button onClick="\${__b(up.save)}"
                    style="flex:1;display:flex;align-items:center;justify-content:center;gap:9px;height:58px;border-radius:15px;background:#f8a800;color:#241d0c;font-size:18px;font-weight:800"
                    style-hover="background:#e69a00"><i class="ph-fill ph-check-circle" style="font-size:20px"></i>Save
                    the update</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ isInventory ? \`
            <div style="max-width:1680px;margin:0 auto;padding:20px 32px 70px">
              <div
                style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <div style="\${invSegWrapStyle}">
                  <button onClick="\${__b(invLiveGo)}" style="\${invSegLive}"><i class="ph-fill ph-storefront"
                      style="font-size:19px"></i>On sale<span style="\${invSegLiveN}">\${invLiveCount}</span></button>
                  <button onClick="\${__b(invSoldGo)}" style="\${invSegSold}"><i class="ph-fill ph-seal-check"
                      style="font-size:19px"></i>Sold<span style="\${invSegSoldN}">\${invSoldCount}</span></button>
                  <button onClick="\${__b(invUnsoldGo)}" style="\${invSegUnsold}"><i class="ph-fill ph-arrow-u-up-left"
                      style="font-size:19px"></i>Unsold<span style="\${invSegUnsoldN}">\${invUnsoldCount}</span></button>
                </div>
                <div style="flex:1"></div>
                <button onClick="\${__b(openAddPlot)}" style="\${invAddBtnStyle}"
                  style-active="transform:translateY(2px)"><i class="ph-bold ph-plus" style="font-size:21px"></i>\${invAddLabel}</button>
              </div>

              <div
                style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-top:18px;animation-delay:.04s">
                <div style="\${invStatA}">
                  <div style="display:flex;align-items:center;gap:9px;font-size:16.5px;font-weight:800;opacity:.9"><i
                      class="\${invStatIconA}" style="font-size:22px"></i>\${invStatLabelA}\${plotScopeLabel}
                  </div>
                  <div
                    style="font-family:'Newsreader',serif;font-weight:500;font-size:50px;line-height:1.05;margin-top:10px;white-space:nowrap">
                    \${plotsValue}</div>
                </div>
                <div style="\${invStatB}">
                  <div style="display:flex;align-items:center;gap:9px;font-size:16.5px;font-weight:800;opacity:.9"><i
                      class="\${invStatIconB}" style="font-size:22px"></i>\${invStatLabelB}</div>
                  <div
                    style="font-family:'Newsreader',serif;font-weight:500;font-size:50px;line-height:1.05;margin-top:10px">
                    \${plotsReady}</div>
                </div>
                <div style="\${invStatC}">
                  <div style="display:flex;align-items:center;gap:9px;font-size:16.5px;font-weight:800;opacity:.9"><i
                      class="\${invStatIconC}" style="font-size:22px"></i>\${invStatLabelC}</div>
                  <div
                    style="font-family:'Newsreader',serif;font-weight:500;font-size:50px;line-height:1.05;margin-top:10px;white-space:nowrap">
                    \${plotsNeed}</div>
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:12px;margin-top:20px;margin-bottom:24px;flex-wrap:wrap;position:relative;z-index:26">
                <label style="\${invSearchStyle}">
                  <i class="ph-bold ph-magnifying-glass" style="font-size:20px;color:#c85a1a"></i>
                  <input value="\${propQ}" onInput="\${__b(onPropQ)}"
                    placeholder="Search properties…" style="\${invSearchInput}">
                  \${ propQOn ? \`<button onClick="\${__b(clearPropQ)}"
                      style="width:32px;height:32px;border-radius:9px;background:#f4ecdd;color:#6b6156;display:grid;place-items:center;flex:none"><i
                        class="ph-bold ph-x" style="font-size:14px"></i></button>\` : '' }
                </label>

                <div style="\${invQuickSegWrap}">
                  \${ (quickViews || []).map(q => \`
                    <button onClick="\${__b(q.go)}" style="\${q.style}"><i class="\${q.icon}" style="font-size:17px"></i>\${q.label}</button>
                  \`).join('') }
                </div>

                <div style="position:relative;flex:none">
                  <button onClick="\${__b(toggleFilters)}" style="\${invFilterBtn}"><i
                      class="ph-fill ph-sliders-horizontal" style="font-size:20px"></i>Filters<span
                      style="\${invFilterCountStyle}">\${invFilterCount}</span></button>
                  \${ filtersOpen ? \`
                    <div data-scroll=""
                      style="position:absolute;top:calc(100% + 10px);left:0;right:auto;width:660px;max-width:88vw;max-height:min(560px,68vh);overflow-y:auto;overflow-x:hidden;background:#fffdf7;border-radius:22px;box-shadow:0 0 0 1.5px #e6d6b4,0 40px 80px -30px rgba(40,26,2,.7);padding:22px;z-index:40;">
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b">
                        City</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
                        \${ (fCityRows || []).map(c => \`<button onClick="\${__b(c.go)}"
                            style="\${c.style}">\${c.label}<span style="opacity:.6;font-size:14px">\${c.count}</span></button>\`).join('') }
                      </div>
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b;margin-top:20px">
                        Property type</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
                        \${ (fTypeRows || []).map(c => \`<button onClick="\${__b(c.go)}"
                            style="\${c.style}">\${c.label}<span style="opacity:.6;font-size:14px">\${c.count}</span></button>\`).join('') }
                      </div>

                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
                        \${ (fStateRows || []).map(c => \`\`).join('') }
                      </div>
                      <div
                        style="position:sticky;bottom:-22px;display:flex;gap:10px;margin-top:22px;padding:14px 0 0;background:#fffdf7">
                        <button onClick="\${__b(clearFilters)}"
                          style="height:54px;padding:0 20px;border-radius:14px;background:#f4ecdd;color:#6b6156;font-size:16px;font-weight:800">Clear
                          all</button>
                        <div style="flex:1"></div>
                        <button onClick="\${__b(closeFilters)}"
                          style="height:54px;padding:0 26px;border-radius:14px;background:#241d0c;color:#f8c200;font-size:16px;font-weight:800">Show
                          results</button>
                      </div>
                    </div>
                  \` : '' }
                </div>
              </div>

              \${ hasFilterChips ? \`
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;margin-bottom:16px">
                  \${ (invFilterChips || []).map(c => \`
                    <span style="\${c.style}">\${c.label}<button onClick="\${__b(c.clear)}"
                        style="width:26px;height:26px;border-radius:8px;background:rgba(0,0,0,.1);color:inherit;display:grid;place-items:center"><i
                          class="ph-bold ph-x" style="font-size:12px"></i></button></span>
                  \`).join('') }
                </div>
              \` : '' }
              \${ hasReady ? \`
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px">
                  \${ (propsReady || []).map(p => \`
                    <div style="\${p.cardWrap}" style-hover="transform:translateY(-3px)">
                      <div style="\${p.accentBar}"></div>
                      <button onClick="\${__b(p.openDetail)}" title="Open this property"
                        style="display:block;width:100%;height:224px;position:relative;background:#f1ede4;padding:0">
                        \${ p.hasPhoto ? \`<span
                            style="\${p.photoStyle}"></span>\` : '' }
                        \${ p.noPhoto ? \`<span
                            style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#a9855c"><i
                              class="ph-fill ph-image-broken" style="font-size:34px"></i><span
                              style="font-size:14px;font-weight:800">No photo yet</span></span>\` : '' }

                        \${ p.showAvail ? \`\` : '' }
                      </button>
                      <div style="padding:16px 18px 18px">
                        <div style="display:flex;align-items:flex-start;gap:12px">
                          <div style="flex:1;min-width:0">
                            <div style="font-size:19px;font-weight:800;color:#181513">\${p.title}</div>
                            <div
                              style="display:flex;align-items:center;gap:6px;font-size:15.5px;font-weight:600;color:#574c43;margin-top:3px">
                              <i class="ph-fill ph-map-pin" style="font-size:16px;color:#ea580c"></i>\${p.loc}</div>
                          </div>
                          <button onClick="\${__b(p.openMenu)}" title="More"
                            style="width:40px;height:40px;border-radius:12px;background:#f4ecdd;color:#8a7a52;display:grid;place-items:center;flex:none"
                            style-hover="background:#ecdcc0"><i class="ph-bold ph-dots-three"
                              style="font-size:20px"></i></button>
                        </div>
                        <div
                          style="display:flex;align-items:center;gap:10px;margin-top:14px;padding:8px 10px 8px 14px;border-radius:16px;background:#fdfbf7;border:1.5px solid #ecdcc0;box-shadow:0 2px 8px rgba(0,0,0,.03)">
                          <span
                            style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:800;color:#574c43;flex:none"><i
                              class="ph-fill ph-ruler" style="font-size:16px;color:#ea580c"></i>\${p.sizeText}</span>
                          <div style="flex:1"></div>
                          <button onClick="\${__b(p.editPrice)}" title="Update price"
                            style="display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;box-shadow:0 2px 6px rgba(217,119,6,.15);text-align:left;flex:none"
                            style-hover="background:#fde68a">
                            <span style="font-family:'Newsreader',serif;font-weight:700;font-size:25px;line-height:1;color:#92400e">\${p.priceFmt}</span>
                            <i class="ph-bold ph-pencil-simple" style="font-size:13px;color:#b45309"></i>
                          </button>
                          \${ p.notSoldCard ? \`
                            <button onClick="\${__b(p.openShare)}" title="Send a private link"
                              style="display:flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:12px;background:#f8a800;color:#241d0c;font-size:14.5px;font-weight:800;flex:none;white-space:nowrap;box-shadow:0 6px 14px -6px rgba(248,168,0,.8)"
                              style-hover="background:#e69a00"><i class="ph-fill ph-paper-plane-tilt"
                                style="font-size:15px"></i>Send<i class="ph-bold ph-arrow-right"
                                style="font-size:13px"></i></button>
                          \` : '' }
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:11px">


                          \${ p.hasShares ? \`\` : '' }
                        </div>
                        \${ p.isSoldCard ? \`
                          <div
                            style="margin-top:14px;padding:14px 16px;border-radius:15px;background:#fff8e3;box-shadow:inset 0 0 0 1.5px #f0d493">
                            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                              <span
                                style="font-family:'Newsreader',serif;font-weight:600;font-size:26px;color:#9a6a00">\${p.saleFmt}</span>
                              \${ p.hasSaleComm ? \`<span
                                  style="display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:999px;background:#0a6634;color:#eafff2;font-size:14px;font-weight:800">You
                                  earned \${p.saleComm}</span>\` : '' }
                            </div>
                            <div style="font-size:15.5px;font-weight:700;color:#3d7a56;margin-top:3px">\${p.saleLine}
                            </div>
                            \${ p.hasDealCard ? \`
                              <button onClick="\${__b(p.goDealCard)}"
                                style="width:100%;display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:14px;background:#0b6f39;color:#eafff2;font-size:16.5px;font-weight:800;margin-top:11px">View
                                deal<i class="ph-bold ph-arrow-right" style="font-size:18px"></i></button>
                            \` : '' }
                          </div>
                        \` : '' }
                        \${ p.isRemovedCard ? \`
                          <div
                            style="margin-top:14px;padding:14px 16px;border-radius:15px;background:#f4f0e8;box-shadow:inset 0 0 0 1.5px #cbc3b6">
                            <div style="display:flex;align-items:center;gap:9px;font-size:15px;font-weight:800;color:#4b4741"><i
                                class="ph-fill ph-arrow-u-up-left" style="font-size:17px"></i>\${p.removedLine}</div>
                            <button onClick="\${__b(p.restore)}" style="\${p.mnRestore}"><i
                                class="ph-fill ph-arrow-counter-clockwise" style="font-size:18px"></i>Put back on sale</button>
                          </div>
                        \` : '' }
                        \${ p.menuOpen ? \`
                          <div
                            style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;padding-top:13px;border-top:1px dashed #ecdcc0">
                            <button onClick="\${__b(p.edit)}" style="\${p.mnEdit}"><i class="ph-fill ph-pencil-simple"
                                style="font-size:16px"></i>Edit</button>
                            \${ p.notSoldCard ? \`<button
                                onClick="\${__b(p.togglePub)}" style="\${p.mnShare}"><i class="\${p.pubMenuIcon}"
                                  style="font-size:16px"></i>\${p.pubMenuLabel}</button>\` : '' }
                            \${ p.notSoldCard ? \`<button
                                onClick="\${__b(p.markSold)}" style="\${p.mnSold}"><i class="ph-fill ph-seal-check"
                                  style="font-size:16px"></i>Mark sold</button>\` : '' }
                            \${ p.notSoldCard ? \`<button
                                onClick="\${__b(p.archive)}" style="\${p.mnHold}"><i class="ph-fill ph-archive"
                                  style="font-size:16px"></i>Take off market</button>\` : '' }
                          </div>
                        \` : '' }
                      </div>
                    </div>
                  \`).join('') }
                </div>
              \` : '' }
              \${ noReady ? \`
                <div
                  style="padding:34px;text-align:center;color:#8a6a3c;font-size:17px;font-weight:600;background:#fffdf7;border-radius:20px;box-shadow:inset 0 0 0 2px #ecdcc0">
                  \${invEmptyText}</div>
              \` : '' }
            </div>
          \` : '' }

          \${ isClients ? \`
            <div style="max-width:1680px;margin:0 auto;padding:22px 32px 80px">
              <!-- Row 1: Clients / Sellers Primary Bar + Search & Add Button -->
              <div
                style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px;">
                <!-- Segmented Tabs for Clients / Sellers -->
                <div style="display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:18px;background:#fff3d6;box-shadow:inset 0 0 0 1.5px rgba(120,100,60,.16);">
                  \${ (ctTabs || []).map(t => \`
                    <button onClick="\${__b(t.go)}" style="\${t.style}"><i class="\${t.icon}"
                        style="font-size:21px"></i>\${t.label}<span style="\${t.numStyle}">\${t.count}</span></button>
                  \`).join('') }
                </div>

                <div style="flex:1"></div>

                <!-- Right corner compact search bar & Add button -->
                \${ ctIsClients ? \`
                  <label
                    style="display:flex;align-items:center;gap:10px;width:280px;height:54px;padding:0 16px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                    <i class="ph-bold ph-magnifying-glass" style="font-size:19px;color:#a3541b"></i>
                    <input value="\${cliQ}" onInput="\${__b(onCliQ)}"
                      placeholder="Search client…"
                      style="border:none;outline:none;background:none;width:100%;font-size:15.5px;font-weight:600;color:#241f1c">
                  </label>
                  <button onClick="\${__b(openAddClientBig)}"
                    style="display:flex;align-items:center;gap:9px;height:54px;padding:0 22px;border-radius:15px;background:#f8a800;color:#241d0c;white-space:nowrap;font-size:16.5px;font-weight:800;box-shadow:0 10px 20px -10px rgba(248,168,0,.95)"
                    style-hover="background:#db9500"><i class="ph-bold ph-user-plus" style="font-size:19px"></i>Add client</button>
                \` : '' }
                \${ ctIsSellers ? \`
                  <label
                    style="display:flex;align-items:center;gap:10px;width:280px;height:54px;padding:0 16px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #d6c6f2">
                    <i class="ph-bold ph-magnifying-glass" style="font-size:19px;color:#4a2c99"></i>
                    <input value="\${sellQ}" onInput="\${__b(onSellQ)}"
                      placeholder="Search seller…"
                      style="border:none;outline:none;background:none;width:100%;font-size:15.5px;font-weight:600;color:#241f1c">
                  </label>
                  <button onClick="\${__b(openAddSeller)}"
                    style="display:flex;align-items:center;gap:9px;height:54px;padding:0 22px;border-radius:15px;background:#4a2c99;color:#efe8fb;font-size:16.5px;font-weight:800;box-shadow:0 10px 20px -10px rgba(74,44,153,.95)"
                    style-hover="background:#3d2380"><i class="ph-bold ph-plus" style="font-size:19px"></i>Add seller</button>
                \` : '' }
              </div>

              <!-- Row 2: Sub-filter bar for Needs attention / Bought / Hot (below Clients / Sellers) -->
              \${ ctIsClients ? \`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:22px;">
                  <div style="display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:14px;background:#fff3d6;box-shadow:inset 0 0 0 1.5px rgba(120,100,60,.16);">
                    \${ (cliChips || []).map(c => \`
                      <button onClick="\${__b(c.go)}" style="\${c.style}">\${c.label}<span style="\${c.numStyle}">\${c.count}</span></button>
                    \`).join('') }
                  </div>
                </div>
              \` : '' }

              \${ ctIsClients ? \`
                <div>

                  \${ cliAny ? \`
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px">
                      \${ (cliCards || []).map(c => \`
                        <div onClick="\${__b(c.open)}" onKeyDown="\${__b(c.keyOpen)}" role="button" tabIndex="0"
                          title="Open this customer" style="\${c.cardStyle}" style-hover="transform:translateY(-3px)"
                          style-focus="box-shadow:0 0 0 3px #f8a800">
                          <div style="display:flex;align-items:flex-start;gap:15px">
                            <span style="\${c.avStyle}">\${c.initials}</span>
                            <div style="flex:1;min-width:0">
                              <div
                                style="font-size:21px;font-weight:800;color:#241f1c;line-height:1.2;text-wrap:balance">
                                \${c.name}</div>
                              \${ c.hasBiz ? \`
                                <div
                                  style="font-size:15px;font-weight:700;color:#8a7f6e;margin-top:2px;text-wrap:pretty">
                                  \${c.business}</div>
                              \` : '' }
                              <div style="font-size:15.5px;color:#6b6156;margin-top:3px;white-space:nowrap">\${c.phone}</div>
                            </div>
                          </div>

                          <div style="display:flex;align-items:center;gap:10px;margin-top:13px;flex-wrap:wrap">
                            <span style="\${c.stateStyle}"><i class="\${c.stateIcon}" style="font-size:16px"></i>\${c.stateLabel}</span>
                          </div>
                          \${ c.hasBought ? \`\` : '' }
                          \${ c.needsWork ? \`
                            <div
                              style="display:flex;align-items:center;gap:9px;margin-top:11px;font-size:14.5px;font-weight:700;color:#a3541b">
                              <i class="ph-fill ph-info" style="font-size:17px"></i>Open to add what they want.</div>
                          \` : '' }
                          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:15px">
                            <button onClick="\${__b(c.sendLink)}" title="Send a private link"
                              style="display:flex;align-items:center;justify-content:center;gap:7px;height:50px;padding:0 14px;border-radius:14px;background:#f8a800;color:#241d0c;font-size:15.5px;font-weight:800;white-space:nowrap;flex:1 1 auto;min-width:0;overflow:hidden"
                              style-hover="background:#db9500"><i class="ph-fill ph-paper-plane-tilt"
                                style="font-size:18px"></i>Send<i class="ph-bold ph-arrow-right"
                                style="font-size:15px"></i></button>
                            <a href="\${c.tel}" onClick="\${__b(c.stop)}"
                              style="display:flex;align-items:center;justify-content:center;gap:9px;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;height:50px;border-radius:14px;background:#0f7a45;color:#fff;font-size:16px;font-weight:800;text-decoration:none"
                              style-hover="background:#0b6437"><i class="ph-fill ph-phone"
                                style="font-size:19px"></i>Call</a>
                            <a href="\${c.wa}" target="_blank" onClick="\${__b(c.stop)}"
                              style="display:flex;align-items:center;justify-content:center;gap:9px;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;height:50px;border-radius:14px;background:#e3f4e9;color:#0a6634;font-size:16px;font-weight:800;text-decoration:none"
                              style-hover="background:#d0ecda"><i class="ph-fill ph-whatsapp-logo"
                                style="font-size:19px"></i>WhatsApp</a>
                          </div>
                        </div>
                      \`).join('') }
                    </div>
                  \` : '' }
                  \${ cliEmpty ? \`
                    <div
                      style="margin-top:22px;padding:56px 40px;text-align:center;border-radius:24px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                      <i class="ph-fill ph-users-three" style="font-size:46px;color:#c8b795"></i>
                      <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">No client matches this
                      </div>
                      <div style="font-size:16.5px;color:#6b6156;margin-top:6px">Try another filter, or add the client —
                        name and phone is enough.</div>
                    </div>
                  \` : '' }
                </div>
              \` : '' }

              \${ ctIsSellers ? \`
                <div>

                  \${ sellAny ? \`
                    <div
                      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(390px,1fr));gap:16px;margin-top:18px">
                      \${ (sellCards || []).map(sl => \`
                        <div onClick="\${__b(sl.open)}" style="\${sl.cardStyle}"
                          style-hover="transform:translateY(-3px)">
                          <div style="display:flex;align-items:flex-start;gap:15px">
                            <span style="\${sl.avStyle}">\${sl.initials}</span>
                            <div style="flex:1;min-width:0">
                              <div
                                style="font-size:21px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                                \${sl.name}</div>
                              \${ sl.hasBiz ? \`
                                <div style="font-size:15px;font-weight:700;color:#8a7f6e;margin-top:1px">\${sl.business}</div>
                              \` : '' }
                              <div style="font-size:15.5px;color:#6b6156;margin-top:2px">\${sl.phone} · \${sl.city}
                              </div>
                            </div>
                            <span style="\${sl.kindStyle};flex:none">\${sl.kind}</span>
                          </div>
                          <div style="display:flex;gap:11px;margin-top:16px">
                            <div style="flex:1;padding:13px 15px;border-radius:15px;background:#f7f2ff">
                              <div
                                style="font-family:'Newsreader',serif;font-weight:600;font-size:28px;color:#4a2c99;line-height:1">
                                \${sl.liveN}</div>
                              <div style="font-size:14px;font-weight:700;color:#6b6156;margin-top:2px">active \${sl.liveLabel}</div>
                            </div>
                            <div style="flex:1;padding:13px 15px;border-radius:15px;background:#eaf6ee">
                              <div
                                style="font-family:'Newsreader',serif;font-weight:600;font-size:28px;color:#0a6634;line-height:1">
                                \${sl.soldN}</div>
                              <div style="font-size:14px;font-weight:700;color:#6b6156;margin-top:2px">sold with you
                              </div>
                            </div>
                          </div>
                          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">\${ (sl.chips || []).map(ch => \`\`).join('') }</div>

                          <div style="display:flex;align-items:center;gap:10px;margin-top:15px">
                            <a href="\${sl.tel}" onClick="\${__b(sl.stop)}"
                              style="display:flex;align-items:center;justify-content:center;gap:9px;flex:1;height:50px;border-radius:14px;background:#4a2c99;color:#fff;font-size:16px;font-weight:800;text-decoration:none"
                              style-hover="background:#3d2380"><i class="ph-fill ph-phone"
                                style="font-size:19px"></i>Call seller</a>
                            <span
                              style="display:flex;align-items:center;justify-content:center;gap:9px;flex:1;height:50px;border-radius:14px;background:#f4eeff;color:#4a2c99;font-size:16px;font-weight:800"><i
                                class="ph-fill ph-arrow-right" style="font-size:18px"></i>Open profile</span>
                          </div>
                        </div>
                      \`).join('') }
                    </div>
                  \` : '' }
                  \${ sellLoading ? \`
                    <div
                      style="margin-top:22px;padding:56px 40px;text-align:center;border-radius:24px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #d6c6f2">
                      <i class="ph-fill ph-circle-notch" style="font-size:46px;color:#b9a6e0"></i>
                      <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">Loading sellers…</div>
                    </div>
                  \` : '' }
                  \${ sellError ? \`
                    <div role="alert"
                      style="margin-top:22px;padding:56px 40px;text-align:center;border-radius:24px;background:#fff5ec;box-shadow:inset 0 0 0 2px #f5c9a0">
                      <i class="ph-fill ph-warning-circle" style="font-size:46px;color:#c0490c"></i>
                      <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">Sellers could not be loaded</div>
                      <div style="font-size:16.5px;color:#6b6156;margin-top:6px">\${ sellError }</div>
                      <button onClick="\${__b(sellRetry)}"
                        style="margin-top:16px;height:52px;padding:0 24px;border-radius:15px;background:#4a2c99;color:#efe8fb;font-size:16.5px;font-weight:800">Try again</button>
                    </div>
                  \` : '' }
                  \${ sellEmpty ? \`
                    <div
                      style="margin-top:22px;padding:56px 40px;text-align:center;border-radius:24px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #d6c6f2">
                      <i class="ph-fill ph-key" style="font-size:46px;color:#b9a6e0"></i>
                      <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">\${ sellQ ? 'No seller matches that search' : 'No seller here yet' }</div>
                      <div style="font-size:16.5px;color:#6b6156;margin-top:6px">Add a seller once and reuse them on
                        every property they give you.</div>
                    </div>
                  \` : '' }
                </div>
              \` : '' }
            </div>
          \` : '' }

          \${ isLinks ? \`
            <div style="max-width:1680px;margin:0 auto;padding:22px 32px 80px">
              <div
                style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                  \${ (lkTabs || []).map(t => \`
                    <button onClick="\${__b(t.go)}" style="\${t.style}"><i class="\${t.icon}"
                        style="font-size:21px"></i>\${t.label}<span style="\${t.numStyle}">\${t.count}</span></button>
                  \`).join('') }
                </div>
                <div style="flex:1"></div>
                <button onClick="\${__b(openLinkBuild)}"
                  style="display:flex;align-items:center;gap:10px;height:60px;padding:0 26px;border-radius:17px;background:#f8a800;color:#241d0c;white-space:nowrap;font-size:18px;font-weight:800;box-shadow:0 14px 28px -16px rgba(248,168,0,.95)"
                  style-hover="background:#db9500"><i class="ph-fill ph-paper-plane-tilt"
                    style="font-size:21px"></i>Send a new link</button>
              </div>

              \${ lkIsFollow ? \`
                <div style="margin-top:22px">
                  <div
                    style="border-radius:26px;background:#c8102e;background-image:linear-gradient(140deg,#e4293f,#a30d24);padding:22px 26px 24px;box-shadow:0 24px 48px -26px rgba(160,20,35,.85)">
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                      <span
                        style="width:13px;height:13px;border-radius:50%;background:#fff;animation:omGlow 1.9s ease-in-out infinite;flex:none"></span>
                      <div
                        style="flex:1;min-width:180px;font-size:14.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fff">
                        Needs attention today</div>
                      <div style="font-size:15.5px;font-weight:700;color:#ffd9dd">Only real, tracked activity</div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;margin-top:18px">
                      \${ (fuCards || []).map(f => \`
                        <button onClick="\${__b(f.go)}" style="\${f.card}" style-hover="transform:translateY(-3px)">
                          <span style="display:flex;align-items:center;gap:13px">
                            <span style="\${f.avStyle}">\${f.initials}</span>
                            <span style="flex:1;min-width:0">
                              <span
                                style="display:block;font-size:19.5px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${f.client}</span>
                              <span style="display:block;font-size:15px;color:#7a6f60;margin-top:1px">\${f.phone}</span>
                            </span>
                          </span>
                          <span style="\${f.reasonStyle}"><i class="\${f.reasonIcon}"
                              style="font-size:18px;flex:none"></i><span style="flex:1;min-width:0">\${f.reason}</span><span style="font-size:14px;font-weight:700;opacity:.75;flex:none">\${f.reasonWhen}</span></span>
                          \${ f.hasMore ? \`
                            <span style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">
                              \${ (f.more || []).map(m => \`<span
                                  style="\${m.style}"><i class="\${m.icon}" style="font-size:15px"></i>\${m.label}</span>\`).join('') }
                            </span>
                          \` : '' }
                          <span style="display:flex;align-items:center;gap:9px;margin-top:12px">
                            <span
                              style="display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:#0a6634;color:#eafff2;flex:none"><i
                                class="ph-fill ph-phone" style="font-size:20px"></i></span>
                            <span
                              style="display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:#e3f4e9;color:#0a6634;flex:none"><i
                                class="ph-fill ph-whatsapp-logo" style="font-size:20px"></i></span>
                            <span
                              style="display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:#fff0d6;color:#a3541b;flex:none"><i
                                class="ph-bold ph-arrow-right" style="font-size:20px"></i></span>
                          </span>
                        </button>
                      \`).join('') }
                    </div>
                    \${ fuNone ? \`
                      <div style="padding:30px 8px;text-align:center;font-size:17px;font-weight:700;color:#ffd9dd">
                        Nothing needs chasing right now. Every link you sent has been seen.</div>
                    \` : '' }
                  </div>

                  <div
                    style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:18px;margin-top:18px;align-items:stretch">
                    <div
                      style="border-radius:24px;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d493;padding:20px 22px 22px;display:flex;flex-direction:column;height:520px;max-height:520px;overflow:hidden">
                      <div style="display:flex;align-items:center;gap:11px;flex:none">
                        <span
                          style="width:40px;height:40px;border-radius:13px;background:#a3541b;color:#fff;display:grid;place-items:center;flex:none"><i
                            class="ph-fill ph-chart-bar" style="font-size:20px"></i></span>
                        <div style="flex:1;min-width:0">
                          <div style="font-size:18.5px;font-weight:800;color:#241f1c">Properties getting attention</div>
                          <div style="font-size:14.5px;font-weight:700;color:#a3541b">Counted from real opens</div>
                        </div>
                      </div>
                      <div data-scroll="" style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-right:4px">
                        \${ (lkAttention || []).map(a => \`
                          <button onClick="\${__b(a.go)}"
                            style="\${a.style}"
                            style-hover="transform:translateY(-2px)">
                            <img src="\${a.photoUrl}" style="width:74px;height:64px;border-radius:14px;object-fit:cover;flex:none;background:#e8ded2" alt="" />
                            <span style="flex:1;min-width:0">
                              <span
                                style="display:block;font-size:17.5px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${a.title}</span>
                              <span style="display:block;font-size:14.5px;color:#8a7f6e">\${a.loc} · \${a.clientLine}</span>
                            </span>
                            <span style="text-align:right;flex:none">
                              <span
                                style="display:block;font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1;color:#b8460f">\${a.views}</span>
                              <span style="display:block;font-size:13px;font-weight:700;color:#8a7f6e">\${a.viewWord}</span>
                            </span>
                          </button>
                        \`).join('') }
                      </div>
                      \${ lkNoAttention ? \`
                        <div style="padding:26px 8px;text-align:center;font-size:16px;font-weight:700;color:#a89e8b">No
                          property has been opened yet.</div>
                      \` : '' }
                    </div>

                    <div
                      style="border-radius:24px;background:#f1eeff;box-shadow:inset 0 0 0 2px #ddd4f7;padding:20px 22px 22px;display:flex;flex-direction:column;height:520px;max-height:520px;overflow:hidden">
                      <div style="display:flex;align-items:center;gap:11px;flex:none">
                        <span
                          style="width:40px;height:40px;border-radius:13px;background:#4a2c99;color:#fff;display:grid;place-items:center;flex:none"><i
                            class="ph-fill ph-activity" style="font-size:20px"></i></span>
                        <div style="flex:1;min-width:0">
                          <div style="font-size:18.5px;font-weight:800;color:#241f1c">Recent activity</div>
                          <div style="font-size:14.5px;font-weight:700;color:#5b32c4">What customers actually did</div>
                        </div>
                      </div>
                      <div data-scroll="" style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-right:4px">
                        \${ (lkFeed || []).map(f => \`
                          <button onClick="\${__b(f.go)}"
                            style="\${f.cardStyle}"
                            style-hover="transform:translateY(-2px);background:#f6f1ff">
                            <span style="\${f.iconStyle}"><i class="\${f.icon}"></i></span>
                            <span style="flex:1;min-width:0">
                              <span
                                style="display:block;font-size:16px;font-weight:800;color:#241f1c;text-wrap:pretty;line-height:1.32">\${f.text}</span>
                              <span style="display:block;font-size:14px;color:#7a6aa8;margin-top:2px">\${f.when}</span>
                            </span>
                          </button>
                        \`).join('') }
                      </div>
                      \${ lkNoFeed ? \`
                        <div style="padding:26px 8px;text-align:center;font-size:16px;font-weight:700;color:#7a6aa8">
                          Nothing yet.</div>
                      \` : '' }
                    </div>
                  </div>
                </div>
              \` : '' }

              \${ lkIsLinks ? \`
                <div style="margin-top:22px">
                  <div style="display:flex;gap:12px;flex-wrap:wrap">
                    <label
                      style="display:flex;align-items:center;gap:14px;flex:1;min-width:280px;height:62px;padding:0 20px;border-radius:18px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                      <i class="ph-bold ph-magnifying-glass" style="font-size:22px;color:#a3541b"></i>
                      <input value="\${lkQ}" onInput="\${__b(onLkQ)}" placeholder="Search by customer or property…"
                        style="border:none;outline:none;background:none;width:100%;font-size:17.5px;font-weight:600;color:#241f1c">
                    </label>
                    <div data-scroll="" style="display:flex;align-items:center;gap:9px;overflow-x:auto">
                      \${ (lkFilterChips || []).map(c => \`<button onClick="\${__b(c.go)}"
                          style="\${c.style}">\${c.label}</button>\`).join('') }
                    </div>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:16px">
                    \${ (lkCards || []).map(l => \`
                      <button onClick="\${__b(l.open)}" style="\${l.rowStyle}" style-hover="transform:translateY(-3px)">
                        <span style="display:flex;align-items:center;gap:14px">
                          <span style="\${l.avStyle}">\${l.initials}</span>
                          <span style="flex:1;min-width:0">
                            <span
                              style="display:block;font-size:20px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${l.client}</span>
                            <span style="display:block;font-size:14.5px;color:#8a7f6e;margin-top:1px">\${l.propCount}
                              · \${l.sentShort}</span>
                          </span>
                          <span style="\${l.statusStyle};flex:none">\${l.statusLabel}</span>
                        </span>
                        <span
                          style="display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:13px;border-top:1.5px dashed rgba(0,0,0,.1)">
                          <span
                            style="flex:1;min-width:0;font-size:16.5px;font-weight:800;letter-spacing:-.01em;\${l.openedColor};text-wrap:pretty">\${l.openedShort}</span>
                          <span
                            style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:800;color:#241f1c;flex:none">Open<i
                              class="ph-bold ph-arrow-right" style="font-size:16px"></i></span>
                        </span>
                      </button>
                    \`).join('') }
                  </div>
                  \${ lkNoCards ? \`
                    <div
                      style="padding:52px 36px;text-align:center;border-radius:24px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4;margin-top:14px">
                      <i class="ph-fill ph-paper-plane-tilt" style="font-size:44px;color:#c8b795"></i>
                      <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">No link matches this
                      </div>
                    </div>
                  \` : '' }
                </div>
              \` : '' }
            </div>
          \` : '' }

          \${ isAreas ? \`
            <div style="max-width:1680px;margin:0 auto;padding:26px 32px 70px">

              <div
                style="border-radius:28px;padding:32px 34px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
                  <div>
                    <div
                      style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">
                      \${dateStr}</div>
                    <h1
                      style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">
                      \${greeting}, \${ownerFirst}.</h1>
                    <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Only from your own presentations and the
                      links you sent.</p>
                  </div>
                  <a href="Client Presentation.dc.html"
                    style="display:flex;align-items:center;gap:11px;white-space:nowrap;height:62px;padding:0 26px;border-radius:16px;background:#f8a800;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)"
                    style-hover="background:#f4ae14"><i class="ph-fill ph-projector-screen-chart"
                      style="font-size:22px"></i>Show the map</a>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px">
                  <div
                    style="border-radius:20px;padding:20px 22px;background:#f8a800;background-image:linear-gradient(140deg,#ffdc7a,#f4ae14)">
                    <div
                      style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a6a14">
                      <i class="ph-fill ph-cursor-click" style="font-size:16px"></i>Opened while presenting</div>
                    <div
                      style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#241d0c;margin-top:6px">
                      \${dOpens}</div>
                  </div>
                  <div
                    style="border-radius:20px;padding:20px 22px;background:#6b3fd4;background-image:linear-gradient(140deg,#8a63e8,#5b32c4)">
                    <div
                      style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#d8c8ff">
                      <i class="ph-fill ph-paper-plane-tilt" style="font-size:16px"></i>Link opens</div>
                    <div
                      style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#fff;margin-top:6px">
                      \${dLinkOpens}</div>
                    <div style="font-size:13px;font-weight:700;color:#d8c8ff;margin-top:4px">\${dLinkSub}</div>
                  </div>
                  <div
                    style="border-radius:20px;padding:20px 22px;background:#12a150;background-image:linear-gradient(140deg,#2ec06b,#0b8f45)">
                    <div
                      style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9f0d9">
                      <i class="ph-fill ph-fire" style="font-size:16px"></i>Hottest area</div>
                    <div
                      style="font-family:'Newsreader',serif;font-weight:600;font-size:27px;line-height:1.15;color:#fff;margin-top:12px">
                      \${dHot}</div>
                    <div style="font-size:14px;font-weight:700;color:#c9f0d9;margin-top:3px">\${dHotSub}</div>
                  </div>
                </div>
              </div>

              <div
                style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;margin-top:18px;animation-delay:.06s">

                <div
                  style="min-width:0;background:#fff3d1;border:1.5px solid #f6e3ab;border-radius:24px;padding:24px 26px">
                  <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
                    <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">
                      Where buyers look</h3>
                    <span style="font-size:12.5px;font-weight:800;color:#8a6a14;white-space:nowrap">\${dOpens}
                      opens</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:18px;margin-top:16px;flex-wrap:wrap">
                    <div style="position:relative;width:230px;height:230px;flex:none;margin:4px auto 0">
                      <svg viewBox="0 0 200 200"
                        style="width:230px;height:230px;transform:rotate(-90deg);filter:drop-shadow(0 14px 26px rgba(31,26,18,.22))">
                        <circle cx="100" cy="100" r="70" fill="none" stroke="#fbe6ae" stroke-width="40"></circle>
                        \${ (pieSegs || []).map(g => \`
                          <circle cx="100" cy="100" r="70" fill="none" stroke="\${g.color}" stroke-width="40"
                            stroke-dasharray="\${g.dash2}" stroke-dashoffset="\${g.offset2}"></circle>
                        \`).join('') }
                        <circle cx="100" cy="100" r="50" fill="#fff9e8"></circle>
                      </svg>
                      <div
                        style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
                        <div
                          style="font-family:'Newsreader',serif;font-weight:600;font-size:44px;line-height:1;color:#241f1c">
                          \${pieTopPct}</div>
                        <div
                          style="font-size:13px;font-weight:800;color:#8a6a14;text-align:center;max-width:120px;line-height:1.25;margin-top:4px">
                          \${pieTopName}</div>
                      </div>
                    </div>
                    <div style="flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:6px">
                      \${ (pieTop || []).map(l => \`
                        <button onClick="\${__b(l.go)}"
                          style="display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border-radius:13px;cursor:pointer;background:#fff9e8;box-shadow:inset 0 0 0 1.5px #f6e3ab"
                          style-hover="background:#ffe9a8">
                          <span style="\${l.dotStyle}"></span>
                          <span
                            style="flex:1;min-width:0;text-align:left;font-size:16px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${l.city}</span>
                          <span style="\${l.miniBar}"></span>
                          <span
                            style="font-family:'Newsreader',serif;font-size:21px;font-weight:600;color:#241f1c;flex:none">\${l.pct}</span>
                        </button>
                      \`).join('') }
                    </div>
                  </div>
                </div>

                <div
                  style="min-width:0;background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:24px;padding:24px 26px">
                  <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
                    <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">
                      What gets opened most</h3>
                    <span style="font-size:12.5px;font-weight:800;color:#5b32c4;white-space:nowrap">by type</span>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:11px;margin-top:16px">
                    \${ (wantBars || []).map(w => \`
                      <div>
                        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
                          <span style="font-size:15.5px;font-weight:800;color:#241f1c">\${w.want}</span>
                          <span style="\${w.tagStyle}">\${w.tag}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:9px;margin-top:6px">
                          <div
                            style="flex:1;min-width:70px;height:16px;border-radius:999px;background:#ded0fa;overflow:hidden">
                            <div style="\${w.barStyle}"></div>
                          </div>
                          <span
                            style="font-family:'Newsreader',serif;font-size:20px;font-weight:600;color:#5b32c4;flex:none">\${w.opens}</span>
                        </div>
                      </div>
                    \`).join('') }
                  </div>
                </div>
              </div>

              <div style="margin-top:18px;animation-delay:.08s">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">
                  \${ (todayTiles || []).map(t => \`
                    <button onClick="\${__b(t.go)}" style="\${t.card}" style-hover="transform:translateY(-4px)">
                      <span style="\${t.glow}"></span>
                      <span style="position:relative;display:flex;align-items:center;gap:12px">
                        <span style="\${t.iconBox}"><i class="\${t.icon}" style="font-size:26px"></i></span>
                        <span style="\${t.kicker}">\${t.label}</span>
                      </span>
                      <span
                        style="position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:20px">
                        <span style="\${t.subStyle}">\${t.sub}</span>
                        <span style="\${t.numStyle}">\${t.count}</span>
                      </span>
                      <span style="\${t.footStyle}">\${t.foot}<i class="ph-bold ph-arrow-right"
                          style="font-size:16px"></i></span>
                    </button>
                  \`).join('') }
                </div>
              </div>

              <div
                style="\${demandTopBg};margin-top:18px;border-radius:22px;padding:22px 26px;display:flex;align-items:center;gap:16px;animation-delay:.1s">
                <i class="\${demandTopIcon}" style="font-size:32px;\${demandTopTag};flex:none"></i>
                <div>
                  <div
                    style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;\${demandTopTag}">
                    \${demandTopKicker} · \${demandTopName}</div>
                  <div style="font-size:17px;color:#4c463d;line-height:1.45;margin-top:4px;max-width:820px">\${demandTopLine}</div>
                </div>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin:30px 0 14px">
                <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a8070">
                  Plots pulling the most attention</div>
                <span
                  style="font-size:12.5px;font-weight:800;color:#8a6a14;background:#fff3d1;border-radius:999px;padding:5px 13px">From
                  your presentations</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px">
                \${ (attentionRows || []).map(a => \`
                  <button onClick="\${__b(a.go)}" style="\${a.cardStyle}" style-hover="transform:translateY(-3px)">
                    <span style="\${a.photoStyle}">
                      <span style="\${a.rankStyle}">\${a.rank}</span>
                      <span
                        style="position:absolute;left:0;right:0;bottom:0;padding:22px 10px 9px;background:linear-gradient(180deg,rgba(20,14,2,0),rgba(20,14,2,.86));display:flex;align-items:flex-end;justify-content:space-between;gap:6px">
                        <span
                          style="font-family:'Newsreader',serif;font-weight:600;font-size:23px;line-height:1;color:#f8c200">\${a.views}</span>
                        <span style="font-size:11px;font-weight:800;color:#f4e5c4;letter-spacing:.04em">OPENS</span>
                      </span>
                    </span>
                    <span
                      style="display:block;padding:10px 12px 4px;font-size:14.5px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">\${a.loc}</span>
                    <span
                      style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 12px">
                      <span style="font-family:'Newsreader',serif;font-weight:600;font-size:17px;color:#c85a1a">\${a.priceFmt}</span>
                      <span style="\${a.dotStyle}" title="\${a.chip}"></span>
                    </span>
                  </button>
                \`).join('') }
              </div>
            </div>
          \` : '' }

          \${ celebrate ? \`
            <div
              style="position:fixed;inset:0;z-index:200;overflow:hidden;background:#eaf8ef;background-image:radial-gradient(70% 60% at 18% 6%,rgba(46,196,116,.4),transparent 62%),radial-gradient(58% 52% at 90% 96%,rgba(255,214,102,.5),transparent 66%),linear-gradient(160deg,#f4fcf7,#def3e6 58%,#cfeeda);animation:moneyWash .45s ease both">
              <div style="position:absolute;inset:0;overflow:hidden">
                \${ (celebrate.glyphs || []).map(g => \`
                  <span style="\${g.style}">₹</span>
                \`).join('') }
              </div>
              <div
                style="position:absolute;left:50%;top:50%;width:760px;height:760px;margin:-380px 0 0 -380px;border-radius:50%;background:radial-gradient(circle,rgba(26,155,82,.26),transparent 68%);animation:moneyHalo 3.4s ease-in-out infinite">
              </div>
              <div
                style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center">
                <div style="\${celebrate.stampStyle}">\${celebrate.stamp}</div>
                <div
                  style="font-size:12.5px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#12a150;margin-top:34px;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s">
                  \${celebrate.kicker}</div>
                <h2
                  style="margin:12px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.015em;color:#0e3d22;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.24s">
                  \${celebrate.title}</h2>
                <div
                  style="font-size:17px;font-weight:600;color:#4a7a5c;margin-top:7px;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.28s">
                  \${celebrate.sub}</div>
                <div
                  style="font-family:'Newsreader',serif;font-weight:500;font-size:104px;line-height:1;color:#0a5b2e;margin-top:26px;text-shadow:0 22px 50px rgba(11,111,57,.25);white-space:nowrap;animation:moneyUp .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.34s">
                  \${celebrate.amount}</div>
                <div
                  style="display:inline-flex;align-items:center;gap:10px;margin-top:20px;padding:12px 22px;border-radius:999px;background:#0b6f39;color:#eafff2;font-size:17px;font-weight:800;animation:moneyUp .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.4s">
                  <i class="ph-fill ph-coins" style="font-size:20px;color:#f8c200"></i>\${celebrate.commLine}</div>
                <div
                  style="display:flex;align-items:center;gap:12px;margin-top:40px;animation:moneyUp .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.46s">
                  <button onClick="\${__b(celebrate.close)}"
                    style="display:flex;align-items:center;gap:10px;height:60px;padding:0 30px;border-radius:16px;background:#0b6f39;color:#eafff2;font-size:17px;font-weight:800;box-shadow:0 16px 32px -16px rgba(11,111,57,.9)"
                    style-hover="background:#0a5b2e"><i class="ph-bold ph-check" style="font-size:19px"></i>\${celebrate.doneLabel}</button>
                  <button onClick="\${__b(celebrate.goDeals)}"
                    style="display:flex;align-items:center;gap:10px;height:60px;padding:0 26px;border-radius:16px;background:#fff;color:#0b6f39;font-size:17px;font-weight:800;box-shadow:inset 0 0 0 1px #a6e3c0"
                    style-hover="background:#d9f5e3"><i class="ph-fill ph-handshake" style="font-size:20px"></i>See my
                    deals</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ dealDetail ? \`
            <div
              style="position:fixed;inset:0;z-index:87;display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden">
              <div onClick="\${__b(closeDeal)}"
                style="position:absolute;inset:0;background:rgba(26,18,6,.62);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:1280px;max-width:100%;height:100%;max-height:940px;display:flex;flex-direction:column;overflow:hidden;background:#f5f1fd;border-radius:28px;box-shadow:0 50px 110px -30px rgba(0,0,0,.7);">

                <div style="\${dd.headStyle}">
                  <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
                    <span style="\${dd.avStyle}">\${dd.initials}</span>
                    <div style="flex:1;min-width:220px">
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                        <h2
                          style="margin:0;font-family:'Newsreader',serif;font-weight:600;font-size:32px;line-height:1.1;color:#ffffff">
                          \${dd.title}</h2>
                        <span style="\${dd.stagePill}"><i class="\${dd.stageIcon}" style="font-size:16px"></i>\${dd.stageLabel}</span>
                      </div>
                      <div style="font-size:16px;font-weight:600;color:#dbeafe;margin-top:4px">\${dd.sub}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:22px;flex:none;flex-wrap:nowrap">
                      <div>
                        <div
                          style="font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fde047">
                          Deal value</div>
                        <div
                          style="font-family:'Newsreader',serif;font-weight:600;font-size:34px;line-height:1.05;color:#ffffff">
                          \${dd.valueFmt}</div>
                      </div>
                      <div>
                        <div
                          style="font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#86efac">
                          Expected commission</div>
                        <div
                          style="font-family:'Newsreader',serif;font-weight:600;font-size:34px;line-height:1.05;color:#ffffff">
                          \${dd.commFmt}</div>
                      </div>
                      <button onClick="\${__b(closeDeal)}" title="Close"
                        style="width:48px;height:48px;border-radius:14px;background:#f8a800;color:#241d0c;display:grid;place-items:center;flex:none;border:none;cursor:pointer;"
                        style-hover="background:#e69a00"><i class="ph-bold ph-x" style="font-size:22px"></i></button>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:9px;margin-top:14px;flex-wrap:wrap">
                    <div style="display:inline-flex;align-items:center;padding:4px;border-radius:14px;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3);gap:4px">
                      \${ (dd.tabs || []).map(t => \`<button onClick="\${__b(t.go)}"
                          style="\${t.style}"><i class="\${t.icon}" style="font-size:18px"></i>\${t.label}\${ t.hasBadge ? \`<span style="\${t.badge}">\${t.count}</span>\` : '' }</button>\`).join('') }
                    </div>
                    <div style="flex:1"></div>
                    <div style="display:flex;align-items:center;gap:9px;flex:none">
                      <a href="\${dd.tel}" title="Call buyer"
                        style="display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:#0b6f39;background-image:linear-gradient(140deg,#25b567,#0b6f39 55%,#06552b);color:#eafff2;flex:none;text-decoration:none"><i
                          class="ph-fill ph-phone" style="font-size:20px"></i></a>
                      <a href="\${dd.wa}" target="_blank" title="WhatsApp"
                        style="display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:#e3f4e9;color:#0a6634;flex:none;text-decoration:none"
                        style-hover="background:#d0ecda"><i class="ph-fill ph-whatsapp-logo"
                          style="font-size:20px"></i></a>
                      \${ dd.notClosed ? \`<button
                          onClick="\${__b(dd.update)}" title="Update this deal"
                          style="display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:#f8a800;color:#241d0c;flex:none;border:none;cursor:pointer;"
                          style-hover="background:#e69a00"><i class="ph-fill ph-pencil-simple"
                            style="font-size:20px"></i></button>\` : '' }
                    </div>
                  </div>
                </div>

                <div data-scroll=""
                  style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:16px 24px 20px">

                  \${ dd.isOverview ? \`
                    <div
                      style="border-radius:22px;background:linear-gradient(135deg, #f0f7ff, #e4f1fc);box-shadow:0 0 0 1.5px #bfdbfe;padding:16px 20px 18px;margin-bottom:16px">
                      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                        <span
                          style="width:38px;height:38px;border-radius:11px;background:#1d4ed8;color:#fff;display:grid;place-items:center;flex:none"><i
                            class="ph-fill ph-flag-banner" style="font-size:19px"></i></span>
                        <div style="flex:1;min-width:180px">
                          <div style="font-size:18px;font-weight:800;color:#1e3a8a">Where this deal stands</div>
                          <div style="font-size:14px;font-weight:700;color:#3b82f6">Tap a stage to move the deal</div>
                        </div>
                        <span style="font-size:14px;font-weight:700;color:#60a5fa;flex:none">\${dd.updatedAgo}</span>
                      </div>
                      <div style="display:flex;align-items:stretch;gap:6px;margin-top:14px;flex-wrap:wrap">
                        \${ (dd.pipeline || []).map(p => \`
                          <button onClick="\${__b(p.go)}" style="\${p.card}" style-hover="transform:translateY(-3px)">
                            <span style="\${p.iconBox}"><i class="\${p.icon}" style="font-size:20px"></i></span>
                            <span style="\${p.labelStyle}">\${p.label}</span>
                            <span style="\${p.whenStyle}">\${p.when}</span>
                          </button>
                          <span style="\${p.linkStyle}"></span>
                        \`).join('') }
                      </div>
                    </div>

                    \${ dd.hasFlags ? \`

                    \` : '' }

                    \${ dd.hasLinkAct ? \`

                    \` : '' }

                    \${ dd.isLost ? \`
                      <div
                        style="margin-top:16px;border-radius:22px;background:#fff6f6;box-shadow:inset 0 0 0 2px #f3c7cc;padding:20px 22px">
                        <div
                          style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#b02a37">
                          Why it did not happen</div>
                        <div style="font-size:23px;font-weight:800;color:#241f1c;margin-top:8px">\${dd.lostReason}
                        </div>
                        <div style="font-size:16px;font-weight:600;color:#7a6f60;margin-top:4px">Marked lost on \${dd.lostOn} · was at \${dd.lastStageLabel}</div>
                      </div>
                    \` : '' }
                  \` : '' }

                  \${ dd.isMoney ? \`
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
                      <div
                        style="border-radius:24px;background:#0a6634;background-image:linear-gradient(145deg,#17a05c,#075c32);padding:22px 24px 24px;color:#eafff2">
                        <div
                          style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#a8e3c3">
                          Expected commission</div>
                        <div
                          style="font-family:'Newsreader',serif;font-weight:600;font-size:56px;line-height:1;margin-top:8px">
                          \${dd.commFmt}</div>
                        <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
                          \${ (dd.commRows || []).map(r => \`
                            <div
                              style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.12)">
                              <span style="flex:1;min-width:0;font-size:16px;font-weight:800">\${r.label}</span>
                              <span style="font-family:'Newsreader',serif;font-size:23px;font-weight:600;flex:none">\${r.value}</span>
                            </div>
                          \`).join('') }
                        </div>
                        <div style="\${dd.commStateStyle}"><i class="\${dd.commStateIcon}"
                            style="font-size:18px"></i>\${dd.commState}</div>
                      </div>

                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:11px;padding:14px 20px;background:#e1ecfb">
                          <span
                            style="width:40px;height:40px;border-radius:13px;background:#1a5aa8;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-currency-inr" style="font-size:20px"></i></span>
                          <div>
                            <div style="font-size:18.5px;font-weight:800;color:#241f1c">Buyer to seller</div>
                            <div style="font-size:14.5px;font-weight:700;color:#1a5aa8">This is their money, not yours
                            </div>
                          </div>
                        </div>
                        <div style="padding:18px 20px 22px;display:flex;flex-direction:column;gap:11px">
                          \${ (dd.txRows || []).map(r => \`
                            <div
                              style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:15px;background:linear-gradient(135deg, #f0f7ff, #e4f0fc);box-shadow:inset 0 0 0 1.5px #c8dff8">
                              <span style="flex:1;min-width:0;font-size:16.5px;font-weight:800;color:#241f1c">\${r.label}</span>
                              <span
                                style="font-family:'Newsreader',serif;font-size:24px;font-weight:600;color:#241f1c;flex:none">\${r.value}</span>
                            </div>
                          \`).join('') }
                        </div>
                      </div>
                    </div>

                    <div
                      style="margin-top:16px;border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">

                      <div style="padding:16px 20px 20px;display:flex;flex-direction:column;gap:10px">
                        \${ (dd.payRows || []).map(p => \`
                          <div
                            style="display:flex;align-items:center;gap:13px;padding:13px 16px;border-radius:15px;background:linear-gradient(135deg, #f4fbf7, #e6f7ee);box-shadow:inset 0 0 0 1.5px #c0e8d2">
                            <span style="\${p.iconStyle}"><i class="\${p.icon}" style="font-size:18px"></i></span>
                            <span style="flex:1;min-width:0">
                              <span style="display:block;font-size:16.5px;font-weight:800;color:#241f1c">\${p.label}</span>
                              <span style="display:block;font-size:14.5px;color:#8a7f6e">\${p.sub}</span>
                            </span>
                            <span
                              style="font-family:'Newsreader',serif;font-size:25px;font-weight:600;color:#241f1c;flex:none">\${p.amt}</span>
                          </div>
                        \`).join('') }
                        \${ dd.noPay ? \`
                          <div
                            style="padding:26px 8px;text-align:center;font-size:16.5px;font-weight:700;color:#a89e8b">No
                            money has moved yet on this deal.</div>
                        \` : '' }
                      </div>
                    </div>
                  \` : '' }

                  \${ dd.isPeople ? \`
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:18px;margin-top:24px">
                      \${ (dd.people || []).map(p => \`
                        <div style="\${p.card}">
                          <div style="display:flex;align-items:center;gap:12px">
                            <span style="\${p.iconBox}"><i class="\${p.icon}" style="font-size:21px"></i></span>
                            <div style="flex:1;min-width:0">
                              <div style="\${p.kicker}">\${p.role}</div>
                              <div
                                style="font-size:21px;font-weight:800;color:#241f1c;line-height:1.2;margin-top:2px;text-wrap:balance">
                                \${p.name}</div>
                            </div>
                          </div>
                          <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
                            \${ (p.rows || []).map(r => \`
                              <div style="display:flex;align-items:center;gap:10px;font-size:16px;color:#4b4239"><i
                                  class="\${r.icon}" style="font-size:17px;color:#8a7f6e;flex:none"></i><span
                                  style="flex:1;min-width:0;font-weight:700">\${r.label}</span><span
                                  style="font-weight:800;color:#241f1c">\${r.value}</span></div>
                            \`).join('') }
                          </div>
                          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:15px">
                            \${ (p.acts || []).map(a => \`<button onClick="\${__b(a.go)}"
                                style="\${a.style}"><i class="\${a.icon}" style="font-size:16px"></i>\${a.label}</button>\`).join('') }
                          </div>
                        </div>
                      \`).join('') }
                    </div>
                  \` : '' }

                  \${ dd.isPapers ? \`
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px">
                      <!-- Property Papers Box -->
                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:11px;padding:14px 20px;background:#e1ecfb;flex-wrap:wrap">
                          <span
                            style="width:40px;height:40px;border-radius:13px;background:#1a5aa8;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-buildings" style="font-size:20px"></i></span>
                          <div style="flex:1;min-width:140px">
                            <div style="font-size:18.5px;font-weight:800;color:#241f1c">Property papers</div>
                            <div style="font-size:14.5px;font-weight:700;color:#1a5aa8">Already on property record</div>
                          </div>
                          <button onClick="\${__b(dd.addPropDoc)}"
                            style="display:flex;align-items:center;gap:7px;height:42px;padding:0 15px;border-radius:12px;background:#1a5aa8;color:#fff;font-size:14.5px;font-weight:800;white-space:nowrap;flex:none;border:none;cursor:pointer;"
                            style-hover="background:#154a8c"><i class="ph-bold ph-plus"
                              style="font-size:16px"></i>Add</button>
                        </div>
                        <div style="padding:16px 18px 20px">
                          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                            \${ (dd.propDocs || []).map(p => \`
                              <button onClick="\${__b(p.go)}" style="\${p.cardStyle}" style-hover="transform:translateY(-3px)">
                                <div style="height:105px;background:linear-gradient(180deg,#ffffff,#f1f5f9);padding:12px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">
                                  <div style="display:flex;align-items:center;justify-content:space-between">
                                    <span style="\${p.badgeStyle}"><i class="ph-fill ph-seal-check" style="font-size:13px"></i>\${p.badge}</span>
                                    <span style="width:28px;height:28px;border-radius:8px;background:rgba(37,99,235,.1);color:#2563eb;display:grid;place-items:center"><i class="ph-bold ph-arrows-out-simple" style="font-size:14px"></i></span>
                                  </div>
                                  <div style="display:flex;align-items:center;justify-content:center;gap:8px;opacity:.7">
                                    <i class="ph-fill ph-stamp" style="font-size:32px;color:#3b82f6"></i>
                                    <div style="font-size:10px;font-weight:800;color:#1e40af;letter-spacing:.06em;text-transform:uppercase;line-height:1.2">GOVT OF PUNJAB<br>SUB-REGISTRAR</div>
                                  </div>
                                  <div style="font-size:11px;font-weight:700;color:#64748b">\${p.date}</div>
                                </div>
                                <div style="\${p.bannerStyle}">
                                  <span style="flex:1;min-width:0;font-size:14.5px;font-weight:800;\${p.nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${p.name}</span>
                                  <i class="ph-bold ph-arrow-up-right" style="font-size:14px;color:#2563eb;flex:none"></i>
                                </div>
                              </button>
                            \`).join('') }
                          </div>
                        </div>
                      </div>

                      <!-- Deal Papers Box -->
                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:11px;padding:14px 20px;background:#ede4ff;flex-wrap:wrap">
                          <span
                            style="width:40px;height:40px;border-radius:13px;background:#5b32c4;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-handshake" style="font-size:20px"></i></span>
                          <div style="flex:1;min-width:140px">
                            <div style="font-size:18.5px;font-weight:800;color:#241f1c">Deal papers</div>
                            <div style="font-size:14.5px;font-weight:700;color:#5b32c4">Specific to this sale</div>
                          </div>
                          <button onClick="\${__b(dd.addDealDoc)}"
                            style="display:flex;align-items:center;gap:7px;height:42px;padding:0 15px;border-radius:12px;background:#5b32c4;color:#fff;font-size:14.5px;font-weight:800;white-space:nowrap;flex:none;border:none;cursor:pointer;"
                            style-hover="background:#4a2699"><i class="ph-bold ph-plus"
                              style="font-size:16px"></i>Add</button>
                        </div>
                        <div style="padding:16px 18px 20px">
                          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                            \${ (dd.dealDocs || []).map(p => \`
                              <button onClick="\${__b(p.go)}" style="\${p.cardStyle}" style-hover="transform:translateY(-3px)">
                                <div style="height:105px;background:linear-gradient(180deg,#ffffff,#f8fafc);padding:12px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">
                                  <div style="display:flex;align-items:center;justify-content:space-between">
                                    <span style="\${p.badgeStyle}"><i class="ph-fill ph-seal-check" style="font-size:13px"></i>\${p.badge}</span>
                                    <span style="width:28px;height:28px;border-radius:8px;background:rgba(0,0,0,.06);color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-arrows-out-simple" style="font-size:14px"></i></span>
                                  </div>
                                  <div style="display:flex;align-items:center;justify-content:center;gap:8px;opacity:.75">
                                    <i class="ph-fill ph-file-text" style="font-size:32px;color:#64748b"></i>
                                    <div style="font-size:10px;font-weight:800;color:#334155;letter-spacing:.06em;text-transform:uppercase;line-height:1.2">LEGAL DEED<br>MAPCO ROOM</div>
                                  </div>
                                  <div style="font-size:11px;font-weight:700;color:#64748b">\${p.date}</div>
                                </div>
                                <div style="\${p.bannerStyle}">
                                  <span style="flex:1;min-width:0;font-size:14.5px;font-weight:800;\${p.nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${p.name}</span>
                                  <i class="ph-bold ph-arrow-up-right" style="font-size:14px;color:#10b981;flex:none"></i>
                                </div>
                              </button>
                            \`).join('') }
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Full Document Modal Viewer Overlay -->
                    \${ dd.hasViewDoc ? \`
                      <div style="position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.85);animation:omVeil .2s ease both">
                        <div style="position:relative;width:920px;max-width:100%;height:92vh;max-height:860px;background:#ffffff;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;">
                          <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;background:#0f172a;color:#ffffff;flex:none">
                            <button onClick="\${__b(dd.closeViewDoc)}" style="display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:12px;background:linear-gradient(135deg, #2563eb, #1d4ed8);color:#ffffff;font-size:15px;font-weight:800;border:none;cursor:pointer;" style-hover="background:#1d4ed8">
                              <i class="ph-bold ph-arrow-left" style="font-size:18px"></i> Back
                            </button>
                            <div style="text-align:center;flex:1;min-width:0;padding:0 16px">
                              <div style="font-size:17.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${dd.viewDoc.name}</div>
                              <div style="font-size:13px;color:#94a3b8">\${dd.viewDoc.property} · \${dd.viewDoc.category}</div>
                            </div>
                            <button onClick="\${__b(dd.closeViewDoc)}" style="width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.15);color:#ffffff;display:grid;place-items:center;border:none;cursor:pointer;" style-hover="background:rgba(255,255,255,.25)"><i class="ph-bold ph-x" style="font-size:20px"></i></button>
                          </div>
                          <div data-scroll="" style="flex:1;min-height:0;overflow-y:auto;padding:28px 36px;background:#f8fafc;display:flex;justify-content:center">
                            <div style="width:100%;max-width:760px;background:#ffffff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08), 0 0 0 1px #e2e8f0;padding:36px 42px;display:flex;flex-direction:column;gap:20px">
                              <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:18px;border-bottom:2px solid #0f172a">
                                <div>
                                  <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#2563eb">\${dd.viewDoc.category}</div>
                                  <div style="font-family:'Newsreader',serif;font-size:28px;font-weight:700;color:#0f172a;margin-top:2px">\${dd.viewDoc.name}</div>
                                </div>
                                <div style="text-align:right">
                                  <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:13px;font-weight:800;box-shadow:0 0 0 1px #86efac"><i class="ph-fill ph-seal-check"></i> OFFICIAL RECORD</span>
                                  <div style="font-size:13px;color:#64748b;font-weight:600;margin-top:4px">Verified on MAPCO Platform</div>
                                </div>
                              </div>
                              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f8fafc;padding:16px 20px;border-radius:14px;border:1px solid #e2e8f0">
                                <div><span style="display:block;font-size:12px;color:#64748b;font-weight:700">PROPERTY</span><span style="display:block;font-size:15px;font-weight:800;color:#0f172a;margin-top:2px">\${dd.viewDoc.property}</span></div>
                                <div><span style="display:block;font-size:12px;color:#64748b;font-weight:700">PARTY / CLIENT</span><span style="display:block;font-size:15px;font-weight:800;color:#0f172a;margin-top:2px">\${dd.viewDoc.dealName}</span></div>
                              </div>
                              <div style="padding:24px 28px;border-radius:14px;background:#fffdf7;border:1.5px dashed #cbd5e1;display:flex;flex-direction:column;gap:12px">
                                <div style="display:flex;align-items:center;gap:12px">
                                  <div style="width:48px;height:48px;border-radius:50%;background:#fef3c7;color:#d97706;display:grid;place-items:center;font-size:24px;flex:none;box-shadow:0 0 0 4px #fef9c3"><i class="ph-fill ph-stamp"></i></div>
                                  <div>
                                    <div style="font-size:16px;font-weight:800;color:#1e293b">\${dd.viewDoc.seal}</div>
                                    <div style="font-size:13px;color:#64748b;font-weight:600">Registered Stamp Certificate & Legal Authentication Copy</div>
                                  </div>
                                </div>
                                <div style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">
                                  This document is securely indexed and preserved on the MAPCO real estate ledger. Both buyer and seller parties have verified the terms and legal identification attached to this property instrument.
                                </div>
                              </div>
                              <div style="display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid #e2e8f0;margin-top:auto">
                                <div style="font-size:13px;color:#94a3b8">Doc ID: MP-DOC-8942 · Encrypted Ledger Verified</div>
                                <div style="display:flex;align-items:center;gap:10px">
                                  <button onClick="\${__b(dd.closeViewDoc)}" style="display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 18px;border-radius:12px;background:#0f172a;color:#ffffff;font-size:14.5px;font-weight:800;border:none;cursor:pointer;"><i class="ph-bold ph-arrow-left"></i> Back</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    \` : '' }
                  \` : '' }

                  \${ dd.pickerOpen ? \`
                    <div
                      style="margin-top:16px;border-radius:22px;background:#fffdf7;box-shadow:inset 0 0 0 2px #f0d493;padding:20px 22px">
                      <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
                        <div style="flex:1;min-width:180px">
                          <div style="font-size:18.5px;font-weight:800;color:#241f1c">\${dd.pickerTitle}</div>
                          <div style="font-size:14.5px;font-weight:700;color:#8a7f6e">\${dd.pickerSub}</div>
                        </div>
                        <button onClick="\${__b(dd.pickerClose)}"
                          style="width:44px;height:44px;border-radius:12px;background:#f3ece0;color:#6b6156;display:grid;place-items:center;flex:none"
                          style-hover="background:#eadfcb"><i class="ph-bold ph-x" style="font-size:19px"></i></button>
                      </div>
                      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:14px">
                        \${ (dd.pickerOpts || []).map(o => \`<button
                            onClick="\${__b(o.go)}" style="\${o.style}"><i class="\${o.icon}"
                              style="font-size:17px"></i>\${o.label}</button>\`).join('') }
                      </div>
                    </div>
                  \` : '' }

                  \${ dd.isTimeline ? \`
                    <div
                      style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;padding:22px 24px 26px">
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e">
                        Everything that happened</div>
                      <div style="display:flex;flex-direction:column;gap:0;margin-top:16px">
                        \${ (dd.timeline || []).map(t => \`
                          <div style="display:flex;gap:15px">
                            <div style="display:flex;flex-direction:column;align-items:center;flex:none;width:44px">
                              <span style="\${t.dot}"><i class="\${t.icon}" style="font-size:18px"></i></span>
                              <span style="\${t.line}"></span>
                            </div>
                            <div style="flex:1;min-width:0;padding-bottom:20px">
                              <div style="font-size:14px;font-weight:800;color:#a3541b">\${t.when}</div>
                              <div
                                style="font-size:17.5px;font-weight:800;color:#241f1c;margin-top:2px;text-wrap:pretty">
                                \${t.text}</div>
                            </div>
                          </div>
                        \`).join('') }
                      </div>
                    </div>
                  \` : '' }

                </div>
              </div>
            </div>
          \` : '' }

          \${ dealLostOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:92;display:flex;align-items:center;justify-content:center;padding:20px">
              <div onClick="\${__b(closeLost)}" style="position:absolute;inset:0;background:rgba(40,10,14,.6)"></div>
              <div
                style="position:relative;width:460px;max-width:100%;background:#fff6f6;border-radius:24px;padding:26px 28px 28px;box-shadow:0 40px 90px -30px rgba(0,0,0,.6)">
                <div style="font-size:24px;font-weight:800;color:#241f1c">Why did it fall through?</div>
                <div style="font-size:16px;color:#7a6f60;margin-top:5px">The deal stays in your book so you can look
                  back.</div>
                <div style="display:flex;flex-direction:column;gap:9px;margin-top:18px">
                  \${ (lostOpts || []).map(o => \`<button onClick="\${__b(o.go)}"
                      style="display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:15px 17px;border-radius:15px;background:#fff;color:#241f1c;font-size:17px;font-weight:800;box-shadow:inset 0 0 0 1.5px #f3c7cc"
                      style-hover="background:#ffeff0"><i class="ph-fill ph-x-circle"
                        style="font-size:19px;color:#b02a37"></i>\${o.label}</button>\`).join('') }
                </div>
                <button onClick="\${__b(closeLost)}"
                  style="width:100%;height:52px;border-radius:14px;background:#f0e6e6;color:#6b6156;font-size:16.5px;font-weight:800;margin-top:16px">Keep
                  it open</button>
              </div>
            </div>
          \` : '' }

          \${ ldOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:87;display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden">
              <div onClick="\${__b(closeLd)}"
                style="position:absolute;inset:0;background:rgba(20,10,40,.72);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:1100px;max-width:100%;height:100%;display:flex;flex-direction:column;background:#f5f1fd;border-radius:26px;overflow:hidden;box-shadow:0 50px 110px -30px rgba(0,0,0,.8);">

                <!-- Purple header -->
                <div
                  style="flex:none;display:flex;align-items:center;gap:16px;padding:22px 28px;background:linear-gradient(135deg, #3b0764, #4c1d95 50%, #2e1065);color:#ffffff;box-shadow:0 10px 30px -10px rgba(59,7,100,.7);flex-wrap:wrap">
                  <span
                    style="width:62px;height:62px;border-radius:18px;background:rgba(255,255,255,.18);color:#ffffff;border:1.5px solid rgba(255,255,255,.3);display:grid;place-items:center;font-size:22px;font-weight:800;flex:none">\${ld.initials}</span>
                  <div style="flex:1 1 200px;min-width:0">
                    <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
                      <h2
                        style="margin:0;font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1.14;letter-spacing:-.02em;color:#ffffff">
                        \${ld.client}</h2>
                      <span style="\${ld.statusStyle};flex:none">\${ld.statusLabel}</span>
                    </div>
                    <div style="font-size:15.5px;color:#ddd6fe;margin-top:4px">\${ld.sub} · \${ld.propCount}</div>
                    <div style="\${ld.openedStyle};margin-top:5px">\${ld.opened}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:9px;flex-wrap:nowrap;justify-content:flex-end;flex:none">
                    <button onClick="\${__b(ld.goClient)}" title="Open client"
                      style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.18);color:#ffffff;border:1.5px solid rgba(255,255,255,.25);flex:none;cursor:pointer"
                      style-hover="background:rgba(255,255,255,.28)"><i class="ph-fill ph-user-circle"
                        style="font-size:21px"></i></button>
                    <button onClick="\${__b(ld.preview)}" title="Preview their page"
                      style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.18);color:#e9d5ff;border:1.5px solid rgba(255,255,255,.25);flex:none;cursor:pointer"
                      style-hover="background:rgba(255,255,255,.28)"><i class="ph-fill ph-device-mobile"
                        style="font-size:20px"></i></button>
                    <a href="\${ld.wa}" target="_blank" title="WhatsApp"
                      style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.18);color:#34d399;border:1.5px solid rgba(52,211,153,.35);flex:none;text-decoration:none"
                      style-hover="background:rgba(255,255,255,.28)"><i class="ph-fill ph-whatsapp-logo"
                        style="font-size:21px"></i></a>
                    \${ ld.isLive ? \`<button onClick="\${__b(ld.revoke)}" title="Revoke link"
                        style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(255,60,60,.22);color:#fca5a5;border:1.5px solid rgba(252,165,165,.3);flex:none;cursor:pointer"
                        style-hover="background:rgba(255,60,60,.32)"><i class="ph ph-prohibit"
                          style="font-size:20px"></i></button>\` : '' }
                    <button onClick="\${__b(closeLd)}"
                      style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.2);color:#ffffff;display:grid;place-items:center;border:none;cursor:pointer"
                      style-hover="background:rgba(255,255,255,.3)"><i class="ph-bold ph-x"
                        style="font-size:20px"></i></button>
                  </div>
                </div>

                <!-- Dark purple tab bar -->
                <div data-scroll=""
                  style="flex:none;display:flex;align-items:center;gap:9px;padding:10px 24px;background:linear-gradient(180deg,#2e1065 0%,#1e0a45 100%);border-bottom:2px solid rgba(255,255,255,.08);overflow-x:auto">
                  \${ (ldTabs || []).map(t => \`<button onClick="\${__b(t.go)}"
                      style="\${t.style}">\${t.label}</button>\`).join('') }
                </div>

                <!-- Content area -->
                <div data-scroll=""
                  style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:20px 24px 44px;background:#f5f1fd">

                  <!-- Tab: What they looked at -->
                  \${ ldTabFocus ? \`
                    <div>

                      <!-- Important actions callout -->
                      \${ ld.hasReasons ? \`
                        <div
                          style="margin-bottom:16px;padding:16px 20px;border-radius:20px;background:#fff5e6;box-shadow:inset 0 0 0 1.5px #f5c9a0">
                          <div
                            style="font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b;margin-bottom:10px">
                            Important actions</div>
                          <div style="display:flex;flex-wrap:wrap;gap:8px">
                            \${ (ld.reasons || []).map(r => \`<span
                                style="\${r.style}"><i class="\${r.icon}"
                                  style="font-size:16px"></i>\${r.label}\${ r.when ? \`<span
                                    style="opacity:.7"> · \${r.when}</span>\` : '' }</span>\`).join('') }
                          </div>
                        </div>
                      \` : '' }

                      <!-- Property rows -->
                      <div
                        style="font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#6d28d9;margin-bottom:10px">
                        Properties in this link</div>
                      <div style="display:flex;flex-direction:column;gap:11px">
                        \${ (ld.propRows || []).map(p => \`
                          <div style="\${p.rowStyle}">
                            <span style="\${p.thumb}"></span>
                            <span style="flex:1;min-width:0">
                              <span style="display:block;font-size:17.5px;font-weight:800;\${p.titleColor}">\${p.title}</span>
                              <span style="display:block;font-size:14.5px;\${p.subColor};margin-top:2px">\${p.loc}</span>
                              <span style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">
                                \${ (p.extra || []).map(e => \`<span
                                    style="\${e.style}"><i class="\${e.icon}"
                                      style="font-size:15px"></i>\${e.label}</span>\`).join('') }
                              </span>
                            </span>
                            <span style="text-align:right;flex:none;min-width:80px">
                              <span style="display:block;\${p.viewStyle}">\${p.viewLine}</span>
                              <span style="display:block;font-size:13.5px;color:#8a8073;margin-top:3px">\${p.whenLine}</span>
                            </span>
                          </div>
                        \`).join('') }
                      </div>
                    </div>
                  \` : '' }

                  <!-- Tab: Full history -->
                  \${ ldTabTime ? \`
                    <div>
                      \${ ld.hasTimeline ? \`
                        <div style="display:flex;flex-direction:column;gap:9px">
                          \${ (ld.timeline || []).map(a => \`
                            <div
                              style="display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:16px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #ecdcc0">
                              <span style="\${a.iconStyle}"><i class="\${a.icon}"></i></span>
                              <span
                                style="flex:1;min-width:0;font-size:16.5px;font-weight:800;color:#241f1c;text-wrap:pretty">\${a.text}</span>
                              <span style="font-size:14.5px;color:#8a7f6e;flex:none">\${a.when}</span>
                            </div>
                          \`).join('') }
                        </div>
                      \` : '' }
                      \${ ldNoTimeline ? \`
                        <div
                          style="padding:52px 30px;text-align:center;border-radius:22px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #e6d6b4">
                          <i class="ph-fill ph-clock-counter-clockwise" style="font-size:44px;color:#c8b795"></i>
                          <div style="font-size:20px;font-weight:800;color:#241f1c;margin-top:12px">Nothing has
                            happened yet</div>
                          <div style="font-size:15.5px;color:#6b6156;margin-top:5px">This link has not been opened.
                          </div>
                        </div>
                      \` : '' }
                    </div>
                  \` : '' }

                </div>
              </div>
            </div>
          \` : '' }
          \${ cpOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:86;display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden">
              <div onClick="\${__b(cp.close)}"
                style="position:absolute;inset:0;background:rgba(40,26,2,.68);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:1240px;max-width:100%;height:100%;display:flex;flex-direction:column;background:#f5f1fd;border-radius:26px;overflow:hidden;box-shadow:0 50px 110px -30px rgba(0,0,0,.78);">

                <div
                  style="flex:none;display:flex;align-items:center;gap:16px;padding:20px 28px;background:linear-gradient(135deg, #4c1d95, #5b21b6 55%, #311068);color:#ffffff;box-shadow:0 10px 30px -10px rgba(76,29,149,.6);flex-wrap:wrap">
                  <span style="width:62px;height:62px;border-radius:18px;background:rgba(255,255,255,.18);color:#ffffff;border:1.5px solid rgba(255,255,255,.3);display:grid;place-items:center;font-size:22px;font-weight:800;flex:none">\${cp.initials}</span>
                  <div style="flex:1 1 200px;min-width:0">
                    <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
                      <h2
                        style="margin:0;font-family:'Newsreader',serif;font-weight:600;font-size:32px;line-height:1.14;letter-spacing:-.02em;color:#ffffff">
                        \${cp.name}</h2>
                      <span style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;background:rgba(255,255,255,.2);color:#fef08a;border:1px solid rgba(255,255,255,.25);flex:none"><i class="\${cp.stateIcon}"
                          style="font-size:15px"></i>\${cp.stateLabel}</span>
                    </div>
                    <div style="font-size:15.5px;color:#ddd6fe;margin-top:3px">\${ cp.hasBiz ? \`<span
                          style="font-weight:700;color:#fef08a">\${cp.business} · </span>\` : '' }\${cp.phone}\${ cp.hasPhone2 ? \` · \${cp.phone2}\` : '' } · \${cp.city}</div>
                  </div>
                  <div
                    style="display:flex;align-items:center;gap:9px;flex-wrap:nowrap;justify-content:flex-end;flex:none">
                    <a href="\${cp.tel}" title="Call"
                      style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#059669;color:#ffffff;flex:none;text-decoration:none"
                      style-hover="background:#047857"><i
                        class="ph-fill ph-phone" style="font-size:20px"></i></a>
                    <a href="\${cp.wa}" target="_blank" title="WhatsApp"
                      style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.16);color:#34d399;border:1.5px solid rgba(52,211,153,.35);flex:none;text-decoration:none"
                      style-hover="background:rgba(255,255,255,.26)"><i class="ph-fill ph-whatsapp-logo"
                        style="font-size:20px"></i></a>
                    <button onClick="\${__b(cp.sendLink)}" title="Send a link"
                      style="display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#f59e0b;color:#1c1303;flex:none;border:none;cursor:pointer;"
                      style-hover="background:#d97706"><i class="ph-fill ph-paper-plane-tilt"
                        style="font-size:19px"></i></button>
                    <button onClick="\${__b(cp.close)}"
                      style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.2);color:#ffffff;display:grid;place-items:center;border:none;cursor:pointer;"
                      style-hover="background:rgba(255,255,255,.3)"><i class="ph-bold ph-x" style="font-size:20px"></i></button>
                  </div>
                </div>

                <div data-scroll=""
                  style="flex:none;display:flex;align-items:center;gap:9px;padding:12px 24px;background:linear-gradient(180deg,#3b1464 0%,#2f1050 100%);border-bottom:2px solid rgba(255,255,255,.1);overflow-x:auto">
                  \${ (cp.tabs || []).map(t => \`
                    <button onClick="\${__b(t.go)}" style="\${t.style}">
                      <i class="\${t.icon}" style="font-size:20px;flex:none"></i>
                      <span
                        style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;white-space:nowrap">
                        <span style="font-size:16px;font-weight:800">\${t.label}</span>
                        <span style="\${t.subStyle}">\${t.sub}</span>
                      </span>
                    </button>
                  \`).join('') }
                </div>

                <div data-scroll=""
                  style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px 24px 40px;background:#f5f1fd">

                  \${ cp.isOverview ? \`
                    <div>
                      \${ cp.needsAttention ? \`
                        <div
                          style="display:flex;align-items:center;gap:14px;padding:17px 20px;border-radius:20px;background:#fff5ec;box-shadow:inset 0 0 0 2px #f5c9a0;margin-bottom:16px">
                          <i class="ph-fill ph-note-pencil" style="font-size:27px;color:#c0490c;flex:none"></i>
                          <div
                            style="flex:1;min-width:0;font-size:16.5px;font-weight:700;color:#7a4a13;text-wrap:pretty">
                            You know their name and number. Still missing: \${cp.missing}.</div>
                          <button onClick="\${__b(cp.startEdit)}"
                            style="height:50px;padding:0 20px;border-radius:14px;background:#c0490c;color:#fff;font-size:16px;font-weight:800;flex:none">Fill
                            it in</button>
                        </div>
                      \` : '' }

                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 22px;background:#fdf0d4;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#a3541b;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-user-focus" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">What you know</div>
                            <div style="font-size:15px;font-weight:700;color:#a3541b;margin-top:1px">Everything you
                              wrote down from real conversations</div>
                          </div>
                          \${ cp.notEditing ? \`<button
                              onClick="\${__b(cp.startEdit)}"
                              style="display:flex;align-items:center;gap:8px;white-space:nowrap;height:48px;padding:0 18px;border-radius:14px;background:#a3541b;color:#fff;font-size:16px;font-weight:800;flex:none"><i
                                class="ph-bold ph-pencil-simple" style="font-size:18px"></i>Update
                              Client</button>\` : '' }
                          \${ cp.editing ? \`<button onClick="\${__b(cp.cancelEdit)}"
                              style="height:48px;padding:0 18px;border-radius:14px;background:#fff;color:#6b6156;font-size:16px;font-weight:800;flex:none">Cancel</button>\` : '' }
                        </div>
                        \${ cp.notEditing ? \`
                          <div style="padding:0">
                            <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:0;align-items:stretch">
                              <div
                                style="padding:26px 26px 24px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14,#1a1406)">
                                <div
                                  style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9a94a">
                                  Their budget</div>
                                <div
                                  style="font-family:'Newsreader',serif;font-weight:600;font-size:58px;line-height:1;color:#f8c200;margin-top:8px">
                                  \${cp.budget}</div>
                                <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:18px">
                                  <span
                                    style="display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 15px;border-radius:13px;background:rgba(255,255,255,.1);color:#f4e5c4;font-size:15.5px;font-weight:800"><i
                                      class="ph-fill ph-ruler" style="font-size:18px"></i>\${cp.size}</span>
                                  <span
                                    style="display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 15px;border-radius:13px;background:#f8c200;color:#241d0c;font-size:15.5px;font-weight:800"><i
                                      class="ph-fill ph-flag-banner" style="font-size:18px"></i>\${cp.stage}</span>
                                </div>
                              </div>
                              <div
                                style="padding:22px 24px;background:#fff8e6;display:flex;flex-direction:column;gap:12px;justify-content:center">
                                \${ (cp.knowRows || []).map(k => \`
                                  <div>
                                    <div
                                      style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:\${k.col}">
                                      <i class="\${k.icon}" style="font-size:17px"></i>\${k.label}</div>
                                    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px">
                                      \${ (k.items || []).map(t => \`<span
                                          style="\${t.style}">\${t.label}</span>\`).join('') }
                                    </div>
                                    \${ k.empty ? \`
                                      <div style="font-size:15.5px;font-weight:600;color:#a89e8b;margin-top:4px">Not
                                        noted yet</div>
                                    \` : '' }
                                  </div>
                                \`).join('') }
                              </div>
                            </div>
                          </div>
                        \` : '' }

                        \${ cp.editing ? \`
                          <div style="padding:20px 22px 24px">
                            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
                              <input name="name" value="\${cf.name}" onInput="\${__b(onCF)}" placeholder="Name"
                                style="\${cfInput}">
                              <input name="phone" value="\${cf.phone}" onInput="\${__b(onCF)}" placeholder="Phone"
                                style="\${cfInput}">
                              <input name="business" value="\${cf.business}" onInput="\${__b(onCF)}"
                                placeholder="Business / firm" style="\${cfInput}">
                              <input name="city" value="\${cf.city}" onInput="\${__b(onCF)}" placeholder="City"
                                style="\${cfInput}">
                            </div>
                            <div
                              style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a89e8b;margin-top:18px">
                              What they are looking for</div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">\${ (cfTypeChips || []).map(t => \`<button onClick="\${__b(t.go)}"
                                  style="\${t.style}">\${t.label}</button>\`).join('') }</div>
                            <div
                              style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a89e8b;margin-top:18px">
                              Preferred cities and sectors</div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">\${ (cfAreaTags || []).map(t => \`<span style="\${t.style}">\${t.label}<button onClick="\${__b(t.go)}"
                                    style="width:30px;height:30px;border-radius:10px;background:rgba(0,0,0,.08);display:grid;place-items:center"><i
                                      class="ph-bold ph-x" style="font-size:13px"></i></button></span>\`).join('') }</div>
                            <div style="display:flex;gap:10px;margin-top:9px">
                              <input name="areaDraft" value="\${cf.areaDraft}" onInput="\${__b(onCF)}"
                                placeholder="Sector 79, Aerocity…" style="\${cfInput}">
                              <button onClick="\${__b(cfAddArea)}"
                                style="height:56px;padding:0 20px;border-radius:15px;background:#0f5f7a;color:#eaf7fb;font-size:16px;font-weight:800;flex:none">Add</button>
                            </div>
                            <div
                              style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
                              <input name="budgetFrom" value="\${cf.budgetFrom}" onInput="\${__b(onCF)}"
                                placeholder="Budget from (Cr)" style="\${cfInput}">
                              <input name="budgetTo" value="\${cf.budgetTo}" onInput="\${__b(onCF)}"
                                placeholder="Budget to (Cr)" style="\${cfInput}">
                              <input name="sizeFrom" value="\${cf.sizeFrom}" onInput="\${__b(onCF)}"
                                placeholder="Size from" style="\${cfInput}">
                              <input name="sizeTo" value="\${cf.sizeTo}" onInput="\${__b(onCF)}" placeholder="Size to"
                                style="\${cfInput}">
                            </div>
                            <div
                              style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a89e8b;margin-top:18px">
                              Preferences</div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">\${ (cfPrefChips || []).map(t => \`<button onClick="\${__b(t.go)}"
                                  style="\${t.style}">\${t.label}</button>\`).join('') }</div>
                            <div
                              style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a89e8b;margin-top:18px">
                              Buying stage</div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">\${ (cfStageChips || []).map(t => \`<button onClick="\${__b(t.go)}"
                                  style="\${t.style}">\${t.label}</button>\`).join('') }</div>
                            <button onClick="\${__b(cp.saveEdit)}"
                              style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:58px;border-radius:16px;background:#0b6f39;background-image:linear-gradient(140deg,#25b567,#0b6f39 55%,#06552b);color:#eafff2;font-size:17.5px;font-weight:800;margin-top:18px"><i
                                class="ph-fill ph-check-circle" style="font-size:21px"></i>Save what I know</button>
                          </div>
                        \` : '' }
                      </div>
                      <div
                        style="border-radius:22px;background:#fffdf7;box-shadow:0 0 0 1.5px #f6dcd4;overflow:hidden;margin-top:16px">
                        <div
                          style="display:flex;align-items:center;gap:12px;padding:13px 20px;background:#ffe9e4;flex-wrap:wrap">
                          <span
                            style="width:38px;height:38px;border-radius:12px;background:#b02a37;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-lock-key" style="font-size:19px"></i></span>
                          <div style="flex:1;min-width:150px;font-size:17.5px;font-weight:800;color:#241f1c">Private
                            notes</div>
                          <span style="font-size:14px;font-weight:800;color:#b02a37;flex:none">Only you ever see
                            these</span>
                        </div>
                        <div style="padding:14px 20px 16px">
                          <div style="display:flex;gap:10px;flex-wrap:wrap">
                            <input value="\${cp.noteDraft}" onInput="\${__b(cp.onNote)}"
                              placeholder="Call after 7pm · brother decides · wants park facing…"
                              style="\${cp.noteInput}">
                            <button onClick="\${__b(cp.addNote)}"
                              style="height:54px;padding:0 20px;border-radius:14px;background:#241d0c;color:#f8c200;font-size:16px;font-weight:800;flex:none">Add
                              note</button>
                          </div>
                          \${ cp.hasNotes ? \`
                            <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:12px">
                              \${ (cp.notes || []).map(nt => \`
                                <div
                                  style="flex:1 1 280px;min-width:240px;padding:13px 15px;border-radius:14px;background:#fff6f2;box-shadow:inset 0 0 0 1.5px #f6dcd4">
                                  <div style="font-size:16.5px;font-weight:700;color:#241f1c;text-wrap:pretty">\${nt.text}</div>
                                  <div style="font-size:13.5px;color:#a89e8b;margin-top:3px">\${nt.when}</div>
                                </div>
                              \`).join('') }
                            </div>
                          \` : '' }
                          \${ cp.noNotes ? \`
                            <div style="font-size:15.5px;font-weight:600;color:#a89e8b;margin-top:11px">Nothing written
                              down yet — call timing, who decides at home, what they disliked, negotiation limits.</div>
                          \` : '' }
                        </div>
                      </div>
                    </div>
                  \` : '' }

                  \${ cp.isActivity ? \`
                    <div style="display:flex;flex-direction:column;gap:16px">
                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">

                        \${ cp.hasActivity ? \`

                        \` : '' }
                        \${ cp.noActivity ? \`
                          <div style="padding:22px">
                            <div
                              style="padding:22px;border-radius:16px;background:#f6f2ff;font-size:16.5px;font-weight:700;color:#6b52a8;text-wrap:pretty">
                              Nothing recorded yet. Activity shows here once they open a link you sent.</div>
                          </div>
                        \` : '' }
                      </div>

                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 22px;background:#e6def7;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#5b32c4;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-paper-plane-tilt" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">Client links you sent them</div>
                            <div style="font-size:15px;font-weight:700;color:#5b32c4;margin-top:1px">Where every one of
                              these events came from</div>
                          </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:11px;padding:16px 22px 22px">
                          \${ (cp.links || []).map(l => \`
                            <div
                              style="padding:16px 18px;border-radius:18px;background:#f6f2ff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                                <div style="flex:1;min-width:180px">
                                  <div style="font-size:18px;font-weight:800;color:#241f1c">\${l.title}</div>
                                  <div style="font-size:15px;color:#8a7f6e;margin-top:2px">\${l.sub}</div>
                                </div>
                                <span style="\${l.statusStyle};flex:none">\${l.statusLabel}</span>
                              </div>
                              <div
                                style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;margin-top:12px">
                                \${ (l.stats || []).map(k => \`
                                  <div style="padding:11px 13px;border-radius:13px;background:#fff">
                                    <div
                                      style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b52a8">
                                      \${k.label}</div>
                                    <div style="font-size:17px;font-weight:800;color:#241f1c;margin-top:2px">\${k.value}</div>
                                  </div>
                                \`).join('') }
                              </div>
                              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
                                \${ (l.props || []).map(p => \`
                                  <span
                                    style="display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 13px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1.5px #ddd0f5;font-size:14.5px;font-weight:800;color:#4a2c99"><i
                                      class="ph-fill ph-house-line" style="font-size:15px"></i>\${p.label}</span>
                                \`).join('') }
                              </div>
                              <div style="display:flex;align-items:center;gap:9px;margin-top:13px;flex-wrap:wrap">
                                <button onClick="\${__b(l.go)}"
                                  style="display:flex;align-items:center;gap:8px;height:46px;padding:0 17px;border-radius:13px;background:#4a2c99;color:#efe8fb;font-size:15.5px;font-weight:800"><i
                                    class="ph-fill ph-list-magnifying-glass" style="font-size:17px"></i>Open
                                  link</button>
                                <button onClick="\${__b(l.preview)}"
                                  style="display:flex;align-items:center;gap:8px;height:46px;padding:0 17px;border-radius:13px;background:#fff;color:#4a2c99;font-size:15.5px;font-weight:800;box-shadow:inset 0 0 0 1.5px #ddd0f5"><i
                                    class="ph-fill ph-device-mobile" style="font-size:17px"></i>Preview</button>
                                <a href="\${l.wa}" target="_blank"
                                  style="display:flex;align-items:center;gap:8px;height:46px;padding:0 17px;border-radius:13px;background:#e3f4e9;color:#0a6634;font-size:15.5px;font-weight:800;text-decoration:none"><i
                                    class="ph-fill ph-whatsapp-logo" style="font-size:17px"></i>Share again</a>
                                <div style="flex:1"></div>
                                \${ l.isLive ? \`<button onClick="\${__b(l.revoke)}"
                                    style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:13px;background:#fff;color:#8a7f6e;font-size:15px;font-weight:800;box-shadow:inset 0 0 0 1.5px #e6ded0"><i
                                      class="ph ph-prohibit" style="font-size:16px"></i>Revoke</button>\` : '' }
                              </div>
                            </div>
                          \`).join('') }
                          \${ cp.noLinks ? \`
                            <div
                              style="display:flex;align-items:center;gap:13px;padding:17px 19px;border-radius:16px;background:#f6f2ff;flex-wrap:wrap">
                              <div style="flex:1;min-width:180px;font-size:16.5px;font-weight:700;color:#6b52a8">No link
                                sent to them yet.</div>
                              <button onClick="\${__b(cp.sendLink)}"
                                style="height:50px;padding:0 19px;border-radius:14px;background:#f8a800;color:#241d0c;font-size:16px;font-weight:800">Send
                                a link</button>
                            </div>
                          \` : '' }
                        </div>
                      </div>
                    </div>
                  \` : '' }

                  \${ cp.isProps ? \`
                    <div style="display:flex;flex-direction:column;gap:16px">
                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 22px;background:#e1ecfb;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#1a5aa8;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-buildings" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">Properties</div>
                            <div style="font-size:15px;font-weight:700;color:#1a5aa8;margin-top:1px">Everything you have
                              shown, sent or marked for them</div>
                          </div>
                          <button onClick="\${__b(cp.openPick)}"
                            style="display:flex;align-items:center;gap:9px;height:50px;padding:0 19px;border-radius:14px;background:#1a5aa8;color:#fff;font-size:16px;font-weight:800;flex:none"><i
                              class="ph-fill ph-bookmark-simple" style="font-size:19px"></i>Shortlist
                            properties</button>
                        </div>
                        \${ cp.pickOpen ? \`
                          <div
                            style="margin:16px 22px 0;border-radius:20px;background:#241d0c;background-image:linear-gradient(130deg,#33270f,#1a1406);padding:18px 20px">
                            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                              <i class="ph-fill ph-bookmark-simple" style="font-size:22px;color:#f8a800"></i>
                              <div style="flex:1;min-width:180px">
                                <div style="font-size:18.5px;font-weight:800;color:#fff">Shortlist for \${cp.first} —
                                  your own note</div>
                                <div style="font-size:15px;font-weight:700;color:#d8c9a6;margin-top:1px">\${cp.pickCount} shortlisted · tap to add or remove · MAPCO does not decide this</div>
                              </div>
                              <label
                                style="flex:1 1 240px;min-width:200px;display:flex;align-items:center;gap:11px;height:52px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.1)">
                                <i class="ph-bold ph-magnifying-glass" style="font-size:19px;color:#f8c200"></i>
                                <input value="\${cp.pickQ}" onInput="\${__b(cp.onPickQ)}"
                                  placeholder="Search sector, type or city…"
                                  style="border:none;outline:none;background:none;width:100%;font-size:16.5px;font-weight:600;color:#fff">
                              </label>
                              <button onClick="\${__b(cp.closePick)}"
                                style="height:52px;padding:0 20px;border-radius:14px;background:#f8a800;color:#241d0c;font-size:16px;font-weight:800;flex:none">Done</button>
                            </div>
                            <div data-scroll=""
                              style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin-top:14px;max-height:300px;overflow-y:auto">
                              \${ (cp.pickList || []).map(p => \`
                                <button onClick="\${__b(p.go)}" style="\${p.style}">
                                  <span style="\${p.thumb}"></span>
                                  <span style="flex:1;min-width:0;text-align:left">
                                    <span style="display:block;font-size:16.5px;font-weight:800;\${p.titleColor}">\${p.title}</span>
                                    <span style="display:block;font-size:14px;\${p.subColor}">\${p.loc} · \${p.priceFmt}</span>
                                  </span>
                                  <span style="\${p.tickStyle}"><i class="\${p.tickIcon}"
                                      style="font-size:17px"></i></span>
                                </button>
                              \`).join('') }
                              \${ cp.pickNone ? \`
                                <div style="padding:18px;font-size:16px;font-weight:700;color:#d8c9a6">Nothing matches
                                  that search.</div>
                              \` : '' }
                            </div>
                          </div>
                        \` : '' }
                        <div style="display:flex;gap:10px;padding:16px 22px 0;flex-wrap:wrap">
                          \${ (cp.groupTabs || []).map(g => \`
                            <button onClick="\${__b(g.go)}" style="\${g.style}"><i class="\${g.icon}"
                                style="font-size:19px"></i>\${g.label}<span style="\${g.numStyle}">\${g.count}</span></button>
                          \`).join('') }
                        </div>
                        <div style="display:flex;flex-direction:column;gap:11px;padding:16px 22px 22px">
                          \${ (cp.propRows || []).map(p => \`
                            <div style="\${p.wrapStyle}">
                              <span style="\${p.thumb}"></span>
                              <span style="flex:1;min-width:0">
                                <span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span
                                    style="font-size:18px;font-weight:800;color:#241f1c">\${p.title}</span><span
                                    style="font-family:'Newsreader',serif;font-weight:600;font-size:21px;color:#b8460f">\${p.priceFmt}</span></span>
                                <span style="display:block;font-size:14.5px;color:#8a7f6e;margin-top:1px">\${p.loc}</span>
                                <span style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px">\${ (p.tags || []).map(t => \`<span style="\${t.style}"><i
                                        class="\${t.icon}" style="font-size:15px"></i>\${t.label}</span>\`).join('') }</span>
                                \${ p.hasLast ? \`<span
                                    style="display:block;font-size:14.5px;font-weight:700;color:#1a5aa8;margin-top:7px">\${p.lastLine}</span>\` : '' }
                              </span>
                              <span style="display:flex;flex-direction:column;gap:8px;flex:none">
                                <button onClick="\${__b(p.go)}"
                                  style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:13px;background:#1a5aa8;color:#fff;font-size:15.5px;font-weight:800;white-space:nowrap">Open<i
                                    class="ph-bold ph-arrow-right" style="font-size:16px"></i></button>
                                <button onClick="\${__b(p.toggleLike)}" style="\${p.likeStyle}"><i
                                    class="\${p.likeIcon}" style="font-size:17px"></i>\${p.likeLabel}</button>
                              </span>
                            </div>
                          \`).join('') }
                          \${ cp.noProps ? \`
                            <div
                              style="padding:18px;border-radius:16px;background:#f3f7fd;font-size:16.5px;font-weight:700;color:#4a6d99">
                              \${cp.emptyGroup}</div>
                          \` : '' }
                        </div>
                      </div>
                    </div>
                  \` : '' }

                  \${ cp.isDeals ? \`
                    <div style="display:flex;flex-direction:column;gap:16px">
                      \${ cp.hasBought ? \`
                        <div
                          style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                          <div
                            style="display:flex;align-items:center;gap:13px;padding:15px 22px;background:#d7f0e2;flex-wrap:wrap">
                            <span
                              style="width:42px;height:42px;border-radius:13px;background:#0a7a42;color:#fff;display:grid;place-items:center;flex:none"><i
                                class="ph-fill ph-seal-check" style="font-size:21px"></i></span>
                            <div style="flex:1;min-width:160px">
                              <div style="font-size:20px;font-weight:800;color:#241f1c">Purchases</div>
                              <div style="font-size:15px;font-weight:700;color:#0a7a42;margin-top:1px">What they have
                                already bought from you</div>
                            </div>
                          </div>
                          <div style="display:flex;flex-direction:column;gap:11px;padding:16px 22px 22px">
                            \${ (cp.bought || []).map(b => \`
                              <button onClick="\${__b(b.go)}"
                                style="display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:16px 18px;border-radius:17px;background:#f1fbf6;box-shadow:inset 0 0 0 1.5px #b3e2c8">
                                <span style="flex:1;min-width:0"><span
                                    style="display:block;font-size:17.5px;font-weight:800;color:#241f1c">\${b.title}</span><span style="display:block;font-size:15px;color:#6b6156;margin-top:2px">\${b.loc} · bought \${b.when}</span></span>
                                <span
                                  style="font-family:'Newsreader',serif;font-weight:600;font-size:26px;color:#0a7a42;flex:none">\${b.price}</span>
                              </button>
                            \`).join('') }
                          </div>
                        </div>
                      \` : '' }

                      <div style="border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 22px;background:#fdf0d4;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#a3541b;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-handshake" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">Deals</div>
                            <div style="font-size:15px;font-weight:700;color:#a3541b;margin-top:1px">Token, negotiation
                              and closed deals</div>
                          </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:11px;padding:16px 22px 22px">
                          \${ (cp.deals || []).map(d => \`
                            <button onClick="\${__b(d.go)}"
                              style="display:flex;align-items:center;gap:13px;width:100%;text-align:left;padding:16px 18px;border-radius:17px;background:#fff8e3;box-shadow:inset 0 0 0 1.5px #f0d493">
                              <span style="flex:1;min-width:0"><span
                                  style="display:block;font-size:17.5px;font-weight:800;color:#241f1c">\${d.name}</span><span style="display:block;font-size:15px;color:#8a7f6e;margin-top:2px">\${d.sub}</span></span>
                              <span
                                style="font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:#b8460f;flex:none">\${d.valueFmt}</span>
                              <span style="\${d.pill};flex:none">\${d.stageLabel}</span>
                              <i class="ph-bold ph-arrow-right" style="font-size:18px;color:#a3541b;flex:none"></i>
                            </button>
                          \`).join('') }
                          \${ cp.noDeals ? \`
                            <div
                              style="padding:18px;border-radius:16px;background:#fff8e3;font-size:16.5px;font-weight:700;color:#8a6a14">
                              No deal written down for them yet.</div>
                          \` : '' }
                        </div>
                      </div>

                      <div style="display:flex;justify-content:flex-end;margin-top:4px">
                        \${ cp.archIdle ? \`<button
                            onClick="\${__b(cp.arm)}"
                            style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:13px;background:transparent;color:#a89e8b;font-size:15px;font-weight:700"
                            style-hover="background:#f4ecdc"><i class="ph ph-archive" style="font-size:17px"></i>Archive
                            this client</button>\` : '' }
                        \${ cp.archArm ? \`
                          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                            <span style="font-size:15.5px;font-weight:700;color:#6b6156">Move them out of your working
                              list?</span>
                            <button onClick="\${__b(cp.disarm)}"
                              style="height:46px;padding:0 16px;border-radius:13px;background:#f4ecdc;color:#4c463d;font-size:15.5px;font-weight:800">Keep</button>
                            <button onClick="\${__b(cp.doArchive)}"
                              style="height:46px;padding:0 16px;border-radius:13px;background:#a3541b;color:#fff;font-size:15.5px;font-weight:800">Archive</button>
                          </div>
                        \` : '' }
                      </div>
                    </div>
                  \` : '' }

                </div>
              </div>
            </div>
          \` : '' }


          \${ linkOpen ? \`
            <div style="position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:24px">
              <div onClick="\${__b(closeLink)}"
                style="position:absolute;inset:0;background:rgba(26,18,12,.55);animation:omVeil .2s ease both"></div>
              <div data-scroll=""
                style="position:relative;width:520px;max-width:100%;max-height:86vh;overflow:auto;background:#f7f3ff;border-radius:22px;box-shadow:0 40px 90px -30px rgba(0,0,0,.6);">
                <div
                  style="display:flex;align-items:center;justify-content:space-between;padding:22px 24px 16px;border-bottom:1px solid #e4dbf7;position:sticky;top:0;background:#f7f3ff;z-index:2">
                  <div>
                    <h2 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">
                      Link a plot</h2>
                    <p style="margin:4px 0 0;font-size:14px;color:#7d7365">Pick one of your listed plots to tie to this
                      deal.</p>
                  </div>
                  <button onClick="\${__b(closeLink)}"
                    style="width:38px;height:38px;border-radius:11px;background:#f3eeff;color:#6b6156;display:grid;place-items:center"
                    style-hover="background:#ddd2f5"><i class="ph-bold ph-x" style="font-size:16px"></i></button>
                </div>
                <div style="padding:14px 18px 20px;display:flex;flex-direction:column;gap:10px">
                  \${ (linkList || []).map(p => \`
                    <button onClick="\${__b(p.pick)}"
                      style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:14px;text-align:left;cursor:pointer"
                      style-hover="border-color:#d95d1e;background:#fff">
                      <div style="\${p.photoStyle}"></div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:15.5px;font-weight:800;color:#241f1c">\${p.title}</div>
                        <div style="font-size:13px;color:#8d8271">\${p.loc}</div>
                      </div>
                      <div
                        style="font-family:'Newsreader',serif;font-weight:600;font-size:18px;color:#c85a1a;flex:none">\${p.priceFmt}</div>
                    </button>
                  \`).join('') }
                </div>
              </div>
            </div>
          \` : '' }

          \${ addOpen ? \`
            <div style="position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:24px">
              <div onClick="\${__b(closeAdd)}"
                style="position:absolute;inset:0;background:rgba(12,30,20,.58);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:680px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;background:#f7f3ff;border-radius:26px;box-shadow:0 44px 100px -30px rgba(0,0,0,.65);overflow:hidden;">

                <div
                  style="padding:22px 28px 20px;background:#f8a800;background-image:linear-gradient(150deg,#ffe08c,#f4ae14);color:#241d0c;flex:none">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
                    <div>
                      <div
                        style="font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a6a14">
                        Step \${wizStep} of 3 · \${wizStepName}</div>
                      <h2
                        style="margin:6px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:27px;color:#241d0c">
                        \${wizTitle}</h2>
                    </div>
                    <button onClick="\${__b(closeAdd)}"
                      style="width:40px;height:40px;border-radius:12px;background:rgba(0,0,0,.09);color:#241d0c;display:grid;place-items:center;flex:none"
                      style-hover="background:rgba(0,0,0,.17)"><i class="ph-bold ph-x"
                        style="font-size:17px"></i></button>
                  </div>
                  <div style="display:flex;gap:7px;margin-top:18px">
                    \${ (wizBars || []).map(b => \`
                      <div style="\${b.style}"></div>
                    \`).join('') }
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap">
                    \${ (wizChips || []).map(c => \`<span style="\${c.style}"><i
                          class="\${c.icon}" style="font-size:14px"></i>\${c.label}</span>\`).join('') }
                  </div>
                </div>

                <div data-scroll="" style="flex:1;overflow:auto;padding:22px 28px 12px">

                  \${ wizS1 ? \`
                    <label
                      style="display:flex;align-items:center;gap:11px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:14px;padding:13px 16px">
                      <i class="ph ph-magnifying-glass" style="font-size:20px;color:#8d8271"></i>
                      <input name="q1" value="\${wiz.q1}" onInput="\${__b(onWizInput)}"
                        placeholder="Search your customers…"
                        style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#211c17">
                    </label>
                    <button onClick="\${__b(toggleNewClient)}" style="\${newClientBtnStyle}"
                      style-hover="border-color:#6b3fd4">
                      <span
                        style="width:38px;height:38px;border-radius:11px;background:#fff2cf;color:#a8792a;display:grid;place-items:center;flex:none"><i
                          class="ph-bold ph-user-plus" style="font-size:19px"></i></span>
                      <span style="flex:1;text-align:left"><span
                          style="display:block;font-size:15.5px;font-weight:800;color:#211c17">This is a new
                          customer</span><span style="display:block;font-size:13px;color:#7d7365">Add them while you
                          record the deal</span></span>
                      <i class="\${newClientCaret}" style="font-size:15px;color:#8d8271"></i>
                    </button>
                    \${ wiz.useNewClient ? \`
                      <div
                        style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:16px;padding:16px;margin-top:10px">
                        <label style="display:block"><span
                            style="display:block;font-size:13.5px;font-weight:700;color:#4c463d;margin-bottom:6px">Customer
                            name</span><input name="ncName" value="\${wiz.ncName}" onInput="\${__b(onWizInput)}"
                            placeholder="e.g. Harpreet Singh"
                            style="width:100%;padding:13px 15px;border:1px solid #eed9a8;border-radius:11px;background:#fffaf0;font-size:15.5px;color:#211c17;outline:none"
                            style-focus="border-color:#1f1a12"></label>
                        <label style="display:block"><span
                            style="display:block;font-size:13.5px;font-weight:700;color:#4c463d;margin-bottom:6px">Phone</span><input
                            name="ncPhone" value="\${wiz.ncPhone}" onInput="\${__b(onWizInput)}" inputmode="tel"
                            placeholder="+91 …"
                            style="width:100%;padding:13px 15px;border:1px solid #eed9a8;border-radius:11px;background:#fffaf0;font-size:15.5px;color:#211c17;outline:none"
                            style-focus="border-color:#1f1a12"></label>
                      </div>
                    \` : '' }
                    <div style="display:flex;flex-direction:column;gap:9px;margin-top:14px">
                      \${ (wizClients || []).map(c => \`
                        <button onClick="\${__b(c.go)}" style="\${c.style}" style-hover="border-color:#c8b795">
                          <span style="\${c.avStyle}">\${c.initials}</span>
                          <span style="flex:1;min-width:0;text-align:left"><span
                              style="display:block;font-size:16px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${c.name}</span><span style="display:block;font-size:13px;color:#7d7365">\${c.want} in
                              \${c.city} · \${c.budget}</span></span>
                          <span style="\${c.checkStyle}"><i class="\${c.checkIcon}"
                              style="font-size:14px"></i></span>
                        </button>
                      \`).join('') }
                    </div>
                    \${ wizNoClients ? \`
                      <div
                        style="padding:22px;text-align:center;font-size:14.5px;color:#8d8271;background:#fff8e6;border:1.5px dashed #e6cf9a;border-radius:14px;margin-top:12px">
                        No customer matches — add them as new above.</div>
                    \` : '' }
                  \` : '' }

                  \${ wizS2 ? \`
                    <label
                      style="display:flex;align-items:center;gap:11px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:14px;padding:13px 16px">
                      <i class="ph ph-magnifying-glass" style="font-size:20px;color:#8d8271"></i>
                      <input name="q2" value="\${wiz.q2}" onInput="\${__b(onWizInput)}"
                        placeholder="Search your plots by sector, city or size…"
                        style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#211c17">
                    </label>
                    <button onClick="\${__b(toggleManualProp)}" style="\${manualPropBtnStyle}"
                      style-hover="border-color:#6b3fd4">
                      <span
                        style="width:38px;height:38px;border-radius:11px;background:#f7ecd4;color:#a8792a;display:grid;place-items:center;flex:none"><i
                          class="ph-bold ph-pencil-simple" style="font-size:19px"></i></span>
                      <span style="flex:1;text-align:left"><span
                          style="display:block;font-size:15.5px;font-weight:800;color:#211c17">Not one of my
                          plots</span><span style="display:block;font-size:13px;color:#7d7365">Type the property
                          yourself — outside deals count too</span></span>
                      <i class="\${manualPropCaret}" style="font-size:15px;color:#8d8271"></i>
                    </button>
                    \${ wiz.useManualProp ? \`
                      <div
                        style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:16px;padding:16px;margin-top:10px">
                        <label style="display:block"><span
                            style="display:block;font-size:13.5px;font-weight:700;color:#4c463d;margin-bottom:6px">Where
                            is it?</span><input name="mpLoc" value="\${wiz.mpLoc}" onInput="\${__b(onWizInput)}"
                            placeholder="e.g. Sector 22, Chandigarh"
                            style="width:100%;padding:13px 15px;border:1px solid #eed9a8;border-radius:11px;background:#fffaf0;font-size:15.5px;color:#211c17;outline:none"
                            style-focus="border-color:#1f1a12"></label>
                        <label style="display:block"><span
                            style="display:block;font-size:13.5px;font-weight:700;color:#4c463d;margin-bottom:6px">Size</span><input
                            name="mpSize" value="\${wiz.mpSize}" onInput="\${__b(onWizInput)}"
                            placeholder="e.g. 250 sq yd"
                            style="width:100%;padding:13px 15px;border:1px solid #eed9a8;border-radius:11px;background:#fffaf0;font-size:15.5px;color:#211c17;outline:none"
                            style-focus="border-color:#1f1a12"></label>
                      </div>
                    \` : '' }
                    <div style="display:flex;flex-direction:column;gap:9px;margin-top:14px">
                      \${ (wizProps || []).map(p => \`
                        <button onClick="\${__b(p.go)}" style="\${p.style}" style-hover="border-color:#c8b795">
                          <span style="\${p.tileStyle}"><i class="\${p.icon}" style="font-size:20px"></i></span>
                          <span style="flex:1;min-width:0;text-align:left"><span
                              style="display:block;font-size:15.5px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${p.title}</span><span style="display:block;font-size:13px;color:#7d7365">\${p.loc}</span></span>
                          <span style="font-size:15px;font-weight:800;color:#c9481a;flex:none">\${p.priceFmt}</span>
                          <span style="\${p.checkStyle}"><i class="\${p.checkIcon}"
                              style="font-size:14px"></i></span>
                        </button>
                      \`).join('') }
                    </div>
                    \${ wizNoProps ? \`
                      <div
                        style="padding:22px;text-align:center;font-size:14.5px;color:#8d8271;background:#fff8e6;border:1.5px dashed #e6cf9a;border-radius:14px;margin-top:12px">
                        No plot matches — type it in yourself above.</div>
                    \` : '' }
                  \` : '' }

                  \${ wizS3 ? \`
                    <label style="display:block"><span
                        style="display:block;font-size:14px;font-weight:700;color:#4c463d;margin-bottom:7px">Call this
                        deal</span><input name="name" value="\${wiz.name}" onInput="\${__b(onWizInput)}"
                        placeholder="\${wizNamePh}"
                        style="width:100%;padding:15px 16px;border:1.5px solid #f0d493;border-radius:12px;background:#fff8e6;font-size:16.5px;font-weight:700;color:#211c17;outline:none"
                        style-focus="border-color:#1f1a12"></label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">
                      <label style="display:block"><span
                          style="display:block;font-size:14px;font-weight:700;color:#4c463d;margin-bottom:7px">Deal
                          value (Cr)</span><input name="value" value="\${wiz.value}" onInput="\${__b(onWizInput)}"
                          inputmode="decimal" placeholder="1.65"
                          style="width:100%;padding:15px 16px;border:1.5px solid #f0d493;border-radius:12px;background:#fff8e6;font-size:17px;font-weight:700;color:#211c17;outline:none"
                          style-focus="border-color:#1f1a12"></label>
                      <label style="display:block"><span
                          style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;color:#0b6f39;margin-bottom:7px"><i
                            class="ph-fill ph-coins" style="font-size:15px;color:#12a150"></i>Your commission
                          (L)</span><input name="comm" value="\${wiz.comm}" onInput="\${__b(onWizInput)}"
                          inputmode="decimal" placeholder="2.5"
                          style="width:100%;padding:15px 16px;border:1.5px solid #a6e3c0;border-radius:12px;background:#d9f5e3;font-size:17px;color:#0b8f45;font-weight:800;outline:none"
                          style-focus="border-color:#12a150"></label>
                    </div>
                    <div style="margin-top:18px"><span
                        style="display:block;font-size:14px;font-weight:700;color:#4c463d;margin-bottom:9px">Where has
                        it reached?</span>
                      <div style="display:flex;gap:8px;flex-wrap:wrap">\${ (wizStageChips || []).map(st => \`<button onClick="\${__b(st.go)}" style="\${st.style}">\${st.label}</button>\`).join('') }</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;margin-top:22px">
                      <div style="flex:1;height:1px;background:#ddd2f5"></div><span
                        style="font-size:12.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#a3324f;display:flex;align-items:center;gap:6px"><i
                          class="ph-fill ph-lock-key" style="font-size:14px"></i>Only you can see this</span>
                      <div style="flex:1;height:1px;background:#ddd2f5"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">
                      <label style="display:block"><span
                          style="display:block;font-size:14px;font-weight:700;color:#4c463d;margin-bottom:7px">Seller
                          name</span><input name="sellerName" value="\${wiz.sellerName}" onInput="\${__b(onWizInput)}"
                          placeholder="Seller / owner"
                          style="width:100%;padding:14px 16px;border:1.5px solid #f0d493;border-radius:12px;background:#fff8e6;font-size:16px;color:#211c17;outline:none"
                          style-focus="border-color:#1f1a12"></label>
                      <label style="display:block"><span
                          style="display:block;font-size:14px;font-weight:700;color:#4c463d;margin-bottom:7px">Seller
                          phone</span><input name="sellerPhone" value="\${wiz.sellerPhone}" onInput="\${__b(onWizInput)}"
                          placeholder="+91 …"
                          style="width:100%;padding:14px 16px;border:1.5px solid #f0d493;border-radius:12px;background:#fff8e6;font-size:16px;color:#211c17;outline:none"
                          style-focus="border-color:#1f1a12"></label>
                    </div>
                  \` : '' }

                </div>

                <div
                  style="display:flex;align-items:center;gap:12px;padding:16px 28px 22px;border-top:1px solid #ddd2f5;background:#f7f3ff;flex:none">
                  \${ wizCanBack ? \`<button onClick="\${__b(wizBack)}"
                      style="display:flex;align-items:center;gap:8px;padding:14px 20px;border-radius:13px;background:#f3eeff;color:#4c463d;font-size:15px;font-weight:700"
                      style-hover="background:#ddd2f5"><i class="ph-bold ph-arrow-left"
                        style="font-size:15px"></i>Back</button>\` : '' }
                  <div style="flex:1;font-size:13.5px;color:#7d7365">\${wizHint}</div>
                  \${ wizNotLast ? \`<button onClick="\${__b(wizNext)}"
                      style="\${wizNextStyle}">\${wizNextLabel}<i class="ph-bold ph-arrow-right"
                        style="font-size:15px"></i></button>\` : '' }
                  \${ wizS3 ? \`<button onClick="\${__b(doAdd)}"
                      style="display:flex;align-items:center;gap:9px;padding:15px 28px;border-radius:13px;background:#12a150;color:#fff;font-size:16px;font-weight:800;box-shadow:0 14px 28px -14px rgba(18,161,80,.9)"
                      style-hover="background:#0b8f45"><i class="ph-fill ph-check-circle"
                        style="font-size:18px"></i>Save deal</button>\` : '' }
                </div>
              </div>
            </div>
          \` : '' }

          \${ addClientBigOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:88;display:flex;justify-content:center;align-items:flex-start;padding:24px;overflow-y:auto">
              <div onClick="\${__b(closeAddClientBig)}"
                style="position:fixed;inset:0;background:rgba(40,26,2,.62);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:100%;max-width:1120px;border-radius:30px;background:#fff6e0;box-shadow:0 50px 100px -30px rgba(40,26,2,.85);overflow:hidden;">
                <div style="display:flex;align-items:center;gap:16px;padding:22px 30px;background:#fff0d6">
                  <span
                    style="width:56px;height:56px;border-radius:18px;background:#a3541b;color:#fff6e6;display:grid;place-items:center;flex:none"><i
                      class="ph-fill ph-user-plus" style="font-size:28px"></i></span>
                  <div style="flex:1;min-width:0">
                    <div
                      style="font-family:'Newsreader',serif;font-weight:500;font-size:32px;letter-spacing:-.02em;color:#241d0c">
                      Add a client</div>
                    <div style="font-size:17px;font-weight:700;color:#8a5a12">Name and phone is all you need. Everything
                      else can wait.</div>
                  </div>
                  <button onClick="\${__b(closeAddClientBig)}"
                    style="width:48px;height:48px;border-radius:15px;background:#fdf8ee;color:#6b6156;display:grid;place-items:center;flex:none"
                    style-hover="background:#fff"><i class="ph-bold ph-x" style="font-size:20px"></i></button>
                </div>

                <div data-scroll="" style="padding:24px 30px;max-height:72vh;overflow-y:auto">
                  <div
                    style="padding:22px 24px;border-radius:22px;background:#fff6e0;box-shadow:inset 0 0 0 2px #f0c96a">
                    <div
                      style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b">
                      Required</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px">
                      <label style="display:block"><span style="\${cfLab}">Client name</span><input name="name"
                          value="\${cf.name}" onInput="\${__b(onCF)}" placeholder="e.g. Harpreet Singh Gill"
                          style="\${cfInput}"></label>
                      <label style="display:block"><span style="\${cfLab}">Phone number</span><input name="phone"
                          value="\${cf.phone}" onInput="\${__b(onCF)}" inputmode="tel" placeholder="+91 …"
                          style="\${cfInput}"></label>
                    </div>
                    \${ cfDup ? \`
                      <div
                        style="display:flex;align-items:center;gap:14px;margin-top:14px;padding:16px 18px;border-radius:18px;background:#fff2e0;box-shadow:inset 0 0 0 1.5px #f0d4ab">
                        <i class="ph-fill ph-warning-circle" style="font-size:26px;color:#a3541b;flex:none"></i>
                        <div style="flex:1;min-width:0">
                          <div style="font-size:16.5px;font-weight:800;color:#7a4a13">You already have this number saved
                          </div>
                          <div style="font-size:15px;color:#8a7f6e">\${cfDupName} · \${cfDupSub}</div>
                        </div>
                        <button onClick="\${__b(cfUseDup)}"
                          style="height:48px;padding:0 18px;border-radius:14px;background:#a3541b;color:#fff;font-size:15.5px;font-weight:800;flex:none">Open
                          them instead</button>
                      </div>
                    \` : '' }
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;align-items:start">
                    <div
                      style="padding:22px 24px;border-radius:22px;background:#eaf5fd;box-shadow:inset 0 0 0 2px #b9dcf2">
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b">
                        Contact &amp; business <span
                          style="font-weight:700;text-transform:none;letter-spacing:0;color:#b3a894">— optional</span>
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
                        <label style="display:block"><span style="\${cfLab}">Another number</span><input name="phone2"
                            value="\${cf.phone2}" onInput="\${__b(onCF)}" style="\${cfInput}"></label>
                        <label style="display:block"><span style="\${cfLab}">City they live in</span><input
                            name="city" value="\${cf.city}" onInput="\${__b(onCF)}" placeholder="Mohali"
                            style="\${cfInput}"></label>
                        <label style="display:block;grid-column:1 / -1"><span style="\${cfLab}">Business / firm
                            name</span><input name="business" value="\${cf.business}" onInput="\${__b(onCF)}"
                            placeholder="e.g. Gill Transport Co." style="\${cfInput}"></label>
                      </div>
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b;margin-top:22px">
                        Where are they buying</div>
                      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:11px">\${ (cfAreaTags || []).map(t => \`<span style="\${t.style}">\${t.label}<button
                              onClick="\${__b(t.go)}"
                              style="width:30px;height:30px;border-radius:10px;background:rgba(0,0,0,.08);display:grid;place-items:center"><i
                                class="ph-bold ph-x" style="font-size:13px"></i></button></span>\`).join('') }</div>
                      <div style="display:flex;gap:10px;margin-top:11px">
                        <input name="areaDraft" value="\${cf.areaDraft}" onInput="\${__b(onCF)}"
                          placeholder="Sector 79, Aerocity, Eco City…" style="\${cfInput}">
                        <button onClick="\${__b(cfAddArea)}"
                          style="height:56px;padding:0 22px;border-radius:15px;background:#0f5f7a;color:#eaf7fb;font-size:16px;font-weight:800;flex:none">Add</button>
                      </div>
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b;margin-top:22px">
                        Budget &amp; size</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px">
                        <label style="display:block"><span style="\${cfLab}">Budget from (Cr)</span><input
                            name="budgetFrom" value="\${cf.budgetFrom}" onInput="\${__b(onCF)}" inputmode="decimal"
                            placeholder="1.5" style="\${cfInput}"></label>
                        <label style="display:block"><span style="\${cfLab}">Budget to (Cr)</span><input
                            name="budgetTo" value="\${cf.budgetTo}" onInput="\${__b(onCF)}" inputmode="decimal"
                            placeholder="1.8" style="\${cfInput}"></label>
                        <label style="display:block"><span style="\${cfLab}">Size from</span><input name="sizeFrom"
                            value="\${cf.sizeFrom}" onInput="\${__b(onCF)}" placeholder="250"
                            style="\${cfInput}"></label>
                        <label style="display:block"><span style="\${cfLab}">Size to</span><input name="sizeTo"
                            value="\${cf.sizeTo}" onInput="\${__b(onCF)}" placeholder="300"
                            style="\${cfInput}"></label>
                      </div>
                    </div>

                    <div
                      style="padding:22px 24px;border-radius:22px;background:#eaf5fd;box-shadow:inset 0 0 0 2px #b9dcf2">
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b">
                        What are they looking for</div>
                      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:11px">\${ (cfTypeChips || []).map(t => \`<button onClick="\${__b(t.go)}" style="\${t.style}"><i
                              class="\${t.icon}" style="font-size:19px"></i>\${t.label}</button>\`).join('') }</div>
                      <div
                        style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b;margin-top:22px">
                        Preferences</div>
                      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:11px">\${ (cfPrefChips || []).map(t => \`<button onClick="\${__b(t.go)}" style="\${t.style}">\${t.label}</button>\`).join('') }</div>
                      <div style="display:flex;gap:10px;margin-top:11px">
                        <input name="customPref" value="\${cf.customPref}" onInput="\${__b(onCF)}"
                          placeholder="Write your own — e.g. two-side open" style="\${cfInput}">
                        <button onClick="\${__b(cfAddPref)}"
                          style="height:56px;padding:0 22px;border-radius:15px;background:#0f5f7a;color:#eaf7fb;font-size:16px;font-weight:800;flex:none">Add</button>
                      </div>

                      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:11px">\${ (cfStageChips || []).map(t => \`\`).join('') }</div>
                      <div style="display:flex;align-items:center;gap:9px;margin-top:22px"></div>

                    </div>
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:14px;padding:18px 30px;background:#fff0d6">
                  <div style="flex:1;font-size:16px;font-weight:700;color:#8a5a12">You can fill the rest later from
                    their profile.</div>
                  <button onClick="\${__b(closeAddClientBig)}"
                    style="height:60px;padding:0 24px;border-radius:17px;background:#fdf8ee;color:#6b6156;font-size:17px;font-weight:800">Cancel</button>
                  <button onClick="\${__b(cfSave)}" style="\${cfSaveStyle}"><i class="ph-fill ph-check-circle"
                      style="font-size:22px"></i>Save client</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ addSellerOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:88;display:flex;justify-content:center;align-items:flex-start;padding:24px;overflow-y:auto">
              <div onClick="\${__b(closeAddSeller)}"
                style="position:fixed;inset:0;background:rgba(30,16,60,.62);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:100%;max-width:860px;border-radius:30px;background:#f4efff;box-shadow:0 50px 100px -30px rgba(30,16,60,.85);overflow:hidden;">
                <div style="display:flex;align-items:center;gap:16px;padding:22px 30px;background:#efe8fb">
                  <span
                    style="width:56px;height:56px;border-radius:18px;background:#4a2c99;color:#efe8fb;display:grid;place-items:center;flex:none"><i
                      class="ph-fill ph-key" style="font-size:28px"></i></span>
                  <div style="flex:1;min-width:0">
                    <div
                      style="font-family:'Newsreader',serif;font-weight:500;font-size:32px;letter-spacing:-.02em;color:#241d0c">
                      Add a seller</div>
                    <div style="font-size:17px;font-weight:700;color:#5b32c4">Save them once — reuse them on every
                      property they give you.</div>
                  </div>
                  <button onClick="\${__b(closeAddSeller)}"
                    style="width:48px;height:48px;border-radius:15px;background:#fdf8ee;color:#6b6156;display:grid;place-items:center;flex:none"
                    style-hover="background:#fff"><i class="ph-bold ph-x" style="font-size:20px"></i></button>
                </div>
                <div data-scroll="" style="padding:24px 30px;max-height:70vh;overflow-y:auto">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                    <label style="display:block"><span style="\${cfLab}">Seller / owner name</span><input name="name"
                        value="\${sf2.name}" onInput="\${__b(onSF2)}" placeholder="e.g. Balwinder Singh"
                        style="\${cfInput}"></label>
                    <label style="display:block"><span style="\${cfLab}">Primary phone</span><input name="phone"
                        value="\${sf2.phone}" onInput="\${__b(onSF2)}" inputmode="tel" placeholder="+91 …"
                        style="\${cfInput}"></label>
                    <label style="display:block"><span style="\${cfLab}">Another number <span
                          style="font-weight:600;color:#b3a894">— optional</span></span><input name="phone2"
                        value="\${sf2.phone2}" onInput="\${__b(onSF2)}" style="\${cfInput}"></label>
                    <label style="display:block"><span style="\${cfLab}">City <span
                          style="font-weight:600;color:#b3a894">— optional</span></span><input name="city"
                        value="\${sf2.city}" onInput="\${__b(onSF2)}" placeholder="Mohali" style="\${cfInput}"></label>
                    <label style="display:block;grid-column:1 / -1"><span style="\${cfLab}">Business / firm details
                        <span style="font-weight:600;color:#b3a894">— optional</span></span><input name="business"
                        value="\${sf2.business}" onInput="\${__b(onSF2)}"
                        placeholder="e.g. Gurpreet Realtors, GST 03ABCDE…" style="\${cfInput}"></label>
                  </div>
                  \${ sfDup ? \`
                    <div
                      style="display:flex;align-items:center;gap:14px;margin-top:14px;padding:16px 18px;border-radius:18px;background:#f4eeff;box-shadow:inset 0 0 0 1.5px #d6c6f2">
                      <i class="ph-fill ph-warning-circle" style="font-size:26px;color:#4a2c99;flex:none"></i>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:16.5px;font-weight:800;color:#3a1f7a">This number is already a saved
                          seller</div>
                        <div style="font-size:15px;color:#8a7f6e">\${sfDupName} · \${sfDupSub}</div>
                      </div>
                      <button onClick="\${__b(sfUseDup)}"
                        style="height:48px;padding:0 18px;border-radius:14px;background:#4a2c99;color:#fff;font-size:15.5px;font-weight:800;flex:none">Open
                        them instead</button>
                    </div>
                  \` : '' }
                  <div
                    style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b32c4;margin-top:22px">
                    What kind of seller</div>
                  <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:11px">\${ (sfKindChips || []).map(t => \`<button onClick="\${__b(t.go)}" style="\${t.style}">\${t.label}</button>\`).join('') }</div>
                  <div style="display:flex;align-items:center;gap:9px;margin-top:22px"><i class="ph-fill ph-lock-key"
                      style="font-size:18px;color:#4a2c99"></i><span
                      style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#4a2c99">Private
                      note about this seller</span></div>
                  <textarea name="note" value="\${sf2.note}" onInput="\${__b(onSF2)}" rows="3"
                    placeholder="Prefers calls after 6 pm. Brother must also sign." style="\${cfArea}"></textarea>
                  <div
                    style="margin-top:16px;padding:16px 18px;border-radius:18px;background:#f4eeff;font-size:16px;font-weight:700;color:#3a1f7a;text-wrap:pretty">
                    Asking price, visit instructions and availability belong to each property — you fill those when you
                    attach this seller to a property.</div>
                </div>
                <div style="display:flex;align-items:center;gap:14px;padding:18px 30px;background:#efe8fb">
                  <div style="flex:1;font-size:16px;font-weight:700;color:#5b32c4">Seller information never leaves your
                    desk.</div>
                  <button onClick="\${__b(closeAddSeller)}"
                    style="height:60px;padding:0 24px;border-radius:17px;background:#fdf8ee;color:#6b6156;font-size:17px;font-weight:800">Cancel</button>
                  <button onClick="\${__b(sfSave)}" style="\${sfSaveStyle}"><i class="ph-fill ph-check-circle"
                      style="font-size:22px"></i>Save seller</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ propDetailOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:82;display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden">
              <div onClick="\${__b(propDetail.close)}"
                style="position:absolute;inset:0;background:rgba(40,26,2,.68);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:1280px;max-width:100%;height:100%;display:flex;flex-direction:column;background:#f5f1fd;border-radius:26px;overflow:hidden;box-shadow:0 50px 110px -30px rgba(0,0,0,.78);">

                <div
                  style="flex:none;display:flex;align-items:center;gap:16px;padding:16px 20px;background:#ffefd2;flex-wrap:wrap">
                  <div style="flex:1 1 300px;min-width:0">
                    <h2
                      style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:29px;line-height:1.1;letter-spacing:-.015em;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      \${propDetail.title} · \${propDetail.size}</h2>
                    <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:3px">
                      <span
                        style="display:flex;align-items:center;gap:6px;font-size:15.5px;font-weight:700;color:#7a6f60"><i
                          class="ph-fill ph-map-pin" style="font-size:17px;color:#a3541b"></i>\${propDetail.loc}</span>
                      \${ propDetail.isBooked ? \`<button onClick="\${__b(propDetail.openBookedDeal)}"
                          style="\${propDetail.bookedStyle}" style-hover="background:#154a8c"><i
                            class="ph-fill ph-lock-key" style="font-size:15px"></i>\${propDetail.bookedIn}</button>\` : '' }

                      \${ propDetail.showAvail ? \`\` : '' }
                    </div>
                  </div>
                  <div style="flex:none;text-align:right;padding-right:4px">
                    <div style="\${propDetail.priceWordStyle}">\${propDetail.priceWord}</div>
                    <div style="\${propDetail.priceValStyle}">\${propDetail.priceHead}</div>
                  </div>
                  <div
                    style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;flex:none">
                    \${ propDetail.notSoldView ? \`
                      <button onClick="\${__b(propDetail.openSold)}"
                        style="display:flex;align-items:center;gap:8px;height:46px;padding:0 17px;border-radius:14px;background:#0b6f39;background-image:linear-gradient(140deg,#25b567,#0b6f39 55%,#06552b);color:#eafff2;font-size:16px;font-weight:800;white-space:nowrap"><i
                          class="ph-fill ph-seal-check" style="font-size:19px"></i>Mark sold</button>
                    \` : '' }
                    \${ propDetail.notSoldView ? \`
                      <button onClick="\${__b(propDetail.share)}"
                        style="display:flex;align-items:center;gap:8px;height:46px;padding:0 17px;border-radius:14px;background:#f8a800;color:#241d0c;font-size:16px;font-weight:800;white-space:nowrap"><i
                          class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>Send link</button>
                    \` : '' }
                    \${ propDetail.isRemovedView ? \`
                      <button onClick="\${__b(propDetail.restoreGo)}"
                        style="display:flex;align-items:center;gap:8px;height:46px;padding:0 17px;border-radius:14px;background:#1d7a43;background-image:linear-gradient(140deg,#27a05a,#125c31);color:#eafff2;font-size:16px;font-weight:800;white-space:nowrap"><i
                          class="ph-fill ph-arrow-counter-clockwise" style="font-size:19px"></i>Put back on sale</button>
                    \` : '' }
                    <div style="position:relative">
                      <button onClick="\${__b(propDetail.toggleMore)}" title="More"
                        style="width:46px;height:46px;border-radius:14px;background:#f0e5cd;color:#5c4a22;display:grid;place-items:center"
                        style-hover="background:#e7d9ba"><i class="ph-bold ph-dots-three"
                          style="font-size:20px"></i></button>
                      \${ propDetail.moreOpen ? \`
                        <div
                          style="position:absolute;top:calc(100% + 8px);right:0;width:250px;background:#fffdf7;border-radius:16px;box-shadow:0 0 0 1.5px #ecdcc0,0 26px 50px -22px rgba(40,26,2,.6);padding:8px;z-index:20;text-align:left">
                          \${ propDetail.notSoldView ? \`<button onClick="\${__b(propDetail.archiveGo)}"
                            style="width:100%;display:flex;align-items:center;gap:10px;height:50px;padding:0 14px;border-radius:12px;background:transparent;color:#4c463d;font-size:16px;font-weight:800"
                            style-hover="background:#f4ecdd"><i class="ph-fill ph-archive"
                              style="font-size:19px"></i>Take off market</button>\` : '' }
                          \${ propDetail.delIdle ? \`
                            <button onClick="\${__b(propDetail.arm)}"
                              style="width:100%;display:flex;align-items:center;gap:10px;height:50px;padding:0 14px;border-radius:12px;background:transparent;color:#a08a6c;font-size:16px;font-weight:800"
                              style-hover="background:#ffe4ea;color:#c2185b"><i class="ph ph-trash"
                                style="font-size:19px"></i>Remove from my list</button>
                          \` : '' }
                          \${ propDetail.delArm ? \`
                            <div style="padding:10px 12px">
                              <div style="font-size:15px;font-weight:700;color:#8a7a52;line-height:1.4">It moves to
                                Unsold with everything kept. You can put it back any time.</div>
                              <div style="display:flex;gap:8px;margin-top:10px">
                                <button onClick="\${__b(propDetail.disarm)}"
                                  style="flex:1;height:46px;border-radius:12px;background:#f4ecdd;color:#4c463d;font-size:15px;font-weight:800">Keep</button>
                                <button onClick="\${__b(propDetail.doDelete)}"
                                  style="flex:1;height:46px;border-radius:12px;background:#4b4741;color:#fff;font-size:15px;font-weight:800">Remove</button>
                              </div>
                            </div>
                          \` : '' }
                          \${ propDetail.purgeIdle ? \`
                            <button onClick="\${__b(propDetail.purgeGo)}"
                              style="width:100%;display:flex;align-items:center;gap:10px;height:50px;padding:0 14px;border-radius:12px;background:transparent;color:#a08a6c;font-size:16px;font-weight:800"
                              style-hover="background:#ffe4ea;color:#c2185b"><i class="ph ph-trash"
                                style="font-size:19px"></i>Delete for good</button>
                          \` : '' }
                          \${ propDetail.purgeArm ? \`
                            <div style="padding:10px 12px">
                              <div style="font-size:15px;font-weight:700;color:#a3143f;line-height:1.4">This erases the
                                property, its papers and its photos. It cannot be undone.</div>
                              <div style="display:flex;gap:8px;margin-top:10px">
                                <button onClick="\${__b(propDetail.purgeStop)}"
                                  style="flex:1;height:46px;border-radius:12px;background:#f4ecdd;color:#4c463d;font-size:15px;font-weight:800">Keep</button>
                                <button onClick="\${__b(propDetail.doPurge)}"
                                  style="flex:1;height:46px;border-radius:12px;background:#c2185b;color:#fff;font-size:15px;font-weight:800">Delete</button>
                              </div>
                            </div>
                          \` : '' }
                        </div>
                      \` : '' }
                    </div>
                    <button onClick="\${__b(propDetail.openMapcoAi)}" title="\${propDetail.mapcoAiReady ? 'Open Property Intelligence for this property' : 'Set the exact spot on MAPCO Earth to unlock Property Intelligence'}"
                      style="display:flex;align-items:center;gap:7px;height:46px;padding:0 15px;margin-right:8px;border-radius:14px;background:\${propDetail.mapcoAiReady ? 'linear-gradient(135deg,#ffc21e,#f8a800)' : 'rgba(0,0,0,.06)'};color:\${propDetail.mapcoAiReady ? '#241d0c' : 'rgba(92,74,34,.62)'};font-size:14.5px;font-weight:800;white-space:nowrap"
                      style-hover="filter:brightness(1.06)"><i class="ph-fill ph-sparkle"
                        style="font-size:17px"></i>MAPCO AI</button>
                    <button onClick="\${__b(propDetail.close)}" title="Close"
                      style="width:46px;height:46px;border-radius:14px;background:#f8a800;color:#241d0c;display:grid;place-items:center"><i
                        class="ph-bold ph-x" style="font-size:20px"></i></button>
                  </div>
                </div>


                <div data-scroll=""
                  style="flex:none;display:flex;align-items:center;padding:12px 20px;background:#ffefd2;border-bottom:2px solid #f0c96a;overflow-x:auto">
                  <div style="display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:18px;background:#fff3d6;box-shadow:inset 0 0 0 1.5px rgba(120,100,60,.16);">
                    \${ (propDetail.tabs || []).map(t => \`
                      <button onClick="\${__b(t.go)}" style="\${t.style}">
                        <i class="\${t.icon}" style="font-size:20px;flex:none"></i>
                        <span style="font-size:16px;font-weight:800;white-space:nowrap">\${t.label}</span>
                      </button>
                    \`).join('') }
                  </div>
                </div>

                <div style="flex:1;min-height:0;position:relative;background:#f5f1fd">

                  \${ propDetail.isGallery ? \`
                    <div style="position:absolute;inset:0;background:#1a1406;overflow:hidden">
                      <div style="\${propDetail.mediaStyle}"></div>
                      <div
                        style="position:absolute;left:0;right:0;top:0;height:96px;background:linear-gradient(180deg,rgba(12,8,2,.72),transparent)">
                      </div>

                      <div
                        style="position:absolute;top:16px;left:18px;display:flex;gap:7px;padding:7px;border-radius:16px;background:rgba(18,12,4,.62);backdrop-filter:blur(8px)">
                        \${ (propDetail.mediaTabs || []).map(m => \`
                          <button onClick="\${__b(m.go)}" title="\${m.label}" style="\${m.style}"><i
                              class="\${m.icon}" style="font-size:21px"></i></button>
                        \`).join('') }
                      </div>

                      \${ propDetail.mediaIsPhotos ? \`
                        <div>
                          \${ propDetail.hasPhotos ? \`
                            <div>
                              <button onClick="\${__b(propDetail.prevShot)}"
                                style="position:absolute;left:18px;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;background:rgba(255,253,247,.94);color:#241d0c;display:grid;place-items:center"
                                style-hover="background:#fff"><i class="ph-bold ph-caret-left"
                                  style="font-size:22px"></i></button>
                              <button onClick="\${__b(propDetail.nextShot)}"
                                style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;background:rgba(255,253,247,.94);color:#241d0c;display:grid;place-items:center"
                                style-hover="background:#fff"><i class="ph-bold ph-caret-right"
                                  style="font-size:22px"></i></button>
                              <div
                                style="position:absolute;left:0;right:0;bottom:0;padding:18px 20px 16px;background:linear-gradient(180deg,transparent,rgba(12,8,2,.9))">
                                <div data-scroll="" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:2px">
                                  \${ (propDetail.thumbs || []).map(t => \`<button
                                      onClick="\${__b(t.go)}" style="\${t.style}"></button>\`).join('') }
                                </div>
                                <div style="display:flex;align-items:flex-end;gap:14px;margin-top:12px;flex-wrap:wrap">
                                  <div style="flex:1;min-width:180px">
                                    <div
                                      style="font-size:12.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#f8c200">
                                      Photos</div>
                                    <div style="font-size:19px;font-weight:800;color:#fff;margin-top:2px">\${propDetail.title} · \${propDetail.locShort}</div>
                                  </div>
                                  <div style="font-size:16px;font-weight:800;color:#e2d3ae;flex:none">\${propDetail.shotLabel}</div>
                                </div>
                              </div>
                            </div>
                          \` : '' }
                          \${ propDetail.noPhotos ? \`
                            <div
                              style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#c8ab7f">
                              <i class="ph-fill ph-image-broken" style="font-size:60px"></i><span
                                style="font-size:21px;font-weight:800">No photos on this property yet</span>
                              <button onClick="\${__b(propDetail.setPhotos)}"
                                style="height:54px;padding:0 24px;border-radius:15px;background:#c1440e;color:#fff;font-size:17px;font-weight:800;margin-top:4px">Add
                                photos</button>
                            </div>
                          \` : '' }
                        </div>
                      \` : '' }

                      \${ propDetail.mediaIsEarth ? \`
                        <div>
                          <span style="position:absolute;left:50%;top:46%;transform:translate(-50%,-100%)"><i
                              class="ph-fill ph-map-pin"
                              style="font-size:52px;color:#3ce07f;filter:drop-shadow(0 6px 14px rgba(0,0,0,.75))"></i></span>
                          <div
                            style="position:absolute;left:0;right:0;bottom:0;padding:20px;background:linear-gradient(180deg,transparent,rgba(6,20,12,.9));display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
                            <div style="flex:1;min-width:200px">
                              <div
                                style="font-size:12.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#8fdcae">
                                Satellite view</div>
                              <div style="font-size:19px;font-weight:800;color:#fff;margin-top:2px">\${propDetail.earthLabel}</div>
                            </div>
                            \${ propDetail.earthOn ? \`<a href="/app/earth/index.html"
                                style="display:flex;align-items:center;gap:8px;height:50px;padding:0 20px;border-radius:14px;background:#fffdf7;color:#0a5b2e;font-size:16px;font-weight:800;text-decoration:none;flex:none">Open
                                in MAPCO Earth<i class="ph-bold ph-arrow-right" style="font-size:17px"></i></a>\` : '' }
                            \${ propDetail.earthOff ? \`<button onClick="\${__b(propDetail.setEarth)}"
                                style="height:50px;padding:0 20px;border-radius:14px;background:#c1440e;color:#fff;font-size:16px;font-weight:800;flex:none">Set
                                the exact spot</button>\` : '' }
                          </div>
                        </div>
                      \` : '' }

                      \${ propDetail.mediaIsMap ? \`
                        <div>
                          <div
                            style="position:absolute;left:0;right:0;bottom:0;padding:20px;background:linear-gradient(180deg,transparent,rgba(40,26,2,.9));display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
                            <div style="flex:1;min-width:200px">
                              <div
                                style="font-size:12.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#f8c200">
                                Sector map</div>
                              <div style="font-size:19px;font-weight:800;color:#fff;margin-top:2px">\${propDetail.sheetLabel}</div>
                            </div>
                            \${ propDetail.hasSheet ? \`<a href="/client/index.html"
                                style="display:flex;align-items:center;gap:8px;height:50px;padding:0 20px;border-radius:14px;background:#fffdf7;color:#7a5410;font-size:16px;font-weight:800;text-decoration:none;flex:none">Open
                                the sector map<i class="ph-bold ph-arrow-right" style="font-size:17px"></i></a>\` : '' }
                            \${ propDetail.noSheet ? \`<button onClick="\${__b(propDetail.linkSheet)}"
                                style="height:50px;padding:0 20px;border-radius:14px;background:#fffdf7;color:#4c463d;font-size:16px;font-weight:800;flex:none">Link
                                a sector map</button>\` : '' }
                          </div>
                        </div>
                      \` : '' }
                    </div>
                  \` : '' }

                  \${ propDetail.isOverview ? \`
                    <div data-scroll="" style="position:absolute;inset:0;overflow-y:auto;overflow-x:hidden">
                      \${ propDetail.isSoldView ? \`
                        <div
                          style="margin:18px 22px 0;border-radius:22px;background:#0a4a26;background-image:linear-gradient(140deg,#0f6338,#06331c);color:#e6f7ec;padding:20px 22px;box-shadow:inset 0 0 0 2px rgba(248,168,0,.34)">
                          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                            <span
                              style="width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.16);display:grid;place-items:center;flex:none"><i
                                class="ph-fill ph-seal-check" style="font-size:27px"></i></span>
                            <div style="flex:1;min-width:170px">
                              <div
                                style="font-size:13.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8fd6ab">
                                Sold for</div>
                              <div
                                style="font-family:'Newsreader',serif;font-weight:500;font-size:38px;line-height:1.05;color:#f8c200">
                                \${propDetail.saleFmt}</div>
                            </div>
                            <div style="display:flex;gap:22px;flex-wrap:wrap">
                              <div>
                                <div style="font-size:14px;font-weight:800;color:#8fd6ab">Sale date</div>
                                <div style="font-size:19px;font-weight:800;color:#fff;margin-top:2px">\${propDetail.saleDate}</div>
                              </div>
                              \${ propDetail.hasComm ? \`
                                <div>
                                  <div style="font-size:14px;font-weight:800;color:#8fd6ab">You earned</div>
                                  <div style="font-size:19px;font-weight:800;color:#fff;margin-top:2px">\${propDetail.saleComm}</div>
                                </div>
                              \` : '' }
                            </div>
                            \${ propDetail.hasDeal ? \`
                              <button onClick="\${__b(propDetail.goDeal)}"
                                style="display:flex;align-items:center;gap:9px;height:56px;padding:0 22px;border-radius:15px;background:#f8a800;color:#241d0c;font-size:17px;font-weight:800;flex:none">View
                                deal<i class="ph-bold ph-arrow-right" style="font-size:18px"></i></button>
                            \` : '' }
                          </div>
                          <div
                            style="display:flex;align-items:center;gap:13px;margin-top:14px;padding:13px 15px;border-radius:15px;background:rgba(255,255,255,.12);flex-wrap:wrap">
                            <i class="ph-fill ph-user-circle" style="font-size:23px;color:#8fd6ab"></i>
                            <div style="flex:1;min-width:150px">
                              <div style="font-size:14px;font-weight:800;color:#8fd6ab">Sold to</div>
                              <div style="font-size:18.5px;font-weight:800;color:#fff">\${propDetail.saleBuyer} <span
                                  style="font-weight:600;color:#b6d6c2">\${propDetail.saleBuyerPhone}</span></div>
                            </div>
                            \${ propDetail.hasBuyer ? \`<button onClick="\${__b(propDetail.goBuyer)}"
                                style="height:50px;padding:0 19px;border-radius:14px;background:rgba(255,255,255,.2);color:#fff;font-size:16px;font-weight:800">View
                                customer</button>\` : '' }
                          </div>
                        </div>
                      \` : '' }


                      <div
                        style="margin:16px 22px 0;border-radius:24px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <!-- Level 1: Property Summary Banner -->
                        <div
                          style="display:flex;align-items:center;gap:14px;padding:18px 22px;background:#fdf0d4;flex-wrap:wrap">
                          <span
                            style="width:44px;height:44px;border-radius:14px;background:#9a6a00;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="\${propDetail.typeIcon}" style="font-size:22px"></i></span>
                          <div style="flex:1;min-width:180px">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                              <span
                                style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9a6a00">\${propDetail.typeLabel}</span>
                              \${ propDetail.isNegotiable ? \`
                                <span
                                  style="font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(154,106,0,.15);color:#7a5400">Negotiable</span>
                              \` : '' }
                              \${ propDetail.isFixedPrice ? \`
                                <span
                                  style="font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.08);color:#5c5446">Fixed
                                  price</span>
                              \` : '' }
                            </div>
                            <div
                              style="font-size:21px;font-weight:800;color:#241f1c;margin-top:3px;line-height:1.25">
                              \${propDetail.headline}</div>
                          </div>
                          <button onClick="\${__b(propDetail.editGo)}"
                            style="display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-radius:13px;background:#9a6a00;color:#fff;font-size:15.5px;font-weight:800;flex:none;box-shadow:0 6px 16px -6px rgba(154,106,0,.6)"><i
                              class="ph-fill ph-pencil-simple" style="font-size:17px"></i>Edit property</button>
                        </div>

                        <!-- Key Advantage Highlights -->
                        \${ propDetail.hasHighlightChips ? \`
                          <div
                            style="padding:12px 22px;background:#fff8e8;border-bottom:1px solid #f0e2c8;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span
                              style="font-size:11.5px;font-weight:800;color:#9a6a00;text-transform:uppercase;letter-spacing:.08em;margin-right:2px">Highlights:</span>
                            \${ (propDetail.highlightChips || []).map(h => \`
                              <span style="\${h.style}"><i class="\${h.icon}" style="font-size:14px"></i>\${h.label}</span>
                            \`).join('') }
                          </div>
                        \` : '' }

                        <div style="padding:20px 22px 22px">
                          <!-- Level 2: Key Specs Grid (6-8 structured facts) -->
                          <div
                            style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a7f6e;margin-bottom:10px">
                            Key Specifications</div>
                          <div
                            style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px">
                            \${ (propDetail.keySpecs || []).map(s => \`
                              <div
                                style="display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:16px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #ecdcc0">
                                <i class="\${s.icon}" style="font-size:21px;color:#a3541b;flex:none"></i>
                                <div style="flex:1;min-width:0">
                                  <div
                                    style="font-size:11px;font-weight:800;color:#9c907e;text-transform:uppercase;letter-spacing:.06em">
                                    \${s.label}</div>
                                  <div
                                    style="font-size:17px;font-weight:800;color:#241f1c;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                                    \${s.value}</div>
                                </div>
                              </div>
                            \`).join('') }
                          </div>

                          <!-- Level 3: Grouped Property Details -->
                          <div
                            style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a7f6e;margin-top:24px;margin-bottom:10px">
                            Property Breakdown</div>
                          <div
                            style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px">
                            \${ (propDetail.detailGroups || []).map(g => \`
                              <div style="\${g.wrap}">
                                <div style="display:flex;align-items:center;gap:9px;\${g.headColor}"><i
                                    class="\${g.icon}" style="font-size:19px"></i><span
                                    style="font-size:14px;font-weight:800;letter-spacing:.09em;text-transform:uppercase">\${g.title}</span></div>
                                \${ g.hasItems ? \`
                                  <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
                                    \${ (g.items || []).map(i => \`
                                      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
                                        <span
                                          style="font-size:15px;font-weight:700;color:#7a6f5e">\${i.label}</span>
                                        <span
                                          style="font-size:15.5px;font-weight:800;color:#241f1c;text-align:right">\${i.value}</span>
                                      </div>
                                    \`).join('') }
                                  </div>
                                \` : '' }
                                \${ g.hasChips ? \`
                                  <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:11px">
                                    \${ (g.chips || []).map(c => \`<span
                                        style="\${c.style}"><i class="ph-fill ph-check" style="font-size:14px"></i>\${c.label}</span>\`).join('') }
                                  </div>
                                \` : '' }
                              </div>
                            \`).join('') }
                          </div>

                          <!-- Level 4: Expandable More Details -->
                          \${ propDetail.hasMoreDetails ? \`
                            <div style="margin-top:20px">
                              <button onClick="\${__b(propDetail.toggleMoreDetails)}"
                                style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 18px;border-radius:15px;background:#f7f2e7;border:1px solid #e2d8c4;font-size:15px;font-weight:800;color:#6b5e4c;cursor:pointer">
                                <span style="display:flex;align-items:center;gap:8px">
                                  <i class="ph-bold \${propDetail.moreIcon}"
                                    style="font-size:16px;color:#9a6a00"></i>
                                  \${propDetail.moreLabel}
                                </span>
                                <span style="font-size:13px;font-weight:700;color:#9a8f80">\${propDetail.moreAction}</span>
                              </button>

                              \${ propDetail.moreDetailsOpen ? \`
                                <div
                                  style="margin-top:12px;padding:18px 20px;border-radius:18px;background:#fffdf7;border:1.5px dashed #ded4c0">
                                  <div
                                    style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
                                    \${ (propDetail.moreDetailsList || []).map(m => \`
                                      <div
                                        style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #f0e8d8">
                                        <span style="font-size:14px;font-weight:700;color:#8a7f6e">\${m.label}</span>
                                        <span
                                          style="font-size:14.5px;font-weight:800;color:#241f1c;text-align:right">\${m.value}</span>
                                      </div>
                                    \`).join('') }
                                  </div>
                                  \${ propDetail.hasCustomNotes ? \`
                                    <div
                                      style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#fff8e8;border:1px solid #f0d493">
                                      <div
                                        style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#a3541b;letter-spacing:.08em">
                                        Internal Notes &amp; Highlights</div>
                                      <div
                                        style="font-size:14.5px;font-weight:600;color:#4c4233;margin-top:4px;line-height:1.5">
                                        \${propDetail.customNotes}</div>
                                    </div>
                                  \` : '' }
                                </div>
                              \` : '' }
                            </div>
                          \` : '' }
                        </div>
                      </div>

                      <div style="height:20px"></div>
                    </div>
                  \` : '' }

                  \${ propDetail.isSellerTab ? \`
                    <div data-scroll="" style="position:absolute;inset:0;overflow-y:auto;overflow-x:hidden">
                      <div
                        style="margin:16px 22px 0;border-radius:22px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 20px;background:#ebe3fa;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#4a2c99;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-user-circle" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">Who is selling it</div>
                            <div style="font-size:15.5px;font-weight:700;color:#4a2c99;margin-top:1px">Never shown to
                              any client</div>
                          </div>
                          <span
                            style="display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 13px;border-radius:999px;background:#fff;color:#4a2c99;font-size:14px;font-weight:800;flex:none"><i
                              class="ph-fill ph-lock-key" style="font-size:15px"></i>Private</span>
                        </div>
                        <div style="padding:4px 20px 20px">
                          \${ propDetail.hasSeller ? \`
                            <div>
                              <div
                                style="display:flex;align-items:center;gap:13px;margin-top:14px;padding:16px 18px;border-radius:16px;background:#f6f2ff;box-shadow:inset 0 0 0 1.5px #ddd0f5;flex-wrap:wrap">
                                <span
                                  style="width:54px;height:54px;border-radius:50%;background:#e7defc;color:#4a2c99;display:grid;place-items:center;font-size:18px;font-weight:800;flex:none">\${propDetail.sellerInitials}</span>
                                <div style="flex:1;min-width:170px">
                                  <div style="font-size:21px;font-weight:800;color:#241f1c">\${propDetail.sellerName}
                                  </div>
                                  <div style="font-size:16px;color:#6b6156">\${propDetail.sellerPhone} · \${propDetail.sellerKind} · \${propDetail.sellerRelation}</div>
                                  \${ propDetail.hasSellerBusiness ? \`
                                    <div style="font-size:15.5px;font-weight:700;color:#5b32c4;margin-top:1px">\${propDetail.sellerBusiness}</div>
                                  \` : '' }
                                </div>
                                <a href="\${propDetail.sellerTel}"
                                  style="display:flex;align-items:center;gap:9px;height:50px;padding:0 18px;border-radius:14px;background:#0b6f39;background-image:linear-gradient(140deg,#25b567,#0b6f39 55%,#06552b);color:#eafff2;font-size:16px;font-weight:800;text-decoration:none;flex:none"><i
                                    class="ph-fill ph-phone" style="font-size:18px"></i>Call</a>
                                <button onClick="\${__b(propDetail.goSeller)}"
                                  style="display:flex;align-items:center;gap:9px;height:50px;padding:0 19px;border-radius:14px;background:#4a2c99;color:#efe8fb;font-size:16px;font-weight:800;flex:none">Full
                                  seller profile<i class="ph-bold ph-arrow-right" style="font-size:17px"></i></button>
                              </div>
                              <div
                                style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:11px">
                                \${ (propDetail.sellerFacts || []).map(f => \`
                                  <div
                                    style="padding:14px 16px;border-radius:14px;background:#f6f2ff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                                    <div
                                      style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b52a8">
                                      <i class="\${f.icon}" style="font-size:15px"></i>\${f.label}</div>
                                    <div
                                      style="font-size:18.5px;font-weight:800;color:#241f1c;margin-top:4px;text-wrap:pretty">
                                      \${f.value}</div>
                                  </div>
                                \`).join('') }
                              </div>

                              \${ propDetail.hasVisit ? \`

                              \` : '' }
                              \${ propDetail.hasSellerNote ? \`
                                <div
                                  style="display:flex;align-items:flex-start;gap:12px;margin-top:11px;padding:15px 17px;border-radius:15px;background:#fff6f2;box-shadow:inset 0 0 0 1.5px #f6dcd4">
                                  <i class="ph-fill ph-lock-key"
                                    style="font-size:20px;color:#b02a37;flex:none;margin-top:2px"></i>
                                  <div>
                                    <div
                                      style="font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#b02a37">
                                      Private note about this deal</div>
                                    <div
                                      style="font-size:17.5px;font-weight:700;color:#241f1c;margin-top:2px;text-wrap:pretty">
                                      \${propDetail.sellerNote}</div>
                                  </div>
                                </div>
                              \` : '' }
                            </div>
                          \` : '' }
                          \${ propDetail.noSeller ? \`
                            <div
                              style="display:flex;align-items:center;gap:13px;margin-top:14px;padding:16px 18px;border-radius:15px;background:#f6f2ff;box-shadow:inset 0 0 0 1.5px #ddd0f5;flex-wrap:wrap">
                              <div style="flex:1;min-width:180px;font-size:16.5px;font-weight:700;color:#6b52a8">No
                                seller saved for this property.</div>
                              <button onClick="\${__b(propDetail.addSellerGo)}"
                                style="height:50px;padding:0 19px;border-radius:14px;background:#4a2c99;color:#efe8fb;font-size:16px;font-weight:800">Add
                                seller</button>
                            </div>
                          \` : '' }
                        </div>
                      </div>
                      <div style="height:18px"></div>
                    </div>
                  \` : '' }


                  \${ propDetail.isPapersTab ? \`
                    <div data-scroll="" style="position:absolute;inset:0;overflow-y:auto;overflow-x:hidden">
                      <div
                        style="margin:16px 22px 0;border-radius:22px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 20px;background:#dff0f6;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#0f5f7a;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-folder-open" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">Papers on file</div>
                            <div style="font-size:15.5px;font-weight:700;color:#0f5f7a;margin-top:1px">\${propDetail.docCount} · private to you</div>
                          </div>
                          <button onClick="\${__b(propDetail.addDocsGo)}"
                            style="height:48px;padding:0 18px;border-radius:13px;background:#0f5f7a;color:#fff;font-size:16px;font-weight:800;flex:none">Add
                            documents</button>
                        </div>
                        \${ propDetail.hasDocs ? \`
                          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 20px 20px">
                            \${ (propDetail.docs || []).map(d => \`
                              <div
                                style="border-radius:16px;overflow:hidden;background:#f2f9fc;box-shadow:inset 0 0 0 1.5px #c9e2ec">
                                <div style="\${d.thumbStyle}"></div>
                                <div style="padding:11px 13px 13px">
                                  <div style="font-size:16px;font-weight:800;color:#241f1c">\${d.name}</div>
                                  <div style="font-size:13.5px;font-weight:800;color:#0f5f7a;margin-top:3px">\${d.kind}</div>
                                </div>
                              </div>
                            \`).join('') }
                          </div>
                        \` : '' }
                        \${ propDetail.noDocs ? \`
                          <div style="padding:16px 20px 20px">
                            <div
                              style="padding:18px;border-radius:16px;background:#f2f9fc;box-shadow:inset 0 0 0 1.5px #c9e2ec;font-size:16.5px;font-weight:700;color:#0f5f7a">
                              No papers saved yet. Registry, mutation and NOC all live here.</div>
                          </div>
                        \` : '' }
                      </div>
                      \${ propDetail.hasSellerDocs ? \`
                        <div
                          style="margin:16px 22px 0;border-radius:22px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                          <div
                            style="display:flex;align-items:center;gap:13px;padding:15px 20px;background:#e6def7;flex-wrap:wrap">
                            <span
                              style="width:42px;height:42px;border-radius:13px;background:#5b32c4;color:#fff;display:grid;place-items:center;flex:none"><i
                                class="ph-fill ph-file-text" style="font-size:21px"></i></span>
                            <div style="flex:1;min-width:160px">
                              <div style="font-size:20px;font-weight:800;color:#241f1c">Papers the seller handed over
                              </div>
                              <div style="font-size:15.5px;font-weight:700;color:#5b32c4;margin-top:1px">Named by you
                                when you took them in</div>
                            </div>
                          </div>
                          <div style="display:flex;flex-wrap:wrap;gap:9px;padding:16px 20px 20px">
                            \${ (propDetail.sellerDocs || []).map(d => \`<span
                                style="\${d.style}"><i class="ph-fill ph-file-text" style="font-size:16px"></i>\${d.label}</span>\`).join('') }
                          </div>
                        </div>
                      \` : '' }
                      <div style="height:18px"></div>
                    </div>
                  \` : '' }


                  \${ propDetail.isClientsTab ? \`
                    <div data-scroll="" style="position:absolute;inset:0;overflow-y:auto;overflow-x:hidden">
                      <div
                        style="margin:16px 22px 0;border-radius:22px;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2;overflow:hidden">
                        <div
                          style="display:flex;align-items:center;gap:13px;padding:15px 20px;background:#e1ecfb;flex-wrap:wrap">
                          <span
                            style="width:42px;height:42px;border-radius:13px;background:#1a5aa8;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-users-three" style="font-size:21px"></i></span>
                          <div style="flex:1;min-width:160px">
                            <div style="font-size:20px;font-weight:800;color:#241f1c">Who you sent it to</div>
                            <div style="font-size:15.5px;font-weight:700;color:#1a5aa8;margin-top:1px">\${propDetail.engageLine}</div>
                          </div>
                          \${ propDetail.notSoldView ? \`
                            <button onClick="\${__b(propDetail.share)}"
                              style="display:flex;align-items:center;gap:7px;height:44px;padding:0 15px;border-radius:12px;background:#f8a800;color:#241d0c;font-size:15px;font-weight:800;flex:none;white-space:nowrap"><i
                                class="ph-fill ph-paper-plane-tilt" style="font-size:16px"></i>Send link<i
                                class="ph-bold ph-arrow-right" style="font-size:14px"></i></button>
                          \` : '' }
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;padding:16px 20px 0">
                          <div style="\${propDetail.blueStat}"><span
                              style="font-size:13.5px;font-weight:800;color:#1a5aa8">Customers</span><span
                              style="font-size:26px;font-weight:800;color:#241f1c">\${propDetail.shareCustCount}</span></div>
                          <div style="\${propDetail.blueStat}"><span
                              style="font-size:13.5px;font-weight:800;color:#1a5aa8">Live links</span><span
                              style="font-size:26px;font-weight:800;color:#241f1c">\${propDetail.shareActiveCount}</span></div>
                          <div style="\${propDetail.blueStat}"><span
                              style="font-size:13.5px;font-weight:800;color:#1a5aa8">Link opens</span><span
                              style="font-size:26px;font-weight:800;color:#241f1c">\${propDetail.actLinkOpens}</span>
                          </div>
                          <div style="\${propDetail.blueStat}"><span
                              style="font-size:13.5px;font-weight:800;color:#1a5aa8">Shown by you</span><span
                              style="font-size:26px;font-weight:800;color:#241f1c">\${propDetail.actOpens}</span>
                          </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:10px;padding:14px 20px 18px">
                          \${ (propDetail.shareRows || []).map(r => \`
                            <button onClick="\${__b(r.open)}"
                              style="width:100%;text-align:left;padding:14px 16px;border-radius:16px;background:#f3f7fd;box-shadow:inset 0 0 0 1.5px #d3e2f5"
                              style-hover="background:#e7f0fc">
                              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                                <span
                                  style="width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:15px;font-weight:800;background:#d7e8ff;color:#1a5aa8">\${r.initials}</span>
                                <div style="flex:1;min-width:140px">
                                  <div style="font-size:18px;font-weight:800;color:#241f1c">\${r.name}</div>
                                  <div style="font-size:15.5px;color:#6b6156;margin-top:1px">\${r.lastText}</div>
                                </div>
                                <span style="\${r.liveStyle}">\${r.liveLabel}</span>
                                <span style="font-size:16px;font-weight:800;color:#1a5aa8;flex:none">\${r.opensText}</span>
                              </div>
                              \${ r.hasActs ? \`
                                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                                  \${ (r.acts || []).map(a => \`<span
                                      style="\${a.style}"><i class="\${a.icon}" style="font-size:14px"></i>\${a.label}</span>\`).join('') }
                                </div>
                              \` : '' }
                            </button>
                          \`).join('') }
                          \${ propDetail.noShareRows ? \`
                            <div
                              style="padding:15px 17px;border-radius:15px;background:#f3f7fd;box-shadow:inset 0 0 0 1.5px #d3e2f5;font-size:16.5px;font-weight:600;color:#4a6d99">
                              Not shared with anyone yet.</div>
                          \` : '' }
                        </div>
                      </div>

                      \${ propDetail.noRecentAct ? \`
                        <div
                          style="margin:16px 22px 0;padding:18px 20px;border-radius:20px;background:#f6f3ec;box-shadow:inset 0 0 0 1.5px #e2dbcc;font-size:16.5px;font-weight:700;color:#6b6156">
                          Nothing recorded on this property yet.</div>
                      \` : '' }
                      <div style="height:18px"></div>
                    </div>
                  \` : '' }


                  \${ propDetail.isMktTab ? \`
                    <div data-scroll="" style="position:absolute;inset:0;overflow-y:auto;overflow-x:hidden">
                      <div
                        style="margin:16px 22px 0;border-radius:24px;overflow:hidden;background:#fffdf7;box-shadow:0 0 0 1.5px #ece3d2">
                        <div
                          style="display:flex;align-items:center;gap:14px;padding:18px 22px;background:#fde5d3;flex-wrap:wrap">
                          <span
                            style="width:46px;height:46px;border-radius:14px;background:#c0490c;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-megaphone" style="font-size:23px"></i></span>
                          <div style="flex:1;min-width:180px">
                            <div style="font-size:21px;font-weight:800;color:#241f1c">Marketing for this property</div>
                            <div style="font-size:15.5px;font-weight:700;color:#c0490c;margin-top:1px">\${propDetail.mktSub}</div>
                          </div>
                          <a href="/admin/marketing.html"
                            style="display:flex;align-items:center;gap:8px;height:50px;padding:0 19px;border-radius:14px;background:#c0490c;color:#fff;font-size:16px;font-weight:800;text-decoration:none;flex:none">Open
                            Marketing<i class="ph-bold ph-arrow-right" style="font-size:17px"></i></a>
                        </div>

                        \${ propDetail.hasMkt ? \`
                          <div style="padding:18px 22px 22px">
                            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px">
                              \${ (propDetail.mktStats || []).map(k => \`
                                <div style="\${k.style}">
                                  <div style="display:flex;align-items:center;gap:8px"><i class="\${k.icon}"
                                      style="font-size:17px;color:#c0490c"></i><span
                                      style="font-size:13.5px;font-weight:800;color:#a03d09">\${k.label}</span></div>
                                  <div
                                    style="font-family:'Newsreader',serif;font-weight:500;font-size:40px;line-height:1;color:#241f1c;margin-top:8px">
                                    \${k.value}</div>
                                </div>
                              \`).join('') }
                            </div>

                            \${ propDetail.hasPerf ? \`
                              <div
                                style="margin-top:16px;border-radius:20px;background:#241d0c;background-image:linear-gradient(130deg,#3a2c12,#191305);padding:20px 22px">
                                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                                  <i class="ph-fill ph-chart-line-up" style="font-size:21px;color:#f8a800"></i>
                                  <div
                                    style="flex:1;min-width:160px;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#f8c200">
                                    How the adverts performed</div>
                                  <span style="font-size:14.5px;font-weight:700;color:#c7b992">Straight from the
                                    platforms</span>
                                </div>
                                <div
                                  style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:16px">
                                  \${ (propDetail.perfRows || []).map(p => \`
                                    <div>
                                      <div style="display:flex;align-items:baseline;gap:8px"><span
                                          style="font-family:'Newsreader',serif;font-weight:500;font-size:34px;line-height:1;color:#fff">\${p.value}</span><span style="font-size:14px;font-weight:800;color:#c7b992">\${p.label}</span></div>
                                      <div
                                        style="height:8px;border-radius:999px;background:rgba(255,255,255,.14);margin-top:9px;overflow:hidden">
                                        <span style="\${p.barStyle}"></span></div>
                                    </div>
                                  \`).join('') }
                                </div>
                              </div>
                            \` : '' }
                            \${ propDetail.noPerf ? \`
                              <div
                                style="margin-top:16px;padding:18px 20px;border-radius:18px;background:#fff6ee;box-shadow:inset 0 0 0 1.5px #f5d3ba;font-size:16.5px;font-weight:700;color:#a03d09">
                                Nothing published yet, so there are no platform numbers to show.</div>
                            \` : '' }

                            <div style="display:flex;align-items:center;gap:10px;margin-top:20px;flex-wrap:wrap">
                              <div
                                style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a03d09">
                                Every post and reel</div>
                              <div style="flex:1;height:1px;background:#f0dcc8"></div>
                            </div>
                            <div
                              style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:14px">
                              \${ (propDetail.mktAssets || []).map(a => \`
                                <div
                                  style="border-radius:18px;overflow:hidden;background:#fff6ee;box-shadow:inset 0 0 0 1.5px #f5d3ba">
                                  <div style="\${a.thumbStyle}"><span style="\${a.statusStyle}">\${a.status}</span><span style="\${a.kindStyle}"><i class="\${a.kindIcon}"
                                        style="font-size:14px"></i>\${a.kind}</span></div>
                                  <div style="padding:13px 15px 15px">
                                    <div style="font-size:17px;font-weight:800;color:#241f1c">\${a.plat}</div>
                                    <div
                                      style="display:flex;align-items:center;gap:7px;font-size:14.5px;font-weight:700;color:#a03d09;margin-top:3px">
                                      <i class="ph-fill ph-calendar-blank" style="font-size:15px"></i>\${a.date}</div>
                                  </div>
                                </div>
                              \`).join('') }
                            </div>
                          </div>
                        \` : '' }
                        \${ propDetail.noMkt ? \`
                          <div style="padding:20px 22px 24px">
                            <div
                              style="display:flex;align-items:center;gap:14px;padding:20px;border-radius:18px;background:#fff6ee;box-shadow:inset 0 0 0 1.5px #f5d3ba;flex-wrap:wrap">
                              <i class="ph-fill ph-megaphone" style="font-size:30px;color:#c0490c;flex:none"></i>
                              <div
                                style="flex:1;min-width:200px;font-size:17px;font-weight:700;color:#a03d09;text-wrap:pretty">
                                No post or reel made for this property yet. Make one and it will show up here with its
                                real numbers.</div>
                              <a href="/admin/marketing.html"
                                style="height:50px;padding:0 20px;border-radius:14px;background:#c0490c;color:#fff;font-size:16px;font-weight:800;text-decoration:none;display:flex;align-items:center;flex:none">Make
                                one now</a>
                            </div>
                          </div>
                        \` : '' }
                      </div>
                      <div style="height:20px"></div>
                    </div>
                  \` : '' }

                </div>
              </div>
            </div>
          \` : '' }


          \${ docPickOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:96;display:flex;align-items:center;justify-content:center;padding:26px">
              <div onClick="\${__b(closeDocPick)}" style="position:absolute;inset:0;background:rgba(30,18,50,.66)"></div>
              <div data-scroll=""
                style="position:relative;width:720px;max-width:100%;max-height:86vh;overflow-y:auto;background:#f3eeff;border-radius:24px;box-shadow:0 40px 90px -28px rgba(0,0,0,.7);">
                <div
                  style="position:sticky;top:0;display:flex;align-items:center;gap:13px;padding:20px 24px;background:#4a2c99;color:#efe8fb">
                  <i class="ph-fill ph-folder-open" style="font-size:25px"></i>
                  <div style="flex:1;font-size:23px;font-weight:800;color:#fff">Pick a document</div>
                  <button onClick="\${__b(closeDocPick)}"
                    style="width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center"><i
                      class="ph-bold ph-x" style="font-size:18px"></i></button>
                </div>
                <div style="display:flex;flex-direction:column;gap:9px;padding:18px 24px 24px">
                  \${ (pDocList || []).map(d => \`<button onClick="\${__b(d.go)}"
                      style="\${d.style}" style-hover="box-shadow:inset 0 0 0 2px #4a2c99"><i
                        class="ph-fill ph-file-text" style="font-size:20px;color:#5b32c4;flex:none"></i>\${d.label}</button>\`).join('') }
                </div>
              </div>
            </div>
          \` : '' }

          \${ docNewOpen ? \`
            <div style="position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:26px">
              <div onClick="\${__b(closeDocNew)}" style="position:absolute;inset:0;background:rgba(30,18,50,.66)"></div>
              <div
                style="position:relative;width:520px;max-width:100%;background:#f3eeff;border-radius:24px;padding:26px;box-shadow:0 40px 90px -28px rgba(0,0,0,.7);">
                <div style="font-size:24px;font-weight:800;color:#3a1f7a">Name this document</div>
                <div style="font-size:16.5px;color:#6b52a8;margin-top:4px">Then add its photos.</div>
                <input value="\${docNewName}" onInput="\${__b(onDocNewName)}" placeholder="e.g. Panchayat NOC"
                  style="\${pInput};margin-top:16px">
                <div style="display:flex;gap:10px;margin-top:16px">
                  <button onClick="\${__b(closeDocNew)}"
                    style="height:60px;padding:0 20px;border-radius:15px;background:#fff;color:#6b52a8;font-size:17px;font-weight:800">Cancel</button>
                  <div style="flex:1"></div>
                  <button onClick="\${__b(saveDocNew)}" style="\${docNewStyle}"><i class="ph-bold ph-plus"
                      style="font-size:19px"></i>Create and add photos</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ docOpenOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:97;display:flex;align-items:center;justify-content:center;padding:26px">
              <div onClick="\${__b(docOpen.close)}" style="position:absolute;inset:0;background:rgba(30,18,50,.7)"></div>
              <div data-scroll=""
                style="position:relative;width:860px;max-width:100%;max-height:88vh;overflow-y:auto;background:#f3eeff;border-radius:26px;box-shadow:0 44px 96px -28px rgba(0,0,0,.72);">
                <div
                  style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:14px;padding:20px 24px;background:#4a2c99;color:#efe8fb">
                  <span
                    style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center;flex:none"><i
                      class="ph-fill ph-file-text" style="font-size:24px"></i></span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:24px;font-weight:800;color:#fff">\${docOpen.name}</div>
                    <div style="font-size:16px;color:#d3c6f5">\${docOpen.kind} · \${docOpen.countLine}</div>
                  </div>
                  <button onClick="\${__b(docOpen.removeDoc)}"
                    style="height:46px;padding:0 16px;border-radius:13px;background:rgba(255,255,255,.14);color:#ffd0dd;font-size:15.5px;font-weight:800;flex:none">Remove</button>
                  <button onClick="\${__b(docOpen.close)}"
                    style="width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center;flex:none"><i
                      class="ph-bold ph-x" style="font-size:19px"></i></button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:13px;padding:20px 24px 24px">
                  \${ (docOpen.photos || []).map(p => \`
                    <div style="\${p.style}">
                      <button onClick="\${__b(p.remove)}" title="Remove"
                        style="position:absolute;right:10px;bottom:10px;width:38px;height:38px;border-radius:11px;background:#c2185b;color:#fff;display:grid;place-items:center"><i
                          class="ph-bold ph-trash" style="font-size:16px"></i></button>
                    </div>
                  \`).join('') }
                  <button onClick="\${__b(docOpen.add)}"
                    style="height:190px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px #d6c6f2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#4a2c99"
                    style-hover="background:#eae0ff"><i class="ph-bold ph-plus" style="font-size:34px"></i><span
                      style="font-size:17px;font-weight:800">Add photo</span></button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ savingProp ? \`
            <div
              style="position:fixed;inset:0;z-index:210;display:grid;place-items:center;background:#eaf8ef;background-image:radial-gradient(70% 60% at 20% 8%,rgba(46,196,116,.34),transparent 62%),radial-gradient(60% 52% at 84% 92%,rgba(244,174,20,.3),transparent 64%);animation:omVeil .22s ease both">
              <div style="text-align:center;padding:40px">
                <div
                  style="width:132px;height:132px;margin:0 auto;border-radius:50%;background:#0b6f39;background-image:linear-gradient(140deg,#22b35f,#0a5b2e);display:grid;place-items:center;box-shadow:0 30px 60px -22px rgba(11,111,57,.8);">
                  <i class="ph-fill ph-check" style="font-size:66px;color:#eafff2"></i>
                </div>
                <div
                  style="font-size:13px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#12a150;margin-top:26px;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
                  Saved to MAPCO</div>
                <div
                  style="font-family:'Newsreader',serif;font-weight:500;font-size:38px;letter-spacing:-.015em;color:#0e3d22;margin-top:8px;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.16s">
                  \${savingTitle}</div>
                <div
                  style="font-size:18px;font-weight:600;color:#4a7a5c;margin-top:5px;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.22s">
                  \${savingLoc}</div>
                <div
                  style="display:inline-flex;align-items:center;gap:9px;margin-top:20px;padding:11px 20px;border-radius:999px;background:#0b6f39;color:#eafff2;font-size:16px;font-weight:800;animation:moneyUp .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.3s">
                  <i class="ph-fill ph-globe-hemisphere-east" style="font-size:18px"></i>Live on MAPCO Earth, Links and
                  Marketing</div>
              </div>
            </div>
          \` : '' }

          \${ sellerViewOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:88;display:flex;align-items:center;justify-content:center;padding:24px">
              <div onClick="\${__b(sellerView.close)}"
                style="position:absolute;inset:0;background:rgba(40,26,2,.66);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:1060px;max-width:100%;height:100%;max-height:92vh;display:flex;flex-direction:column;background:#faf7ff;border-radius:26px;overflow:hidden;box-shadow:0 50px 110px -30px rgba(0,0,0,.78);">

                <div
                  style="flex:none;display:flex;align-items:center;gap:16px;padding:18px 24px;background:#fff;flex-wrap:wrap">
                  <span
                    style="width:64px;height:64px;border-radius:20px;background:#e7defc;color:#4a2c99;display:grid;place-items:center;font-size:22px;font-weight:800;flex:none">\${sellerView.initials}</span>
                  <div style="flex:1 1 200px;min-width:0">
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                      <div
                        style="font-family:'Newsreader',serif;font-weight:500;font-size:30px;letter-spacing:-.015em;color:#241f1c">
                        \${sellerView.name}</div>
                      <span
                        style="display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:999px;background:#ebe3fa;color:#4a2c99;font-size:14px;font-weight:800;flex:none"><i
                          class="ph-fill ph-lock-key" style="font-size:15px"></i>Dealer only</span>
                    </div>
                    <div style="font-size:16px;color:#6b52a8;font-weight:700;margin-top:2px">\${sellerView.phone} · \${sellerView.kind} · \${sellerView.city}</div>
                  </div>
                  <div
                    style="display:flex;align-items:center;gap:9px;flex-wrap:nowrap;justify-content:flex-end;flex:none">
                    <a href="\${sellerView.tel}" title="Call seller"
                      style="display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:#0b6f39;background-image:linear-gradient(140deg,#25b567,#0b6f39 55%,#06552b);color:#eafff2;flex:none;text-decoration:none"><i
                        class="ph-fill ph-phone" style="font-size:21px"></i></a>
                    <a href="\${sellerView.wa}" target="_blank" title="WhatsApp"
                      style="display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:#e3f4e9;color:#0a6634;flex:none;text-decoration:none"
                      style-hover="background:#d0ecda"><i class="ph-fill ph-whatsapp-logo"
                        style="font-size:21px"></i></a>
                  </div>
                  <button onClick="\${__b(sellerView.close)}"
                    style="width:50px;height:50px;border-radius:14px;background:#2b1a56;color:#e7defc;display:grid;place-items:center;flex:none"><i
                      class="ph-bold ph-x" style="font-size:20px"></i></button>
                </div>

                <div
                  style="flex:none;display:flex;gap:10px;padding:12px 24px;background:#ebe3fa;box-shadow:inset 0 2px 0 rgba(74,44,153,.14),inset 0 -2px 0 rgba(74,44,153,.14)">
                  \${ (sellerView.tabs || []).map(t => \`
                    <button onClick="\${__b(t.go)}" style="\${t.style}">
                      <i class="\${t.icon}" style="font-size:21px;flex:none"></i>
                      <span
                        style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;white-space:nowrap">
                        <span style="font-size:16.5px;font-weight:800">\${t.label}</span>
                        <span style="\${t.subStyle}">\${t.sub}</span>
                      </span>
                    </button>
                  \`).join('') }
                </div>

                <div data-scroll=""
                  style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px 24px 28px">
                  \${ sellerView.isOverview ? \`
                    <div>
                      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
                        <div
                          style="padding:18px 20px;border-radius:20px;background:#fff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                          <div
                            style="font-size:13px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#6b52a8">
                            With you</div>
                          <div
                            style="font-family:'Newsreader',serif;font-weight:500;font-size:34px;line-height:1.1;color:#241f1c;margin-top:4px">
                            \${sellerView.countLine}</div>
                        </div>
                        <div
                          style="padding:18px 20px;border-radius:20px;background:#fff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                          <div
                            style="font-size:13px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#6b52a8">
                            Value on sale</div>
                          <div
                            style="font-family:'Newsreader',serif;font-weight:500;font-size:34px;line-height:1.1;color:#b8460f;margin-top:4px">
                            \${sellerView.valueLine}</div>
                        </div>
                        \${ sellerView.hasPhone2 ? \`
                          <div
                            style="padding:18px 20px;border-radius:20px;background:#fff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                            <div
                              style="font-size:13px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#6b52a8">
                              Another number</div>
                            <div style="font-size:23px;font-weight:800;color:#241f1c;margin-top:7px">\${sellerView.phone2}</div>
                          </div>
                        \` : '' }
                      </div>

                      <div
                        style="border-radius:22px;background:#fff;box-shadow:inset 0 0 0 1.5px #ddd0f5;overflow:hidden;margin-top:14px">
                        <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:#f2edff">
                          <span
                            style="width:40px;height:40px;border-radius:12px;background:#4a2c99;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-identification-card" style="font-size:20px"></i></span>
                          <div style="flex:1;min-width:150px">
                            <div style="font-size:19px;font-weight:800;color:#241f1c">Everything you know about him
                            </div>
                            <div style="font-size:15px;font-weight:700;color:#6b52a8;margin-top:1px">Never shown to any
                              client</div>
                          </div>
                        </div>
                        <div
                          style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:11px;padding:16px 20px 20px">
                          \${ (sellerView.facts || []).map(f => \`
                            <div
                              style="padding:15px 17px;border-radius:16px;background:#f6f2ff;box-shadow:inset 0 0 0 1.5px #ddd0f5">
                              <div
                                style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#6b52a8">
                                <i class="\${f.icon}" style="font-size:15px"></i>\${f.label}</div>
                              <div style="font-size:19px;font-weight:800;color:#241f1c;margin-top:4px;text-wrap:pretty">
                                \${f.value}</div>
                            </div>
                          \`).join('') }
                        </div>
                      </div>
                    </div>
                  \` : '' }

                  \${ sellerView.isProps ? \`
                    <div
                      style="border-radius:22px;background:#fff;box-shadow:inset 0 0 0 1.5px #ddd0f5;overflow:hidden">
                      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:#f2edff">
                        <span
                          style="width:40px;height:40px;border-radius:12px;background:#4a2c99;color:#fff;display:grid;place-items:center;flex:none"><i
                            class="ph-fill ph-buildings" style="font-size:20px"></i></span>
                        <div style="flex:1;min-width:150px">
                          <div style="font-size:19px;font-weight:800;color:#241f1c">His properties with you</div>
                          <div style="font-size:15px;font-weight:700;color:#6b52a8;margin-top:1px">\${sellerView.countLine}</div>
                        </div>
                      </div>
                      <div style="display:flex;flex-direction:column;gap:18px;padding:16px 20px 20px">
                        \${ (sellerView.propGroups || []).map(g => \`
                          <div style="\${g.wrap}">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                              <span style="\${g.badge}"><i class="\${g.icon}" style="font-size:17px"></i>\${g.title}</span>
                              <span style="\${g.metaStyle}">\${g.meta}</span>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:11px">
                              \${ (g.items || []).map(p => \`
                                <button onClick="\${__b(p.go)}" style="\${p.rowStyle}"
                                  style-hover="box-shadow:inset 0 0 0 2px #d9b98a">
                                  <span style="\${p.photoStyle}"></span>
                                  <span style="flex:1;min-width:0">
                                    <span style="display:block;font-size:19px;font-weight:800;color:#241f1c">\${p.title}</span>
                                    <span style="display:block;font-size:16px;color:#6b6156;margin-top:1px">\${p.loc}</span>
                                    <span style="display:inline-flex;margin-top:7px;\${p.stStyle}">\${p.stLabel}</span>
                                  </span>
                                  <span style="text-align:right;flex:none">
                                    <span
                                      style="display:block;font-family:'Newsreader',serif;font-weight:600;font-size:24px;\${p.priceCol}">\${p.priceFmt}</span>
                                    <span
                                      style="display:block;font-size:14.5px;font-weight:800;color:#4a2c99;margin-top:2px">Seller
                                      wants \${p.askFmt}</span>
                                  </span>
                                </button>
                              \`).join('') }
                            </div>
                          </div>
                        \`).join('') }
                      </div>
                    </div>
                  \` : '' }
                </div>
              </div>
            </div>
          \` : '' }

          \${ addPlotOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:84;display:flex;justify-content:center;align-items:center;padding:16px;overflow:hidden">
              <div onClick="\${__b(closeAddPlot)}"
                style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:100%;max-width:1180px;height:90vh;max-height:860px;display:flex;flex-direction:column;border-radius:28px;background:#faf2e2;box-shadow:0 0 0 1px rgba(120,90,30,.2),0 50px 100px -30px rgba(40,26,2,.85);overflow:hidden;">
                <div
                  style="flex:none;display:flex;align-items:center;gap:14px;padding:12px 18px;background:#f4e7cd;background-image:linear-gradient(120deg,#fbf0da,#e9d7b2)">
                  <span
                    style="width:40px;height:40px;border-radius:12px;background:#241d0c;color:#f8c200;display:grid;place-items:center;flex:none"><i
                      class="ph-fill ph-house-line" style="font-size:21px"></i></span>
                  <div style="flex:none;min-width:0;max-width:250px">
                    <div
                      style="font-size:20px;font-weight:800;color:#241d0c;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      \${pTitle}</div>
                    <div
                      style="font-size:14.5px;color:#8a6a14;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      \${pSub}</div>
                  </div>
                  <div style="flex:1;display:flex;gap:7px;min-width:0;margin-left:8px;overflow:hidden">
                    \${ (pSteps || []).map(st => \`
                      <button onClick="\${__b(st.go)}" style="\${st.style}">
                        <span style="\${st.numStyle}">\${ st.isDone ? \`<i class="ph-bold ph-check"
                              style="font-size:12px"></i>\` : '' }\${ st.notDone ? \`\${st.n}\` : '' }</span>
                        <span
                          style="display:flex;align-items:center;gap:7px;font-size:15.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><i
                            class="\${st.icon}" style="font-size:17px;flex:none"></i>\${st.label}</span>
                      </button>
                    \`).join('') }
                  </div>
                  <button onClick="\${__b(closeAddPlot)}" title="Save and close"
                    style="width:44px;height:44px;border-radius:13px;background:#fffdf7;color:#6b6156;display:grid;place-items:center;flex:none"
                    style-hover="background:#fff"><i class="ph-bold ph-x" style="font-size:19px"></i></button>
                </div>

                <div data-scroll=""
                  style="flex:1;min-height:0;\${ pS4 ? 'display:flex;flex-direction:column;overflow:hidden;padding:0' : 'overflow-y:auto;overflow-x:hidden;padding:22px 26px 26px' }">

                  \${ pS1 ? \`
                    <div style="max-width:1060px;margin:0 auto">

                      <div
                        style="border-radius:26px;background:#e6f3fa;box-shadow:inset 0 0 0 2px #bcdcec;padding:24px 26px">
                        <div style="display:flex;align-items:center;gap:14px">
                          <span
                            style="width:46px;height:46px;border-radius:15px;flex:none;display:grid;place-items:center;background:#0f5f7a;color:#eaf7fb;font-size:20px;font-weight:800">1</span>
                          <div>
                            <div style="font-size:23px;font-weight:800;color:#0b3f52">Where is it?</div>
                            <div style="font-size:16px;font-weight:600;color:#4d7d90">City first, then the sector — this
                              is how you will find it later.</div>
                          </div>
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">
                          \${ (pCityChips || []).map(c => \`<button onClick="\${__b(c.go)}"
                              style="\${c.style}">\${c.label}</button>\`).join('') }
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px">
                          <label style="display:block"><span style="\${pLab}">Sector or locality</span><input
                              name="area" value="\${pform.area}" onInput="\${__b(onPForm)}" placeholder="Sector 79"
                              style="\${pInput}"></label>
                          <label style="display:block"><span style="\${pLab}">Society or project <span
                                style="font-weight:600;color:#8fb4c4">— if any</span></span><input name="society"
                              value="\${pform.society}" onInput="\${__b(onPForm)}" placeholder="Omaxe, Eco City…"
                              style="\${pInput}"></label>
                        </div>
                        <label style="display:block;margin-top:14px"><span style="\${pLab}">Address or landmark <span
                              style="font-weight:600;color:#8fb4c4">— helps you find it later</span></span><input
                            name="address" value="\${pform.address}" onInput="\${__b(onPForm)}"
                            placeholder="Near the water tank, behind the school…" style="\${pInput}"></label>
                      </div>

                      <div
                        style="border-radius:26px;background:#f1eafe;box-shadow:inset 0 0 0 2px #d6c6f2;padding:24px 26px;margin-top:16px">
                        <div style="display:flex;align-items:center;gap:14px">
                          <span
                            style="width:46px;height:46px;border-radius:15px;flex:none;display:grid;place-items:center;background:#4a2c99;color:#efe8fb;font-size:20px;font-weight:800">2</span>
                          <div>
                            <div style="font-size:23px;font-weight:800;color:#33206b">What kind of property?</div>
                            <div style="font-size:16px;font-weight:600;color:#6b5b8a">Tap one — the questions below
                              change to match it.</div>
                          </div>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:18px">
                          \${ (pTypeTiles || []).map(t => \`
                            <button onClick="\${__b(t.go)}" style="\${t.style}"><span style="\${t.iconStyle}"><i
                                  class="\${t.icon}"></i></span><span
                                style="font-size:16px;font-weight:800;line-height:1.25">\${t.label}</span></button>
                          \`).join('') }
                        </div>
                      </div>

                      <div
                        style="border-radius:26px;background:#fff4e0;box-shadow:inset 0 0 0 2px #f0d9ae;padding:24px 26px;margin-top:16px">
                        <div style="display:flex;align-items:center;gap:14px">
                          <span
                            style="width:46px;height:46px;border-radius:15px;flex:none;display:grid;place-items:center;background:#a3541b;color:#fff3e2;font-size:20px;font-weight:800">3</span>
                          <div>
                            <div style="font-size:23px;font-weight:800;color:#6e3a10">The details of this \${pKindWord}</div>
                            <div style="font-size:16px;font-weight:600;color:#a3764a">Only what a buyer would ask you on
                              the phone.</div>
                          </div>
                        </div>

                        <div
                          style="display:grid;grid-template-columns:1fr 2fr;gap:14px;margin-top:18px;align-items:end">
                          <label style="display:block"><span style="\${pLab}">Size</span><input name="size"
                              value="\${pform.size}" onInput="\${__b(onPForm)}" placeholder="250"
                              style="\${pInput}"></label>
                          <div><span style="\${pLab}">Measured in</span>
                            <div style="display:flex;flex-wrap:wrap;gap:9px">\${ (pSizeUnits || []).map(u => \`<button onClick="\${__b(u.go)}" style="\${u.style}">\${u.label}</button>\`).join('') }</div>
                          </div>
                        </div>

                        <div
                          style="display:flex;align-items:center;gap:10px;margin-top:20px;padding:11px 15px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1.5px #d7e6f6">
                          <i class="\${pKindIcon}" style="font-size:20px;color:#1a5aa8;flex:none"></i>
                          <div
                            style="flex:1;min-width:0;font-size:15.5px;font-weight:800;color:#1a5aa8;text-wrap:pretty">
                            \${pKindHint}</div>
                        </div>

                        <div
                          style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:16px">
                          \${ (pFields || []).map(f => \`
                            <div style="\${f.wrap}">
                              <div style="\${pLab}">\${f.label}</div>
                              \${ f.isChips ? \`
                                <div style="\${f.optsWrap}">
                                  \${ (f.opts || []).map(o => \`<button
                                      onClick="\${__b(o.go)}" style="\${o.style}">\${o.label}</button>\`).join('') }
                                </div>
                              \` : '' }
                              \${ f.isText ? \`
                                <input value="\${f.val}" onInput="\${__b(f.on)}" placeholder="\${f.ph}"
                                  style="\${pInput}">
                              \` : '' }
                            </div>
                          \`).join('') }
                        </div>

                        \${ pMoreOpen ? \`
                          <div
                            style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:14px;padding:18px;border-radius:20px;background:#f6faff;box-shadow:inset 0 0 0 1.5px #d7e6f6">
                            \${ (pMoreFields || []).map(f => \`
                              <div style="\${f.wrap}">
                                <div style="\${pLab}">\${f.label}</div>
                                \${ f.isChips ? \`
                                  <div style="\${f.optsWrap}">
                                    \${ (f.opts || []).map(o => \`<button
                                        onClick="\${__b(o.go)}" style="\${o.style}">\${o.label}</button>\`).join('') }
                                  </div>
                                \` : '' }
                                \${ f.isText ? \`
                                  <input value="\${f.val}" onInput="\${__b(f.on)}" placeholder="\${f.ph}"
                                    style="\${pInput}">
                                \` : '' }
                              </div>
                            \`).join('') }
                          </div>
                        \` : '' }
                      </div>

                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
                        <div
                          style="border-radius:26px;background:#e4f6ea;box-shadow:inset 0 0 0 2px #b5ddc5;padding:24px 26px">
                          <div style="display:flex;align-items:center;gap:14px">
                            <span
                              style="width:46px;height:46px;border-radius:15px;flex:none;display:grid;place-items:center;background:#0f7a45;color:#eafff2;font-size:20px;font-weight:800">4</span>
                            <div>
                              <div style="font-size:23px;font-weight:800;color:#0a4a2b">Rate per \${pRateUnit}</div>
                              <div style="font-size:16px;font-weight:600;color:#4d8a68">Worked out for you — type either
                                one.</div>
                            </div>
                          </div>
                          <div style="display:flex;align-items:flex-end;gap:14px;margin-top:18px;flex-wrap:wrap">
                            <label style="display:block;flex:1;min-width:170px"><span style="\${pLab}">Rate per \${pRateUnit} (₹)</span><input name="rate" value="\${pform.rate}"
                                onInput="\${__b(onPRate)}" placeholder="66000" style="\${pInput}"></label>
                            <div
                              style="font-family:'Newsreader',serif;font-weight:600;font-size:30px;color:#0a4a2b;padding-bottom:8px;white-space:nowrap">
                              \${pRateEcho}</div>
                          </div>
                          <div
                            style="display:flex;align-items:center;gap:9px;margin-top:12px;padding:12px 14px;border-radius:14px;background:#fff;flex-wrap:wrap">
                            <i class="ph-fill ph-calculator" style="font-size:19px;color:#0f7a45"></i>
                            <span style="font-size:15.5px;font-weight:700;color:#0a4a2b;flex:1;min-width:160px">\${pRateLine}</span>
                          </div>
                        </div>
                        <div
                          style="border-radius:26px;background:#fff0d0;box-shadow:inset 0 0 0 2px #edd39a;padding:24px 26px">
                          <div style="display:flex;align-items:center;gap:14px">
                            <span
                              style="width:46px;height:46px;border-radius:15px;flex:none;display:grid;place-items:center;background:#8a5a12;color:#fff6e2;font-size:20px;font-weight:800">5</span>
                            <div>
                              <div style="font-size:23px;font-weight:800;color:#6e4408">Your asking price</div>
                              <div style="font-size:16px;font-weight:600;color:#a3764a">This is what customers see.
                              </div>
                            </div>
                          </div>
                          <div style="display:flex;align-items:flex-end;gap:14px;margin-top:18px;flex-wrap:wrap">
                            <label style="display:block;flex:1;min-width:180px"><span style="\${pLab}">Price in
                                crore</span><input name="price" value="\${pform.price}" onInput="\${__b(onPForm)}"
                                placeholder="1.65" style="\${pInput}"></label>
                            <div
                              style="font-family:'Newsreader',serif;font-weight:600;font-size:34px;color:#8a5a12;padding-bottom:8px;white-space:nowrap">
                              \${pPriceEcho}</div>
                          </div>
                          <div style="font-size:15.5px;font-weight:700;color:#a3764a;margin-top:10px;line-height:1.45">
                            What the seller wants goes on the next step and stays private.</div>
                        </div>
                      </div>




                    </div>
                  \` : '' }


                  \${ pS2 ? \`
                    <div>
                      <div
                        style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:16px;background:#efe8fb;box-shadow:inset 0 0 0 2px #d6c6f2">
                        <i class="ph-fill ph-lock-key" style="font-size:24px;color:#4a2c99"></i>
                        <div style="font-size:17px;font-weight:800;color:#3a1f7a">Private — only you see this. Never
                          goes to customers, links, Earth or marketing.</div>
                      </div>

                      \${ sellerPick ? \`
                        <div>
                          <div style="display:flex;align-items:center;gap:12px;margin-top:20px;flex-wrap:wrap">

                            <label
                              style="flex:1;min-width:240px;display:flex;align-items:center;gap:12px;height:58px;padding:0 18px;border-radius:15px;background:#fff;box-shadow:inset 0 0 0 2px #d6c6f2">
                              <i class="ph-bold ph-magnifying-glass" style="font-size:21px;color:#5b32c4"></i>
                              <input value="\${sellerQ}" onInput="\${__b(onSellerQ)}"
                                placeholder="Search a saved seller by name or phone…"
                                style="border:none;outline:none;background:none;width:100%;font-size:17px;font-weight:600;color:#241f1c">
                            </label>
                            <button onClick="\${__b(openSellerAdd)}"
                              style="display:flex;align-items:center;gap:9px;height:58px;padding:0 20px;border-radius:15px;background:#4a2c99;color:#efe8fb;font-size:17px;font-weight:800;flex:none"><i
                                class="ph-bold ph-plus" style="font-size:19px"></i>Add new seller</button>
                          </div>
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px">
                            \${ (pSellerList || []).map(sl => \`
                              <button onClick="\${__b(sl.go)}" style="\${sl.style}">
                                <span style="\${sl.avStyle}">\${sl.initials}</span>
                                <span style="flex:1;min-width:0">
                                  <span style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span
                                      style="font-size:19px;font-weight:800">\${sl.name}</span><span
                                      style="\${sl.kindStyle}">\${sl.kind}</span></span>
                                  <span style="display:block;\${sl.subStyle};margin-top:2px">\${sl.phone} · \${sl.city} · \${sl.propLine}</span>
                                </span>
                                \${ sl.on ? \`<i class="ph-fill ph-check-circle"
                                    style="font-size:26px;flex:none"></i>\` : '' }
                              </button>
                            \`).join('') }
                          </div>
                        </div>
                      \` : '' }

                      \${ sellerAdd ? \`
                        <div
                          style="margin-top:18px;padding:22px 24px;border-radius:22px;background:#f3eeff;box-shadow:inset 0 0 0 2px #d6c6f2">
                          <div style="display:flex;align-items:center;gap:12px">
                            <div style="flex:1;font-size:21px;font-weight:800;color:#3a1f7a">New seller</div>
                            <button onClick="\${__b(closeSellerAdd)}"
                              style="height:48px;padding:0 18px;border-radius:13px;background:#fff;color:#6b52a8;font-size:16px;font-weight:800;box-shadow:inset 0 0 0 1.5px #d6c6f2">Back
                              to the list</button>
                          </div>
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">
                            <label style="display:block"><span
                                style="display:block;font-size:16px;font-weight:800;color:#5c4a2a;margin-bottom:8px">Seller
                                name</span><input name="name" value="\${nsform.name}" onInput="\${__b(onNS)}"
                                placeholder="Balwinder Singh" style="\${pInput}"></label>
                            <label style="display:block"><span
                                style="display:block;font-size:16px;font-weight:800;color:#5c4a2a;margin-bottom:8px">Phone
                                number</span><input name="phone" value="\${nsform.phone}" onInput="\${__b(onNS)}"
                                placeholder="98146 22107" style="\${pInput}"></label>
                            <label style="display:block"><span
                                style="display:block;font-size:16px;font-weight:800;color:#5c4a2a;margin-bottom:8px">Another
                                number <span style="font-weight:600;color:#a5946f">— if any</span></span><input
                                name="phone2" value="\${nsform.phone2}" onInput="\${__b(onNS)}" placeholder="Optional"
                                style="\${pInput}"></label>
                            <label style="display:block"><span
                                style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">City
                                <span style="font-weight:600;color:#8f7ec0">— optional</span></span><input name="city"
                                value="\${nsform.city}" onInput="\${__b(onNS)}" placeholder="Mohali"
                                style="\${pInput}"></label>
                            <label style="display:block;grid-column:1 / -1"><span
                                style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">Business
                                name <span style="font-weight:600;color:#8f7ec0">— if they sell under a
                                  firm</span></span><input name="business" value="\${nsform.business}"
                                onInput="\${__b(onNS)}" placeholder="Gurpreet Realtors" style="\${pInput}"></label>
                          </div>
                          <div style="font-size:16px;font-weight:800;color:#5c4a2a;margin:18px 0 8px">What kind of
                            seller</div>
                          <div style="display:flex;flex-wrap:wrap;gap:9px">\${ (pKinds || []).map(k => \`<button onClick="\${__b(k.go)}" style="\${k.style}">\${k.label}</button>\`).join('') }</div>
                          <label style="display:block;margin-top:16px"><span
                              style="display:block;font-size:16px;font-weight:800;color:#5c4a2a;margin-bottom:8px">Note
                              about this seller <span style="font-weight:600;color:#a5946f">—
                                optional</span></span><input name="note" value="\${nsform.note}" onInput="\${__b(onNS)}"
                              placeholder="Prefers calls after 6 pm" style="\${pInput}"></label>
                          <button onClick="\${__b(saveSeller)}" style="\${saveSellerStyle}"
                            style-active="transform:translateY(2px)"><i class="ph-fill ph-check-circle"
                              style="font-size:21px"></i>Save seller and use it here</button>
                          <div style="font-size:15.5px;font-weight:600;color:#8a6a44;margin-top:10px">Saved sellers can
                            be picked again for any other property.</div>
                        </div>
                      \` : '' }

                      \${ pSellerPicked ? \`
                        <div
                          style="margin-top:20px;padding:22px 24px;border-radius:22px;background:#f3eeff;box-shadow:inset 0 0 0 2px #d6c6f2">
                          <div style="display:flex;align-items:center;gap:13px;flex-wrap:wrap">
                            <span
                              style="width:52px;height:52px;border-radius:50%;background:#4a2c99;color:#fff;display:grid;place-items:center;font-size:18px;font-weight:800;flex:none">\${pSellerInitials}</span>
                            <div style="flex:1;min-width:0">
                              <div style="font-size:21px;font-weight:800;color:#3a1f7a">\${pSellerName}</div>
                              <div style="font-size:16.5px;color:#6b52a8">\${pSellerPhone} · \${pSellerKind}</div>
                              \${ pSellerHasBusiness ? \`
                                <div style="font-size:16px;font-weight:700;color:#5b32c4">\${pSellerBusiness}</div>
                              \` : '' }
                            </div>
                            <div
                              style="font-size:14px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#5b32c4">
                              Details for this property only</div>
                          </div>

                          <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;margin-top:18px">
                            <label style="display:block"><span
                                style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">Seller
                                asking price (crore)</span><input name="askPrice" value="\${pform.askPrice}"
                                onInput="\${__b(onPForm)}" placeholder="1.42" style="\${pInput}"></label>
                            <div><span
                                style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">Relationship
                                to the property</span>
                              <div style="display:flex;flex-wrap:wrap;gap:9px">\${ (pRel || []).map(r => \`<button onClick="\${__b(r.go)}" style="\${r.style}">\${r.label}</button>\`).join('') }</div>
                            </div>
                          </div>

                          <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;margin-top:18px">
                            <div><span
                                style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">Still
                                available?</span>
                              <div style="display:flex;gap:10px"><button onClick="\${__b(pAvailYes)}"
                                  style="\${pAvailYesStyle}">Confirmed</button><button onClick="\${__b(pAvailNo)}"
                                  style="\${pAvailNoStyle}">Not sure</button></div>
                            </div>
                            <div><span
                                style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">Last
                                confirmed with the seller</span>
                              <div style="display:flex;flex-wrap:wrap;gap:9px">\${ (pConfirmWhen || []).map(r => \`<button onClick="\${__b(r.go)}" style="\${r.style}">\${r.label}</button>\`).join('') }</div>
                            </div>
                          </div>

                          <label style="display:block;margin-top:18px"><span
                              style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">How
                              to arrange a site visit</span><input name="visitNote" value="\${pform.visitNote}"
                              onInput="\${__b(onPForm)}" placeholder="Call before coming, the gate stays locked"
                              style="\${pInput}"></label>
                          <label style="display:block;margin-top:14px"><span
                              style="display:block;font-size:16px;font-weight:800;color:#3a1f7a;margin-bottom:8px">Note
                              about this property</span><textarea name="sellerPropNote"
                              value="\${pform.sellerPropNote}" onInput="\${__b(onPForm)}"
                              placeholder="Owner in a hurry, will come down 5 lakh…"
                              style="\${pArea}"></textarea></label>

                          <div style="font-size:16px;font-weight:800;color:#3a1f7a;margin:18px 0 8px">Papers the seller
                            has</div>
                          <div style="display:flex;flex-wrap:wrap;gap:10px">\${ (pSellerDocs || []).map(d => \`<button onClick="\${__b(d.go)}" style="\${d.style}"><i
                                  class="\${d.icon}" style="font-size:19px"></i>\${d.label}</button>\`).join('') }</div>
                        </div>
                      \` : '' }
                    </div>
                  \` : '' }

                  \${ pS3 ? \`
                    <div>
                      <div
                        style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
                        <div
                          style="font-size:14px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a3541b">
                          Photos — the first one is what buyers see</div>
                        <div style="font-size:16.5px;font-weight:800;color:#0a6634">\${pPhotoCount}</div>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-top:14px">
                        \${ (pPhotoSlots || []).map(ph => \`
                          <div style="\${ph.style}">
                            \${ ph.isCover ? \`
                              <span
                                style="position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#e8681c;color:#fff;font-size:13.5px;font-weight:800"><i
                                  class="ph-fill ph-star" style="font-size:14px"></i>Cover</span>
                            \` : '' }
                            \${ ph.notCover ? \`
                              <button onClick="\${__b(ph.setCover)}"
                                style="position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:rgba(255,253,247,.94);color:#a3541b;font-size:13.5px;font-weight:800"><i
                                  class="ph ph-star" style="font-size:14px"></i>Make cover</button>
                            \` : '' }
                            <div style="position:absolute;right:10px;bottom:10px;display:flex;gap:6px">
                              <button onClick="\${__b(ph.left)}" title="Move left"
                                style="width:36px;height:36px;border-radius:11px;background:rgba(255,253,247,.94);color:#4c463d;display:grid;place-items:center"><i
                                  class="ph-bold ph-arrow-left" style="font-size:15px"></i></button>
                              <button onClick="\${__b(ph.right)}" title="Move right"
                                style="width:36px;height:36px;border-radius:11px;background:rgba(255,253,247,.94);color:#4c463d;display:grid;place-items:center"><i
                                  class="ph-bold ph-arrow-right" style="font-size:15px"></i></button>
                              <button onClick="\${__b(ph.remove)}" title="Remove"
                                style="width:36px;height:36px;border-radius:11px;background:#c2185b;color:#fff;display:grid;place-items:center"><i
                                  class="ph-bold ph-trash" style="font-size:15px"></i></button>
                            </div>
                          </div>
                        \`).join('') }
                        <button onClick="\${__b(pAddPhoto)}"
                          style="height:150px;border-radius:16px;background:#fff7e8;box-shadow:inset 0 0 0 2px #e6d6b4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#a3541b"
                          style-hover="background:#fff3d1"><i class="ph-bold ph-plus" style="font-size:32px"></i><span
                            style="font-size:16.5px;font-weight:800">Add photo</span></button>
                      </div>

                      <div
                        style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:26px">
                        <div
                          style="font-size:14px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#4a2c99">
                          Video walkthrough</div>
                        <div style="font-size:16.5px;font-weight:800;color:#4a2c99">\${pVideoCount}</div>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-top:14px">
                        \${ (pVideos || []).map(v => \`
                          <div style="\${v.style}">
                            <span
                              style="position:absolute;inset:0;background:rgba(20,10,40,.42);display:grid;place-items:center;color:#fff"><i
                                class="ph-fill ph-play-circle" style="font-size:46px"></i></span>
                            <span
                              style="position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#4a2c99;color:#efe8fb;font-size:13.5px;font-weight:800"><i
                                class="ph-fill ph-video-camera" style="font-size:14px"></i>\${v.label}</span>
                            <button onClick="\${__b(v.remove)}" title="Remove"
                              style="position:absolute;right:10px;bottom:10px;width:36px;height:36px;border-radius:11px;background:#c2185b;color:#fff;display:grid;place-items:center"><i
                                class="ph-bold ph-trash" style="font-size:15px"></i></button>
                          </div>
                        \`).join('') }
                        <button onClick="\${__b(pAddVideo)}"
                          style="height:150px;border-radius:16px;background:#f3eeff;box-shadow:inset 0 0 0 2px #d6c6f2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#4a2c99"
                          style-hover="background:#eae0ff"><i class="ph-bold ph-plus" style="font-size:32px"></i><span
                            style="font-size:16.5px;font-weight:800">Add video</span></button>
                      </div>

                      <div
                        style="margin-top:26px;padding:22px 24px;border-radius:22px;background:#efe8fb;box-shadow:inset 0 0 0 2px #d6c6f2">
                        <div style="display:flex;align-items:center;gap:13px;flex-wrap:wrap">
                          <span
                            style="width:48px;height:48px;border-radius:15px;background:#4a2c99;color:#fff;display:grid;place-items:center;flex:none"><i
                              class="ph-fill ph-folder-open" style="font-size:24px"></i></span>
                          <div style="flex:1;min-width:0">
                            <div style="font-size:21px;font-weight:800;color:#3a1f7a">Property documents</div>
                            <div style="font-size:16px;color:#6b52a8">Tap a paper, then add its photos. More than one
                              photo per paper is fine.</div>
                          </div>
                          <span
                            style="display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 15px;border-radius:999px;background:#fff;color:#4a2c99;font-size:14.5px;font-weight:800"><i
                              class="ph-fill ph-lock-key" style="font-size:16px"></i>Private</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:16px">
                          \${ (pQuickDocs || []).map(d => \`
                            <button onClick="\${__b(d.go)}" style="\${d.style}">
                              <span style="\${d.iconStyle}"><i class="\${d.icon}"></i></span>
                              <span style="flex:1;min-width:0;font-size:16.5px;font-weight:800">\${d.label}</span>
                              \${ d.hasCount ? \`<span
                                  style="font-size:14px;font-weight:800;background:rgba(0,0,0,.18);border-radius:999px;padding:3px 10px">\${d.count}</span>\` : '' }
                            </button>
                          \`).join('') }
                          <button onClick="\${__b(openDocPick)}"
                            style="display:flex;align-items:center;gap:11px;height:66px;padding:0 18px;border-radius:16px;background:#fff;color:#3a1f7a;box-shadow:inset 0 0 0 2px #d6c6f2;text-align:left">
                            <span
                              style="width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:21px;background:#efe8fb;color:#4a2c99"><i
                                class="ph-fill ph-dots-three-circle"></i></span>
                            <span style="flex:1;font-size:16.5px;font-weight:800">Other</span>
                          </button>
                          <button onClick="\${__b(openDocNew)}"
                            style="display:flex;align-items:center;gap:11px;height:66px;padding:0 18px;border-radius:16px;background:#241d0c;color:#f8c200;text-align:left">
                            <span
                              style="width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:21px;background:rgba(255,255,255,.14);color:#f8c200"><i
                                class="ph-bold ph-plus"></i></span>
                            <span style="flex:1;font-size:16.5px;font-weight:800">New</span>
                          </button>
                        </div>

                        \${ pHasDocs ? \`
                          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px">
                            \${ (pDocs || []).map(d => \`
                              <div
                                style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 0 0 1.5px #d6c6f2">
                                <button onClick="\${__b(d.open)}" style="display:block;width:100%;padding:0"><span
                                    style="display:block;\${d.thumbStyle}"></span></button>
                                <div style="padding:11px 13px 13px">
                                  <div style="font-size:16px;font-weight:800;color:#241f1c">\${d.name}</div>
                                  <div style="display:flex;align-items:center;gap:8px;margin-top:7px">
                                    <span style="flex:1;font-size:13.5px;font-weight:800;color:#5b32c4">\${d.photoLine}</span>
                                    <button onClick="\${__b(d.open)}"
                                      style="height:34px;padding:0 12px;border-radius:10px;background:#efe8fb;color:#4a2c99;font-size:13.5px;font-weight:800">Open</button>
                                    <button onClick="\${__b(d.remove)}"
                                      style="width:34px;height:34px;border-radius:10px;background:#f4ecdd;color:#8a7a52;display:grid;place-items:center"><i
                                        class="ph-bold ph-trash" style="font-size:15px"></i></button>
                                  </div>
                                </div>
                              </div>
                            \`).join('') }
                          </div>
                        \` : '' }
                        \${ pNoDocs ? \`
                          <div
                            style="margin-top:14px;padding:16px 18px;border-radius:15px;background:#fff;font-size:16.5px;font-weight:600;color:#6b52a8">
                            No documents added yet.</div>
                        \` : '' }
                      </div>
                    </div>
                  \` : '' }

                  \${ pS4 ? \`
                    <div
                      style="flex:1;min-height:0;width:100%;height:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;background:#0f2417">
                      <div id="dealer-earth-map"
                        style="position:absolute;inset:0;width:100%;height:100%;background:#0f2417;z-index:1"></div>
                      <div
                        style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:2">

                        <!-- Top Floating Controls -->
                        <div
                          style="position:absolute;top:0;left:0;right:0;z-index:4;display:flex;gap:10px;align-items:center;padding:14px 16px;pointer-events:none">
                          <input id="dealer-earth-search" name="earthQ" value="\${pform.earthQ}" onInput="\${__b(onPForm)}"
                            placeholder="Search spot — Sector 79, Mohali"
                            style="max-width:320px;height:38px;padding:0 14px;border-radius:10px;border:none;background:rgba(255,253,247,.96);font-size:14px;font-weight:700;color:#241f1c;outline:none;box-shadow:0 4px 14px rgba(0,0,0,.3);pointer-events:auto">
                          
                          <span
                            style="display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;background:rgba(15,36,23,.82);color:#cfe9d8;font-size:13.5px;font-weight:800;backdrop-filter:blur(8px);pointer-events:none"><i
                              class="ph-fill ph-hand-tap" style="font-size:15px"></i>Tap anywhere to place pin</span>

                          <div style="flex:1"></div>

                          <!-- Zoom Controls -->
                          <div style="display:flex;gap:5px;pointer-events:auto">
                            <button onClick="\${__b(pMapZoomIn)}" title="Zoom In"
                              style="width:36px;height:36px;border-radius:10px;background:rgba(15,36,23,.85);color:#fff;font-size:18px;font-weight:800;display:grid;place-items:center;border:none;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 3px 10px rgba(0,0,0,.3)"><i class="ph-bold ph-plus"></i></button>
                            <button onClick="\${__b(pMapZoomOut)}" title="Zoom Out"
                              style="width:36px;height:36px;border-radius:10px;background:rgba(15,36,23,.85);color:#fff;font-size:18px;font-weight:800;display:grid;place-items:center;border:none;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 3px 10px rgba(0,0,0,.3)"><i class="ph-bold ph-minus"></i></button>
                          </div>
                        </div>

                        <!-- Bottom Floating Controls Overlay -->
                        <div
                          style="position:absolute;bottom:0;left:0;right:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(0deg,rgba(10,24,16,.75),transparent);pointer-events:none">
                          <button onClick="\${__b(pBack)}"
                            style="height:42px;padding:0 20px;border-radius:12px;background:rgba(255,253,247,.95);color:#241f1c;font-size:15px;font-weight:800;border:none;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;pointer-events:auto;backdrop-filter:blur(8px)">Back</button>

                          <div style="display:flex;align-items:center;gap:10px;pointer-events:auto">
                            \${ pEarthOff ? \`<button
                                onClick="\${__b(pEarthConfirm)}"
                                style="height:42px;padding:0 18px;border-radius:12px;background:#f8a800;color:#241d0c;font-size:14.5px;font-weight:800;border:none;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;display:inline-flex;align-items:center;gap:6px"><i
                                  class="ph-fill ph-check-circle" style="font-size:18px"></i>Confirm this spot</button>\` : '' }
                            \${ pEarthOn ? \`<span
                                style="display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 16px;border-radius:12px;background:rgba(10,102,52,.92);color:#eafff2;font-size:14px;font-weight:800;backdrop-filter:blur(8px)"><i
                                  class="ph-fill ph-check-circle" style="font-size:17px"></i>Confirmed</span>\` : '' }
                            \${ pEarthOn ? \`<button onClick="\${__b(pEarthRedo)}"
                                style="height:42px;padding:0 14px;border-radius:12px;background:rgba(255,253,247,.9);color:#4c463d;font-size:14px;font-weight:800;border:none;cursor:pointer">Move pin</button>\` : '' }
                            <button onClick="\${__b(pSave)}"
                              style="height:42px;padding:0 22px;border-radius:12px;background:#148347;color:#fff;font-size:15px;font-weight:800;border:none;box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer;display:inline-flex;align-items:center;gap:8px"><i
                                class="ph-fill ph-check-circle" style="font-size:19px"></i>Save this property</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  \` : '' }

                </div>

                \${ pNotS4 ? \`
                  <div
                    style="flex:none;display:flex;align-items:center;gap:10px;padding:11px 18px;background:#f4e7cd;background-image:linear-gradient(120deg,#f7eeda,#e9d7b2)">
                    \${ pNotS1 ? \`<button onClick="\${__b(pBack)}"
                        style="height:54px;padding:0 20px;border-radius:15px;background:#fffdf7;color:#4c463d;font-size:17px;font-weight:800">Back</button>\` : '' }
                    <div style="flex:1"></div>
                    <button onClick="\${__b(pNext)}"
                      style="\${pNextStyle}">\${pNextLabel}<i class="ph-bold ph-arrow-right"
                        style="font-size:19px"></i></button>
                  </div>
                \` : '' }
              </div>
            </div>
          \` : '' }

          \${ linkBuildOpen ? \`
            <div
              style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto">
              <div onClick="\${__b(closeLinkBuild)}"
                style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:100%;max-width:1160px;min-height:88vh;display:flex;flex-direction:column;border-radius:30px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 50px 100px -30px rgba(40,26,2,.85);overflow:hidden;">

                \${ linkBuildNew ? \`
                  <div style="flex:1;display:flex;flex-direction:column;min-height:0">
                    <div style="display:flex;align-items:center;gap:13px;padding:14px 20px;background:#dcf3e5">
                      <span
                        style="width:42px;height:42px;border-radius:13px;background:#0e4d2f;color:#eafff2;display:grid;place-items:center;flex:none"><i
                          class="ph-fill ph-paper-plane-tilt" style="font-size:21px"></i></span>
                      <div style="flex:none;min-width:0;max-width:250px">
                        <div
                          style="font-size:21px;font-weight:800;color:#241d0c;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                          Send a private link</div>
                        <div style="font-size:15px;color:#12704a;font-weight:700">\${lStepHint}</div>
                      </div>
                      <label
                        style="flex:1;min-width:0;display:flex;align-items:center;gap:13px;height:58px;padding:0 20px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px #bfe0cd">
                        <i class="ph-bold ph-magnifying-glass" style="font-size:22px;color:#12704a;flex:none"></i>
                        <input value="\${lHeadQ}" onInput="\${__b(onLHeadQ)}" placeholder="\${lHeadPh}"
                          style="border:none;outline:none;background:none;width:100%;font-size:18px;font-weight:600;color:#241f1c">
                      </label>
                      <button onClick="\${__b(closeLinkBuild)}" title="Close"
                        style="width:42px;height:42px;border-radius:13px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"
                        style-hover="background:#d9ebe0"><i class="ph-bold ph-x" style="font-size:18px"></i></button>
                    </div>

                    <div data-scroll="" style="flex:1;min-height:0;padding:22px 28px;overflow-y:auto;overflow-x:hidden">

                      \${ lS1 ? \`
                        <div>
                          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                            <div
                              style="flex:1;min-width:200px;font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#12704a">
                              Pick the properties they should see</div>
                            <span
                              style="display:inline-flex;align-items:center;height:44px;padding:0 16px;border-radius:999px;background:#dcf3e5;color:#12704a;font-size:15.5px;font-weight:800;flex:none">\${lPickText}</span>
                          </div>

                          <!-- Property Type & City Filters on Top -->
                          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;align-items:center;gap:7px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none">
                              <span style="font-size:13px;font-weight:800;color:#12704a;text-transform:uppercase;letter-spacing:.05em;margin-right:2px;flex:none">Type:</span>
                              \${ (sendLinkTypeChips || []).map(tc => \`
                                <button onClick="\${__b(tc.go)}" style="\${tc.style}">\${tc.label}</button>
                              \`).join('') }
                            </div>
                            <div style="display:flex;align-items:center;gap:7px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none">
                              <span style="font-size:13px;font-weight:800;color:#8a6a1e;text-transform:uppercase;letter-spacing:.05em;margin-right:2px;flex:none">City:</span>
                              \${ (sendLinkCityChips || []).map(cc => \`
                                <button onClick="\${__b(cc.go)}" style="\${cc.style}">\${cc.label}</button>
                              \`).join('') }
                            </div>
                          </div>

                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px">
                            \${ (lPropRows || []).map(p => \`
                              <button onClick="\${__b(p.go)}" style="\${p.style}">
                                <span style="\${p.photoStyle}"></span>
                                <span style="flex:1;min-width:0">
                                  <span style="display:block;font-size:18.5px;font-weight:800">\${p.title}</span>
                                  <span style="display:block;\${p.subStyle};margin-top:1px">\${p.loc}</span>
                                </span>
                                <span style="\${p.priceStyle};flex:none">\${p.priceFmt}</span>
                                \${ p.on ? \`<i class="ph-fill ph-check-circle"
                                    style="font-size:26px;flex:none"></i>\` : '' }
                              </button>
                            \`).join('') }
                          </div>
                        </div>
                      \` : '' }

                      \${ lS2 ? \`
                        <div>
                          <div
                            style="padding:20px 22px;border-radius:20px;background:#f3eeff;box-shadow:inset 0 0 0 2px #ddd2f5">
                            <div style="display:flex;align-items:center;gap:11px">
                              <span
                                style="width:46px;height:46px;border-radius:15px;background:#4a2c99;color:#efe8fb;display:grid;place-items:center;flex:none"><i
                                  class="ph-fill ph-user-plus" style="font-size:23px"></i></span>
                              <div style="flex:1;min-width:0">
                                <div style="font-size:19px;font-weight:800;color:#3a1f7a">New customer</div>
                                <div style="font-size:15.5px;font-weight:700;color:#6b5b8a">Type their name and number —
                                  they get saved to Contacts.</div>
                              </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px">
                              <input name="newName" value="\${lform.newName}" onInput="\${__b(onLForm)}"
                                placeholder="Their name"
                                style="width:100%;height:58px;padding:0 17px;border-radius:14px;border:none;background:#fff;box-shadow:inset 0 0 0 2px #ddd2f5;font-size:17px;font-weight:600;color:#241f1c;outline:none">
                              <input name="newPhone" value="\${lform.newPhone}" onInput="\${__b(onLForm)}"
                                placeholder="Phone number"
                                style="width:100%;height:58px;padding:0 17px;border-radius:14px;border:none;background:#fff;box-shadow:inset 0 0 0 2px #ddd2f5;font-size:17px;font-weight:600;color:#241f1c;outline:none">
                              <input name="newBusiness" value="\${lform.newBusiness}" onInput="\${__b(onLForm)}"
                                placeholder="Business / firm — optional"
                                style="width:100%;height:58px;padding:0 17px;border-radius:14px;border:none;background:#fff;box-shadow:inset 0 0 0 2px #ddd2f5;font-size:17px;font-weight:600;color:#241f1c;outline:none">
                            </div>
                          </div>
                          <div style="display:flex;align-items:center;gap:14px;margin:20px 0 4px">
                            <div style="flex:1;height:1px;background:#e3d9c6"></div><span
                              style="font-size:14px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e">or
                              pick someone you already have</span>
                            <div style="flex:1;height:1px;background:#e3d9c6"></div>
                          </div>
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
                            \${ (lClientRowsFull || []).map(c => \`
                              <button onClick="\${__b(c.go)}" style="\${c.style}">
                                <span style="\${c.avStyle}">\${c.initials}</span>
                                <span style="flex:1;min-width:0">
                                  <span style="display:block;font-size:18.5px;font-weight:800">\${c.name}</span>
                                  <span style="display:block;\${c.subStyle};margin-top:1px">\${c.sub}</span>
                                </span>
                                \${ c.on ? \`<i class="ph-fill ph-check-circle"
                                    style="font-size:26px;flex:none"></i>\` : '' }
                              </button>
                            \`).join('') }
                          </div>
                        </div>
                      \` : '' }

                      \${ lS3 ? \`
                        <div>
                          <div
                            style="padding:22px 24px;border-radius:20px;background:#fff3d1;box-shadow:inset 0 0 0 2px #f0dda6;box-sizing:border-box">
                            <div
                              style="font-size:14px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a3541b">
                              Say something to \${lName}</div>
                            <div style="font-size:16.5px;color:#8a6a44;font-weight:600;margin-top:5px;line-height:1.45">
                              Customers open a link far more often when they hear your voice.</div>
                            <button onClick="\${__b(lRecToggle)}" style="\${lRecStyle}">
                              <div style="display:flex;align-items:center;gap:10px;min-width:0">
                                <i class="\${lRecIcon}" style="font-size:24px;flex:none"></i>
                                <span style="font-size:16.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${lRecLabel}</span>
                              </div>
                              \${ lRecTime ? \`
                                <span style="display:inline-flex;align-items:center;height:34px;padding:0 12px;border-radius:999px;background:rgba(0,0,0,.15);color:inherit;font-size:15px;font-weight:800;flex:none">\${lRecTime}</span>
                              \` : '' }
                            </button>
                          </div>
                          <div
                            style="margin-top:14px;padding:18px 20px;border-radius:18px;background:#dcf3e5;box-shadow:inset 0 0 0 2px #a9dcc0">
                            <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
                              <i class="ph-fill ph-check-circle" style="font-size:24px;color:#0e4d2f"></i>
                              <div style="flex:1;min-width:160px;font-size:17px;font-weight:800;color:#0e4d2f">\${lFootHint} for \${lName}</div>
                              <button onClick="\${__b(openMobilePreview)}"
                                style="display:flex;align-items:center;gap:9px;height:52px;padding:0 19px;border-radius:14px;background:#fff;color:#12704a;font-size:16px;font-weight:800;flex:none"><i
                                  class="ph-fill ph-device-mobile" style="font-size:19px"></i>Preview</button>
                            </div>
                          </div>
                        </div>
                      \` : '' }
                    </div>

                    <div
                      style="flex:none;display:flex;align-items:center;gap:11px;padding:16px 28px;background:#f4fbf6">
                      \${ lNotS1 ? \`<button onClick="\${__b(lStepBack)}"
                          style="height:56px;padding:0 20px;border-radius:15px;background:#fff;color:#12704a;font-size:17px;font-weight:800;box-shadow:inset 0 0 0 1.5px #cfe6d8">Back</button>\` : '' }
                      <div style="flex:1;font-size:15.5px;font-weight:700;color:#12704a">\${lStepHint}</div>
                      \${ lNotS3 ? \`<button onClick="\${__b(lStepNext)}"
                          style="\${lStepNextStyle}">\${lStepNextLabel}<i class="ph-bold ph-arrow-right"
                            style="font-size:19px"></i></button>\` : '' }
                      \${ lS3 ? \`<button onClick="\${__b(sendLink)}" style="\${lSendStyle}"><i
                            class="ph-fill ph-paper-plane-tilt" style="font-size:19px"></i>Send link</button>\` : '' }
                    </div>
                  </div>
                \` : '' }

                \${ linkBuildDone ? \`
                  <div style="padding:32px 30px">
                    <div
                      style="width:64px;height:64px;margin:0 auto;border-radius:20px;background:#dcf3e5;color:#12a150;display:grid;place-items:center">
                      <i class="ph-fill ph-check-circle" style="font-size:34px"></i></div>
                    <div
                      style="margin-top:16px;text-align:center;font-family:'Newsreader',serif;font-weight:500;font-size:28px;letter-spacing:-.02em;color:#241d0c">
                      Link is ready</div>
                    <div style="margin-top:7px;text-align:center;font-size:15.5px;color:#6b6156">\${lDoneSub}</div>
                    <div
                      style="display:flex;align-items:center;gap:10px;margin-top:22px;padding:15px 17px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7">
                      <i class="ph-bold ph-link-simple" style="font-size:18px;color:#a8792a;flex:none"></i>
                      <span
                        style="flex:1;min-width:0;font-size:14.5px;font-weight:600;color:#4c463d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${lDoneUrl}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:16px">
                      <button onClick="\${__b(lCopy)}"
                        style="height:56px;border-radius:15px;background:#f0eaff;color:#4c463d;font-size:15.5px;font-weight:800"
                        style-hover="background:#ddd2f5">\${lCopyLabel}</button>
                      <button onClick="\${__b(closeLinkBuild)}"
                        style="display:flex;align-items:center;justify-content:center;gap:9px;height:56px;border-radius:15px;background:#12a150;color:#fff;font-size:15.5px;font-weight:800"
                        style-hover="background:#0f8b45"><i class="ph-fill ph-whatsapp-logo"
                          style="font-size:19px"></i>WhatsApp</button>
                      <button onClick="\${__b(goLinks)}"
                        style="grid-column:1 / -1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:14px;background:#fff3d1;color:#8a6a14;font-size:15.5px;font-weight:800"
                        style-hover="background:#ffe9a8"><i class="ph-fill ph-list-checks"
                          style="font-size:18px"></i>See all my links</button>
                    </div>
                  </div>
                \` : '' }

              </div>
            </div>
          \` : '' }

          \${ mobOpen ? \`
            <div style="position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:24px">
              <div onClick="\${__b(closeMob)}"
                style="position:absolute;inset:0;background:#160c1e;animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;display:flex;align-items:flex-start;gap:24px;">
                <div
                  style="width:396px;height:min(852px,92vh);border-radius:46px;background:#0f0a18;padding:12px;box-shadow:0 44px 100px -28px rgba(0,0,0,.8);flex:none">
                  <div data-scroll=""
                    style="width:100%;height:100%;border-radius:36px;overflow:auto;background:#140d20">

                    <div style="position:relative;height:330px;flex:none">
                      <div style="\${mob.heroStyle}"></div>
                      <div
                        style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,10,24,.62) 0%,rgba(15,10,24,.05) 38%,rgba(20,13,32,.96) 100%)">
                      </div>
                      <div
                        style="position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;gap:10px">
                        <div
                          style="width:38px;height:38px;border-radius:50%;background:#f8a800;color:#241d0c;display:grid;place-items:center;font-size:14px;font-weight:800;flex:none">
                          \${mob.initials}</div>
                        <div style="flex:1;min-width:0">
                          <div style="font-size:14.5px;font-weight:800;color:#fff6e0">\${mob.biz}</div>
                          <div style="font-size:11.5px;font-weight:700;color:#c9b6ef">Chosen for you by \${mob.dealer}
                          </div>
                        </div>
                      </div>
                      <div style="position:absolute;bottom:14px;left:16px;right:16px">
                        <div style="display:flex;align-items:center;gap:7px">
                          \${ (mob.dots || []).map(d => \`<span
                              style="\${d.style}"></span>\`).join('') }
                        </div>
                        <div
                          style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:10px">
                          <div>
                            <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#f8a800">\${mob.kicker}</div>
                            <div
                              style="font-family:'Newsreader',serif;font-weight:500;font-size:27px;line-height:1.12;color:#fffdf7;margin-top:4px">
                              \${mob.title}</div>
                          </div>
                          <span
                            style="font-size:11.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.16);border-radius:999px;padding:6px 11px;flex:none">\${mob.shotLabel}</span>
                        </div>
                      </div>
                      \${ mob.multi ? \`
                        <div style="position:absolute;top:62px;left:16px;right:16px;display:flex;gap:6px;z-index:3">
                          \${ (mob.pager || []).map(pg => \`<button
                              onClick="\${__b(pg.go)}" style="\${pg.style}">\${pg.label}</button>\`).join('') }
                        </div>
                      \` : '' }
                      <button onClick="\${__b(mob.prev)}"
                        style="position:absolute;left:10px;top:150px;width:40px;height:40px;border-radius:50%;background:rgba(20,13,32,.6);color:#fff6e0;display:grid;place-items:center"><i
                          class="ph-bold ph-caret-left" style="font-size:18px"></i></button>
                      <button onClick="\${__b(mob.next)}"
                        style="position:absolute;right:10px;top:150px;width:40px;height:40px;border-radius:50%;background:rgba(20,13,32,.6);color:#fff6e0;display:grid;place-items:center"><i
                          class="ph-bold ph-caret-right" style="font-size:18px"></i></button>
                    </div>

                    <div style="padding:4px 18px 26px;background:#140d20">
                      <div
                        style="display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:700;color:#c9b6ef">
                        <i class="ph-fill ph-map-pin" style="font-size:17px;color:#f8a800"></i>\${mob.area}</div>

                      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
                        \${ (mob.facts || []).map(f => \`<span
                            style="display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.09);border-radius:11px;padding:9px 13px"><i
                              class="\${f.i}" style="font-size:15px;color:#f8a800"></i>\${f.l}</span>\`).join('') }
                      </div>

                      <div
                        style="display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#f8a800,#f4881f);border-radius:16px;padding:15px 17px;margin-top:16px">
                        <i class="ph-fill ph-tag" style="font-size:21px;color:#3a2410"></i>
                        <span style="font-size:19px;font-weight:800;color:#241d0c">\${mob.priceLabel}</span>
                      </div>

                      \${ mob.audio ? \`
                        <div
                          style="border-radius:20px;padding:18px;margin-top:18px;background:linear-gradient(150deg,#6b3fd4,#3f1f9e);box-shadow:0 18px 40px -20px rgba(107,63,212,.9)">
                          <div
                            style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d8c8ff">
                            A message from \${mob.dealer}</div>
                          <div style="display:flex;align-items:center;gap:13px;margin-top:12px">
                            <button
                              style="width:56px;height:56px;border-radius:50%;background:#f8a800;color:#241d0c;display:grid;place-items:center;flex:none;animation:omGlow 2s ease-in-out infinite"><i
                                class="ph-fill ph-play" style="font-size:22px"></i></button>
                            <div style="flex:1;display:flex;align-items:center;gap:3px;height:38px">
                              \${ (mob.wave || []).map(w => \`<span
                                  style="\${w.style}"></span>\`).join('') }
                            </div>
                            <span style="font-size:14px;font-weight:800;color:#fff6e0;flex:none">\${mob.audioLen}</span>
                          </div>
                        </div>
                      \` : '' }

                      \${ mob.multi ? \`
                        <div
                          style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">
                          Also shortlisted for you</div>
                        <div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">
                          \${ (mob.others || []).map(o => \`
                            <button onClick="\${__b(o.go)}" style="\${o.style}">
                              <span style="\${o.thumbStyle}"></span>
                              <span style="flex:1;min-width:0;text-align:left"><span
                                  style="display:block;font-size:15.5px;font-weight:800;color:#fffdf7">\${o.title}</span><span style="display:block;font-size:12.5px;font-weight:700;color:#b9a8dd">\${o.loc}</span></span>
                              <i class="ph-bold ph-caret-right" style="font-size:15px;color:#9d8bc7;flex:none"></i>
                            </button>
                          \`).join('') }
                        </div>
                      \` : '' }

                      <div
                        style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">
                        Why this one</div>
                      <div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">
                        \${ (mob.benefits || []).map(b => \`
                          <div
                            style="display:flex;align-items:flex-start;gap:10px;font-size:15px;color:#efe6ff;line-height:1.45">
                            <i class="ph-fill ph-check-circle"
                              style="font-size:19px;color:#5ee08f;flex:none;margin-top:1px"></i>\${b}</div>
                        \`).join('') }
                      </div>

                      <div style="display:flex;flex-direction:column;gap:9px;margin-top:26px">
                        <button
                          style="display:flex;align-items:center;justify-content:center;gap:10px;height:60px;border-radius:16px;background:#5ee08f;color:#0d2c1a;font-size:18.5px;font-weight:800"><i
                            class="ph-fill ph-phone" style="font-size:22px"></i>Call \${mob.dealerFirst}</button>
                        <button
                          style="display:flex;align-items:center;justify-content:center;gap:10px;height:54px;border-radius:14px;background:rgba(94,224,143,.16);color:#5ee08f;font-size:16.5px;font-weight:800"><i
                            class="ph-fill ph-whatsapp-logo" style="font-size:20px"></i>WhatsApp</button>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
                          <button
                            style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:13px;background:rgba(255,201,60,.18);color:#f8a800;font-size:15px;font-weight:800"><i
                              class="ph-fill ph-calendar-check" style="font-size:18px"></i>Site visit</button>
                          <button
                            style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:13px;background:rgba(255,255,255,.1);color:#efe6ff;font-size:15px;font-weight:800"><i
                              class="ph-fill ph-chat-circle-text" style="font-size:18px"></i>Ask</button>
                        </div>
                      </div>
                      <div style="text-align:center;font-size:11.5px;color:#8776a8;margin-top:20px;line-height:1.55">\${mob.watermark}<br>Please keep this page to yourself.</div>
                    </div>
                  </div>
                </div>
                <div style="width:270px;flex:none;color:#efe6ff;padding-top:14px">
                  <div style="font-size:11.5px;font-weight:800;letter-spacing:.13em;color:#c9b6ef">WHAT YOUR CLIENT SEES
                  </div>
                  <div style="font-family:'Newsreader',serif;font-weight:500;font-size:27px;margin-top:6px">On their
                    phone</div>
                  <div style="font-size:14.5px;line-height:1.6;color:#c9b6ef;margin-top:12px">Photos first, your voice
                    next, then one big button to call you. Nothing about the seller, your commission or your notes.
                  </div>
                  <button onClick="\${__b(closeMob)}"
                    style="display:flex;align-items:center;gap:9px;height:52px;padding:0 20px;border-radius:14px;background:rgba(255,255,255,.14);color:#fffdf7;font-size:16px;font-weight:800;margin-top:20px"
                    style-hover="background:rgba(255,255,255,.24)"><i class="ph-bold ph-x"
                      style="font-size:17px"></i>Close preview</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ priceEditOpen ? \`
            <div style="position:fixed;inset:0;z-index:92;display:grid;place-items:center;padding:24px">
              <div onClick="\${__b(closePriceEdit)}"
                style="position:absolute;inset:0;background:rgba(60,44,12,.6);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:460px;max-width:100%;background:#f7f3ff;border-radius:24px;padding:26px;box-shadow:0 40px 90px -28px rgba(0,0,0,.6);">
                <div style="font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#a8792a">
                  Update price</div>
                <div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;color:#241f1c;margin-top:4px">
                  \${priceEditTitle}</div>
                <label
                  style="display:flex;align-items:center;gap:12px;background:#fffaf0;border:2px solid #f4ae14;border-radius:16px;padding:16px 18px;margin-top:18px">
                  <span style="font-family:'Newsreader',serif;font-size:28px;font-weight:600;color:#c85a1a">₹</span>
                  <input value="\${priceVal}" onInput="\${__b(onPriceVal)}" inputmode="decimal" placeholder="1.65"
                    style="flex:1;min-width:0;border:none;outline:none;background:none;font-size:30px;font-weight:800;color:#241f1c">
                  <span style="font-size:20px;font-weight:800;color:#8a7a52">Cr</span>
                </label>
                <div style="display:flex;gap:10px;margin-top:20px">
                  <button onClick="\${__b(closePriceEdit)}"
                    style="flex:1;height:54px;border-radius:14px;background:#f3eeff;color:#4c463d;font-size:16px;font-weight:800"
                    style-hover="background:#ddd2f5">Cancel</button>
                  <button onClick="\${__b(savePrice)}"
                    style="flex:1;display:flex;align-items:center;justify-content:center;gap:9px;height:54px;border-radius:14px;background:#12a150;color:#fff;font-size:16.5px;font-weight:800"
                    style-hover="background:#0b8f45"><i class="ph-fill ph-check-circle" style="font-size:19px"></i>Save
                    price</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ unpubOpen ? \`
            <div style="position:fixed;inset:0;z-index:92;display:grid;place-items:center;padding:24px">
              <div onClick="\${__b(closeUnpub)}"
                style="position:absolute;inset:0;background:rgba(60,44,12,.6);animation:omVeil .2s ease both"></div>
              <div
                style="position:relative;width:540px;max-width:100%;background:#f7f3ff;border-radius:24px;padding:26px;box-shadow:0 40px 90px -28px rgba(0,0,0,.6);">
                <div style="display:flex;align-items:center;gap:12px">
                  <div
                    style="width:48px;height:48px;border-radius:14px;background:#ffe6cf;color:#c2622a;display:grid;place-items:center;flex:none">
                    <i class="ph-fill ph-eye-slash" style="font-size:23px"></i></div>
                  <div>
                    <div style="font-family:'Newsreader',serif;font-weight:500;font-size:25px;color:#241f1c">Take it off
                      the map</div>
                    <div style="font-size:14.5px;color:#8d8271">Customers won't see it in presentations. Why?</div>
                  </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:18px">
                  \${ (unpubChips || []).map(c => \`<button onClick="\${__b(c.go)}"
                      style="\${c.style}">\${c.label}</button>\`).join('') }
                </div>
                <input value="\${unpubReason}" onInput="\${__b(onUnpubReason)}" placeholder="Or type your own reason"
                  style="width:100%;padding:15px 16px;border:1.5px solid #eed9a8;border-radius:13px;background:#fffaf0;font-size:16px;color:#241f1c;outline:none;margin-top:14px"
                  style-focus="border-color:#f4ae14">
                <div style="display:flex;gap:10px;margin-top:20px">
                  <button onClick="\${__b(closeUnpub)}"
                    style="flex:1;height:54px;border-radius:14px;background:#f3eeff;color:#4c463d;font-size:16px;font-weight:800"
                    style-hover="background:#ddd2f5">Keep it on</button>
                  <button onClick="\${__b(doUnpublish)}"
                    style="flex:1;display:flex;align-items:center;justify-content:center;gap:9px;height:54px;border-radius:14px;background:#c2622a;color:#fff;font-size:16.5px;font-weight:800"
                    style-hover="background:#a3501f"><i class="ph-fill ph-eye-slash" style="font-size:19px"></i>Take it
                    off</button>
                </div>
              </div>
            </div>
          \` : '' }

          \${ soldOpen ? \`
            <div style="position:fixed;inset:0;z-index:92;display:grid;place-items:center;padding:24px">
              <div onClick="\${__b(closeSold)}"
                style="position:absolute;inset:0;background:rgba(60,44,12,.6);animation:omVeil .2s ease both"></div>
              <div data-scroll=""
                style="position:relative;width:760px;max-width:100%;max-height:92vh;overflow-y:auto;overflow-x:hidden;background:#fdf6e6;border-radius:26px;box-shadow:0 40px 90px -28px rgba(0,0,0,.6);">
                <div
                  style="display:flex;align-items:center;gap:14px;padding:22px 26px;background:#241d0c;background-image:linear-gradient(140deg,#3f3014,#171106);color:#f7ecd2">
                  <div
                    style="width:54px;height:54px;border-radius:16px;background:rgba(255,255,255,.18);display:grid;place-items:center;flex:none">
                    <i class="ph-fill ph-seal-check" style="font-size:28px"></i></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-family:'Newsreader',serif;font-weight:500;font-size:29px;color:#fff">Mark this sold
                    </div>
                    <div style="font-size:16.5px;color:#cbb98d">\${soldTitle} · \${soldLoc}</div>
                  </div>
                  <button onClick="\${__b(closeSold)}"
                    style="width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center;flex:none"><i
                      class="ph-bold ph-x" style="font-size:19px"></i></button>
                </div>

                <div style="padding:22px 26px 26px">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                    <label style="display:block"><span
                        style="display:block;font-size:16.5px;font-weight:800;color:#7a5410;margin-bottom:8px">What
                        price did it sell at? (crore)</span><input name="price" value="\${soldForm.price}"
                        onInput="\${__b(onSoldForm)}" placeholder="1.42" style="\${soldInput}"></label>
                    <label style="display:block"><span
                        style="display:block;font-size:16.5px;font-weight:800;color:#7a5410;margin-bottom:8px">Your
                        commission (lakh)</span><input name="comm" value="\${soldForm.comm}"
                        onInput="\${__b(onSoldForm)}" placeholder="2.1" style="\${soldInput}"></label>
                  </div>

                  <div style="font-size:16.5px;font-weight:800;color:#7a5410;margin:20px 0 9px">When was it sold?</div>
                  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                    <input type="date" value="\${soldDateVal}" onInput="\${__b(onSoldDate)}"
                      style="\${soldDateInput};flex:1;min-width:240px;width:auto">
                    <button onClick="\${__b(soldTodayGo)}"
                      style="height:62px;padding:0 20px;border-radius:15px;background:#fffdf7;color:#7a5410;font-size:16.5px;font-weight:800;box-shadow:inset 0 0 0 2px #e9d3a4;flex:none">Today</button>
                  </div>

                  <div style="display:flex;align-items:center;gap:12px;margin:22px 0 10px;flex-wrap:wrap">
                    <div style="font-size:16.5px;font-weight:800;color:#7a5410;flex:1;min-width:130px">Who bought it?
                    </div>
                    <button onClick="\${__b(soldPickGo)}" style="\${soldPickStyle}">An existing customer</button>
                    <button onClick="\${__b(soldNewGo)}" style="\${soldNewStyle}">Someone new</button>
                  </div>

                  \${ soldPickOn ? \`
                    <div>
                      <label
                        style="display:flex;align-items:center;gap:12px;height:58px;padding:0 18px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 2px #e9d3a4">
                        <i class="ph-bold ph-magnifying-glass" style="font-size:20px;color:#9a6a00"></i>
                        <input value="\${soldBuyerQ}" onInput="\${__b(onSoldBuyerQ)}"
                          placeholder="Search your customers…"
                          style="border:none;outline:none;background:none;width:100%;font-size:17px;font-weight:600;color:#241f1c">
                      </label>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
                        \${ (soldBuyerList || []).map(c => \`
                          <button onClick="\${__b(c.go)}" style="\${c.style}">
                            <span style="\${c.avStyle}">\${c.initials}</span>
                            <span style="flex:1;min-width:0"><span
                                style="display:block;font-size:17.5px;font-weight:800">\${c.name}</span><span
                                style="display:block;\${c.subStyle}">\${c.phone}</span></span>
                            \${ c.on ? \`<i class="ph-fill ph-check-circle"
                                style="font-size:23px;flex:none"></i>\` : '' }
                          </button>
                        \`).join('') }
                      </div>
                    </div>
                  \` : '' }

                  \${ soldNewOn ? \`
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                      <label style="display:block"><span
                          style="display:block;font-size:16px;font-weight:800;color:#7a5410;margin-bottom:8px">Buyer
                          name</span><input name="buyerName" value="\${soldForm.buyerName}" onInput="\${__b(onSoldForm)}"
                          placeholder="Name" style="\${soldInput}"></label>
                      <label style="display:block"><span
                          style="display:block;font-size:16px;font-weight:800;color:#7a5410;margin-bottom:8px">Phone
                          <span style="font-weight:600;color:#a08750">— fill the rest later</span></span><input
                          name="buyerPhone" value="\${soldForm.buyerPhone}" onInput="\${__b(onSoldForm)}"
                          placeholder="98765 43210" style="\${soldInput}"></label>
                    </div>
                  \` : '' }

                  \${ soldError ? \`
                    <div role="alert"
                      style="margin-bottom:12px;padding:14px 16px;border-radius:14px;background:#ffe4ea;color:#b02a37;font-size:16px;font-weight:800">\${ soldError }</div>
                  \` : '' }
                  <button onClick="\${__b(soldConfirm)}" style="\${soldConfirmStyle}"
                    style-active="transform:translateY(2px)"><i class="ph-fill ph-seal-check"
                      style="font-size:25px"></i>\${ savingSold ? 'Recording the sale…' : 'Confirm this sale' }</button>
                  <button onClick="\${__b(closeSold)}"
                    style="width:100%;height:52px;border-radius:14px;background:transparent;color:#8a7a52;font-size:16.5px;font-weight:800;margin-top:10px">Cancel</button>
                </div>
              </div>
            </div>
          \` : '' }

          <div data-overlays=""></div>
        </div>
      </main>
    </div>
  \`;
    }
  `);
  
  return compiler(state);
}
