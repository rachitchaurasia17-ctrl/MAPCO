---
name: Maggu Excellence
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3A3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201F1F'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#E7BDB9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#ae8884'
  outline-variant: '#5d3f3c'
  surface-tint: '#ffb3ad'
  primary: '#ffb3ad'
  on-primary: '#680009'
  primary-container: '#e61e2a'
  on-primary-container: '#fffeff'
  inverse-primary: '#c0001a'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#c8c6c4'
  on-tertiary: '#30302f'
  tertiary-container: '#767574'
  on-tertiary-container: '#fbfff8'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ad'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#930011'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e4e2e0'
  tertiary-fixed-dim: '#c8c6c4'
  on-tertiary-fixed: '#1b1c1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
  metallic-silver: '#E5E2E1'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 128px
    fontWeight: '900'
    lineHeight: 110px
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Sora
    fontSize: 72px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.2em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.1em
spacing:
  margin-mobile: 1.25rem
  margin-desktop: 4rem
  gutter: 1.5rem
  base: 0.5rem
  section-padding: 8rem
  container-max: 1280px
---

## Brand & Style

The brand identity centers on **High-Performance Luxury** and **Precision Engineering**, specifically catering to automotive enthusiasts who seek bespoke customization. The emotional response is one of adrenaline, prestige, and technical mastery.

The design style is a hybrid of **High-Contrast Bold** and **Modern Brutalism**. It utilizes a dark, cinematic foundation to make product visuals and the aggressive "Racing Red" primary color pop. Large, italicized typography and sharp edges evoke speed and industrial strength, while metallic gradients and subtle backdrop blurs provide a premium, modern finish. The aesthetic is "Garage-Chic"—sophisticated yet raw.

## Colors

The palette is dominated by a deep, monochromatic **Carbon Black** (#131313) environment, which provides the necessary "negative space" for high-end photography. 

- **Racing Red (#E61E2A):** Used as the high-energy primary accent for calls to action, borders, and highlighting keywords. 
- **Chassis Silver (#E5E2E1):** A metallic-leaning neutral used for secondary text and subtle borders.
- **Pure White (#FFFFFF):** Reserved for high-impact headlines to ensure maximum readability against dark backgrounds.

The design leverages a "Metallic" gradient for decorative text, simulating the sheen of automotive paint and chrome, shifting from deep grays to bright whites.

## Typography

The typography strategy relies on the interplay between **Sora** (Headlines) and **Geist** (UI & Body). 

- **Sora** is utilized for its geometric and futuristic feel. Headlines are often set in **Black (900)** or **ExtraBold (800)** weights, frequently italicized to convey a sense of motion.
- **Geist** provides a technical, mono-influenced clarity for body copy and labels, reinforcing the "engineered" feel of the brand.
- **Scale:** Extremely large display type is used for background "watermark" effects, while standard headlines utilize tight tracking to maintain a compact, aggressive appearance.

## Layout & Spacing

The system uses a **Fixed Grid** approach for desktop, centering content within a 1280px container with generous 64px (4rem) side margins. 

- **Vertical Rhythm:** Large vertical gaps (128px / 8rem) separate major sections to allow the automotive photography to breathe and maintain a premium feel.
- **Grid Structure:** A standard 12-column grid is implied, but most content reflows into a 2-column or 3-column "gallery" layout for services and details.
- **Mobile Adaptivity:** Margins shrink to 20px on mobile, and multi-column layouts stack vertically. Typography sizes for headlines are reduced significantly to fit the narrower viewport while maintaining the "bold" weight.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** rather than traditional drop shadows.

- **Backgrounds:** The base layer is `#131313`. Cards and containers use `#1C1B1B` or `#201F1F` to subtly lift from the background.
- **Backdrop Blur:** Navigation bars and floating panels use a 90% opacity surface with a heavy backdrop blur (12px+) to maintain context of the underlying imagery.
- **Interactions:** Depth is revealed on hover. Images should utilize a subtle scale-up (1.05x), and content blocks should "slide in" or "reveal" from the bottom, creating a sense of physical layering.
- **Borders:** Thin, 1px borders in `surface-container-highest` or `primary` are used to define edges in the absence of shadows.

## Shapes

The shape language is **Strictly Geometric and Sharp**. 

- **Zero Radius:** All primary buttons, input fields, and containers utilize a 0px corner radius. This reinforces the "hard-edged," industrial nature of automotive tuning and metalwork.
- **Graphic Elements:** Decorative elements like horizontal rules (HR) should be thin (1px) and transition from 0% to 100% width on hover.
- **Image Treatment:** Aspect ratios are strictly defined—4:5 for service cards and 1:1 (square) for gallery items.

## Components

- **Primary Buttons:** Rectangular, sharp corners. Solid `primary-container` background with `on-primary` text. Transitions to `secondary` (White) background on hover.
- **Outline Buttons:** 1px `primary` border with transparent background. Includes a trailing icon (arrow) that animates (Y-axis translation) on hover.
- **Service Cards:** Aspect ratio 4:5. Features a bottom-aligned title with a high-contrast gradient overlay. Descriptive text is hidden by default and revealed via a Y-axis slide-up on hover.
- **Nav Links:** Uppercase, wide letter spacing. Hover state changes text color to `primary` and may trigger a subtle bottom-border expansion.
- **Status Chips:** Small, uppercase labels with 1px borders, used to denote categories or legacy metrics (e.g., "The Legacy").
- **Icons:** Use **Material Symbols Outlined**. Keep stroke weights consistent (200-400 range) to match the technical Geist font.