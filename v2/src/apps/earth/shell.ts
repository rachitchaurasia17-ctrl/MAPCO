/**
 * Side-effect-free MAPCO Earth shell contract.
 *
 * Keeping this static markup separate from the Google Maps runtime lets
 * structural tests validate the product chrome without starting the full
 * Earth application (adapter, map engine, and browser boot lifecycle).
 */
export type EarthView = 'earth' | 'map' | 'masterplan' | '3d';

export const EARTH_VIEW_MODES: readonly { k: EarthView; label: string; icon: string }[] = [
  { k: 'earth', label: 'Earth', icon: 'ph-fill ph-globe-hemisphere-east' },
  { k: 'map', label: 'Map', icon: 'ph-fill ph-map-pin-area' },
  { k: 'masterplan', label: 'Masterplan', icon: 'ph-fill ph-map-trifold' },
  { k: '3d', label: '3D', icon: 'ph-fill ph-cube' },
];

export function earthShellHtml(): string {
  return `
<div class="e-root">
  <div class="e-map" id="e-map"></div>
  <div class="e-vignette"></div>

  <div class="e-status" id="e-status"><div class="e-status-inner" id="e-status-inner"></div></div>

  <!-- masterplan / 3d overlay -->
  <div id="e-plan" style="display:none"></div>

  <!-- top bar -->
  <div class="e-top">
    <div class="e-top-left">
      <div class="e-brandrow">
        <!-- The brand IS the way back. No separate back control. -->
        <a class="e-brand e-glass" id="e-brand" href="/index.html" aria-label="Back to MAPCO">
          <img class="e-brand-logo" src="/assets/mapco-logo.png" alt="" width="42" height="42" />
          <div class="e-brand-text">
            <div class="e-brand-name">MAPCO</div>
            <div class="e-brand-sub">EARTH</div>
          </div>
          <i class="ph-bold ph-arrow-left e-brand-back" aria-hidden="true"></i>
        </a>
        <div class="e-browse" id="e-browse" role="toolbar" aria-label="Browse">
          <button class="e-sheetbtn" id="e-open-props" type="button"><i class="ph-fill ph-squares-four"></i><span>Properties</span></button>
          <button class="e-sheetbtn" id="e-open-sectors" type="button"><i class="ph-fill ph-map-trifold"></i><span>Sector</span></button>
        </div>
      </div>

      <div class="e-searchwrap">
        <div class="e-searchbox">
          <i class="ph ph-magnifying-glass" style="font-size:16px;color:#8d8271"></i>
          <input id="e-search" type="text" autocomplete="off" spellcheck="false"
                 placeholder="Search plot, sector, project or place…" aria-label="Search MAPCO Earth"/>
          <i class="ph ph-x e-clear" id="e-clear" style="display:none" title="Clear"></i>
        </div>
        <div class="e-results escroll" id="e-results" style="display:none"></div>
      </div>
    </div>

    <div class="e-topright">
      <div class="e-views" id="e-views"></div>
    </div>
  </div>

  <!-- Properties / Sector browse sheets -->
  <div id="e-sheet" style="display:none"></div>

  <!-- my properties -->
  <div class="e-mine">
    <div class="e-tools" id="e-tools" role="toolbar" aria-label="Map tools">
      <div class="e-tool e-tool--sv" id="e-svbtn" role="button" tabindex="0" aria-pressed="false" title="Street View">
        <i class="ph-fill ph-person-simple-walk"></i><span class="e-tool-label">Street View</span>
      </div>
      <div class="e-tool e-tool--roads" id="e-roads" role="button" tabindex="0" aria-pressed="false" title="Show MAPCO roads">
        <i class="ph-fill ph-road-horizon"></i><span class="e-tool-label">Roads</span>
      </div>
    </div>
    <div id="e-minepanel" style="display:none"></div>
    <div class="e-mine-btn" id="e-minebtn">
      <i class="ph-fill ph-stack-simple" style="font-size:19px;color:#ffc93c"></i>My properties
      <span class="e-count" id="e-minecount">0</span>
    </div>
  </div>

  <!-- controls — deliberately minimal: pinch/wheel handles zoom -->
  <div class="e-controls">
    <div class="e-ctl e-ctl--light" id="e-recenter" title="Reset view"><i class="ph-fill ph-crosshair" style="font-size:20px"></i></div>
  </div>

  <div id="e-cardwrap"></div>
  <div id="e-pickhint"></div>
  <div id="e-addhint"></div>
  <div id="e-addbar"></div>
  <div id="e-sv"></div>
  <div id="e-toastwrap"></div>
</div>`;
}
