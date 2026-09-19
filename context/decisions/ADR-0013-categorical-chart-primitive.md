# ADR-0013 · The categorical chart primitive: six slots, three channels, and a textual account that cannot be empty

**Status** Accepted · 2026-09-19 · **Reverse cost** one pattern file, one token,
one prop interface — low while `admin.energy-portfolio` is still a `MockBoundary`

## Context

ADR-0011 closed the ramp and left the mechanism open. Its own conclusion was
that the tokens are not safe on their own:

> Six categorical colours cannot be made mutually discriminable for a
> deuteranope inside this product's constraints. … The chart wrapper binds
> series index N to colour N **and** a dash pattern **and** a point marker.

No such wrapper existed. `--color-chart-1 … -6` were reachable from any
stylesheet, and the first screen to reach for them would have drawn six lines
separated by hue alone — exactly the failure the ADR measured and named. A token
that has to be used correctly is a documentation problem; a primitive that binds
the three channels together is a design-system one.

`contracts.ts` also carried two never-implemented chart interfaces.
`SavingsChartProps` is the single-property actual-vs-baseline case (D6 FR-61)
and is the wrong shape here: comparing a property to its own baseline is one
line plus a grey dashed reference, while comparing six peers needs the ordered
ramp, a mandatory legend and a cap.

## Decision

`src/patterns/CategoricalChart.tsx`, against a new `CategoricalChartProps` in
`src/components/contracts.ts`, plus one new token.

### 1. The six-slot cap is a type, not a comment

```ts
export type CategoricalSeriesSet =
  | readonly [ChartSeries]
  | … up to …
  | readonly [ChartSeries × 6];
```

A seventh series does not compile. The runtime guard behind it — `"7 series —
the categorical ramp has six colours (ADR-0011)"` — exists for the cast someone
writes to get past the compiler, and follows the same convention as
`partDefinition()`'s "not one of the twelve" and `PartIcon`'s unknown-part throw.
Both matter: without the cap, a seventh series wraps round to `chart-1` and two
properties silently become one identity, which is the whole separation ADR-0011
measured. `asChartSeries(list)` narrows a runtime array and returns `null` rather
than truncating — what to do with a seventh property (small multiples, or
"top 6 and the rest") is a screen decision, and dropping it silently is the one
answer that is always wrong.

### 2. Colour and dash are declared in one place, and neither is a prop

`.s1 … .s6` in `CategoricalChart.module.css` each set **both** `--series-color`
and `--series-dash`. The line, the end marker and the legend swatch all read
that pair. There is no `color` prop and no `dash` prop, so a caller cannot take
one channel without the other, and a legend swatch cannot disagree with the line
it stands for.

| Slot | Token     | Dash (user units)         | Reads as     |
| ---- | --------- | ------------------------- | ------------ |
| 1    | `chart-1` | `none`                    | solid        |
| 2    | `chart-2` | `3 1.6`                   | dashed       |
| 3    | `chart-3` | `0.01 1.6`                | dotted       |
| 4    | `chart-4` | `3 1.3 0.01 1.3`          | dash-dot     |
| 5    | `chart-5` | `6 1.8`                   | long dash    |
| 6    | `chart-6` | `3 1.1 0.01 1.1 0.01 1.1` | dash-dot-dot |

A zero-length dash under `stroke-linecap: round` renders as a round dot, so the
dotted patterns keep the same weight as the solid one instead of thinning. The
gaps are tuned against the stroke: at 1.6 units a gap reads as a gap at stroke
0.6 and as a smudge at 1.2 — which is the argument for the token below.

The third channel is a filled marker at each series' last plotted point, drawn
per series rather than per chart.

### 3. One new token: `--chart-stroke-width: 0.6`

**User units in the shared 100 × 30 plot viewBox, not pixels.** It already
existed as a literal `0.6` in `Energy.module.css`'s `.chartActual` and
`.chartBaseline`; a second copy in the categorical chart is how the savings
chart and the portfolio chart come to look like two products. The dash table
above is calibrated against it, which is the reason it is a token and not a
number in one stylesheet. It is not exposed as a prop, for the same reason
`--icon-stroke-width` is not (ADR-0006, ADR-0012).

