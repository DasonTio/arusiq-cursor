# ADR-0020 · Provenance is disclosed once, not beside every figure

**Status** Accepted · 2026-09-20 · **Decided by** the project owner ·
**Reverse cost** two lines — see below

## Context

`INV-PROVENANCE` (source D8) requires every figure to carry Simulated |
Estimated | Provisional | Verified **next to the figure itself, never in a
page-level disclaimer**, and `INV-MOCK-LABEL` (D7) requires the prototype to
label itself. Both were implemented and both are gated.

The cost is real and was raised as a design objection: `client.energy` renders
**eighteen** provenance marks, `client.overview` thirteen, `admin.overview`
ten. On the Insights screen the word "SIMULATED" appears roughly twenty times.
No dashboard worth benchmarking against repeats a badge twenty times, and the
repetition was a material part of why the product read as unfinished.

The owner's decision, with their reasoning: **the prototype is disclosed
verbally at the presentation, so repeating it beside every figure is
redundant.**

This was not taken silently. The alternatives — quieting the mark to a dot, or
showing it once per card where provenance is uniform — were offered with the
consequences of each, and this option was chosen over both.

## Decision

Suppress the **display**. Keep the **guarantee**.

- `ProvenanceChip` returns `null` behind a single `RENDER_PROVENANCE` flag.
- `MockBoundary` renders its children without the banner, behind
  `RENDER_BANNER`.
- Four control labels that carried the word as a stamp are reworded: "Confirm
  simulated payment" → "Confirm payment", and the same for the assignment,
  request-submit and request-submitted strings, in both locales.

Nothing else moves. Every call site, every `provenance` prop, the locale keys
and the whole domain model are untouched. Consequently:

- `verify-provenance` still fails a metric component that declares no
  provenance — the gate is green because the data is still there, not because
  the rule was removed.
- `INV-AGGREGATE` still computes the weakest provenance of an aggregate, and
  that is now asserted directly in `ProvenanceChip.test.tsx` rather than
  inferred from a rendered chip.
- **Restoring every label is flipping two booleans.**

## Consequences

- `INV-PROVENANCE` and `INV-MOCK-LABEL` are **suppressed in the UI**. They are
  not satisfied by the running product; they are satisfied by the presenter.
  That is a verbal control, and verbal controls do not survive a screenshot.
- Three `MockBoundary` explanations carried FUNCTIONAL information rather than
  a provenance stamp, and are now invisible: "a geographic map is not drawn"
  (`tech.map`), "nothing was sent to WhatsApp or email" (`client.alerts`),
  "no money moves" (`client.billing`). The copy still exists in the locale
  packs. If an absent feature starts looking like a defect, re-surface these
  as ordinary inline text rather than reinstating the banner.
- **Before anything is published, exported or screenshotted outside the
  presentation, this decision should be reversed.** A carbon figure shown
  without provenance is the claim the provenance system exists to prevent, and
  the reversal is deliberately trivial so that there is no excuse not to.
- `INV-NO-FABRICATION` is untouched and still enforced. Nothing here invents a
  value; it hides where a real value came from.
