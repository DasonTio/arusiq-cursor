---
description: Run the full gate and explain any failure in terms of the rule it broke
---

Run `npm run verify`.

For each failure, report:

- the file and line
- **the rule, and the requirement or D7 section behind it** — not just the
  regex that fired
- the smallest correct fix

If a check itself is wrong — a false positive, a rule that has outlived its
requirement — say so explicitly and propose the fix to `tools/`. Do not silence
it with an exemption comment. An exemption added to route around a correct rule
is the beginning of a design system nobody trusts, and the exemptions are
deliberately greppable so that conversation is easy to have.

Finish with `npm run trace` and report Must-requirement coverage.