`tools/export-figma-tokens.mjs` exports it as a **number**, not a dimension: a
designer who reads "0.6" as pixels draws a hairline and has drawn the wrong
chart, so the `$description` says so at the point of use.

### 4. The legend is mandatory and carries free text

`ChartSeries.name` is a `string`, not an `I18nKey`. "AC 1", "Menara Selatan" and
"Gudang" are proper nouns arriving with the data — the documented exception
already used by `PriorityItem.title` and `PageHeader.title`. Everything the
chart says for **itself** is still a key (`chart.legend`, `chart.dataTable`,
`chart.time`, `chart.method`).

### 5. `textAlternative` is a union, because `ReactNode` includes `null`

`ChartCardProps.textAlternative: ReactNode` is required in the type and
satisfiable with `null`. That is a required prop with extra steps. Here:

```ts
type CategoricalTextAlternative =
  | { kind: 'table' } // the chart builds it
  | { kind: 'summary'; summary: string }; // non-blank, or it throws
```

Under `kind: 'table'` the primitive renders the table itself, from the same
numbers it drew, locale-formatted, inside a disclosure with a 44 px hit area —
so the table cannot drift from the plot. A blank summary throws rather than
rendering a chart with no account of what the lines say. The legend names the
series; it does not say what they **did**, and D7 §12.2 asks for both.

### 6. Missing is not zero, in a line chart too

A `null` reading **breaks the line**. A segment drawn across an unreported day
asserts a reading nobody took, which is non-negotiable #4 in the shape a chart
library would silently get wrong. A lone reading between two gaps is drawn as a
point, and a series with nothing to plot appears in the legend with "No data"
and its last-seen time rather than flat-lining at zero.

## What this does to ADR-0007

ADR-0007 decided **Recharts behind mandatory wrappers**. The wrapper boundary
stands and this file sits inside it, in `src/patterns/`, where the ESLint
`no-restricted-imports` exemption lives. What changed is the engine: `recharts`
is still not a dependency of this project, three charts already exist as inline
SVG on a `viewBox="0 0 100 30"`, and adding a charting library to draw six
polylines is weight this sprint does not need to carry.

So ADR-0007 is **narrowed, not reversed**: the rules it listed are hard-coded
here exactly as it specified them (dashed reference lines, required text
alternative, accessible name that says what it shows, aspect-ratio box, no
entrance animation, caption-size axis labels in gray-2, 44 px targets). If
Phase 1B wants Recharts, it rewrites the inside of this file and no screen
changes — which was ADR-0007's own reason for insisting on wrappers.

## Enforcement

- `CategoricalChart` is now in the metric-component list in **both** provenance
  gates (`tools/verify-provenance.mjs` and `eslint-rules/index.js`), so a call
  site without a `provenance` prop fails the build and shows a red squiggle
  while it is being typed.
- `src/patterns/CategoricalChart.test.tsx` asserts the colour/dash binding
  against the **stylesheet itself**, not the DOM: six slots, six distinct dash
  patterns, each bound to its own `--color-chart-N`, and one place consuming
  both. A slot that loses its dash fails the test, because no DOM query can see
  it and no code review reliably does.

## Consequences

- `admin.energy-portfolio` can drop its chart `MockBoundary`. Wiring it is a
  separate pass and is deliberately not done here.
- `client.energy`'s `Sparkline` and `shared.unit`'s inline energy SVG are now
  the odd ones out: bespoke, feature-local, outside the wrapper. Folding them
  into a `SavingsChart` built on this file's plot geometry is the obvious next
  piece of work, and the reason the stroke width became a token today.
- Seven series remains impossible on purpose. Revisiting that means revisiting
  ADR-0011's measurements first, not adding `--color-chart-7`.

## Reversing

Delete the pattern, its stylesheet and its test; remove `CategoricalChartProps`,
`ChartSeries`, `CategoricalSeriesSet` and `CategoricalTextAlternative` from
`contracts.ts`; remove `--chart-stroke-width` and re-run `npm run figma:tokens`.
Nothing else imports them until a screen does.
