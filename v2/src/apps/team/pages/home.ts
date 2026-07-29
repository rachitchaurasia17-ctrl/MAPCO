/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Work Table (Home)
   Source: Team Workspace.dc.html (isWork)
   ═══════════════════════════════════════════════════════════════ */

export function renderWorkHome(el: HTMLElement) {
  el.innerHTML = `
    <div class="pm-work-home" style="max-width:1140px;margin:0 auto;padding:40px 34px 70px">
      <div style="animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div style="font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#a8792a">The work table</div>
        <h1 style="margin:10px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1.05;letter-spacing:-.025em">What are we adding today?</h1>
        <p style="margin:12px 0 0;max-width:600px;font-size:17px;line-height:1.5;color:#6b6156;text-wrap:pretty">Everything you do here decides what a client sees on the presentation screen. Maps go live the moment you mark them — one switch hides them again.</p>
      </div>

      <div class="pm-work-actions" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:34px">
        <button style="text-align:left;display:flex;flex-direction:column;gap:0;padding:26px;border-radius:24px;background:#fff3d1;background-image:radial-gradient(130% 120% at 100% 0%,#ffe9ae,#fff6e2 62%);border:1px solid #f6d98d;box-shadow:0 2px 3px rgba(40,30,10,.04),0 26px 50px -38px rgba(120,86,10,.85);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease,border-color .25s;animation:wRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s" onmouseenter="this.style.transform='translateY(-6px)';this.style.borderColor='#ffc93c';this.style.boxShadow='0 2px 3px rgba(40,30,10,.05),0 36px 60px -36px rgba(168,121,42,.85)'" onmouseleave="this.style.transform='none';this.style.borderColor='#f6d98d';this.style.boxShadow='0 2px 3px rgba(40,30,10,.04),0 26px 50px -38px rgba(120,86,10,.85)'">
          <span style="width:52px;height:52px;border-radius:16px;background:#ffc93c;color:#241d0c;display:grid;place-items:center;box-shadow:0 14px 24px -16px rgba(120,86,10,.9)"><i class="ph-fill ph-house-line" style="font-size:27px"></i></span>
          <span style="display:block;margin-top:20px;font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.015em">Add a property</span>
          <span style="display:block;margin-top:7px;font-size:15px;line-height:1.5;color:#6b6156">Photos, size, facing, sector. Save it, then publish when it is ready to show.</span>
          <span style="display:flex;align-items:center;gap:8px;margin-top:20px;font-size:15px;font-weight:800;color:#8a5a0c">Start <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
        </button>

        <button style="text-align:left;display:flex;flex-direction:column;gap:0;padding:26px;border-radius:24px;background:#efe8fb;background-image:radial-gradient(130% 120% at 100% 0%,#e3d6fb,#f7f3ff 62%);border:1px solid #d6c6f5;box-shadow:0 2px 3px rgba(40,30,10,.04),0 26px 50px -38px rgba(70,40,150,.75);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease,border-color .25s;animation:wRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s" onmouseenter="this.style.transform='translateY(-6px)';this.style.borderColor='#5b32c4';this.style.boxShadow='0 2px 3px rgba(40,30,10,.05),0 36px 60px -36px rgba(91,50,196,.7)'" onmouseleave="this.style.transform='none';this.style.borderColor='#d6c6f5';this.style.boxShadow='0 2px 3px rgba(40,30,10,.04),0 26px 50px -38px rgba(70,40,150,.75)'">
          <span style="width:52px;height:52px;border-radius:16px;background:#5b32c4;color:#efe8fb;display:grid;place-items:center;box-shadow:0 14px 24px -16px rgba(52,28,120,.9)"><i class="ph-fill ph-user-plus" style="font-size:27px"></i></span>
          <span style="display:block;margin-top:20px;font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.015em">Add a client</span>
          <span style="display:block;margin-top:7px;font-size:15px;line-height:1.5;color:#6b6156">Name, phone, what they are looking for. Ready for the dealer's next meeting.</span>
          <span style="display:flex;align-items:center;gap:8px;margin-top:20px;font-size:15px;font-weight:800;color:#5b32c4">Start <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
        </button>

        <button style="text-align:left;display:flex;flex-direction:column;gap:0;padding:26px;border-radius:24px;background:#dcf3e5;background-image:radial-gradient(130% 120% at 100% 0%,#c9edd8,#f0fbf4 62%);border:1px solid #b3e0c6;box-shadow:0 2px 3px rgba(40,30,10,.04),0 26px 50px -38px rgba(18,120,70,.75);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease,border-color .25s;animation:wRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s" onmouseenter="this.style.transform='translateY(-6px)';this.style.borderColor='#1f4d3a';this.style.boxShadow='0 2px 3px rgba(40,30,10,.05),0 36px 60px -36px rgba(31,77,58,.8)'" onmouseleave="this.style.transform='none';this.style.borderColor='#b3e0c6';this.style.boxShadow='0 2px 3px rgba(40,30,10,.04),0 26px 50px -38px rgba(18,120,70,.75)'">
          <span style="width:52px;height:52px;border-radius:16px;background:#1f4d3a;color:#d9f5e3;display:grid;place-items:center;box-shadow:0 14px 24px -16px rgba(12,45,30,.9)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:27px"></i></span>
          <span style="display:block;margin-top:20px;font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.015em">Generate a link</span>
          <span style="display:block;margin-top:7px;font-size:15px;line-height:1.5;color:#6b6156">Pick a client, pick up to four plots, send one private page on WhatsApp.</span>
          <span style="display:flex;align-items:center;gap:8px;margin-top:20px;font-size:15px;font-weight:800;color:#1f4d3a">Start <i class="ph-bold ph-arrow-right" style="font-size:15px"></i></span>
        </button>
      </div>

      <a class="pm-work-studio" href="/admin/map-studio.html" style="text-decoration:none;display:block;width:100%;text-align:left;position:relative;overflow:hidden;margin-top:20px;border-radius:26px;border:1px solid #2c4a3c;background:#1b3a2e;background-image:radial-gradient(90% 140% at 88% 20%,rgba(255,201,60,.28),transparent 60%);box-shadow:0 2px 3px rgba(40,30,10,.06),0 34px 60px -40px rgba(12,45,30,.95);animation:wRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.24s;transition:transform .3s cubic-bezier(.2,.8,.2,1)" onmouseenter="this.style.transform='translateY(-5px)'" onmouseleave="this.style.transform='none'">
        <span style="display:flex;align-items:center;gap:30px;padding:30px 34px">
          <span style="flex:1;min-width:0">
            <span style="display:block;font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#ffd75e">The important one</span>
            <span style="display:block;margin-top:10px;font-family:'Newsreader',serif;font-weight:500;font-size:38px;line-height:1.05;letter-spacing:-.02em;color:#faf7ff">Map Studio</span>
            <span style="display:block;margin-top:10px;max-width:520px;font-size:16px;line-height:1.55;color:#c9dbcf">Mark roads, blocks and pins on any masterplan or sector map — then publish it straight to the client screen.</span>
            <span style="display:flex;flex-wrap:wrap;gap:8px;margin-top:18px">
              <span style="padding:7px 13px;border-radius:10px;background:rgba(255,255,255,.1);font-size:13px;font-weight:700;color:#e8f2eb">182 maps</span>
              <span style="padding:7px 13px;border-radius:10px;background:rgba(255,255,255,.1);font-size:13px;font-weight:700;color:#e8f2eb">Masterplan highlights</span>
              <span style="padding:7px 13px;border-radius:10px;background:rgba(255,255,255,.1);font-size:13px;font-weight:700;color:#e8f2eb">Sector drawing</span>
            </span>
          </span>
          <span style="flex:none;display:flex;align-items:center;gap:20px">
            <span style="display:block;width:230px;height:150px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.18);box-shadow:0 22px 40px -24px rgba(0,0,0,.7)">
              <img src="/maps-pilot/mohali-masterplan.png" alt="" style="width:100%;height:100%;object-fit:cover"/>
            </span>
            <span style="width:56px;height:56px;border-radius:50%;background:#ffc93c;color:#241d0c;display:grid;place-items:center;flex:none;box-shadow:0 16px 30px -16px rgba(255,201,60,.9)"><i class="ph-bold ph-arrow-right" style="font-size:24px"></i></span>
          </span>
        </span>
      </a>
    </div>
  `;
}
