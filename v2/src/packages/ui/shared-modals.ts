import { Property, PropertyType, WantType, Facing, ClientLink, Client } from '../data/types';
import { getMaps, mountMapEngine, addPropertyToMap, type MountedMap } from '../maps';
import { formatINR } from './utils';

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export class AddPropertyFlow {
  private el: HTMLElement;
  private addStep = 1;
  private mapToggle: 'masterplan' | 'sector' = 'masterplan';
  private activeMap: MountedMap | null = null;
  private selectedMapPin: { mapId: string, x: number, y: number } | null = null;
  private addForm = {
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
  private onComplete: (p: Property) => void;
  private onClose: () => void;
  private allCities: string[];

  constructor(allCities: string[], onComplete: (p: Property) => void, onClose: () => void) {
    this.allCities = allCities;
    this.onComplete = onComplete;
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.id = 'pm-add-property-flow';
    this.attachEvents();
  }

  public mount(container: HTMLElement) {
    container.appendChild(this.el);
    this.render();
  }

  public unmount() {
    if (this.activeMap) {
      this.activeMap.dispose();
      this.activeMap = null;
    }
    this.el.remove();
  }

  private render() {
    const inputStyle = "display:block;width:100%;height:46px;margin-top:7px;border:1px solid #e6c980;border-radius:11px;background:#fff;padding:0 14px;font-size:15px;color:#241f1c;outline:none";
    const labelStyle = "display:block;font-size:13px;font-weight:700;color:#6b6156";
    // Standard mock photos
    const previewPhotos = ["/assets/ph-plot-1.png", "/assets/ph-plot-2.png", "/assets/ph-plot-3.png", "/assets/ph-plot-1.png", "/assets/ph-plot-2.png", "/assets/ph-plot-3.png"];
    const cityOptions = [...new Set([this.addForm.city, ...this.allCities])];
    
    const step = (number: number, label: string) => {
      const complete = number < this.addStep;
      const active = number === this.addStep;
      return `<button type="button" data-act="add-step" data-step="${number}" style="display:flex;align-items:center;gap:10px;color:${active ? "#241f1c" : "#6b6156"};font-size:14px;font-weight:${active ? "800" : "600"};white-space:nowrap"><span style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid ${complete ? "#e5a90e" : active ? "#6b3fd4" : "#d9d1c3"};background:${complete ? "#e5a90e" : active ? "#6b3fd4" : "#fff"};color:${complete || active ? "#fff" : "#6b6156"};font-weight:800">${complete ? '<i class="ph-bold ph-check" style="font-size:15px"></i>' : number}</span>${label}</button>`;
    };
    
    const preview = `<aside style="min-width:0;border-radius:18px;background:#241904;background-image:radial-gradient(80% 56% at 92% 0%,rgba(145,97,0,.55),transparent 72%),linear-gradient(145deg,#3a2605,#171006);color:#fff8e6;padding:17px;box-shadow:0 18px 42px -28px rgba(20,14,2,.9);display:flex;flex-direction:column;align-self:stretch">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800"><i class="ph ph-eye" style="font-size:20px"></i>Client Preview</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:23px"><div><div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#ffd75e;text-transform:uppercase">${esc(this.addForm.city)}</div><div id="pm-add-preview-title" style="font-family:'Newsreader',serif;font-size:28px;font-weight:500;line-height:1.05;margin-top:4px">${esc(this.addForm.title)}</div><div id="pm-add-preview-location" style="font-size:13.5px;color:#e4c98a;margin-top:7px">${esc(this.addForm.area)}, ${esc(this.addForm.city)}</div></div><span style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.1);font-size:11px;font-weight:800;white-space:nowrap"><i class="ph-fill ph-seal-check" style="font-size:15px;color:#55dd8a"></i>RERA + GMADA approved</span></div>
      <div style="height:176px;border-radius:14px;margin-top:14px;position:relative;overflow:hidden;background:#d8d2c5 url('${esc(previewPhotos[0] || "/assets/ph-plot-1.png")}') center/cover"><button type="button" aria-label="Previous photo" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#fffaf0;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-caret-left"></i></button><button type="button" aria-label="Next photo" style="position:absolute;right:9px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#fffaf0;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-caret-right"></i></button></div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:-1px">${Array.from({ length: 6 }, (_, index) => `<span style="height:42px;border-radius:7px;background:#d8d2c5 url('${esc(previewPhotos[index % previewPhotos.length] || "/assets/ph-plot-1.png")}') center/cover;border:${index === 0 ? "2px solid #ffc400" : "1px solid rgba(255,255,255,.24)"}"></span>`).join("")}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px">${[["Plot size", this.addForm.size], ["Facing", this.addForm.facing], ["Position", this.addForm.position], ["Sector", this.addForm.sector]].map(([label, value]) => `<div style="border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.07);padding:9px 11px"><div style="font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#c9b477">${label}</div><div style="font-family:'Newsreader',serif;font-size:18px;line-height:1.1;margin-top:3px">${esc(value)}</div></div>`).join("")}</div>
      <div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffd75e;margin-top:10px">What is close by</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:7px">${[["ph-graduation-cap", "Chandigarh University", "10 min"], ["ph-storefront", "CP67 Mall", "8 min"], ["ph-first-aid-kit", "PGIMER Hospital", "22 min"]].map(([icon, name, time]) => `<div style="display:flex;align-items:center;gap:9px;border-radius:9px;background:rgba(255,255,255,.07);padding:8px 10px;font-size:11.5px;font-weight:700"><i class="ph-fill ${icon}" style="font-size:15px;color:#ffd75e"></i><span style="flex:1">${name}</span><span style="color:#55dd8a">${time}</span></div>`).join("")}</div>
    </aside>`;
    
    const basics = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);padding:24px"><div style="display:flex;align-items:center;gap:13px"><span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-map-pin-area" style="font-size:22px"></i></span><h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Property Basics</h3></div><div style="margin-top:21px"><label style="${labelStyle}">Property title <b style="color:#db3d53">*</b><input name="title" value="${esc(this.addForm.title)}" style="${inputStyle}"></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:17px"><label style="${labelStyle}">City <b style="color:#db3d53">*</b><select name="city" style="${inputStyle}">${cityOptions.map((item) => `<option ${item === this.addForm.city ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></label><label style="${labelStyle}">Area / Sector <b style="color:#db3d53">*</b><input name="area" value="${esc(this.addForm.area)}" style="${inputStyle}"></label><label style="${labelStyle}">Plot size <b style="color:#db3d53">*</b><input name="size" value="${esc(this.addForm.size)}" style="${inputStyle}"></label><label style="${labelStyle}">Facing <b style="color:#db3d53">*</b><select name="facing" style="${inputStyle}">${["North-East", "East", "West", "North", "South", "North-West", "South-East", "South-West"].map((item) => `<option ${item === this.addForm.facing ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Position <b style="color:#db3d53">*</b><select name="position" style="${inputStyle}">${["Park facing", "Corner plot", "Inside plot", "Road facing"].map((item) => `<option ${item === this.addForm.position ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Sector<input name="sector" value="${esc(this.addForm.sector)}" style="${inputStyle}"></label></div></div></section>`;
    
    const details = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);padding:20px 24px"><div style="display:flex;align-items:center;gap:13px"><span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-image" style="font-size:22px"></i></span><h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Photos &amp; Details</h3></div><div style="margin-top:14px;font-size:13px;font-weight:700;color:#4c463d">Main photo (cover image) <b style="color:#db3d53">*</b></div><button type="button" data-act="plot-photo" style="width:100%;height:78px;margin-top:7px;border:1px dashed #c9b8d8;border-radius:11px;background:#fbf8ff;color:#4c463d;display:flex;align-items:center;justify-content:center;gap:12px"><i class="ph ph-upload-simple" style="font-size:28px;color:#6b3fd4"></i><span style="text-align:left"><b style="display:block;font-size:13px">Upload cover photo <span style="font-weight:500">or drag &amp; drop</span></b><small style="display:block;margin-top:3px;color:#8d8271">Recommended size: 16:9 or 4:3</small></span></button><div style="margin-top:12px;font-size:13px;font-weight:700;color:#4c463d">Gallery photos</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:7px">${Array.from({ length: 6 }, (_, index) => index < 2 ? `<button type="button" data-act="plot-photo" style="height:85px;border-radius:10px;position:relative;background:url('${esc(previewPhotos[index] || "/assets/ph-plot-1.png")}') center/cover"><span style="position:absolute;right:5px;top:5px;width:22px;height:22px;border-radius:50%;background:#fff;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-x" style="font-size:11px"></i></span></button>` : index === 5 ? `<button type="button" data-act="plot-photo" style="height:85px;border:1px solid #7b4ee5;border-radius:10px;background:#fbf8ff;color:#6b3fd4;display:grid;place-items:center"><span><i class="ph ph-plus" style="display:block;font-size:25px"></i><small style="font-size:11px">Add more</small></span></button>` : `<button type="button" data-act="plot-photo" style="height:85px;border:1px dashed #d7ccbd;border-radius:10px;background:#faf8f5;color:#b7ada1;display:grid;place-items:center"><i class="ph ph-image" style="font-size:25px"></i></button>`).join("")}</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:14px"><label style="${labelStyle}">Property type <b style="color:#db3d53">*</b><select name="type" style="${inputStyle}">${["Residential Plot", "Flat", "Floor", "Kothi", "Villa", "Commercial"].map((item) => `<option ${item === this.addForm.type ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Listing status <b style="color:#db3d53">*</b><select name="status" style="${inputStyle}"><option>Available</option><option>Draft</option></select></label><label style="${labelStyle}">Possession <b style="color:#db3d53">*</b><select name="possession" style="${inputStyle}"><option>Ready to build</option><option>Immediate</option><option>Later</option></select></label></div><label style="${labelStyle};margin-top:13px">Property description <b style="color:#db3d53">*</b><textarea name="description" maxlength="500" rows="3" style="display:block;width:100%;margin-top:7px;border:1px solid #e6c980;border-radius:11px;background:#fff;padding:11px 14px;font-size:13px;line-height:1.45;color:#241f1c;outline:none;resize:none">${esc(this.addForm.description)}</textarea><span style="display:block;text-align:right;font-size:11px;font-weight:500;color:#8d8271;margin-top:3px">${this.addForm.description.length} / 500</span></label><div style="font-size:13px;font-weight:700;color:#4c463d;margin-top:8px">Nearby places</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:7px">${[["ph-graduation-cap", "Chandigarh University", "10 min"], ["ph-storefront", "CP67 Mall", "8 min"], ["ph-first-aid-kit", "PGIMER Hospital", "22 min"]].map(([icon, name, time]) => `<span style="display:flex;align-items:center;gap:8px;height:40px;border:1px solid #eadfc9;border-radius:9px;padding:0 10px;font-size:10.5px;font-weight:700"><i class="ph-fill ${icon}" style="font-size:15px;color:#e5a90e"></i><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span><b style="color:#12a150">${time}</b></span>`).join("")}</div></section>`;
    
    const mapLocation = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);display:flex;flex-direction:column;overflow:hidden;height:100%">
      <div style="flex:none;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #eadfc9">
        <div style="display:flex;align-items:center;gap:13px">
          <span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-map-pin" style="font-size:22px"></i></span>
          <div>
            <h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Map Location</h3>
            <p style="margin:3px 0 0;color:#8d8271;font-size:13px">Click on the map below to drop a pin for this property.</p>
          </div>
        </div>
        <div style="display:flex;background:#f0eaff;border-radius:11px;padding:4px">
           <button type="button" data-act="toggle-map" data-kind="sector" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;${this.mapToggle === 'sector' ? 'background:#fff;color:#6b3fd4;box-shadow:0 2px 4px rgba(0,0,0,.05)' : 'color:#6b6156'}">Sector Map</button>
           <button type="button" data-act="toggle-map" data-kind="masterplan" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;${this.mapToggle === 'masterplan' ? 'background:#fff;color:#6b3fd4;box-shadow:0 2px 4px rgba(0,0,0,.05)' : 'color:#6b6156'}">Masterplan</button>
        </div>
      </div>
      <div style="flex:1;min-height:400px;position:relative;background:#e7e0d2">
        <div id="pm-add-map" style="position:absolute;inset:0"></div>
        <div style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);background:rgba(28,21,51,.8);color:#fff;padding:8px 16px;border-radius:99px;font-size:13px;font-weight:600;pointer-events:none;z-index:20">
          ${this.selectedMapPin ? `Pin placed on ${this.selectedMapPin.mapId}` : 'Click map to place pin'}
        </div>
      </div>
    </section>`;

    const body = this.addStep === 1 ? basics : this.addStep === 2 ? details : mapLocation;
    const primaryLabel = this.addStep === 2 ? "Next" : "Add Property";
    const primaryAction = this.addStep === 2 ? "add-next" : "add-submit";

    this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;overflow:hidden">
      <div data-act="close-add" style="position:absolute;inset:0;background:rgba(33,29,25,.45);backdrop-filter:blur(5px);animation:omVeil .2s ease both"></div>
      <form id="pm-add-plot" role="dialog" aria-modal="true" aria-labelledby="pm-add-title" style="position:relative;width:min(1140px,calc(100vw - 48px));height:min(830px,calc(100vh - 48px));min-height:590px;border-radius:24px;background:#fffaf0;box-shadow:0 30px 80px -30px rgba(20,14,2,.75);overflow:hidden;display:flex;flex-direction:column;animation:omSheet .32s cubic-bezier(.2,.8,.2,1) both">
        <header style="height:104px;flex:none;display:flex;align-items:center;gap:18px;padding:0 30px;border-bottom:1px solid #eadfc9">
          <span style="width:58px;height:58px;border-radius:16px;background:#6b3fd4;background-image:linear-gradient(145deg,#8557eb,#5b32c4);color:#fff;display:grid;place-items:center;box-shadow:0 13px 26px -16px rgba(91,50,196,.9)"><i class="ph ph-hand-heart" style="font-size:30px"></i></span>
          <div style="flex:1">
            <h2 id="pm-add-title" style="margin:0;font-family:'Newsreader',serif;font-size:33px;font-weight:500;letter-spacing:-.025em">Add Property</h2>
            <p style="margin:3px 0 0;color:#6b6156;font-size:14px">Create a client-ready property in 3 simple steps</p>
          </div>
          <button type="button" data-act="close-add" aria-label="Close Add Property" style="width:48px;height:48px;border-radius:14px;background:#f0eaff;color:#6b6156;display:grid;place-items:center"><i class="ph ph-x" style="font-size:20px"></i></button>
        </header>
        <div data-scroll style="flex:1;min-height:0;overflow:auto;padding:22px 30px 18px">
          <div style="display:flex;align-items:center;gap:14px;max-width:650px">${step(1, "Property Basics")}<span style="height:1px;flex:1;background:#ddd4c6"></span>${step(2, "Photos & Details")}<span style="height:1px;flex:1;background:#ddd4c6"></span>${step(3, "Map Location")}</div>
          <div style="display:grid;${this.addStep === 3 ? 'grid-template-columns:1fr;' : 'grid-template-columns:minmax(0,1.48fr) minmax(330px,.92fr);'}gap:30px;margin-top:20px;align-items:stretch;height:${this.addStep === 3 ? 'calc(100% - 70px)' : 'auto'}">${body}${this.addStep === 3 ? '' : preview}</div>
        </div>
        <footer style="height:104px;flex:none;display:flex;align-items:center;gap:16px;padding:0 30px;border-top:1px solid #eadfc9;background:rgba(255,250,240,.96)">
          <button type="button" data-act="add-back" style="display:flex;align-items:center;gap:8px;height:54px;padding:0 20px;border-radius:12px;background:#f0eaff;color:#4c463d;font-size:15px;font-weight:700"><i class="ph ph-arrow-left"></i>Back</button>
          <div style="flex:1"></div>
          <button type="button" data-act="save-draft" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:185px;padding:0 22px;border:1px solid #e6c980;border-radius:12px;background:#fffaf0;color:#6b3fd4;font-size:15px;font-weight:800"><i class="ph ph-floppy-disk" style="font-size:20px"></i>Save Draft</button>
          <button type="${primaryAction === "add-submit" ? "submit" : "button"}" data-act="${primaryAction}" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:220px;padding:0 26px;border-radius:12px;background:#6b3fd4;background-image:linear-gradient(120deg,#7d49e8,#5b32c4);color:#fff;font-size:16px;font-weight:800;box-shadow:0 16px 28px -18px rgba(91,50,196,.9)">${this.addStep === 2 ? "" : '<i class="ph-fill ph-plus-circle" style="font-size:20px"></i>'}${primaryLabel}${this.addStep === 2 ? '<i class="ph ph-arrow-right"></i>' : ""}</button>
        </footer>
      </form>
    </div>`;

    if (this.activeMap) {
      this.activeMap.dispose();
      this.activeMap = null;
    }

    if (this.addStep === 3) {
      const mapEl = this.el.querySelector<HTMLElement>('#pm-add-map');
      const maps = getMaps();
      const masterplanMap = maps.find((m) => m.kind === 'masterplan' && m.city === this.addForm.city) || maps.find(m => m.kind === 'masterplan');
      const sectorMap = maps.find((m) => m.kind === 'sector' && m.sectorOrBlock === this.addForm.sector) || maps.find(m => m.kind === 'sector');
      
      const targetMap = (this.mapToggle === 'masterplan' ? masterplanMap : sectorMap) || masterplanMap;
      if (mapEl && targetMap) {
        this.activeMap = mountMapEngine(mapEl);
        this.activeMap.engine.setMap(targetMap.id, { mode: 'original' });
        
        const pinLayer = document.createElement('div');
        pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;transform-origin:0 0';
        mapEl.appendChild(pinLayer);

        if (this.selectedMapPin && this.selectedMapPin.mapId === targetMap.id) {
          const px = this.selectedMapPin.x * targetMap.original.dims.w;
          const py = this.selectedMapPin.y * targetMap.original.dims.h;
          pinLayer.innerHTML = `<div style="position:absolute;left:${px}px;top:${py}px;width:16px;height:16px;border-radius:50%;background:#6b3fd4;border:3px solid #fff;transform:translate(-50%,-50%);box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>`;
        }

        mapEl.addEventListener('click', (e) => {
          const t = this.activeMap?.engine.transform;
          if (!t || !targetMap) return;
          const rect = mapEl.getBoundingClientRect();
          const xScreen = e.clientX - rect.left;
          const yScreen = e.clientY - rect.top;
          
          const xIntrinsic = (xScreen - t.tx) / t.scale;
          const yIntrinsic = (yScreen - t.ty) / t.scale;
          
          this.selectedMapPin = {
            mapId: targetMap.id,
            x: xIntrinsic / targetMap.original.dims.w,
            y: yIntrinsic / targetMap.original.dims.h
          };
          this.render();
        });

        const updatePin = () => {
          if (!this.activeMap) return;
          const t = this.activeMap.engine.transform;
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
  }

  private attachEvents() {
    this.el.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!target.closest("#pm-add-plot") || !(target.name in this.addForm)) return;
      this.addForm = { ...this.addForm, [target.name as keyof typeof this.addForm]: target.value } as any;
      if (target.name === "title") {
        const title = this.el.querySelector<HTMLElement>("#pm-add-preview-title");
        if (title) title.textContent = target.value;
      }
      if (target.name === "city" || target.name === "area") {
        const locationLabel = this.el.querySelector<HTMLElement>("#pm-add-preview-location");
        if (locationLabel) locationLabel.textContent = `${this.addForm.area}, ${this.addForm.city}`;
      }
    });

    this.el.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      if (form.id !== "pm-add-plot") return;
      event.preventDefault();
      
      const type = this.addForm.type;
      const area = this.addForm.area || "New property";
      const propertyCity = this.addForm.city || "New Chandigarh";
      const newId = `local-${Date.now()}`;
      
      const property: Property = {
        id: newId,
        type,
        want: (type === "Residential Plot" ? "Plot" : type === "Floor" ? "Flat" : type) as WantType,
        city: propertyCity,
        area,
        loc: `${area}, ${propertyCity}`,
        sector: area,
        size: this.addForm.size,
        facing: this.addForm.facing as Facing,
        position: this.addForm.position,
        approvals: ["RERA", "GMADA"],
        landmarks: [
          { name: "Chandigarh University", distance: "10 min", icon: "ph-fill ph-graduation-cap" },
          { name: "CP67 Mall", distance: "8 min", icon: "ph-fill ph-storefront" },
          { name: "PGIMER Hospital", distance: "22 min", icon: "ph-fill ph-first-aid-kit" },
        ],
        price: 0,
        photos: ["/assets/ph-plot-1.png", "/assets/ph-plot-2.png", "/assets/ph-plot-3.png", "/assets/ph-plot-1.png", "/assets/ph-plot-2.png", "/assets/ph-plot-3.png"],
        published: false,
        sold: false,
        views: 0,
        mapPlacement: this.selectedMapPin || undefined
      };

      if (this.selectedMapPin) {
        addPropertyToMap(this.selectedMapPin.mapId, newId);
      }
      this.onComplete(property);
    });

    this.el.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (!target) return;
      
      const action = target.dataset.act;
      if (action === "toggle-map") {
        this.mapToggle = target.dataset.kind as 'masterplan' | 'sector';
        this.render();
        return;
      }
      if (action === "add-step") {
        this.addStep = Math.max(1, Math.min(3, Number(target.dataset.step) || 1));
        this.render();
      } else if (action === "add-next") {
        this.addStep = Math.min(3, this.addStep + 1);
        this.render();
      } else if (action === "add-back") {
        if (this.addStep > 1) this.addStep -= 1;
        else this.onClose();
        this.render();
      } else if (action === "save-draft") {
        const form = target.closest<HTMLFormElement>("#pm-add-plot");
        form?.requestSubmit();
      } else if (action === "close-add") {
        this.onClose();
      }
    });
  }
}

