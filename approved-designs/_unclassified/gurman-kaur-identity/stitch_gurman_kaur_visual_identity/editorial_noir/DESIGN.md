---
name: Editorial Noir
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c7c6c6'
  on-secondary: '#303031'
  secondary-container: '#464747'
  on-secondary-container: '#b6b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e2e2e2'
  on-tertiary-container: '#636565'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
  border-subtle: '#222222'
  surface-elevated: '#0A0A0A'
typography:
  display-xl:
    fontFamily: ebGaramond
    fontSize: 80px
    fontWeight: '400'
    lineHeight: 90px
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: ebGaramond
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: ebGaramond
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
  headline-lg-mobile:
    fontFamily: ebGaramond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-md:
    fontFamily: ebGaramond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
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
    fontFamily: inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  label-sm:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
spacing:
  page-margin-desktop: 80px
  page-margin-mobile: 24px
  gutter: 32px
  section-gap: 160px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is a high-contrast, minimalist framework designed for a sophisticated personal brand. It draws heavily from editorial design and luxury fashion aesthetics, emphasizing "quiet luxury" and intellectual depth. 

The style is **Minimalist-Brutalist**: it utilizes raw, unadorned surfaces, aggressive whitespace, and a strict monochromatic palette to create a sense of authority and permanence. The emotional response is intended to be one of calm confidence—favoring clarity and high-end craftsmanship over decorative trends. Every pixel is intentional, every margin is deliberate, and the focus remains entirely on the content.

## Colors

The design system operates on a **Pure Dark** logic. Backgrounds are absolute black (`#000000`) to create a void-like depth, allowing typography to emerge with maximum contrast.

- **Primary:** Pure White is reserved for high-priority headlines and active states, ensuring total legibility.
- **Secondary:** A mid-tone gray (`#727272`) is used for metadata, secondary descriptions, and inactive states to reduce visual noise.
- **Neutral:** Absolute Black provides the canvas.
- **Named Colors:** Low-value grays are used for structural lines and container backgrounds to maintain depth without breaking the high-contrast ethos.

## Typography

The typographic strategy relies on a classic tension between a sophisticated Serif and a functional Sans-Serif.

- **Headlines (ebGaramond):** Chosen for its graceful, classical proportions. Headlines should be treated like mastheads—elegant and spacious. Tighten letter-spacing slightly at larger sizes to maintain a modern, "locked-in" feel.
- **Body & Interface (Inter):** A neutral, systematic sans-serif that provides a grounding, utilitarian contrast to the serif. It ensures clarity in dense information areas.
- **Micro-copy:** Use `label-caps` for section headers and navigation to inject a modern, architectural rhythm into the layout.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy with expansive margins to evoke a gallery-like atmosphere. 

- **Desktop:** 12-column grid with generous `80px` margins. Content is often centered or offset to create intentional "islands" of information.
- **Vertical Spacing:** Utilize aggressive `section-gap` units (`160px`) to separate major portfolio pieces or narrative beats. This "pacing" is critical to the brand's sophisticated feel.
- **Reflow:** On mobile, margins compress to `24px`, and the 12-column grid collapses to a single-column stack. Typography scales down specifically for display roles to prevent awkward line breaks.

## Elevation & Depth

In keeping with the minimalist-brutalist style, this design system avoids shadows entirely. Depth is achieved through **Tonal Layering** and **Structural Outlines**.

- **Surfaces:** Use `#0A0A0A` for containers or cards to subtly lift them from the true black background.
- **Outlines:** Use thin, 1px borders in `border-subtle` (`#222222`) to define boundaries. These "ghost borders" should be nearly invisible, appearing only as a structural hint.
- **Hierarchy:** Importance is conveyed through scale and contrast (white vs. gray) rather than physical depth.

## Shapes

The shape language is strictly **Sharp (0)**. 

Every interactive element, image container, and structural divider must utilize 90-degree angles. This rejection of softness reinforces the "Sophisticated/Modern" persona, giving the brand a rigorous, architectural precision. Do not use border-radii for buttons or card containers under any circumstances.

## Components

### Buttons
Primary buttons are solid White with Black text, sharp corners. Hover states invert the colors or trigger a 1px white outline. Secondary buttons are 1px white outlines with transparent backgrounds.

### Input Fields
Inputs are defined by a single bottom border (`1px solid #727272`). Upon focus, the border transitions to White. Labels use `label-caps`.

### Cards
Cards are simple, borderless containers with `0A0A0A` backgrounds. Images within cards should maintain a consistent aspect ratio (usually 4:5 or 1:1) and occupy the full width of the container.

### Lists
Lists are separated by thin, full-width horizontal dividers (`border-subtle`). Use `label-caps` for the list numbering or categories to create an organized, index-style look.

### Navigation
Navigation links should be minimalist. Use `inter` at small sizes with generous letter spacing. The active state is indicated by a simple underline or an opacity shift from gray to white.