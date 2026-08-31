/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · category icons
   ---------------------------------------------------------------
   Phase 2 invents its own category labels ("Daily Needs & Groceries",
   "Employment & IT Hubs", …) — there is no fixed enum to switch on. So
   icons are chosen by keyword against the label, with the candidate's
   own discovery category as a second signal and a neutral fallback.

   A wrong-looking icon is cosmetic; an invented place is not. Nothing
   here affects data — this is presentation only.
   ═══════════════════════════════════════════════════════════════ */
import type { EntityKind } from './types.ts';

/** Ordered: the FIRST matching rule wins, so specific patterns precede
 *  general ones ("clinic" before "health", "bakery" before "food"). */
const RULES: ReadonlyArray<{ test: RegExp; icon: string }> = [
  // Everyday needs
  { test: /grocer|supermarket|daily needs|kirana|provision|convenience/i, icon: 'ph-fill ph-shopping-cart' },
  { test: /market|bazaar|shopping|retail|mall|lifestyle/i, icon: 'ph-fill ph-storefront' },
  { test: /bakery|sweets|confection|patisserie/i, icon: 'ph-fill ph-cookie' },
  { test: /cafe|coffee|restaurant|dining|food|eatery/i, icon: 'ph-fill ph-fork-knife' },

  // Health
  { test: /pharmac|chemist|medical store|drug/i, icon: 'ph-fill ph-first-aid-kit' },
  { test: /clinic|doctor|dentist|diagnostic/i, icon: 'ph-fill ph-stethoscope' },
  { test: /hospital|healthcare|health|emergency|nursing/i, icon: 'ph-fill ph-hospital' },

  // Learning
  { test: /school|education|academy|kindergarten|playschool|tuition/i, icon: 'ph-fill ph-graduation-cap' },
  { test: /universit|college|research|institute|higher education/i, icon: 'ph-fill ph-student' },

  // Outdoors and activity
  { test: /park|garden|green space|lake|playground/i, icon: 'ph-fill ph-tree' },
  { test: /gym|fitness|wellness|yoga|spa/i, icon: 'ph-fill ph-barbell' },
  { test: /sport|stadium|cricket|football|swimming|court/i, icon: 'ph-fill ph-soccer-ball' },

  // Services
  { test: /salon|grooming|barber|beauty|personal care/i, icon: 'ph-fill ph-scissors' },
  { test: /worship|temple|gurudwara|gurdwara|mosque|church|religio|spiritual/i, icon: 'ph-fill ph-hands-praying' },
  { test: /bank|atm|finance|insurance/i, icon: 'ph-fill ph-bank' },
  { test: /fuel|petrol|gas station|charging|ev\b/i, icon: 'ph-fill ph-gas-pump' },

  // Wider location
  { test: /it hub|employment|tech park|software|business district|office|corporate/i, icon: 'ph-fill ph-buildings' },
  { test: /commercial|business|industr/i, icon: 'ph-fill ph-briefcase' },
  { test: /airport|aviation|aero/i, icon: 'ph-fill ph-airplane-tilt' },
  { test: /railway|train|metro|station/i, icon: 'ph-fill ph-train' },
  { test: /bus|transit|transport|connectivity/i, icon: 'ph-fill ph-bus' },
  { test: /road|corridor|highway|expressway|flyover|bypass/i, icon: 'ph-fill ph-road-horizon' },
  { test: /infrastructure|civic|municipal|government|administra/i, icon: 'ph-fill ph-building-office' },
  { test: /landmark|cultural|heritage|museum|monument|tourism/i, icon: 'ph-fill ph-map-pin-area' },
  { test: /hotel|hospitality|resort/i, icon: 'ph-fill ph-bed' },
];

const PLACE_FALLBACK = 'ph-fill ph-map-pin';
const GEOGRAPHIC_FALLBACK = 'ph-fill ph-road-horizon';

/**
 * Pick an icon for a card.
 * @param category      Phase 2's category label — the primary signal.
 * @param discoveryHint The candidate's own Phase 1 category/type.
 * @param entityKind    Decides the fallback when nothing matches.
 */
export function categoryIcon(
  category: string,
  discoveryHint?: string | null,
  entityKind: EntityKind = 'PLACE_ENTITY',
): string {
  for (const rule of RULES) {
    if (rule.test.test(category)) return rule.icon;
  }
  if (discoveryHint) {
    for (const rule of RULES) {
      if (rule.test.test(discoveryHint)) return rule.icon;
    }
  }
  return entityKind === 'GEOGRAPHIC_ENTITY' ? GEOGRAPHIC_FALLBACK : PLACE_FALLBACK;
}
