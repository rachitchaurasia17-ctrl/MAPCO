---
name: Five Elements Architects
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Metropolis
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 80px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Metropolis
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Metropolis
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Metropolis
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Metropolis
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Metropolis
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Metropolis
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  caption:
    fontFamily: Metropolis
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 32px
  margin-desktop: 64px
  margin-mobile: 24px
---

## Brand & Style
The design system embodies a high-end architectural aesthetic, prioritizing precision, structural integrity, and spatial clarity. It targets a sophisticated clientele seeking a seamless integration of architecture, construction, and interior design. 

The visual language is rooted in **Minimalism** with a focus on rhythmic spacing and stark contrast. It evokes an emotional response of permanence, expertise, and quiet luxury. The UI should feel like a well-drafted architectural plan: intentional, uncrowded, and refined.

## Colors
This design system utilizes a monochrome palette to allow architectural imagery and structural forms to take center stage. 

- **Primary:** Pure black (#000000) for core branding, primary typography, and structural lines.
- **Secondary:** Medium greys for supportive information and inactive states.
- **Neutral:** A range of whites and subtle grey surfaces (#F5F5F5, #EBEBEB) to create depth without introducing hue.
- **Background:** Crisp white (#FFFFFF) provides the "negative space" essential to the minimalist aesthetic.

## Typography
Metropolis provides a geometric, structured foundation. Bold display typography is used to anchor layouts and establish a clear hierarchy.

- **Display Scales:** Used for hero sections and impact statements. High weight and tight letter-spacing create a "built" feel.
- **Label-caps:** Used for metadata, categories, and small navigation items to provide an institutional, drafted look.
- **Body:** Generous line-height is maintained to ensure readability and a sense of "air" within the text blocks.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop to maintain strict control over alignment, reflecting architectural precision. 

- **Desktop:** 12-column grid with a maximum width of 1440px. Large 64px margins create a frame-like effect for the content.
- **Mobile:** Single-column layout with 24px side margins.
- **Rhythm:** All spacing (padding, margins, gaps) must be multiples of the 8px base unit. Vertical rhythm is emphasized to create a sense of structural order.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Low-contrast Outlines** rather than shadows. 

- **Surfaces:** Use subtle shifts from White to Off-white (#F5F5F5) to distinguish between background and foreground elements.
- **Borders:** Hairline borders (1px) in light grey (#EBEBEB) define zones without adding visual weight.
- **Focus:** No ambient shadows are used. Depth is purely "architectural," achieved by stacking flat surfaces.

## Shapes
In line with architectural drafting, this design system utilizes **Sharp** edges. 

All UI elements—including buttons, input fields, cards, and images—feature 0px border radii. This reinforces the "Five Elements" focus on construction and structural geometry. Circles may be used exclusively for specific icons or avatars to provide a singular point of organic contrast.

## Components
- **Buttons:** Primary buttons are solid black with white Metropolis Bold caps. Secondary buttons use a 1px black outline. No rounded corners.
- **Input Fields:** Bottom-border only or a full hairline outline. Labels use `label-caps`.
- **Cards:** Defined by subtle background fill (#F5F5F5) or hairline borders. Images within cards must always be full-bleed to the card's edge.
- **Lists:** Clean, horizontal dividers (1px) with generous vertical padding.
- **Navigation:** Minimalist top-tier navigation with heavy use of whitespace. Active states are indicated by a bold weight change or a simple 2px underline.
- **Portfolio Grid:** Asymmetric grid layouts for architectural photography, using varied column spans to create visual interest.