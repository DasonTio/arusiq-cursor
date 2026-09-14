# ADR-0006 · Icon set: Lucide

**Status** Accepted · 2026-09-14 · **Reverse cost** moderate — a rename pass across every icon usage

## Context

D7 §7 fully specifies the icon _frame_ — 20 px live area, 2 px safe area, 24 px
total, outline style — but D7 §20 records the actual set as **recognised gap #2**:
_"Icon library name, stroke weight and licence. Stroke weight is the property
that makes an outline set cohere; two icons at 24 px with 1.5 px and 2 px
strokes look mismatched at a glance."_ It blocks "icon set adoption; commercial
release".

This blocks more than it appears to. Severity is required to carry **colour +
shape + label** (D5 UR-MNT-01), so the severity indicator — the single most
repeated element in the product — cannot be built without an icon set. Nearly
all UI work sits behind this.

## Decision

**Lucide**, via `lucide-react`. Stroke weight locked to **2 px**, size locked to
the `iconSize` token (24 / 20 / 16).

## Why

1. **The frame already matches.** Lucide draws on a 24 px grid with a 2 px
   stroke and roughly a 20 px live area — D7 §7's specification, with no
   rescaling. Rescaling an icon set is how stroke weights drift apart.
2. **Licence.** ISC — permissive, commercial-safe, no attribution burden. D7
   names licence explicitly because this gap blocks _commercial release_.
3. **Coverage.** ~1,500 icons. The product needs glyphs for twelve HVAC part
   groups, four severities, tamper, four delivery channels, four restriction
   steps and four provenance labels. Smaller sets (Heroicons, ~300) run out.
4. **Tree-shakeable per-icon imports**, so breadth costs no bundle size.

## Constraints this decision does not remove

- **Stroke weight is locked at 2.** Lucide accepts a `strokeWidth` prop; varying
  it per icon reintroduces exactly the incoherence D7 warns about. The icon
  primitive sets it and does not expose it.
- **Decorative icons are hidden from assistive technology** and carry no
  accessible name; the adjacent label already carries the meaning. Icon-only
  controls carry a real label and a 44 × 44 target even when the glyph is 24 px
  (D7 §7.1).
- **Severity icons are required, not optional**, and their shapes are fixed by
  `SEVERITY` in `src/lib/domain/severity.ts`: square / triangle / circle /
  dashed ring. The icon set supplies the glyph; it does not get to choose the
  shape.
- **Mirror direction-indicating icons under RTL** — chevrons, arrows, progress.
  Do not mirror icons depicting objects (D7 §19.2).

## Consequences

- D7 §20 gap #2 is closed: library **Lucide**, stroke **2 px**, licence **ISC**.
- `public/icons.svg` (Vite starter: Bluesky, Discord, GitHub, X) is deleted.
- Part-level health diagram glyphs for the twelve monitored components remain
  open under D7 §20 gap #4 — Lucide has no compressor or evaporator-coil icon.
  That is a separate, scoped piece of illustration work.
