# ADR-0011 · Categorical chart ramp: six ordered series, and colour is never the only channel

**Status** Accepted · 2026-09-19 · **Reverse cost** six tokens + a re-run of the contrast gate

## Context

D7 §20 records the categorical ramp as an open gap: _"`chart/1..6`, tuned for
adjacent-colour discrimination and checked for deuteranopia"_. It blocks
`admin.energy-portfolio`, which currently wraps its chart in a `MockBoundary`
reading "A categorical chart ramp is not in this prototype."

The Figma wireframes already draw the precedent. `wireframe-customer-energy-1440`
has a **Consumption by Unit** card whose legend is `● AC 1 ● AC 2 ● AC 3` — in
blue, green and red. Three series is what the design actually needs; six is the
headroom D7 asked for, and the ceiling.

That drawn legend is also the thing this ADR exists to prevent. A **green** dot
and a **red** dot, in a product whose entire alerting mechanic is a green/amber/
red/grey severity ramp, means "AC 2 is healthy and AC 3 is critical". It is a
bare coloured dot besides, which the severity rule forbids outright.

## Decision

Six tokens, `--color-chart-1` … `--color-chart-6`, **ordered by discriminability**.

| Token   | Hex       | Name    | page    | raised  | sunken |
| ------- | --------- | ------- | ------- | ------- | ------ |
| chart-1 | `#0168B2` | azure   | 5.79:1  | 5.31:1  | 4.39:1 |
| chart-2 | `#4F331A` | brown   | 11.53:1 | 10.58:1 | 8.74:1 |
| chart-3 | `#D72175` | magenta | 4.81:1  | 4.41:1  | 3.65:1 |
| chart-4 | `#A745E2` | violet  | 4.57:1  | 4.19:1  | 3.46:1 |
| chart-5 | `#2F2A9E` | indigo  | 10.79:1 | 9.90:1  | 8.18:1 |
| chart-6 | `#752766` | plum    | 9.38:1  | 8.61:1  | 7.11:1 |

A series stroke is a non-text interface element, so the bar is 3:1 against all
three light surfaces. The tightest value in the set is chart-4 at **3.46:1** on
sunken. They are not measured against the ADR-0005 hero: no chart sits there.

## The hue space is not free, and that is the whole design

Two families have already spoken for most of the colour wheel. Measured Lab hue
angles: severity critical **h33**, warning **h63–75**, normal **h152**; the eco
channel **h213**. The design system's own rule is unambiguous — _"Severity
colours are not series colours. A green line reads as healthy, not as series 2."_

So the ramp contains **no green, no orange, no red-red and no teal**, and this
was tested rather than assumed:

- A teal series at `#1A7F8E` measures **ΔE 2.1** from `state-eco`. Unusable.
- Every olive tried in the yellow-green gap measured **ΔE 12.8–17.6** from
  `severity-warning-text` on one side while drifting toward `severity-normal` on
  the other. The band is boxed in; there is no safe olive. Dropped.
- A dark **brown** at `#4F331A` clears the nearest severity colour by **18.5 ΔE**
  and is the only warm the set could legally keep. It earns its slot twice over —
  see below.

What is left is one brown plus a cool sweep from azure through indigo, violet and
magenta to plum. Minimum clearance from the four severity **marks** in typical
colour vision is **14.4 ΔE** (chart-1 vs the grey unknown mark, separated by
chroma: C\*45 against C\*16); from the hue-loaded three it is **19.8 ΔE**
(chart-3 vs critical).

## Deuteranopia: what was checked, and what it proved

Every candidate was projected through the **Viénot, Brettel & Mollon (1999)**
dichromat transform and compared in **CIEDE2000**, for deuteranopia and
protanopia, against a 5,698-colour pool generated in LCh and filtered to the
3:1 luminance ceiling.

The result is worth stating plainly, because it changes the shape of the answer:

> **Six categorical colours cannot be made mutually discriminable for a
> deuteranope inside this product's constraints.** The 3:1-on-sunken rule caps
> every series at L\* ≤ 52, and the severity and eco reservations cap the usable
> hue span at roughly 90°. A free search over the whole legal pool tops out
> around 16 ΔE, and only with colours too desaturated to read as a deliberate
> palette.

Measured on the adopted ramp:

| Comparison                          | Minimum ΔE | Pair            |
| ----------------------------------- | ---------- | --------------- |
| all six, typical colour vision      | **19.2**   | chart-5/chart-6 |
| all six, deuteranope                | 10.2       | chart-1/chart-4 |
| **chart-1..3 only, typical vision** | **37.8**   | chart-1/chart-3 |
| **chart-1..3 only, deuteranope**    | **25.4**   | chart-2/chart-3 |
| chart-1..3 only, protanope          | 12.3       | chart-1/chart-3 |

The brown is why the first three survive dichromacy: it is the only colour in
the ramp that projects onto the yellow side of the dichromat axis (`#4F331A` →
`#3D3D18` under deuteranopia) while the other five collapse to blue-greys.

## Therefore: the ramp is ordered, and colour is never the only channel

1. **Use 1-2-3 first.** Those three are the only set the ramp guarantees on
   colour alone, and they are exactly the three the Figma legend draws. The
   guarantee weakens at 4, 5 and 6, and the tokens are ordered to say so.
2. **The chart wrapper binds index N to colour N _and_ a dash pattern _and_ a
   point marker.** This is not a new rule. The design system already dashes the
   baseline "because line style survives colour blindness and greyscale
   printing, and the 10–20 % savings comparison is the product's headline claim,
   so it must not depend on hue." The same sentence applies to a sixth property.
3. **The legend carries the series label**, as the wireframe already does. A
   swatch with no word beside it is the bare-dot failure in another costume.

Saturation in chart-3 and chart-4 is a consequence, not a style choice: toning
them toward the house navy was tried and collapsed chart-3/chart-6 to 7.9 ΔE.

## Enforcement

`tools/verify-contrast.mjs` now measures the ramp rather than trusting this
table. It gained CIEDE2000 and the deuteranope projection, and asserts three
floors set just under the measured values:

| Floor                            | Value | Measured |
| -------------------------------- | ----- | -------- |
| series vs series, typical vision | 18    | 19.2     |
| chart-1..3, deuteranope          | 22    | 25.4     |
| series vs any severity mark      | 13    | 14.4     |

Re-tuning one hex to taste now fails the gate instead of quietly merging two
properties into one colour, or turning a property green.

## Consequences

- D7 §20's categorical-ramp gap is closed for **three** guaranteed series and
  **six** available ones. `admin.energy-portfolio` can drop its chart
  `MockBoundary` once a wrapper wires the tokens in — that is a separate pass.
- `design/figma-tokens.json` gains `color/chart/1..6`, grouped so the order is
  visible in the Figma picker, with the dash-and-marker rule in the group
  `$description`.
- **Do not add a seventh.** If a screen needs seven categories it needs a
  different chart — small multiples, or a "top 6 and the rest" roll-up.

## Reversing

Replace six lines in `tokens.css`, run `npm run verify:contrast` and
`npm run figma:tokens`. The gate will tell you immediately if the replacement
collides with a severity.
