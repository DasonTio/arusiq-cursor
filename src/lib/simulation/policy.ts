/**
 * Simulated policy inputs — the numbers the product needs and the source
 * documents do not fix.
 *
 * READ THIS BEFORE QUOTING ANYTHING IN THIS FILE.
 *
 * None of these values is a requirement. None came out of D2, D5, D6, D7 or
 * D8. Every one of them is a working value chosen so that Phase 1A has
 * something plausible to render, kept in ONE file so that a specified value
 * replaces it in a single edit instead of being hunted through the dataset.
 *
 * They are separated from `src/lib/domain/` on purpose. The domain holds the
 * *rules* — stale is not fresh, grey is not green, a room outside its band is
 * not comfortable. The edges those rules compare against are inputs, and in the
 * real product they come from the Admin thresholds table (FR-27), the published
 * tariff and grid-factor tables (FR-101) and the device reporting cadence. A
 * default sitting in `lib/domain` would quietly become the number everyone
 * quotes, which is how a demo constant turns into a specification.
 *
 * Anything derived from these carries `provenance: 'simulated'`, so nothing on
 * screen claims more authority than this file has.
 *
 * @requirement FR-15 FR-27 FR-60 FR-63 FR-70
 */

/** D6 FR-62 — the levers a saving is attributed to. */
export const LEVER_KEYS = [
  'eco',
  'setpointAtLeast23C',
  'schedule',
  'occupancy',
  'filterCleaning',
] as const;

export type LeverKey = (typeof LEVER_KEYS)[number];

/**
 * NO SIGNAL LIMITS LIVE HERE. They are in `PART_CATALOGUE` (`catalogue.ts`),
 * beside the signal each one belongs to.
 *
 * There used to be a second table in this file, and it is worth recording why
 * it went. A threshold on its own is not a number — it is a number, a unit and
 * the direction that breaches it, and the moment those three live apart from
 * the signal they describe, they drift. They did: the two tables disagreed on
 * 17 of 24 rows, on units as well as values (the drain pan was 60 % here and
 * 25 mm there), and this one named a `subcoolingTrend` signal that no part
 * measures. Nothing evaluated against this table — every alert, evidence line,
 * checklist and post-service verification reads the catalogue — so the only
 * thing it did was render on `admin.settings` as the published rule, which
 * made the one screen an admin consults the one screen that was wrong.
 *
 * The separation this file's header argues for is against `lib/domain`, which
 * holds rules. The catalogue is simulation data, same layer as this file, so
 * a limit sitting there does not become a specification by accident. It still
 * carries `provenance: 'simulated'` and still replaces in one edit.
 */

