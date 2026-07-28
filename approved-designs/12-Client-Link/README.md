# 12 Private Client Link - Design Handoff Package

## Purpose
The **Private Client Link** interface provides a mobile-first, zero-login, client-safe property presentation viewer for buyers opening shared WhatsApp links.

---

## Security Invariants & Client-Safe Guarantees
1. **Zero Secret Leak Guarantee**:
   - `sellerName`, `sellerPhone`, `commission`, `negotiationNotes`, and draft status are **strictly excluded** from client link payloads.
2. **Snapshot Integrity**:
   - Client links read from a frozen creation snapshot, isolating buyer views from live inventory mutations.
3. **Audio & Media Security**:
   - Storage buckets (`property-photos` and `client-link-audio`) are private; media URLs are 15-minute signed URLs minted by the Edge Function broker (`resolve-client-link`).
4. **Token Security**:
   - Raw tokens exist only in URL parameters and are stripped from browser history immediately upon load. Server stores only SHA-256 hashes.

---

## Included Files
- `index.html`: Interactive mobile-first client presentation viewer with state switcher.
- `README.md`: Security invariants and interaction documentation.
- `SCREEN_SPECIFICATION.md`: Detailed component breakdown, layout rules, and privacy controls.

---

## Interactive States Demonstration in `index.html`
- **Default View**: Mobile-first presentation with Dealer Voice Note player, Approved Photo gallery, Property Specs, and Contact CTAs.
- **Price Hidden View**: Layout behavior when `priceVisibility = 'hidden'`.
- **Expired Link State**: Graceful messaging when token validity period (3/7/14/30 days) has lapsed.
- **Revoked Link State**: Deactivated link display when dealer manually revokes access.
- **Unavailable Media State**: Fallback for missing/deleted photo or audio storage objects.
- **Loading State**: Shimmer loader while Edge Function resolves token.
