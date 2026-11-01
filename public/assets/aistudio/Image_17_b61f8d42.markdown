---
name: Cloud Architecture & Cost Engine
colors:
  surface: '#f9f9ff'
  surface-dim: '#d1daf4'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8ff'
  surface-container-highest: '#d9e2fc'
  on-surface: '#121b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#273044'
  inverse-on-surface: '#edf0ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#4b4bd2'
  primary: '#4141c8'
  on-primary: '#ffffff'
  primary-container: '#5b5ce2'
  on-primary-container: '#f2efff'
  inverse-primary: '#c1c1ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#642fcd'
  on-tertiary: '#ffffff'
  tertiary-container: '#7d4de7'
  on-tertiary-container: '#f6eeff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1dfff'
  primary-fixed-dim: '#c1c1ff'
  on-primary-fixed: '#08006b'
  on-primary-fixed-variant: '#322fba'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#f9f9ff'
  on-background: '#121b2e'
  surface-variant: '#d9e2fc'
typography:
  display-lg:
    fontFamily: DM Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: DM Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  title-md:
    fontFamily: DM Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  numeral-lg:
    fontFamily: DM Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.03em
  numeral-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system targets cloud architects, FinOps leads, and technical founders who need instant clarity on high-stakes cloud infrastructure modeling. The visual atmosphere balances mathematical precision with frictionless SaaS clarity. 

The aesthetic is Modern Functionalist SaaS: razor-sharp hierarchy, layered tonal cards, generous breathing room, and luminous micro-accents. It balances institutional analytical utility with modern mobile polish, evoking complete technical confidence without enterprise clutter.

## Colors
The color architecture relies on high-contrast precision anchored in slate depths and crisp white surfaces:

- **Canvas & Surface Tier**: Canvas is set to `#F7F8FA` (soft off-white). Elevating cards use `#FFFFFF` with structural border definition via `#E5E7EB`. Muted panels and inactive input tracks use `#EEF2F6`.
- **Primary Indigo (`#5B5CE2`)**: Used for primary action buttons, focused metric states, active toggle tracks, and key cost highlight anchors.
- **Secondary Emerald (`#10B981`)**: Dedicated to cost savings, optimized delta percentages, under-budget margins, and positive financial alerts.
- **Tertiary Violet (`#8B5CF6`) & Cyan (`#06B6D4`)**: Used selectively for AI infrastructure recommendations, ML node sizing, and telemetry data visualization badges.
- **Text & Neutral Hierarchy**: Primary text is `#172033` (deep slate navy) for contrast without pure black harshness. Secondary copy sits at `#64748B`, while disabled/placeholder text uses `#94A3B8`.

## Typography
Typographic scale unites `DM Sans` for structured geometric headers and currency figures with `Inter` for data tables, operational controls, and body hierarchy. 

Numerical figures in calculator results must implement `font-variant-numeric: tabular-nums` to eliminate jitter across dynamic sliders and currency recalculations. Uppercase badge labels require `0.04em` tracking to preserve legibility at micro scales (11px).

## Layout & Spacing
Designed mobile-first with a 4-column fluid layout across handheld viewport bounds (360px–428px), maintaining an outer safe canvas gutter of `16px` (`margin: 1rem`). 

All interactive tap targets conform to a minimum 44px vertical dimension. Vertical stacked layouts use `space-md` (16px) separation between cards, while atomic metric inputs utilize `space-sm` (8px) gaps. Fixed bottom summary action sheets leverage `16px` padding combined with standard device safe area insets.

## Elevation & Depth
Elevation is achieved using sharp structural boundaries paired with subtle ambient diffusion:

- **Level 0 (Canvas)**: Raw `#F7F8FA` background plane without shadows.
- **Level 1 (Card & Module Layer)**: Pure `#FFFFFF` fill bounded by a crisp 1px `#E5E7EB` outline, supported by an ultra-diffuse ambient shadow: `0 1px 3px rgba(23, 32, 51, 0.04), 0 4px 12px rgba(23, 32, 51, 0.03)`.
- **Level 2 (Popovers, Tooltips & Sticky Bottom Bars)**: Pure `#FFFFFF` surface with `0 8px 24px -4px rgba(23, 32, 51, 0.08)` and border `#E5E7EB`.
- **Active State Depth**: High-priority interactive elements feature a tight inner micro-glow (`box-shadow: 0 0 0 3px rgba(91, 92, 226, 0.15)`).

## Shapes
A universal base curvature of 16px (`1rem`, `rounded-lg`) unifies the interface:

- **Containers & Calculator Cards**: Built with uniform `16px` corner curvature.
- **Inputs & Sliders**: Field wrappers and active target regions feature `12px` to `16px` radii for comfortable touch anchoring.
- **Pills, Badges & Toggles**: Fully radiused (`9999px`) pill structures for AI badges, telemetry tags, and quick-toggle tier switches.

## Components

### Action Buttons
- **Primary**: Solid `#5B5CE2` fill, text `#FFFFFF`, 16px border-radius, 48px height, medium weight typography. Pressed state shifts to `#4B4CD0`.
- **Secondary / Ghost**: Background transparent or `#EEF2F6`, border 1px solid `#E5E7EB`, text `#172033`.

### Interactive Sliders & Metric Steppers
- **Track**: 6px height, background `#E5E7EB`, filled active state using `#5B5CE2`.
- **Thumb**: 24px circular white surface with subtle border `#E5E7EB` and `0 2px 6px rgba(23, 32, 51, 0.15)`.
- **Value Readout**: Prominent `DM Sans` 17px semi-bold numeral aligned to the upper right of the slider label.

### Chips & Analytics Badges
- **AI Recommendation Tag**: Background `#8B5CF6` at 10% opacity, text `#8B5CF6`, 11px uppercase label, full pill radius.
- **Cost Savings Badge**: Background `#10B981` at 12% opacity, text `#047857`, 12px semi-bold, leading upward-trend chevron.
- **Telemetry Tag**: Background `#06B6D4` at 12% opacity, text `#0E7490`.

### Cards & Configuration Modules
- Background `#FFFFFF`, 16px border-radius, 1px border `#E5E7EB`, 16px internal padding.
- Internal partitions use 1px solid divider lines using `#F1F5F9`.

### Form Fields & Node Selectors
- Height 48px, background `#FFFFFF`, border 1px solid `#E5E7EB`, 12px border-radius.
- Focused state applies border `#5B5CE2` with 3px concentric focus ring (`rgba(91, 92, 226, 0.12)`).