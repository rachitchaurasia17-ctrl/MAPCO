/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Operations console
   ---------------------------------------------------------------
   An INTERNAL surface for running the AI foundation: is it on, what
   has it cost, what has it produced, what is it waiting for, and what
   exactly does MAPCO send to a provider.

   Deliberately NOT a dealer product surface:
     • not in the dealer navigation, reachable only by direct URL;
     • shows the signed-in dealer's own data, under the same RLS as
       every other MAPCO read;
     • renders stored artifacts as raw JSON, so it displays what was
       actually generated rather than a designed interpretation of it.

   It invents nothing. With AI off — the default for every dealer —
   it says so and shows empty sections.
   ═══════════════════════════════════════════════════════════════ */

import { adapter } from '../../packages/data/adapter';
import { requireSession } from '../../packages/data/session';
import { formatMicroUsd, type AiArtifactKind, type AiStatus } from '../../packages/ai';

const ARTIFACT_KINDS: readonly AiArtifactKind[] = [
  'intelligence_snapshot', 'signal_set', 'weekly_report', 'marketing_suggestion',
];

const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

const card = (title: string, body: string, note = ''): string => `
  <section style="background:#fffaf0;border:1px solid #ecdca6;border-radius:20px;padding:22px 24px;margin-bottom:16px">
    <h2 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:22px;color:#241f1c">${esc(title)}</h2>
    ${note ? `<p style="margin:5px 0 0;font-size:13.5px;color:#8d8271">${esc(note)}</p>` : ''}
    <div style="margin-top:14px">${body}</div>
  </section>`;

const empty = (message: string): string =>
  `<p style="margin:0;font-size:14.5px;color:#8d8271">${esc(message)}</p>`;

const pill = (label: string, on: boolean): string =>
  `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:800;background:${on ? '#c9f0d9' : '#f0eaff'};color:${on ? '#0b8f45' : '#6b6156'}">${esc(label)}</span>`;

