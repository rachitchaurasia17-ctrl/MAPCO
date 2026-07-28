---
name: Optik Architectural Identity
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e4e2e1'
  on-secondary-container: '#656464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  surface-alt: '#F9F9F9'
  muted-text: '#666666'
typography:
  display-xl:
    fontFamily: metropolis
    fontSize: 72px
    fontWeight: '800'
    lineHeight: 80px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: metropolis
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: metropolis
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: metropolis
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: metropolis
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 32px
  margin-desktop: 80px
  margin-tablet: 40px
  margin-mobile: 20px
  section-padding: 120px
---

## Brand & Style

This design system is engineered for a high-end architecture and design studio, prioritizing structural integrity, visual clarity, and sophisticated minimalism. The brand personality is authoritative yet understated, reflecting the precision of a master architect’s blueprint. It targets a discerning clientele who values craftsmanship and "quiet luxury."

The visual style is **Minimalism** with a focus on high-fidelity execution. It avoids unnecessary ornamentation, allowing high-resolution architectural photography to serve as the primary visual driver. The interface functions as a gallery—a neutral, high-contrast frame that provides the breathing room necessary for complex architectural projects to be fully appreciated. Precision is communicated through razor-sharp alignment and a strict adherence to a mathematical grid.

## Colors

The palette is strictly monochromatic, drawing inspiration from architectural materials: ink, stone, and plaster. 

- **Primary Black (#000000):** Used for headlines, primary navigation, and structural borders to anchor the layout.
- **Secondary Gray (#333333):** Reserved for body text and secondary icons to ensure long-form legibility without the harshness of pure black.
- **Surface Alt (#F9F9F9):** A subtle off-white used for large sectional backgrounds to provide soft contrast against pure white cards or images.
- **Tertiary Gray (#E6E6E6):** Used for subtle dividers and disabled states, mimicking the look of architectural vellum or light concrete.

Color is never used for decoration. Functional accents (such as success or error states) should remain muted or rely on iconography and weight rather than chromatic shifts.

## Typography

The typography strategy relies on extreme weight contrast to establish hierarchy. 

**Metropolis** is used for headlines and labels. Its geometric construction mirrors the "built environment," providing a structured and modern feel. Display sizes should use heavy weights (700-800) with tight letter-spacing to create high-impact, editorial-style headings.

**Inter** is utilized for all body copy. It provides a systematic, neutral, and highly legible experience that doesn't compete with the bold headlines. 

**Label-caps** should be used for small metadata, categories, or "breadcrumbs," always in uppercase with generous letter-spacing to evoke the technical aesthetic of architectural drawings.

## Layout & Spacing

The layout utilizes a **Fixed Grid** system (12 columns for desktop, 8 for tablet, 4 for mobile). 

- **Generous Whitespace:** Section vertical padding is intentionally large (120px+) to ensure the user's focus remains on one architectural concept at a time.
- **Precise Alignment:** Content should strictly align to the grid edges. Negative space is used as a functional element to group related content.
- **The "Blueprint" Rule:** Use the 8px base unit for all component-level spacing (padding within cards, gap between labels and inputs) to maintain a rigorous, mathematical rhythm.
- **Mobile Reflow:** On mobile, margins shrink to 20px, and column-heavy layouts (like 3-column galleries) must collapse into a single-column vertical stack to preserve image scale.

## Elevation & Depth

This design system avoids traditional shadows in favor of **Tonal Layers** and **Low-contrast Outlines**. 

Depth is communicated through the stacking of surfaces. For example, a project detail might sit on a `#FFFFFF` card over a `#F9F9F9` background. 

- **Borders:** Use thin (1px), solid `#E6E6E6` or `#000000` borders for structural definition.
- **Flat UI:** Buttons and inputs have no shadows. Hover states are communicated through inverted colors (e.g., White text on Black background) rather than lift or glow.
- **Photography Depth:** Imagery provides the only "real" depth in the UI. Shadows within architectural photos provide the texture, while the UI remains a flat, glass-like overlay.

## Shapes

The shape language is a study in contrast between **Structural Rigidity** and **Visual Softness**:

- **UI Elements (Buttons, Inputs, Chips):** Use **Soft (0.25rem)** corners. This provides a professional, "machined" look that is not quite sharp but avoids being playful.
- **Imagery:** Large architectural photos must use a **Large Radius (1.5rem to 2rem)** for their containers. This creates a high-fidelity "window" effect, softening the impact of heavy architectural photography and making the images feel like premium objects.
- **Structural Dividers:** Always sharp. Horizontal lines and grid-based dividers have 0px roundedness to emphasize the architectural skeleton of the site.

## Components

### Buttons
- **Primary:** Solid `#000000` background, `#FFFFFF` text, `metropolis` bold uppercase labels. No shadow.
- **Secondary/Ghost:** Thin 1px black border, transparent background. Inverts on hover.

### Cards
- Large image containers with `rounded-xl` (1.5rem) corners.
- Typography is placed either directly below the image with zero padding from the horizontal edges of the image, or as a minimal overlay in a corner.

### Inputs & Fields
- Minimalist design: Only a bottom border (1px `#333333`) or a very thin `#E6E6E6` perimeter.
- Labels use `label-caps` and sit strictly above the input.

### Chips & Tags
- Rectangular with `rounded-sm`. 
- Light gray `#F9F9F9` background with `#666666` text to remain unobtrusive.

### Lists
- Projects are presented in "Data Lists" with 1px horizontal dividers between items.
- Use high weight contrast: Project Name (Bold/Black) vs. Project Year/Location (Regular/Gray).

### Navigation
- A "Sticky" header with a pure white background. The logo is the anchor, while links use `label-caps` for a technical, precise feel.