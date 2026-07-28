# 04 Deals - Design Handoff Package

## Purpose
The **Deals** module provides real estate dealers with a private, high-efficiency pipeline interface for managing ongoing property transactions, negotiation history, follow-up logs, and site visit schedules.

---

## Key Features & Business Rules
1. **Pipeline Stages**:
   - `Discussion & Inquiry`
   - `Site Visit Scheduled`
   - `Token Advance Paid`
   - `Documentation & Legal`
   - `Closed Won` / `Closed Lost`
2. **Entity Linkage**:
   - Every deal links a **Customer Record** (`clients`) and a **Property Record** (`properties`).
3. **Follow-ups & Notes**:
   - Persisted locally under `localStorage['plotmap_deal_followups_v1']` and synced with `PMDataAdapter`.
4. **Financial Safety Guarantee**:
   - Absolutely **no fabricated financial intelligence** or speculative AI ROI numbers. Displays only confirmed target/agreed transaction values (INR).

---

## Included Files
- `index.html`: Interactive desktop, tablet, and modal state demonstration.
- `README.md`: System overview and interaction documentation.
- `SCREEN_SPECIFICATION.md`: Detailed component breakdown, layout rules, and design tokens.

---

## Interactive States Demonstration in `index.html`
- **Default View**: 4-Column Kanban Pipeline Board (`Discussion`, `Site Visit`, `Token Advance`, `Legal & Closing`).
- **Deal Details Drawer**: Slide-over panel displaying linked customer info, negotiation history log, property specs, and stage outcome buttons.
- **New Deal Modal**: Dialog for creating a new pipeline deal linking customer and property.
- **Closing Outcome Modal**: Dialog for marking a deal `Closed Won` or `Closed Lost` with final value.
- **Loading State**: Skeleton layout shimmer during network sync.
- **Empty State**: Friendly CTA when zero active deals exist.
- **Error State**: Non-destructive error banner with retry option.
