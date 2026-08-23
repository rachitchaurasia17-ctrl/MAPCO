/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Operations — internal production desk

   PRIVATE. Not linked from any dealer navigation.

   Two screens only:
     1. Dealer roster — who still needs today's four
     2. One dealer's workspace — download pack, upload finished
        creatives, associate, approve

   The operator is the creative director. MAPCO prepares data, tracks
   28 output slots per week, keeps dealers isolated, and releases
   approved work into that dealer's existing Marketing pipeline.
   ═══════════════════════════════════════════════════════════════ */
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import {
  weekIdOf, weekStartOf, weekProgress, slotsForDay, findSlot,
  buildInventoryPack, describePack, downloadBlob, matchFiles, summarise,
  marketingOpsGateway, releasedForDealer, RELEASE_NOTE, canGenuinelyPublish,
  SLOT_STATUS_LABEL, WEEKDAYS, DealerAccessError,
  type CreativeAsset, type ImportCandidate, type NewInventoryItem, type OperatorDealerAccess,
  type OpsDealerRecord, type OpsWeek, type OutputSlot, type SlotStatus,
} from '../../packages/marketing/ops';
import {
  validateForChannels, buildContent, automatableChannels, CHANNEL_LABEL,
} from '../../packages/marketing/publishing';
import { requireSession } from '../../packages/data/session';

