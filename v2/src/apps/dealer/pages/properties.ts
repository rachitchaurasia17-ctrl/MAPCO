import { adapter } from '../../../packages/data/mock-adapter-v2';
import { formatINR } from '../../../packages/ui/utils';
import { pageToState, State } from '../../../packages/data/contracts';
import type { Property } from '../../../packages/data/types';

function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function shell(inner: string): string {
  return `
<div style="padding:40px;max-width:1200px;margin:0 auto">
  <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px">
    <div>
      <h1 style="font-size:32px;font-weight:800;letter-spacing:-.02em;color:#1f1a12;margin-bottom:6px">My Plots</h1>
      <p style="font-size:16px;color:#6b6156;font-weight:500">Your direct inventory, visible on your map.</p>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="background:#fff;border-radius:12px;padding:6px;display:flex;box-shadow:0 2px 6px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08)">
        <button style="padding:6px 16px;border-radius:8px;background:#efe8fb;color:#5b32c4;font-size:13.5px;font-weight:800;border:none">All Plots (42)</button>
        <button style="padding:6px 16px;border-radius:8px;background:transparent;color:#6b6156;font-size:13.5px;font-weight:700;border:none">Available</button>
        <button style="padding:6px 16px;border-radius:8px;background:transparent;color:#6b6156;font-size:13.5px;font-weight:700;border:none">Sold</button>
      </div>
      <button style="display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;background:#6533d1;color:#fff;font-size:14.5px;font-weight:700;box-shadow:0 4px 12px rgba(101,51,209,.3);border:none;cursor:pointer"><i class="ph-bold ph-plus" style="font-size:16px"></i>Add Plot</button>
    </div>
  </div>
  ${inner}
</div>`;
}

function loadingBlock(): string {
  return `<div style="margin-top:40px;text-align:center;color:#8d8271">Loading plots...</div>`;
}

function errorBlock(msg: string): string {
  return `<div style="margin-top:40px;padding:30px;background:#fff3f3;border:1px solid #fecaca;border-radius:16px;color:#b91c1c;text-align:center">${esc(msg)}</div>`;
}

export async function renderProperties(el: HTMLElement): Promise<void> {
  const controller = new AbortController();

  const onClick = async (ev: Event) => {
    const target = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!target) return;
    const act = target.dataset.act;
    const id = target.dataset.id;
    if (act === 'menu') {
      const menu = el.querySelector(`[data-menu="${id}"]`) as HTMLElement;
      if (menu) menu.hidden = !menu.hidden;
    }
  };

  function propertyCard(p: Property): string {
    const thumb = p.photos && p.photos[0] ? p.photos[0] : '/assets/plot-placeholder.jpg';
    return `
        <div style="background:#fff;border-radius:16px;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08)">
          <div style="height:140px;border-radius:12px;background:#f3eeff url('${esc(thumb)}') center/cover;position:relative;margin-bottom:12px">
            <div style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,.9);backdrop-filter:blur(4px);padding:4px 10px;border-radius:8px;font-size:12px;font-weight:800;color:#189c4d;display:flex;align-items:center;gap:4px">
              <div style="width:6px;height:6px;border-radius:50%;background:#189c4d"></div> Published
            </div>
            <div style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;color:#fff;display:flex;align-items:center;gap:4px">
              <i class="ph-fill ph-image"></i> ${p.photos?.length || 0}
            </div>
          </div>
          <div style="padding:0 8px 8px">
            <div style="font-size:12px;font-weight:800;color:#5b32c4;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${esc(p.city)}</div>
            <div style="font-weight:800;font-size:17px;color:#1f1a12;margin-bottom:6px">${esc(p.size)} · ${esc(p.facing)} Facing</div>
            <div style="font-size:14px;color:#6b6156;font-weight:600;margin-bottom:12px">${esc(p.loc)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px dashed #e8e3f2">
              <div style="font-size:16px;font-weight:800;color:#1f1a12">${formatINR(p.price)}</div>
              <div style="font-size:13px;font-weight:700;color:#c97312;background:#fff4e5;padding:4px 10px;border-radius:6px">₹2L Comm</div>
            </div>
          </div>
        </div>`;
  }

  async function load(): Promise<void> {
    el.innerHTML = shell(loadingBlock());
    const res = await adapter.properties.list({ limit: 100 }, { signal: controller.signal });
    if (!res.ok) {
      if (res.error.code === 'aborted') return;
      el.innerHTML = shell(errorBlock('Could not load properties.'));
      return;
    }

    const props = res.value.items;
    el.innerHTML = shell(`
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:20px">
        ${props.map(propertyCard).join('')}
      </div>
    `);
  }

  el.addEventListener('click', onClick);
  const cleanup = () => { el.removeEventListener('click', onClick); controller.abort(); };
  window.addEventListener('pagehide', cleanup, { once: true });

  await load();
}
