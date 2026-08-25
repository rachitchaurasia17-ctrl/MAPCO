import { Property, PropertyType, WantType, Facing, Client, type PropertyPhotoStorageRef } from '../data/types';
import {
  getMap, registerMaps, mountMapEngine, addPropertyToMap, relatedMapPair,
  sectorMapsForCity, placementVisibleOn, renderingFor,
  type MountedMap, type MapCatalogInput, type MapEntry, type RenderMode,
} from '../maps';
import { formatINR } from './utils';
import { adapter } from '../data/adapter';
import { openPropertyDetail } from './property-detail';
import type { PredictiveRuntime } from '../performance';
import { propertyPhotoSelections, validatePropertyPhoto } from '../data/property-photos';

interface PendingPropertyPhoto { id: string; file: File; previewUrl: string; }

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

function mediaCacheMeta(src: string): { version: string; expiresAt?: number } {
  try {
    const url = new URL(src, location.href);
    const expires = Number(url.searchParams.get('expires') ?? url.searchParams.get('Expires'));
    const signed = url.pathname.includes('/sign/') || url.searchParams.has('token');
    return {
      version: `${url.pathname}:${Number.isFinite(expires) && expires > 0 ? expires : 'current'}`,
      ...(Number.isFinite(expires) && expires > 0
        ? { expiresAt: expires > 10_000_000_000 ? expires : expires * 1000 }
        : signed ? { expiresAt: Date.now() + 45 * 60_000 } : {}),
    };
  } catch { return { version: 'current' }; }
}

export class AddPropertyFlow {
  private el: HTMLElement;
  private addStep = 1;
  private propId: string | null = null;
  private mapToggle: 'masterplan' | 'sector' = 'masterplan';
  private mapMode: RenderMode = 'original';
  private activeMap: MountedMap | null = null;
  private pinFrame = 0;
  private selectedMapPin: { mapId: string, x: number, y: number } | null = null;
  private selectedSectorMapId = '';
  private placementCatalog: MapEntry[] = [];
  private mapLoadError = '';
  private coverPhoto: PendingPropertyPhoto | null = null;
  private galleryPhotos: PendingPropertyPhoto[] = [];
  private saving = false;
  private photoError = '';
  private addForm = {
    city: "",
    area: "",
    size: "",
    price: "",
    facing: "" as Facing | '',
    position: "",
    sector: "",
    type: "" as PropertyType | '',
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
    void this.loadCatalog();
  }

  /** Load the dealer-scoped editor catalog; never mix it with static pilot fallbacks. */
  private async loadCatalog() {
    try {
      const r = await adapter.maps.listPlacementCatalog({ limit: 300 });
      if (!r.ok) {
        this.mapLoadError = r.error.message;
      } else {
        const inputs = r.value.items as unknown as MapCatalogInput[];
        registerMaps(inputs);
        this.placementCatalog = inputs
          .map((item) => getMap(item.id))
          .filter((item): item is MapEntry => !!item);
        this.mapLoadError = '';
        this.syncSectorSelection();
      }
      this.render();
    } catch {
      this.mapLoadError = 'Map catalog could not be loaded.';
      this.render();
    }
  }

  private syncSectorSelection() {
    const candidates = sectorMapsForCity(this.placementCatalog, this.addForm.city);
    const current = candidates.find((map) => map.id === this.selectedSectorMapId);
    if (!current) this.selectedSectorMapId = candidates.length === 1 ? candidates[0]!.id : '';
    const selected = candidates.find((map) => map.id === this.selectedSectorMapId);
    if (selected) this.addForm.sector = selected.sectorOrBlock || selected.title;
  }

  public unmount() {
    if (this.pinFrame) cancelAnimationFrame(this.pinFrame);
    this.pinFrame = 0;
    if (this.activeMap) {
      this.activeMap.dispose();
      this.activeMap = null;
    }
    this.releaseLocalPreviews();
    this.el.remove();
  }

  private releaseLocalPreviews() {
    if (this.coverPhoto) URL.revokeObjectURL(this.coverPhoto.previewUrl);
    this.galleryPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    this.coverPhoto = null;
    this.galleryPhotos = [];
  }

