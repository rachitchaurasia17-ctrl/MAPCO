---
name: Solaris Precision
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
  on-surface-variant: '#4d4732'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e775f'
  outline-variant: '#d0c6ab'
  surface-tint: '#705d00'
  primary: '#705d00'
  on-primary: '#ffffff'
  primary-container: '#ffd700'
  on-primary-container: '#705e00'
  inverse-primary: '#e9c400'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#505f76'
  on-tertiary: '#ffffff'
  tertiary-container: '#cadbf5'
  on-tertiary-container: '#506076'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe16d'
  primary-fixed-dim: '#e9c400'
  on-primary-fixed: '#221b00'
  on-primary-fixed-variant: '#544600'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system is engineered for a high-performance SaaS environment that demands both technical rigor and high-energy engagement. The brand personality is "Luminous Precision"—a blend of elite professional utility and a vibrant, forward-leaning optimism. 

The aesthetic follows a **Premium Minimalist** trajectory, heavily influenced by modern glassmorphism and the clarity of Microsoft’s Fluent design. It leverages high-contrast typography and expansive whitespace to create a "visually addictive" interface where data feels light rather than burdensome. The emotional response should be one of complete control and clarity, as if the user is operating a high-end command deck bathed in natural light.

## Colors
The palette is built on the high-contrast tension between **Electric Yellow** and **Deep Ink**. 

- **Primary (Electric Yellow):** Used sparingly but purposefully for calls-to-action, active states, and critical data highlights. It is an additive color that signifies energy.
- **Secondary (Deep Ink):** The anchor for all structural text and primary iconography, ensuring maximum legibility.
- **Tertiary (Slate):** Used for secondary information and subtle borders.
- **Surface (Snow/Alabaster):** Pure white is the base; Alabaster is used for subtle section differentiation to maintain a bright, breathable UI without resorting to heavy grey washes.

## Typography
This design system utilizes **Inter** for its neutral, systematic excellence and high legibility at small sizes. 

To achieve the "premium" feel, headlines use tight tracking (-0.02em) and bold weights to contrast against the airy layout. Body text is given generous line heights (1.5x - 1.6x) to ensure long-form data remains readable. Labels are frequently uppercase with increased tracking to create a sense of architectural structure within the UI.

## Layout & Spacing
The layout philosophy is based on a **Fluid Grid** with a strict 8px base unit. 

- **Desktop:** 12-column grid with 24px gutters. Wide margins (64px) are used to "float" content in the center of the screen, reinforcing the minimalist aesthetic.
- **Tablet:** 8-column grid with 24px gutters and 32px margins.
- **Mobile:** 4-column grid with 16px gutters and 20px margins.

Vertical rhythm is prioritized; sections should be separated by large padding blocks (80px, 120px, or 160px) to prevent the "cramped" feeling common in data-heavy SaaS.

## Elevation & Depth
Hierarchy is established through **Ambient Shadows** and **Glassmorphism**, avoiding heavy borders.

1.  **Level 0 (Base):** Snow White (#FFFFFF) background.
2.  **Level 1 (Cards):** Alabaster (#FAFAFA) or White with a 1px stroke of 5% Deep Ink. Shadows are ultra-diffused: `0 4px 20px rgba(15, 23, 42, 0.04)`.
3.  **Level 2 (Modals/Popovers):** Glassmorphic surfaces with a 20px backdrop blur and 80% opacity white fill. These use a more pronounced shadow: `0 20px 40px rgba(15, 23, 42, 0.08)`.
4.  **Accent Depth:** Electric Yellow elements should never have heavy shadows; they should appear to "glow" or sit flatly and vibrantly on top of the muted layers.

## Shapes
The shape language is modern and approachable. 

- **Cards & Containers:** Use `rounded-2xl` (16px) to create a soft, high-end feel.
- **Interactive Elements:** Buttons and Input fields use a slightly tighter `12px` radius to feel precise and "clickable."
- **Small Components:** Chips and badges use full pill-shaping (999px) to contrast against the larger structural rectangles.

## Components

- **Buttons:** Primary buttons are filled with Electric Yellow (#FFD700) with Deep Ink (#0F172A) text. Use a 12px corner radius. Secondary buttons should be ghost-styled with a 1px Deep Ink border or a subtle Alabaster fill.
- **Cards:** White backgrounds, 16px radius, and a 1px Alabaster border. Use internal padding of 24px or 32px to ensure content doesn't feel crowded.
- **Inputs:** 12px radius, Alabaster background, and a 1px border that turns Electric Yellow on focus. Focus states should also include a soft yellow outer glow.
- **Chips/Badges:** Use Deep Ink for "Status" or "Category" labels to provide high-contrast anchors. Active chips can use a light yellow wash (10% opacity) with yellow text.
- **Lists:** Clean rows separated by 1px Alabaster dividers. Avoid alternating row colors; use hover states (5% Deep Ink tint) to indicate interactivity.
- **Navigation:** Top-tier navigation should be minimalist with generous horizontal spacing. Active links are indicated by a 3px Electric Yellow underline or a small leading dot.