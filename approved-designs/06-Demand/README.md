# 06 Demand - Design Handoff Package

## Purpose
The **Demand** module enables real estate dealers to record buyer requirements (budget, location, property type, plot size, urgency) and automatically match them against available property inventory.

---

## Key Features & Business Rules
1. **Buyer Requirement Fields**:
   - Linked Customer (`clients` entity)
   - Budget Range (Min-Max in INR Lakhs / Crores)
   - Preferred Sectors & Corridors (e.g. Aerocity Mohali, PR-7 Zirakpur)
   - Property Type (Residential Plot, Flat, Kothi, Villa, Commercial)
   - Size & Configuration (e.g. 200–250 Sq.Yd, East Facing)
   - Urgency Level (`Urgent - 7 Days`, `Standard - 30 Days`, `Exploring`)
2. **Matching Engine**:
   - Ranks available plots by match percentage (e.g. 96% Match based on sector, budget, and size alignment).
3. **No-Match & Empty Handling**:
   - Explicit zero-match states when buyer criteria exceed active inventory.

---

## Included Files
- `index.html`: Interactive desktop, tablet, and modal demonstration of demand creation and matching engine views.
- `README.md`: System overview and interaction documentation.
- `SCREEN_SPECIFICATION.md`: Detailed component breakdown, layout rules, and design tokens.

---

## Interactive States Demonstration in `index.html`
- **Default View**: Split-panel view with active buyer demand cards on the left and matching property inventory on the right.
- **No-Match State**: Clear user feedback when zero inventory items match strict budget/sector filters.
- **Create Demand Modal**: Form dialog for registering a new buyer demand requirement.
- **Loading State**: Shimmer card placeholders while match score calculation runs.
- **Empty State**: Friendly CTA when no buyer requirements exist.