  private pendingPhoto(file: File): PendingPropertyPhoto {
    return { id: globalThis.crypto?.randomUUID?.() ?? `photo-${Date.now()}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) };
  }

  private selectCover(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    const error = validatePropertyPhoto(file);
    if (error) { this.photoError = error; this.render(); return; }
    if (this.coverPhoto) URL.revokeObjectURL(this.coverPhoto.previewUrl);
    this.coverPhoto = this.pendingPhoto(file);
    this.photoError = '';
    this.render();
  }

  private selectGallery(files: FileList | File[]) {
    let added = 0;
    for (const file of Array.from(files)) {
      const error = validatePropertyPhoto(file);
      if (error) { this.photoError = error; continue; }
      if (this.galleryPhotos.length >= 7) { this.photoError = 'A property can include up to 8 photos.'; break; }
      this.galleryPhotos.push(this.pendingPhoto(file));
      added += 1;
    }
    if (added && this.galleryPhotos.length <= 7) this.photoError = '';
    this.render();
  }

  private render() {
    const inputStyle = "display:block;width:100%;height:46px;margin-top:7px;border:1px solid #e6c980;border-radius:11px;background:#fff;padding:0 14px;font-size:15px;color:#241f1c;outline:none";
    const labelStyle = "display:block;font-size:13px;font-weight:700;color:#6b6156";
    const previewPhotos = [this.coverPhoto, ...this.galleryPhotos]
      .filter((photo): photo is PendingPropertyPhoto => !!photo).map((photo) => photo.previewUrl);
    const previewThumbs = previewPhotos.length
      ? previewPhotos.slice(0, 6).map((photo, index) => `<span style="height:42px;border-radius:7px;background:#d8d2c5 url('${esc(photo)}') center/cover;border:${index === 0 ? "2px solid #ffc400" : "1px solid rgba(255,255,255,.24)"}"></span>`).join("")
      : '<span style="grid-column:1 / -1;height:42px;border-radius:7px;background:rgba(255,255,255,.08);border:1px dashed rgba(255,255,255,.24);display:grid;place-items:center;color:#c9b477;font-size:11px;font-weight:800">No photos added</span>';
    const cityOptions = [...new Set([
      ...this.allCities,
      ...this.placementCatalog.map((map) => map.city),
    ].map((city) => city.trim()).filter(Boolean))];
    const sectorOptions = sectorMapsForCity(this.placementCatalog, this.addForm.city);
    const mapPair = relatedMapPair(this.placementCatalog, this.selectedSectorMapId);
    const targetMap = this.mapToggle === 'sector' ? mapPair?.sector : mapPair?.masterplan;
    
    const step = (number: number, label: string) => {
      const complete = number < this.addStep;
      const active = number === this.addStep;
      return `<button type="button" data-act="add-step" data-step="${number}" style="display:flex;align-items:center;gap:10px;color:${active ? "#241f1c" : "#6b6156"};font-size:14px;font-weight:${active ? "800" : "600"};white-space:nowrap"><span style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid ${complete ? "#e5a90e" : active ? "#6b3fd4" : "#d9d1c3"};background:${complete ? "#e5a90e" : active ? "#6b3fd4" : "#fff"};color:${complete || active ? "#fff" : "#6b6156"};font-weight:800">${complete ? '<i class="ph-bold ph-check" style="font-size:15px"></i>' : number}</span>${label}</button>`;
    };
    
    const previewTitle = [this.addForm.type, this.addForm.size].filter(Boolean).join(' · ') || 'Property details not entered';
    const previewLocation = [this.addForm.area, this.addForm.city].filter(Boolean).join(', ') || 'Location not entered';
    const previewImage = previewPhotos[0]
      ? `background:#d8d2c5 url('${esc(previewPhotos[0])}') center/cover`
      : 'background:rgba(255,255,255,.07);display:grid;place-items:center;color:#c9b477;font-size:13px;font-weight:800';
    const preview = `<aside style="min-width:0;border-radius:18px;background:#241904;background-image:radial-gradient(80% 56% at 92% 0%,rgba(145,97,0,.55),transparent 72%),linear-gradient(145deg,#3a2605,#171006);color:#fff8e6;padding:17px;box-shadow:0 18px 42px -28px rgba(20,14,2,.9);display:flex;flex-direction:column;align-self:stretch">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800"><i class="ph ph-eye" style="font-size:20px"></i>Client Preview</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:23px"><div><div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#ffd75e;text-transform:uppercase">${esc(this.addForm.city || 'City not entered')}</div><div id="pm-add-preview-title" style="font-family:'Newsreader',serif;font-size:28px;font-weight:500;line-height:1.05;margin-top:4px">${esc(previewTitle)}</div><div id="pm-add-preview-location" style="font-size:13.5px;color:#e4c98a;margin-top:7px">${esc(previewLocation)}</div></div></div>
      <div style="height:176px;border-radius:14px;margin-top:14px;position:relative;overflow:hidden;${previewImage}">${previewPhotos[0] ? '' : 'No property photo added'}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:-1px">${previewThumbs}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px">${[["Plot size", this.addForm.size], ["Facing", this.addForm.facing], ["Position", this.addForm.position], ["Sector", this.addForm.sector]].map(([label, value]) => `<div style="border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.07);padding:9px 11px"><div style="font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#c9b477">${label}</div><div style="font-family:'Newsreader',serif;font-size:18px;line-height:1.1;margin-top:3px">${esc(value)}</div></div>`).join("")}</div>
      <div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffd75e;margin-top:10px">Location context</div>
      <div style="margin-top:7px;border-radius:9px;background:rgba(255,255,255,.07);padding:10px 11px;font-size:11.5px;font-weight:600;line-height:1.4;color:#d8c8b0">Verified nearby places and road intelligence appear after the property has an Earth location.</div>
    </aside>`;
    
    const basics = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);padding:24px"><div style="display:flex;align-items:center;gap:13px"><span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-map-pin-area" style="font-size:22px"></i></span><h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Property Basics</h3></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:21px"><label style="${labelStyle}">City <b style="color:#db3d53">*</b><input name="city" list="pm-property-cities" value="${esc(this.addForm.city)}" placeholder="Enter city" style="${inputStyle}"><datalist id="pm-property-cities">${cityOptions.map((item) => `<option value="${esc(item)}"></option>`).join('')}</datalist></label><label style="${labelStyle}">Area / Sector <b style="color:#db3d53">*</b><input name="area" value="${esc(this.addForm.area)}" style="${inputStyle}"></label><label style="${labelStyle}">Plot size <b style="color:#db3d53">*</b><input name="size" value="${esc(this.addForm.size)}" style="${inputStyle}"></label><label style="${labelStyle}">Price (₹)<input name="price" inputmode="numeric" value="${esc(this.addForm.price)}" placeholder="e.g. 8500000" style="${inputStyle}"></label><label style="${labelStyle}">Facing <b style="color:#db3d53">*</b><select name="facing" style="${inputStyle}"><option value="">Choose facing</option>${["North-East", "East", "West", "North", "South", "North-West", "South-East", "South-West"].map((item) => `<option ${item === this.addForm.facing ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Position <b style="color:#db3d53">*</b><select name="position" style="${inputStyle}"><option value="">Choose position</option>${["Park facing", "Corner plot", "Inside plot", "Road facing"].map((item) => `<option ${item === this.addForm.position ? "selected" : ""}>${item}</option>`).join("")}</select></label><label style="${labelStyle}">Sector map<select name="sectorMapId" style="${inputStyle}" ${sectorOptions.length ? '' : 'disabled'}><option value="">${sectorOptions.length ? 'Choose sector map' : 'No sector map available'}</option>${sectorOptions.map((map) => `<option value="${esc(map.id)}" ${map.id === this.selectedSectorMapId ? 'selected' : ''}>${esc(map.title)}</option>`).join('')}</select></label><label style="${labelStyle}">Type <b style="color:#db3d53">*</b><select name="type" style="${inputStyle}"><option value="">Choose property type</option>${["Residential Plot", "Flat", "Floor", "Kothi", "Villa", "Commercial"].map((item) => `<option ${item === this.addForm.type ? "selected" : ""}>${item}</option>`).join("")}</select></label></div></section>`;
    
    // Step 2 — photos ONLY (no other fields).
    const gallerySlots = [
      ...this.galleryPhotos.map((photo, index) => `<div style="height:92px;border-radius:10px;position:relative;background:url('${esc(photo.previewUrl)}') center/cover"><button type="button" data-act="remove-photo" data-kind="gallery" data-index="${index}" aria-label="Remove gallery photo" style="position:absolute;right:5px;top:5px;width:22px;height:22px;border-radius:50%;background:#fff;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-x" style="font-size:11px"></i></button></div>`),
      ...Array.from({ length: Math.max(1, 6 - this.galleryPhotos.length) }, () => `<button type="button" data-act="choose-gallery" data-drop-kind="gallery" style="height:92px;border:1px dashed #d7ccbd;border-radius:10px;background:#faf8f5;color:#b7ada1;display:grid;place-items:center"><i class="ph ph-plus" style="font-size:24px"></i></button>`),
    ].join('');
    const coverStyle = this.coverPhoto ? `background:#d8d2c5 url('${esc(this.coverPhoto.previewUrl)}') center/cover` : 'background:#fbf8ff';
    const details = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);padding:24px"><div style="display:flex;align-items:center;gap:13px"><span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-image" style="font-size:22px"></i></span><h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Photos</h3></div><div style="margin-top:16px;font-size:13px;font-weight:700;color:#4c463d">Cover photo</div><button type="button" data-act="choose-cover" data-drop-kind="cover" style="width:100%;height:96px;margin-top:8px;border:1px dashed #c9b8d8;border-radius:12px;${coverStyle};color:#4c463d;display:flex;align-items:center;justify-content:center;gap:12px;position:relative">${this.coverPhoto ? `<span style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.2),transparent 45%)"></span><span style="position:relative;color:#fff;font-weight:800;text-shadow:0 1px 3px #000">Change cover photo</span><span data-act="remove-photo" data-kind="cover" role="button" aria-label="Remove cover photo" style="position:absolute;right:8px;top:8px;width:26px;height:26px;border-radius:50%;background:#fff;color:#241f1c;display:grid;place-items:center"><i class="ph-bold ph-x" style="font-size:12px"></i></span>` : `<i class="ph ph-upload-simple" style="font-size:30px;color:#6b3fd4"></i><span style="text-align:left"><b style="display:block;font-size:14px">Upload cover photo <span style="font-weight:500">or drag &amp; drop</span></b><small style="display:block;margin-top:3px;color:#8d8271">16:9 or 4:3 looks best</small></span>`}</button><input id="pm-cover-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden><div style="margin-top:16px;font-size:13px;font-weight:700;color:#4c463d">Gallery photos</div><div data-drop-kind="gallery" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px">${gallerySlots}</div><input id="pm-gallery-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><p style="margin-top:14px;font-size:13px;color:${this.photoError ? '#b3123a' : '#8d8271'}">${esc(this.photoError || 'Add multiple photos here. Next you will place the property on the map.')}</p></section>`;
    
