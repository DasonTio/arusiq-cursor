# Design system — working rules

Distilled from **D7 UI Design Guideline R2** into decisions you can act on.
Values live in `src/design-system/tokens.css`; this file is the *judgement*
around them.

> **Why this file exists.** AI-generated UI is mediocre by default because it
> optimises for plausible — generic cards, arbitrary spacing, a gradient. The
> fix is not "try harder", it is **removing degrees of freedom**. If the only
> reachable colours are named tokens and the only reachable gaps are eleven
> levels, slop is unreachable. What is left — composition, hierarchy, what to
> put on the screen at all — is where agents are actually good.

## Before you write a component

1. Does it exist in `src/components/`? Reuse beats consistency-by-discipline.
2. Which of the 14 product patterns is it? (severity indicator, KPI tile,
   provenance chip, unit card, alert with evidence, command control, restriction
   banner, delivery status, savings chart, carbon card, air-quality card,
   part-health diagram, work-order checklist, asset breadcrumb)
3. What are its `loading` / `empty` / `error` / `noData` states? Decide now.
   Retrofitting them means rewriting the component.

## Colour

Three families. **They do not borrow from each other.**

- **Brand** — identity and actions. `brand-primary` navy for the one primary
  action per area; `brand-red` for secondary actions. Brand red is *not* a
  problem signal, and the similar hue is intentional: users separate them by
  context — an action label in an action area versus a status word with an icon
  beside the thing it describes.
- **State** — form and interface feedback. Fills **never carry text**; where a
  state colour becomes type, use the `-text` variant. `state-eco` is the
  sustainability channel (savings, avoided emissions, Eco mode) and **never
  indicates severity**.
- **Severity** — the four alert levels. Its own ramp, deliberately separate from
  state (see `decisions/ADR-0002`).

The default severity treatment is a **10 % tint + text-safe foreground +
hairline mark border**. There is no solid-filled severity badge — no single
foreground clears 4.5:1 across all four marks, and the tinted form reads calmer
in a dense dashboard anyway.

**Severity colours are not series colours.** A green line reads as *healthy*,
not as *series 2*. Charts: `brand-primary` for a single series; `brand-primary`
solid vs `gray-4` **dashed** for actual-vs-baseline; `state-eco` for savings and
carbon. The baseline is dashed as well as grey, because line style survives
colour blindness and greyscale printing — and the 10–20 % savings comparison is
the product's headline claim, so it must not depend on hue.

Four legal surfaces: `page` (white-1), `raised` (white-2), `sunken` (gray-5),
and `{state|severity} at 10 %`. Every foreground clears its bar against **all
four** — `npm run verify:contrast` proves it.

## Typography

Plus Jakarta Sans for headings, Inter for body. Headings are `1.1 ×` line
height; body is `1.4 ×`.

**Heading level and heading size are independent.** Pick the level from the
content structure (one `h1`, no skipped levels); pick the size from the
responsive ramp:

| Role | 375 | 768 | 1024+ |
| --- | --- | --- | --- |
| Auth / marketing h1 | 32 | 48 | 56 |
| Dashboard page title | 24 | 32 | 32 |
| Section heading | 20 | 20 | 24 |
| Card title | 18 | 18 | 20 |
| Metric value | 32 | 40 | 40 |
| Body / meta / caption | 16 / 14 / 12 | — | — |

**H1 and H2 never appear unprefixed.** At 375 px the content column is 343 px;
"Energy portfolio" at 48 px measures ~446 px and blows straight through it.

Tabular figures are set once, globally, on `body`. Never per component.
Caption (12 px) is for chart ticks and table metadata only, never below gray-2.

## Spacing and layout

Eleven levels: **4 · 8 · 16 · 24 · 32 · 40 · 56 · 72 · 80 · 96 · 120**.
48, 64 and 88 are deliberately absent so the scale stays coarse enough to
decide quickly. Use `gap` on flex/grid parents, not margins on children, and use
logical properties throughout.

The one exemption: **Textfield and Expressive Button padding derive from font
size in `em`** and may land outside the scale. That is correct, and it is not a
general licence for arbitrary spacing.

Grid: margins and gutters fixed, columns flex. Content caps at 1360 px and
centres above 1440. **Recompose, don't shrink** — what sits side by side on
desktop stacks on mobile. No fixed pixel widths; layout survives 200 % zoom.

