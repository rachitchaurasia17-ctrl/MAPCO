# MAPCO Approved Design Packages Index

This index organizes all approved design handoffs and design assets for the MAPCO / PlotMap platform, located in `approved-designs/`.

---

## 1. Summary of Design Packages Found & Destinations

| # | Package Name / Source | Original Location | Destination Folder | Included Routes / Screens | Coverage |
|---|---|---|---|---|---|
| 1 | **`design_handoff_plotmap`** (`# Dealer Dashboard Redesign (1).zip`) | `Downloads/# Dealer Dashboard Redesign (1).zip` | `approved-designs/02-Dashboard/design_handoff_plotmap/` | `01-Landing`, `02-Dashboard`, `07-Team-Workspace`, `11-Client-Presentation` | Desktop (1440x900 / 1440x940), Tablet |
| 2 | **`# Dealer Dashboard Redesign.zip`** | `Downloads/# Dealer Dashboard Redesign.zip` | `approved-designs/02-Dashboard/dealer-dashboard-redesign/` | `02-Dashboard` (`Dealer Dashboard.dc.html`) | Desktop, Tablet |
| 3 | **`PlotMap map studio design-handoff.zip`** | `Downloads/PlotMap map studio design-handoff.zip` | `approved-designs/10-Map-Studio/map-studio-design/` | `10-Map-Studio` (`PlotMap Map Studio.dc.html`) | Desktop, Tablet |
| 4 | **`PlotMap UIUX Redesign-handoff.zip`** | `Downloads/PlotMap UIUX Redesign-handoff.zip` | `approved-designs/11-Client-Presentation/plotmap-ui-ux-redesign/` | `11-Client-Presentation`, `10-Map-Studio` (`PlotMap Hero Screens.dc.html`, `ANTIGRAVITY-HANDOFF.md`) | Desktop, Tablet, Mobile responsive |
| 5 | **`SaaS Dashboard Redesign.zip`** | `Downloads/SaaS Dashboard Redesign.zip` | `approved-designs/13-Developer-Control/saas-control/` | `13-Developer-Control` (`PlotMap Control.dc.html`) | Desktop |
| 6 | **`stitch_plotmap_premium_dealer_suite.zip`** | `Downloads/stitch_plotmap_premium_dealer_suite.zip` | `approved-designs/05-Customers/stitch-dealer-suite/`, `08-Area-Intelligence/`, `09-Property-Insights/` | `05-Customers` (Client Portfolio), `08-Area-Intelligence`, `09-Property-Insights` | Desktop, Mobile responsive |
| 7 | **`stitch_plotmap_premium_dealer_suite (1).zip`** | `Downloads/stitch_plotmap_premium_dealer_suite (1).zip` | `approved-designs/03-Properties/stitch-top-nav-suite/` | `03-Properties` (Inventory Readiness), `05-Customers`, `07-Team-Workspace`, `08-Area-Intelligence` | Desktop, Mobile responsive |
| 8 | **`PlotMap - Masterplan Marking.zip` & Vector Zips** | `Downloads/PlotMap - Masterplan Marking.zip` & `(1).zip` & PNG | `approved-designs/10-Map-Studio/masterplan-marking/` & `masterplan-marking-vectors/` | `10-Map-Studio` (Roads/Blocks PNG layers, SVG vector markings `Vector 1-21.svg`) | Map Canvas Assets |
| 9 | **`PlotMap Redesign.docx`** | `Downloads/PlotMap Redesign.docx` | `approved-designs/01-Landing/`, `02-Dashboard/`, `11-Client-Presentation/` | Core specification document for 50-60yo property dealer UX flow | Specification |
| 10 | **`ZIRKPUR MAP.zip`** | `Downloads/ZIRKPUR MAP.zip` | `approved-designs/08-Area-Intelligence/zirkpur-map/` | `08-Area-Intelligence`, `10-Map-Studio` (Zirakpur masterplan tiles) | Map Canvas Assets |

---

## 2. Directory Route Mapping

### `01-Landing`
- **Location**: [approved-designs/01-Landing](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/01-Landing)
- **Included Packages**:
  - `design_handoff_plotmap/design/PlotMap Landing.dc.html` (referenced in `02-Dashboard`)
  - `screens/01-landing.md`
  - `PlotMap Redesign.docx`
- **Screens**: Hero entry hub, brand wordmark, time/greeting display, route selector to Dealer Dashboard, Client Presentation, and Map Studio.
- **Coverage**: Desktop, Tablet, Mobile responsive.

### `02-Dashboard`
- **Location**: [approved-designs/02-Dashboard](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/02-Dashboard)
- **Included Packages**:
  - `design_handoff_plotmap/` (`Dealer Dashboard.dc.html`, `screens/03-dealer-dashboard.md`, `data-model.md`, `README.md`)
  - `dealer-dashboard-redesign/` (`Dealer Dashboard.dc.html`, `Dealer Dashboard (export-src).dc.html`, `PlotMap Dealer Dashboard.html`)
  - `PlotMap Redesign.docx`
