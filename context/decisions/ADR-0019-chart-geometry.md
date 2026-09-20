# ADR-0019 · A chart is a band, and its scale is drawn

**Status** Accepted · 2026-09-20 · **Reverse cost** one stylesheet, one token
value and the dash table — low, and the self-test holds either way

## Context

`admin.energy-portfolio` was the worst-looking screen in the product, and a
reviewer said so. Three things were wrong and all three were geometry.

**The plot had no ceiling.** `.plot` was an aspect-ratio box at 10 / 3 with no
maximum. That ratio is correct at the phone frame, where it stops the chart
squashing. On a wide monitor it is a half-page-tall plot — and because the two
sites' savings are similar and small against a zero floor, the series occupied
its top quarter. The rest was a hole, which is what made the screen read as
unfinished.

**There was no scale.** One number floated above the plot and a unit floated
opposite it. A reader could not tell whether a flat line was high or low, so
the space under it read as emptiness rather than as headroom.

**`preserveAspectRatio="xMidYMid meet"` letterboxed.** Once a ceiling existed
the box no longer matched the viewBox ratio, so the drawing was scaled to fit
and centred — leaving the plot narrower than its panel, and any axis labels
describing a region the series were not drawn in.

## Decision

- The ratio governs the small end; a **ceiling governs the large one**. The
  plot is a band across the dashboard.
- **Three labelled ticks and three gridlines.** The empty half now reads as
  scale. The ticks live outside the SVG and the gridlines inside it, so they
  only agree if the drawing fills its box exactly — which forces the next
  point rather than leaving it to drift.
- **`preserveAspectRatio="none"`.** The plot fills its panel, the chart uses
  the width it was given, and a tick and its gridline mean the same height.
- The chart sits in a **panel** with padding and a border. It was drawn
  straight onto the canvas.

Filling a non-matching box means the stroke would render one width
horizontally and another vertically, so the series stroke is
`non-scaling-stroke`. Two consequences follow, and both are unit changes
rather than design changes:

- `--chart-stroke-width` is now read in **pixels** (2), not viewBox units.
- ADR-0011's **dash patterns are now in pixels**. Every pattern keeps the
  relative shape the ADR measured as the second channel; only the unit moved.
  A dash table left in viewBox units renders as a near-solid line, which
  silently deletes that channel.

## Consequences

- ADR-0011 is unaffected in substance: the six colours, their ΔE separations
  and the colour-plus-dash-plus-marker binding are unchanged. The contrast
  gate still measures all 42 pairings.
- The end marker is smaller, because a marker sized for a tall plot reads as a
  blob on a wide band.
- Anything else drawing into this viewBox must fill its box the same way, or
  its labels will drift from its gridlines. `TrendChart` already does.
