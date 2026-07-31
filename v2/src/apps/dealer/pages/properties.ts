import { adapter } from "../../../packages/data/mock-adapter-v2";
import { formatINR } from "../../../packages/ui/utils";
import type {
  ClientLink,
  Facing,
  Property,
  PropertyType,
  WantType,
} from "../../../packages/data/types";
import { mountMapEngine, getMaps, addPropertyToMap, type MountedMap } from "../../../packages/maps";

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const iconFor = (type: PropertyType) =>
  type === "Flat"
    ? "ph-fill ph-buildings"
    : type === "Kothi"
      ? "ph-fill ph-house-line"
      : type === "Villa"
        ? "ph-fill ph-house"
        : type === "Commercial"
          ? "ph-fill ph-storefront"
          : "ph-fill ph-map-pin-area";

export async function renderProperties(el: HTMLElement): Promise<void> {
  let properties: Property[] = [];
  let links: ClientLink[] = [];
  let city = new URLSearchParams(location.search).get("city") || "all";
  let cityOpen = false;
  let selectedId = new URLSearchParams(location.search).get("property");
  let menuId: string | null = null;
  let addOpen = false;
  let addStep = 1;
  let activeMap: MountedMap | null = null;
  let selectedMapPin: { mapId: string, x: number, y: number } | null = null;
  let addForm = {
    title: "Eco City plot",
    city: "New Chandigarh",
    area: "Eco City",
    size: "500 sq yd",
    facing: "North-East",
    position: "Park facing",
    sector: "Eco City",
    type: "Residential Plot" as PropertyType,
    status: "Available",
    possession: "Ready to build",
    description:
      "Premium 500 sq yd park facing plot in Eco City, New Chandigarh. North-East facing with excellent connectivity to major landmarks. Ideal for luxury living or smart investment.",
  };
  let deleteArmed = false;

  const result = await adapter.properties.list({ limit: 100 });
  if (!result.ok) {
    el.innerHTML =
      '<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Plots could not be loaded.</div>';
    return;
  }
  properties = [...result.value.items];
  const linkResult = await adapter.clientLinks.list({ limit: 100 });
  if (linkResult.ok) links = [...linkResult.value.items];

  const renderCard = (property: Property) => {
    const shares = links.filter(
      (link) => link.status === "active" && link.props.includes(property.id),
    ).length;
    const hasPhoto = Boolean(property.photos[0]);
    return `<article style="min-width:0;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6);position:relative">
      <div style="height:150px;position:relative;background:#e7e0d2">
        <button data-act="detail" data-id="${esc(property.id)}" title="Open this plot" style="position:absolute;inset:0;width:100%;cursor:pointer;background:${hasPhoto ? `url('${esc(property.photos[0]!)}') center/cover` : "#efe8fb"};padding:0;text-align:left">
          ${!hasPhoto ? `<span style="position:absolute;inset:0;display:grid;place-items:center;color:#8a7a52"><span style="text-align:center"><i class="${iconFor(property.type)}" style="font-size:32px"></i><span style="display:block;margin-top:6px;font-size:12px;font-weight:800">Add photos</span></span></span>` : ""}
        </button>
        <span style="position:absolute;top:12px;right:12px;display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;background:${hasPhoto ? "#ffe6cf" : "#ffe1e6"};color:${hasPhoto ? "#d95d1e" : "#b5322a"};font-size:11.5px;font-weight:800">${hasPhoto ? "Available" : "Needs photo"}</span>
      </div>
      <div style="padding:18px 20px">
        <div style="font-size:17.5px;font-weight:800;color:#241f1c">${esc(property.type)}</div>
        <div style="font-size:14px;color:#6b6156;margin-top:2px">${esc(property.loc)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px">
          <span style="font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 11px">${esc(property.size)}</span>
          <span style="font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 11px"><i class="ph ph-compass" style="font-size:14px;vertical-align:-2px"></i> ${esc(property.facing)}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:${property.published ? "#d9f5e3" : "#f3eeff"};color:${property.published ? "#0b6f39" : "#8a7a52"}"><i class="ph-fill ${property.published ? "ph-eye" : "ph-eye-slash"}" style="font-size:14px"></i>${property.published ? "On presentation" : "Not published"}</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#d9f5e3;color:#0b6f39"><i class="ph-fill ph-map-pin" style="font-size:14px"></i>On the map</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#f7e7c6;color:#8a6a14"><i class="ph-fill ph-images" style="font-size:14px"></i>${property.photos.length} photos</span>
          ${shares ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#efe8fb;color:#6b3fd4"><i class="ph-fill ph-paper-plane-tilt" style="font-size:14px"></i>${shares} live ${shares === 1 ? "link" : "links"}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #f6e8c8">
          <button data-act="detail" data-id="${esc(property.id)}" title="Update price" style="display:flex;align-items:center;gap:8px;font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:#c85a1a;cursor:pointer"><span>${formatINR(property.price)}</span><i class="ph-fill ph-pencil-simple" style="font-size:15px"></i></button>
          <button data-act="menu" data-id="${esc(property.id)}" title="More" aria-label="Plot actions" style="width:36px;height:36px;border-radius:11px;background:#f3eeff;color:#8a7a52;display:grid;place-items:center"><i class="ph-bold ph-dots-three" style="font-size:18px"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          <a href="/app/plotmap/index.html?property=${encodeURIComponent(property.id)}" style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#fff3d1;color:#8a6a14;font-size:14.5px;font-weight:800;text-decoration:none"><i class="ph-fill ph-map-pin-line" style="font-size:17px"></i>Show on map</a>
          <a href="/app/plotmap/index.html?property=${encodeURIComponent(property.id)}" style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#e2f2e6;color:#186c3c;font-size:14.5px;font-weight:800;text-decoration:none"><i class="ph-fill ph-presentation-chart" style="font-size:17px"></i>Presentation</a>
          <a href="/admin/owner.html#links" style="grid-column:1 / -1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:12px;background:#ffc93c;color:#241d0c;font-size:15.5px;font-weight:800;text-decoration:none;box-shadow:0 10px 22px -12px rgba(244,174,20,.9)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>Send private link</a>
        </div>
      </div>
      ${menuId === property.id ? `<div style="position:absolute;right:14px;bottom:72px;width:190px;background:#fffaf0;border:1px solid #e6ddcc;border-radius:14px;box-shadow:0 24px 54px -24px rgba(30,28,22,.65);padding:7px;z-index:20;animation:omPop .16s ease both"><button data-act="publish" data-id="${esc(property.id)}" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#146c3a;text-align:left;font-weight:800"><i class="ph-fill ${property.published ? "ph-eye-slash" : "ph-broadcast"}"></i>${property.published ? "Take off presentation" : "Publish"}</button><button data-act="sold" data-id="${esc(property.id)}" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#5b32c4;text-align:left;font-weight:800"><i class="ph-fill ph-seal-check"></i>Mark sold</button><button data-act="remove" data-id="${esc(property.id)}" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#c2185b;text-align:left;font-weight:800"><i class="ph-fill ph-trash"></i>Delete</button></div>` : ""}
    </article>`;
  };

  const render = () => {
    const cities = [
      ...new Set(properties.map((property) => property.city)),
    ].sort();
    const pool = properties.filter(
      (property) =>
        !property.sold && (city === "all" || property.city === city),
    );
    const ready = pool.filter((property) => property.photos.length > 0);
    const needWork = pool.filter((property) => property.photos.length === 0);
    const selected = selectedId
      ? properties.find((property) => property.id === selectedId)
      : undefined;
    const portfolio = pool.reduce((sum, property) => sum + property.price, 0);
    el.innerHTML = `<div style="max-width:1120px;margin:0 auto;padding:34px 40px 70px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Plots</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Everything you have to sell — and what's ready to show a customer.</p></div><button data-act="add" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add Property</button></div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:22px;position:relative;z-index:20"><div style="position:relative"><button data-act="city-toggle" style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:15px;background:#faf7ff;border:1px solid #e6ddcc;box-shadow:0 1px 2px rgba(30,28,22,.04)"><i class="ph-fill ph-map-pin" style="font-size:19px;color:#d95d1e"></i><span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.1"><span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Showing</span><span style="font-size:16.5px;font-weight:800;color:#241f1c">${city === "all" ? "All cities" : esc(city)}</span></span><i class="ph-bold ph-caret-${cityOpen ? "up" : "down"}" style="font-size:15px;color:#8d8271;margin-left:4px"></i></button>${cityOpen ? `<div style="position:absolute;top:calc(100% + 10px);left:0;width:440px;max-width:80vw;background:#faf7ff;border:1px solid #e6ddcc;border-radius:18px;box-shadow:0 30px 70px -26px rgba(30,28,22,.55);padding:12px;z-index:40;animation:omPop .18s ease both"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${["all", ...cities].map((value) => `<button data-act="city" data-city="${esc(value)}" style="display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-radius:11px;background:${city === value ? "#fff3d1" : "transparent"};color:${city === value ? "#8a5a0c" : "#4c463d"};font-size:14px;font-weight:800;text-align:left">${value === "all" ? "All cities" : esc(value)}${city === value ? '<i class="ph-bold ph-check"></i>' : ""}</button>`).join("")}</div></div>` : ""}</div></div>
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-top:20px"><div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px;color:#1f1a12"><div style="font-size:14px;color:#8a6a14;font-weight:700">Value of stock${city === "all" ? "" : ` in ${esc(city)}`}</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#1f1a12;margin-top:8px">${formatINR(portfolio)}</div></div><div style="background:#ffe6cf;border:1px solid #f8cba6;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#6b6156;font-weight:700">Ready to show</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#d95d1e;margin-top:8px">${ready.length}</div></div><div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#6b6156;font-weight:700">Need a photo</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#b5322a;margin-top:8px">${needWork.length}</div></div></div>
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:30px 0 14px">Ready to show</div>${ready.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px">${ready.map(renderCard).join("")}</div>` : `<div style="padding:30px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No ready-to-show plots in ${city === "all" ? "your portfolio" : esc(city)} yet.</div>`}
      ${needWork.length ? `<div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:32px 0 12px">Needs a little work</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">${needWork.map(renderCard).join("")}</div>` : ""}
    </div>${selected ? detailMarkup(selected) : ""}${addOpen ? approvedAddMarkup(cities) : ""}`;

    if (activeMap) {
      activeMap.dispose();
      activeMap = null;
    }

    if (addOpen && addStep === 3) {
      const mapEl = el.querySelector<HTMLElement>('#pm-add-map');
      const maps = getMaps();
      const mapId = addForm.city === "New Chandigarh" ? "masterplan-mohali" : maps[0]?.id || "";
      const targetMap = maps.find((m) => m.id === mapId) || maps[0];
      if (mapEl && targetMap) {
        activeMap = mountMapEngine(mapEl);
        activeMap.engine.setMap(targetMap.id, { mode: 'original' });
        
        const pinLayer = document.createElement('div');
        pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;transform-origin:0 0';
        mapEl.appendChild(pinLayer);

        if (selectedMapPin && selectedMapPin.mapId === targetMap.id) {
          const px = selectedMapPin.x * targetMap.original.dims.w;
          const py = selectedMapPin.y * targetMap.original.dims.h;
          pinLayer.innerHTML = `<div style="position:absolute;left:${px}px;top:${py}px;width:16px;height:16px;border-radius:50%;background:#6b3fd4;border:3px solid #fff;transform:translate(-50%,-50%);box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>`;
        }

        mapEl.addEventListener('click', (e) => {
          const t = activeMap?.engine.transform;
          if (!t || !targetMap) return;
          const rect = mapEl.getBoundingClientRect();
          const xScreen = e.clientX - rect.left;
          const yScreen = e.clientY - rect.top;
          
          const xIntrinsic = (xScreen - t.tx) / t.scale;
          const yIntrinsic = (yScreen - t.ty) / t.scale;
          
          selectedMapPin = {
            mapId: targetMap.id,
            x: xIntrinsic / targetMap.original.dims.w,
            y: yIntrinsic / targetMap.original.dims.h
          };
          render();
        });

        const updatePin = () => {
          if (!activeMap) return;
          const t = activeMap.engine.transform;
          if (t) {
            pinLayer.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`;
            if (pinLayer.firstElementChild) {
               (pinLayer.firstElementChild as HTMLElement).style.transform = `translate(-50%,-50%) scale(${1 / t.scale})`;
            }
          }
          requestAnimationFrame(updatePin);
        };
        updatePin();
      }
    }
  };

  const detailMarkup = (property: Property) =>
    `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.34);backdrop-filter:blur(3px);z-index:90;display:flex;justify-content:flex-end"><section role="dialog" aria-modal="true" aria-labelledby="pm-prop-title" style="width:min(620px,95vw);height:100%;background:#fffaf0;display:flex;flex-direction:column;box-shadow:-28px 0 70px -34px rgba(20,14,2,.8);animation:omSlide .28s cubic-bezier(.2,.8,.2,1) both"><div style="display:flex;align-items:center;gap:14px;padding:20px 24px;border-bottom:1px solid #f0dfb8"><span style="width:46px;height:46px;border-radius:13px;background:#fff3d1;color:#a8792a;display:grid;place-items:center"><i class="${iconFor(property.type)}" style="font-size:23px"></i></span><div style="flex:1"><h2 id="pm-prop-title" style="margin:0;font-family:'Newsreader',serif;font-size:27px;font-weight:500">${esc(property.type)} · ${esc(property.size)}</h2><p style="margin:3px 0 0;color:#8d8271">${esc(property.loc)}</p></div><button data-act="close" aria-label="Close property" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156"><i class="ph-bold ph-x"></i></button></div><div data-scroll style="flex:1;overflow-y:auto;padding:24px"><div style="height:280px;border-radius:20px;background:${property.photos[0] ? `#efe8fb url('${esc(property.photos[0])}') center/cover` : "#efe8fb"}"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px"><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Price</span><b style="display:block;margin-top:5px;font-size:18px;color:#c85a1a">${formatINR(property.price)}</b></div><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Facing</span><b style="display:block;margin-top:5px;font-size:18px">${esc(property.facing)}</b></div><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Opens</span><b style="display:block;margin-top:5px;font-size:18px">${property.views}</b></div></div><div style="margin-top:18px;padding:18px;border-radius:16px;background:${property.published ? "#d9f5e3" : "#f3eeff"};color:${property.published ? "#0b6f39" : "#6b6156"};font-weight:800"><i class="ph-fill ${property.published ? "ph-broadcast" : "ph-eye-slash"}"></i> ${property.published ? "This plot is on your presentation" : "This plot is not published"}</div></div><div style="padding:18px 24px;border-top:1px solid #f0dfb8;display:flex;gap:10px">${deleteArmed ? `<button data-act="confirm-delete" data-id="${esc(property.id)}" style="flex:1;height:48px;border-radius:13px;background:#c2185b;color:#fff;font-weight:800">Delete this plot</button><button data-act="disarm" style="height:48px;padding:0 18px;border-radius:13px;background:#f3eeff;font-weight:800">Cancel</button>` : `<button data-act="arm-delete" style="height:48px;padding:0 18px;border-radius:13px;background:#ffe1e6;color:#c2185b;font-weight:800"><i class="ph-fill ph-trash"></i> Delete</button><div style="flex:1"></div><button data-act="publish" data-id="${esc(property.id)}" style="height:48px;padding:0 20px;border-radius:13px;background:#12a150;color:#fff;font-weight:800">${property.published ? "Take off" : "Publish"}</button>`}</div></section></div>`;

  const approvedAddMarkup = (cities: string[]) => {
    const inputStyle = "display:block;width:100%;height:46px;margin-top:7px;border:1px solid #e6c980;border-radius:11px;background:#fff;padding:0 14px;font-size:15px;color:#241f1c;outline:none";
    const labelStyle = "display:block;font-size:13px;font-weight:700;color:#6b6156";
    const previewPhotos = properties.find((item) => item.id === "ecocity")?.photos.length
      ? properties.find((item) => item.id === "ecocity")!.photos
      : ["/assets/ph-plot-1.png", "/assets/ph-plot-2.png", "/assets/ph-plot-3.png"];
    const cityOptions = [...new Set([addForm.city, ...cities])];
    const step = (number: number, label: string) => {
      const complete = number < addStep;
      const active = number === addStep;
      return `<button type="button" data-act="add-step" data-step="${number}" style="display:flex;align-items:center;gap:10px;color:${active ? "#241f1c" : "#6b6156"};font-size:14px;font-weight:${active ? "800" : "600"};white-space:nowrap"><span style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid ${complete ? "#e5a90e" : active ? "#6b3fd4" : "#d9d1c3"};background:${complete ? "#e5a90e" : active ? "#6b3fd4" : "#fff"};color:${complete || active ? "#fff" : "#6b6156"};font-weight:800">${complete ? '<i class="ph-bold ph-check" style="font-size:15px"></i>' : number}</span>${label}</button>`;
    };
    const preview = `<aside style="min-width:0;border-radius:18px;background:#241904;background-image:radial-gradient(80% 56% at 92% 0%,rgba(145,97,0,.55),transparent 72%),linear-gradient(145deg,#3a2605,#171006);color:#fff8e6;padding:17px;box-shadow:0 18px 42px -28px rgba(20,14,2,.9);display:flex;flex-direction:column;align-self:stretch">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800"><i class="ph ph-eye" style="font-size:20px"></i>Client Preview</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:23px"><div><div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#ffd75e;text-transform:uppercase">${esc(addForm.city)}</div><div id="pm-add-preview-title" style="font-family:'Newsreader',serif;font-size:28px;font-weight:500;line-height:1.05;margin-top:4px">${esc(addForm.title)}</div><div id="pm-add-preview-location" style="font-size:13.5px;color:#e4c98a;margin-top:7px">${esc(addForm.area)}, ${esc(addForm.city)}</div></div><span style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.1);font-size:11px;font-weight:800;white-space:nowrap"><i class="ph-fill ph-seal-check" style="font-size:15px;color:#55dd8a"></i>RERA + GMADA approved</span></div>
      <div style="height:176px;border-radius:14px;margin-top:14px;position:relative;overflow:hidden;background:#d8d2c5 url('${esc(previewPhotos[0] || "/assets/ph-plot-1.png")}') center/cover"><button type="button" aria-label="Previous photo" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#fffaf0;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-caret-left"></i></button><button type="button" aria-label="Next photo" style="position:absolute;right:9px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#fffaf0;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-caret-right"></i></button></div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:-1px">${Array.from({ length: 6 }, (_, index) => `<span style="height:42px;border-radius:7px;background:#d8d2c5 url('${esc(previewPhotos[index % previewPhotos.length] || "/assets/ph-plot-1.png")}') center/cover;border:${index === 0 ? "2px solid #ffc400" : "1px solid rgba(255,255,255,.24)"}"></span>`).join("")}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px">${[["Plot size", addForm.size], ["Facing", addForm.facing], ["Position", addForm.position], ["Sector", addForm.sector]].map(([label, value]) => `<div style="border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.07);padding:9px 11px"><div style="font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#c9b477">${label}</div><div style="font-family:'Newsreader',serif;font-size:18px;line-height:1.1;margin-top:3px">${esc(value)}</div></div>`).join("")}</div>
      <div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffd75e;margin-top:10px">What is close by</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:7px">${[["ph-graduation-cap", "Chandigarh University", "10 min"], ["ph-storefront", "CP67 Mall", "8 min"], ["ph-first-aid-kit", "PGIMER Hospital", "22 min"]].map(([icon, name, time]) => `<div style="display:flex;align-items:center;gap:9px;border-radius:9px;background:rgba(255,255,255,.07);padding:8px 10px;font-size:11.5px;font-weight:700"><i class="ph-fill ${icon}" style="font-size:15px;color:#ffd75e"></i><span style="flex:1">${name}</span><span style="color:#55dd8a">${time}</span></div>`).join("")}</div>
    </aside>`;
    const basics = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);padding:24px"><div style="display:flex;align-items:center;gap:13px"><span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-map-pin-area" style="font-size:22px"></i></span><h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Property Basics</h3></div><div style="margin-top:21px"><label style="${labelStyle}">Property title <b style="color:#db3d53">*</b><input name="title" value="${esc(addForm.title)}" style="${inputStyle}"></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:17px"><label style="${labelStyle}">City <b style="color:#db3d53">*</b><select name="city" style="${inputStyle}">${cityOptions.map((item) => `<option ${item === addForm.city ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></label><label style="${labelStyle}">Area / Sector <b style="color:#db3d53">*</b><input name="area" value="${esc(addForm.area)}" style="${inputStyle}"></label><label style="${labelStyle}">Plot size <b style="color:#db3d53">*</b><input name="size" value="${esc(addForm.size)}" style="${inputStyle}"></label><label style="${labelStyle}">Facing <b style="color:#db3d53">*</b><select name="facing" style="${inputStyle}">${["North-East", "East", "West", "North", "South", "North-West", "South-East", "South-West"].map((item) => `<option ${item === addForm.facing ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Position <b style="color:#db3d53">*</b><select name="position" style="${inputStyle}">${["Park facing", "Corner plot", "Inside plot", "Road facing"].map((item) => `<option ${item === addForm.position ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Sector<input name="sector" value="${esc(addForm.sector)}" style="${inputStyle}"></label></div></div></section>`;
    const details = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);padding:20px 24px"><div style="display:flex;align-items:center;gap:13px"><span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-image" style="font-size:22px"></i></span><h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Photos &amp; Details</h3></div><div style="margin-top:14px;font-size:13px;font-weight:700;color:#4c463d">Main photo (cover image) <b style="color:#db3d53">*</b></div><button type="button" data-act="plot-photo" style="width:100%;height:78px;margin-top:7px;border:1px dashed #c9b8d8;border-radius:11px;background:#fbf8ff;color:#4c463d;display:flex;align-items:center;justify-content:center;gap:12px"><i class="ph ph-upload-simple" style="font-size:28px;color:#6b3fd4"></i><span style="text-align:left"><b style="display:block;font-size:13px">Upload cover photo <span style="font-weight:500">or drag &amp; drop</span></b><small style="display:block;margin-top:3px;color:#8d8271">Recommended size: 16:9 or 4:3</small></span></button><div style="margin-top:12px;font-size:13px;font-weight:700;color:#4c463d">Gallery photos</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:7px">${Array.from({ length: 6 }, (_, index) => index < 2 ? `<button type="button" data-act="plot-photo" style="height:85px;border-radius:10px;position:relative;background:url('${esc(previewPhotos[index] || "/assets/ph-plot-1.png")}') center/cover"><span style="position:absolute;right:5px;top:5px;width:22px;height:22px;border-radius:50%;background:#fff;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-x" style="font-size:11px"></i></span></button>` : index === 5 ? `<button type="button" data-act="plot-photo" style="height:85px;border:1px solid #7b4ee5;border-radius:10px;background:#fbf8ff;color:#6b3fd4;display:grid;place-items:center"><span><i class="ph ph-plus" style="display:block;font-size:25px"></i><small style="font-size:11px">Add more</small></span></button>` : `<button type="button" data-act="plot-photo" style="height:85px;border:1px dashed #d7ccbd;border-radius:10px;background:#faf8f5;color:#b7ada1;display:grid;place-items:center"><i class="ph ph-image" style="font-size:25px"></i></button>`).join("")}</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:14px"><label style="${labelStyle}">Property type <b style="color:#db3d53">*</b><select name="type" style="${inputStyle}">${["Residential Plot", "Flat", "Floor", "Kothi", "Villa", "Commercial"].map((item) => `<option ${item === addForm.type ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Listing status <b style="color:#db3d53">*</b><select name="status" style="${inputStyle}"><option>Available</option><option>Draft</option></select></label><label style="${labelStyle}">Possession <b style="color:#db3d53">*</b><select name="possession" style="${inputStyle}"><option>Ready to build</option><option>Immediate</option><option>Later</option></select></label></div><label style="${labelStyle};margin-top:13px">Property description <b style="color:#db3d53">*</b><textarea name="description" maxlength="500" rows="3" style="display:block;width:100%;margin-top:7px;border:1px solid #e6c980;border-radius:11px;background:#fff;padding:11px 14px;font-size:13px;line-height:1.45;color:#241f1c;outline:none;resize:none">${esc(addForm.description)}</textarea><span style="display:block;text-align:right;font-size:11px;font-weight:500;color:#8d8271;margin-top:3px">${addForm.description.length} / 500</span></label><div style="font-size:13px;font-weight:700;color:#4c463d;margin-top:8px">Nearby places</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:7px">${[["ph-graduation-cap", "Chandigarh University", "10 min"], ["ph-storefront", "CP67 Mall", "8 min"], ["ph-first-aid-kit", "PGIMER Hospital", "22 min"]].map(([icon, name, time]) => `<span style="display:flex;align-items:center;gap:8px;height:40px;border:1px solid #eadfc9;border-radius:9px;padding:0 10px;font-size:10.5px;font-weight:700"><i class="ph-fill ${icon}" style="font-size:15px;color:#e5a90e"></i><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span><b style="color:#12a150">${time}</b></span>`).join("")}</div></section>`;
    const mapLocation = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);display:flex;flex-direction:column;overflow:hidden">
      <div style="flex:none;display:flex;align-items:center;gap:13px;padding:20px 24px">
        <span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-map-pin" style="font-size:22px"></i></span>
        <div>
          <h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Map Location</h3>
          <p style="margin:3px 0 0;color:#8d8271;font-size:13px">Click on the map below to drop a pin for this property.</p>
        </div>
      </div>
      <div style="flex:1;min-height:300px;position:relative;background:#e7e0d2">
        <div id="pm-add-map" style="position:absolute;inset:0"></div>
        <div style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);background:rgba(28,21,51,.8);color:#fff;padding:8px 16px;border-radius:99px;font-size:13px;font-weight:600;pointer-events:none">
          ${selectedMapPin ? `Pin placed on ${selectedMapPin.mapId}` : 'Click map to place pin'}
        </div>
      </div>
    </section>`;
    const body = addStep === 1 ? basics : addStep === 2 ? details : mapLocation;
    const primaryLabel = addStep === 2 ? "Next" : "Add Property";
    const primaryAction = addStep === 2 ? "add-next" : "add-submit";
    return `<div style="position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;overflow:hidden"><div data-act="close-add" style="position:absolute;inset:0;background:rgba(33,29,25,.45);backdrop-filter:blur(5px);animation:omVeil .2s ease both"></div><form id="pm-add-plot" role="dialog" aria-modal="true" aria-labelledby="pm-add-title" style="position:relative;width:min(1140px,calc(100vw - 48px));height:min(830px,calc(100vh - 48px));min-height:590px;border-radius:24px;background:#fffaf0;box-shadow:0 30px 80px -30px rgba(20,14,2,.75);overflow:hidden;display:flex;flex-direction:column;animation:omSheet .32s cubic-bezier(.2,.8,.2,1) both"><header style="height:104px;flex:none;display:flex;align-items:center;gap:18px;padding:0 30px;border-bottom:1px solid #eadfc9"><span style="width:58px;height:58px;border-radius:16px;background:#6b3fd4;background-image:linear-gradient(145deg,#8557eb,#5b32c4);color:#fff;display:grid;place-items:center;box-shadow:0 13px 26px -16px rgba(91,50,196,.9)"><i class="ph ph-hand-heart" style="font-size:30px"></i></span><div style="flex:1"><h2 id="pm-add-title" style="margin:0;font-family:'Newsreader',serif;font-size:33px;font-weight:500;letter-spacing:-.025em">Add Property</h2><p style="margin:3px 0 0;color:#6b6156;font-size:14px">Create a client-ready property in 3 simple steps</p></div><button type="button" data-act="close-add" aria-label="Close Add Property" style="width:48px;height:48px;border-radius:14px;background:#f0eaff;color:#6b6156;display:grid;place-items:center"><i class="ph ph-x" style="font-size:20px"></i></button></header><div data-scroll style="flex:1;min-height:0;overflow:auto;padding:22px 30px 18px"><div style="display:flex;align-items:center;gap:14px;max-width:650px">${step(1, "Property Basics")}<span style="height:1px;flex:1;background:#ddd4c6"></span>${step(2, "Photos & Details")}<span style="height:1px;flex:1;background:#ddd4c6"></span>${step(3, "Map Location")}</div><div style="display:grid;grid-template-columns:minmax(0,1.48fr) minmax(330px,.92fr);gap:30px;margin-top:20px;align-items:stretch">${body}${preview}</div></div><footer style="height:104px;flex:none;display:flex;align-items:center;gap:16px;padding:0 30px;border-top:1px solid #eadfc9;background:rgba(255,250,240,.96)"><button type="button" data-act="add-back" style="display:flex;align-items:center;gap:8px;height:54px;padding:0 20px;border-radius:12px;background:#f0eaff;color:#4c463d;font-size:15px;font-weight:700"><i class="ph ph-arrow-left"></i>Back</button><div style="flex:1"></div><button type="button" data-act="save-draft" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:185px;padding:0 22px;border:1px solid #e6c980;border-radius:12px;background:#fffaf0;color:#6b3fd4;font-size:15px;font-weight:800"><i class="ph ph-floppy-disk" style="font-size:20px"></i>Save Draft</button><button type="${primaryAction === "add-submit" ? "submit" : "button"}" data-act="${primaryAction}" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:220px;padding:0 26px;border-radius:12px;background:#6b3fd4;background-image:linear-gradient(120deg,#7d49e8,#5b32c4);color:#fff;font-size:16px;font-weight:800;box-shadow:0 16px 28px -18px rgba(91,50,196,.9)">${addStep === 2 ? "" : '<i class="ph-fill ph-plus-circle" style="font-size:20px"></i>'}${primaryLabel}${addStep === 2 ? '<i class="ph ph-arrow-right"></i>' : ""}</button></footer></form></div>`;
  };

  el.addEventListener("input", (event) => {
    if (!addOpen) return;
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!target.closest("#pm-add-plot") || !(target.name in addForm)) return;
    addForm = { ...addForm, [target.name]: target.value };
    if (target.name === "title") {
      const title = el.querySelector<HTMLElement>("#pm-add-preview-title");
      if (title) title.textContent = target.value;
    }
    if (target.name === "city" || target.name === "area") {
      const locationLabel = el.querySelector<HTMLElement>("#pm-add-preview-location");
      if (locationLabel) locationLabel.textContent = `${addForm.area}, ${addForm.city}`;
    }
  });

  el.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement;
    if (form.id !== "pm-add-plot") return;
    event.preventDefault();
    const type = addForm.type;
    const area = addForm.area || "New property";
    const propertyCity = addForm.city || "New Chandigarh";
    const photos = properties.find((item) => item.id === "ecocity")?.photos.slice(0, 6) || [];
    const newId = `local-${Date.now()}`;
    properties.unshift({
      id: newId,
      type,
      want: (type === "Residential Plot"
        ? "Plot"
        : type === "Floor"
          ? "Flat"
          : type) as WantType,
      city: propertyCity,
      area,
      loc: `${area}, ${propertyCity}`,
      sector: area,
      size: addForm.size,
      facing: addForm.facing as Facing,
      position: addForm.position,
      approvals: ["RERA", "GMADA"],
      landmarks: [
        { name: "Chandigarh University", distance: "10 min", icon: "ph-fill ph-graduation-cap" },
        { name: "CP67 Mall", distance: "8 min", icon: "ph-fill ph-storefront" },
        { name: "PGIMER Hospital", distance: "22 min", icon: "ph-fill ph-first-aid-kit" },
      ],
      price: 0,
      photos,
      published: false,
      sold: false,
      views: 0,
      mapPlacement: selectedMapPin || undefined
    });
    if (selectedMapPin) {
      addPropertyToMap(selectedMapPin.mapId, newId);
    }
    addOpen = false;
    addStep = 1;
    selectedMapPin = null;
    render();
  });
  el.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-act]",
    );
    if (!target) {
      if ((event.target as HTMLElement).hasAttribute("data-overlay")) {
        selectedId = null;
        addOpen = false;
        render();
      }
      return;
    }
    const action = target.dataset.act;
    const id = target.dataset.id;
    if (action === "plot-photo") {
      return;
    }
    if (action === "add-step") {
      addStep = Math.max(1, Math.min(3, Number(target.dataset.step) || 1));
      render();
      return;
    }
    if (action === "add-next") {
      addStep = Math.min(3, addStep + 1);
      render();
      return;
    }
    if (action === "add-back") {
      if (addStep > 1) addStep -= 1;
      else addOpen = false;
      render();
      return;
    }
    if (action === "save-draft") {
      const form = target.closest<HTMLFormElement>("#pm-add-plot");
      form?.requestSubmit();
      return;
    }
    if (action === "city-toggle") cityOpen = !cityOpen;
    if (action === "city") {
      city = target.dataset.city || "all";
      cityOpen = false;
    }
    if (action === "detail") {
      selectedId = id || null;
      menuId = null;
      deleteArmed = false;
    }
    if (action === "menu") menuId = menuId === id ? null : id || null;
    if (action === "close") {
      selectedId = null;
      deleteArmed = false;
    }
    if (action === "add") {
      addOpen = true;
      addStep = 1;
    }
    if (action === "close-add") addOpen = false;
    if (action === "arm-delete") deleteArmed = true;
    if (action === "disarm") deleteArmed = false;
    if (action === "publish" && id)
      properties = properties.map((property) =>
        property.id === id
          ? { ...property, published: !property.published }
          : property,
      );
    if (action === "sold" && id)
      properties = properties.map((property) =>
        property.id === id
          ? { ...property, sold: true, published: false }
          : property,
      );
    if ((action === "remove" || action === "confirm-delete") && id) {
      properties = properties.filter((property) => property.id !== id);
      selectedId = null;
    }
    render();
  });
  render();
}