    const mapStatus = this.mapLoadError
      || (!mapPair ? 'Choose an exact sector map in Property Basics.' : '')
      || (!targetMap ? 'This sector has no linked parent masterplan.' : '')
      || (this.mapMode === 'threeD' ? '3D view — switch to Original to place or view the pin.' : '')
      || (placementVisibleOn(this.selectedMapPin, targetMap, this.mapMode) ? `Pin placed on ${targetMap?.title ?? 'map'}` : 'Click map to place pin');
    const mapLocation = `<section style="border:1px solid #eadfc9;border-radius:18px;background:rgba(255,255,255,.68);display:flex;flex-direction:column;overflow:hidden;height:100%">
      <div style="flex:none;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #eadfc9">
        <div style="display:flex;align-items:center;gap:13px">
          <span style="width:44px;height:44px;border-radius:11px;background:#f0eaff;color:#6b3fd4;display:grid;place-items:center"><i class="ph ph-map-pin" style="font-size:22px"></i></span>
          <div>
            <h3 style="margin:0;font-family:'Newsreader',serif;font-size:22px;font-weight:600">Map Location</h3>
            <p style="margin:3px 0 0;color:#8d8271;font-size:13px">Click on the map below to drop a pin for this property.</p>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="display:flex;background:#f0eaff;border-radius:11px;padding:4px">
             <button type="button" data-act="toggle-map" data-kind="sector" ${mapPair ? '' : 'disabled'} style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;${this.mapToggle === 'sector' ? 'background:#fff;color:#6b3fd4;box-shadow:0 2px 4px rgba(0,0,0,.05)' : 'color:#6b6156'}">Sector Map</button>
             <button type="button" data-act="toggle-map" data-kind="masterplan" ${mapPair?.masterplan ? '' : 'disabled'} style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;${this.mapToggle === 'masterplan' ? 'background:#fff;color:#6b3fd4;box-shadow:0 2px 4px rgba(0,0,0,.05)' : 'color:#6b6156'}">Masterplan</button>
          </div>
          ${targetMap ? `<div style="display:flex;background:#f0eaff;border-radius:11px;padding:4px"><button type="button" data-act="map-mode" data-mode="original" style="padding:8px 13px;border-radius:8px;font-size:13px;font-weight:700;${this.mapMode === 'original' ? 'background:#fff;color:#6b3fd4;box-shadow:0 2px 4px rgba(0,0,0,.05)' : 'color:#6b6156'}">Original</button>${targetMap.threeD ? `<button type="button" data-act="map-mode" data-mode="threeD" style="padding:8px 13px;border-radius:8px;font-size:13px;font-weight:700;${this.mapMode === 'threeD' ? 'background:#fff;color:#6b3fd4;box-shadow:0 2px 4px rgba(0,0,0,.05)' : 'color:#6b6156'}">3D</button>` : ''}</div>` : ''}
        </div>
      </div>
      <div style="flex:1;min-height:400px;position:relative;background:#e7e0d2">
        <div id="pm-add-map" style="position:absolute;inset:0"></div>
        <div style="position:absolute;bottom:15px;left:50%;transform:translateX(-50%);background:rgba(28,21,51,.8);color:#fff;padding:8px 16px;border-radius:99px;font-size:13px;font-weight:600;pointer-events:none;z-index:20">
          ${esc(mapStatus)}
        </div>
      </div>
    </section>`;

