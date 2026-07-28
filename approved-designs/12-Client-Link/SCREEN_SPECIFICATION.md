# 12 Private Client Link - Screen Specification

## 1. Overview
Mobile-first client-facing property presentation interface rendered when a buyer opens a `/client/?token=<64-hex>` URL.

---

## 2. Mobile Viewport Layout
- **Container**: Max width `440px`, centered on desktop screens with dark ambient backdrop. Full viewport width on smartphones (`375px - 480px`).
- **Header**: Sticky brand title ("PlotMap") + "VERIFIED PROPERTY" badge.
- **Sticky Footer**: Dual CTAs ("📞 Call Dealer", "💬 WhatsApp").

---

## 3. Component Breakdown
1. **Voice Note Player**:
   - Displays dealer avatar, title, audio waveform, play/pause button, duration counter (max 120 seconds).
2. **Approved Photos Gallery**:
   - Up to 8 selectable photos with index badge (e.g. `1 of 4`).
3. **Property Details Box**:
   - Property Title (Newsreader font, 24px)
   - Price Display (Gated by `priceVisibility` setting)
   - Specs Grid: Location/Corridor, Plot Size, Road Width, Facing.
   - Client-safe Description.

---

## 4. Privacy & Gating Controls
- `priceVisibility`: `shown` -> `₹ 1.85 Cr`, `hidden` -> `Price Available on Request`.
- `locationVisibility`: `exact` -> `Plot #142, Sector 82 Aerocity`, `area` -> `Aerocity Mohali Corridor`, `hidden` -> `Prime Corridor`.
- **Prohibited Data**: Seller Phone, Seller Name, Commission %, Internal Notes, Deal Stage.
