---
description: Review a built screen against D7 and the definition of done
argument-hint: <path or screen id>
---

Review **$ARGUMENTS** against `context/60-definition-of-done.md`.

`npm run verify` covers the mechanical half — run it, but do not spend the
review re-reporting what it catches. Spend it on what tools cannot see:

- Does the screen open on **the decision its role owns**, or on a wall of data?
- One primary action per area?
- Are all four data states real — `loading` skeletons matching the final layout,
  `empty` offering the creating action, `error` with a retry, `noData` as grey
  with a last-seen time? Or four variations on a spinner?
- Switch to Indonesian. What truncates, wraps or overflows?
- 375 px and 200 % zoom — horizontal scroll anywhere?
- Tab through it. Every stop visible, every action reachable?
- Any dead end — an alert or a severity that leads nowhere?
- Any mock that is not visibly labelled as a mock?
- Any hardcoded reading that should come from `lib/simulation`?

State plainly whether it is demo-ready. If not, list what blocks it, most
severe first.
