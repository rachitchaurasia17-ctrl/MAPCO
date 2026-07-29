import { adapter } from '../../../packages/data/mock-adapter-v2';
import { getInitials } from '../../../packages/auth/auth';
import type { Client } from '../../../packages/data/types';

function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function shell(inner: string): string {
  return `
<div style="padding:40px;max-width:1200px;margin:0 auto">
  <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px">
    <div>
      <h1 style="font-size:32px;font-weight:800;letter-spacing:-.02em;color:#1f1a12;margin-bottom:6px">My Customers</h1>
      <p style="font-size:16px;color:#6b6156;font-weight:500">Everyone you're talking to and what they're looking for.</p>
    </div>
    <button style="display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;background:#6533d1;color:#fff;font-size:14.5px;font-weight:700;box-shadow:0 4px 12px rgba(101,51,209,.3);border:none;cursor:pointer"><i class="ph-bold ph-plus" style="font-size:16px"></i>New Customer</button>
  </div>
  ${inner}
</div>`;
}

function loadingBlock(): string {
  return `<div style="margin-top:40px;text-align:center;color:#8d8271">Loading customers...</div>`;
}

function errorBlock(msg: string): string {
  return `<div style="margin-top:40px;padding:30px;background:#fff3f3;border:1px solid #fecaca;border-radius:16px;color:#b91c1c;text-align:center">${esc(msg)}</div>`;
}

export async function renderCustomers(el: HTMLElement): Promise<void> {
  const controller = new AbortController();

  async function load(): Promise<void> {
    el.innerHTML = shell(loadingBlock());

    const clientsRes = await adapter.customers.list({ limit: 100 }, { signal: controller.signal });

    if (!clientsRes.ok) {
      if (clientsRes.ok === false && clientsRes.error.code === 'aborted') return;
      el.innerHTML = shell(errorBlock('Could not load customers.'));
      return;
    }

    const clients = clientsRes.value.items;

    el.innerHTML = shell(`
      <div style="display:flex;flex-direction:column;gap:12px">
        ${clients.map(c => {
          const wantsParts = c.want.split('·').map(s => s.trim()).filter(s => s);
          // Hardcoding the tag colors from the spec, cycling through 3 styles
          const tagStyles = [
            'background:#f3eeff;color:#6b3fd4',
            'background:#fff4e5;color:#c97312',
            'background:#eef4ff;color:#1a56c4'
          ];
          
          return `
        <div style="background:#fff;border-radius:16px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08);display:flex;align-items:center;gap:24px">
          <div style="width:48px;height:48px;border-radius:14px;background:#efe8fb;color:#5b32c4;display:grid;place-items:center;font-weight:800;font-size:17px;flex:none">${getInitials(c.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:17px;color:#1f1a12;margin-bottom:2px">${esc(c.name)}</div>
            <div style="font-size:14px;color:#6b6156;font-weight:600"><i class="ph-fill ph-phone" style="vertical-align:-2px"></i> ${esc(c.phone || '+91 98765 43210')}</div>
          </div>
          <div style="flex:2;min-width:0;display:flex;flex-direction:column;gap:6px">
            <div style="font-size:13px;font-weight:700;color:#9a8f7c">Looking for</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${wantsParts.length > 0 ? wantsParts.map((w, i) => `<span style="${tagStyles[i % tagStyles.length]};padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700">${esc(w)}</span>`).join('') : `<span style="${tagStyles[0]};padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700">Residential</span>`}
            </div>
          </div>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
            <div style="font-size:13px;font-weight:700;color:#9a8f7c">Budget</div>
            <div style="font-weight:800;font-size:16px;color:#1f1a12">${esc(c.budget)}</div>
          </div>
          <button style="width:40px;height:40px;border-radius:12px;background:#f8f6fc;color:#6b6156;display:grid;place-items:center;border:none;flex:none;cursor:pointer"><i class="ph-bold ph-caret-right" style="font-size:18px"></i></button>
        </div>`;
        }).join('')}
      </div>
    `);
  }

  const cleanup = () => { controller.abort(); };
  window.addEventListener('pagehide', cleanup, { once: true });

  await load();
}