export class AddClientFlow {
  private el: HTMLElement;
  private form = { name: '', phone: '', want: 'Plot' as WantType, city: 'Mohali', budgetFrom: '', budgetTo: '', note: '' };
  private onComplete: (c: Client) => void;
  private onClose: () => void;

  constructor(onComplete: (c: Client) => void, onClose: () => void) {
    this.onComplete = onComplete;
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.id = 'pm-add-client-flow';
    this.attachEvents();
  }

  public mount(container: HTMLElement) {
    container.appendChild(this.el);
    this.render();
  }

  public unmount() {
    this.el.remove();
  }

  private render() {
    const wants: WantType[] = ['Plot', 'Flat', 'Kothi', 'Villa', 'Commercial'];
    const ready = Boolean(this.form.name.trim());
    this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:84;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-add" style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div><form id="pm-add-client" style="position:relative;width:100%;max-width:580px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #e4dbf2,0 40px 80px -30px rgba(40,26,2,.8);overflow:hidden;animation:omSheet .34s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #ece5f8;background:#efe8fb"><span style="width:46px;height:46px;border-radius:14px;background:#6b3fd4;color:#fff;display:grid;place-items:center;flex:none"><i class="ph-fill ph-user-plus" style="font-size:24px"></i></span><div style="flex:1;min-width:0"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Add a customer</div><div style="font-size:14px;color:#6b5b8a">Name and phone is enough to start.</div></div><button type="button" data-act="close-add" style="width:38px;height:38px;border-radius:12px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:16px"></i></button></div>
      <div data-scroll style="padding:22px 26px;max-height:62vh;overflow-y:auto"><div style="display:flex;flex-direction:column;gap:12px"><input name="name" value="${esc(this.form.name)}" placeholder="Full name" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16.5px;font-weight:600;color:#241f1c;outline:none"><input name="phone" value="${esc(this.form.phone)}" placeholder="Phone number" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16.5px;color:#241f1c;outline:none"></div><div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">What do they want</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:11px">${wants.map((want) => `<button type="button" data-act="want" data-want="${want}" style="padding:11px 15px;border-radius:12px;font-size:14.5px;font-weight:700;${this.form.want === want ? 'background:#6b3fd4;color:#fff;border:1px solid #6b3fd4' : 'background:#faf7ff;color:#6b6156;border:1px solid #ddd0f5'}">${want}</button>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px"><input name="city" value="${esc(this.form.city)}" placeholder="City" style="padding:15px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16px;color:#241f1c;outline:none"><div style="display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff"><input name="budgetFrom" value="${esc(this.form.budgetFrom)}" placeholder="Budget" style="flex:1;min-width:0;border:none;outline:none;background:none;padding:15px 0;font-size:16px;color:#241f1c"><span style="font-size:14px;color:#8d8271">to</span><input name="budgetTo" value="${esc(this.form.budgetTo)}" placeholder="Cr" style="width:56px;border:none;outline:none;background:none;padding:15px 0;font-size:16px;color:#241f1c"></div></div><textarea name="note" rows="3" placeholder="Any note — met at site, needs loan…" style="width:100%;margin-top:12px;padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16px;color:#241f1c;outline:none;resize:vertical">${esc(this.form.note)}</textarea></div>
      <div style="display:flex;align-items:center;gap:11px;padding:16px 26px;border-top:1px solid #ece5f8;background:#faf7ff"><div style="flex:1;font-size:13.5px;color:#8d8271">You can send them a link right after.</div><button type="button" data-act="close-add" style="padding:15px 22px;border-radius:14px;background:#f4f0fb;color:#6b6156;font-size:15.5px;font-weight:700">Cancel</button><button id="pm-save-client" type="submit" ${ready ? '' : 'disabled'} style="padding:15px 26px;border-radius:14px;font-size:15.5px;font-weight:800;${ready ? 'background:#6b3fd4;color:#fff' : 'background:#ddd2f5;color:#b3a37a'}">Save customer</button></div>
    </form></div>`;
  }

  private attachEvents() {
    this.el.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      if (target.name && target.name in this.form) {
        this.form = { ...this.form, [target.name as keyof typeof this.form]: target.value } as any;
        const save = this.el.querySelector<HTMLButtonElement>('#pm-save-client');
        if (save) {
          const ready = Boolean(this.form.name.trim());
          save.disabled = !ready;
          save.style.background = ready ? '#6b3fd4' : '#ddd2f5';
          save.style.color = ready ? '#fff' : '#b3a37a';
        }
      }
    });

    this.el.addEventListener('submit', (event) => {
      const target = event.target as HTMLFormElement;
      if (target.id !== 'pm-add-client') return;
      event.preventDefault();
      if (!this.form.name.trim()) return;
      const budget = this.form.budgetFrom && this.form.budgetTo ? `₹${this.form.budgetFrom}–${this.form.budgetTo} Cr` : this.form.budgetFrom ? `₹${this.form.budgetFrom} Cr+` : this.form.budgetTo ? `Up to ₹${this.form.budgetTo} Cr` : '—';
      
      const client: Client = { 
        id: `local-${Date.now()}`, 
        name: this.form.name.trim(), 
        phone: this.form.phone || '—', 
        city: this.form.city || 'Mohali', 
        want: this.form.want, 
        budget, 
        budgetMax: (Number(this.form.budgetTo || this.form.budgetFrom) || 0) * 10_000_000, 
        status: 'active', 
        seen: 'just now', 
        note: this.form.note, 
        viewed: [], 
        interest: [], 
        isNew: true 
      };
      this.onComplete(client);
    });

    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) return;
      const action = target.dataset.act;
      if (action === 'close-add') this.onClose();
      if (action === 'want') {
        this.form = { ...this.form, want: (target.dataset.want || 'Plot') as WantType };
        this.render();
      }
    });
  }
}

export class GenerateLinkFlow {
  private el: HTMLElement;
  private buildDone = false;
  private chosenClient = '';
  private chosenProps: string[] = [];
  
  private onComplete: (l: ClientLink) => void;
  private onClose: () => void;
  private clients: Client[];
  private properties: Property[];

  constructor(clients: Client[], properties: Property[], onComplete: (l: ClientLink) => void, onClose: () => void) {
    this.clients = clients;
    this.properties = properties;
    this.onComplete = onComplete;
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.id = 'pm-generate-link-flow';
    this.attachEvents();
  }

  public mount(container: HTMLElement) {
    container.appendChild(this.el);
    this.render();
  }

  public unmount() {
    this.el.remove();
  }

  private getInitials(name: string) {
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  private render() {
    if (this.buildDone) {
      const client = this.clients.find((item) => item.id === this.chosenClient);
      this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-build" style="position:fixed;inset:0;background:rgba(60,44,12,.58)"></div><div role="dialog" aria-modal="true" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 40px 80px -30px rgba(40,26,2,.8);padding:32px 30px"><div style="width:64px;height:64px;margin:0 auto;border-radius:20px;background:#dcf3e5;color:#12a150;display:grid;place-items:center"><i class="ph-fill ph-check-circle" style="font-size:34px"></i></div><div style="margin-top:16px;text-align:center;font-family:'Newsreader',serif;font-weight:500;font-size:28px;color:#241d0c">Link is ready</div><div style="margin-top:7px;text-align:center;font-size:15.5px;color:#6b6156">Private to ${esc(client?.name || 'this customer')} · ${this.chosenProps.length} plots</div><div style="display:flex;align-items:center;gap:10px;margin-top:22px;padding:15px 17px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><i class="ph-bold ph-link-simple" style="font-size:18px;color:#a8792a"></i><span style="flex:1;font-size:14.5px;font-weight:600;color:#4c463d">plotmap.in/p/${esc((client?.name || 'client').split(' ')[0]!.toLowerCase())}-ready</span></div><button data-act="close-build-done" style="width:100%;height:54px;margin-top:16px;border-radius:14px;background:#12a150;color:#fff;font-size:16px;font-weight:800">Done</button></div></div>`;
      return;
    }
    
