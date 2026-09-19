---
description: Record an architecture decision, especially where source documents conflict
argument-hint: <short title>
---

Write a new ADR in `context/decisions/` for: **$ARGUMENTS**

Number it after the highest existing file. Follow the shape of `ADR-0002`:

- **Status**, date, and an honest **reverse cost**
- **Conflict / Context** — quote what each document actually says, with section
  IDs. If this is a document conflict, quote both sides fairly.
- **Decision** — one sentence
- **Why** — with _evidence_. If it is a colour, compute the contrast. If it is a
  threshold, show the number. An ADR that argues from taste where a measurement
  was available is not worth writing.
- **Consequences** — what is now superseded, and what still holds. Be precise:
  "D7 §4.1's colour mapping is superseded; its vocabulary is unchanged."
- **Reversing** — the concrete steps

Then apply the decision, run `npm run verify`, and link the ADR from any context
file it changes.

Document precedence when nothing else decides it:
**D8 review > D7 (visual) > D6 (behavioural) > D5 (intent) > inference.**

For information architecture — which surfaces exist, how each role reaches
them, and which width each is designed for — **D2 v2.1** decides, and D7 still
decides how those surfaces look (ADR-0008). D2 postdates D8 and builds on it.