Navigation shell, same model for all roles: bottom tabs at 375 (max five),
icon rail at 768, persistent sidebar + breadcrumbs at 1024+.

## The six quiet tiers

- **Radius** — a child's radius is the parent's minus the gap between them. A
  12 px card with 8 px padding takes a 4 px child. Concentric equal radii read
  as a mistake even when nobody can say why.
- **Elevation** — three levels, and **a shadow is never the only boundary**.
  Shadow contrast against white is far below 3:1 and it vanishes in bright
  ambient light on a cheap panel, which is exactly this product's mobile
  context. Cards carry a `gray-5` border *and* a shadow.
- **Motion** — transform and opacity only; nothing over 320 ms; reduced-motion
  honoured globally in the base layer. **Never animate a live value** — a
  telemetry number that morphs between readings is harder to read than one that
  swaps. Transition the container on arrival; leave the digits alone.
- **Layering** — six named steps and nothing outside them. A raw `z-index` is a
  defect: the number that beat everything else is the number the next person has
  to beat.
- **Focus** — a two-tone ring at 2 px offset, on every interactive element,
  never removed without replacement. A single-tone ring on a primary fill
  measures 1.67:1 and is invisible.
- **Target** — 44 × 44 px minimum. It is a requirement, not a size category.
  Compact controls keep their 32 px look and **pad the hit area**, not the glyph.

## Provenance and measured values

The provenance label sits **with the figure**, so a screenshot of a single tile
carries its own provenance. It is **typographic, not chromatic** — a small
bordered label in gray-2. Colour is fully committed to severity and is not
available to borrow.

KPI tile anatomy is fixed: label (14 px, gray-2, sentence case) · value (metric
ramp, tabular) · unit (≈ half the value size, same colour, **never on its own
line**) · provenance (**required**) · optional trend.

Lead with big-number tiles only where those figures are the point of the screen.
A dashboard where everything is a KPI tile has no hierarchy.

Charts: an accessible name describing **what it shows, not its type**; a text
alternative (table, summary sentence, or a data-view toggle); 44 × 44 hit areas
on interactive points even when the dot is 8 px; an aspect-ratio wrapper rather
than a fixed height; **no entrance animation on a live series**.

## Language

Design for the longer string. Indonesian runs **20–30 % longer** than English —
"Needs cleaning" becomes "Perlu dibersihkan". Never size a control to its
English label, and review every component in both locales. Logical properties
everywhere, so adding Arabic is a `dir` attribute and not a rewrite. Mirror
direction-indicating icons under RTL; do not mirror icons depicting objects.

Numbers, currency, dates and temperature come from the locale. Indonesian
renders `Rp 1.444,70` — separators inverted from the English default.

## Screen review checklist

Run this before calling a screen done. `npm run verify` covers the mechanical
half; these are the ones only a person or a reviewing agent can judge.

- [ ] Every severity carries colour **and** shape **and** label
- [ ] Every figure carries a provenance label; stale values are grey with a last-seen time
- [ ] Headings use the responsive ramp; no unprefixed H1/H2; no skipped levels
- [ ] Every interactive element has a visible focus state and a 44 × 44 target
- [ ] Every input has a real label; helper text is distinct from error text
- [ ] Every chart has a text alternative and caption-size axis labels in gray-2
- [ ] Renders at 375 px, at 1536 px, and at 200 % zoom without horizontal scroll
- [ ] Renders correctly in **both** English and Bahasa Indonesia
- [ ] No screen is a dead end — every alert leads to an action
- [ ] One primary action per area
- [ ] Mocks are visibly labelled as mocks

## Recognised gaps

Scheduled, not open-ended. Each blocks a specific piece of work — if your task
is one of these, resolve it in an ADR first rather than inventing values:

1. **Categorical chart ramp** (`chart/1..6`, tuned for adjacent-colour
   discrimination and checked for deuteranopia) — blocks the Admin energy
   portfolio. The palette currently supports three distinguishable series.
2. **Icon library, stroke weight and licence** — blocks icon-set adoption.
   Stroke weight is what makes an outline set cohere.
3. **Map treatment** — style, markers, clustering, routes. Blocks the Admin
   fleet map and technician routing.
4. **Part-level health diagram** for the twelve components — blocks the
   Technician dashboard.
5. **Dark hero surface** — the client overview opens on a dark hero, but Phase 1
   is otherwise light-only, so it needs its own contrast matrix.
