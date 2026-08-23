/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — Operator workspace (This Week)

   Added as a tab inside the existing Marketing screen. The existing
   Today / Library / Performance tabs are untouched.

   Built for a low-tech operator: one obvious action per row, plain
   language, and never a silent failure.
   ═══════════════════════════════════════════════════════════════ */
import {
  planWeek, allBriefs, toHistory, weekStartOf, weekIdOf,
  buildDayPack, buildWeekPack, downloadBlob, buildDailyPrompt, buildRegenerationPrompt,
  getTemplate, templateAssetUrl, allTemplates,
  matchFiles, summarise, fileToDataUrl,
  localPlanStore,
  type CreativeBrief, type DealerBrand, type ImportCandidate, type WeeklyPlan,
} from '../../packages/marketing';
import { adapter } from '../../packages/data/adapter';
import { listAllRecords } from '../../packages/data/list-all';
import { getProfile } from '../../packages/auth/auth';
import type { Property } from '../../packages/data/types';

const esc = (v: unknown): string => String(v ?? '').replace(
  /[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
);

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  ready_for_chatgpt: { label: 'Ready for ChatGPT', bg: '#fff3d6', fg: '#8a6d24' },
  generated: { label: 'Generated', bg: '#e7f0ff', fg: '#2b6fd6' },
  needs_review: { label: 'Needs review', bg: '#ffe9f3', fg: '#c9436b' },
  approved: { label: 'Approved', bg: '#e6f9f2', fg: '#0c7a5a' },
  skipped: { label: 'Skipped', bg: '#f1eee8', fg: '#8a8070' },
};

interface WeekState {
  plan: WeeklyPlan | null;
  loading: boolean;
  error: string;
  openDay: number;
  busy: string;
  imports: readonly ImportCandidate[];
  results: Record<string, string>;   // creativeId → dataUrl
  editing: string | null;
}

const ws: WeekState = {
  plan: null, loading: false, error: '', openDay: 0, busy: '',
  imports: [], results: {}, editing: null,
};

let host: HTMLElement | null = null;
let dealerId = 'dealer-local';
let brand: DealerBrand = { dealerId, name: 'MAPCO Dealer' };
let properties: Property[] = [];

export function weekStateSummary(): { total: number; ready: number; approved: number } {
  const briefs = ws.plan ? allBriefs(ws.plan) : [];
  return {
    total: briefs.length,
    ready: briefs.filter((b) => b.status === 'ready_for_chatgpt').length,
    approved: briefs.filter((b) => b.status === 'approved').length,
  };
}

/* Dealer contact for creatives. In production this comes from
   dealer_settings (support_phone / whatsapp_number) via the marketing
   facts RPC. In mock mode there is no such source, so the operator sets
   it once here rather than MAPCO inventing a number. */
const BRAND_KEY = 'mapco.marketing.brand.v1';

function readBrandContact(): { phone?: string } {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    return raw ? (JSON.parse(raw) as { phone?: string }) : {};
  } catch { return {}; }
}

function writeBrandContact(phone: string): void {
  try { localStorage.setItem(BRAND_KEY, JSON.stringify({ phone })); } catch { /* private mode */ }
}

export async function initWeek(rerender: () => void): Promise<void> {
  const profile = getProfile();
  dealerId = (profile?.dealerId || profile?.dealerName || 'dealer-local')
    .toLowerCase().replace(/\s+/g, '-');
  const contact = readBrandContact();
  brand = {
    dealerId,
    name: profile?.dealerName || 'MAPCO Dealer',
    phone: contact.phone,
    whatsapp: contact.phone,
  };
  ws.loading = true;
  rerender();
  try {
    const result = await listAllRecords((params, opts) => adapter.properties.list(params, opts));
    properties = result.ok ? [...result.value] : [];
    const weekId = weekIdOf(new Date());
    ws.plan = await localPlanStore.getPlan(dealerId, weekId);
    for (const brief of ws.plan ? allBriefs(ws.plan) : []) {
      const stored = await localPlanStore.getResult(dealerId, brief.id);
      if (stored) ws.results[brief.id] = stored.dataUrl;
    }
  } catch {
    ws.error = 'Could not load your inventory. Refresh and try again.';
  }
  ws.loading = false;
  rerender();
}

