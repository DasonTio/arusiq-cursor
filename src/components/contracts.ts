/**
 * Component contracts — prop interfaces only, no implementations.
 *
 * WHY THIS FILE EXISTS
 * Rules written in prose get forgotten by turn 40. Rules written in a type
 * signature cannot be. Every required prop here corresponds to an invariant in
 * `context/requirements/requirements.json`, so a screen that omits one does not
 * render wrong — it does not compile.
 *
 * This is the mechanism behind the claim that agents cannot produce slop here:
 * the degrees of freedom are removed structurally rather than by review.
 *
 * OWNED BY THE DESIGN SYSTEM. Implementations live beside their component;
 * these signatures are changed only with an ADR.
 */
import type { ReactNode } from 'react';
import type { Severity } from '../lib/domain/severity.ts';
import type { Provenance } from '../lib/domain/provenance.ts';
import type { CommandState } from '../lib/domain/command.ts';
import type { RestrictionStep } from '../lib/domain/restriction.ts';
import type { IconSize } from '../design-system/tokens.ts';

/** An i18n key. Never display text — that is the whole point (D5 UR-LANG-01). */
export type I18nKey = string;

/* -------------------------------------------------------------- provenance */

/**
 * D7 §11 — provenance is typographic, not chromatic: a small bordered label in
 * gray-2. Colour is fully committed to severity and is not available to borrow.
 */
export interface ProvenanceChipProps {
  provenance: Provenance;
}

/**
 * The most repeated component in the product (D7 §12.3).
 *
 * `provenance` is REQUIRED, not optional-with-a-default. A default would mean
 * an unlabelled figure renders successfully, and D6's data-integrity NFR is
 * "100 % of figures labelled". For an aggregate, pass
 * `weakestProvenance([...inputs])` — never the provenance you wish it had.
 *
 * `unit` is separate from `value` because D7 §12.3 fixes their relationship:
 * the unit is roughly half the value size, same colour, and NEVER on its own
 * line. Concatenating them into one string breaks that and breaks locale
 * formatting at the same time.
 */
export interface MetricProps {
  labelKey: I18nKey;
  value: number | null;
  /**
   * The SI or currency symbol itself — "kWh", "ppm", "°C", "kgCO₂e". These are
   * international and are NOT localised; the surrounding label is. The NUMBER
   * is still formatted from the locale (Indonesian renders `1.444,70`), which
   * is the component's job, not the caller's.
   */
  unit: string;
  provenance: Provenance;
  /** D7 §11.2 — when the value is null this is required: a unit that has not
   *  reported renders grey with a last-seen time, never as 0. */
  lastSeen?: string | null;
  trendKey?: I18nKey;
}

/* ---------------------------------------------------------------- severity */

/**
 * D5 UR-MNT-01 — severity always carries colour AND shape AND label. The
 * component takes a `Severity` rather than a colour precisely so that a caller
 * cannot supply two of the three. There is no `color` prop, and there is no
 * solid-filled variant (ADR-0002: no foreground clears 4.5:1 across all four
 * marks). The rendering is tint + text-safe foreground + hairline border.
 */
export interface SeverityIndicatorProps {
  severity: Severity;
  /** D6 FR-25 — a prediction is "suspected" until a technician verdict.
   *  Rendered as a DASHED BORDER, never a different colour: the severity
   *  colour is already carrying severity. */
  suspected?: boolean;
  size?: IconSize;
}

/**
 * D7 §4.2 — a roll-up is inspectable rather than a bare colour, so the
 * contributing count travels with it: "2 of 14 need attention".
 */
export interface SeverityRollUpProps extends SeverityIndicatorProps {
  contributing: number;
  total: number;
  /** D5 acceptance principle 3 — no screen is a dead end. A roll-up that
   *  cannot be opened is not permitted. */
  href: string;
}

/**
 * D6 FR-21 — an alert is not complete without its evidence and an action.
 * Every field here is required because every one of them is named in the
 * requirement; an alert missing `recommendedAction` is a dead end.
 */
export interface AlertProps {
  severity: Severity;
  titleKey: I18nKey;
  evidence: {
    signalKey: I18nKey;
    threshold: string;
    /** How long the condition has persisted. */
    duration: string;
  }[];
  confidence: number;
  likelyCauseKey: I18nKey;
  impactIfIgnoredKey: I18nKey;
  /** Rendered as a control the user can press, not as a sentence. */
  recommendedAction: { labelKey: I18nKey; onAct: () => void };
  suspected?: boolean;
  /** D7 §14.5 — tamper is red severity but a DIFFERENT CATEGORY from a
   *  mechanical fault, with its own icon and its own filter. It must not
   *  dissolve into the maintenance queue. */
  category?: 'fault' | 'tamper' | 'dataQuality' | 'payment';
}

/* ----------------------------------------------------------------- control */

/**
 * D6 FR-40 / D7 §13.1 — a control is not a toggle that flips.
 *
 * `currentValue` and `targetValue` are separate fields on purpose: the
 * confirmation must show both, plus any policy limit in force, AT THE MOMENT OF
 * THE ATTEMPT rather than afterwards. A single `value` prop makes the required
 * confirmation impossible to build.
 */