const esc = (v: unknown): string => String(v ?? '').replace(
  /[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
);

const STATUS_STYLE: Record<SlotStatus, { bg: string; fg: string }> = {
  waiting: { bg: '#f1eee8', fg: '#8a8070' },
  uploaded: { bg: '#e7f0ff', fg: '#2b6fd6' },
  reviewed: { bg: '#efe8fb', fg: '#5b32c4' },
  approved: { bg: '#e6f9f2', fg: '#0c7a5a' },
  ready: { bg: '#d9f5e3', fg: '#0b6f39' },
  posted: { bg: '#d9f5e3', fg: '#0b6f39' },
  failed: { bg: '#ffe1e6', fg: '#c2185b' },
};

const todayIso = new Date().toISOString().slice(0, 10);
const weekId = weekIdOf(new Date());
const weekStart = weekStartOf(new Date());

interface UI {
  operator: (OperatorDealerAccess & { name: string }) | null;
  dealers: readonly OpsDealerRecord[];
  activeDealerId: string | null;
  week: OpsWeek | null;
  assets: Record<string, CreativeAsset>;
  openDay: number;
  busy: string;
  error: string;
  imports: readonly ImportCandidate[];
  packInfo: string;
  loading: boolean;
  newProperties: readonly NewInventoryItem[];
}

const ui: UI = {
  operator: null, dealers: [], activeDealerId: null, week: null, assets: {},
  openDay: 0, busy: '', error: '', imports: [], packInfo: '', loading: true,
  newProperties: [],
};

const findDealer = (id: string): OpsDealerRecord | undefined => ui.dealers.find((dealer) => dealer.id === id);

function loadIcons(): void {
  ['regular', 'fill', 'bold'].forEach((w) => {
    const href = `/assets/phosphor/${w}/style.css`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  });
}

function toast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9000;padding:13px 20px;border-radius:14px;background:#151312;color:#ffdd85;font:800 15px "Hanken Grotesk",sans-serif;box-shadow:0 24px 48px -22px rgba(0,0,0,.8)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ── data ────────────────────────────────────────────────────── */

async function loadDealer(dealerId: string): Promise<void> {
  let dealer = findDealer(dealerId);
  if (!dealer || !ui.operator) { ui.error = 'That dealer is not available to you.'; return; }
  try {
    const properties = dealer.properties.length ? dealer.properties : await marketingOpsGateway.inventory(dealerId);
    dealer = { ...dealer, properties };
    ui.dealers = ui.dealers.map((item) => item.id === dealerId ? dealer! : item);
    const result = await marketingOpsGateway.openWeek(dealerId, weekId, weekStart);
    ui.week = result.week;
    ui.assets = Object.fromEntries(result.assets.map((a) => [a.slotRef, a]));
    ui.newProperties = result.newProperties;
    const preview = describePack(dealer.brand, dealer.properties, weekId);
    ui.packInfo = `${preview.marketable} marketable propert${preview.marketable === 1 ? 'y' : 'ies'}`
      + (preview.excluded.length ? ` · ${preview.excluded.length} excluded` : '');
    ui.activeDealerId = dealerId;
    ui.openDay = Math.max(0, WEEKDAYS.findIndex((_, i) => {
      const d = new Date(`${weekStart}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10) === todayIso;
    }));
    ui.error = '';
  } catch (err) {
    ui.error = err instanceof DealerAccessError
      ? 'You are not authorised for that dealer.'
      : 'Could not open that dealer.';
  }
}

/* ── roster ──────────────────────────────────────────────────── */

async function rosterRows(): Promise<string> {
  const rows: string[] = [];
  for (const dealer of ui.dealers) {
    let p = { todayDone: 0, todayRequired: 4, uploaded: 0, required: 28, awaitingReview: 0 };
    let packAt: string | undefined;
    try {
      const result = await marketingOpsGateway.openWeek(dealer.id, weekId, weekStart);
      p = weekProgress(result.week, todayIso);
      packAt = result.packDownloadedAt;
    } catch { /* row remains usable and truthful */ }
    const todayOk = p.todayDone >= p.todayRequired && p.todayRequired > 0;

    rows.push(`
    <button data-ops="open-dealer" data-dealer="${esc(dealer.id)}" style="display:block;width:100%;text-align:left;border:none;cursor:pointer;padding:18px 20px;border-radius:20px;background:#fff;box-shadow:0 14px 34px -26px rgba(20,16,12,.6);transition:transform .18s" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='none'">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <img src="${esc(dealer.brand.logoUrl ?? '/assets/mapco-logo.png')}" alt="" style="width:40px;height:40px;border-radius:11px;object-fit:contain;background:#f6f2ea;flex:none">
        <div style="min-width:0;flex:1">
          <div style="font-size:18px;font-weight:800;color:#191512">${esc(dealer.brand.name)}</div>
          <div style="margin-top:2px;font-size:13px;color:#7c7065">${esc(dealer.marketableProperties)} marketable · ${esc(dealer.brand.phone ?? 'no contact on file')}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="padding:7px 13px;border-radius:10px;font-size:13px;font-weight:800;${todayOk ? 'background:#e6f9f2;color:#0c7a5a' : 'background:#fff3d6;color:#8a6d24'}">Today ${p.todayDone}/${p.todayRequired}</span>
          <span style="padding:7px 13px;border-radius:10px;background:#f3eeff;color:#5b32c4;font-size:13px;font-weight:800">Week ${p.uploaded}/${p.required}</span>
          ${p.awaitingReview ? `<span style="padding:7px 13px;border-radius:10px;background:#e7f0ff;color:#2b6fd6;font-size:13px;font-weight:800">${p.awaitingReview} to review</span>` : ''}
          <span style="padding:7px 13px;border-radius:10px;background:${packAt ? '#e6f9f2' : '#f1eee8'};color:${packAt ? '#0c7a5a' : '#8a8070'};font-size:13px;font-weight:800">${packAt ? 'Pack downloaded' : 'Pack not taken'}</span>
        </div>
      </div>
    </button>`);
  }
  return rows.join('');
}

async function rosterView(): Promise<string> {
  return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:26px 34px 50px">
    <div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#a08c5c">MAPCO internal</div>
    <h1 style="margin:6px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:38px;letter-spacing:-.02em;color:#191512">Marketing Operations</h1>
    <p style="margin:8px 0 0;font-size:17px;color:#5f5648">Week ${esc(weekId)} · ${ui.dealers.length} dealer${ui.dealers.length === 1 ? '' : 's'} assigned to ${esc(ui.operator?.name ?? 'this operator')}</p>
    ${ui.error ? `<div role="alert" style="margin-top:16px;padding:13px 16px;border-radius:14px;background:#ffe1e6;color:#9f2446;font-size:15px">${esc(ui.error)}</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:22px">${await rosterRows()}</div>
    <div style="margin-top:22px;padding:14px 18px;border-radius:14px;background:rgba(255,255,255,.7);color:#6b6156;font-size:13.5px;line-height:1.55">${esc(RELEASE_NOTE)}</div>
  </div>`;
}

/* ── dealer workspace ────────────────────────────────────────── */

/**
 * Live caption validation against the channels this dealer could publish
 * to. Catches the silent rejections early — most importantly Google
 * Business, whose policy forbids a phone number in the post body.
 */
function captionWarnings(slot: OutputSlot): string {
  const caption = slot.caption?.trim();
  if (!caption) {
    return `<div style="font-size:12px;color:#8a8070">No caption yet — the post will publish with image only.</div>`;
  }
  const problems = validateForChannels(automatableChannels(), buildContent({ caption }));
  if (!problems.length) {
    return `<div style="font-size:12px;color:#0c7a5a">Caption looks fine for every connected channel.</div>`;
  }
  return `<div style="display:flex;flex-direction:column;gap:4px">
    ${problems.map((p) => `<div style="font-size:12px;color:#8a6d24;line-height:1.4">⚠ ${esc(CHANNEL_LABEL[p.channel])}: ${esc(p.message)}</div>`).join('')}
  </div>`;
}

function slotCard(slot: OutputSlot, dealer: OpsDealerRecord): string {
  const style = STATUS_STYLE[slot.status];
  const asset = ui.assets[slot.ref];
  const props = slot.propertyIds.length
    ? slot.propertyIds.map((id) => dealer.properties.find((p) => p.id === id)?.area ?? id).join(', ')
    : '';
  return `
  <div style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:18px;background:#fff;box-shadow:0 12px 30px -24px rgba(20,16,12,.6)">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:14px;font-weight:800;color:#191512;font-variant-numeric:tabular-nums">${esc(slot.ref)}</span>
      <span style="padding:4px 10px;border-radius:8px;background:${style.bg};color:${style.fg};font-size:11.5px;font-weight:800">${esc(SLOT_STATUS_LABEL[slot.status])}</span>
    </div>
    <div style="height:150px;border-radius:12px;background:#f6f2ea;display:grid;place-items:center;overflow:hidden">
      ${asset?.displayUrl || asset?.dataUrl ? `<img src="${esc(asset.displayUrl ?? asset.dataUrl)}" alt="${esc(slot.ref)}" style="width:100%;height:100%;object-fit:cover">`
        : `<span style="color:#b8ae9e;font-size:13px">No creative yet</span>`}
    </div>
    ${props ? `<div style="font-size:12.5px;color:#6b6156">Used: ${esc(props)}</div>` : ''}
    ${asset ? `
    <textarea data-ops="caption" data-slot="${esc(slot.ref)}" rows="3"
      placeholder="Caption for this post — written once here, reused on every channel"
      style="width:100%;resize:vertical;padding:9px 11px;border-radius:10px;border:1.5px solid #eadfc6;background:#fffdf8;font:600 13px 'Hanken Grotesk',sans-serif;color:#241f1c">${esc(slot.caption ?? '')}</textarea>
    ${captionWarnings(slot)}` : ''}
    ${asset ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
      ${(['instagram','facebook_page','google_business','whatsapp_business'] as const).map((channel) => `<label style="display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:8px;background:#f6f2ea;font-size:11.5px;font-weight:800;color:#5f5648"><input data-ops="channel" data-slot="${esc(slot.ref)}" data-channel="${channel}" type="checkbox" ${slot.channels?.includes(channel) ? 'checked' : ''}>${channel === 'google_business' ? 'Google' : channel === 'facebook_page' ? 'Facebook' : channel === 'whatsapp_business' ? 'WhatsApp' : 'Instagram'}</label>`).join('')}
    </div>` : ''}
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <select data-ops="attach-property" data-slot="${esc(slot.ref)}" style="flex:1;min-width:0;height:34px;padding:0 8px;border-radius:9px;border:1.5px solid #eadfc6;background:#fff;font:700 12.5px 'Hanken Grotesk',sans-serif;color:#241f1c">
        <option value="">Attach property…</option>
        ${dealer.properties.map((p) => `<option value="${esc(p.id)}"${slot.propertyIds.includes(p.id) ? ' selected' : ''}>${esc(p.area || p.type)} · ${esc(p.size)}</option>`).join('')}
      </select>
      <label style="height:34px;display:inline-flex;align-items:center;padding:0 11px;border-radius:9px;cursor:pointer;background:#e7f0ff;color:#2b6fd6;font:800 12.5px 'Hanken Grotesk',sans-serif">${asset ? 'Replace' : 'Upload'}<input data-ops="slot-upload" data-slot="${esc(slot.ref)}" type="file" accept="image/png,image/jpeg,image/webp" style="display:none"></label>
      ${asset && !['ready','posted','approved'].includes(slot.status) ? `<button data-ops="approve" data-slot="${esc(slot.ref)}" style="height:34px;padding:0 12px;border:none;border-radius:9px;cursor:pointer;background:#0f9c73;color:#fff;font:800 12.5px 'Hanken Grotesk',sans-serif">Approve</button>` : ''}
    </div>
  </div>`;
}

function importPanel(): string {
  if (!ui.imports.length) return '';
  const s = summarise(ui.imports);
  return `<div style="margin-top:14px;padding:16px;border-radius:18px;background:#fff;box-shadow:0 16px 36px -26px rgba(20,16,12,.5)">
    <div style="font-size:14px;font-weight:800;color:#191512">${s.matched} matched${s.duplicate ? ` · ${s.duplicate} duplicate` : ''}${s.unmatched ? ` · ${s.unmatched} unmatched` : ''}${s.invalid ? ` · ${s.invalid} invalid` : ''}</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
      ${ui.imports.map((c) => {
        const ok = c.outcome === 'matched';
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:${ok ? '#e6f9f2' : c.outcome === 'duplicate' ? '#ffe9f3' : '#fff3d6'}">
          <span style="font-size:12px;font-weight:800;min-width:74px;color:${ok ? '#0c7a5a' : '#8a6d24'}">${esc(c.outcome)}</span>
          <span style="flex:1;min-width:0;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.fileName)}</span>
          <span style="font-size:12.5px;color:#6b6156">${esc(c.note)}</span>
        </div>`;
      }).join('')}
    </div>
    ${s.matched ? `<button data-ops="commit-import" style="margin-top:12px;height:40px;padding:0 18px;border:none;border-radius:12px;cursor:pointer;background:#0f9c73;color:#fff;font:800 14px 'Hanken Grotesk',sans-serif">Save ${s.matched} creative${s.matched === 1 ? '' : 's'}</button>` : ''}
    <button data-ops="clear-import" style="margin-top:12px;margin-left:8px;height:40px;padding:0 16px;border:none;border-radius:12px;cursor:pointer;background:#f1eee8;color:#6b6156;font:800 14px 'Hanken Grotesk',sans-serif">Clear</button>
  </div>`;
}

function dealerView(): string {
  const dealer = findDealer(ui.activeDealerId!)!;
  const week = ui.week!;
  const p = weekProgress(week, todayIso);
  const daySlots = slotsForDay(week, ui.openDay);
  const released = releasedForDealer(week.slots, Object.values(ui.assets));

  return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:0 0 50px">
    <!-- Active dealer banner: unmistakable, always visible while uploading -->
    <div style="position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:16px 34px;background:#151312;color:#fff8e6;flex-wrap:wrap">
      <button data-ops="back" style="height:38px;padding:0 14px;border:none;border-radius:11px;cursor:pointer;background:rgba(255,248,230,.14);color:#fff8e6;font:800 13.5px 'Hanken Grotesk',sans-serif">← All dealers</button>
      <img src="${esc(dealer.brand.logoUrl ?? '/assets/mapco-logo.png')}" alt="" style="width:34px;height:34px;border-radius:9px;object-fit:contain;background:#fff">
      <div style="min-width:0">
        <div style="font-size:18px;font-weight:800;letter-spacing:-.01em">${esc(dealer.brand.name)}</div>
        <div style="font-size:12.5px;color:#c9bda4">Week ${esc(weekId)} · ${esc(ui.packInfo)}</div>
      </div>
      <div style="flex:1"></div>
      <span style="padding:7px 13px;border-radius:10px;background:rgba(255,248,230,.14);font-size:13px;font-weight:800">Today ${p.todayDone}/${p.todayRequired}</span>
      <span style="padding:7px 13px;border-radius:10px;background:rgba(255,248,230,.14);font-size:13px;font-weight:800">Week ${p.uploaded}/${p.required}</span>
    </div>

    <div style="padding:22px 34px 0">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button data-ops="download-pack" style="height:46px;padding:0 20px;border:none;border-radius:13px;cursor:pointer;background:#151312;color:#ffdd85;font:800 15px 'Hanken Grotesk',sans-serif">${ui.busy || 'Download AI Marketing Pack'}</button>
        <label style="height:46px;display:inline-flex;align-items:center;gap:8px;padding:0 20px;border-radius:13px;cursor:pointer;background:#0f9c73;color:#fff;font:800 15px 'Hanken Grotesk',sans-serif">
          Upload Final Creatives
          <input data-ops="upload" type="file" accept="image/png,image/jpeg,image/webp" multiple style="display:none">
        </label>
      </div>
      ${ui.error ? `<div role="alert" style="margin-top:14px;padding:13px 16px;border-radius:14px;background:#ffe1e6;color:#9f2446;font-size:15px">${esc(ui.error)}</div>` : ''}
      ${importPanel()}

      <div data-scroll style="display:flex;gap:9px;margin-top:20px;overflow-x:auto;padding-bottom:6px">
        ${week.slots.filter((s) => s.slotIndex === 0).map((s) => {
          const on = s.dayIndex === ui.openDay;
          const done = slotsForDay(week, s.dayIndex).filter((x) => x.status !== 'waiting').length;
          return `<button data-ops="day" data-day="${s.dayIndex}" style="flex:none;display:flex;flex-direction:column;align-items:center;gap:1px;padding:11px 16px;border:none;border-radius:15px;cursor:pointer;${on ? 'background:#151312;color:#ffdd85' : 'background:#fff;color:#5f5648;box-shadow:inset 0 0 0 1px #eadfc6'}">
            <span style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.8">${esc(WEEKDAYS[s.dayIndex]!.slice(0, 3))}</span>
            <span style="font-family:'Newsreader',serif;font-size:19px;font-weight:800">${esc(s.localDate.slice(8))}</span>
            <span style="font-size:11.5px;font-weight:800">${done}/4</span>
          </button>`;
        }).join('')}
      </div>

      <div style="margin-top:18px;font-size:19px;font-weight:800;color:#191512">${esc(WEEKDAYS[ui.openDay])} — 4 required outputs</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:12px">
        ${daySlots.map((s) => slotCard(s, dealer)).join('')}
      </div>

      ${ui.newProperties.length ? `<div style="margin-top:24px;padding:16px 18px;border-radius:16px;background:#fff3d6">
        <div style="font-size:14px;font-weight:800;color:#8a6d24">New inventory this week</div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">${ui.newProperties.map((item) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;background:rgba(255,255,255,.75)"><span style="flex:1;font-size:13.5px;font-weight:700;color:#5f5648">${esc(item.propertyLabel)}</span>${item.recommendedSlotId ? `<button data-ops="assign-new" data-action="${esc(item.id)}" data-slot-id="${esc(item.recommendedSlotId)}" style="height:32px;padding:0 11px;border:none;border-radius:9px;background:#151312;color:#ffdd85;font:800 12px 'Hanken Grotesk',sans-serif">Use ${esc(item.recommendedSlotRef)}</button>` : `<span style="font-size:12px;font-weight:800;color:#9f2446">No safe slot available</span>`}</div>`).join('')}</div>
        <div style="margin-top:8px;font-size:12px;color:#8a6d24">New properties use an existing unprotected slot. The week always remains exactly 28 outputs.</div>
      </div>` : ''}

      <div style="margin-top:24px;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,.72)">
        <div style="font-size:14px;font-weight:800;color:#191512">Released to ${esc(dealer.brand.name)}'s Marketing</div>
        <div style="margin-top:6px;font-size:13.5px;color:#6b6156;line-height:1.55">
          ${released.length
            ? `${released.length} approved creative${released.length === 1 ? '' : 's'} are in this dealer's Marketing pipeline at <strong>Ready to publish</strong>.`
            : 'Nothing approved yet. Approved creatives appear in the dealer\'s own Marketing screen.'}
          <br>${esc(RELEASE_NOTE)}
        </div>
      </div>
    </div>
  </div>`;
}

/* ── shell ───────────────────────────────────────────────────── */

async function render(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const body = ui.loading
    ? `<div style="flex:1;display:grid;place-items:center;color:#6b6156;font-size:16px">Loading Marketing Operations…</div>`
    : ui.activeDealerId && ui.week ? dealerView() : await rosterView();

  root.innerHTML = `
  <style>body{background:#f6f2ea;background-image:radial-gradient(52% 40% at 100% 0%,rgba(255,201,60,.28),transparent 60%),radial-gradient(46% 38% at 0% 100%,rgba(139,96,232,.18),transparent 62%);background-attachment:fixed}</style>
  <div style="display:flex;flex-direction:column;height:100vh;min-height:0;overflow:hidden">${body}</div>`;
}

/* ── events ──────────────────────────────────────────────────── */

function wire(root: HTMLElement): void {
  root.addEventListener('change', async (event) => {
    const el = event.target as HTMLElement;
    const act = el.getAttribute('data-ops');

    if (act === 'upload') {
      const files = Array.from((el as HTMLInputElement).files ?? []);
      if (!files.length || !ui.week) return;
      ui.imports = await matchFiles(files, {
        briefs: ui.week.slots.map((s) => ({ id: s.ref })) as never,
        alreadyUploaded: Object.keys(ui.assets),
      });
      await render();
      return;
    }

    if (act === 'slot-upload' && ui.week && ui.activeDealerId) {
      const file = (el as HTMLInputElement).files?.[0];
      const slot = findSlot(ui.week, el.getAttribute('data-slot') ?? '');
      if (!file || !slot) return;
      ui.busy = `Uploading ${slot.ref}…`; ui.error = ''; await render();
      try { await marketingOpsGateway.upload(slot, file); toast(`${slot.ref} uploaded`); }
      catch (error) { ui.error = error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed.'; }
      ui.busy = ''; await loadDealer(ui.activeDealerId); await render();
      return;
    }

    // The team writes the caption at upload time so automatic
    // distribution has the post text ready with no second pass.
    if (act === 'caption' && ui.week && ui.activeDealerId) {
      const ref = el.getAttribute('data-slot')!;
      const slot = findSlot(ui.week, ref);
      if (!slot) return;
      const caption = (el as HTMLTextAreaElement).value.trim();
      try { await marketingOpsGateway.updateSlot({ ...slot, caption: caption || undefined }); }
      catch (error) { ui.error = error instanceof Error ? error.message : 'Caption update failed.'; }
      await loadDealer(ui.activeDealerId);
      await render();
      return;
    }

    if (act === 'attach-property' && ui.week && ui.activeDealerId) {
      const ref = el.getAttribute('data-slot')!;
      const propertyId = (el as HTMLSelectElement).value;
      const slot = findSlot(ui.week, ref);
      if (!slot) return;
      const next: OutputSlot = { ...slot, propertyIds: propertyId ? [propertyId] : [] };
      try { await marketingOpsGateway.updateSlot(next); }
      catch (error) { ui.error = error instanceof Error ? error.message : 'Property association failed.'; }
      await loadDealer(ui.activeDealerId);
      await render();
      return;
    }

    if (act === 'channel' && ui.week && ui.activeDealerId) {
      const ref = el.getAttribute('data-slot')!;
      const channel = el.getAttribute('data-channel') as NonNullable<OutputSlot['channels']>[number];
      const slot = findSlot(ui.week, ref); if (!slot) return;
      const checked = (el as HTMLInputElement).checked;
      const channels = checked ? [...new Set([...(slot.channels ?? []), channel])] : (slot.channels ?? []).filter((item) => item !== channel);
      try { await marketingOpsGateway.updateSlot({ ...slot, channels }); }
      catch (error) { ui.error = error instanceof Error ? error.message : 'Channel update failed.'; }
      await loadDealer(ui.activeDealerId); await render();
    }
  });

  root.addEventListener('click', async (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-ops]');
    if (!el) return;
    const act = el.getAttribute('data-ops');
    const ref = el.getAttribute('data-slot');

    switch (act) {
      case 'open-dealer':
        await loadDealer(el.getAttribute('data-dealer')!);
        await render();
        break;

      case 'back':
        ui.activeDealerId = null; ui.week = null; ui.imports = []; ui.error = '';
        await render();
        break;

      case 'day':
        ui.openDay = Number(el.getAttribute('data-day')) || 0;
        await render();
        break;

      case 'download-pack': {
        if (!ui.activeDealerId || ui.busy) return;
        const dealer = findDealer(ui.activeDealerId)!;
        ui.busy = 'Building pack…'; await render();
        try {
          const result = await buildInventoryPack(
            ui.operator!, dealer.id, dealer.brand, dealer.properties, weekId,
            (done, total) => { ui.busy = total ? `Packing ${done}/${total}…` : 'Packing…'; });
          downloadBlob(result.blob, result.fileName);
          await marketingOpsGateway.markPackDownloaded(dealer.id, weekId);
          toast(`${result.propertyCount} properties · ${result.photoCount} photos`);
        } catch (err) {
          ui.error = err instanceof DealerAccessError
            ? 'You are not authorised for that dealer.'
            : 'Could not build the pack.';
        }
        ui.busy = ''; await render();
        break;
      }

      case 'commit-import': {
        if (!ui.activeDealerId || !ui.week) return;
        const matched = ui.imports.filter((c) => c.outcome === 'matched' && c.file);
        for (const c of matched) {
          const slot = findSlot(ui.week, c.creativeId!);
          if (!slot) continue;
          try { await marketingOpsGateway.upload(slot, c.file!); }
          catch (error) { ui.error = error instanceof Error ? `${slot.ref}: ${error.message}` : `${slot.ref}: upload failed`; }
        }
        await loadDealer(ui.activeDealerId);
        ui.imports = [];
        toast(`${matched.length} creative${matched.length === 1 ? '' : 's'} saved`);
        await render();
        break;
      }

      case 'clear-import': ui.imports = []; await render(); break;

      case 'approve': {
        if (!ui.activeDealerId || !ui.week || !ref) return;
        const slot = findSlot(ui.week, ref);
        if (!slot) return;
        try {
          await marketingOpsGateway.approve(slot);
          toast(canGenuinelyPublish() ? `${ref} approved` : `${ref} approved · ready to publish`);
        } catch (error) { ui.error = error instanceof Error ? `Approval failed: ${error.message}` : 'Approval failed.'; }
        await loadDealer(ui.activeDealerId);
        await render();
        break;
      }

      case 'assign-new': {
        if (!ui.activeDealerId) return;
        try {
          await marketingOpsGateway.assignNewProperty(el.getAttribute('data-action') ?? '', el.getAttribute('data-slot-id') ?? '');
          toast('New property assigned without adding a slot.');
        } catch (error) { ui.error = error instanceof Error ? error.message : 'Could not assign property.'; }
        await loadDealer(ui.activeDealerId); await render();
        break;
      }
    }
  });
}

async function boot(): Promise<void> {
  loadIcons();
  const root = document.getElementById('app');
  if (!root) return;
  wire(root);
  await render();
  await requireSession(root, async () => {
    try {
      const loaded = await marketingOpsGateway.load();
      ui.operator = loaded.operator; ui.dealers = loaded.dealers;
    } catch (error) {
      ui.error = error instanceof Error ? error.message : 'Marketing Ops access denied.';
    }
    ui.loading = false;
    await render();
  });
}

void boot();