const table = (headers: readonly string[], rows: readonly (readonly string[])[]): string => {
  if (!rows.length) return empty('Nothing recorded yet.');
  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px">
    <thead><tr>${headers.map((h) => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #ecdca6;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8d8271;white-space:nowrap">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:8px 10px;border-bottom:1px solid #f4ead2;color:#3d372f;white-space:nowrap">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
};

const jsonBlock = (value: unknown): string =>
  `<pre style="margin:0;max-height:340px;overflow:auto;background:#241d0c;color:#f4e5c4;border-radius:14px;padding:16px;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word">${esc(JSON.stringify(value, null, 2))}</pre>`;

function statusCard(status: AiStatus): string {
  const features = Object.keys(status.features);
  const quota = status.quota;
  return card('Status', `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      ${pill(status.enabled ? 'AI enabled' : 'AI disabled', status.enabled)}
      ${features.length ? features.map((f) => pill(f, true)).join('') : pill('no capabilities on', false)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px">
      ${[
        ['Jobs pending', String(status.pendingJobs)],
        ['Jobs failed (7d)', String(status.failedJobs)],
        ['Spend today', quota ? formatMicroUsd(quota.dayCostMicroUsd) : '—'],
        ['Daily limit', quota ? formatMicroUsd(quota.dailyCostLimitMicroUsd) : '—'],
        ['Spend this month', quota ? formatMicroUsd(quota.monthCostMicroUsd) : '—'],
        ['Runs today', quota ? `${quota.dayExecutions} / ${quota.dailyExecutionLimit}` : '—'],
      ].map(([label, value]) => `
        <div style="background:#fff3d1;border-radius:14px;padding:12px 14px">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a14">${esc(label)}</div>
          <div style="font-family:'Newsreader',serif;font-size:26px;line-height:1.1;color:#241d0c;margin-top:4px">${esc(value)}</div>
        </div>`).join('')}
    </div>
    ${quota && !quota.allowed ? `<p style="margin:14px 0 0;padding:10px 14px;border-radius:12px;background:#ffe1e6;color:#9f2446;font-size:14px;font-weight:700">New AI work is blocked: ${quota.suspended ? 'this dealer is suspended' : 'a quota limit has been reached'}.</p>` : ''}
  `, 'AI is off for every dealer until a platform operator switches it on.');
}

async function render(host: HTMLElement): Promise<void> {
  host.innerHTML = `<div role="status" style="max-width:1000px;margin:0 auto;padding:48px 32px;color:#6b6156">Loading AI operations…</div>`;

  // Each read is independent and already fail-soft, so one unavailable
  // section never blanks the console.
  const [status, usage, actions, history] = await Promise.all([
    adapter.ai.status(),
    adapter.ai.usage(30),
    adapter.ai.pendingActions(),
    Promise.all(ARTIFACT_KINDS.map(async (kind) => ({ kind, result: await adapter.ai.history(kind, 10) }))),
  ]);

  const statusValue: AiStatus = status.ok
    ? status.value
    : { enabled: false, features: {}, pendingJobs: 0, failedJobs: 0, quota: null };

  const usageRows = usage.ok ? usage.value : [];
  const actionRows = actions.ok ? actions.value : [];

  const historyRows = history.flatMap(({ kind, result }) =>
    (result.ok ? result.value : []).map((item) => [
      esc(kind), esc(item.periodKey), `v${item.version}`, esc(item.status),
      esc(item.provider ?? '—'), esc(item.model ?? '—'),
      esc(item.generatedAt ? new Date(item.generatedAt).toLocaleString('en-IN') : '—'),
    ]));

  host.innerHTML = `
<div style="min-height:100vh;background:#e7ddfb;background-image:radial-gradient(64% 52% at -2% -4%,rgba(123,78,224,.5),transparent 64%),radial-gradient(72% 62% at 100% 100%,rgba(255,201,60,.3),transparent 64%);font-family:'Hanken Grotesk',system-ui,sans-serif">
  <div style="max-width:1000px;margin:0 auto;padding:34px 32px 70px">
    <header style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:22px">
      <a href="/admin/owner.html" style="display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 13px;border-radius:11px;background:#fffaf0;color:#4b2ea6;font-size:14px;font-weight:800;text-decoration:none;border:1px solid #ddd2f5"><i class="ph-bold ph-arrow-left"></i>Dealer app</a>
      <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:32px;letter-spacing:-.02em;color:#241f1c">MAPCO AI Operations</h1>
      <span style="font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;background:#efe8fb;color:#5b32c4">Internal</span>
    </header>

    ${statusCard(statusValue)}

    ${card('Cost and usage · last 30 days', table(
      ['Day', 'Task', 'Provider', 'Model', 'Runs', 'Failed', 'In', 'Out', 'Cost'],
      usageRows.map((row) => [
        esc(row.day), esc(row.task), esc(row.provider), esc(row.model),
        String(row.executions), String(row.failures),
        String(row.inputTokens), String(row.outputTokens),
        esc(formatMicroUsd(row.costMicroUsd)),
      ]),
    ), 'Recorded per provider call, including failed calls that still consumed tokens.')}

    ${card('Stored artifacts', table(
      ['Kind', 'Period', 'Version', 'Status', 'Provider', 'Model', 'Generated'],
      historyRows,
    ), 'Generated once and stored. Regenerating creates a new version and supersedes the previous one.')}

    ${card('Action queue', actionRows.length ? `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${actionRows.map((action) => `
          <div style="border:1px solid #ecdca6;border-radius:14px;padding:14px 16px;background:#fff">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <strong style="font-size:15px;color:#241f1c">${esc(action.title)}</strong>
              ${pill(action.risk, action.risk === 'internal')}
              ${pill(action.status, action.status === 'approved')}
            </div>
            <div style="font-size:13px;color:#6b6156;margin-top:5px">${esc(action.actionType)}${action.rationale ? ` · ${esc(action.rationale)}` : ''}</div>
            ${action.status === 'proposed' ? `
              <div style="display:flex;gap:8px;margin-top:10px">
                <button data-ai-decide="approve" data-ai-id="${esc(action.id)}" style="padding:8px 16px;border-radius:10px;background:#c9f0d9;color:#0b8f45;font-weight:800;font-size:13.5px">Approve</button>
                <button data-ai-decide="reject" data-ai-id="${esc(action.id)}" style="padding:8px 16px;border-radius:10px;background:#ffe1e6;color:#9f2446;font-weight:800;font-size:13.5px">Reject</button>
              </div>` : ''}
          </div>`).join('')}
      </div>` : empty('No action proposals.'),
      'Approving queues the action for MAPCO to execute. Nothing external happens without approval.')}

    ${card('Context inspector', `
      <p style="margin:0 0 12px;font-size:14px;color:#6b6156">The exact deterministic facts MAPCO would send. Calculated by the database, never by a model, and containing no customer, owner or seller data.</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="font-size:13px;font-weight:700;color:#6b6156">Window
          <select id="ai-window" style="margin-left:8px;padding:7px 10px;border-radius:10px;border:1px solid #ddd2f5;font:inherit;font-size:13.5px">
            <option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option>
          </select>
        </label>
        <button id="ai-facts" style="padding:9px 18px;border-radius:11px;background:#ffc93c;color:#241d0c;font-weight:800;font-size:13.5px">Build facts</button>
      </div>
      <div id="ai-facts-out" style="margin-top:14px"></div>
    `)}
  </div>
</div>`;

  host.querySelector<HTMLButtonElement>('#ai-facts')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const out = host.querySelector<HTMLElement>('#ai-facts-out')!;
    const days = Number(host.querySelector<HTMLSelectElement>('#ai-window')?.value ?? 7);
    button.disabled = true;
    out.innerHTML = '<p style="margin:0;color:#6b6156;font-size:14px">Building…</p>';
    const facts = await adapter.ai.contextFacts(days);
    out.innerHTML = facts.ok
      ? jsonBlock(facts.value)
      : `<p style="margin:0;padding:10px 14px;border-radius:12px;background:#ffe1e6;color:#9f2446;font-size:14px">${esc(facts.error.message)}</p>`;
    button.disabled = false;
  });

  host.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-ai-decide]');
    if (!button) return;
    const id = button.dataset.aiId ?? '';
    const decision = button.dataset.aiDecide === 'approve' ? 'approve' : 'reject';
    const result = await adapter.ai.decideAction(id, decision);
    if (result.ok) void render(host);
    else button.textContent = result.error.message;
  });
}

const host = document.getElementById('app')!;
void requireSession(host, () => { void render(host); });
