# Stakeholder journeys

`context/60-definition-of-done.md`'s sprint-exit bar says "the eight
stakeholder journeys run end to end in under ten minutes." That list was
never written down anywhere in this repo until now.

## Where "eight" comes from, and why there are ten below

`docs/ARUSIQ_D2_UI_UX_Flow_Sitemap_v2.1.html` § User flows, verbatim:

> "The acceptance criterion is eight journeys demonstrated in under ten
> minutes. These are those eight, plus device trust — which the conformance
> review found had no flow at all — plus the mobile triage that tests
> whether the new admin rail actually works on a phone."

So **UF-01 through UF-08 are the original eight** the DoD's number refers to.
UF-09 (device trust) and UF-10 (mobile triage) were added later as extra
coverage, not folded into the "eight" count. The DoD line is not stale — it
is citing the original eight on purpose. Both bonus flows are documented
below too, marked **(bonus, not counted in the eight)**, because they're
real acceptance surface even if they don't count toward the sprint-exit
arithmetic.

Each journey's click path below was checked against `src/routes/catalog.ts`
(the real route table) and `src/routes/navigation.ts` (the real nav labels)
as of 2026-09-19. **Two other fixes were landing concurrently with this
doc** (a batch of accessibility fixes, and a fix for the `links.ts`
role-scoping dead-ends) — where a journey's completion depends on either,
that's called out explicitly rather than assumed.

---

## UF-01 — Access, language and role routing

**Role:** All roles · **Goal:** A person reaches the rail that belongs to
their role, or recovers access without contacting support.

