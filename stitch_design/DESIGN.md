---
name: Pro-Intelligence Real Estate System
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d2c5b0'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9b8f7c'
  outline-variant: '#4e4635'
  surface-tint: '#f0c04d'
  primary: '#ffe4af'
  on-primary: '#3f2e00'
  primary-container: '#f5c451'
  on-primary-container: '#6d5100'
  inverse-primary: '#785a00'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#e9e6e6'
  on-tertiary: '#303030'
  tertiary-container: '#cccaca'
  on-tertiary-container: '#565555'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9d'
  primary-fixed-dim: '#f0c04d'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5b4300'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  metric-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 20px
  card-gap: 12px
  thumbnail-size: 60px
  stack-sm: 4px
  stack-md: 8px
  stack-lg: 16px
---

## Brand & Style

The design system is engineered for high-stakes real estate intelligence, evoking a sense of "premium precision." It targets institutional investors and luxury real estate professionals who require a high-density information environment that feels both authoritative and effortless. 

The aesthetic is **Corporate / Modern** with a **Minimalist** restraint. It leans into a "Dark Mode First" philosophy to reduce eye strain during deep data analysis. The emotional response is one of calm confidence—providing the user with a "mission control" experience where every pixel serves a functional purpose. Visual interest is achieved through high-contrast accents and surgical use of depth rather than decorative elements.

## Colors

The palette is anchored in a deep, "True Black" (#0D0D0D) background to provide maximum contrast for data visualization. 

- **Primary:** The Gold/Amber (#F5C451) is used strictly for state indicators, active selections, and critical metrics. It acts as the "intelligence" signal.
- **Surface Tiers:** Secondary (#1A1A1A) is used for primary cards and containers. Tertiary (#262626) is used for hover states and nested UI elements like input fields or secondary buttons.
- **Neutrals:** Text and iconography utilize a scale of high-clarity whites and muted greys to establish a clear hierarchy without visual noise.

## Typography

This design system uses **Inter** for its neutral, systematic character. The typographic strategy focuses on tight tracking for headlines to create a "locked-in" professional look.

- **Metrics & Data:** Use `metric-bold` for distance (e.g., 650 m) and time (e.g., 8 min) to ensure they are the first things a user scans.
- **Labels:** Use `label-caps` for section headers like "INTELLIGENCE HUB" to provide a clear structural anchor.
- **Micro-copy:** Metadata like "Religious Site" or "Healthcare" should be rendered in `body-sm` with a secondary grey color to keep the focus on the primary titles.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy within high-density panels. It utilizes a 4px base unit to ensure tight, disciplined alignment characteristic of professional intelligence tools.

- **High-Density Lists:** Vertical lists should maintain a compact rhythm. Use `stack-md` between list items.
- **Thumbnails:** All landmark/property thumbnails are strictly 60x60px with a subtle `rounded-lg` corner.
- **Safe Areas:** Maintain a 20px `container-padding` for all primary intelligence panels to ensure the content feels framed and premium, never cramped against the screen edges.

## Elevation & Depth

Hierarchy in this design system is achieved through **Tonal Layering** and subtle **Luminescent Accents**. 

- **Surface Levels:** The background is #0D0D0D. Cards sit at #1A1A1A. Active or "Selected" states do not use heavy shadows; instead, they use a 1px inner border of #F5C451 or a very soft 15% opacity gold outer glow (5px blur).
- **Interactive States:** On hover, a surface should shift from #1A1A1A to #262626. 
- **Separators:** Use low-contrast 1px strokes (#262626) for horizontal rules between list items to maintain structure without breaking the visual flow.

## Shapes

The shape language is "Sophisticated Softness." We avoid sharp corners to maintain a modern, premium feel, but we avoid "Pill" shapes for containers to keep the tool feeling professional rather than casual.

- **Standard Radius:** 8px for cards and primary buttons.
- **Large Radius:** 16px for main intelligence panels or flyout menus.
- **Small Radius:** 4px for small tags or input checkboxes.

## Components

- **Buttons:** Primary buttons use a solid #F5C451 background with black text. Secondary buttons use a #262626 background with white text.
- **Intelligence Cards:** Must include a 60px thumbnail on the left, followed by a vertical stack: Title (headline-sm), Category (body-sm), and a horizontal row of metrics (metric-bold).
- **Segmented Controls:** Used for switching between "Details" and "Intelligence." These should be dark (#1A1A1A) with the active segment using a slightly lighter grey (#333333) and white text.
- **Active Indicators:** Selected cards feature a vertical 2px "Gold Signal" bar on the far-left edge and a 1px gold border.
- **Status Chips:** Small, high-contrast badges (e.g., "Active") should use italicized `label-caps` in the primary gold color to denote urgency and status.
- **Data Icons:** Use 16px glyphs in a muted grey for walking/driving icons, switching to gold only when the data point is highlighted.