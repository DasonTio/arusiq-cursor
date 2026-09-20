# ADR-0017 · One blue action ladder; red means severity

**Status** Accepted · 2026-09-20 · **Reverse cost** one rule in
`Button.module.css` — low

## Context

`--color-brand-red` (`#DB1217`) was the fill of the `secondary` button, and
that was its **only** use in the product: one CSS declaration, fourteen call
sites.

Red is the loudest thing in the palette. So on `client.overview` the hero's
"How this was calculated" outshouted everything around it, and on
`shared.unit` "Adjust" did the same — both nominally _secondary_ actions
drawn louder than the primary ones beside them. The product read as
red-accented when the brand is navy, and red simultaneously carried a
severity meaning three tokens away (`--color-severity-critical-*`,
`--color-state-error`). One colour, two contradictory jobs.

The token's own comment already said the quiet part: _"secondary button. NOT a
problem signal."_ A comment is not a mechanism.

## Decision

One ladder, in brand navy:

| rung        | treatment                    |
| ----------- | ---------------------------- |
| `primary`   | filled navy, white text      |
| `secondary` | **outlined navy**, navy text |
| `ghost`     | quiet: inherits, grey border |

Red retires to what it should have meant all along: severity, state, and the
mark. `--color-brand-red` stays in `tokens.css` as a brand colour and keeps
its contrast check; it is simply not an action colour.

`secondary` paints no fill, so — exactly like `ghost`, and for the reason
recorded in `Button.module.css` — it cannot name a colour outright: navy on
the ADR-0005 hero would be navy on navy. Its accent is therefore a variable a
surface may override:

```css
color: var(--button-accent, var(--color-brand-primary));
```

and `.hero` sets `--button-accent: var(--color-on-inverse)`, so an outlined
button on the dark hero draws in white. Brand navy is the default for the
light surfaces only.

## Consequences

- Visual weight now tracks intent. A filled navy button is the most important
  action on a screen, and nothing competes with it for attention.
- Red on screen is now always a severity claim, which is what INV-SEVERITY
  assumes when it says severity is colour + shape + label.
- The `--button-accent` hook is the second use of "the surface declares its
  own foreground" (the first is `.ghost` inheriting `color`). A third use
  should probably become a documented surface contract rather than another
  ad-hoc variable.
- Any future variant that paints no fill must use the same hook, or it will
  be invisible on the hero. `surface-dependent-foreground` in
  `verify-tokens.mjs` fails the build if it hardcodes a colour instead.
