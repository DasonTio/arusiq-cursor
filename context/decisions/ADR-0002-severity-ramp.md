# ADR-0002 · Severity gets its own ramp, separate from state colours

**Status** Accepted · 2026-09-13 · **Reverse cost** eight tokens + a re-run of the contrast gate

## Conflict

D7 §4.1 says _"Severity borrows the state fills"_ and maps:

| Level  | D7 fill           | measured on white |
| ------ | ----------------- | ----------------- |
| Green  | success `#27AE60` | **2.87:1**        |
| Orange | warning `#E2B93B` | **1.87:1**        |
| Red    | error `#EB5757`   | 3.48:1            |
| Grey   | gray-3 `#828282`  | 3.84:1            |

The D8 infographic publishes a different, purpose-built severity ramp —
`#D32F2F` / `#C2680A` / `#1E9E5A` / `#6B7A94` — with text pairs and measured
ratios of 6.9 / 5.9 / 6.2 / 6.2:1.

## The finding

**D7's severity ramp fails D7's own accessibility bar.** §19.1 requires
"large text and interface components 3:1 — measured against all four surfaces".
A severity mark is a non-text interface element. The green mark measures
**2.87:1** and the orange mark **1.87:1** on white — the orange is roughly half
the required contrast, and both get worse on the raised and sunken surfaces.

This is not a judgement call. The document sets a numeric bar and two of its own
values are under it.

## Decision

**Severity is a third colour family, alongside brand and state.** It does not
borrow from state, and state does not borrow from it.

Adopt the D8 ramp, with three minimal hue-preserving corrections so every value
clears its bar against **all four** legal surfaces rather than white alone:

| Token                     | D8        | Adopted       | Why                             |
| ------------------------- | --------- | ------------- | ------------------------------- |
| `severity-normal-mark`    | `#1E9E5A` | **`#1C9253`** | 2.61:1 on sunken — needed 3:1   |
| `severity-warning-text`   | `#8A5A00` | **`#895900`** | 4.49:1 on sunken — needed 4.5:1 |
| `gray-3` (control border) | `#828282` | **`#7F7F7F`** | 2.91:1 on sunken — needed 3:1   |

All three are imperceptible lightness steps at constant hue and saturation.

## Two consequences worth stating

**1. There is no solid-filled severity badge.** No single foreground clears
4.5:1 across all four marks — warning tops out at 4.24:1 on black-1, unknown at
4.34:1 on white. A "white text on severity fill" badge is not constructible.
Severity therefore renders as D7 §3.2's own _preferred_ pattern: **10 % tint +
text-safe foreground + hairline mark border**. This was already the better
answer for a dense dashboard; the contrast maths just removes the alternative.

**2. gray-3 is no longer a text colour.** D7 §5.1 assigns it to "control borders
_and placeholders_". At 4.00:1 a placeholder is below the 4.5:1 text bar.
Placeholders use **gray-2**. A placeholder is a hint, not a label (D7 §15.1), so
nothing is lost — and the product's Lighthouse ≥ 90 target is not spent on it.

## Why separate, rather than just darkening the state fills

D7 already argues that _brand red ≠ state red_ because the two carry different
meanings and are separated by context, component and label. The same argument
applies one level down: **state ≠ severity**. State is "your input is invalid";
severity is "your compressor is failing". Conflating them means a form-validation
restyle silently changes how a critical alert reads. Separating the families
makes the two independently tunable, which is worth more than the four tokens it
costs.

## Consequences

- D7 §4.1's colour mapping is superseded. Its _vocabulary_ — four levels, three
  channels, shapes, grey-is-not-a-pass, roll-up precedence — is unchanged and
  remains authoritative.
- State colours keep their D7 values and their role in forms and interface
  feedback.
- `npm run verify:contrast` is now the enforcement point for both families.
