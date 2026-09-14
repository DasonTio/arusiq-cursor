# ADR-0007 · Charts: Recharts behind mandatory wrappers

**Status** Accepted · 2026-09-14 · **Reverse cost** high after several charts exist

## Context

D7 §12 opens with the reason this needs deciding up front: *"Charts are where a
design system leaks most, because chart libraries ship their own defaults."*
Those defaults are actively wrong here — a chart library will happily give you a
green series, a 12 px grey axis label, an entrance animation and a fixed pixel
width, and every one of those breaks a stated rule.

## Decision

**Recharts**, and no feature file imports it directly. All charts go through
wrappers in `src/patterns/` that hard-code the D7 §12 rules.

## Why Recharts

Declarative, composable React components — the shape agents write correctly
most often. The alternative worth taking seriously was **visx**, which gives
exact control and no defaults to fight; it loses on volume, because every chart
becomes bespoke D3 code and this is a ten-working-day sprint. ECharts was
rejected on its imperative config-object API, which agents copy-paste badly, and
on bundle weight.

The wrapper strategy makes the choice mostly reversible anyway: swapping the
rendering library means rewriting the wrappers, not the screens.

## What the wrapper hard-codes

The point is that these cannot be got wrong, because a feature agent never
touches them:

- **Baseline vs actual** — `brand-primary` solid for actual, `gray-4` **dashed**
  for the baseline. The dash is not decoration: line style survives colour
  blindness and greyscale printing, and the 10–20 % savings comparison is the
  product's headline claim, so it must not depend on hue (D7 §12.1).
- **Severity colours are not series colours.** The wrapper does not expose them
  as a series option. A green line reads as "healthy", not as "series 2".
- **`textAlternative` is a required prop.** No chart renders without a table,
  summary sentence or data-view toggle (D7 §12.2).
- **Accessible name describes what it shows, not its type.**
- **Aspect-ratio container**, never a fixed height, so it scales from 375 px
  without a layout shift on load.
- **`isAnimationActive={false}`** — no entrance animation on a live series, and
  never animate a live value (D7 §10.3, §12.2).
- **Axis and tick labels at Caption size in `gray-2`.** Recharts defaults to a
  lighter grey at 12 px, which D7 §12.2 calls out by name as unreadable and "the
  default most chart libraries ship".
- **44 × 44 hit areas** on interactive points even when the rendered dot is 8 px.
- **The savings chart requires a link to its method.** D6 FR-61 — the method is
  what separates a claim from a measurement, so the wrapper takes it as a
  required prop rather than trusting each screen to remember.

## Consequences

- `recharts` may be imported in `src/patterns/` only. Worth an ESLint
  `no-restricted-imports` rule once the wrappers exist.
- The **categorical ramp remains open** (D7 §20 gap #1). The palette currently
  supports three distinguishable series; `admin.energy-portfolio` needs six,
  tuned for adjacent-colour discrimination and checked for deuteranopia. Sequence
  that screen late.