export async function generateWeek(rerender: () => void, rebuild = false): Promise<void> {
  ws.busy = rebuild ? 'Rebuilding this week…' : 'Preparing this week…';
  ws.error = '';
  rerender();
  try {
    const weekStart = weekStartOf(new Date());
    const history = await localPlanStore.history(dealerId, '2000-01-01');
    const existing = await localPlanStore.getPlan(dealerId, weekIdOf(new Date()));
    const plan = await planWeek({
      dealerId, brand, properties, weekStart,
      revision: rebuild ? (existing?.revision ?? 1) + 1 : (existing?.revision ?? 1),
      // Rebuild ignores this week's own history so it can reuse the slots.
      history: history.filter((h) => h.localDate < weekStart),
    });
    await localPlanStore.savePlan(plan);
    ws.plan = plan;
  } catch (err) {
    ws.error = err instanceof Error ? err.message : 'Could not prepare the week.';
  }
  ws.busy = '';
  rerender();
}

/* ── actions ─────────────────────────────────────────────────── */

async function updateBrief(brief: CreativeBrief, rerender: () => void): Promise<void> {
  if (!ws.plan) return;
  await localPlanStore.updateBrief(dealerId, ws.plan.weekId, brief);
  ws.plan = await localPlanStore.getPlan(dealerId, ws.plan.weekId);
  rerender();
}

