# ADR-0015 · Restriction ladder governance: who approves, who flags, and what stays out of Phase 1A

**Status** Accepted · 2026-09-19 · closes OD-01, OD-02 and OD-04 · **Reverse
cost** two fields on `UnitRestriction`, one panel (`shared.approve`), and the
fixtures that carry them — nothing else consumes the shape yet

## Why this ADR exists

FR-52 (Must) is the restriction ladder: _reminder → minimum setpoint raised →
Eco lock and limited hours → off_, each rung with notice, grace, approval and
audit. The ladder's **state** has been renderable for some time
(`admin.restriction-case`, the banners on `shared.unit`, `client.billing`,
`admin.payments`). Its **governance** was not buildable, because three open
decisions sat on it — and a governed process whose rules are guessed is not a
governed process.

The product owner answered all three on 2026-09-19. This records the answers,
the evidence behind each, and what they cost.

## OD-01 · Who may flag a space as health-sensitive?

### The stake

`isStepPermitted()` refuses `stop` on a health-sensitive space (D6 FR-53). So
the flag is not a label — it is the **off switch for the harshest rung**.
Whoever may set it decides whether that guarantee is real:

- If the **account holder self-declares**, anyone facing restriction opts out
  of rung 4 for free and the guarantee is decorative.
- If **only HQ may set it**, an occupant with a genuine medical need — an
  infant, an oxygen concentrator, someone convalescing — has no route in, and
  the guarantee protects nobody it was written for.

### Decision

**A request-and-review record, not a self-declaration and not an HQ-only
switch.** The client or a technician on site _requests_ the designation with
evidence; **HQ approves it**; the record carries a **review date** so it
cannot be set once and forgotten.

### Why

1. **D2 v2.1 already drew this shape.** X-3 _Spaces & flags_ holds the
   health-sensitive designation **with requester, evidence and review date**.
   A self-declaration needs no approver field; an HQ-only switch needs no
   requester field. D2 carries both, plus an expiry — which is a
   request-approve-review record and nothing else.
2. **It is the only option that fails safe in both directions.** Self-service
   fails open (the ladder loses its floor); HQ-only fails closed (a real need
   is unheard). Request-with-evidence fails _slow_ — the worst case is a
   pending request, which is a queue, not a harm.
3. **A review date is what stops a flag becoming permanent furniture.** A
   designation with no expiry is indistinguishable from a property that was
   mis-tagged in 2026 and never looked at again.

## OD-02 · One or two approvers at each rung?

### The conflict

Four sources, and they did not agree:

| Source                                   | Says                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `CLAUDE.md` non-negotiable #7            | "Notice → grace → **dual approval** at every step"                        |
| `src/lib/domain/restriction.ts` docblock | "notice, grace period and **dual approval** at every step"                |
| D2 v2.1 UF-06                            | "**two approvals**" on rungs 1–3, "**management sign-off**" before rung 4 |
| `UnitRestriction.approval` (the code)    | `{ requester, approver, at }` — **one** approver                          |

The ambiguity is what "dual" counts: requester + one approver (two people
involved), or requester + two approvers (three).

### Decision

**Two-person control on rungs 1–3: requester + one independent approver.**
**Rung 4 (`stop`) additionally carries a named management sign-off.**

`UnitRestriction.approval` gains an optional `signedOff` record, populated
only on rung 4.

### Why

1. **"Dual approval" is two-person control, which the data model already
   encodes.** Requester and approver are two different people; that is the
   four-eyes principle as normally written. Reading "dual" as three people
   would make the existing shape wrong rather than incomplete, and nothing in
   D5, D6 or D7 says three.
2. **D2 singles out rung 4, and D2 is right to.** `stop` is the rung the
   occupant physically feels — cooling ends. It is also the rung
   `isStepPermitted()` can refuse outright. A heavier gate there is
   proportionate; the same gate on a _reminder_ is ceremony that teaches
   approvers to click through.
3. **It is additive, so it does not invalidate the seeded data.** Existing
   fixtures carry requester + approver and stay valid; only a rung-4
   restriction needs the extra signer.

## OD-04 · Which D5/D6 revision is authoritative, and is the dispute path in 1A?

### The finding

`docs/` holds **D5 R1 and D6 r1 (v1.0, 8 Sep 2026)**. D2 v2.1 and D7 both
cite **R2**, which is not in the repository. Checked 2026-09-19: the word
"dispute" appears in `ARUSIQ_D2_UI_UX_Flow_Sitemap_v2.1.html` and the design
infographic, and **in neither D5 nor D6**. D2 draws `P-DISPUTE` and cites
FR-57; D6 v1.0 defines FR-50…56 only.

### Decision

**Build to D5/D6 v1.0, the revisions actually in the repository.** The client
dispute path (`P-DISPUTE`, FR-57) is **out of Phase 1A** and is not built.

### Why

1. **An FR that exists in no requirements document in the repository cannot
   be implemented to spec — only invented.** D2 drawing a box is evidence the
   flow is wanted, not a definition of what it must do, who may raise a
   dispute, what pauses, or for how long.
2. **The safety gap this leaves is real and is recorded rather than papered
   over.** A ladder whose only exit is payment _is_ a gap: the honest
   statement is "Phase 1A has no dispute path", not a simulated one whose
   rules we made up. See Consequences.
3. **It reverses cheaply the day R2 arrives.** If FR-57 exists there, build
   `P-DISPUTE` as a labelled simulation and revisit this section.

## Consequences

- **`UnitRestriction.approval` widens** by an optional `signedOff:
{ manager: string; at: string }`, set only when `step === 'stop'`.
- **A health-sensitive designation becomes a record, not a boolean**, at the
  space level: requester, evidence, approver, review date. `Unit.device`-style
  mirroring onto the unit (`healthSensitive: boolean`) **stays** — callers
  deciding whether the next rung is reachable must not have to walk the tree.
- **`shared.approve` (P-APPROVE) is now buildable** and is the last
  Must-priority screen with real product value behind it. It shows: requester,
  reason, rung requested, evidence summary, the health-sensitive check, the
  second approver's identity, expiry, and the decision record.
- **Phase 1A ships with no dispute path.** `context/80-stakeholder-journeys.md`
  and the demo script must say so out loud rather than let a stakeholder infer
  one exists. The exit from the ladder in 1A is payment, or an HQ decision to
  step back down.
- **OD-01, OD-02 and OD-04 move to `decided`** in
  `context/requirements/requirements.json`, with this ADR as the resolution.
  `npm run trace` stops reporting three blocked requirements.

## Reversing

1. **To make the health-sensitive flag self-service**, drop the approver and
   review-date fields from the space record and let the client write it
   directly. That re-opens the fail-open hole in §OD-01 knowingly, so do it
   only with a product answer that replaces the guarantee.
2. **To require three people on every rung**, make `signedOff` required rather
   than rung-4-only and re-seed the fixtures. Note this contradicts the plain
   reading of "dual" in `CLAUDE.md` #7, which would need editing in the same
   change.
3. **To build the dispute path**, put D5/D6 **R2** in `docs/`, confirm FR-57
   exists, then build `P-DISPUTE` as a labelled simulation and amend §OD-04.
