# Definition of done

A screen or component is done when **all three columns pass**. The first is
mechanical and free; the second and third need judgement, which is exactly why
they are listed rather than assumed.

## 1 · Mechanical — `npm run verify`

| Gate             | Proves                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `contrast`       | Every colour token clears WCAG against all four legal surfaces                              |
| `tokens`         | No raw hex, px, z-index; no layout transitions; no dark mode; tokens.ts in sync             |
| `provenance`     | Every metric component declares its origin; no forbidden "credit"; ppm and kgCO₂e separated |
| `i18n`           | No hardcoded user-facing strings, no concatenated formats, no English-sized controls        |
| `types` · `lint` | —                                                                                           |
| `trace`          | The requirement is claimed by a file                                                        |

## 2 · Requirement — does it do what was asked

- [ ] Every FR in the screen's `satisfies` list is actually implemented, not stubbed
- [ ] `@requirement FR-xx` in the file header, and `npm run trace` shows it claimed
- [ ] Anything marked `MOCKED` / `SIMULATED` is a **convincing, labelled
      simulation** — not a TODO, not a real integration
- [ ] Role scoping holds: try navigating to this screen as each other role

## 3 · Judgement — the checklist in `30-design-system.md`

Plus the four that get skipped most often, and cost the most:

- [ ] **All four data states exist** — `loading` skeletons matching the final
      layout, `empty` with the action that creates the first item, `error` with a
      retry, `noData` as grey with a last-seen time. Not four variations on a
      spinner.
- [ ] **Both locales render.** Switch to Indonesian and look at it. Every
      truncation and wrap bug lives here, and no tool will catch it.
- [ ] **375 px and 200 % zoom.** No horizontal scroll at either.
- [ ] **Keyboard only.** Tab through the whole screen. Every stop is visible and
      every action is reachable.

## What "done" is not

- ✗ "It renders." A screen that renders green everywhere demonstrates nothing —
  the unhappy paths are the product.
- ✗ "Verify passes." Verify proves you did not break the rules. It cannot tell
  you the screen answers the question its role opens on.
- ✗ "I'll add provenance/empty states/Indonesian later." Each of these is a
  full second pass over every screen. That is the entire reason they are gated
  from the first commit rather than the last.

## Sprint-level exit

Phase 1A is demo-ready when:

- `npm run trace:strict` passes — every **Must** requirement is claimed
- The eight stakeholder journeys run end to end in under 10 minutes
- A new user answers _"what needs attention?"_ in under 60 seconds
- Lighthouse accessibility ≥ 90 on each of the three dashboards
- Every figure on every screen carries a provenance label — the one claim the
  whole design set is judged on