function findBrief(id: string): CreativeBrief | undefined {
  return ws.plan ? allBriefs(ws.plan).find((b) => b.id === id) : undefined;
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied`);
  } catch {
    toast('Could not copy — select the text manually');
  }
}

function toast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9000;padding:13px 20px;border-radius:14px;background:#241d0c;color:#ffdd85;font:800 15px "Hanken Grotesk",sans-serif;box-shadow:0 24px 48px -22px rgba(0,0,0,.7)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ── rendering ───────────────────────────────────────────────── */

function briefRow(brief: CreativeBrief): string {
  const meta = STATUS_META[brief.status] ?? STATUS_META.ready_for_chatgpt!;
  const template = getTemplate(brief.templateId);
  const result = ws.results[brief.id];
  return `
  <div style="display:flex;align-items:center;gap:14px;padding:13px 14px;border-radius:16px;background:rgba(255,255,255,.86);box-shadow:0 10px 26px -22px rgba(80,50,120,.6)">
    <div style="width:56px;height:70px;flex:none;border-radius:11px;overflow:hidden;background:#efe6d6;${result ? `background-image:url('${result}');background-size:cover;background-position:center` : brief.heroPhoto.url ? `background-image:url('${esc(brief.heroPhoto.url)}');background-size:cover;background-position:center` : ''}"></div>
    <div style="min-width:0;flex:1">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:800;color:#241f1c;font-variant-numeric:tabular-nums">${brief.id}</span>
        <span style="padding:3px 9px;border-radius:7px;background:${meta.bg};color:${meta.fg};font-size:11.5px;font-weight:800">${meta.label}</span>
        <span style="padding:3px 9px;border-radius:7px;background:#f3eeff;color:#6b5ea8;font-size:11.5px;font-weight:700">${esc(brief.templateId)}</span>
      </div>
      <div style="margin-top:4px;font-size:15.5px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(brief.propertyLabel)}</div>
      <div style="margin-top:2px;font-size:13px;color:#7c705d">${esc(brief.objective.replace(/_/g, ' '))} · ${esc(brief.angle.replace(/_/g, ' '))} · ${brief.facts.facts.length} verified facts</div>
    </div>
    <div style="flex:none;display:flex;align-items:center;gap:6px">
      <button data-wk="brief-prompt" data-id="${brief.id}" title="Copy the regenerate prompt for this one" style="height:34px;padding:0 11px;border:none;border-radius:10px;cursor:pointer;background:#f3eeff;color:#5b32c4;font:800 12.5px 'Hanken Grotesk',sans-serif">Regen prompt</button>
      <button data-wk="edit" data-id="${brief.id}" style="height:34px;padding:0 11px;border:none;border-radius:10px;cursor:pointer;background:#fff3d6;color:#8a6d24;font:800 12.5px 'Hanken Grotesk',sans-serif">Edit</button>
      <button data-wk="skip" data-id="${brief.id}" style="height:34px;padding:0 11px;border:none;border-radius:10px;cursor:pointer;background:#f1eee8;color:#8a8070;font:800 12.5px 'Hanken Grotesk',sans-serif">${brief.status === 'skipped' ? 'Unskip' : 'Skip'}</button>
      ${result ? `<button data-wk="approve" data-id="${brief.id}" style="height:34px;padding:0 12px;border:none;border-radius:10px;cursor:pointer;background:${brief.status === 'approved' ? '#0b7d5c' : '#0f9c73'};color:#fff;font:800 12.5px 'Hanken Grotesk',sans-serif">${brief.status === 'approved' ? 'Approved' : 'Approve'}</button>` : ''}
    </div>
  </div>`;
}

function editPanel(brief: CreativeBrief): string {
  const photos = [brief.heroPhoto, ...brief.secondaryPhotos];
  return `
  <div style="margin-top:10px;padding:16px;border-radius:16px;background:#fffaf0;box-shadow:inset 0 0 0 1px #eadfc6">
    <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a08c5c">Editing ${brief.id}</div>
    <div style="margin-top:12px;font-size:13.5px;font-weight:800;color:#241f1c">Hero photo</div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      ${photos.map((p) => `<button data-wk="set-hero" data-id="${brief.id}" data-photo="${esc(p.id)}" style="width:64px;height:64px;border:none;border-radius:10px;cursor:pointer;background-image:url('${esc(p.url)}');background-size:cover;background-position:center;box-shadow:0 0 0 ${p.id === brief.heroPhoto.id ? '3px #ffc21e' : '1px rgba(0,0,0,.15)'}"></button>`).join('')}
    </div>
    <div style="margin-top:14px;font-size:13.5px;font-weight:800;color:#241f1c">Template</div>
    <select data-wk="set-template" data-id="${brief.id}" style="margin-top:8px;width:100%;max-width:420px;height:40px;padding:0 12px;border-radius:11px;border:1.5px solid #e4dbf7;background:#fff;font:700 14px 'Hanken Grotesk',sans-serif;color:#241f1c">
      ${allTemplates().map((t) => `<option value="${t.id}"${t.id === brief.templateId ? ' selected' : ''}>${t.id} · ${esc(t.name)} · ${t.aspectRatio} · ${esc(t.archetype)}</option>`).join('')}
    </select>
    <div style="margin-top:14px;display:flex;gap:8px">
      <button data-wk="close-edit" style="height:38px;padding:0 16px;border:none;border-radius:11px;cursor:pointer;background:#241d0c;color:#ffdd85;font:800 13.5px 'Hanken Grotesk',sans-serif">Done</button>
    </div>
  </div>`;
}

function importPanel(): string {
  if (!ws.imports.length) return '';
  const s = summarise(ws.imports);
  const row = (c: ImportCandidate): string => {
    const color = c.outcome === 'matched' ? '#0c7a5a' : c.outcome === 'duplicate' ? '#c9436b' : '#8a6d24';
    const bg = c.outcome === 'matched' ? '#e6f9f2' : c.outcome === 'duplicate' ? '#ffe9f3' : '#fff3d6';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:${bg}">
      <span style="font-size:12px;font-weight:800;color:${color};min-width:74px">${c.outcome}</span>
      <span style="flex:1;min-width:0;font-size:13.5px;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.fileName)}</span>
      <span style="font-size:12.5px;color:#6b6156">${esc(c.note)}</span>
    </div>`;
  };
  return `<div style="margin-top:14px;padding:16px;border-radius:18px;background:rgba(255,255,255,.92);box-shadow:0 16px 36px -26px rgba(80,50,120,.55)">
    <div style="font-size:14px;font-weight:800;color:#241f1c">Upload results — ${s.matched} matched${s.duplicate ? `, ${s.duplicate} duplicate` : ''}${s.unmatched ? `, ${s.unmatched} unmatched` : ''}${s.invalid ? `, ${s.invalid} invalid` : ''}</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">${ws.imports.map(row).join('')}</div>
    ${s.matched ? `<button data-wk="commit-import" style="margin-top:12px;height:40px;padding:0 18px;border:none;border-radius:12px;cursor:pointer;background:#0f9c73;color:#fff;font:800 14px 'Hanken Grotesk',sans-serif">Save ${s.matched} creative${s.matched === 1 ? '' : 's'}</button>` : ''}
    <button data-wk="clear-import" style="margin-top:12px;margin-left:8px;height:40px;padding:0 16px;border:none;border-radius:12px;cursor:pointer;background:#f1eee8;color:#6b6156;font:800 14px 'Hanken Grotesk',sans-serif">Clear</button>
  </div>`;
}

