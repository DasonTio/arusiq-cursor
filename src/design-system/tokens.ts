/**
 * Typed mirror of tokens.css. Import these instead of writing CSS variable
 * strings by hand — a typo in `var(--color-gray-9)` is silent at runtime,
 * a typo in `gap(9)` is a compile error.
 *
 * OWNED BY THE DESIGN SYSTEM. Feature agents must not edit this file.
 * tools/verify-tokens.mjs proves this file and tokens.css stay in sync.
 *
 * Domain logic (severity, provenance, commands, restriction) lives in
 * `src/lib/domain/` — this file holds visual tokens only.
 */

export const space = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type Space = (typeof space)[number];
/** D7 §9 — every gap comes from the eleven levels. `gap(3)` → 16px. */
export const gap = (level: Space) => `var(--space-${level})`;

export const radius = ['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export type Radius = (typeof radius)[number];

export const elevation = ['sm', 'md', 'lg'] as const;
export type Elevation = (typeof elevation)[number];

export const duration = ['fast', 'base', 'slow'] as const;
export type Duration = (typeof duration)[number];

export const layer = ['base', 'sticky', 'dropdown', 'overlay', 'modal', 'toast'] as const;
export type Layer = (typeof layer)[number];

/** D7 §7 — 24 px is the default frame; 20 px inline and in icon buttons;
 *  16 px in dense table rows and compact buttons. */
export const iconSize = [16, 20, 24] as const;
export type IconSize = (typeof iconSize)[number];

/** D7 §6.4 — heading LEVEL and heading SIZE are independent. Pick the level
 *  from the content structure, the size from this ramp. */
export const TYPE_ROLE = [
  'authH1', 'authH2', 'pageTitle', 'sectionHeading',
  'cardTitle', 'metricValue', 'body', 'meta', 'caption',
] as const;
export type TypeRole = (typeof TYPE_ROLE)[number];

/** D7 §8.1 — 375 is the primary mobile target, 320 the hard floor, 1536 the
 *  maximum frame with content capped at 1360 and centred. */
export const BREAKPOINTS = {
  mobile: 375, tablet: 768, desktop: 1024, hd: 1440, max: 1536,
} as const;

/** D7 §5.2 — the legal surfaces. Every foreground clears its contrast bar
 *  against all of them, not against white alone. */
export const SURFACE = ['page', 'raised', 'sunken', 'inverse'] as const;
export type Surface = (typeof SURFACE)[number];
