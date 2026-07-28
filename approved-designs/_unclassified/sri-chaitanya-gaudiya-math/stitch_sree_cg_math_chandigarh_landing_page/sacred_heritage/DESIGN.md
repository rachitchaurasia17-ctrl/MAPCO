---
name: Sacred Heritage
colors:
  surface: '#fbf9f1'
  surface-dim: '#dcdad2'
  surface-bright: '#fbf9f1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ec'
  surface-container: '#f0eee6'
  surface-container-high: '#eae8e0'
  surface-container-highest: '#e4e3db'
  on-surface: '#1b1c17'
  on-surface-variant: '#554336'
  inverse-surface: '#30312c'
  inverse-on-surface: '#f3f1e9'
  outline: '#887364'
  outline-variant: '#dbc2b0'
  surface-tint: '#904d00'
  primary: '#8d4b00'
  on-primary: '#ffffff'
  primary-container: '#b15f00'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb77d'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#27627b'
  on-tertiary: '#ffffff'
  tertiary-container: '#437b95'
  on-tertiary-container: '#fbfdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc3'
  primary-fixed-dim: '#ffb77d'
  on-primary-fixed: '#2f1500'
  on-primary-fixed-variant: '#6e3900'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#bfe8ff'
  tertiary-fixed-dim: '#96ceeb'
  on-tertiary-fixed: '#001f2b'
  on-tertiary-fixed-variant: '#044d65'
  background: '#fbf9f1'
  on-background: '#1b1c17'
  surface-variant: '#e4e3db'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  max-width: 1280px
---

## Brand & Style

This design system is crafted to evoke a sense of **devotional grandeur and serene heritage**. It draws inspiration from the architectural majesty of Vedic temples and the warmth of monastic life. The brand personality is one of ancient wisdom meeting modern clarity—authoritative yet deeply welcoming.

The visual style is a blend of **Minimalism and Tactile Heritage**. While the layout maintains clean, airy whitespace to allow for contemplation, the UI elements utilize rich textures and traditional motifs. We employ subtle depth to mimic the layered stone carvings of temple walls and the soft folds of saffron robes. The emotional response should be one of "transcendental peace"—a digital sanctuary that feels grounded in tradition.

## Colors

The palette is rooted in the sacred colors of the Gaudiya Vaishnava tradition.

- **Saffron/Terracotta (#D97706):** Our primary brand color, representing renunciation, fire, and the energy of the sun. Used for primary actions and key accents.
- **Antique Gold (#D4AF37):** Used for decorative elements, borders, and icons to denote divinity and the richness of heritage.
- **Deep Peacock Blue (#004B63):** A grounding contrast color used for deep footers, secondary headings, or interactive states, evoking the color of the monsoon sky and Krishna.
- **Soft Ivory (#FFFDF5):** The foundational background color, replacing harsh whites to provide a warm, parchment-like feel that is easy on the eyes during long periods of reading.

## Typography

The typography strategy relies on the contrast between the literary elegance of the past and the functional clarity of the present.

- **Headings:** **Playfair Display** is used to convey authority and grace. Large display headings should use "Oldstyle" figures if available, emphasizing the historical nature of the content.
- **Body:** **Inter** provides a highly legible, neutral counterpoint to the decorative headings, ensuring that long spiritual discourses and philosophical texts remain accessible on all devices.
- **Hierarchical Polish:** Captions and labels use Inter with increased letter spacing and uppercase styling to create a "structured" look that balances the more fluid serif headings.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for desktop to maintain a sense of structured "temple architecture," while transitioning to a fluid model for mobile devices.

- **Grid:** A 12-column grid is used for desktop. Content is often centered with generous margins to focus the user’s attention, mimicking the experience of a shrine.
- **Rhythm:** We utilize an 8px base unit. Vertical rhythm is intentionally loose; "breathing room" is a functional requirement to evoke serenity.
- **Responsive Behavior:** On mobile, margins shrink to 20px, and complex multi-column layouts collapse into a single-column stack. Content-heavy sections (like scriptures) should use a focused 1-column layout even on desktop to minimize distraction.

## Elevation & Depth

To achieve a "tactile heritage" feel, elevation is expressed through **Tonal Layers** and **Ambient Shadows** rather than sharp shadows.

- **The Ground:** The Soft Ivory (#FFFDF5) serves as the "earth."
- **Raised Elements:** Cards and containers use a very subtle, warm-tinted shadow (Primary color at 5% opacity) with a large blur radius to create a soft, "levitating" effect.
- **Depth through Borders:** We use thin 1px Antique Gold (#D4AF37) borders for high-level containers, reminiscent of gold-leafed frames or architectural detailing.
- **Recessed Areas:** Use a slightly darker shade of Ivory for input fields or wells to create a "carved" look.

## Shapes

The shape language is **Soft (0.25rem - 0.75rem)**. We avoid perfectly sharp corners to maintain a "human" and "organic" feel, but avoid overly rounded or "bubbly" shapes which lack the necessary formal gravity.

- **Standard Elements:** Buttons and input fields use a 4px (0.25rem) radius.
- **Large Containers:** Cards and modal windows use an 8px (0.5rem) radius.
- **Traditional Accents:** Occasionally, use "Arch" shapes (top-rounded only) for image frames to mimic temple gateways (Toranas).

## Components

### Buttons
- **Primary:** Solid Saffron (#D97706) with Ivory text. Subtle 4px radius. On hover, the color deepens slightly.
- **Secondary:** Antique Gold (#D4AF37) outline with Saffron text.
- **Tertiary:** Text-only in Peacock Blue, using the Label-SM typography for a crisp, professional feel.

### Cards
Cards are the primary vehicle for content (events, biographies, temple news). They should feature a 1px Antique Gold border and a soft ambient shadow. Large imagery within cards should have a subtle inner glow to feel "lit from within."

### Inputs & Forms
Form fields use the Soft Ivory background but are defined by a bottom-only border in Antique Gold when inactive, turning into a full Peacock Blue border when focused. This mimics the elegance of traditional stationery.

### Decorative Dividers
Instead of simple lines, use a center-aligned motif (like a small lotus icon or a stylized gold flourish) to separate major content sections.

### Imagery
Photos should have a warm temperature bias. Use subtle vignettes or "faded edge" masks to blend historical photographs into the Ivory background seamlessly.