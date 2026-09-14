# ADR-0005 · A dark hero _surface_, not a dark _mode_

**Status** Accepted · 2026-09-14 · **Reverse cost** four tokens + one matrix re-run

## Conflict

D6 FR-10 specifies the Client overview as opening on a **hero showing carbon
reduced this month**, and D8 describes it explicitly as "on a dark hero".

D7 §5.2 says the opposite: _"Phase 1 is light mode only. Do not add a dark
variant: a dark theme nobody has designed looks supported and is not, and adding
one means re-running the entire contrast matrix against four more surfaces."_

D7 §20 then lists the dark hero as **recognised gap #5**, blocking _all three
dashboards_.

## Decision

Add a fifth legal surface, `--surface-inverse` (`brand-primary-deep` `#0B1933`),
scoped to the hero component only. Add exactly three foreground tokens for it.
The light-only rule stands everywhere else.

## Why this is not the thing D7 forbids

D7's objection is precise, and it is right: a dark **mode** means every token
needs re-deriving against four more surfaces, and an undesigned theme that looks
supported is worse than none.

A dark **surface** is a different object. One component, one background, and
only the handful of foregrounds that actually land on it. That is four tokens
and eight measurements, not a second palette. The distinction is worth naming
because "we added a dark surface" is exactly how a codebase ends up with a
half-finished dark mode.

The guard is mechanical: `tools/verify-contrast.mjs` measures inverse tokens
**only** against the inverse surface, and light tokens only against the light
ones. Nothing is checked against a surface it never renders on, and adding a
fifth surface did not loosen any existing check.

## Measured

Severity needs **no** inverse variant — all four marks already clear 3:1 on
`#0B1933`:

| Token                    | Value     | On inverse | Bar |
| ------------------------ | --------- | ---------- | --- |
| `on-inverse` (white-1)   | `#FFFFFF` | 17.48:1    | 4.5 |
| `on-inverse-muted`       | `#919191` | 5.55:1     | 4.5 |
| `eco-on-inverse`         | `#00A0B1` | 5.55:1     | 4.5 |
| `border-on-inverse`      | `#707070` | 3.53:1     | 3.0 |
| `severity-critical-mark` | `#D32F2F` | 3.51:1     | 3.0 |
| `severity-warning-mark`  | `#C2680A` | 4.39:1     | 3.0 |
| `severity-normal-mark`   | `#1C9253` | 4.40:1     | 3.0 |
| `severity-unknown-mark`  | `#6B7A94` | 4.03:1     | 3.0 |

The two text tokens are pitched at **5.5:1 rather than the 4.5:1 minimum**.
`state-eco` lightened to exactly 4.5 measured 4.51:1 — a pass with no headroom,
which the next small adjustment silently breaks. D7 §3.2 makes the same argument
for preferring the pattern with "the most contrast headroom".

## Consequences

- `--surface-inverse` is for the hero. It is **not** a general dark card, and a
  second use is a signal to revisit this ADR rather than to spread it quietly.
- D7 §20 gap #5 is closed.
- `state-eco` (`#007B88`) measures 3.49:1 on inverse — **UI use only** there.
  The carbon figure on the hero uses `eco-on-inverse`.
