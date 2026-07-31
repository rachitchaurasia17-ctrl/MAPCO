import { adapter } from "../../../packages/data/mock-adapter-v2";
import { formatINR } from "../../../packages/ui/utils";
import type {
  ClientLink,
  Facing,
  Property,
  PropertyType,
  WantType,
} from "../../../packages/data/types";
import { AddPropertyFlow } from "../../../packages/ui/shared-modals";

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
    </div>${selected ? detailMarkup(selected) : ""}`;
  };

  const detailMarkup = (property: Property) =>
    `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.34);backdrop-filter:blur(3px);z-index:90;display:flex;justify-content:flex-end"><section role="dialog" aria-modal="true" aria-labelledby="pm-prop-title" style="width:min(620px,95vw);height:100%;background:#fffaf0;display:flex;flex-direction:column;box-shadow:-28px 0 70px -34px rgba(20,14,2,.8);animation:omSlide .28s cubic-bezier(.2,.8,.2,1) both"><div style="display:flex;align-items:center;gap:14px;padding:20px 24px;border-bottom:1px solid #f0dfb8"><span style="width:46px;height:46px;border-radius:13px;background:#fff3d1;color:#a8792a;display:grid;place-items:center"><i class="${iconFor(property.type)}" style="font-size:23px"></i></span><div style="flex:1"><h2 id="pm-prop-title" style="margin:0;font-family:'Newsreader',serif;font-size:27px;font-weight:500">${esc(property.type)} · ${esc(property.size)}</h2><p style="margin:3px 0 0;color:#8d8271">${esc(property.loc)}</p></div><button data-act="close" aria-label="Close property" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156"><i class="ph-bold ph-x"></i></button></div><div data-scroll style="flex:1;overflow-y:auto;padding:24px"><div style="height:280px;border-radius:20px;background:${property.photos[0] ? `#efe8fb url('${esc(property.photos[0])}') center/cover` : "#efe8fb"}"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px"><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Price</span><b style="display:block;margin-top:5px;font-size:18px;color:#c85a1a">${formatINR(property.price)}</b></div><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Facing</span><b style="display:block;margin-top:5px;font-size:18px">${esc(property.facing)}</b></div><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Opens</span><b style="display:block;margin-top:5px;font-size:18px">${property.views}</b></div></div><div style="margin-top:18px;padding:18px;border-radius:16px;background:${property.published ? "#d9f5e3" : "#f3eeff"};color:${property.published ? "#0b6f39" : "#6b6156"};font-weight:800"><i class="ph-fill ${property.published ? "ph-broadcast" : "ph-eye-slash"}"></i> ${property.published ? "This plot is on your presentation" : "This plot is not published"}</div></div><div style="padding:18px 24px;border-top:1px solid #f0dfb8;display:flex;gap:10px">${deleteArmed ? `<button data-act="confirm-delete" data-id="${esc(property.id)}" style="flex:1;height:48px;border-radius:13px;background:#c2185b;color:#fff;font-weight:800">Delete this plot</button><button data-act="disarm" style="height:48px;padding:0 18px;border-radius:13px;background:#f3eeff;font-weight:800">Cancel</button>` : `<button data-act="arm-delete" style="height:48px;padding:0 18px;border-radius:13px;background:#ffe1e6;color:#c2185b;font-weight:800"><i class="ph-fill ph-trash"></i> Delete</button><div style="flex:1"></div><button data-act="publish" data-id="${esc(property.id)}" style="height:48px;padding:0 20px;border-radius:13px;background:#12a150;color:#fff;font-weight:800">${property.published ? "Take off" : "Publish"}</button>`}</div></section></div>`;

  el.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-act]",
    );
    if (!target) {
      if ((event.target as HTMLElement).hasAttribute("data-overlay")) {
        selectedId = null;
        render();
      }
      return;
    }
    const action = target.dataset.act;
    const id = target.dataset.id;
    if (action === "plot-photo") {
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
      let flow: AddPropertyFlow;
      flow = new AddPropertyFlow(
        [...new Set(properties.map(p => p.city))],
        (newProp) => {
          properties.unshift(newProp);
          flow.unmount();
          render();
        },
        () => flow.unmount()
      );
      flow.mount(document.body);
    }
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