export function weekView(): string {
  if (ws.loading) {
    return `<div style="flex:1;display:grid;place-items:center;color:#6b6156;font-size:16px">Loading your inventory…</div>`;
  }

  if (!ws.plan || !ws.plan.days.length) {
    return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:6px 32px 40px">
      <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">This week is not prepared yet</h1>
      <p style="margin:8px 0 0;font-size:18px;color:#5f5648;max-width:640px">MAPCO will choose the properties, photos, templates and facts for all 28 creatives, then build ChatGPT-ready packs you can download one day at a time.</p>
      ${ws.error ? `<div role="alert" style="margin-top:16px;padding:14px 18px;border-radius:14px;background:#ffe1e6;color:#9f2446;font-size:15px">${esc(ws.error)}</div>` : ''}
      ${ws.plan?.notes.length ? `<div style="margin-top:16px;padding:14px 18px;border-radius:14px;background:#fff3d6;color:#8a6d24;font-size:14.5px;line-height:1.5">${ws.plan.notes.map(esc).join('<br>')}</div>` : ''}
      <button data-wk="generate" style="margin-top:20px;height:52px;padding:0 24px;border:none;border-radius:15px;cursor:pointer;background:#241d0c;color:#ffdd85;font:800 17px 'Hanken Grotesk',sans-serif">${ws.busy || 'Prepare this week'}</button>
    </div>`;
  }

  const plan = ws.plan;
  const briefs = allBriefs(plan);
  const day = plan.days[ws.openDay] ?? plan.days[0]!;
  const counts = {
    ready: briefs.filter((b) => b.status === 'ready_for_chatgpt').length,
    generated: briefs.filter((b) => b.status === 'generated').length,
    review: briefs.filter((b) => b.status === 'needs_review').length,
    approved: briefs.filter((b) => b.status === 'approved').length,
    skipped: briefs.filter((b) => b.status === 'skipped').length,
  };
  const chip = (label: string, n: number, bg: string, fg: string): string =>
    `<span style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:11px;background:${bg};color:${fg};font-size:13.5px;font-weight:800">${label}<span style="font-variant-numeric:tabular-nums">${n}</span></span>`;

  return `<div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:6px 32px 40px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">This Week — ${briefs.length} planned creatives</h1>
        <p style="margin:6px 0 0;font-size:16.5px;color:#5f5648">Week ${esc(plan.weekId)} · from ${esc(plan.weekStart)} · revision ${plan.revision}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-wk="download-week" style="height:44px;padding:0 18px;border:none;border-radius:13px;cursor:pointer;background:#241d0c;color:#ffdd85;font:800 14.5px 'Hanken Grotesk',sans-serif">Download full week</button>
        <button data-wk="rebuild" style="height:44px;padding:0 16px;border:none;border-radius:13px;cursor:pointer;background:#f1eee8;color:#5f5648;font:800 14.5px 'Hanken Grotesk',sans-serif">Rebuild week</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      ${chip('Ready for ChatGPT', counts.ready, '#fff3d6', '#8a6d24')}
      ${chip('Generated', counts.generated, '#e7f0ff', '#2b6fd6')}
      ${chip('Needs review', counts.review, '#ffe9f3', '#c9436b')}
      ${chip('Approved', counts.approved, '#e6f9f2', '#0c7a5a')}
      ${chip('Skipped', counts.skipped, '#f1eee8', '#8a8070')}
    </div>

    ${plan.notes.length ? `<div style="margin-top:14px;padding:13px 16px;border-radius:14px;background:rgba(255,255,255,.72);color:#6b6156;font-size:13.5px;line-height:1.55">${plan.notes.map(esc).join('<br>')}</div>` : ''}

    ${!brand.phone ? `<div style="margin-top:14px;padding:14px 16px;border-radius:14px;background:#fff3d6;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:14px;font-weight:800;color:#8a6d24">No contact number set — creatives will be built without a phone line.</span>
      <input data-wk="phone-input" type="tel" placeholder="+91 98765 43210" value="" style="height:38px;padding:0 12px;border-radius:10px;border:1.5px solid #eadfc6;background:#fff;font:700 14px 'Hanken Grotesk',sans-serif;color:#241f1c">
      <button data-wk="save-phone" style="height:38px;padding:0 16px;border:none;border-radius:10px;cursor:pointer;background:#241d0c;color:#ffdd85;font:800 13.5px 'Hanken Grotesk',sans-serif">Save</button>
    </div>` : ''}

    <div data-scroll style="display:flex;gap:10px;margin-top:20px;overflow-x:auto;padding-bottom:8px">
      ${plan.days.map((d) => {
        const on = d.dayIndex === ws.openDay;
        return `<button data-wk="day" data-day="${d.dayIndex}" style="flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 18px;border:none;border-radius:16px;cursor:pointer;${on ? 'background:#ffc93c;color:#241f1c;box-shadow:0 14px 28px -14px rgba(190,140,20,.95)' : 'background:#fff;color:#5f5648;box-shadow:inset 0 0 0 1px #f0e4cc'}">
          <span style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.75">${esc(d.weekday.slice(0, 3))}</span>
          <span style="font-family:'Newsreader',serif;font-size:20px;font-weight:800">${esc(d.localDate.slice(8))}</span>
          <span style="font-size:12px;font-weight:800">${d.briefs.length}</span>
        </button>`;
      }).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px">
      <div style="font-size:19px;font-weight:800;color:#241f1c;flex:1;min-width:200px">${esc(day.weekday)} ${esc(day.localDate)}</div>
      <button data-wk="copy-prompt" style="height:42px;padding:0 16px;border:none;border-radius:12px;cursor:pointer;background:#5b32c4;color:#fff;font:800 14px 'Hanken Grotesk',sans-serif">Copy daily ChatGPT prompt</button>
      <button data-wk="download-day" style="height:42px;padding:0 16px;border:none;border-radius:12px;cursor:pointer;background:#0f9c73;color:#fff;font:800 14px 'Hanken Grotesk',sans-serif">${ws.busy || `Download ${day.weekday} pack`}</button>
      <label style="height:42px;display:inline-flex;align-items:center;gap:8px;padding:0 16px;border-radius:12px;cursor:pointer;background:#fff3d6;color:#8a6d24;font:800 14px 'Hanken Grotesk',sans-serif">
        Upload results
        <input data-wk="upload" type="file" accept="image/png,image/jpeg,image/webp" multiple style="display:none">
      </label>
    </div>

    ${importPanel()}

    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      ${day.briefs.map((b) => `${briefRow(b)}${ws.editing === b.id ? editPanel(b) : ''}`).join('')}
    </div>
  </div>`;
}

/* ── event wiring ────────────────────────────────────────────── */

export function wireWeek(root: HTMLElement, rerender: () => void): void {
  host = root;

  root.addEventListener('change', async (event) => {
    const target = event.target as HTMLElement;
    const act = target.getAttribute('data-wk');

    if (act === 'upload') {
      const files = Array.from((target as HTMLInputElement).files ?? []);
      if (!files.length || !ws.plan) return;
      ws.imports = await matchFiles(files, {
        briefs: allBriefs(ws.plan),
        alreadyUploaded: Object.keys(ws.results),
      });
      rerender();
      return;
    }

    if (act === 'set-template') {
      const id = target.getAttribute('data-id')!;
      const brief = findBrief(id);
      const templateId = (target as HTMLSelectElement).value;
      const template = getTemplate(templateId);
      if (!brief || !template) return;
      await updateBrief({ ...brief, templateId: template.id, templateVersion: template.version }, rerender);
    }
  });

  root.addEventListener('click', async (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-wk]');
    if (!el) return;
    const act = el.getAttribute('data-wk');
    const id = el.getAttribute('data-id');

    switch (act) {
      case 'generate': await generateWeek(rerender); break;
      case 'rebuild': await generateWeek(rerender, true); break;
      case 'day': ws.openDay = Number(el.getAttribute('data-day')) || 0; ws.editing = null; rerender(); break;
      case 'edit': ws.editing = ws.editing === id ? null : id; rerender(); break;
      case 'close-edit': ws.editing = null; rerender(); break;

      case 'skip': {
        const brief = findBrief(id!);
        if (!brief) return;
        await updateBrief(
          { ...brief, status: brief.status === 'skipped' ? 'ready_for_chatgpt' : 'skipped' },
          rerender);
        break;
      }

      case 'approve': {
        const brief = findBrief(id!);
        if (!brief) return;
        await updateBrief({ ...brief, status: 'approved' }, rerender);
        toast(`${brief.id} approved`);
        break;
      }

      case 'set-hero': {
        const brief = findBrief(id!);
        const photoId = el.getAttribute('data-photo');
        if (!brief) return;
        const pool = [brief.heroPhoto, ...brief.secondaryPhotos];
        const next = pool.find((p) => p.id === photoId);
        if (!next || next.id === brief.heroPhoto.id) return;
        const rest = pool.filter((p) => p.id !== next.id);
        await updateBrief({ ...brief, heroPhoto: next, secondaryPhotos: rest.slice(0, 2) }, rerender);
        break;
      }

      case 'copy-prompt': {
        if (!ws.plan) return;
        const day = ws.plan.days[ws.openDay]!;
        await copyText(buildDailyPrompt(day, ws.plan.weekId), `${day.weekday} prompt`);
        break;
      }

      case 'brief-prompt': {
        const brief = findBrief(id!);
        if (!brief) return;
        await copyText(buildRegenerationPrompt(brief), `${brief.id} regenerate prompt`);
        break;
      }

      case 'download-day': {
        if (!ws.plan || ws.busy) return;
        ws.busy = 'Building pack…'; rerender();
        try {
          const { blob, fileName } = await buildDayPack(ws.plan, ws.openDay, (done, total) => {
            ws.busy = total ? `Packing ${done}/${total}…` : 'Packing…';
          });
          downloadBlob(blob, fileName);
          toast(`${fileName} downloaded`);
        } catch {
          ws.error = 'Could not build the pack.';
        }
        ws.busy = ''; rerender();
        break;
      }

      case 'download-week': {
        if (!ws.plan || ws.busy) return;
        ws.busy = 'Building week…'; rerender();
        try {
          const { blob, fileName } = await buildWeekPack(ws.plan);
          downloadBlob(blob, fileName);
          toast(`${fileName} downloaded`);
        } catch {
          ws.error = 'Could not build the week pack.';
        }
        ws.busy = ''; rerender();
        break;
      }

      case 'commit-import': {
        const matched = ws.imports.filter((c) => c.outcome === 'matched' && c.file);
        for (const candidate of matched) {
          const dataUrl = await fileToDataUrl(candidate.file!);
          await localPlanStore.saveResult(dealerId, {
            creativeId: candidate.creativeId!,
            fileName: candidate.fileName,
            mime: candidate.file!.type,
            bytes: candidate.file!.size,
            width: candidate.width,
            height: candidate.height,
            dataUrl,
            uploadedAt: new Date().toISOString(),
          });
          ws.results[candidate.creativeId!] = dataUrl;
          const brief = findBrief(candidate.creativeId!);
          if (brief && ws.plan) {
            await localPlanStore.updateBrief(dealerId, ws.plan.weekId, {
              ...brief, status: 'needs_review', resultAssetId: candidate.creativeId!,
            });
          }
        }
        if (ws.plan) ws.plan = await localPlanStore.getPlan(dealerId, ws.plan.weekId);
        ws.imports = [];
        toast(`${matched.length} creative${matched.length === 1 ? '' : 's'} saved`);
        rerender();
        break;
      }

      case 'save-phone': {
        const input = root.querySelector<HTMLInputElement>('[data-wk="phone-input"]');
        const phone = input?.value.trim();
        if (!phone) { toast('Enter a contact number first'); break; }
        writeBrandContact(phone);
        brand = { ...brand, phone, whatsapp: phone };
        // Existing briefs carry a snapshot of the brand — refresh them.
        if (ws.plan) {
          for (const b of allBriefs(ws.plan)) {
            await localPlanStore.updateBrief(dealerId, ws.plan.weekId, { ...b, brand });
          }
          ws.plan = await localPlanStore.getPlan(dealerId, ws.plan.weekId);
        }
        toast('Contact number saved');
        rerender();
        break;
      }

      case 'clear-import': ws.imports = []; rerender(); break;
    }
  });
}

export const hasWeekPlan = (): boolean => !!ws.plan?.days.length;
export const weekBriefCount = (): number => (ws.plan ? allBriefs(ws.plan).length : 0);