export interface CommandControlProps<T = number> {
  state: CommandState;
  currentValue: T;
  targetValue: T | null;
  /** D7 §13.2 step 2 — a setpoint the restriction ladder is capping says so
   *  on the control itself, with its reason. */
  policyLimit?: { value: T; reasonKey: I18nKey } | null;
  onRequest: (next: T) => void;
  /** Present only while `state` is 'acknowledged' or 'queued'. */
  stateSince?: string;
}

/**
 * D7 §13.2 SAFE CONTROL — renders as a PERSISTENT BANNER on the affected unit,
 * never a dismissible toast. There is deliberately no `onDismiss`.
 *
 * `graceRemaining` and `payAction` are required: a restriction shown without a
 * way out and without a deadline is a threat, not a governed process.
 */
export interface RestrictionBannerProps {
  step: RestrictionStep;
  reasonKey: I18nKey;
  graceRemaining: string;
  payAction: { labelKey: I18nKey; href: string };
  /** Admin view only — every step shows requester, approver and timestamp. */
  approval?: { requester: string; approver: string; at: string };
  /** D6 FR-53 — when true, `stop` is unreachable. Surface WHY the ladder
   *  stops at step 3 rather than silently hiding the last rung. */
  healthSensitive?: boolean;
}

/* ------------------------------------------------------------------ charts */

/**
 * ADR-0007 / D7 §12 — no feature file imports Recharts. Charts go through
 * wrappers that hard-code the rules a chart library's defaults would break.
 *
 * `textAlternative` is REQUIRED: "Every chart has a text alternative — a table,
 * a summary sentence, or a toggle to a data view. Meaning is never carried by
 * colour alone, and that applies to a line chart as much as to a badge."
 *
 * `accessibleNameKey` describes WHAT IT SHOWS, not its type. "Energy used per
 * day this month", not "Line chart".
 */
export interface ChartCardProps {
  accessibleNameKey: I18nKey;
  textAlternative: ReactNode;
  provenance: Provenance;
  children: ReactNode;
}

/**
 * D6 FR-61 — the product's headline claim. `methodHref` is required because
 * "the chart is not permitted without a link to the method": the method is what
 * separates a measurement from a marketing number.
 *
 * `completeness` is required because a saving computed from partial data is
 * provisional, and the reader is entitled to know which.
 */
export interface SavingsChartProps extends Omit<ChartCardProps, 'children'> {
  actual: { t: string; kWh: number }[];
  /** Rendered gray-4 DASHED — line style survives colour blindness and
   *  greyscale printing, which hue does not. */
  baseline: { t: string; kWh: number }[];
  methodHref: string;
  completeness: number;
  /** D6 FR-62 — attribute savings to the lever that produced them, so the
   *  client sees HOW they save rather than one opaque percentage. */
  levers?: { labelKey: I18nKey; kWh: number }[];
}

/* ------------------------------------------------------------------ carbon */

/**
 * D5 UR-AIR-06 / D6 FR-66 — indoor CO₂ ppm and kgCO₂e emissions are separate
 * components by construction. They are not two variants of one card, because a
 * shared component is one careless prop away from putting them in the same tile
 * group. They share a chemical symbol and nothing else.
 */
export interface AirFreshnessCardProps {
  ppm: number | null;
  /** D5 UR-AIR-01 — plain-language band, with the figure as supporting detail. */
  bandKey: I18nKey;
  provenance: Provenance;
  lastSeen?: string | null;
  /** D6 FR-63 — state which sensors are MISSING rather than showing a blank. */
  absentSensors?: I18nKey[];
}

export interface EmissionsCardProps {
  kgCO2e: number | null;
  provenance: Provenance;
  /** D6 FR-70 — "a carbon figure shown without its grid factor is
   *  unauditable", so the versioned factor, its source and its effective date
   *  are displayed rather than hidden. Required, not optional. */
  gridFactor: { value: number; source: string; effectiveFrom: string };
  lastSeen?: string | null;
}

/* ------------------------------------------------------------- data states */

/**
 * D7 §18.3 — four treatments that are NOT interchangeable. A discriminated
 * union rather than a `state` string plus optional fields, so `noData` cannot
 * be constructed without a `lastSeen` and `empty` cannot be constructed without
 * the action that creates the first item.
 *
 * Confusing the last two is how a dashboard comes to imply a unit consumed
 * 0 kWh when it was simply offline.
 */
export type DataStateProps =
  | { state: 'loading'; skeleton: ReactNode }
  | { state: 'empty'; explanationKey: I18nKey; createAction: { labelKey: I18nKey; onAct: () => void } }
  | { state: 'error'; whatFailedKey: I18nKey; onRetry: () => void }
  | { state: 'noData'; lastSeen: string | null };

/* ------------------------------------------------------------------- mocks */

/**
 * D7 §14.4 — "Mark the mock as a mock. An unlabelled screen of a trading
 * interface that does not yet exist will be mistaken for one that does."
 * Wraps any Phase 1A surface standing in for a system that is not built.
 */
export interface MockBoundaryProps {
  explanationKey: I18nKey;
  children: ReactNode;
}