1. `/sign-in` — email/phone + password, or a one-tap demo account button
   ("Household demo" / "Technician demo" / "Partner technician demo" / "HQ
   demo"), plus a language switch.
2. Submit → role router resolves scope → lands on `landingPath(role)`:
   `/home` (client), `/work` (technician, either kind), `/overview` (admin).
3. Fifth consecutive failed attempt → 15-minute lockout, same neutral
   wording as a normal failure (no "this account doesn't exist" leak).
4. "Forgot password" → `/forgot-password` → code → neutral confirmation →
   new password → back to sign-in.

**Status: complete, built exactly as specified.** Verified: `SignIn.tsx`'s
lockout counter, the four demo buttons, and the cross-role redirect fix
(signing out from one role and into a different role's demo account no
longer inherits a stale path — `isNavReachable()` in `navigation.ts` guards
this). **~3–5 clicks, under a minute.**

## UF-02 — Alert to action (client path)

**Role:** Client · **Goal:** Something is wrong with a unit. The client
finds out, understands the evidence, and leaves having done something
about it.

1. `/home` — a red or orange tile in "Needs your attention" is the entry
   point (same destination as a push/WhatsApp notice would deep-link to).
2. Tap it → `/alerts?alert=…` — Alert detail: signals, threshold, duration,
   confidence, impact-if-ignored, exactly one recommended action.
3. Branch on what it needs:
   - **Self-service** — the recommended action is a guided fix (clean the
     filter, raise the setpoint); no further screen, alert re-checks later.
   - **Needs a technician** — "Raise a request" → `/account/service?request=new`
     (`shared.service-request`, prefilled from the alert) → submit → tracked
     under Account.
   - **Severity is grey** — link to `/spaces?node=…` (Unit › Now) — last
     seen, what's missing, what it affects.

**Status: complete.** `client/Alerts.tsx` is fully built (needs-action /
watching / resolved bands including grey, space + part-group filters,
per-channel delivery state). `~4–6 clicks, under 2 minutes.`

## UF-03 — The savings claim and its provenance

**Role:** Client · Admin · **Goal:** The client sees what the solution
saved against what the bill would otherwise have been, and reaches the
method behind that number in one tap.

1. `/home` — dark hero, "Avoided emissions this month."
2. `/insights` (nav "Insights") — power now, kWh today/this month, cost at
   tariff.
3. "How this was calculated" → `/insights?method=…` — baseline model,
   version, effective date, tariff, grid factor.
4. Back to Insights → "Saving vs normal" section, attributed by lever (Eco
   mode, setpoint, schedule, occupancy, filter cleaning), each with a
   next-action link.
5. `/insights/carbon` (same period selector) — Scope 2 and avoided
   emissions, never sharing a card with CO₂ ppm.

**Status: complete, with one honest deviation.** The flow diagram's own
`decisions` field says a lever "opens the confirmation sheet" (→ UF-07); in
the built app the lever buttons route to a general destination (`/spaces` or
`/alerts`) rather than a specific unit's control sheet — you land on a real,
working screen, just not the exact deep link the diagram implies. Everything
else — method link, both period views, the CO₂/kgCO₂e separation — is built.
Admin side: `/reporting` is the equivalent (`EnergyPortfolio.tsx`, now
drawing a real categorical chart rather than the earlier placeholder).
**~6–8 clicks, under 3 minutes.**

## UF-04 — Comfort, air quality and the filter

**Role:** Client · **Goal:** Stale air and a dirty filter are caught early,
and the interface stays honest about what a split unit can and cannot do
about either.

1. `/spaces` → a room → Space › Now (`shared.space`) — CO₂, humidity, PM2.5
   in plain-language bands, or a grey "not fitted" state naming the missing
   sensor (never green for a sensor that doesn't exist).
2. No ventilation device connected → a manual-action card ("a split unit
   recirculates air — open a window"), alert stays until CO₂ falls.
3. Separately: filter pressure drop fires the filter-health rule → open the
   unit → Health view → the Air Filter part row (now with its own drawn
   glyph, not a bare list item) — evidence, effect on the bill, "Request a
   filter visit" action → joins UF-02's self-service/service-request fork.

**Status: complete.** `Space.tsx` and `Unit.tsx`'s Health view (with the
12-part glyph set built this session) both cover this. **~5–7 clicks.**

## UF-05 — Technician: from queue to closure

**Role:** Technician (internal and third-party) · **Goal:** The technician
knows the likely fault before arriving, proves or disproves it with
evidence, and closes with a check that the fix worked.

1. `/work` — Today's queue, critical first then SLA risk then age (now a
   `PriorityList` with real KPI tiles: Critical / Today / This week / Silent
   units).
2. Open a job → `/work?order=…` — Work order › Brief: suspected fault,
   confidence, unit history.
3. Evidence view — signals at trigger time, trends, part group.
4. Checklist view — indoor/outdoor/electrical, measurements and photos,
   pass/fail/N/A per item.
5. Verdict → Findings (repair, parts, notes) _or_ "sensor/data-quality
   issue" _or_ escalate with evidence.
6. Closure → post-service check — readings compared against the alert
   window → closed (client confirms) or reopened if not improved.

**Status: complete — the best-built object in the app.** All five views are
real and interactive, not display-only. Third-party scope is enforced on
the object (a third-party technician only ever sees their own assigned
orders). **~8–10 clicks across a full job, under 3 minutes for the happy
path.**

## UF-06 — Payment-linked restriction (the governed ladder)

**Role:** Admin/HQ · **Goal:** A rent-to-own customer stops paying. Service
is stepped down proportionately, reversibly, with a record of who decided
what.

1. `/accounts` (Accounts › Payments) — overdue / in grace / restricted /
   dispute standing, per site.
2. From here the flow calls for opening a **Restriction case**
   (`admin.restriction-case`, one object for the whole ladder: evidence,
   consent, notice history, state, timers, approvals, audit) and, at each
   rung, a **gate** (`shared.approve` — notice, grace, two approvals).

**Status (updated 2026-09-19): the case object now exists; the approval gate
still does not.** `admin.restriction-case` is built and reachable by click
from two entry points — the Overview's "Restrictions in force" rows and
Payments' per-account "Open case" links, both landing on
`/accounts/case?property=…`. It carries the whole ladder (each rung marked
passed / in force / not reached / blocked, with a severity badge only on the
rung actually in force), the grace timer, the decision record
(requester + approver + time) and the notice-delivery trail as the evidence
of consent. The `stop` rung renders visibly blocked on a health-sensitive
space, which is the FR-53 safety guarantee made visible rather than asserted.

**Step 2's gate now exists too.** ADR-0015 closed OD-01, OD-02 and OD-04 on
2026-09-19, which unblocked `shared.approve` (P-APPROVE) at
`/accounts/approve`. It is reachable two ways: the "Waiting on a decision"
group that now sits **first** on Overview's Decisions needed, and its own
queue at `/accounts/approve`. One request shows the ask (which rung, from
which), the requester, the lapse time, the evidence (balance with its
provenance, days overdue, the delivered-notice trail) and — above the
buttons, always — the health-sensitive check.

The governance is enforced in the adapter, not the screen, so it cannot be
skipped by a second surface:

- a `stop` on a health-sensitive space **cannot be approved** — the approve
  action is not offered, the refusal is stated, and declining stays available
  so the request is still answerable rather than stuck;
- a `stop` elsewhere needs a **named management sign-off**; approving without
  one is refused and the refusal renders;
- the ladder is climbed **one rung at a time**; a jump is refused.

**So UF-06 now runs end to end.** Sign in as HQ → Decisions needed → a waiting
approval → read the evidence and the health check → approve (with a sign-off
where the rung demands one) or decline with a reason → the decision record
names who decided, when, and on what grounds. `~4 clicks, completes.`

## UF-07 — Remote command lifecycle

**Role:** Client · Admin · **Goal:** A tap on a control becomes a change at
the machine, or an honest statement that it did not.

1. Open a unit → Control view (`?view=control`) — current mode/fan/setpoint,
   any policy limit.
2. Change mode/setpoint/fan → "Send command" → confirmation sheet: target
   vs current value.
3. Confirm → state becomes **Sent**.

**Status (updated 2026-09-19): the pipeline is now drawn; it still does not
advance live.** The Control view now renders the Sent → Acknowledged →
Verified pipeline explicitly, with the rung a command honestly reached
filled, the current rung carrying `aria-current="step"`, and the `failed` /
`queued` branches shown as what they are — `failed` breaks the pipeline
rather than guessing how far the command got, and `queued` states that the
device is unreachable and the command is held, with its time.

What has **not** changed is live progression: `sendCommand()` in
`src/lib/simulation/adapter.ts:264` still returns one static state with no
timer or poll, so a command you issue yourself in this session does not walk
the pipeline. Acknowledged and Verified are still only reachable as
pre-seeded states on other units (`unit-study-1` is acknowledged,
`unit-dining-1` failed, `unit-attic-1` queued).

**Demo-able as "here is the pipeline, here is where this unit's command
got to, and here is what a failure and a hold look like" — an honest
picture of the mechanic, but not one continuous live journey. ~3–4 clicks
to Sent.** Whether live progression is needed for Phase 1A is an open
scope question, below.

## UF-08 — Carbon: Scope 2, MRV and the platform

**Role:** Admin/HQ · Client · **Goal:** Metered energy becomes a defensible
emissions figure, then an audit-ready package, and only then anything
tradable.

1. `/reporting` — Scope 2 = kWh × versioned grid factor; avoided = saved kWh
   × grid factor, both against the adjusted baseline; completeness gap named
   if under 90%.
2. `/reporting/packages` (`admin.mrv`) — MRV package: coverage, gaps,
   provenance per series, dual-approval export.
3. Client side: `/insights/carbon` shows the same figures and labels.

**Status: completes structurally**, including the dual-approval gate
(genuinely built, two-step approve-then-export). One caveat carried over
from the concurrent accessibility fixes: the gate's feedback (did the first
approval register? did the export complete?) is being fixed for screen
readers in that batch — sighted completion of this journey was never
blocked, only the non-visual account of it. **~5–6 clicks.**