    const body = this.addStep === 1 ? basics : this.addStep === 2 ? details : mapLocation;
    const primaryLabel = this.saving ? "Saving..." : this.addStep === 3 ? "Publish" : "Next";
    const primaryAction = this.addStep === 3 ? "add-submit" : "add-next";

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
          <div style="display:flex;align-items:center;gap:14px;max-width:650px">${step(1, "Details & price")}<span style="height:1px;flex:1;background:#ddd4c6"></span>${step(2, "Photos")}<span style="height:1px;flex:1;background:#ddd4c6"></span>${step(3, "Place on map")}</div>
          <div style="display:grid;grid-template-columns:1fr;gap:24px;margin-top:20px;align-items:stretch;height:${this.addStep === 3 ? 'calc(100% - 70px)' : 'auto'}">${body}</div>
        </div>
        <footer style="height:104px;flex:none;display:flex;align-items:center;gap:16px;padding:0 30px;border-top:1px solid #eadfc9;background:rgba(255,250,240,.96)">
          <button type="button" data-act="add-back" style="display:flex;align-items:center;gap:8px;height:54px;padding:0 20px;border-radius:12px;background:#f0eaff;color:#4c463d;font-size:15px;font-weight:700"><i class="ph ph-arrow-left"></i>Back</button>
          <div style="flex:1;color:#b3123a;font-size:13px;font-weight:700">${this.photoError && this.addStep !== 2 ? esc(this.photoError) : ''}</div>
          ${this.addStep === 3
            ? '<button type="button" data-act="add-preview" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:150px;padding:0 22px;border:1px solid #e6c980;border-radius:12px;background:#fffaf0;color:#6b3fd4;font-size:15px;font-weight:800"><i class="ph ph-eye" style="font-size:20px"></i>Preview</button>'
            : '<button type="button" data-act="save-draft" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:150px;padding:0 22px;border:1px solid #e6c980;border-radius:12px;background:#fffaf0;color:#6b3fd4;font-size:15px;font-weight:800"><i class="ph ph-floppy-disk" style="font-size:20px"></i>Save Draft</button>'}
          <button type="${primaryAction === "add-submit" ? "submit" : "button"}" data-act="${primaryAction}" ${this.saving ? 'disabled aria-busy="true"' : ''} style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;min-width:200px;padding:0 26px;border-radius:12px;background:#6b3fd4;background-image:linear-gradient(120deg,#7d49e8,#5b32c4);color:#fff;font-size:16px;font-weight:800;box-shadow:0 16px 28px -18px rgba(91,50,196,.9)"><i class="ph-fill ${this.addStep === 3 ? 'ph-broadcast' : 'ph-arrow-right'}" style="font-size:20px"></i>${primaryLabel}</button>
        </footer>
      </form>
    </div>`;

    if (this.pinFrame) cancelAnimationFrame(this.pinFrame);
    this.pinFrame = 0;
    if (this.activeMap) {
      this.activeMap.dispose();
      this.activeMap = null;
    }

    if (this.addStep === 3 && targetMap) {
      const mapEl = this.el.querySelector<HTMLElement>('#pm-add-map');
      if (mapEl && renderingFor(targetMap, this.mapMode)) {
        this.activeMap = mountMapEngine(mapEl);
        const mounted = this.activeMap;
        void mounted.engine.setMap(targetMap.id, { mode: this.mapMode });
        
        const pinLayer = document.createElement('div');
        pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;transform-origin:0 0';
        mapEl.appendChild(pinLayer);

        if (placementVisibleOn(this.selectedMapPin, targetMap, this.mapMode) && this.selectedMapPin) {
          const px = this.selectedMapPin.x * targetMap.original.dims.w;
          const py = this.selectedMapPin.y * targetMap.original.dims.h;
          pinLayer.innerHTML = `<div style="position:absolute;left:${px}px;top:${py}px;width:16px;height:16px;border-radius:50%;background:#6b3fd4;border:3px solid #fff;transform:translate(-50%,-50%);box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>`;
        }

        mapEl.addEventListener('click', (e) => {
          if (this.mapMode !== 'original' || this.activeMap !== mounted) return;
          const t = mounted.engine.transform;
          if (!t) return;
          const rect = mapEl.getBoundingClientRect();
          const xScreen = e.clientX - rect.left;
          const yScreen = e.clientY - rect.top;
          
          const xIntrinsic = (xScreen - t.tx) / t.scale;
          const yIntrinsic = (yScreen - t.ty) / t.scale;
          const x = xIntrinsic / targetMap.original.dims.w;
          const y = yIntrinsic / targetMap.original.dims.h;
          if (x < 0 || x > 1 || y < 0 || y > 1) return;
          
          this.selectedMapPin = {
            mapId: targetMap.id,
            x,
            y,
          };
          this.render();
        });

        const updatePin = () => {
          if (this.activeMap !== mounted) return;
          const t = mounted.engine.transform;
          if (t) {
            pinLayer.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`;
            if (pinLayer.firstElementChild) {
               (pinLayer.firstElementChild as HTMLElement).style.transform = `translate(-50%,-50%) scale(${1 / t.scale})`;
            }
          }
          this.pinFrame = requestAnimationFrame(updatePin);
        };
        updatePin();
      }
    }
  }

  private basicsError(): string {
    if (!this.addForm.city.trim()) return 'Choose a city.';
    if (!this.addForm.area.trim()) return 'Enter the area or sector.';
    if (!this.addForm.size.trim()) return 'Enter the property size.';
    if (!this.addForm.facing) return 'Choose the property facing.';
    if (!this.addForm.position.trim()) return 'Choose the property position.';
    if (!this.addForm.type) return 'Choose the property type.';
    return '';
  }

  private buildProperty(published: boolean): Property {
    const type = this.addForm.type as PropertyType;
    const area = this.addForm.area.trim();
    const city = this.addForm.city.trim();
    const price = Number(String(this.addForm.price).replace(/[^0-9.]/g, '')) || 0;
    const pair = relatedMapPair(this.placementCatalog, this.selectedSectorMapId);
    const relatedIds = new Set([pair?.sector.id, pair?.masterplan?.id].filter((id): id is string => !!id));
    const mapPlacement = this.selectedMapPin && relatedIds.has(this.selectedMapPin.mapId)
      ? this.selectedMapPin
      : undefined;
    if (!this.propId) this.propId = `prop-${Date.now()}`;
    return {
      id: this.propId, type,
      want: (type === 'Residential Plot' ? 'Plot' : type === 'Floor' ? 'Flat' : type) as WantType,
      city, area, loc: `${area}, ${city}`, sector: this.addForm.sector || area,
      size: this.addForm.size.trim(), facing: this.addForm.facing as Facing, position: this.addForm.position.trim(),
      approvals: [],
      landmarks: [],
      price,
      photos: [this.coverPhoto, ...this.galleryPhotos]
        .filter((photo): photo is PendingPropertyPhoto => !!photo).map((photo) => photo.previewUrl),
      published, sold: false, lifecycle: published ? 'on-sale' : 'draft', views: 0,
      ...(pair ? { sectorMapId: pair.sector.id } : {}),
      ...(pair?.masterplan ? { masterplanId: pair.masterplan.id } : {}),
      ...(mapPlacement ? { mapPlacement } : {}),
    };
  }

  /** Save the draft record first (Storage RLS requires it), then upload and commit canonical refs. */
  private async persistProperty(published: boolean) {
    if (this.saving) return;
    const basicsError = this.basicsError();
    if (basicsError) {
      this.addStep = 1;
      this.photoError = basicsError;
      this.render();
      return;
    }
    this.saving = true;
    this.photoError = '';
    this.render();
    const draft = this.buildProperty(false);
    const prepared = await adapter.properties.save(draft);
    if (!prepared.ok) {
      this.saving = false;
      this.photoError = prepared.error.message;
      this.render();
      return;
    }

    let staged = prepared.value;
    const uploaded: PropertyPhotoStorageRef[] = [];
    for (const photo of [this.coverPhoto, ...this.galleryPhotos].filter((item): item is PendingPropertyPhoto => !!item)) {
      const result = await adapter.media.uploadPropertyPhoto(prepared.value.id, photo.file);
      if (!result.ok) {
        const cleaned = await this.cleanupUploaded(uploaded);
        if (cleaned) await adapter.properties.save({ ...staged, photos: [], photoStorage: [], published: false });
        this.saving = false;
        this.photoError = result.error.message;
        this.render();
        return;
      }
      uploaded.push(result.value);
      // Checkpoint each successful object immediately. If the browser disappears
      // mid-batch, the object remains attached to a private draft, never orphaned.
      const checkpoint = await adapter.properties.save({
        ...staged, photos: [], photoStorage: [...uploaded], published: false,
      });
      if (!checkpoint.ok) {
        await this.cleanupUploaded(uploaded);
        this.saving = false;
        this.photoError = checkpoint.error.message;
        this.render();
        return;
      }
      staged = checkpoint.value;
    }

    const committed = await adapter.properties.save({
      ...staged,
      photos: [],
      photoStorage: uploaded,
      published,
      lifecycle: published ? 'on-sale' : 'draft',
      mapPlacement: draft.mapPlacement,
      sectorMapId: draft.sectorMapId,
      masterplanId: draft.masterplanId,
    });
    if (!committed.ok) {
      const cleaned = await this.cleanupUploaded(uploaded);
      if (cleaned) await adapter.properties.save({ ...staged, photos: [], photoStorage: [], published: false });
      this.saving = false;
      this.photoError = committed.error.message;
      this.render();
      return;
    }
    if (published && draft.mapPlacement) addPropertyToMap(draft.mapPlacement.mapId, committed.value.id);
    this.onComplete(committed.value);
  }

  private async cleanupUploaded(uploaded: readonly PropertyPhotoStorageRef[]): Promise<boolean> {
    if (!uploaded.length) return true;
    const paths = uploaded.map((item) => item.path);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await adapter.media.removePropertyPhotos(paths);
      if (result.ok) return true;
    }
    return false;
  }

  private attachEvents() {
    this.el.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!target.closest("#pm-add-plot")) return;
      if (target.name === 'sectorMapId') {
        this.selectedSectorMapId = target.value;
        this.syncSectorSelection();
        this.mapMode = 'original';
        this.render();
        return;
      }
      if (!(target.name in this.addForm)) return;
      this.addForm = { ...this.addForm, [target.name as keyof typeof this.addForm]: target.value } as any;
      this.photoError = '';
      if (target.name === "city" || target.name === "area") {
        const locationLabel = this.el.querySelector<HTMLElement>("#pm-add-preview-location");
        if (locationLabel) locationLabel.textContent = `${this.addForm.area}, ${this.addForm.city}`;
      }
    });

    this.el.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name === 'city') {
        this.syncSectorSelection();
        this.mapMode = 'original';
        this.render();
        return;
      }
      if (input.id === 'pm-cover-photo-input' && input.files) this.selectCover(input.files);
      if (input.id === 'pm-gallery-photo-input' && input.files) this.selectGallery(input.files);
    });

    this.el.addEventListener('dragover', (event) => {
      if ((event.target as HTMLElement).closest('[data-drop-kind]')) event.preventDefault();
    });

    this.el.addEventListener('drop', (event) => {
      const zone = (event.target as HTMLElement).closest<HTMLElement>('[data-drop-kind]');
      if (!zone || !event.dataTransfer?.files.length) return;
      event.preventDefault();
      if (zone.dataset.dropKind === 'cover') this.selectCover(event.dataTransfer.files);
      else this.selectGallery(event.dataTransfer.files);
    });

    this.el.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      if (form.id !== "pm-add-plot") return;
      event.preventDefault();
      void this.persistProperty(true);
    });

    this.el.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (!target) return;
      
      const action = target.dataset.act;
      if (this.saving) return;
      if (action === "toggle-map") {
        const kind = target.dataset.kind as 'masterplan' | 'sector';
        const pair = relatedMapPair(this.placementCatalog, this.selectedSectorMapId);
        if ((kind === 'masterplan' && !pair?.masterplan) || (kind === 'sector' && !pair)) return;
        this.mapToggle = kind;
        this.mapMode = 'original';
        this.render();
        return;
      }
      if (action === 'map-mode') {
        const mode = target.dataset.mode as RenderMode;
        const pair = relatedMapPair(this.placementCatalog, this.selectedSectorMapId);
        const map = this.mapToggle === 'sector' ? pair?.sector : pair?.masterplan;
        if (mode === 'threeD' && !map?.threeD) return;
        this.mapMode = mode === 'threeD' ? 'threeD' : 'original';
        this.render();
        return;
      }
      if (action === "add-step") {
        const requestedStep = Math.max(1, Math.min(3, Number(target.dataset.step) || 1));
        const basicsError = requestedStep > 1 ? this.basicsError() : '';
        if (basicsError) {
          this.addStep = 1;
          this.photoError = basicsError;
        } else {
          this.addStep = requestedStep;
          this.photoError = '';
        }
        this.render();
      } else if (action === "add-next") {
        const basicsError = this.addStep === 1 ? this.basicsError() : '';
        if (basicsError) {
          this.photoError = basicsError;
          this.render();
          return;
        }
        this.photoError = '';
        this.addStep = Math.min(3, this.addStep + 1);
        this.render();
      } else if (action === "add-back") {
        if (this.addStep > 1) this.addStep -= 1;
        else this.onClose();
        this.render();
      } else if (action === "add-preview") {
        // Small preview at the last step — the exact detail the client would see.
        const basicsError = this.basicsError();
        if (basicsError) {
          this.addStep = 1;
          this.photoError = basicsError;
          this.render();
        } else {
          openPropertyDetail(this.buildProperty(false), {});
        }
      } else if (action === "choose-cover") {
        this.el.querySelector<HTMLInputElement>('#pm-cover-photo-input')?.click();
      } else if (action === "choose-gallery") {
        this.el.querySelector<HTMLInputElement>('#pm-gallery-photo-input')?.click();
      } else if (action === "remove-photo") {
        event.preventDefault();
        event.stopPropagation();
        if (target.dataset.kind === 'cover' && this.coverPhoto) {
          URL.revokeObjectURL(this.coverPhoto.previewUrl);
          this.coverPhoto = null;
        } else if (target.dataset.kind === 'gallery') {
          const index = Number(target.dataset.index);
          const [removed] = this.galleryPhotos.splice(index, 1);
          if (removed) URL.revokeObjectURL(removed.previewUrl);
        }
        this.render();
      } else if (action === "save-draft") {
        void this.persistProperty(false);
      } else if (action === "close-add") {
        this.onClose();
      }
    });
  }
}

export class AddClientFlow {
  private el: HTMLElement;
  private form = { name: '', phone: '', want: '' as WantType | '', city: '', budgetFrom: '', budgetTo: '', note: '', photo: '', linkProp: '' };
  private properties: Property[] = [];
  private onComplete: (c: Client) => void;
  private onClose: () => void;
  private saving = false;
  private saveError = '';

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
    void adapter.properties.list({ limit: 100 }).then((r) => { if (r.ok) { this.properties = [...r.value.items]; this.render(); } });
  }

  public unmount() {
    this.el.remove();
  }

  private render() {
    const wants: WantType[] = ['Plot', 'Flat', 'Kothi', 'Villa', 'Commercial'];
    const ready = Boolean(this.form.name.trim());
    this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:84;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-add" style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div><form id="pm-add-client" style="position:relative;width:100%;max-width:580px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #e4dbf2,0 40px 80px -30px rgba(40,26,2,.8);overflow:hidden;animation:omSheet .34s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #ece5f8;background:#efe8fb"><span style="width:46px;height:46px;border-radius:14px;background:#6b3fd4;color:#fff;display:grid;place-items:center;flex:none"><i class="ph-fill ph-user-plus" style="font-size:24px"></i></span><div style="flex:1;min-width:0"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Add a customer</div><div style="font-size:14px;color:#6b5b8a">Name and phone is enough to start.</div></div><button type="button" data-act="close-add" style="width:38px;height:38px;border-radius:12px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:16px"></i></button></div>
      <div data-scroll style="padding:22px 26px;max-height:62vh;overflow-y:auto"><div style="display:flex;flex-direction:column;gap:12px"><input name="name" value="${esc(this.form.name)}" placeholder="Full name" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16.5px;font-weight:600;color:#241f1c;outline:none"><input name="phone" value="${esc(this.form.phone)}" placeholder="Phone number" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16.5px;color:#241f1c;outline:none"></div><div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">What do they want</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:11px">${wants.map((want) => `<button type="button" data-act="want" data-want="${want}" style="padding:11px 15px;border-radius:12px;font-size:14.5px;font-weight:700;${this.form.want === want ? 'background:#6b3fd4;color:#fff;border:1px solid #6b3fd4' : 'background:#faf7ff;color:#6b6156;border:1px solid #ddd0f5'}">${want}</button>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px"><input name="city" value="${esc(this.form.city)}" placeholder="City" style="padding:15px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16px;color:#241f1c;outline:none"><div style="display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff"><input name="budgetFrom" value="${esc(this.form.budgetFrom)}" placeholder="Budget" style="flex:1;min-width:0;border:none;outline:none;background:none;padding:15px 0;font-size:16px;color:#241f1c"><span style="font-size:14px;color:#8d8271">to</span><input name="budgetTo" value="${esc(this.form.budgetTo)}" placeholder="Cr" style="width:56px;border:none;outline:none;background:none;padding:15px 0;font-size:16px;color:#241f1c"></div></div><textarea name="note" rows="3" placeholder="Any note — met at site, needs loan…" style="width:100%;margin-top:12px;padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16px;color:#241f1c;outline:none;resize:vertical">${esc(this.form.note)}</textarea>
      <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Photo &amp; property <span style="font-weight:700;text-transform:none;letter-spacing:0;color:#a5946f">· optional</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px">
        <input name="photo" value="${esc(this.form.photo)}" placeholder="Customer photo URL" style="padding:15px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:15px;color:#241f1c;outline:none">
        <select name="linkProp" style="padding:15px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:15px;color:#241f1c;outline:none"><option value="">Link a property…</option>${this.properties.map((p) => `<option value="${esc(p.id)}"${this.form.linkProp === p.id ? ' selected' : ''}>${esc(p.area)}${p.size ? ` · ${esc(p.size)}` : ''}</option>`).join('')}</select>
      </div></div>
      ${this.saveError ? `<div role="alert" style="margin:0 26px 14px;padding:11px 14px;border-radius:12px;background:#ffe1e6;color:#b3123a;font-size:13.5px;font-weight:700">${esc(this.saveError)}</div>` : ''}
      <div style="display:flex;align-items:center;gap:11px;padding:16px 26px;border-top:1px solid #ece5f8;background:#faf7ff"><button type="button" data-act="close-add" style="padding:15px 20px;border-radius:14px;background:#f4f0fb;color:#6b6156;font-size:15px;font-weight:700">Cancel</button><div style="flex:1"></div><button type="button" data-act="save-link" ${ready && !this.saving ? '' : 'disabled'} style="display:flex;align-items:center;gap:8px;padding:15px 20px;border-radius:14px;font-size:15px;font-weight:800;${ready && !this.saving ? 'background:#dcf3e5;color:#12704a' : 'background:#eef2ee;color:#a5b8ac'}"><i class="ph-fill ph-paper-plane-tilt"></i>Save &amp; send link</button><button id="pm-save-client" type="submit" ${ready && !this.saving ? '' : 'disabled'} style="padding:15px 24px;border-radius:14px;font-size:15px;font-weight:800;${ready && !this.saving ? 'background:#6b3fd4;color:#fff' : 'background:#ddd2f5;color:#b3a37a'}">${this.saving ? 'Saving…' : 'Save customer'}</button></div>
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
      void this.saveClient(false);
    });

    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) return;
      const action = target.dataset.act;
      if (action === 'close-add') this.onClose();
      else if (action === 'want') {
        this.form = { ...this.form, want: (target.dataset.want || 'Plot') as WantType };
        this.render();
      } else if (action === 'save-link') {
        void this.saveClient(true);
      }
    });
  }

  private buildClient(): Client {
    const f = this.form;
    const budget = f.budgetFrom && f.budgetTo ? `₹${f.budgetFrom}–${f.budgetTo} Cr` : f.budgetFrom ? `₹${f.budgetFrom} Cr+` : f.budgetTo ? `Up to ₹${f.budgetTo} Cr` : '';
    return {
      id: `client-${Date.now()}`, name: f.name.trim(), phone: f.phone.trim(), city: f.city.trim(),
      want: f.want, budget, budgetMax: (Number(f.budgetTo || f.budgetFrom) || 0) * 10_000_000,
      status: 'active', seen: '', note: f.note, viewed: [],
      interest: f.linkProp ? [f.linkProp] : [],
      ...(f.photo ? { photo: f.photo } : {}), ...(f.linkProp ? { linkedPropertyId: f.linkProp } : {}),
    };
  }

  /** Persist the customer; if `andLink`, open the send-link flow prefilled for them. */
  private async saveClient(andLink: boolean) {
    if (!this.form.name.trim() || this.saving) return;
    this.saving = true;
    this.saveError = '';
    this.render();
    const client = this.buildClient();
    let res;
    try {
      res = await adapter.customers.save(client);
    } catch {
      this.saving = false;
      this.saveError = 'The customer could not be saved. Check your connection and try again.';
      this.render();
      return;
    }
    if (!res.ok) {
      this.saving = false;
      this.saveError = res.error.message || 'The customer could not be saved.';
      this.render();
      return;
    }
    const saved = res.value;
    this.saving = false;
    this.onComplete(saved);
    if (andLink) {
      const props: Property[] = this.properties;
      const link = new GenerateLinkFlow(
        [saved],
        props,
        () => { /* list refresh handled by caller */ },
        () => link.unmount(),
        undefined,
        { clientId: saved.id, propertyIds: this.form.linkProp ? [this.form.linkProp] : [] },
      );
      link.mount(document.body);
    }
  }
}

