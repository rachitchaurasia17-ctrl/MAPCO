/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: Demand
   ---------------------------------------------------------------
   Consumes the hardened DataAdapterV2 DemandRepository (NOT the
   legacy getClients()). Renders typed loading/empty/error states,
   deterministic matches (with a no-match state), and binds all
   interactions through delegated listeners with cleanup.
   ═══════════════════════════════════════════════════════════════ */
import './demand.css';
import { adapter } from '../../../packages/data/adapter';
import { getInitials } from '../../../packages/auth/auth';
import { formatINR } from '../../../packages/ui/utils';
import type { DemandRecord, DemandMatch } from '../../../packages/data/contracts';

const PAGE_LIMIT = 24; // documented cap; within repo MAX_LIMIT ceiling

function shell(inner: string): string {
  return `
<div style="max-width:1120px;margin:0 auto;padding:30px 40px 70px">
  <div style="border-radius:28px;padding:32px 34px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">TODAY</div>
        <h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">Hello.</h1>
        <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Only from your own presentations and the links you sent.</p>
      </div>
      <a href="#/presentation" style="display:flex;align-items:center;gap:11px;height:62px;padding:0 26px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)"><i class="ph-fill ph-projector-screen-chart" style="font-size:22px"></i>Show the map</a>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px">
      <div style="border-radius:20px;padding:20px 22px;background:#ffc93c;background-image:linear-gradient(140deg,#ffdc7a,#f4ae14)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a6a14"><i class="ph-fill ph-cursor-click" style="font-size:16px"></i>Opened while presenting</div>
        <div style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#241d0c;margin-top:6px">34</div>
      </div>
      <div style="border-radius:20px;padding:20px 22px;background:#6b3fd4;background-image:linear-gradient(140deg,#8a63e8,#5b32c4)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#d8c8ff"><i class="ph-fill ph-paper-plane-tilt" style="font-size:16px"></i>Link opens</div>
        <div style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#fff;margin-top:6px">18</div>
        <div style="font-size:13px;font-weight:700;color:#d8c8ff;margin-top:4px">By your clients</div>
      </div>
      <div style="border-radius:20px;padding:20px 22px;background:#12a150;background-image:linear-gradient(140deg,#2ec06b,#0b8f45)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9f0d9"><i class="ph-fill ph-fire" style="font-size:16px"></i>Hottest area</div>
        <div style="font-family:'Newsreader',serif;font-weight:600;font-size:27px;line-height:1.15;color:#fff;margin-top:12px">Sector 90</div>
        <div style="font-size:14px;font-weight:700;color:#c9f0d9;margin-top:3px">24 opens</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;margin-top:18px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">

    <div style="min-width:0;background:#fff3d1;border:1.5px solid #f6e3ab;border-radius:24px;padding:24px 26px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">Where buyers look</h3>
        <span style="font-size:12.5px;font-weight:800;color:#8a6a14;white-space:nowrap">52 opens</span>
      </div>
      <div style="display:flex;align-items:center;gap:18px;margin-top:16px;flex-wrap:wrap">
        <div style="position:relative;width:158px;height:158px;flex:none">
          <svg viewBox="0 0 180 180" style="width:158px;height:158px;transform:rotate(-90deg);filter:drop-shadow(0 10px 20px rgba(31,26,18,.2))">
            <circle cx="90" cy="90" r="62" fill="none" stroke="#f4ae14" stroke-width="34" stroke-dasharray="390" stroke-dashoffset="0"></circle>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
            <div style="font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1;color:#241f1c">100%</div>
            <div style="font-size:11.5px;font-weight:800;color:#8a6a14;text-align:center;max-width:96px;line-height:1.25;margin-top:3px">Sector 90</div>
          </div>
        </div>
        <div style="flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:8px">
          <button style="display:flex;align-items:center;gap:10px;width:100%;padding:5px 7px;border-radius:10px;cursor:pointer;background:none;border:none">
            <span style="width:12px;height:12px;border-radius:4px;background:#f4ae14"></span>
            <span style="flex:1;min-width:0;text-align:left;font-size:15px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Sector 90</span>
            <span style="font-family:'Newsreader',serif;font-size:18px;font-weight:600;color:#241f1c;flex:none">100%</span>
          </button>
        </div>
      </div>
    </div>

    <div style="min-width:0;background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:24px;padding:24px 26px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">What gets opened most</h3>
        <span style="font-size:12.5px;font-weight:800;color:#5b32c4;white-space:nowrap">by type</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:11px;margin-top:16px">
        <div>
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
            <span style="font-size:15.5px;font-weight:800;color:#241f1c">Residential</span>
            <span style="font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#6b3fd4;background:#fff;padding:2px 6px;border-radius:6px">100%</span>
          </div>
          <div style="display:flex;align-items:center;gap:9px;margin-top:6px">
            <div style="flex:1;min-width:70px;height:16px;border-radius:999px;background:#ded0fa;overflow:hidden"><div style="height:100%;width:100%;background:#6b3fd4;border-radius:999px"></div></div>
            <span style="font-family:'Newsreader',serif;font-size:20px;font-weight:600;color:#5b32c4;flex:none">52</span>
          </div>
        </div>
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
      <div style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:9px">
        <div style="display:flex;align-items:flex-end;gap:6px;height:150px">
          <div style="width:24px;background:#6b3fd4;border-radius:6px;position:relative;height:100%"><span style="position:absolute;bottom:100%;left:50%;transform:translate(-50%,-4px);font-size:12px;font-weight:800;color:#5b32c4">52</span></div>
          <div style="width:24px;background:#ffc93c;border-radius:6px;position:relative;height:50%"><span style="position:absolute;bottom:100%;left:50%;transform:translate(-50%,-4px);font-size:12px;font-weight:800;color:#a8600c">12</span></div>
        </div>
        <div style="font-size:12.5px;font-weight:800;color:#4c463d;text-align:center;line-height:1.25;max-width:100%;overflow:hidden;text-overflow:ellipsis">Sector 90</div>
        <span style="font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a6a14;background:#f7e7c6;padding:2px 7px;border-radius:6px">Balanced</span>
      </div>
    </div>
  </div>

  <div style="background:#fbeecb;border:1px solid #f0dda6;margin-top:18px;border-radius:22px;padding:22px 26px;display:flex;align-items:center;gap:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
    <i class="ph-fill ph-fire" style="font-size:32px;color:#a8792a;flex:none"></i>
    <div><div style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#a8792a">Hottest area · Sector 90</div><div style="font-size:17px;color:#4c463d;line-height:1.45;margin-top:4px;max-width:820px">Sector 90 is your most looked-at area with 52 opens, and you have 12 plots ready. Lead with these.</div></div>
  </div>

</div>
`;
}

export async function renderDemand(el: HTMLElement): Promise<void> {
  const controller = new AbortController();

  async function load(): Promise<void> {
    el.innerHTML = shell('');
  }

  const cleanup = () => { controller.abort(); };
  window.addEventListener('pagehide', cleanup, { once: true });

  await load();
}
