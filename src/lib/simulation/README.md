# src/lib/simulation

Owner: **simulation-engineer · read-only to feature work**

See `context/40-architecture.md` for the full ownership table and the
dependency direction (features → patterns → components → design-system).

## Work orders — `shared.work-order` (FR-25, FR-32, FR-34)

`listWorkOrders` · `getWorkOrder` · `recordChecklistItem` · `recordFinding` ·
`closeWorkOrder` · `escalateWorkOrder` · `runPostServiceCheck`.

One record with the five O-WO views on it: `brief`, `evidence`, `checklist`
(grouped indoor · outdoor · electrical over the same twelve parts as the unit
health grid), `findings`, `closure` and `verification`.

Three things a screen must not re-implement:

- **Closing does not close.** `closeWorkOrder` returns `awaitingVerification`
  with the post-service check scheduled. `runPostServiceCheck` re-reads the
  device signal: `passed` closes it, `failed` reopens it, and a unit that is
  not reporting is `inconclusive` — which is not a pass.
- **A refusal is data.** Every transition returns
  `{ ok: true, order } | { ok: false, reasonKey }`. Render the key; do not
  write the sentence.
- **Scope is on the object.** A third-party technician is given their own
  orders and nothing adjacent to them, so there is nothing to filter in the UI.

Ten seeded orders cover every state a screen has to draw — `dispatched`,
`accepted`, `inProgress`, `awaitingVerification`, `closed`, `reopened`,
`escalated` — including a closure the telemetry refused (`WO-2026-0748`) and
one it could not speak to at all (`WO-2026-0757`).

## The restriction approval queue — `shared.approve` (FR-52, ADR-0015)

`listRestrictionRequests` · `getRestrictionRequest` ·
`decideRestrictionRequest`. **Admin only**, scoped on the object exactly like
work orders: a client gets an empty list and `notInScope` on a guessed id.

Six seeded requests, four of them pending. Three cases the demo needs:

- **Approvable** — `rq-2026-0031` (guest room, rung 1 → 2).
- **Refusable on sight** — `rq-2026-0036` asks for `stop` on the nursery.
  `permitted` is already `false`, and approving it returns
  `{ ok: false, reasonKey: 'restriction.reject.healthSensitiveStop' }`. The
  refusal runs `isStepPermitted()` in `lib/domain`, in the adapter, where a
  screen cannot route around it. Declining it still works — the request is
  not a dead end.
- **Needs a named manager** — `rq-2026-0029` asks for rung 4 on a space that
  permits it. ADR-0015 OD-02: approve it without `signedOffBy` and you get
  `signOffRequired`; approve it with one and `UnitRestriction.approval.signedOff`
  carries the name.

An approval **moves the ladder**: every affected unit gets the rung, its grace
period and the two-person record, and the account banner is re-derived so it
cannot disagree with the unit banners.

`Room.healthSensitiveDesignation` is the record behind the boolean (ADR-0015
OD-01): requester, evidence key, approver, review date. The boolean stays the
thing callers test — one of the two seeded designations has a review date that
has already passed.

## Commands actually progress — `shared.unit` Control view (FR-40)

`sendCommand` → `getCommand` → `advanceCommand`, all returning `CommandProgress`.

Two seams, one state machine, neither of which sleeps on the wall clock:

- **Elapsed simulated time.** `getCommand` recomputes from the injected clock
  against `SIMULATED_POLICY.commandTimings`. A test moves its own clock.
- **An explicit tick.** `advanceCommand` moves one rung regardless of the
  clock. The browser's adapter runs on the _fixed_ demo clock, so this is what
  a UI timer drives.

They cannot disagree: progression is monotonic and takes whichever is further.
`failed` and `queued` are returned untouched by both — a failed command did not
get further because time passed, and an unreachable device acknowledged nothing.

**Only `verified` settles the control.** Until then the requested change lives
on the `CommandProgress` record and nowhere else.
