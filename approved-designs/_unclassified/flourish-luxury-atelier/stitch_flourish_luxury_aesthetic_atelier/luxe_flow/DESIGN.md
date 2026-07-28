---
name: Luxe Flow
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#444650'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#757681'
  outline-variant: '#c5c6d2'
  surface-tint: '#475b9c'
  primary: '#00103e'
  on-primary: '#ffffff'
  primary-container: '#0a2463'
  on-primary-container: '#7a8ed2'
  inverse-primary: '#b5c4ff'
  secondary: '#775a19'
  on-secondary: '#ffffff'
  secondary-container: '#fed488'
  on-secondary-container: '#785a1a'
  tertiary: '#151515'
  on-tertiary: '#ffffff'
  tertiary-container: '#292929'
  on-tertiary-container: '#91908f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b5c4ff'
  on-primary-fixed: '#00164d'
  on-primary-fixed-variant: '#2e4382'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.15em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is anchored in the concept of "Modern Architectural Luxury." It captures the essence of a high-end unisex salon by balancing the rigidity of structured patterns—like the checkered marble floors—with the fluid, organic nature of beauty services. 

The aesthetic is **Minimalist-Luxury**. It utilizes heavy whitespace to allow high-contrast typography and metallic accents to act as the primary visual drivers. The target audience expects a professional, curated experience where the digital interface reflects the premium physical environment of the salon. Every interaction should feel intentional, calm, and exclusive.

## Colors

The palette is derived directly from the salon’s interior architecture. 
- **Deep Navy (Primary):** Representing the velvet upholstery and feature walls, this provides a regal, stable foundation for the brand.
- **Antique Gold (Secondary):** Used sparingly for "metallic" accents, calls-to-action, and refined borders to signify prestige.
- **Onyx & Alabaster (Neutrals):** A monochrome base inspired by the checkered flooring. Black provides weight and authority, while the high-key white ensures the UI feels "clean" and hygienic.

Avoid using gradients. Instead, use solid blocks of color or thin 1px metallic strokes to define depth.

## Typography

This design system uses a high-contrast typographic pairing to evoke an editorial, fashion-forward feel.
- **Playfair Display:** Utilized for all headlines and display text. Its sharp serifs and variable stroke widths mirror the sophisticated "v-cut" wall patterns and chandelier aesthetics.
- **Manrope:** A modern, geometric sans-serif used for body copy and interface labels. It ensures legibility and provides a contemporary "tech-forward" balance to the traditional serif.

Use `label-caps` for small descriptors, category tags, and navigation items to maintain a sense of formal organization.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to maintain an "art gallery" feel, centered with generous outer margins. 

- **Grid:** A 12-column grid with 24px gutters.
- **Rhythm:** An 8px linear scale is used for all internal component spacing.
- **Whitespace:** Use aggressive vertical padding (e.g., 80px - 120px) between sections to create a "luxury" sense of scale and breathing room.
- **Mobile:** Transition to a 4-column grid with 16px side margins. Content should stack vertically, maintaining the high-contrast serif headlines as the focal point of each section.

## Elevation & Depth

To maintain a "modern luxury" feel, the design system avoids heavy, muddy shadows. Depth is communicated through:
- **Tonal Layering:** Using slightly different shades of off-white and light grey to separate background surfaces from cards.
- **Refined Outlines:** Instead of shadows, use 1px solid borders in `#C5A059` (Gold) or a very light grey to define containers.
- **Checkered Motifs:** Subtle, low-opacity checkered patterns can be used as background textures for specific sections to reference the salon's flooring.
- **Glassmorphism:** Use only for navigation bars or floating modals—high blur (20px+) with a 10% opacity white fill to simulate polished glass or mirrors.

## Shapes

The shape language is **tailored and architectural**. Elements use a "Soft" (0.25rem) corner radius to prevent the UI from feeling too aggressive, but stay far enough away from "rounded/bubbly" to remain professional.

- **Buttons:** Sharp corners (0px) or Soft (4px) are preferred.
- **Images:** Should be strictly rectangular or use a circular "mirror" crop for staff portraits.
- **Iconography:** Use thin-stroke (1.5px) linear icons with sharp terminations.

## Components

### Buttons
Primary buttons should be Deep Navy with white text, or White with a 1px Gold border. They should feel "heavy" and significant. Hover states should involve a subtle shift to a gold background or a gold border.

### Cards
Cards for services (e.g., "Hair Styling," "Manicure") should use a clean white background with a 1px light grey border. Upon hover, the border transitions to Gold. Typography inside cards should be centered for an editorial look.

### Input Fields
Inputs are minimalist: a single bottom border (1px) in Gold or Navy, with floating labels in `label-caps` typography. This mimics the thin metallic lines seen in the salon's wall decor.

### Chips/Tags
Used for service categories or availability. These should use the `label-caps` style with high letter spacing and a light gold background tint with dark gold text.

### Interactive Elements
Checkboxes and radio buttons should be custom-styled as small, elegant circles or squares with Gold fills when selected, avoiding the default browser styling entirely to preserve the premium aesthetic.