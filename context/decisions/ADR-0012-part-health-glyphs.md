# ADR-0012 · Part-health glyphs: twelve drawn, schematic, token-stroked

**Status** Accepted · 2026-09-19 · **Reverse cost** low — one component and its test

## Context

D7 §20's part-level health gap is the one ADR-0006 explicitly could not close:

> "Part-level health diagram glyphs for the twelve monitored components remain
> open — Lucide has no compressor or evaporator-coil icon. That is a separate,
> scoped piece of illustration work."

It blocks the Health view of `shared.unit`, which today renders all twelve parts
as a flat text list: `<p>{t(part.labelKey)}</p>` and a `SeverityIndicator`, no
glyph. Twelve rows of identical shape across three groups is a list a technician
has to _read_ rather than scan, and the scan is the point — the part is the thing
being looked up, the severity is the answer.

The catalogue is fixed and enumerated (`PART_CATALOGUE`, D6 FR-20: "monitor every
aspect" is a list, not a slogan), so this is a bounded set of twelve, not an
open-ended illustration commission.

## Decision

Twelve hand-drawn glyphs in a new design-system primitive, `PartIcon`, keyed by
the **catalogue id**:

```tsx
<PartIcon part="compressor" />                    // decorative, silent
<PartIcon part="compressor" size={20} labelled /> // icon-only row
```

Drawn on Lucide's own terms so the two sets cohere in the same row: a 24 px grid,
a ~20 px live area, round caps and joins, no fill, stroke from
`--icon-stroke-width`.

| Group      | Glyphs                                                                             |
| ---------- | ---------------------------------------------------------------------------------- |
| indoor     | framed waved media · serpentine tube · caged drum · drop over a pan · slats        |
| outdoor    | framed straight fins · cylinder with discharge · 3-blade propeller · 2 flared runs |
| electrical | thermometer with scale · capacitor symbol · wire between two terminals             |

## Why schematic line art rather than illustration

A technician reads a part row at arm's length, on a phone, in a plant room. A
shaded rendering of a compressor at 20 px is a grey blob, and twelve grey blobs
are worse than twelve blank spaces because they cost attention and return
nothing. Schematic glyphs also survive the one thing illustration does not: being
set in `currentColor` beside a severity indicator without competing with it.

Two glyph pairs are the ones that actually matter, and they were drawn against
each other deliberately:

- **air-filter vs condenser-coil** — both are panels. The filter is _framed
  waved media_; the coil is _framed straight fins_. Folded against flat. Getting
  these confused crosses the indoor/outdoor boundary, which is the most expensive
  misread in the set.
- **blower-motor-fan vs condenser-fan-blades** — both are fans. The blower is a
  _caged drum_ (a wheel with vanes); the condenser fan is a _3-blade propeller_.
  Which is what they physically are.

Three first drafts were rejected on inspection rather than on principle, which is
the argument for rendering an icon set before shipping it:

- a sharp three-peak zigzag for `air-filter` read as the letters **"MM"** →
  waved;
- two horizontal runs with square unions for `refrigerant-lines` read as a row of
  **sliders**, i.e. as a settings control → redrawn on the diagonal with flare
  nuts;
- steep chevrons for `vents-louvers` read as a **scroll control** → flattened.

## Why the stroke is a token now

ADR-0006 locked Lucide at 2 px and did not expose it, because "stroke weight is
the property that makes an outline set cohere; two icons at 24 px with 1.5 px and
2 px strokes look mismatched at a glance."

There are now **two** icon sets in the product, and a restated constant is a
constant that drifts. `--icon-stroke-width` is the single value both primitives
read: `PartIcon.module.css` sets it directly, and `Icon.module.css` sets it too —
CSS beats Lucide's presentational `stroke-width` attribute, so one edit moves
both sets or neither. Neither primitive exposes a prop. This narrows ADR-0006
rather than reopening it.

## The glyphs are geometry, not markup

`partGlyphs.ts` holds each glyph as a list of shapes — `path` / `rect` /
`circle` / `ellipse` on a 24-unit grid — and `PartIcon` is the one place any of
them is painted.

The first draft was a `Record<string, ReactNode>` of JSX fragments, which works
and is wrong. A JSX fragment has room for a `fill`, a `stroke` and a colour, so
the thirteenth glyph is one careless attribute away from contradicting the
`SeverityIndicator` beside it — the one thing a part row must never do. There is
no slot for any of those in `GlyphShape`, so that failure is now unreachable
rather than merely tested for. Same move as the rest of the contracts file: the
rule lives in the type, not in a comment above the map.

It also took the glyph data out of `.tsx`, which is what it always was.

## Why the id, not a glyph name

`PartIconProps.part` is the catalogue id. A screen cannot ask for the wrong
picture for a part, because it does not get to name the picture.

An unknown id **throws**, in the wording `partDefinition()` already uses —
`Unknown part id "x" — not one of the twelve`. A part with no glyph is a wiring
mistake, not a data state, and the silent version of that mistake is a blank
column that survives review.

`PartIcon.test.tsx` binds the glyph set to the catalogue **in both directions**:
a thirteenth part added without a drawing fails the suite, and a drawing for a
part that no longer exists fails it too. It also asserts all twelve renderings
are mutually distinct (a copy-paste that leaves two parts sharing a path is
invisible in review), that the glyphs declare no colour of their own, and that
the accessible name resolves through `part.<id>` in **both** locales.

## Accessibility

Decorative by default — in a part row the name is already beside the glyph and a
second announcement is noise (ADR-0006). `labelled` is for the icon-only case and
reuses `part.<id>`; the icon never invents a string, so it cannot disagree with
the row label or stay English when the row turns Indonesian.

The glyph carries **no severity meaning**. Severity is the `SeverityIndicator`
next to it, with its mark, its shape and its label. A part icon that changed
colour or shape with condition would be a fifth severity channel nobody
specified, and a bare coloured glyph is exactly what the severity rule forbids.

## Consequences

- D7 §20's part-health gap is closed for the twelve enumerated parts. Wiring
  `PartIcon` into `HealthView`/`PartRow` is a feature-composition pass, not this
  one.
- No new i18n keys: `part.*` already exists in both locale packs.
- `design/figma-tokens.json` gains `icon/strokeWidth`, so a designer drawing a
  thirteenth part has the value at the point of use.
- If a thirteenth part is ever added to `PART_CATALOGUE`, the test fails until it
  is drawn. That is the intended cost.

## One gate was wrong, and was fixed rather than exempted

`verify-i18n`'s hardcoded-text rule reads each file whole (so it catches
Prettier-wrapped text, which a line scan misses) and treats anything between a
`>` and a `<` as a text node. Two sibling JSX **expressions** leave ordinary code
in that span, and it was reporting comments and object keys as untranslated UI
strings — in any file, not only this one.

`tools/verify-i18n.mjs` now strips comments before the scan (a comment is never
user-facing) and skips spans whose parentheses are unbalanced (prose balances
them; a slice of code between two elements does not, so `Needs cleaning (soon)`
is still caught). Both behaviours are locked in by a new case in
`tools/__fixtures__/clean/Good.tsx`, so `npm run verify:self` proves the rule
still fires on the violating fixture. No `i18n-exempt` comment was added.

## Reversing

Delete `PartIcon.{tsx,module.css,test.tsx}`, `partGlyphs.ts` and the
`PartIconProps` contract. The stroke token stays — ADR-0006 wants it either way.
