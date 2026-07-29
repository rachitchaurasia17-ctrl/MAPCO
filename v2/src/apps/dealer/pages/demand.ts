/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: Demand
   ---------------------------------------------------------------
   Consumes the hardened DataAdapterV2 DemandRepository (NOT the
   legacy getClients()). Renders typed loading/empty/error states,
   deterministic matches (with a no-match state), and binds all
   interactions through delegated listeners with cleanup.
   ═══════════════════════════════════════════════════════════════ */
import './demand.css';
import { adapter } from '../../../packages/data/mock-adapter-v2';
import { getInitials } from '../../../packages/auth/auth';
import { formatINR } from '../../../packages/ui/utils';
import type { DemandRecord, DemandMatch } from '../../../packages/data/contracts';

const PAGE_LIMIT = 24; // documented cap; within repo MAX_LIMIT ceiling

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function shell(inner: string): string {
  return `
<div class="pm-dem">
  <div class="pm-dem-head">
    <div>
      <h1 class="pm-dem-title">Demand Pipeline</h1>
      <p class="pm-dem-sub">Active buyer requirements matched against your plots.</p>
    </div>
    <button class="pm-dem-add" type="button" data-act="add"><i class="ph-bold ph-plus" aria-hidden="true"></i>Log Demand</button>
  </div>
  ${inner}
</div>`;
}

function stateBlock(icon: string, msg: string, opts: { error?: boolean; retry?: boolean } = {}): string {
  return `
<div class="pm-dem-state ${opts.error ? 'pm-dem-state--error' : ''}" role="status" aria-live="polite">
  <i class="${icon} pm-dem-state-icon" aria-hidden="true"></i>
  <div>${esc(msg)}</div>
  ${opts.retry ? `<button class="pm-dem-retry" type="button" data-act="retry">Try again</button>` : ''}
</div>`;
}

function loadingBlock(): string {
  return `<div class="pm-dem-grid" aria-busy="true">${'<div class="pm-dem-skeleton"></div>'.repeat(4)}</div>`;
}

const URGENCY_LABEL: Record<DemandRecord['urgency'], string> = {
  immediate: 'Immediate', 'this-quarter': 'This quarter', exploring: 'Exploring',
};

function card(d: DemandRecord): string {
  const budget = `${formatINR(d.budgetMin)} – ${formatINR(d.budgetMax)}`;
  return `
<div class="pm-dem-card" data-id="${esc(d.id)}">
  <div class="pm-dem-card-top">
    <div class="pm-dem-avatar"><i class="ph-fill ph-list-magnifying-glass" style="font-size:24px" aria-hidden="true"></i></div>
    <div style="flex:1;min-width:0">
      <div class="pm-dem-card-type">${esc(d.propertyType)}</div>
      <div class="pm-dem-card-cust">${esc(getInitials(d.customerName))} · ${esc(d.customerName)} · ${esc(d.preferredLocations.join(', '))}</div>
    </div>
  </div>
  <div class="pm-dem-tags">
    <span class="pm-dem-tag">${esc(d.category)}</span>
    <span class="pm-dem-tag pm-dem-tag--budget">${budget}</span>
    ${d.urgency === 'immediate'
      ? `<span class="pm-dem-tag pm-dem-tag--urgent">${URGENCY_LABEL[d.urgency]}</span>`
      : `<span class="pm-dem-tag">${URGENCY_LABEL[d.urgency]}</span>`}
  </div>
  <div class="pm-dem-meta">
    <span>Follow-up: <strong>${esc(d.followUp)}</strong></span>
    <span class="pm-dem-status">${esc(d.status)}</span>
  </div>
  <button class="pm-dem-match-btn" type="button" data-act="match" data-id="${esc(d.id)}" aria-expanded="false">
    <i class="ph-bold ph-magic-wand" aria-hidden="true"></i>View matching plots
  </button>
  <div class="pm-dem-matches" data-matches="${esc(d.id)}" hidden></div>
</div>`;
}

function renderMatches(host: HTMLElement, matches: DemandMatch[]): void {
  if (matches.length === 0) {
    host.innerHTML = `<div class="pm-dem-nomatch">No matching plots yet — try widening the budget or locations.</div>`;
    return;
  }
  host.innerHTML = matches.slice(0, 5).map((m) => `
    <div class="pm-dem-match">
      <span class="pm-dem-match-score">${Math.round(m.score * 100)}%</span>
      <div class="pm-dem-match-name">${esc(m.property.area)} · ${esc(m.property.size)}</div>
      <div class="pm-dem-match-why">${esc(m.reasons.join(' · '))}</div>
    </div>`).join('');
}

export async function renderDemand(el: HTMLElement): Promise<void> {
  const controller = new AbortController();

  // Single delegated click handler for the whole feature (no inline handlers,
  // no global pollution). Cleaned up on navigation.
  const onClick = async (ev: Event) => {
    const target = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!target) return;
    const act = target.dataset.act;
    if (act === 'retry') { void load(); return; }
    if (act === 'add') { return; /* create/edit drawer wiring lands with backend Pass 2 */ }
    if (act === 'match') {
      const id = target.dataset.id!;
      const host = el.querySelector<HTMLElement>(`[data-matches="${CSS.escape(id)}"]`);
      if (!host) return;
      const expanded = target.getAttribute('aria-expanded') === 'true';
      if (expanded) { host.hidden = true; target.setAttribute('aria-expanded', 'false'); return; }
      target.setAttribute('aria-expanded', 'true');
      host.hidden = false;
      host.innerHTML = `<div class="pm-dem-nomatch">Finding matches…</div>`;
      const res = await adapter.demand.match(id, { signal: controller.signal });
      if (res.ok) renderMatches(host, res.value);
      else host.innerHTML = `<div class="pm-dem-nomatch">Could not load matches.</div>`;
    }
  };

  async function load(): Promise<void> {
    el.innerHTML = shell(loadingBlock());
    const res = await adapter.demand.list({ limit: PAGE_LIMIT }, { signal: controller.signal });
    if (!res.ok) {
      if (res.error.code === 'aborted') return;
      el.innerHTML = shell(stateBlock('ph-fill ph-warning-circle', 'Could not load demand records.', { error: true, retry: true }));
      return;
    }
    const items = res.value.items;
    if (items.length === 0) {
      el.innerHTML = shell(stateBlock('ph-fill ph-tray', 'No demand logged yet. Capture a buyer requirement to get started.'));
      return;
    }
    const open = items.filter((d) => d.status === 'open').length;
    el.innerHTML = shell(`
      <div class="pm-dem-stats">
        <div class="pm-dem-stat pm-dem-stat--total"><div class="pm-dem-stat-label">Total demands</div><div class="pm-dem-stat-num">${items.length}</div></div>
        <div class="pm-dem-stat pm-dem-stat--open"><div class="pm-dem-stat-label">Open</div><div class="pm-dem-stat-num">${open}</div></div>
      </div>
      <div class="pm-dem-grid">${items.map(card).join('')}</div>`);
  }

  el.addEventListener('click', onClick);
  // Cleanup: drop the listener and cancel in-flight requests on page hide.
  const cleanup = () => { el.removeEventListener('click', onClick); controller.abort(); };
  window.addEventListener('pagehide', cleanup, { once: true });

  await load();
}