export class GenerateLinkFlow {
  private el: HTMLElement;
  private chosenClient = '';
  private chosenProps: string[] = [];
  // Per-property price the dealer types for THIS link (₹, as string while editing).
  // Blank = "Price on call". Overrides the property's stored price.
  private prices: Record<string, string> = {};
  // ON → client sees the pin on its sector map + masterplan; OFF → area only.
  private locationPrecise = false;
  private expiresInDays = 7;
  private showPreview = false;
  private busy = false;
  private error = '';
  private result: { url: string; token: string } | null = null;
  // audio recording — WAV/PCM so the note plays on EVERY device (iOS Safari
  // cannot play the webm/opus MediaRecorder produces on Chrome/Android).
  private isRecording = false;
  private audioStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private audioProc: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private pcm: Float32Array[] = [];
  private pcmSampleRate = 16000;
  private audioBlob: Blob | null = null;
  private audioUrl = '';
  private audioSeconds = 0;
  private recStart = 0;

  private onComplete: () => void;
  private onClose: () => void;
  private clients: Client[];
  private properties: Property[];
  private predictive?: PredictiveRuntime;

  constructor(
    clients: Client[],
    properties: Property[],
    onComplete: () => void,
    onClose: () => void,
    predictive?: PredictiveRuntime,
    initial?: { clientId?: string; propertyIds?: string[] },
  ) {
    this.clients = clients;
    this.properties = properties;
    this.onComplete = onComplete;
    this.onClose = onClose;
    this.predictive = predictive;
    if (initial?.clientId && clients.some((client) => client.id === initial.clientId)) {
      this.chosenClient = initial.clientId;
    }
    const validPropertyIds = new Set(properties.map((property) => property.id));
    this.chosenProps = [...new Set(initial?.propertyIds || [])]
      .filter((propertyId) => validPropertyIds.has(propertyId))
      .slice(0, 4);
    this.el = document.createElement('div');
    this.el.id = 'pm-generate-link-flow';
    this.attachEvents();
    this.predictive?.recordAction('client-link-started', { type: 'workflow', id: 'client-link-create' }, { type: 'client-link-preview', id: 'new' });
  }