## UF-09 — Device trust: offline, power loss and tamper _(bonus, not counted in the eight)_

**Role:** Admin · Technician · Client · **Goal:** The hidden gadget stops
reporting. Everyone who depends on it learns the truth quickly, and nothing
is painted green for a machine nobody can see.

1. Heartbeat missed / enclosure opened / power loss → classified offline,
   power-loss, or possible-tamper.
2. Grey propagates up the hierarchy (room → floor → property → portfolio) —
   client sees "no data since …" on the affected unit.
3. The flow calls for a dedicated **Device** view: "Fleet › Devices for HQ,
   Work › Silent units for the technician" (`shared.device`).

**Status: partially built, asymmetric by role — and the missing half is now a
recorded scope cut, not an open gap.** The _technician_ half works: the Work
queue groups a "Silent units" section. Tamper is correctly detected and
alerted (its own banner on the unit, its own alert category), which is what
FR-83's Must-level statement actually asks for, and that is satisfied.

The _HQ_ half — a fleet-wide browsable device-health list — is **not built,
and `shared.device` / `shared.maintenance-mode` were cut from Phase 1A on
2026-09-19** (product owner). The reason is data, not effort:
`Unit.device` carries only `online`, `lastHeartbeat`, `tamperSuspected` and
`maintenanceMode`. Firmware, buffered data, power-loss detail and install
evidence — most of what the flow's Device view promises — do not exist in the
model, and setting maintenance mode needs an adapter method that was never
written. Building the screen anyway would mean either fabricating those fields
or shipping a thin page repeating what `shared.unit`'s header already shows.

**So: client and technician sides reach a working stop. The HQ side stops at
a static count, deliberately.** If a device surface is wanted later, the
genuinely useful one is the fleet-wide silent/tampered/maintenance list —
buildable from data that exists today, and the honest scope of what "Fleet ›
Devices" can mean in 1A. See `context/requirements/requirements.json`
(`shared.device`, `status: cut-1a`).

## UF-10 — The deep-linked approval: HQ away from a desk _(bonus, not counted in the eight)_

