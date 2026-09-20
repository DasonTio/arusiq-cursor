# ADR-0016 · The canvas is grey and panels are white, not the reverse

**Status** Accepted · 2026-09-20 · **Reverse cost** two token lines and a
mechanical sweep of `background:` declarations — low, and the gate proves it

## Context

`--surface-page` was `#FFFFFF` and `--surface-raised` was `#F5F5F5`. Two
things followed from that, and both were visible on every screen.

First, the **rail was grey and the canvas was white**, which is the inverse of
the wireframe (page `#F5F5F5`, panels `#FFFFFF`). Navigation read as the
recessed thing and content as the backdrop.

Second, and worse: `.card` painted itself with `--surface-page`. A card and
the page it sat on were therefore **the same colour**, separated only by a
1 px `#E0E0E0` border. That is why whole screens — `client.energy` most
obviously — read as flat: there was no tonal separation to read, only a
hairline. Adding shadows or heavier borders would have been treating the
symptom.

The palette was never wrong. The two roles were assigned to the wrong values,
and one role was doing two jobs.

## Decision

Swap the roles, not the palette:

```
--surface-page:   var(--color-white-2)  /* #F5F5F5 · the canvas           */
--surface-raised: var(--color-white-1)  /* #FFFFFF · cards, rail, headers */
--surface-sunken: var(--color-gray-5)   /* recessed: wells, skeletons     */
```

and separate the two jobs `--surface-page` was doing: **only the body and the
shell frame keep it**. Everything that is a panel — cards, rows, the rail, the
sticky header, the mobile tab bar, inputs, the skip link — moved to
`--surface-raised`.

Two surfaces were also pointing the wrong way and were corrected: a loading
skeleton and a disabled input now sit on `--surface-sunken`, because a
placeholder and a disabled control are recessed below the canvas, not raised
above it.

## Consequences

- A panel separates by **tone**. The border is emphasis again rather than the
  only cue, which is what D7 §10.2 ("a shadow is never the only boundary")
  assumes is already true.
- `verify-contrast` needed no change. It measures every foreground against
  `white-1`, `white-2` and `gray-5` by value, not by role, so both surfaces
  were already in the matrix and all 40 checks still pass.
- `--surface-sunken` (`#E0E0E0`) now sits one step from the canvas rather than
  two. It still reads as recessed, but it is close enough that a future
  redesign of wells should revisit it rather than assume headroom.
- The mock banner is `--surface-sunken` and is now a fairly heavy grey band
  against a grey canvas. It is legible and correctly separated, but it is the
  first thing to look at if the shell is restyled.
