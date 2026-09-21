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
import type { ComponentType, ReactNode } from 'react';
import type { Severity } from '../lib/domain/severity.ts';
import type { Provenance } from '../lib/domain/provenance.ts';
import type { CommandState } from '../lib/domain/command.ts';
import type { RestrictionStep } from '../lib/domain/restriction.ts';
import type { IconSize, Surface } from '../design-system/tokens.ts';

/** An i18n key. Never display text — that is the whole point (D5 UR-LANG-01). */
export type I18nKey = string;

/* -------------------------------------------------------------- provenance */

/**
 * D7 §11 — provenance is typographic, not chromatic: a small bordered label in
 * gray-2. Colour is fully committed to severity and is not available to borrow.
 *
 * `surface` is which of the four legal backgrounds (D7 §5.2) the chip sits on,
 * NOT a style choice: gray-2 measures 1.42:1 on the ADR-0005 hero, so a chip
 * placed there without saying so is an unreadable provenance label — which
 * D6's data-integrity NFR counts as no label at all. It stays optional because
 * three of the four surfaces share one treatment and the fourth is one
 * component.
 */
export interface ProvenanceChipProps {
  provenance: Provenance;
  surface?: Surface;
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
  /**
   * For a figure inside a TABLE CELL, where the column header is already the
   * label. The label is kept for assistive technology and hidden visually,
   * and the value drops to body size: a display-size figure with its own
   * label repeated down every row took a quarter of the payments table and
   * said "Balance due" five times under a column headed Balance.
   */
  compact?: boolean;
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

/* ------------------------------------------------- categorical charts ---- */

/**
 * One line on a categorical chart: a property, a site or a unit.
 *
 * `name` is FREE TEXT, not an `I18nKey`. "AC 1", "Menara Selatan" and "Gudang"
 * are proper nouns that arrive with the data and are not translated — the same
 * documented exception as `PriorityItem.title` and `PageHeader.title`
 * (D5 UR-LANG-01). Everything the CHART says for itself is still a key.
 *
 * `value` is `number | null` because missing is not zero (D7 §11.2). A null is
 * rendered as a BREAK in the line, never interpolated across: a straight
 * segment drawn over an unreported day asserts a reading nobody took.
 */
export interface ChartSeries {
  name: string;
  /** `t` is an ISO-8601 timestamp. The x domain is the sorted union of `t`
   *  across all series, so ragged series align on TIME rather than on index. */
  points: readonly { t: string; value: number | null }[];
  /** D7 §11.2 — a series with nothing to plot is grey and says when it last
   *  reported. Required in spirit for a silent series; optional in the type
   *  because a fully-reporting series has nothing to say. */
  lastSeen?: string | null;
}

/**
 * ADR-0011 — the categorical ramp has SIX colours and the guarantee weakens
 * after the third. The cap is a tuple union rather than an array plus a comment
 * because a seventh series must not compile: it would wrap round to chart-1 and
 * silently merge two properties into one identity, which is precisely the
 * separation the ADR measured. If a screen needs seven categories it needs a
 * different chart — small multiples, or "top 6 and the rest".
 */
export type CategoricalSeriesSet =
  | readonly [ChartSeries]
  | readonly [ChartSeries, ChartSeries]
  | readonly [ChartSeries, ChartSeries, ChartSeries]
  | readonly [ChartSeries, ChartSeries, ChartSeries, ChartSeries]
  | readonly [ChartSeries, ChartSeries, ChartSeries, ChartSeries, ChartSeries]
  | readonly [
      ChartSeries,
      ChartSeries,
      ChartSeries,
      ChartSeries,
      ChartSeries,
      ChartSeries,
    ];

/**
 * D7 §12.2 — "a table, a summary sentence, or a toggle to a data view". A
 * discriminated union rather than `ReactNode`, because `ReactNode` includes
 * `null`: a required prop that accepts nothing is an optional prop with extra
 * steps, and the legend alone is not an account of what the lines DO.
 *
 * `kind: 'table'` is the default worth reaching for — the chart builds the
 * table itself from `series`, locale-formatted, so it cannot disagree with the
 * lines. `summary` is free text (it interpolates series names and formatted
 * figures, so the caller composes it with `t()`); a blank one throws.
 */
export type CategoricalTextAlternative =
  { kind: 'table' } | { kind: 'summary'; summary: string };

/* ------------------------------------------------------------- trend chart */

/** One dated reading. `value` is unit-agnostic; the caller labels it. */
export interface TrendPoint {
  t: string;
  value: number;
}

/**
 * One measured series against the counterfactual it is compared against.
 *
 * `accessibleName` is a FUNCTION, not a string, and that is deliberate: the
 * component hands it totals computed over the days both series report, so a
 * caller cannot summarise a 30-day normal against a 27-day meter. Three
 * hand-rolled copies of this chart each did exactly that before the component
 * existed.
 */
export interface TrendChartProps {
  /** The measurement. The fill belongs to this series. */
  lead: readonly TrendPoint[];
  /** The counterfactual, drawn dashed — it is not a measurement. */
  reference: readonly TrendPoint[];
  accessibleName: (totals: { lead: number; reference: number }) => string;
  leadLabelKey: I18nKey;
  referenceLabelKey: I18nKey;
  /**
   * The SYMBOL — "kWh", "IDR". Required for the same reason it is on
   * `CategoricalChartProps`: a scale without a unit is a shape, and the chart
   * cannot label its own y axis without one.
   */
  unit: string;
  /**
   * The timestamp of a final point that is a PART of a period rather than a
   * whole one — today so far. It is a true reading and it is also lower than
   * every whole day beside it, so the chart marks it rather than letting it
   * read as a collapse. `EnergySeries.partialFrom` carries it.
   */
  partialFrom?: string | null;
}

/**
 * ADR-0011 / ADR-0013 — N properties, sites or units on one pair of axes:
 * "saving vs baseline by site", "consumption by unit".
 *
 * This is NOT `SavingsChartProps` with more lines. That one is a single
 * property measured against its own dashed grey baseline (D6 FR-61); this one
 * compares peers, which is why it needs the ordered ramp, a mandatory legend
 * and the six-slot cap.
 *
 * `provenance` is REQUIRED for the same reason it is on `MetricProps`: a chart
 * is a figure, and D6's data-integrity NFR is "100 % of figures labelled". Pass
 * `weakestProvenance([...inputs])` for a chart drawn from several sources.
 *
 * `unit` is required and is the SYMBOL itself — "kWh", "ppm", "IDR". Lines
 * without units are unreadable, and the symbol is international while the
 * numbers beside it are locale-formatted by the chart.
 *
 * `methodHref` is OPTIONAL here and required on `SavingsChartProps`: the method
 * link is what separates the savings CLAIM from a marketing number, and a
 * consumption-by-unit chart makes no such claim. A screen that does compare
 * against a baseline still passes it.
 */
export interface CategoricalChartProps {
  accessibleNameKey: I18nKey;
  series: CategoricalSeriesSet;
  unit: string;
  provenance: Provenance;
  textAlternative: CategoricalTextAlternative;
  methodHref?: string;
  /** As on `TrendChartProps`: the timestamp of a final point that covers part
   *  of a period rather than the whole of it. Marked, never smoothed away. */
  partialFrom?: string | null;
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
  | {
      state: 'empty';
      explanationKey: I18nKey;
      createAction: { labelKey: I18nKey; onAct: () => void };
    }
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

/* ----------------------------------------------------------------- chrome */

/**
 * D7 §15 / §17 — one primary action per area (navy). Brand red is the
 * secondary action colour; it is not a problem signal.
 *
 * Padding is font-relative (`em`) on purpose: D7 derives expressive-button
 * padding from type size. Callers pass localised children; they never pass
 * a colour.
 *
 * SELECTION IS NOT A VARIANT (ADR-0014). `variant="primary"` is how a chosen
 * filter chip, mode picker or view tab LOOKS; it is not what it IS. Without a
 * second channel a screen reader announces "Cooling, button" for the active
 * mode and for every inactive one — selection carried by colour alone, which
 * is the bare-dot failure of non-negotiable #2 wearing a different costume,
 * and a WCAG 4.1.2 (Name, Role, Value) failure on top of it.
 *
 * The channel is TWO props, not one boolean, because the ARIA underneath them
 * is genuinely different and collapsing it would make one of the two cases
 * lie. Neither prop changes how the button looks: they sit alongside the
 * existing `variant` treatment, they do not replace it.
 *
 * Deliberately NOT `role="tab"` + `aria-selected`. That role is a promise of
 * the whole APG tablist widget — roving `tabindex`, arrow keys, Home/End, an
 * owning `tablist` — and a half-built tablist is less usable than the plain
 * links and buttons in a labelled `<nav>` these already are.
 */
interface ButtonBaseProps {
  variant: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/** The `<button>` form: an action, a toggle, or a view tab that is not a route. */
interface ButtonActionBase extends ButtonBaseProps {
  type?: 'button' | 'submit';
  to?: never;
}

/** A control that holds a state the user flipped. */
interface ButtonToggleProps extends ButtonActionBase {
  /**
   * TOGGLE semantics — `aria-pressed`. A filter chip, a mode or fan choice, an
   * approval that stays down once given: the control itself holds a state the
   * user flipped.
   *
   * A boolean rather than a flag, because `false` MUST REACH THE DOM. ARIA
   * gives a button with no `aria-pressed` a different role presentation from
   * one carrying `aria-pressed="false"`, so a group where only the chosen
   * member sets it announces one toggle button beside four plain buttons — and
   * announces a different set every time the selection moves. Pass it to every
   * member of a group, or to none of them.
   */
  pressed?: boolean;
  /** One claim per control: a button that is both "pressed" and "the current
   *  item" announces twice and means neither. Pick the case. */
  current?: never;
}

/** One of a set is the one on screen — nothing was toggled to get there. */
interface ButtonCurrentProps extends ButtonActionBase {
  pressed?: never;
  /**
   * CURRENT-WITHIN-A-SET semantics — `aria-current`. The query-param view tabs
   * (`?view=now` / `health` / `control`): nothing is toggled, one of several
   * views is simply the one on screen.
   *
   * Unlike `pressed`, this is ABSENT on the others rather than `"false"` —
   * `aria-current` marks the one, and a set of explicit falses is noise the
   * spec does not ask for. So `current={x === active}` on every member is
   * correct here, and so is passing it only to the active one.
   *
   * The ARIA VALUE is derived, not passed: the caller never writes `"page"` or
   * `"true"`. See `Button.tsx` — the choice follows from whether the control
   * navigates, which the component already knows and the caller would get
   * wrong 22 times.
   */
  current?: boolean;
}

/** The `<Link>` form. `to` and `type="submit"` are now exclusive in the type. */
interface ButtonLinkProps extends ButtonBaseProps {
  to: string;
  type?: never;
  /**
   * `aria-pressed` is a supported state of role `button` and of nothing else.
   * A link is not pressable, so a "pressed link" does not compile rather than
   * shipping ARIA an assistive technology is entitled to ignore. A link-shaped
   * control that genuinely toggles something is a `<button>`, not a link.
   */
  pressed?: never;
  current?: boolean;
}

export type ButtonProps = ButtonToggleProps | ButtonCurrentProps | ButtonLinkProps;

/**
 * D7 §15.3 — every input has a real label; helper text is distinct from
 * error text. Padding is `em`-derived. The accessible name is the label,
 * never a placeholder standing in for one.
 */
export interface TextfieldProps {
  id: string;
  labelKey: I18nKey;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'password';
  autoComplete?: string;
  helperKey?: I18nKey;
  errorKey?: I18nKey | null;
  disabled?: boolean;
}

/**
 * ADR-0006 — Lucide, stroke locked at 2. Size locked to the icon token.
 * Decorative icons are silent; icon-only controls pass `labelKey`.
 */
export interface IconProps {
  icon: IconComponent;
  size?: IconSize;
  labelKey?: I18nKey;
}

/**
 * ADR-0012 — the twelve monitored parts, drawn rather than sourced. Lucide has
 * no compressor, evaporator-coil or condenser-fan glyph, so these are
 * hand-drawn schematics on the same 24 px grid at the same stroke.
 *
 * `part` is the catalogue id, NOT a glyph name. A screen cannot ask for the
 * wrong picture for a part, and a part with no glyph is a loud failure rather
 * than an empty box — `partDefinition()` already sets that convention in
 * `src/lib/simulation/catalogue.ts`.
 *
 * Decorative by default (ADR-0006): in a part row the name is already beside
 * the glyph, so a second announcement is noise. `labelled` is for the one case
 * the row is icon-only, and it reuses `part.<id>` — the icon never invents a
 * string of its own.
 */
export interface PartIconProps {
  part: string;
  size?: IconSize;
  labelled?: boolean;
}

/** Structural type so this file does not import `lucide-react`. */
export type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  focusable?: 'false' | 'true' | boolean;
}>;

/* --------------------------------------------------------------- fact strip */

/**
 * One labelled field. `value` is a node, not a string, so a date can stay a
 * `<time>` and a figure can stay a `<Metric>` — the strip is layout, it never
 * formats.
 *
 * `wide` spans the whole row: an approval record is a sentence, not a field,
 * and squeezing it into a quarter of the panel is what made five columns read
 * as a wall.
 */
export interface Fact {
  labelKey: I18nKey;
  value: ReactNode;
  wide?: boolean;
}

/**
 * D7 §12 — the same device the work order and the restriction record both
 * arrived at independently: label above value, in columns.
 *
 * Six sentences in a column are six things to read before the reader knows
 * anything; six labelled fields are six things to scan. `columns` is the
 * count at the 768 frame and above; below it the strip is always two.
 */
export interface FactStripProps {
  fields: readonly Fact[];
  columns?: 2 | 3 | 4;
}

/* -------------------------------------------------------------- notice list */

/** One delivery attempt, as the alert records it. */
export interface NoticeDelivery {
  channel: 'inApp' | 'push' | 'whatsapp' | 'email';
  state: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  at: string;
}

/**
 * The part of an alert a notice row shows. Structural on purpose: the row
 * renders the delivery record, and nothing here should be able to reach the
 * evidence, the projection or the recommended action.
 */
export interface Notice {
  id: string;
  severity: Severity;
  titleKey: I18nKey;
  provenance: Provenance;
  delivery: readonly NoticeDelivery[];
}

/**
 * D6 FR-63 — notices with their per-channel delivery state.
 *
 * Every notice carries the same fields, so they are rows in one panel rather
 * than a deck of cards (§3). Where a row leads somewhere, the ROW is the link
 * — never a card with a button in the corner (§4).
 *
 * `hrefFor` is optional because the two callers differ in kind: a resident's
 * notice opens the alert it came from (INV-NO-DEAD-END), while the admin case
 * screen shows the same notices as the RECORD that consent was given, which
 * leads nowhere by design.
 */
export interface NoticeListProps {
  notices: readonly Notice[];
  hrefFor?: (notice: Notice) => string;
  /** The row's call to action. Required when `hrefFor` is given. */
  hintKey?: I18nKey;
}

/* ----------------------------------------------------------------- bar list */

/** One row: a name, a figure, and optionally somewhere to go. */
export interface BarListItem {
  id: string;
  /** Free text — a room the resident named, or a translated lever label. The
   *  list never invents a string, so the caller translates before it gets
   *  here. */
  name: string;
  /** `null` is MISSING, not zero: the row states its absence and draws no bar
   *  (INV-NO-FABRICATION). */
  value: number | null;
  href?: string;
  /** The row's call to action. Per row, because "Review Eco on the unit" and
   *  "Open the weekly programme" are not the same errand. */
  hintKey?: I18nKey;
}

/**
 * A ranked list of one figure across N things — saving by lever, energy by
 * space, energy by unit.
 *
 * `client.energy` drew all three as decks of full-width cards, one figure and
 * one button each: twenty-two cards and about four thousand pixels of scroll
 * for twenty-two numbers, on the screen whose whole job is comparing them.
 * A bar makes the comparison the reader came for visible; the figure beside
 * it keeps the exact value; the row is the link.
 *
 * `provenance` is required for the same reason it is on the charts: this is a
 * figure, and an aggregate inherits the weakest provenance of its inputs.
 */
export interface BarListProps {
  items: readonly BarListItem[];
  /** The SYMBOL — "kWh", "IDR". */
  unit: string;
  provenance: Provenance;
  accessibleNameKey: I18nKey;
  /** Which channel the bars belong to. Energy is the accent; carbon is eco. */
  tone?: 'accent' | 'eco';
}

/* ---------------------------------------------------------------- asset tree */

/**
 * One node of the asset hierarchy, as the TREE needs it — not as the
 * simulation models it. Property, Floor, Room and Unit all satisfy this
 * shape, and the screen maps its own hierarchy into it: the pattern owns
 * drawing a hierarchy, the screen owns what the hierarchy is.
 */
export interface TreeNode {
  id: string;
  /** Free text a person typed. */
  name: string;
  /**
   * Where this node's roll-up leads. Carried per node rather than derived by
   * the tree, because only the screen that built the node knows whether it is
   * a room or a unit — and guessing that from an id prefix is the kind of
   * thing that breaks silently when an id scheme changes.
   */
  href: string;
  /** Set when the name belongs to the locale pack instead — a generated
   *  floor name. The tree never invents a string. */
  nameKey?: I18nKey | null;
  rollUp: { severity: Severity; contributing: number; total: number };
  /** A second, quieter line beside the name: a category, a floor. */
  metaKey?: I18nKey | null;
  meta?: string | null;
  /** D6 FR-53 — marked wherever it appears, because rung 4 is unreachable
   *  there and an approver must see it before deciding. */
  healthSensitive?: boolean;
  children?: readonly TreeNode[];
}

/**
 * A hierarchy is a tree (`35-dashboard-composition.md` §3): indentation and a
 * connector hairline, inside ONE panel.
 *
 * `client.spaces` and `admin.fleet` walk the same four levels and each drew
 * them as cards inside cards inside cards — a unit sat four boxes deep and the
 * page read as packaging rather than as structure.
 */
export interface AssetTreeProps {
  nodes: readonly TreeNode[];
  /** Names the tree for assistive technology. */
  labelKey: I18nKey;
  /** The word for a health-sensitive space. */
  sensitiveLabelKey: I18nKey;
}

/* --------------------------------------------------------------- data table */

/**
 * One column. `cell` returns a node so a figure can stay a `Metric` and a
 * date can stay a time element — the table is layout and never formats.
 */
export interface DataColumn<Row> {
  key: string;
  labelKey: I18nKey;
  /** Right-aligned and never wrapped: a figure is one figure. */
  numeric?: boolean;
  /**
   * Never wrapped, but still start-aligned. A timestamp is one value and must
   * not break across two lines, yet right-aligning a column of dates leaves
   * them ragged down the left where the reader scans them.
   */
  nowrap?: boolean;
  /** This column names the row, so its cell is a `th` with a row scope. */
  rowHeader?: boolean;
  cell: (row: Row) => ReactNode;
}

/**
 * Repeating fields are a table (`35-dashboard-composition.md` §3), and five
 * screens reached for one: payments, the three on settings, the audit log.
 *
 * The component exists for the part a hand-written table forgets. Below the
 * 768 frame the columns no longer hold, so the table RECOMPOSES rather than
 * shrinking: the header is clipped but stays in the accessibility tree, every
 * cell becomes a block and carries its column name. That only works if every
 * cell has its label, which is exactly the thing nobody remembers to add to
 * the twelfth column — so the table writes it from the column definition.
 */
export interface DataTableProps<Row> {
  /**
   * The table's own name. Visually hidden; a table needs one regardless.
   *
   * It must not simply repeat a heading already above the table — a screen
   * reader then announces "Indoor, heading" and "Indoor, table" one after the
   * other. Name what the table IS, not what the section is about.
   */
  captionKey: I18nKey;
  /** Interpolation for `captionKey`, as `PageHeader` takes for its context. */
  captionValues?: Record<string, string | number>;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
}
