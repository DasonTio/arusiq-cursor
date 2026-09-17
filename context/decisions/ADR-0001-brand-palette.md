# ADR-0001 · Brand palette: logo values are canonical

**Status** Accepted · 2026-09-13 · **Reverse cost** one line in `tokens.css`

> **Under review — OD-03, with evidence.** The Figma file's bound colour
> variables, which are also what it paints, are primary `#0B1B48`, secondary
> `#2B407A` and red `#DB1217`. The logo navy matches `#0B1B48`. Neither of this
> ADR's values (`#1B2F6E`, `#D62027`) appears anywhere in the file, so the D8
> F-06 claim this ADR rests on is not supported by the design artefacts. The
> _principle_ (the logo is canonical) stands and points at `#0B1B48`. Awaiting a
> stakeholder decision; do not build brand-coloured components until OD-03 closes.

## Conflict

D7 §2 specifies the brand palette as **#022465** (Primary) and **#DB1217**
(Secondary2 / brand red), with a full contrast table built on those values.

D8 Conformance Review finding **F-06** reports the same conflict and resolves it
the other way:

> "Two brand palettes were in play. D7 specified #022465 / #DB1217; the logo,
> the build brief and the already-built prototype use #1B2F6E / #D62027. Three
> artefacts would have shipped in two identities. → **logo values are canonical**"

D7 R2 and D8 are both dated 12 Sep 2026, and D7 R2 did not absorb F-06.

## Decision

Use **#1B2F6E** and **#D62027**.

## Why

1. **D8 is the adjudicating document.** It exists specifically to resolve
   conflicts across D5–D7 and states this resolution explicitly. D7 restating
   its original values is the conflict, not a counter-argument.
2. **The logo is a physical artefact.** A document revision can change a hex
   value; it cannot change a logo already in use, a build brief already written,
   and a prototype already built. The cheapest reconciliation point is the one
   that does not require re-issuing the other three.
3. **Accessibility does not break the tie.** Both pairs clear AA comfortably:

   |                | on white-1  | white text on it |
   | -------------- | ----------- | ---------------- |
   | D7 #022465     | 14.55:1     | 14.55:1          |
   | **D8 #1B2F6E** | **12.51:1** | **12.51:1**      |
   | D7 #DB1217     | 5.11:1      | 5.11:1           |
   | **D8 #D62027** | **5.13:1**  | **5.13:1**       |

   The reds are within 0.02 of each other. This is purely an identity question.

## Consequences

- D7 §2 and §17.1 are **out of date on the hex values only**. Every ratio, rule
  and pairing in those sections still holds.
- `--color-brand-primary-deep` keeps D7's Secondary **#0B1933**; it is not in
  conflict.
- `npm run verify:contrast` re-derives every ratio from `tokens.css`, so the
  published tables can never silently diverge again.

## Reversing

Change two lines in `src/design-system/tokens.css` and run
`npm run verify:contrast`. Both values pass either way.
