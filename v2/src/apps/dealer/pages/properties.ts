import { adapter } from '../../../packages/data/mock-adapter-v2';
import { formatINR } from '../../../packages/ui/utils';
import { pageToState, State } from '../../../packages/data/contracts';
import type { Property } from '../../../packages/data/types';

function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function shell(inner: string): string {
  return `
<div style="max-width:1120px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Plots</h1>
      <p style="margin:8px 0 0;font-size:17px;color:#6b6156">Everything you have to sell — and what's ready to show a customer.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85);border:none;cursor:pointer" onmouseenter="this.style.background='#f4ae14'" onmouseleave="this.style.background='#ffc93c'"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a plot</button>
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

  async function load(): Promise<void> {
    el.innerHTML = shell(loadingBlock());
    const res = await adapter.properties.list({ limit: 100 }, { signal: controller.signal });
    if (!res.ok) {
      if (res.error.code === 'aborted') return;
      el.innerHTML = shell(errorBlock('Could not load properties.'));
      return;
    }

    const props = res.value.items;
    const ready = props.filter(p => p.photos && p.photos.length > 0 && !p.sold);
    const needWork = props.filter(p => (!p.photos || p.photos.length === 0) && !p.sold);
    const totalValue = ready.reduce((s, p) => s + (p.price || 0), 0);
    const allCities = [...new Set(props.map(p => p.city))];

    el.innerHTML = shell(`
      <div style="display:flex;align-items:center;gap:14px;margin-top:22px;position:relative;z-index:20">
        <button style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7;box-shadow:0 1px 2px rgba(30,28,22,.03);cursor:pointer">
          <i class="ph-fill ph-map-pin" style="font-size:19px;color:#d95d1e"></i>
          <span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.1"><span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Showing</span><span style="font-size:16.5px;font-weight:800;color:#241f1c">All cities · ${props.filter(p => !p.sold).length} plots</span></span>
          <i class="ph-bold ph-caret-down" style="font-size:15px;color:#8d8271;margin-left:4px"></i>
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
        <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:22px 24px">
          <div style="font-size:14.5px;color:#8a6a14;font-weight:600">Value of stock</div>
          <div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#1f1a12;margin-top:8px">${formatINR(totalValue)}</div>
        </div>
        <div style="background:#ffe6cf;border:1px solid #f8cba6;border-radius:20px;padding:22px 24px">
          <div style="font-size:14.5px;color:#6b6156;font-weight:600">Ready to show</div>
          <div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#d95d1e;margin-top:8px">${ready.length}</div>
        </div>
        <div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:20px;padding:22px 24px">
          <div style="font-size:14.5px;color:#6b6156;font-weight:600">Need a photo</div>
          <div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#b5322a;margin-top:8px">${needWork.length}</div>
        </div>
      </div>

      ${ready.length > 0 ? `<div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:34px 0 14px">Ready to show</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px">
      ${ready.map(p => {
        const pubText = p.published ? 'On presentation' : 'Not published';
        const pubIcon = p.published ? 'ph-fill ph-check-circle' : 'ph-fill ph-eye-slash';
        const pubStyle = p.published
          ? 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#e2f2e6;color:#186c3c'
          : 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#f3eeff;color:#6b3fd4';
        const thumb = p.photos[0] ? p.photos[0] : '/assets/ph-plot-1.png';

        return `
        <div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6);transition:border-color .12s,transform .12s" onmouseenter="this.style.borderColor='#ecd0bf';this.style.transform='translateY(-2px)'" onmouseleave="this.style.borderColor='#e4dbf7';this.style.transform='none'">
          <div style="height:150px;position:relative;background:#e7e0d2">
            <button title="Open this plot" style="position:absolute;inset:0;cursor:pointer;background:none;padding:0;border:none;width:100%"><span style="display:block;width:100%;height:100%;background-image:url('${esc(thumb)}');background-size:cover;background-position:center"></span></button>
            <span style="position:absolute;top:12px;right:12px;font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;background:${p.published ? '#d9f5e3' : '#ffe6cf'};color:${p.published ? '#0b6f39' : '#c2622a'}">${p.published ? 'Published' : 'Draft'}</span>
          </div>
          <div style="padding:18px 20px">
            <div style="font-size:17.5px;font-weight:800;color:#241f1c">${esc(p.area)} · ${esc(p.size)}</div>
            <div style="font-size:14px;color:#6b6156;margin-top:2px">${esc(p.loc)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px">
              <span style="font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 11px">${esc(p.size)}</span>
              <span style="font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 11px"><i class="ph ph-compass" style="font-size:14px;vertical-align:-2px"></i> ${esc(p.facing)}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">
              <span style="${pubStyle}"><i class="${pubIcon}" style="font-size:14px"></i>${pubText}</span>
              ${p.photos.length > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#f7e7c6;color:#8a6a14"><i class="ph-fill ph-images" style="font-size:14px"></i>${p.photos.length}</span>` : ''}
              ${p.views > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#f4ae14;color:#1f1a12"><i class="ph-bold ph-eye" style="font-size:14px"></i>${p.views}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #f6e8c8">
              <button title="Update price" style="display:flex;align-items:center;gap:8px;font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:#c85a1a;cursor:pointer;background:none;border:none;padding:0" onmouseenter="this.style.color='#a3470f'" onmouseleave="this.style.color='#c85a1a'">${formatINR(p.price)}<i class="ph-fill ph-pencil-simple" style="font-size:15px"></i></button>
              <button data-act="menu" data-id="${p.id}" title="More" style="width:36px;height:36px;border-radius:11px;background:#f3eeff;color:#8a7a52;display:grid;place-items:center;cursor:pointer;border:none;padding:0" onmouseenter="this.style.background='#ddd2f5'" onmouseleave="this.style.background='#f3eeff'"><i class="ph-bold ph-dots-three" style="font-size:18px"></i></button>
            </div>
            <div data-menu="${p.id}" hidden style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;padding-top:12px;border-top:1px dashed #eed9a8">
              <button style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#f3eeff;color:#6b3fd4;border:none;cursor:pointer;font-weight:600;font-size:13px"><i class="ph-fill ph-paper-plane-tilt" style="font-size:15px"></i>See its links</button>
              <button style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#f3eeff;color:#6b3fd4;border:none;cursor:pointer;font-weight:600;font-size:13px"><i class="${p.published ? 'ph-fill ph-eye-slash' : 'ph-fill ph-eye'}" style="font-size:15px"></i>${p.published ? 'Take off presentation' : 'Publish to presentation'}</button>
              <button style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#f3eeff;color:#6b3fd4;border:none;cursor:pointer;font-weight:600;font-size:13px"><i class="ph-fill ph-seal-check" style="font-size:15px"></i>Mark sold</button>
              <button style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#f3eeff;color:#6b3fd4;border:none;cursor:pointer;font-weight:600;font-size:13px"><i class="ph-fill ph-pencil-simple" style="font-size:15px"></i>Edit</button>
              <button style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#f3eeff;color:#6b3fd4;border:none;cursor:pointer;font-weight:600;font-size:13px"><i class="ph-fill ph-copy" style="font-size:15px"></i>Duplicate</button>
              <button style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#fdf3ee;color:#b5322a;border:none;cursor:pointer;font-weight:600;font-size:13px"><i class="ph-fill ph-archive" style="font-size:15px"></i>Archive</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
              <button style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#fff3d1;color:#8a6a14;font-size:14.5px;font-weight:800;border:none;cursor:pointer" onmouseenter="this.style.background='#ffe9a8'" onmouseleave="this.style.background='#fff3d1'"><i class="ph-fill ph-map-pin-line" style="font-size:17px"></i>Show on map</button>
              <a href="#/presentation" style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#e2f2e6;color:#186c3c;font-size:14.5px;font-weight:800;text-decoration:none" onmouseenter="this.style.background='#cbe9d4'" onmouseleave="this.style.background='#e2f2e6'"><i class="ph-fill ph-presentation-chart" style="font-size:17px"></i>Presentation</a>
              <button style="grid-column:1 / -1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:12px;background:#ffc93c;color:#241d0c;font-size:15.5px;font-weight:800;box-shadow:0 10px 22px -12px rgba(244,174,20,.9);border:none;cursor:pointer" onmouseenter="this.style.background='#f4ae14'" onmouseleave="this.style.background='#ffc93c'"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>Send private link</button>
            </div>
          </div>
        </div>
        `;
      }).join('')}</div>` : `<div style="padding:30px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No ready-to-show plots yet.</div>`}

      ${needWork.length > 0 ? `
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:34px 0 14px">Need work before you can show them</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${needWork.map(p => `
        <div style="display:flex;align-items:center;gap:16px;padding:18px 22px;border:1px solid #f2ddd2;background:#fdf3ee;border-radius:16px">
          <i class="ph-fill ph-warning-circle" style="font-size:26px;color:#b5322a;flex:none"></i>
          <div style="flex:1;min-width:0"><div style="font-size:16.5px;font-weight:700;color:#2f2a2d">${esc(p.area)} · ${esc(p.loc)}</div><div style="font-size:14px;color:#b5322a;font-weight:600">No photos added yet</div></div>
          <div style="font-family:'Newsreader',serif;font-weight:600;font-size:20px;color:#241f1c;flex:none">${formatINR(p.price)}</div>
        </div>
        `).join('')}
      </div>
      ` : ''}
    `);
  }

  el.addEventListener('click', onClick);
  const cleanup = () => { el.removeEventListener('click', onClick); controller.abort(); };
  window.addEventListener('pagehide', cleanup, { once: true });

  await load();
}
