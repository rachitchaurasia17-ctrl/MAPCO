# 06 Demand - Screen Specification

## 1. Overview
The Demand screen allows dealers to record buyer constraints and immediately match them against inventory.

---

## 2. Layout & Responsive Grid
- **Desktop Grid**: Split 2-column layout (`380px 1fr`). Left column lists demand profiles; right panel lists calculated property matches.
- **Tablet Responsive (1024px - 768px)**: Stacked 1-column layout with collapsible demand selector.
- **Mobile Responsive (375px - 480px)**: Single column with tabbed view switching between "Buyer Demands" and "Matching Inventory".

---

## 3. Typography & Color Tokens
- **Font Families**:
  - Headings: `Newsreader`, serif (500/600 weight)
  - Body: `Archivo`, sans-serif (400/500/600 weight)
  - Values / Score: `Space Mono`, monospace
- **Color Palette (Violet Dusk Theme)**:
  - Background: `#0f0b18`
  - Cards: `#191228` (Borders: `#2e2048`)
  - Accent Amber: `#e5a93c`
  - Match Score Green: `#12a150`
  - Urgency Red: `#e54d42`

---

## 4. Matching Engine Logic
- Match Percentage Calculation Score Weights:
  - Sector/Location match: 40%
  - Budget range overlap: 35%
  - Size / Type alignment: 25%
- Scores >= 80% are highlighted with green `⚡ Match` badges.

---

## 5. Security & Privacy Constraints
- Demand profiles link to internal `clients` records. Internal phone numbers or notes are never leaked to client presentation links or public APIs.
