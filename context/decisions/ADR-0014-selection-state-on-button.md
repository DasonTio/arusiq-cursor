# ADR-0014 · Selection state on `Button`: two props, because a toggle and a current item are not the same claim

**Status** Accepted · 2026-09-19 · **Reverse cost** one prop interface, eight
lines of `Button.tsx`, one test file — no token, no CSS, no screen (nothing
uses it yet)

## The finding

The accessibility audit's highest-severity item, **B2**: selection and current
state are **colour-only in 22 controls**, because `ButtonProps` had no channel
for them at all. No `aria-pressed`, no `aria-current`, nothing — and
`Button.tsx` therefore forwarded nothing.

Every one of the 22 expresses "this one is chosen" as
`variant={x === active ? 'primary' : 'ghost'}`. That is a navy fill and nothing
else. A screen reader announces:

```
"Cooling, button"      ← the active mode
"Cooling, button"      ← and the inactive one. Identical.
```

Two things break at once:

1. **WCAG 4.1.2 Name, Role, Value.** "States, properties and values … can be
   programmatically determined" — here the state cannot be determined at all.
2. **The product's own non-negotiable #2**, which says state is never colour
   alone. It is written about severity, and the audit's contribution is that the
   same failure was sitting in the interface chrome the whole time, where nobody
   was looking for it. A bare navy chip is a bare coloured dot in a different
   costume.

The right pattern already existed and was not reachable: `ViewTabs` uses
`NavLink` and gets `aria-current="page"` for free. But most of the 22 are not
routes — filter chips, mode pickers, query-param views — so `NavLink` is not a
drop-in and `ButtonProps` had to grow the channel itself.

## The two cases are genuinely different

|                 | Toggle                                   | Current item                            |
| --------------- | ---------------------------------------- | --------------------------------------- |
| Example         | space filter, mode/fan picker, approval  | Unit / WorkOrder view tabs, 7-vs-30-day |
| The claim       | "I pressed this and it stayed down"      | "this is the one you are looking at"    |
| Attribute       | `aria-pressed`                           | `aria-current`                          |
| On the others   | **`"false"`, present**                   | **absent**                              |
| Valid on a link | **no** — supported by role `button` only | yes — `aria-current` is a global state  |

The last two rows are why this is not one boolean.

`aria-pressed` must be rendered on every member of the group including the
unpressed ones: a button carrying `aria-pressed="false"` is a toggle button, a
button carrying nothing is a plain button, and a group that mixes the two
announces a **different set of controls every time the selection moves**.
`aria-current`, by contrast, marks the one; a row of explicit
`aria-current="false"` is noise the spec does not ask for.

And `aria-pressed` is not global — it is a supported state of role `button`. Six
of the 22 render as links (`to=` set). A "pressed link" is ARIA an assistive
technology is entitled to ignore, so it has to be unrepresentable rather than
merely discouraged.

Collapsing both into `selected?: boolean` would force one of the two cases to
lie. That is exactly the kind of convenience this repo removes on purpose.

## Decision

`ButtonProps` becomes a union of a `<button>` form and a `<Link>` form, and the
`<button>` form gains two optional booleans.

```ts
interface ButtonActionBase extends ButtonBaseProps {
  type?: 'button' | 'submit';
  to?: never;
}

interface ButtonToggleProps extends ButtonActionBase {
  pressed?: boolean; // aria-pressed — `false` reaches the DOM
  current?: never; // one claim per control
}

interface ButtonCurrentProps extends ButtonActionBase {
  pressed?: never;
  current?: boolean; // aria-current — absent when false
}

interface ButtonLinkProps extends ButtonBaseProps {
  to: string;
  type?: never;
  pressed?: never; // role=link does not support aria-pressed
  current?: boolean;
}

export type ButtonProps = ButtonToggleProps | ButtonCurrentProps | ButtonLinkProps;
```

Three states are now unrepresentable rather than discouraged, checked against
the compiler: `to` + `pressed`, `to` + `type="submit"`, and `pressed` +
`current` on the same control — the last because a button claiming both
announces twice and means neither.

Three more things follow, each deliberate.

### 1. Neither prop touches the class list

`variant` still carries the visual treatment, unchanged. `pressed` and
`current` are the missing **semantic** channel added alongside it, not a
replacement for it. `Button.module.css` is untouched, no token moved, and
adding either prop to a screen changes precisely nothing on screen. That is
what makes the 22-site follow-up a mechanical pass with no visual review
attached.

### 2. The ARIA value is derived, not passed

The caller writes `current={view === item}` and never writes `"page"` or
`"true"`. The component picks:

- **link** (`to` set) → `aria-current="page"` — "the current page within a set
  of pages", and identical to what `NavLink` already emits in `ViewTabs`, so a
  query-param tab and a routed tab announce the same instead of being two
  patterns that merely look alike.
- **button** → `aria-current="true"` — "the current item within a set". Nothing
  navigated; the view simply changed.

Exposing the raw token would be 22 chances to pick the wrong one for a
distinction the component already knows the answer to.

### 3. `to` and `type="submit"` are now exclusive in the type

They always were in prose — `/** Mutually exclusive with type="submit" */` —
and the union makes it compile-time for free. No existing call site passes
both, so this costs nothing today and closes a door.

### Not `role="tab"` / `aria-selected`