    const ready = Boolean(this.chosenClient && this.chosenProps.length);
    this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-build" style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div><section role="dialog" aria-modal="true" aria-label="Send a private link" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 40px 80px -30px rgba(40,26,2,.8);overflow:hidden;animation:omSheet .34s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #ddeee4;background:#dcf3e5"><span style="width:46px;height:46px;border-radius:14px;background:#12704a;color:#fff;display:grid;place-items:center;flex:none"><i class="ph-fill ph-paper-plane-tilt" style="font-size:23px"></i></span><div style="flex:1;min-width:0"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Send a private link</div><div style="font-size:14px;color:#12704a">One page, only for them. Voice note optional.</div></div><button data-act="close-build" style="width:38px;height:38px;border-radius:12px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:16px"></i></button></div>
      <div data-scroll style="padding:22px 26px;max-height:60vh;overflow-y:auto"><div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Who is it for</div><div style="display:flex;flex-direction:column;gap:9px;margin-top:11px">${this.clients.map((client) => { const on = this.chosenClient === client.id; return `<button data-act="choose-client" data-id="${esc(client.id)}" style="display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;transition:all .16s;${on ? 'background:#dcf3e5;border:1px solid #12a150' : 'background:#faf7ff;border:1px solid #e4dbf7'}"><span style="width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800;${on ? 'background:#12704a;color:#fff' : 'background:#e2f2e6;color:#12704a'}">${this.getInitials(client.name)}</span><span style="flex:1;min-width:0;text-align:left"><span style="display:block;font-size:15.5px;font-weight:800;color:#2f2a2d">${esc(client.name)}</span><span style="display:block;font-size:13px;color:#8d8271">${esc(client.want)} · ${esc(client.city)}</span></span><i class="${on ? 'ph-fill ph-check-circle' : 'ph ph-circle'}" style="font-size:20px;color:#12a150;flex:none"></i></button>`; }).join('')}</div>
        <div style="margin-top:22px;display:flex;align-items:baseline;justify-content:space-between;gap:10px"><div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Which plots</div><div style="font-size:13.5px;font-weight:700;color:#12704a">${this.chosenProps.length ? `${this.chosenProps.length} ${this.chosenProps.length === 1 ? 'plot' : 'plots'} chosen` : 'Pick up to 4'}</div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:11px">${this.properties.slice(0, 8).map((property) => { const on = this.chosenProps.includes(property.id); return `<button data-act="choose-prop" data-id="${esc(property.id)}" style="position:relative;overflow:hidden;border-radius:14px;background:#faf7ff;border:2px solid ${on ? '#12a150' : '#e4dbf7'}"><span style="display:block;width:100%;height:70px;background:${property.photos[0] ? `url('${esc(property.photos[0])}') center/cover` : '#efe8fb'}"></span><span style="display:block;padding:9px 10px;font-size:12.5px;font-weight:700;text-align:left;line-height:1.3;color:#241f1c">${esc(property.loc)}</span>${on ? '<span style="position:absolute;top:7px;right:7px;width:24px;height:24px;border-radius:50%;background:#12a150;color:#fff;display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:13px"></i></span>' : ''}</button>`; }).join('')}</div>
        <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Your voice <span style="font-weight:700;text-transform:none;letter-spacing:0;color:#a5946f">· optional</span></div><button style="display:flex;align-items:center;justify-content:center;gap:11px;width:100%;height:64px;margin-top:11px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:17.5px;font-weight:800"><i class="ph-fill ph-microphone" style="font-size:22px"></i><span style="flex:1;text-align:left;font-size:15.5px;font-weight:800">Record a voice note for them</span></button></div>
      <div style="display:flex;align-items:center;gap:11px;padding:16px 26px;border-top:1px solid #ddeee4;background:#f4fbf6"><div style="flex:1;font-size:13.5px;color:#8d8271">${!this.chosenClient ? 'Pick a customer first' : !this.chosenProps.length ? 'Pick at least one plot' : 'Ready to send'}</div><button data-act="close-build" style="padding:15px 22px;border-radius:14px;background:#e8f2eb;color:#6b6156;font-size:15.5px;font-weight:700">Cancel</button><button data-act="send" ${ready ? '' : 'disabled'} style="display:flex;align-items:center;justify-content:center;gap:9px;padding:15px 24px;border-radius:14px;font-size:15.5px;font-weight:800;${ready ? 'background:#12a150;color:#fff;box-shadow:0 14px 26px -16px rgba(18,161,80,.95)' : 'background:#e8f2eb;color:#a5b8ac'}"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>Send link</button></div>
    </section></div>`;
  }

  private attachEvents() {
    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) return;
      
      const action = target.dataset.act;
      const id = target.dataset.id || '';
      
      if (action === 'close-build') {
        this.onClose();
      }
      
      if (action === 'close-build-done') {
        // We already pushed the link to onComplete during 'send', we just close now.
        this.onClose();
      }
      
      if (action === 'choose-client') {
        this.chosenClient = this.chosenClient === id ? '' : id;
        this.render();
      }
      
      if (action === 'choose-prop') {
        this.chosenProps = this.chosenProps.includes(id) 
          ? this.chosenProps.filter((item) => item !== id) 
          : this.chosenProps.length < 4 ? [...this.chosenProps, id] : this.chosenProps;
        this.render();
      }
      
      if (action === 'send' && this.chosenClient && this.chosenProps.length) {
        const client = this.clients.find((item) => item.id === this.chosenClient)!;
        const link: ClientLink = { 
          id: `local-${Date.now()}`, 
          clientId: client.id, 
          clientName: client.name, 
          props: [...this.chosenProps], 
          propNames: this.chosenProps.map((propId) => this.properties.find((property) => property.id === propId)?.area || propId), 
          expiry: '3d', 
          loc: 'area', 
          price: 'hidden', 
          audio: 'none', 
          audioSecs: 0, 
          status: 'active', 
          events: { opens: 0, played: 0, called: 0, wa: 0, visit: 0 }, 
          lastOpen: 'not opened yet' 
        };
        this.buildDone = true;
        this.render(); // Show the 'Link is ready' state
        this.onComplete(link);
      }
    });
  }
}
