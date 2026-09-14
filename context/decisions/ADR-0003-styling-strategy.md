# ADR-0003 · CSS custom properties + CSS Modules, not a utility framework

**Status** Accepted · 2026-09-13 · **Reverse cost** high — rewrites every component

## Decision

`tokens.css` custom properties as the single source of truth, a typed
`tokens.ts` mirror for logic, and CSS Modules for component styles. No Tailwind,
no CSS-in-JS.

## Why

**Enforcement is greppable.** The whole design-quality strategy rests on
`verify-tokens.mjs` being able to prove that no raw value exists. A raw hex in a
`.module.css` file is one regex away. The same violation inside a framework's
arbitrary-value syntax (`bg-[#e2b93b]`, `p-[13px]`) is catchable too, but the
config becomes a second place where the design system lives, and two sources of
truth is the exact failure D8 finding F-06 documented.

**D7 is already fully specified in absolute values.** Eleven spacing levels, six
radii, a fixed type ramp, named surfaces. A framework's theme layer would be a
translation of a spec that is already complete — a translation is a place for
drift to hide, and it buys nothing here.

**Font-relative padding.** D7 §15.3 and §17.2 derive Textfield and Expressive
Button padding from font size in `em`. That is natural in CSS and awkward in a
utility framework without arbitrary values — which are precisely what we want to
ban everywhere else.

**Agents write this code.** A token that fails loudly at build time beats a
convention that fails quietly at review time. `var(--space-3)` is self-describing
in a diff; `p-4` requires knowing the scale factor.

## Honest trade-off

Tailwind's constrained utility vocabulary is a genuinely good fit for agent-written
UI, and the argument for it is not weak — it makes the *common* case terse and the
*deviant* case visibly ugly. It loses here on the second source of truth and the
`em`-derived padding, not on principle. If this project were greenfield without a
fully-specified design system, the call could reasonably go the other way.

## Consequences

- Component styles live in `<Component>.module.css` beside the component.
- Shared values are *always* tokens. A value used twice is a token.
- `verify-tokens.mjs` scans `.ts`, `.tsx` and `.css` and exempts only
  `tokens.css`.
