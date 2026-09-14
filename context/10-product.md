# Product context

## One line

Monitor every aspect of the air conditioner, fix problems before they happen,
cut energy bills by 10–20 %, and prove the carbon saved.

## The premise

A small, cheap module hidden **inside** the air conditioner turns any brand of
unit into a monitored asset. Everything else the product does — the alerts, the
bill, the carbon, the service call — is derived from what that module reports.

## What Phase 1A actually is

A **clickable prototype** of the three role applications, running on simulated
telemetry, delivered in a two-week sprint. It exists to be shown to
stakeholders and to pass a Stage 2 go/no-go.

It is not a demo of screens. It is a demo of _judgement_: the value of this
prototype is that it shows the responsible version of a dangerous feature
(cutting off someone's air conditioning) and the honest version of a commercial
claim (carbon savings). Both of those live entirely in the interface.

Out of scope: real devices, real notifications, real payments, a backend,
registry-grade carbon credits, HVAC, dark mode.

## The four roles and the question each opens on

Roles differ in **emphasis, not in components**. One design system, one asset
hierarchy, four entry points.

| Role                      | Opens on                                                      | Scope                                                 |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| **Client**                | _Is my home comfortable, and what is it costing me?_          | Own spaces                                            |
| **Technician, internal**  | _What do I fix first, and what will I find when I get there?_ | Assigned customers, sites, units                      |
| **Technician, 3rd party** | Same — limited strictly to assigned work                      | Assigned work orders only, **enforced in navigation** |
| **Admin / HQ**            | _What needs me today, across the whole fleet?_                | All                                                   |

Each dashboard opens on **the decision that role owns**, not on a wall of data.
That is also the fastest route to the stated goal: a new user answers "what
needs attention" in under 60 seconds.

## The three claims the product has to defend

Everything else is plumbing. These three are where an unconsidered interface
does real damage:

**1. "We can tell you what is wrong before it breaks."**
A prediction is labelled **suspected** until a technician verdict. Every alert
carries its evidence — signals, thresholds, how long the condition has
persisted, confidence, likely cause, impact if ignored, and a recommended
action rendered as a control the user can press.

**2. "We can restrict cooling when you don't pay."**
Taken literally that is a switch. Specified responsibly it is a **ladder**:
reminder → warmer minimum setpoint → Eco lock and limited hours → off. Notice,
grace period and dual approval at every step. `Off` is never available for
health-sensitive spaces. Service restores automatically on payment and is
verified at the device, and a dispute pauses escalation until a person answers.
The legal basis does not exist yet, so Phase 1A demonstrates a **labelled
simulation** of the governed process.

**3. "We saved you 10–20 %, and here is the carbon."**
Every savings figure is a comparison against a counterfactual — what the unit
_would_ have consumed. The method behind that counterfactual is published,
versioned and dated inside the product, and the savings chart is not permitted
without a link to it. Avoided emissions are not carbon credits until an
independent verifier says so, so the word _credit_ does not appear in Phase 1A.

## Known limits — say them, don't design around them

- **No legal basis yet** for payment-linked restriction. Labelled simulation only.
- **A split unit recirculates air.** It cannot bring in fresh air. The interface
  may _recommend_ ventilation; it never _claims_ fresh-air control for a split
  unit alone. The recommendation and the capability are two different
  components, and the second appears only when the hardware is present.
- **No registry route for credits.** Scope 2 reporting is what gets sold first.
- **Voice recognition in Bahasa Indonesia is unproven.** Text is equally capable
  by requirement, so poor recognition degrades convenience, not capability. The
  text fallback and the visible transcript are always present.

## Two decisions still open

Both are cheap to decide now and expensive to retrofit; both change FR-52/FR-53.
Tracked as `openDecisions` in `requirements.json`, surfaced by `npm run trace`.

1. Who may flag a space as **health-sensitive**? It blocks the `stop` step.
2. **One or two approvers** at each restriction step?