export const SIMULATED_POLICY = {
  /**
   * D5 UR-AIR-01 requires plain-language bands; no document fixes their edges.
   * A tropical split-unit context, inclusive on both edges.
   */
  comfortEnvelope: {
    temperatureC: { min: 22, max: 26 },
    humidityPct: { min: 40, max: 65 },
  },

  /** How often a simulated unit reports. */
  reportCadenceMinutes: 5,
  /** Three missed reports. Passed to `isStale` — never read inside it. */
  freshnessWindowMinutes: 15,
  /** How long ago each reporting state last produced a real value. */
  reportingLagMinutes: { live: 5, stale: 41, offline: 4_320 },

  /** Days of daily history the generator produces. */
  historyDays: 30,
  /**
   * Every timestamp is derived in one fixed offset rather than the host's zone,
   * so "today" means the same thing in a test and on a demo laptop. Phase 1B
   * takes the zone from the property.
   */
  propertyUtcOffsetMinutes: 420,

  /** Fraction of the adjusted baseline each lever removes (D6 FR-62). */
  leverFraction: {
    eco: 0.08,
    setpointAtLeast23C: 0.06,
    schedule: 0.05,
    occupancy: 0.04,
    filterCleaning: 0.03,
  } satisfies Record<LeverKey, number>,

  /** Weekend multiplier on the baseline. A house fills up at the weekend and
   *  an office empties, which is why the two categories cannot share a curve. */
  weekendFactor: { home: 1.12, office: 0.35 },
  /** Bounds of the deterministic day-to-day variation, as a multiplier. */
  dailyVariation: { min: 0.88, max: 1.12 },
  /** Bounds of the deterministic within-day variation applied to `powerW`. */
  hourlyVariation: { min: 0.82, max: 1.18 },

  /* D6 FR-61's published counterfactual method is `BASELINE_METHOD` in
   * `fixtures.ts`, reached through `energyMethod()` and `links.method()`.
   *
   * A second copy used to sit here, and it had gone stale in every field it
   * had: id `adjusted-baseline` against the live `adjusted-baseline-v2`,
   * version `0.3.0` against `2.1`, and an href to a `#method-adjusted-baseline`
   * anchor that exists on no screen. Nothing read it, so nothing caught it —
   * the same way the signal-limit table above went wrong. One identity for
   * the method, in one place, or the version stamped on a published figure is
   * a coin toss. */

  /**
   * D6 FR-70 / FR-101 — a versioned regional factor, displayed with its source
   * and effective date. The value is a simulated stand-in for the published
   * Jawa–Bali figure, not a quotation of it.
   */
  gridFactor: {
    value: 0.87,
    unit: 'kgCO2e/kWh',
    source: 'Kementerian ESDM · Jawa–Bali',
    effectiveFrom: '2026-01-01',
  },

  /** D6 FR-60 — PLN R-1 order of magnitude, in IDR per kWh. */
  tariffIdrPerKWh: 1_444.7,
  /** Fixed monthly service component of the bill, IDR. */
  serviceFeeIdr: 149_000,

  /**
   * Observed value as a multiple of the part's limit, by severity. A warning
   * is a part *approaching* its limit — a trend, not a breach — which is what
   * makes the slow-signal projection meaningful rather than decorative.
   */
  observedRatio: {
    above: { normal: 0.6, warning: 0.95, critical: 1.25 },
    below: { normal: 1.6, warning: 1.05, critical: 0.75 },
  },

  /** D6 FR-20 slow signals — how far out the projection sits, and how wide the
   *  confidence band is around it. A date without a band reads as a promise. */
  projection: { horizonDays: 34, bandDays: 11 },

  /** How long a condition has been running when the demo opens, by signal
   *  class. Evidence carries `since`; the UI renders the duration against now
   *  rather than storing a stale "for 3 days". */
  alertAgeDays: { acute: 2, slow: 26 },

  /** D7 §14.5 — the tamper evidence. Device trust is not one of the twelve
   *  parts, so its signal is not in the part limit table. */
  tamperEvidence: {
    signalKey: 'signal.enclosureOpen',
    observed: 1,
    threshold: 0,
    unit: 'events/d',
  },

  /** What a unit draws while it is off. A genuine zero would be wrong here and
   *  a null would be worse: the meter is reporting, the unit is simply idle. */
  standbyPowerW: 2,

  /** D6 FR-21 — 0–1, rendered as a percentage from the locale. */
  alertConfidence: {
    acuteCritical: 0.92,
    acuteWarning: 0.74,
    slowWarning: 0.66,
    tamper: 0.88,
    dataQuality: 0.99,
    payment: 1,
  },

  /**
   * D6 FR-32 / D2 O-WO.4 — how long after a technician reports the work
   * complete the post-service check re-reads the signal. Long enough for a
   * repaired unit to settle, short enough that a failed repair is caught while
   * the technician is still near the site. No document fixes it.
   */
  postServiceWindowHours: 24,

  /** Time to attend, by priority. An SLA clock the documents do not set; kept
   *  here so a contracted one replaces it in a single edit. */
  workOrderSlaHours: { urgent: 4, high: 24, routine: 168 },

  /**
   * D6 FR-40 / D7 §13.1 — how long a command takes to walk the pipeline.
   *
   * A real device acknowledges in about a second and is verified on its next
   * telemetry frame. These are a demo's pace: long enough that a stakeholder
   * sees Sent → Acknowledged → Verified happen rather than a control that
   * appears to flip, short enough that nobody waits. No document fixes them.
   */
  commandTimings: {
    acknowledgedAfterMs: 1_800,
    verifiedAfterMs: 5_400,
  },

  /** ADR-0015 — how long a pending restriction request stays actionable
   *  before it lapses. A queue with no expiry is a backlog. */
  restrictionRequestExpiryHours: 72,

  /** D6 §10 — the grace period attached to each rung of the ladder, in days. */
  restrictionGraceDays: {
    reminder: 7,
    setpointRaised: 5,
    ecoLockLimitedHours: 3,
    stop: 2,
  },

  /** D6 FR-71 — below this, a derived package is provisional rather than
   *  estimated. This one IS from the documents; it is here so the derivation
   *  reads in one place. */
  mrvCompletenessFloor: 0.9,
} as const;

export type SimulatedPolicy = typeof SIMULATED_POLICY;
