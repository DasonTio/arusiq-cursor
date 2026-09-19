# ADR-0009 · Brand palette: the values the Figma variables hold

**Status** Accepted · 2026-09-18 · closes OD-03 · supersedes ADR-0001's values
· **Reverse cost** three lines in `tokens.css`, one contrast run and one token
export

## Conflict

Three sources name three different brand palettes:

| Source                                               | Primary   | Brand red | Deep / secondary |
| ---------------------------------------------------- | --------- | --------- | ---------------- |
| D7 R2 §2                                             | `#022465` | `#DB1217` | `#0B1933`        |
| D8 F-06, adopted by ADR-0001                         | `#1B2F6E` | `#D62027` | —                |
| Figma file `g5e2UgJuHt7TX9QBdRdmjP`, bound variables | `#0B1B48` | `#DB1217` | `#2B407A`        |

ADR-0001 took D8's side on the principle that _the logo values are canonical_.

## Decision

Brand primary is `#0B1B48` and brand red is `#DB1217`. The dark hero surface is
`#0B1B48`. `#2B407A` is **not** adopted.

## Why

1. **ADR-0001's own principle points here.** The logo navy measures `#0B1B48`.
   ADR-0001's `#1B2F6E` and `#D62027` appear nowhere in the Figma file
   (`requirements.json → OD-03`, evidence gathered 17–18 Sep).
2. **The file is consistent once its opacity is accounted for.** The Colors
   frame's bound variables are `accent/primary #0B1B48`,
   `accent/secondary #2B407A` and `accent/secondary2 #DB1217`. The Buttons frame
   paints Primary `#0B1B48` and Secondary `#DB1217`. The only other values seen,
   `#172751` and `#DD1E23` on Login and Profile, are those same variables at
   95 % layer opacity. All three channels solve to α ≈ 0.95. The wrong hex
   _labels_ on the Colors frame (5 of 10 swatches) are annotation errors, not
   paint.
3. **Red has two witnesses.** `#DB1217` is both D7 R2's documented brand red and
   the Figma variable.
4. **Accessibility does not block it** (measured by `npm run verify:contrast`):

   |                     | white-1 | white-2 | gray-5  | white text on it |
   | ------------------- | ------- | ------- | ------- | ---------------- |
   | `#0B1B48` primary   | 16.61:1 | 15.23:1 | 12.58:1 | 16.61:1          |
   | `#DB1217` brand red | 5.11:1  | 4.69:1  | 3.87:1  | 5.11:1           |

   Brand red is a button fill, held to the 3:1 bar, and clears it on all three
   light surfaces.

5. **Moving the hero keeps code and Figma the same colour.** The Figma hero is
   painted `#0B1B48`. Every ADR-0005 foreground still clears its bar on it:

   | Token                    | On `#0B1933` (was) | On `#0B1B48` (now) | Bar |
   | ------------------------ | ------------------ | ------------------ | --- |
   | `on-inverse` (white-1)   | 17.48:1            | 16.61:1            | 4.5 |
   | `on-inverse-muted`       | 5.55:1             | 5.27:1             | 4.5 |
   | `eco-on-inverse`         | 5.55:1             | 5.27:1             | 4.5 |
   | `border-on-inverse`      | 3.53:1             | 3.35:1             | 3.0 |
   | `severity-critical-mark` | 3.51:1             | 3.34:1             | 3.0 |
   | `severity-warning-mark`  | 4.39:1             | 4.17:1             | 3.0 |
   | `severity-normal-mark`   | 4.40:1             | 4.18:1             | 3.0 |
   | `severity-unknown-mark`  | 4.03:1             | 3.82:1             | 3.0 |

   The two text tokens drop below ADR-0005's 5.5:1 target but keep 0.77 of
   headroom over 4.5. That is enough that they are not re-tuned here.

6. **`#2B407A` has no legal job yet.** Its only use in the file is as a fill
   for KPI tiles on the dashboard and energy frames. ADR-0005 limits the dark
   surface to the hero, and D7's KPI tile sits on the light surfaces. Carbon
   and mobile Home already draw white tiles. A token that no component may use
   would invite exactly that use.

## Consequences

- **ADR-0001's hex values are superseded.** Its principle — the logo is
  canonical — stands, and is what this ADR applies.
- `--surface-inverse` now points at `--color-brand-primary`, so the hero is the
  brand navy. **No brand-primary fill may sit on the hero**, because it would
  measure 1.00:1 there. ADR-0005's scope rule already implies this; it is now
  also arithmetic.
- `--color-brand-primary-deep` keeps D7's `#0B1933`. It remains the focus-ring
  colour and is no longer the hero surface.
- `tools/verify-contrast.mjs` now reads the inverse surface from
  `--surface-inverse` instead of naming a token. Moving the hero again
  re-measures everything on it automatically.
- **Known gap, not changed here.** The focus ring (`#0B1933`, a single-tone
  outline) measures 1.05:1 on the hero. On the old hero it measured 1.00:1.
  Anything focusable on the hero needs an `on-inverse` ring. Add one when the
  hero component is built.
- **Figma follow-up.** Import `design/figma-tokens.json` as variables to
  replace the mislabelled Colors frame. Set button and panel layers back to
  100 % opacity. Unbind or remove `accent/secondary` from KPI tiles.

## Reversing

Restore ADR-0001's two values in `src/design-system/tokens.css`. Point
`--surface-inverse` back at `--color-brand-primary-deep`. Then run
`npm run verify:contrast` and `npm run figma:tokens`. Every value above passes
either way. This is an identity decision, not an accessibility one.
