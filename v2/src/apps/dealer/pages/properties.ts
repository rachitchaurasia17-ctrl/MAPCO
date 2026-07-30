import { adapter } from "../../../packages/data/mock-adapter-v2";
import { formatINR } from "../../../packages/ui/utils";
import type {
  Facing,
  Property,
  PropertyType,
  WantType,
} from "../../../packages/data/types";

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
  let city = new URLSearchParams(location.search).get("city") || "all";
  let cityOpen = false;
  let selectedId = new URLSearchParams(location.search).get("property");
  let menuId: string | null = null;
  let addOpen = false;
  let deleteArmed = false;

  const result = await adapter.properties.list({ limit: 100 });
  if (!result.ok) {
    el.innerHTML =
      '<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Plots could not be loaded.</div>';
    return;
  }
  properties = [...result.value.items];

  const renderCard = (property: Property) => {
    const ready = property.photos.length > 0;
    const shares = 0;
    return `<article style="min-width:0;background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:22px;overflow:hidden;box-shadow:0 1px 2px rgba(30,28,22,.03),0 18px 38px -28px rgba(30,28,22,.65);position:relative">
      <button data-act="detail" data-id="${esc(property.id)}" style="display:block;width:100%;height:178px;position:relative;background:${property.photos[0] ? `#efe8fb url('${esc(property.photos[0])}') center/cover` : "#efe8fb"};text-align:left">
        ${!property.photos[0] ? `<span style="position:absolute;inset:0;display:grid;place-items:center;color:#8a7a52"><span style="text-align:center"><i class="${iconFor(property.type)}" style="font-size:38px"></i><span style="display:block;margin-top:8px;font-size:13px;font-weight:800">Add photos</span></span></span>` : ""}
        <span style="position:absolute;top:12px;left:12px;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:${property.published ? "#d9f5e3" : "#f3eeff"};color:${property.published ? "#0b8f45" : "#7d7365"};font-size:11.5px;font-weight:800;box-shadow:0 6px 18px -10px rgba(20,14,2,.7)"><span style="width:7px;height:7px;border-radius:50%;background:${property.published ? "#12a150" : "#a89e8b"}"></span>${property.published ? "On presentation" : "Not published"}</span>
        <span style="position:absolute;right:12px;bottom:12px;padding:5px 10px;border-radius:9px;background:rgba(24,17,5,.72);color:#fff8e6;font-size:12px;font-weight:800"><i class="ph-fill ph-eye"></i> ${property.views}</span>
      </button>
      <div style="padding:18px 18px 16px"><div style="display:flex;align-items:flex-start;gap:12px"><div style="flex:1;min-width:0"><h3 style="margin:0;font-family:'Newsreader',serif;font-size:23px;font-weight:600;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.type)} · ${esc(property.size)}</h3><p style="margin:4px 0 0;color:#8d8271;font-size:14px"><i class="ph-fill ph-map-pin" style="color:#d95d1e"></i> ${esc(property.loc)}</p></div><button data-act="menu" data-id="${esc(property.id)}" aria-label="Plot actions" style="width:38px;height:38px;border-radius:11px;background:#f3eeff;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-dots-three-vertical"></i></button></div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px"><span style="font-family:'Newsreader',serif;font-size:22px;font-weight:600;color:#c85a1a">${formatINR(property.price)}</span><span style="font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:#fff3d1;color:#8a6a14">${esc(property.facing)} facing</span>${shares ? `<span style="font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:#efe8fb;color:#6b3fd4">${shares} links</span>` : ""}</div>
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
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Plots</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Everything you have to sell — and what's ready to show a customer.</p></div><button data-act="add" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a plot</button></div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:22px;position:relative;z-index:20"><div style="position:relative"><button data-act="city-toggle" style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:15px;background:#faf7ff;border:1px solid #e6ddcc;box-shadow:0 1px 2px rgba(30,28,22,.04)"><i class="ph-fill ph-map-pin" style="font-size:19px;color:#d95d1e"></i><span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.1"><span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Showing</span><span style="font-size:16.5px;font-weight:800;color:#241f1c">${city === "all" ? "All cities" : esc(city)}</span></span><i class="ph-bold ph-caret-${cityOpen ? "up" : "down"}" style="font-size:15px;color:#8d8271;margin-left:4px"></i></button>${cityOpen ? `<div style="position:absolute;top:calc(100% + 10px);left:0;width:440px;max-width:80vw;background:#faf7ff;border:1px solid #e6ddcc;border-radius:18px;box-shadow:0 30px 70px -26px rgba(30,28,22,.55);padding:12px;z-index:40;animation:omPop .18s ease both"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${["all", ...cities].map((value) => `<button data-act="city" data-city="${esc(value)}" style="display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-radius:11px;background:${city === value ? "#fff3d1" : "transparent"};color:${city === value ? "#8a5a0c" : "#4c463d"};font-size:14px;font-weight:800;text-align:left">${value === "all" ? "All cities" : esc(value)}${city === value ? '<i class="ph-bold ph-check"></i>' : ""}</button>`).join("")}</div></div>` : ""}</div></div>
      <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:14px;margin-top:20px"><div style="border-radius:20px;padding:22px 24px;background:#241d0c;color:#fff8e6"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#c9b48a">Portfolio value</div><div style="font-family:'Newsreader',serif;font-size:38px;font-weight:500;margin-top:7px">${formatINR(portfolio)}</div></div><div style="border-radius:20px;padding:22px 24px;background:#d9f5e3;border:1px solid #a6e3c0"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0b6f39">Ready to show</div><div style="font-family:'Newsreader',serif;font-size:38px;font-weight:500;color:#0b8f45;margin-top:7px">${ready.length}</div></div><div style="border-radius:20px;padding:22px 24px;background:#ffe1e6;border:1px solid #f2bdc8"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3324f">Need work</div><div style="font-family:'Newsreader',serif;font-size:38px;font-weight:500;color:#c2185b;margin-top:7px">${needWork.length}</div></div></div>
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:28px 0 12px">Ready to show</div>${ready.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">${ready.map(renderCard).join("")}</div>` : `<div style="padding:30px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No ready-to-show plots in ${city === "all" ? "your portfolio" : esc(city)} yet.</div>`}
      ${needWork.length ? `<div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:32px 0 12px">Needs a little work</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">${needWork.map(renderCard).join("")}</div>` : ""}
    </div>${selected ? detailMarkup(selected) : ""}${addOpen ? approvedAddMarkup(cities) : ""}`;
  };

  const detailMarkup = (property: Property) =>
    `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.34);backdrop-filter:blur(3px);z-index:90;display:flex;justify-content:flex-end"><section role="dialog" aria-modal="true" aria-labelledby="pm-prop-title" style="width:min(620px,95vw);height:100%;background:#fffaf0;display:flex;flex-direction:column;box-shadow:-28px 0 70px -34px rgba(20,14,2,.8);animation:omSlide .28s cubic-bezier(.2,.8,.2,1) both"><div style="display:flex;align-items:center;gap:14px;padding:20px 24px;border-bottom:1px solid #f0dfb8"><span style="width:46px;height:46px;border-radius:13px;background:#fff3d1;color:#a8792a;display:grid;place-items:center"><i class="${iconFor(property.type)}" style="font-size:23px"></i></span><div style="flex:1"><h2 id="pm-prop-title" style="margin:0;font-family:'Newsreader',serif;font-size:27px;font-weight:500">${esc(property.type)} · ${esc(property.size)}</h2><p style="margin:3px 0 0;color:#8d8271">${esc(property.loc)}</p></div><button data-act="close" aria-label="Close property" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156"><i class="ph-bold ph-x"></i></button></div><div data-scroll style="flex:1;overflow-y:auto;padding:24px"><div style="height:280px;border-radius:20px;background:${property.photos[0] ? `#efe8fb url('${esc(property.photos[0])}') center/cover` : "#efe8fb"}"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px"><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Price</span><b style="display:block;margin-top:5px;font-size:18px;color:#c85a1a">${formatINR(property.price)}</b></div><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Facing</span><b style="display:block;margin-top:5px;font-size:18px">${esc(property.facing)}</b></div><div style="padding:15px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><span style="display:block;font-size:11px;font-weight:800;color:#8d8271;text-transform:uppercase">Opens</span><b style="display:block;margin-top:5px;font-size:18px">${property.views}</b></div></div><div style="margin-top:18px;padding:18px;border-radius:16px;background:${property.published ? "#d9f5e3" : "#f3eeff"};color:${property.published ? "#0b6f39" : "#6b6156"};font-weight:800"><i class="ph-fill ${property.published ? "ph-broadcast" : "ph-eye-slash"}"></i> ${property.published ? "This plot is on your presentation" : "This plot is not published"}</div></div><div style="padding:18px 24px;border-top:1px solid #f0dfb8;display:flex;gap:10px">${deleteArmed ? `<button data-act="confirm-delete" data-id="${esc(property.id)}" style="flex:1;height:48px;border-radius:13px;background:#c2185b;color:#fff;font-weight:800">Delete this plot</button><button data-act="disarm" style="height:48px;padding:0 18px;border-radius:13px;background:#f3eeff;font-weight:800">Cancel</button>` : `<button data-act="arm-delete" style="height:48px;padding:0 18px;border-radius:13px;background:#ffe1e6;color:#c2185b;font-weight:800"><i class="ph-fill ph-trash"></i> Delete</button><div style="flex:1"></div><button data-act="publish" data-id="${esc(property.id)}" style="height:48px;padding:0 20px;border-radius:13px;background:#12a150;color:#fff;font-weight:800">${property.published ? "Take off" : "Publish"}</button>`}</div></section></div>`;

  const approvedAddMarkup = (cities: string[]) => {
    const sectorMaps = cities.slice(0, 4).map((item) => `${item} sheet`);
    const types: Array<{ label: string; value: PropertyType }> = [
      { label: "Residential Plot", value: "Residential Plot" },
      { label: "3 BHK Flat", value: "Flat" },
      { label: "Builder Floor", value: "Floor" },
      { label: "Kothi", value: "Kothi" },
      { label: "Villa", value: "Villa" },
      { label: "Commercial SCO", value: "Commercial" },
      { label: "Commercial Booth", value: "Commercial" },
    ];
    return `<div style="position:fixed;inset:0;z-index:84;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto">
      <div data-act="close-add" style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div>
      <form id="pm-add-plot" role="dialog" aria-modal="true" aria-label="Add a plot" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #ddd2f5,0 40px 80px -30px rgba(40,26,2,.8);overflow:hidden;animation:omSheet .34s cubic-bezier(.2,.8,.2,1) both">
        <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #e4dbf7;background:#fff3d1">
          <span style="width:46px;height:46px;border-radius:14px;background:#ffc93c;color:#241d0c;display:grid;place-items:center;flex:none"><i class="ph-fill ph-house-line" style="font-size:24px"></i></span>
          <div style="flex:1;min-width:0"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Add a plot</div><div style="font-size:14px;color:#8a6a14">One page. Fill what you know — the rest can wait.</div></div>
          <button type="button" data-act="close-add" style="width:38px;height:38px;border-radius:12px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:16px"></i></button>
        </div>
        <div data-scroll style="padding:22px 26px;max-height:62vh;overflow-y:auto">
          <div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Where is it</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px"><input name="city" placeholder="City — Mohali" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px;font-weight:600;color:#241f1c;outline:none"><input name="area" placeholder="Sector / locality — Sector 79" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px;font-weight:600;color:#241f1c;outline:none"></div>
          <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">What is it</div>
          <input type="hidden" name="type" value="Residential Plot"><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:11px">${types.map((type, index) => `<button type="button" data-act="plot-type" data-value="${type.value}" style="padding:11px 15px;border-radius:12px;font-size:14.5px;font-weight:700;transition:all .16s;${index === 0 ? "background:#241d0c;color:#ffd75e;border:1px solid #241d0c" : "background:#faf7ff;color:#6b6156;border:1px solid #dcd0f3"}">${type.label}</button>`).join("")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px"><input name="size" placeholder="Size" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px;color:#241f1c;outline:none"><input name="facing" placeholder="East" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px;color:#241f1c;outline:none"><input name="price" placeholder="Price in Cr" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px;color:#241f1c;outline:none"></div>
          <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Photos</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:11px">${[0, 1, 2, 3].map((index) => `<button type="button" data-act="plot-photo" data-index="${index}" data-on="${index < 3}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:86px;border-radius:14px;transition:all .18s;${index < 3 ? "background:#fff3d1;border:1px solid #ffc93c;color:#a8792a" : "background:#faf7ff;border:1px dashed #e6cf9a;color:#a5946f"}"><i class="${index < 3 ? "ph-fill ph-image" : "ph ph-plus"}" style="font-size:21px"></i><span style="font-size:12px;font-weight:800">${index < 3 ? "Added" : "Photo"}</span></button>`).join("")}</div>
          <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Sector map <span style="font-weight:700;text-transform:none;letter-spacing:0;color:#a5946f">· optional</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:11px">${sectorMaps.map((sheet) => `<button type="button" style="display:flex;align-items:center;gap:8px;padding:11px 15px;border-radius:12px;font-size:14.5px;font-weight:800;background:#faf7ff;border:1px solid #dcd0f3;color:#6b6156"><i class="ph-fill ph-map-trifold" style="font-size:15px"></i>${esc(sheet)}</button>`).join("")}</div>
        </div>
        <div style="display:flex;align-items:center;gap:11px;padding:16px 26px;border-top:1px solid #e4dbf7;background:#faf7ff"><div style="flex:1;font-size:13.5px;color:#8d8271">Saved as a draft until you publish it.</div><button type="button" data-act="close-add" style="padding:15px 22px;border-radius:14px;background:#f0eaff;color:#6b6156;font-size:15.5px;font-weight:700">Cancel</button><button id="pm-save-plot" type="submit" disabled style="padding:15px 26px;border-radius:14px;background:#ddd2f5;color:#b3a37a;font-size:15.5px;font-weight:800">Save plot</button></div>
      </form>
    </div>`;
  };

  const addMarkup = (cities: string[]) =>
    `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.38);backdrop-filter:blur(4px);z-index:100;display:grid;place-items:center;padding:22px"><form id="pm-add-plot" role="dialog" aria-modal="true" aria-labelledby="pm-add-plot-title" style="width:min(720px,96vw);max-height:92vh;overflow:auto;background:#fffaf0;border-radius:26px;box-shadow:0 40px 90px -36px rgba(20,14,2,.85)"><div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #f0dfb8"><span style="width:48px;height:48px;border-radius:14px;background:#ffc93c;color:#241d0c;display:grid;place-items:center"><i class="ph-fill ph-house-line" style="font-size:24px"></i></span><div style="flex:1"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8d8271">Add a property</div><h2 id="pm-add-plot-title" style="margin:3px 0 0;font-family:'Newsreader',serif;font-size:28px;font-weight:500">The basics first</h2></div><button type="button" data-act="close-add" aria-label="Close" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156"><i class="ph-bold ph-x"></i></button></div><div style="padding:26px;display:grid;grid-template-columns:1fr 1fr;gap:16px"><label style="font-size:13px;font-weight:800;color:#6b6156">City<select name="city" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px">${cities.map((item) => `<option>${esc(item)}</option>`).join("")}</select></label><label style="font-size:13px;font-weight:800;color:#6b6156">Area<input name="area" required placeholder="Eco City" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label><label style="font-size:13px;font-weight:800;color:#6b6156">Type<select name="type" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"><option>Residential Plot</option><option>Flat</option><option>Kothi</option><option>Villa</option><option>Commercial</option></select></label><label style="font-size:13px;font-weight:800;color:#6b6156">Size<input name="size" required placeholder="300 sq yd" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label><label style="font-size:13px;font-weight:800;color:#6b6156">Facing<select name="facing" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"><option>East</option><option>West</option><option>North</option><option>South</option><option>North-East</option></select></label><label style="font-size:13px;font-weight:800;color:#6b6156">Price<input name="price" inputmode="numeric" value="5000000" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label></div><div style="display:flex;justify-content:flex-end;padding:18px 26px;border-top:1px solid #f0dfb8"><button type="submit" style="height:50px;padding:0 28px;border-radius:13px;background:#12a150;color:#fff;font-size:16px;font-weight:800"><i class="ph-fill ph-check-circle"></i> Save property</button></div></form></div>`;

  el.addEventListener("input", (event) => {
    if (!addOpen) return;
    const form = (event.target as HTMLElement).closest<HTMLFormElement>("#pm-add-plot");
    if (!form) return;
    const cityField = form.elements.namedItem("city") as HTMLInputElement | null;
    const areaField = form.elements.namedItem("area") as HTMLInputElement | null;
    const save = form.querySelector<HTMLButtonElement>("#pm-save-plot");
    const ready = Boolean(cityField?.value.trim() || areaField?.value.trim());
    if (save) {
      save.disabled = !ready;
      save.style.background = ready ? "#ffc93c" : "#ddd2f5";
      save.style.color = ready ? "#1f1a12" : "#b3a37a";
      save.style.boxShadow = ready ? "0 14px 26px -16px rgba(168,121,42,.95)" : "none";
    }
  });

  el.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement;
    if (form.id !== "pm-add-plot") return;
    event.preventDefault();
    const data = new FormData(form);
    const type = String(data.get("type") || "Residential Plot") as PropertyType;
    const area = String(data.get("area") || "New property");
    const propertyCity = String(data.get("city") || "New Chandigarh");
    properties.unshift({
      id: `local-${Date.now()}`,
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
      size: String(data.get("size") || ""),
      facing: String(data.get("facing") || "East") as Facing,
      position: "Inside plot",
      approvals: [],
      landmarks: [],
      price: (Number(data.get("price") || 0) || 0) * 10_000_000,
      photos: [],
      published: false,
      sold: false,
      views: 0,
    });
    addOpen = false;
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
    if (action === "plot-type") {
      const form = target.closest<HTMLFormElement>("#pm-add-plot");
      const hidden = form?.elements.namedItem("type") as HTMLInputElement | null;
      if (hidden) hidden.value = target.dataset.value || "Residential Plot";
      form?.querySelectorAll<HTMLElement>('[data-act="plot-type"]').forEach((button) => {
        const on = button === target;
        button.style.background = on ? "#241d0c" : "#faf7ff";
        button.style.color = on ? "#ffd75e" : "#6b6156";
        button.style.borderColor = on ? "#241d0c" : "#dcd0f3";
      });
      return;
    }
    if (action === "plot-photo") {
      const on = target.dataset.on === "true";
      target.dataset.on = String(!on);
      target.style.background = on ? "#faf7ff" : "#fff3d1";
      target.style.border = on ? "1px dashed #e6cf9a" : "1px solid #ffc93c";
      target.style.color = on ? "#a5946f" : "#a8792a";
      target.innerHTML = `<i class="${on ? "ph ph-plus" : "ph-fill ph-image"}" style="font-size:21px"></i><span style="font-size:12px;font-weight:800">${on ? "Photo" : "Added"}</span>`;
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
    if (action === "add") addOpen = true;
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