- **Screens**: Main Dealer Command Center, plot inventory metrics, active deals, client matching, sector filters, recent activity log.
- **Coverage**: Desktop (1440x940), Tablet landscape.

### `03-Properties`
- **Location**: [approved-designs/03-Properties](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/03-Properties)
- **Included Packages**:
  - `stitch-top-nav-suite/stitch_plotmap_premium_dealer_suite/dealer_command_inventory_readiness_top_nav/code.html`
- **Screens**: Inventory Readiness Command, property portfolio optimization, status monitoring (On Presentation / Draft / Sold), quick plot entry.
- **Coverage**: Desktop, Mobile responsive.

### `04-Deals`
- **Location**: [approved-designs/04-Deals](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/04-Deals)
- **Included Packages**: Dedicated standalone package missing (workflow integrated within `02-Dashboard` deals tab and active mandates).

### `05-Customers`
- **Location**: [approved-designs/05-Customers](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/05-Customers)
- **Included Packages**:
  - `stitch-dealer-suite/stitch_plotmap_premium_dealer_suite/dealer_command_client_portfolio_redesign/code.html`
  - `stitch-dealer-suite/stitch_plotmap_premium_dealer_suite/dealer_command_business_insights/code.html`
  - `stitch-top-nav-suite/stitch_plotmap_premium_dealer_suite/dealer_command_client_portfolio_top_nav/code.html`
- **Screens**: Client Portfolio (Luminous Premier), High Net Worth client profiles, active mandates, budget range filters, contact & activity timeline.
- **Coverage**: Desktop, Mobile responsive.

### `06-Demand`
- **Location**: [approved-designs/06-Demand](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/06-Demand)
- **Included Packages**: Dedicated standalone package missing (buyer demand requirements referenced in `05-Customers` and `08-Area-Intelligence`).

### `07-Team-Workspace`
- **Location**: [approved-designs/07-Team-Workspace](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/07-Team-Workspace)
- **Included Packages**:
  - `design_handoff_plotmap/design/Team Workspace.dc.html` (referenced in `02-Dashboard`)
  - `screens/04-team-workspace.md`
  - `stitch-top-nav-suite/stitch_plotmap_premium_dealer_suite/team_workspace_properties_top_nav/code.html`
- **Screens**: "The Work Table" collaborative space, team property inventory review, staff shared login status, pending approvals.
- **Coverage**: Desktop, Tablet.

### `08-Area-Intelligence`
- **Location**: [approved-designs/08-Area-Intelligence](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/08-Area-Intelligence)
- **Included Packages**:
  - `area-intelligence-redesign/code.html`
  - `stitch-top-nav-suite/stitch_plotmap_premium_dealer_suite/dealer_command_area_pulse_top_nav/code.html`
  - `zirkpur-map/` (`image 1.png`, `roads.png`, `blocks.png`)
- **Screens**: Tricity Area Intelligence, growth corridor analytics, Aerocity Mohali pulse, sector demand metrics, map layer tiles.
- **Coverage**: Desktop, Tablet, Mobile responsive.

### `09-Property-Insights`
- **Location**: [approved-designs/09-Property-Insights](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/09-Property-Insights)
- **Included Packages**:
  - `business-insights/code.html`
- **Screens**: Property performance analytics, price trends, sector popularity, client engagement metrics.
- **Coverage**: Desktop, Mobile responsive.

### `10-Map-Studio`
- **Location**: [approved-designs/10-Map-Studio](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/10-Map-Studio)
- **Included Packages**:
  - `map-studio-design/plotmap-map-studio-design/project/PlotMap Map Studio.dc.html`
  - `masterplan-marking/` (`roads.png`, `blocks.png`, `PlotMap - Masterplan Marking.png`)
  - `masterplan-marking-vectors/` (`Vector 1.svg` - `Vector 21.svg`)
- **Screens**: Map Studio editor canvas, step bar (Pick Map -> Mark -> Publish), drawing tool panel (Block, Sector, Road, Pin, Landmark), inspector panel, client preview mode.
- **Coverage**: Desktop, Tablet.

### `11-Client-Presentation`
- **Location**: [approved-designs/11-Client-Presentation](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/11-Client-Presentation)
- **Included Packages**:
  - `plotmap-ui-ux-redesign/project/PlotMap Hero Screens.dc.html`
  - `plotmap-ui-ux-redesign/project/ANTIGRAVITY-HANDOFF.md`
  - `design_handoff_plotmap/design/Client Presentation.dc.html` (in `02-Dashboard`)
  - `PlotMap Redesign.docx`
