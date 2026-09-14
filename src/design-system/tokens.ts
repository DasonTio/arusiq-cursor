/**
 * Typed mirror of tokens.css. Import these instead of writing CSS variable
 * strings by hand — a typo in `var(--color-gray-9)` is silent at runtime,
 * a typo in `color.gray[9]` is a compile error.
 *
 * OWNED BY THE DESIGN SYSTEM. Feature agents must not edit this file.
 * tools/verify-tokens.mjs proves this file and tokens.css stay in sync.
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

/* ---------------------------------------------------------------- severity */

/**
 * D5 UR-MNT-01 / D7 §4 — the product's core alerting mechanic.
 * Colour never travels alone: every severity carries mark, shape and label.
 * The `label` here is an i18n KEY, never display text (D5 UR-LANG-01).
 */
export const SEVERITY = {
  critical: { rank: 3, shape: 'square',     labelKey: 'severity.critical' },
  warning:  { rank: 2, shape: 'triangle',   labelKey: 'severity.warning'  },
  unknown:  { rank: 1, shape: 'dashedRing', labelKey: 'severity.unknown'  },
  normal:   { rank: 0, shape: 'circle',     labelKey: 'severity.normal'   },
} as const;

export type Severity = keyof typeof SEVERITY;
export type SeverityShape = (typeof SEVERITY)[Severity]['shape'];

/**
 * D7 §4.2 — roll-up precedence is critical > warning > unknown > normal.
 * `unknown` outranks `normal` because an unreported unit may be the broken one;
 * a grey child is never counted as green in a parent (D7 §4.1).
 */
export const rollUp = (children: readonly Severity[]): Severity =>
  children.reduce<Severity>(
    (worst, s) => (SEVERITY[s].rank > SEVERITY[worst].rank ? s : worst),
    'normal',
  );

/* -------------------------------------------------------------- provenance */

/**
 * D6 NFR Data integrity — 100 % of figures are labelled. This is a required
 * prop on every metric component, not an optional decoration, so the compiler
 * refuses a screen that shows an unlabelled number.
 *
 * D8: an aggregate inherits the WEAKEST provenance of its inputs — one
 * simulated reading makes the whole total simulated. Use `weakestProvenance`.
 */
export const PROVENANCE = {
  simulated:   { rank: 0, labelKey: 'provenance.simulated'   },
  estimated:   { rank: 1, labelKey: 'provenance.estimated'   },
  provisional: { rank: 2, labelKey: 'provenance.provisional' },
  verified:    { rank: 3, labelKey: 'provenance.verified'    },
} as const;

export type Provenance = keyof typeof PROVENANCE;

export const weakestProvenance = (inputs: readonly Provenance[]): Provenance =>
  inputs.reduce<Provenance>(
    (weakest, p) => (PROVENANCE[p].rank < PROVENANCE[weakest].rank ? p : weakest),
    'verified',
  );

/**
 * D7 §11.2 / D5 UR-CAR-08 — "verified" is the only provenance under which the
 * word *credit* is permissible. Everything else says *avoided emissions*.
 */
export const mayUseWordCredit = (p: Provenance): boolean => p === 'verified';

/* ----------------------------------------------------------- command state */

/**
 * D7 §13.1 / D6 FR-40 — a control command is not a toggle that flips. The
 * interface distinguishes "we asked" from "the machine did it".
 */
export const COMMAND_STATE = [
  'sent', 'acknowledged', 'verified', 'failed', 'queued',
] as const;
export type CommandState = (typeof COMMAND_STATE)[number];

/** Only `verified` settles the control into its new position (D7 §13.1). */
export const isSettled = (s: CommandState) => s === 'verified' || s === 'failed';

/* ------------------------------------------------------ restriction ladder */

/**
 * D7 §13.2 / D6 §10 SAFE CONTROL — restriction is a ladder with a gate at
 * every step, never a single switch. `stop` is unreachable for spaces flagged
 * health-sensitive (D6 FR-53).
 */
export const RESTRICTION_STEP = [
  'reminder', 'setpointRaised', 'ecoLockLimitedHours', 'stop',
] as const;
export type RestrictionStep = (typeof RESTRICTION_STEP)[number];

export const isStepPermitted = (
  step: RestrictionStep,
  space: { healthSensitive: boolean },
): boolean => !(step === 'stop' && space.healthSensitive);

/* ---------------------------------------------------------- data lifecycle */

/**
 * D7 §18.3 — four distinct treatments, and they are NOT interchangeable.
 * Confusing `noData` with `empty` is how a dashboard comes to imply that a
 * unit consumed 0 kWh when it was simply offline.
 */
export const LOAD_STATE = ['loading', 'empty', 'error', 'noData', 'ready'] as const;
export type LoadState = (typeof LOAD_STATE)[number];

/* --------------------------------------------------------------- typography */

/** D7 §6.4 — heading LEVEL and heading SIZE are independent. */
export const TYPE_ROLE = [
  'authH1', 'authH2', 'pageTitle', 'sectionHeading',
  'cardTitle', 'metricValue', 'body', 'meta', 'caption',
] as const;
export type TypeRole = (typeof TYPE_ROLE)[number];

export const BREAKPOINTS = { mobile: 375, tablet: 768, desktop: 1024, hd: 1440, max: 1536 } as const;
