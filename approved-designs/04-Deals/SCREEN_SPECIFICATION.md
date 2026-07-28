# 04 Deals - Screen Specification

## 1. Overview
The Deals screen is a dealer-only workspace designed for managing active property negotiations, site visits, token payments, and closing documentation.

---

## 2. Layout & Responsive Grid
- **Desktop Grid**: 4-column responsive grid (`grid-template-columns: repeat(4, 1fr)`) with horizontal scrolling on viewports under `1200px`.
- **Tablet Responsive (1024px - 768px)**: 2-column stacked grid with sticky stage headings.
- **Mobile Responsive (375px - 480px)**: Single column list view with stage selector pills at top.

---

## 3. Typography & Color Tokens
- **Font Families**:
  - Headings: `Newsreader`, serif (500/600 weight)
  - Body: `Archivo`, sans-serif (400/500/600 weight)
  - Monospaced / Values: `Space Mono`, monospace
- **Color Palette (Violet Dusk Theme)**:
  - Background: `#0f0b18`
  - Cards: `#191228` (Borders: `#2e2048`, Highlight: `#46326c`)
  - Text Primary: `#f3effe`, Text Muted: `#786898`
  - Primary Accent: `#e5a93c` (Amber)
  - Secondary Accent: `#8c72cf` (Lavender)
  - Success Badge: `#12a150` (Forest Green)

---

## 4. Component Structure
1. **Header Metrics Bar**:
   - `4 Active` Pipeline Deals
   - `₹ 7.60 Cr` Total Pipeline Target Value
   - `2 Due` Scheduled Follow-ups Today
2. **Deal Card**:
   - Title: Property Plot # & Sector Name
   - Customer Name (linked `clients` entity)
   - Price (INR formatted, e.g., `₹ 1.85 Cr`)
   - Next Action / Follow-up pill tag
3. **Slide-over Drawer**:
   - Width: `480px` (Desktop), `100vw` (Mobile)
   - Contains Stage Selector, Linked Customer Details, Offer & Negotiation Log, Follow-up Notes.

---

## 5. Security & Privacy Constraints
- Internal notes, phone numbers, and commission logs in Deals are **dealer-private**. They must NEVER be rendered in public API endpoints or client presentation views.