- **Screens**: Hero presentation mode for client-facing meetings, full-viewport Aerocity masterplan background, interactive client-safe overlay cards (Block, Road, Pin, Landmark), road glow & flow animations, zero-price/zero-internal notes client safety filter.
- **Coverage**: Desktop (1440x900), Tablet landscape, Mobile presentation.

### `12-Client-Link`
- **Location**: [approved-designs/12-Client-Link](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/12-Client-Link)
- **Included Packages**: Dedicated standalone package missing (client presentation sharing via WhatsApp is designed in `11-Client-Presentation`, but dedicated standalone client portal link view is missing).

### `13-Developer-Control`
- **Location**: [approved-designs/13-Developer-Control](file:///C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/approved-designs/13-Developer-Control)
- **Included Packages**:
  - `saas-control/PlotMap Control.dc.html`
- **Screens**: SaaS Developer Control Panel, dealer subscription management (Paid / Trial / Expired / Suspended), active maps monitoring, system health & error logs.
- **Coverage**: Desktop.

---

## 3. Unclassified Packages (`approved-designs/_unclassified/`)

The following design handoffs found in `Downloads` were classified as **non-MAPCO** and moved to `approved-designs/_unclassified/`:

| Package Folder | Original Download | Reason for Unclassified Status |
|---|---|---|
| `_unclassified/minimal-essentials-design-brief/` | `Minimal essentials design brief-handoff.zip` | E-commerce fashion product card brief for "Aeson" brand. Unrelated to real estate. |
| `_unclassified/aakar-handoff/` | `aakar-handoff` directory | Dental & Aesthetic Clinic website design for Dr. Khushboo Gour. Unrelated to MAPCO. |
| `_unclassified/stitch_landing_page_clone/` | `stitch_landing_page_clone.zip` | "Maggu Excellence" landing page clone design system. |
| `_unclassified/gurman-kaur-identity/` | `stitch_gurman_kaur_visual_identity.zip` | Personal branding & visual identity for Gurman Kaur. |
| `_unclassified/flourish-luxury-atelier/` | `stitch_flourish_luxury_aesthetic_atelier.zip` | Luxury aesthetic atelier landing page template. |
| `_unclassified/optik-architectural-studio/` | `stitch_optik_website_clone.zip` | Optik Architectural Studio & Five Elements Architects website clone. |
| `_unclassified/sri-chaitanya-gaudiya-math/` | `stitch_sree_cg_math_chandigarh_landing_page.zip` | Sri Chaitanya Gaudiya Math sanctuary & acharya biographies landing page. |

---

## 4. Duplicate Files Detected & Skipped

To prevent redundant files and unnecessary bloat in the repository:
1. `PlotMap Dealer Dashboard.html` (standalone in Downloads) is identical to `Dealer Dashboard.html` inside `# Dealer Dashboard Redesign.zip`.
2. `PlotMap map studio design-handoff (1).zip`, `(2).zip`, `(3).zip` are identical copies of `PlotMap map studio design-handoff.zip`.
3. `use this codex new design.zip` is an older snapshot (29-06-2026) of `PlotMap UIUX Redesign-handoff.zip` (07-07-2026).
4. `ZIRKPUR MAP.zip` image files (`image 1.png`, `roads.png`, `blocks.png`) are identical to `PlotMap - Masterplan Marking.zip`.
5. `PlotMap - Masterplan Marking (2).zip` SVG vectors duplicate `PlotMap - Masterplan Marking (1).zip`.
6. `PlotMap - Masterplan Marking (4).zip` & `(5).zip` are empty 22-byte files.
7. `stitch_landing_page_clone (1).zip`, `(2).zip`, `(3).zip`, `stitch_gurman_kaur_visual_identity (1).zip`, `(2).zip`, and `stitch_sree_cg_math_chandigarh_landing_page (1).zip` are redundant download copies.

---

## 5. Routes Still Missing Approved Designs

1. **`04-Deals`**: Deal management workflow, negotiation tracking, and commission calculations are referenced in `02-Dashboard`, but dedicated full-screen designs do not exist in handoff packages.
2. **`06-Demand`**: Client property demand registry and automated buyer-seller matching interface.
3. **`12-Client-Link`**: Dedicated mobile web view for external clients opening shared WhatsApp presentation links.

---

## 6. Unresolved Design Questions

1. **Deals & Demand UI pattern**: Should `04-Deals` and `06-Demand` be implemented as slide-over side drawers within `02-Dashboard` and `05-Customers`, or will dedicated full-page designs be provided?
2. **Client Link Authentication**: Will `12-Client-Link` reuse `11-Client-Presentation` (`PlotMap Hero Screens.dc.html`) behind a read-only token route, or require a lightweight standalone viewer?
3. **Map Studio Geometry Editor**: `PlotMap Map Studio.dc.html` provides simulated drawing states; backend/frontend integration will require live canvas coordinate capture and GeoJSON serialization.