**Role:** Admin/HQ, phone · **Goal:** The one thing HQ genuinely cannot
postpone gets done from a phone. Everything else waits for a desk, and
says so plainly.

1. Notice on a phone → `/overview` ("Decisions needed," A-1.1 — the only HQ
   list meant to exist at 375px).
2. Branch on what arrived: a restriction-case approval (→ UF-06, **blocked**
   as above) _or_ a critical event → Dispatch (`P-ASSIGN`, real) _or_
   anything else opens read-only with "continue on desktop."

**Status: the premise itself is currently false below 768px.** `/overview`
renders correctly at any width (verified — the four-KPI-tile + PriorityList
composition this session built is responsive). But the flow's own
`decisions` text says "everything else opens read-only and names the
desktop" — implying HQ _can navigate_ to that read-only state. As of this
doc, `RoleShell` gives admin **no navigation at all below 768px**
(`.sideNav { display: none }`, and admin is explicitly excluded from the
mobile tab bar), including on `/overview` itself, where the one hint that
would explain this is gated to _other_ routes and never fires. This is one
of the four accessibility blockers landing concurrently with this doc — it
may be a deliberate D2 call that just needs its hint fixed, or a genuine
bug; either way, as of right now, an HQ user on a phone who isn't opening a
direct notice link has no way to reach `/overview` navigation at all except
the URL bar. The three-actions promise itself (approve/acknowledge/dispatch)
partially holds — Dispatch is real, approve is blocked by UF-06.

---

## Timing against the ten-minute bar

Summing only the **original eight** (UF-01–08): UF-01 (~1 min) + UF-02
(~2 min) + UF-03 (~3 min) + UF-04 (~2 min) + UF-05 (~3 min) + UF-06
(**breaks at ~30 sec, can't complete**) + UF-07 (**reaches Sent in
~1 min, can't complete live**) + UF-08 (~2 min) ≈ **14–15 minutes if
UF-06/UF-07 are demoed to their real stopping points and narrated rather
than skipped, or under 10 minutes if UF-06 and UF-07 are cut from the walk-
through until FR-52 and live command progression exist.** The five that
complete cleanly (UF-01, 02, 04, 05, 08) fit comfortably inside 10 minutes
on their own.

## Not done

- UF-06 **now completes** (2026-09-19). ADR-0015 closed OD-01/OD-02/OD-04 and
  `shared.approve` was built on top: the case reads, the gate decides, and the
  refusals (health-sensitive `stop`, missing sign-off, rung jump) are enforced
  in the adapter rather than the screen.
- UF-07 **now completes live** (2026-09-19). `sendCommand` walks
  Sent → Acknowledged → Verified and the Control view ticks it explicitly
  (`advanceCommand`), because the simulator's clock is fixed and a purely
  time-derived state would sit on Sent forever. `failed` and `queued` are
  still honest and are never advanced.
- UF-09's HQ half (Fleet › Devices) doesn't exist and **is now a recorded
  scope cut**, not an open gap — `shared.device` and
  `shared.maintenance-mode` were cut from Phase 1A on 2026-09-19 because the
  data model carries only 4 of the ~8 fields they promise, and the setter
  needs an adapter method that was never written. FR-83's Must-level
  statement (tamper detected and alerted on its own) is satisfied elsewhere.
- UF-10's own premise (a read-only "continue on desktop" HQ experience
  below 768px) currently can't be reached via navigation at all — only a
  direct deep link works, which is narrower than the flow describes.

## Decisions

- Treated "the eight" as UF-01–08 specifically, per the D2 sitemap's own
  verbatim statement, rather than picking any eight of the ten — this is
  stated fact from the source document, not a judgement call.
- Reported UF-06 and UF-07 as not completing rather than describing the
  intended-but-unbuilt path as if it worked — a journey doc that describes
  a path that doesn't exist is worse than no doc.

## Open questions

- Is UF-07's live command progression (Sent → Acknowledged → Verified on a
  timer) actually required for the Phase 1A demo, or is "shown via
  pre-seeded historical examples" an acceptable substitute? This changes
  whether it's a Milestone-2 task or a documented scope cut.
- Is HQ's lack of mobile navigation (UF-10) deliberate (needs an ADR) or a
  bug (needs a fix)? Affects whether UF-10 is "not done" or "done, just
  undocumented as intentional."

## Verify

No `npm run verify` applies — this is a documentation-only change. Verification
method: every route and nav label cited above was checked by hand against
`src/routes/catalog.ts` and `src/routes/navigation.ts` as of 2026-09-19, and
re-checked once more after the first draft before this file was saved.
