# Domain model

Names here are **binding**. If code calls it something else, the code is wrong —
a shared vocabulary is the cheapest coordination mechanism a multi-agent project
has, and renaming later costs more than agreeing now.

## Asset hierarchy

```
category (home | office)
  └── property
        └── floor / area
              └── room / space
                    └── unit          ← one air conditioner
                          └── part    ← one of twelve monitored components
```

Every level shows the **worst status of its children**, with the contributing
count alongside — `"2 of 14 need attention"` — so a roll-up is inspectable
rather than a bare colour. Breadcrumbs represent this hierarchy, and each
breadcrumb level carries its own roll-up severity.

## Severity — the core mechanic

Four levels, three channels. **Colour never travels alone.**

| Level  | Domain value | Shape       | Means                                      | Leads to           |
| ------ | ------------ | ----------- | ------------------------------------------ | ------------------ |
| Red    | `critical`   | square      | Failing now, or about to                   | Act now            |
| Orange | `warning`    | triangle    | Degrading; still works, won't keep working | Plan action        |
| Grey   | `unknown`    | dashed ring | Offline, no sensor, or too stale to trust  | Restore visibility |
| Green  | `normal`     | circle      | Within the expected envelope               | Nothing            |

**Roll-up precedence: `critical > warning > unknown > normal`.** Grey outranks
green because an unknown unit may be the broken one. Use `rollUp()` from
`src/design-system/tokens.ts` — do not re-implement the comparison.

The stakeholder asked for three colours. The fourth is mandatory: a sensor that
has gone quiet is not healthy, and painting it green would be a lie the whole
product is judged on.

`suspected` is **not** a fifth severity. It is a modifier on an alert, rendered
as a **dashed border** — the severity colour is already carrying severity.

## The twelve monitored parts

"Monitor every aspect" is an enumerated list, not a slogan. Each part carries
its own health, its own evidence and its own recommended action. Canonical IDs
and signals are in `requirements.json → monitoredParts`.

- **Indoor (5)** — air filter · evaporator coil · blower motor & fan ·
  condensate drain & pan · vents & louvers
- **Outdoor (4)** — condenser coil · compressor · condenser fan & blades ·
  refrigerant lines
- **Electrical & control (3)** — thermostat & sensors · capacitor & contactor ·
  electrical wiring

Two classes of signal, and they render differently:

- **Acute** — vibration outside the learned envelope, discharge temperature
  rising against ambient, superheat/subcooling falling. Names the part it
  implicates and the measurement that triggered it.
- **Slow** — a gradual charge decline consistent with a microscopic leak; rising
  pressure drop consistent with fouling. Reported as a **trend with a projected
  failure date and a confidence band**, not as a threshold breach.

## Provenance

Four labels, and every figure in the product carries one. Ranked, because an
**aggregate inherits the weakest provenance of its inputs** — one simulated
reading makes the whole total simulated. Use `weakestProvenance()`.

| Label         | Applies to                                           |
| ------------- | ---------------------------------------------------- |
| `simulated`   | Every telemetry value in Phase 1A                    |
| `estimated`   | Avoided emissions and savings before verification    |
| `provisional` | MRV packages below 90 % completeness                 |
| `verified`    | Independently verified under an accepted methodology |

`verified` is the only label under which the word **credit** is permissible.
Phase 1A has no verified data, so the word does not appear anywhere.

## Command lifecycle

A control is not a toggle that flips. The interface distinguishes _we asked_
from _the machine did it_.

`sent → acknowledged → verified` · plus `failed` and `queued` (offline).

Only `verified` settles the control into its new position. The confirmation
shows **target value, current value, and any policy limit in force** — a
setpoint that the restriction ladder is capping says so at the moment of the
attempt, not afterwards.

## Restriction ladder

| Step | Action                | Effect on cooling                               |
| ---- | --------------------- | ----------------------------------------------- |
| 1    | `reminder`            | None                                            |
| 2    | `setpointRaised`      | Still cools, warmer floor (e.g. 26 °C)          |
| 3    | `ecoLockLimitedHours` | Mode fixed to Eco, operating window reduced     |
| 4    | `stop`                | Stops — **blocked for health-sensitive spaces** |

Each step renders as a **persistent banner on the affected unit** — not a
dismissible toast — carrying the step, the reason, the grace period remaining
and a pay action. Every step shows requester, approver and timestamp to Admin.

## The two carbon numbers

They share a chemical symbol and nothing else. Separate cards, distinct labels,
distinct icons, never a shared axis, never added together.

|                   | Measures                             | Unit     | Accent |
| ----------------- | ------------------------------------ | -------- | ------ |
| **Air freshness** | Indoor CO₂ concentration in the room | `ppm`    | Info   |
| **Emissions**     | Greenhouse gas from electricity used | `kgCO₂e` | Eco    |

Carbon lifecycle: `metered kWh → × versioned grid factor → Scope 2 emissions →
MRV package → verified reduction → offset/exchange`. **The grid factor is
displayed, not hidden** — a carbon figure without its factor is unauditable.

## Device trust

Tamper is `critical` severity but a **different category** from a mechanical
fault. A technician dispatched for a tamper alert needs different information
than one dispatched for a failing compressor, so tamper has its own icon and its
own filter and does not dissolve into the maintenance queue. Maintenance mode
suppresses these alerts during planned service.

## Four states that are not interchangeable

Confusing the last two is how a dashboard comes to imply that a unit consumed
0 kWh when it was simply offline.

| State     | Means                        | Treatment                                                                   |
| --------- | ---------------------------- | --------------------------------------------------------------------------- |
| `loading` | Request in flight            | Skeletons matching the final layout — never a spinner over a blank page     |
| `empty`   | Nothing exists yet           | Explain what would appear, offer the action that creates the first one      |
| `error`   | The request failed           | Say what failed, offer a retry                                              |
| `noData`  | Exists, but has not reported | **Grey severity with a last-seen time.** Never an empty state, never a zero |