  public mount(container: HTMLElement) { container.appendChild(this.el); this.render(); }
  public unmount() { this.stopStream(); if (this.audioUrl) URL.revokeObjectURL(this.audioUrl); this.el.remove(); }

  private stopStream() {
    try { this.audioProc?.disconnect(); } catch { /* ignore */ }
    try { this.audioSource?.disconnect(); } catch { /* ignore */ }
    try { void this.audioCtx?.close(); } catch { /* ignore */ }
    try { this.audioStream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    this.audioProc = null; this.audioSource = null; this.audioCtx = null; this.audioStream = null;
  }

  private getInitials(name: string) {
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  /** All https / storage photos become approved refs for the link. */
  private photoSelections(): Record<string, string[]> {
    const sel: Record<string, string[]> = {};
    for (const id of this.chosenProps) {
      const p = this.properties.find((x) => x.id === id);
      sel[id] = p ? propertyPhotoSelections(p) : [];
    }
    return sel;
  }

  private render() {
    // Preserve the modal's scroll position so clicks don't jump the view up.
    const prevScroll = this.el.querySelector<HTMLElement>('[data-scroll]')?.scrollTop ?? 0;
    const restore = () => { const sc = this.el.querySelector<HTMLElement>('[data-scroll]'); if (sc) sc.scrollTop = prevScroll; };
    const origin = window.location.origin;
    if (this.result) {
      const full = origin + this.result.url;
      const client = this.clients.find((item) => item.id === this.chosenClient);
      // Open WhatsApp straight to the client's number (if we have it) with the link.
      const phone = (client?.phone || '').replace(/[^0-9]/g, '');
      const waNum = phone.length >= 10 ? (phone.length === 10 ? '91' + phone : phone) : '';
      const wa = `https://wa.me/${waNum}?text=${encodeURIComponent('Here is your private property page: ' + full)}`;
      this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-done" style="position:fixed;inset:0;background:rgba(60,44,12,.58)"></div><div role="dialog" aria-modal="true" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 40px 80px -30px rgba(40,26,2,.8);padding:32px 30px"><div style="width:64px;height:64px;margin:0 auto;border-radius:20px;background:#dcf3e5;color:#12a150;display:grid;place-items:center"><i class="ph-fill ph-check-circle" style="font-size:34px"></i></div><div style="margin-top:16px;text-align:center;font-family:'Newsreader',serif;font-weight:500;font-size:28px;color:#241d0c">Link is ready</div><div style="margin-top:7px;text-align:center;font-size:15.5px;color:#6b6156">Private to ${esc(client?.name || 'this customer')} · ${this.chosenProps.length} ${this.chosenProps.length === 1 ? 'plot' : 'plots'}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:22px;padding:15px 17px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><i class="ph-bold ph-link-simple" style="font-size:18px;color:#a8792a"></i><input readonly value="${esc(full)}" style="flex:1;min-width:0;border:none;background:none;font-size:14px;font-weight:600;color:#4c463d;outline:none"><button data-act="copy" data-url="${esc(full)}" style="padding:8px 12px;border-radius:9px;background:#241d0c;color:#ffd75e;font-size:13px;font-weight:800">Copy</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><a href="${esc(this.result.url)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:14px;background:#efe8fb;color:#6b3fd4;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-device-mobile" style="font-size:18px"></i>Preview their page</a><a href="${esc(wa)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:14px;background:#12a150;color:#fff;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-whatsapp-logo" style="font-size:18px"></i>Send on WhatsApp</a></div>
        <button data-act="close-done" style="width:100%;height:52px;margin-top:12px;border-radius:14px;background:#f0eaff;color:#5b32c4;font-size:16px;font-weight:800">Done</button></div></div>`;
      return;
    }

    const preciseAvailable = this.chosenProps.length > 0 && this.chosenProps.every((id) =>
      Boolean(this.properties.find((property) => property.id === id)?.mapPlacement));
    const preciseOn = this.locationPrecise && preciseAvailable;
    const ready = Boolean(this.chosenClient && this.chosenProps.length) && !this.busy;
    const priceLabelFor = (id: string) => { const v = Number(this.prices[id]); return v > 0 ? formatINR(v) : 'Price on call'; };
    const previewPanel = this.showPreview ? `<div style="margin-top:18px;border-radius:16px;background:#241904;background-image:linear-gradient(145deg,#3a2605,#171006);color:#fff8e6;padding:16px"><div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800"><i class="ph ph-eye"></i>What the client will see</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">${this.chosenProps.map((id) => { const p = this.properties.find((x) => x.id === id); if (!p) return ''; const photo = p.photos?.[0]; return `<div style="display:flex;align-items:center;gap:11px;background:rgba(255,255,255,.06);border-radius:12px;padding:9px 11px"><span style="width:46px;height:46px;border-radius:9px;flex:none;background:${photo ? `url('${esc(photo)}') center/cover` : '#5a4a2a'}"></span><span style="flex:1;min-width:0"><span style="display:block;font-weight:800;font-size:14px">${esc(preciseOn ? p.loc : (p.area.split(',')[0] || 'Property'))}</span><span style="display:block;font-size:12px;color:#e2cf9f">${esc(p.size)} · ${esc(p.facing)} facing · ${esc(priceLabelFor(id))}</span></span></div>`; }).join('') || '<span style="color:#c9b477;font-size:13px">Pick plots to preview.</span>'}</div><div style="margin-top:10px;font-size:12px;color:#c9b477">${preciseOn ? 'Exact stored map placement shared' : 'Area only'} · Expires in ${this.expiresInDays} days${this.audioBlob ? ' · Voice note attached' : ''}</div></div>` : '';

    this.el.innerHTML = `<div style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-build" style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div><section role="dialog" aria-modal="true" aria-label="Send a private link" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 40px 80px -30px rgba(40,26,2,.8);overflow:hidden;animation:omSheet .34s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #ddeee4;background:#dcf3e5"><span style="width:46px;height:46px;border-radius:14px;background:#12704a;color:#fff;display:grid;place-items:center;flex:none"><i class="ph-fill ph-paper-plane-tilt" style="font-size:23px"></i></span><div style="flex:1;min-width:0"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Send a private link</div><div style="font-size:14px;color:#12704a">One page, only for them. Voice note optional.</div></div><button data-act="close-build" style="width:38px;height:38px;border-radius:12px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:16px"></i></button></div>
      <div data-scroll style="padding:22px 26px;max-height:60vh;overflow-y:auto">
        <div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Who is it for</div><div style="display:flex;flex-direction:column;gap:9px;margin-top:11px">${this.clients.length ? this.clients.map((client) => { const on = this.chosenClient === client.id; const requirement = [client.want, client.city].filter(Boolean).join(' · ') || 'Requirements not recorded'; return `<button data-act="choose-client" data-id="${esc(client.id)}" style="display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;transition:all .16s;${on ? 'background:#dcf3e5;border:1px solid #12a150' : 'background:#faf7ff;border:1px solid #e4dbf7'}"><span style="width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800;${on ? 'background:#12704a;color:#fff' : 'background:#e2f2e6;color:#12704a'}">${this.getInitials(client.name)}</span><span style="flex:1;min-width:0;text-align:left"><span style="display:block;font-size:15.5px;font-weight:800;color:#2f2a2d">${esc(client.name)}</span><span style="display:block;font-size:13px;color:#8d8271">${esc(requirement)}</span></span><i class="${on ? 'ph-fill ph-check-circle' : 'ph ph-circle'}" style="font-size:20px;color:#12a150;flex:none"></i></button>`; }).join('') : '<div style="font-size:13.5px;color:#8d8271;padding:8px 2px">Add a customer first, then send them a link.</div>'}</div>
        <div style="margin-top:22px;display:flex;align-items:baseline;justify-content:space-between;gap:10px"><div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Which plots</div><div style="font-size:13.5px;font-weight:700;color:#12704a">${this.chosenProps.length ? `${this.chosenProps.length} ${this.chosenProps.length === 1 ? 'plot' : 'plots'} chosen` : 'Pick up to 4'}</div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:11px">${this.properties.slice(0, 12).map((property) => { const on = this.chosenProps.includes(property.id); const photo = property.photos[0]; return `<button data-act="choose-prop" data-id="${esc(property.id)}" style="position:relative;overflow:hidden;border-radius:14px;background:#faf7ff;border:2px solid ${on ? '#12a150' : '#e4dbf7'}"><span style="display:block;width:100%;height:70px;background:#efe8fb;overflow:hidden">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;object-fit:cover">` : ''}</span><span style="display:block;padding:9px 10px;font-size:12.5px;font-weight:700;text-align:left;line-height:1.3;color:#241f1c">${esc(property.loc)}</span>${on ? '<span style="position:absolute;top:7px;right:7px;width:24px;height:24px;border-radius:50%;background:#12a150;color:#fff;display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:13px"></i></span>' : ''}</button>`; }).join('')}</div>
        <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Price for this link <span style="font-weight:700;text-transform:none;letter-spacing:0;color:#a5946f">· blank = Price on call</span></div>
        <div style="display:flex;flex-direction:column;gap:9px;margin-top:11px">${this.chosenProps.length ? this.chosenProps.map((id) => { const p = this.properties.find((x) => x.id === id); if (!p) return ''; return `<div style="display:flex;align-items:center;gap:11px"><span style="flex:1;min-width:0;font-size:14px;font-weight:700;color:#4c463d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.area)}</span><div style="display:flex;align-items:center;gap:6px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:11px;padding:0 12px"><span style="color:#8d8271;font-weight:800">₹</span><input data-price-for="${esc(id)}" inputmode="numeric" value="${esc(this.prices[id] ?? '')}" placeholder="Price on call" style="width:150px;height:44px;border:none;outline:none;background:none;font-size:15px;font-weight:700;color:#241f1c"></div></div>`; }).join('') : '<div style="font-size:13.5px;color:#8d8271">Pick plots above to set their price.</div>'}</div>
        <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Location</div>
        <button type="button" data-act="toggle-precise" ${preciseAvailable ? '' : 'disabled'} style="display:flex;align-items:center;gap:13px;width:100%;margin-top:11px;padding:14px 16px;border-radius:14px;background:${preciseOn ? '#dcf3e5' : '#faf7ff'};border:1px solid ${preciseOn ? '#12a150' : '#e4dbf7'};text-align:left;cursor:${preciseAvailable ? 'pointer' : 'not-allowed'};opacity:${preciseAvailable ? '1' : '.62'}"><span style="width:46px;height:28px;border-radius:999px;flex:none;background:${preciseOn ? '#12a150' : '#d8cff0'};position:relative;transition:background .15s"><span style="position:absolute;top:3px;left:${preciseOn ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;transition:left .15s"></span></span><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#241f1c">Precise map placement ${preciseOn ? 'ON' : 'OFF'}</span><span style="display:block;font-size:12.5px;color:#8d8271">${!preciseAvailable ? 'Every selected property needs a stored map placement before an exact pin can be shared.' : preciseOn ? 'The stored plot placement is shared on its related maps.' : 'Client sees the overall area/sector only — no exact pin.'}</span></span></button>
        <div style="margin-top:14px;display:flex;align-items:center;gap:10px"><div style="font-size:13.5px;color:#4c463d;font-weight:700">Link expires in</div><select data-act="expiry" style="height:38px;border:1px solid #ddd0f5;border-radius:10px;padding:0 10px;font:inherit;font-size:14px;background:#fff">${[3, 7, 14, 30].map((d) => `<option value="${d}"${this.expiresInDays === d ? ' selected' : ''}>${d} days</option>`).join('')}</select></div>
        <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Your voice <span style="font-weight:700;text-transform:none;letter-spacing:0;color:#a5946f">· optional</span></div>
        ${this.audioBlob
          ? `<div style="display:flex;align-items:center;gap:11px;width:100%;margin-top:11px;padding:12px 14px;border-radius:16px;background:#e2f2e6;border:1px solid #b7ddc4"><i class="ph-fill ph-waveform" style="font-size:22px;color:#12704a"></i><audio controls src="${esc(this.audioUrl)}" style="flex:1;height:38px"></audio><span style="font-size:13px;font-weight:800;color:#12704a">${this.audioSeconds}s</span><button data-act="rec-remove" aria-label="Remove voice note" style="width:34px;height:34px;border-radius:10px;background:#ffe1e6;color:#c2185b;display:grid;place-items:center"><i class="ph-bold ph-trash"></i></button></div>`
          : `<button data-act="rec-toggle" style="display:flex;align-items:center;justify-content:center;gap:11px;width:100%;height:64px;margin-top:11px;border-radius:16px;${this.isRecording ? 'background:#ffe1e6;color:#c2185b' : 'background:#ffc93c;color:#241d0c'};font-size:15.5px;font-weight:800"><i class="ph-fill ${this.isRecording ? 'ph-stop-circle' : 'ph-microphone'}" style="font-size:22px"></i><span style="flex:1;text-align:left">${this.isRecording ? 'Recording… tap to stop' : 'Record a voice note for them'}</span></button>`}
        ${this.error ? `<div role="alert" style="margin-top:14px;padding:11px 14px;border-radius:12px;background:#ffe1e6;color:#b3123a;font-size:13.5px;font-weight:700">${esc(this.error)}</div>` : ''}
        ${previewPanel}
      </div>
      <div style="display:flex;align-items:center;gap:11px;padding:16px 26px;border-top:1px solid #ddeee4;background:#f4fbf6"><div style="flex:1;font-size:13.5px;color:#8d8271">${this.busy ? 'Creating the link…' : !this.chosenClient ? 'Pick a customer first' : !this.chosenProps.length ? 'Pick at least one plot' : 'Ready to send'}</div><button data-act="toggle-preview" style="padding:15px 18px;border-radius:14px;background:#efe8fb;color:#6b3fd4;font-size:15px;font-weight:800">${this.showPreview ? 'Hide preview' : 'Preview'}</button><button data-act="send" ${ready ? '' : 'disabled'} style="display:flex;align-items:center;justify-content:center;gap:9px;padding:15px 24px;border-radius:14px;font-size:15.5px;font-weight:800;${ready ? 'background:#12a150;color:#fff;box-shadow:0 14px 26px -16px rgba(18,161,80,.95)' : 'background:#e8f2eb;color:#a5b8ac'}"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>${this.busy ? 'Sending…' : 'Create link'}</button></div>
    </section></div>`;
    restore();
  }

  private async toggleRecord() {
    if (this.isRecording) { this.finishRecording(); return; }
    this.error = '';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('RECORDING_UNSUPPORTED');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.audioStream = stream;
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!Ctx) throw new Error('RECORDING_UNSUPPORTED');
      // 16 kHz mono is plenty for voice and keeps the WAV small enough to upload.
      let ctx: AudioContext;
      try { ctx = new Ctx({ sampleRate: 16000 }); } catch { ctx = new Ctx(); }
      this.audioCtx = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      this.pcmSampleRate = ctx.sampleRate;
      this.pcm = [];
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      this.audioSource = source; this.audioProc = proc;
      proc.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        this.pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        // Hard stop at 120s.
        if ((Date.now() - this.recStart) / 1000 >= 120) this.finishRecording();
      };
      // Route through a muted gain so onaudioprocess fires without speaker echo.
      const mute = ctx.createGain(); mute.gain.value = 0;
      source.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      this.recStart = Date.now();
      this.isRecording = true;
      this.render();
    } catch (error) {
      const name = (error as { name?: string }).name || '';
      const message = (error as Error).message || '';
      this.error = message === 'RECORDING_UNSUPPORTED'
        ? 'Voice recording is not supported in this browser. Update the browser or use another device.'
        : name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone permission was denied. Allow microphone access and try again.'
          : 'Could not access the microphone. Check the browser permission and try again.';
      this.isRecording = false;
      this.stopStream();
      this.render();
    }
  }

  /** Stop capturing, encode the PCM as a WAV blob (universally playable). */
  private finishRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    const rate = this.pcmSampleRate || 16000;
    const sampleCount = this.pcm.reduce((sum, chunk) => sum + chunk.length, 0);
    this.stopStream();
    if (sampleCount < rate / 4) {
      this.pcm = [];
      this.audioBlob = null;
      this.audioSeconds = 0;
      this.error = 'No audio was captured. Record for at least one second and try again.';
      this.render();
      return;
    }
    const blob = encodeWav(this.pcm, rate, 16000);
    this.audioSeconds = Math.max(1, Math.min(120, Math.ceil(sampleCount / rate)));
    this.pcm = [];
    this.audioBlob = blob;
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = URL.createObjectURL(blob);
    this.render();
  }

  private async send() {
    if (!this.chosenClient || !this.chosenProps.length || this.busy) return;
    this.busy = true; this.error = ''; this.render();
    const customPrices: Record<string, number> = {};
    for (const id of this.chosenProps) { const v = Number(this.prices[id]); if (v > 0) customPrices[id] = v; }
    const res = await adapter.clientLinks.create({
      clientId: this.chosenClient,
      propertyIds: [...this.chosenProps],
      priceVisibility: Object.keys(customPrices).length ? 'shown' : 'hidden',
      locationVisibility: this.locationPrecise && this.chosenProps.every((id) => Boolean(this.properties.find((property) => property.id === id)?.mapPlacement)) ? 'exact' : 'area',
      customPrices,
      locationPrecise: this.locationPrecise && this.chosenProps.every((id) => Boolean(this.properties.find((property) => property.id === id)?.mapPlacement)),
      expiresInDays: this.expiresInDays,
      photoSelections: this.photoSelections(),
      audioBlob: this.audioBlob,
      audioSeconds: this.audioSeconds,
    });
    this.busy = false;
    if (res.ok) {
      this.result = { url: res.value.url, token: res.value.token };
      this.stopStream();
      this.render();
      this.onComplete();
    } else {
      this.error = res.error.message || 'Could not create the link. Make sure each plot has an approved photo.';
      this.render();
    }
  }

  private attachEvents() {
    this.el.addEventListener('change', (event) => {
      const t = event.target as HTMLSelectElement;
      if (t.closest('[data-act="expiry"]') || (t.tagName === 'SELECT' && t.closest('[data-scroll]'))) {
        this.expiresInDays = Number(t.value) || 7;
      }
    });
    // Capture typed prices without a re-render so the field keeps focus.
    this.el.addEventListener('input', (event) => {
      const t = event.target as HTMLInputElement;
      const forId = t.getAttribute?.('data-price-for');
      if (forId) this.prices[forId] = t.value.replace(/[^0-9]/g, '');
    });
    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) return;
      const action = target.dataset.act;
      const id = target.dataset.id || '';
      if (action === 'close-build' || action === 'close-done') { this.onClose(); return; }
      if (action === 'choose-client') { this.chosenClient = this.chosenClient === id ? '' : id; this.render(); }
      else if (action === 'choose-prop') {
        const adding = !this.chosenProps.includes(id) && this.chosenProps.length < 4;
        this.chosenProps = this.chosenProps.includes(id) ? this.chosenProps.filter((x) => x !== id)
          : this.chosenProps.length < 4 ? [...this.chosenProps, id] : this.chosenProps;
        if (adding) this.prepareSelectedProperty(id);
        this.render();
      }
      else if (action === 'toggle-precise') {
        const available = this.chosenProps.length > 0 && this.chosenProps.every((propertyId) =>
          Boolean(this.properties.find((property) => property.id === propertyId)?.mapPlacement));
        if (available) this.locationPrecise = !this.locationPrecise;
        this.render();
      }
      else if (action === 'toggle-preview') { this.showPreview = !this.showPreview; this.render(); }
      else if (action === 'rec-toggle') { void this.toggleRecord(); }
      else if (action === 'rec-remove') { this.audioBlob = null; if (this.audioUrl) URL.revokeObjectURL(this.audioUrl); this.audioUrl = ''; this.audioSeconds = 0; this.render(); }
      else if (action === 'copy') { const url = target.dataset.url || ''; void navigator.clipboard?.writeText(url); target.textContent = 'Copied'; }
      else if (action === 'send') { void this.send(); }
    });
  }

  private prepareSelectedProperty(id: string): void {
    const property = this.properties.find((item) => item.id === id);
    if (!property || !this.predictive) return;
    this.predictive.recordAction('client-link-property-added', { type: 'property', id }, { type: 'client-link-preview', id });
    void this.predictive.prepareValue(
      { type: 'client-link-preview', id: `selection:${[...this.chosenProps].sort().join(',')}`, version: 'current' },
      this.chosenProps.map((propertyId) => this.properties.find((item) => item.id === propertyId)).filter(Boolean),
      { priority: 'P1', reason: 'selected properties prepare link preview summaries', costBytes: 12_000 },
    ).catch(() => undefined);
    const src = property.photos[0];
    if (!src || typeof Image === 'undefined') return;
    const meta = mediaCacheMeta(src);
    const scheduled = this.predictive.scheduleCandidate({
      key: { type: 'property-thumbnail', id: `${id}:0`, version: meta.version },
      signals: { directAction: 0.75, context: 1, relationship: 1, probability: 1 },
      cost: { bytes: 96_000, parse: 0.15 }, preferredStage: 'download',
      reason: 'property selected for Client Link',
    }, (signal) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.decoding = 'async';
      const abort = () => { image.src = ''; reject(new DOMException('aborted', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
      image.onload = () => { signal.removeEventListener('abort', abort); resolve(image); };
      image.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('Client Link thumbnail unavailable')); };
      image.src = src;
    }), { cache: { costBytes: 96_000, expiresAt: meta.expiresAt, dispose: (image) => { (image as HTMLImageElement).src = ''; } } });
    void scheduled.promise?.catch(() => undefined);
  }
}

/** Encode recorded mono Float32 PCM chunks into a 16-bit WAV blob. WAV plays on
 *  every browser including iOS Safari, unlike the webm/opus MediaRecorder gives. */
export function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  let length = 0;
  for (const c of chunks) length += c.length;
  const captured = new Float32Array(length);
  let off = 0;
  for (const c of chunks) { captured.set(c, off); off += c.length; }
  const outputRate = Math.max(8000, Math.min(sampleRate, targetRate));
  const samples = resamplePcm(captured, sampleRate, outputRate);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);           // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let p = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** Downsample by averaging source windows. Voice remains clear and a 120-second
 * note stays below the private bucket's 5 MB limit even on 48 kHz devices. */
export function resamplePcm(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (!samples.length || sourceRate <= targetRate) return samples.slice();
  const ratio = sourceRate / targetRate;
  const output = new Float32Array(Math.max(1, Math.floor(samples.length / ratio)));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j]!;
    output[i] = sum / (end - start);
  }
  return output;
}