`aria-selected` is the more precise word for the view tabs, and taking it means
taking the whole APG tablist widget with it: `role="tablist"`, roving
`tabindex`, Left/Right, Home/End, `aria-controls` onto panels that in two cases
are separate URLs. A half-built tablist — the role claimed, the keyboard
contract unimplemented — is **less** usable than the plain links in a labelled
`<nav>` these already are, because it promises a keyboard model that then does
not work. Same argument, same conclusion, for `role="radio"` below.

## Known limitation, stated rather than glossed

Most of the toggle sites are **single-select**: one mode, one fan speed, one
payment method. The strictly ideal ARIA for single-select is a radio group, not
a set of toggle buttons — and it carries the identical keyboard obligation as
the tablist above (arrow keys move the selection, the group is one tab stop).

`aria-pressed` on a mutually-exclusive set is a long-standing, widely-supported
pattern — it is what a toolbar's text-alignment buttons do — and it is a large,
correct improvement over silence. It is not the end state. Converting the
single-select groups to a real `radiogroup` primitive with roving focus is a
separate piece of design-system work, and it is worth noting that several of
these groups already have their half of it: `client/Alerts.tsx` wraps its chips
in `role="group"` + `aria-labelledby`, `ServiceRequest.tsx` in
`<fieldset><legend>`. The group is named; only the member state was missing.

**This ADR closes the colour-only failure. It does not claim to close the
keyboard-model question.**

## Follow-up checklist — applied 2026-09-19

The 22-site pass landed as its own single, reviewable diff
(`context/50-agent-protocol.md`, single-writer discipline), after this ADR's
contract addition. B2 is closed: every site below carries `pressed` or
`current`, `npm run verify` passes (281 tests), and two regression tests were
added (`Unit.test.tsx` — the Now/Health view tabs carry `aria-current`, not
colour alone; `Alerts.test.tsx` — the space filter's `aria-pressed` flips on
click) beyond the contract-level tests already in `Button.test.tsx`.

The enforcement lint rule this ADR deferred is still not added — see
"Enforcement" below, now that the pass it was waiting on is done.

`pressed={…}` — 16 sites, all `<button>`-shaped:

- [x] `src/features/client/Alerts.tsx:301, 312` — space filter (all + per room)
- [x] `src/features/client/Alerts.tsx:333, 344` — part-group filter (all + per group)
- [x] `src/features/shared/Unit.tsx:376` — mode picker
- [x] `src/features/shared/Unit.tsx:398` — fan picker
- [x] `src/features/shared/WorkOrder.tsx:438` — verdict picker
- [x] `src/features/shared/Assign.tsx:59, 79, 94` — technician, window, SLA
- [x] `src/features/shared/Pay.tsx:69` — payment method
- [x] `src/features/shared/ServiceRequest.tsx:158` — **one** `ChoiceRow` serving
      visit type, slot and contact: a single edit fixes three groups
- [x] `src/features/auth/ForgotPassword.tsx:47, 55` — reset channel
- [x] `src/features/admin/Mrv.tsx:155, 163` — dual approval

`current={…}` — 6 sites, all rendering as links:

- [x] `src/features/shared/Unit.tsx:327` — now / health / control view tabs
- [x] `src/features/shared/WorkOrder.tsx:285` — view tabs
- [x] `src/features/client/Energy.tsx:296, 299` — 7-day / 30-day
- [x] `src/features/client/Carbon.tsx:178, 181` — 7-day / 30-day

Two notes for whoever takes the pass:

- **`pressed` goes on every member of a group or on none of them**, including
  the `…All` chips in `client/Alerts.tsx`. A partially-migrated group is worse
  than an unmigrated one.
- `Mrv.tsx`'s pair **latches** — `first` and `second` never return to false.
  `aria-pressed="true"` is accurate for "this approval has been given"; the
  `role="status"` line already beside them is what actually narrates the step
  advancing, and it should stay.

## Enforcement

Added 2026-09-19, now that the follow-up pass is done:
`eslint-rules/index.js`'s `require-selection-state-on-button` flags any
`<Button variant={cond ? ... : ...}>` with neither `pressed` nor `current`,
wired in as `'arusiq/require-selection-state-on-button': 'error'` in
`eslint.config.js`. It ran clean against the whole app on landing — not just
the 22 tracked sites — which is the actual proof none were missed. Tests in
`eslint-rules/rules.test.js` pin both the fire and the quiet cases. Escape
hatch: a `// selection-state-exempt` comment, for the rare case a conditional
variant genuinely isn't a selection control.

## Consequences

- `ButtonProps` is a union type, not an interface. It is imported by
  `Button.tsx` and nothing else, so the change is contained.
- A link with `pressed` does not compile. A `to` with `type="submit"` does not
  compile. A control with both `pressed` and `current` does not compile.
- No token changed, no stylesheet changed, so `npm run verify:contrast` is
  untouched — it passes for the same reason it passed yesterday.
- `src/components/Button.test.tsx` asserts both semantics, the negative case
  for each, and that omitting both props emits neither attribute. The
  assertions are on the accessibility tree, not on class names: the class list
  was already correct throughout the bug.

## Reversing

Restore the single `ButtonProps` interface, drop `pressed` / `current` from
`Button.tsx`, delete `Button.test.tsx`. Reversing after the follow-up pass also
means removing the props from the 22 sites above — which reinstates the audit
finding, so do it only with an accessibility answer that replaces it.
