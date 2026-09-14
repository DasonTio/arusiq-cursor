# ADR-0004 · Simulated data is an adapter, not a fixture

**Status** Accepted · 2026-09-13 · **Reverse cost** low if held from day one, very high later

## Context

Phase 1A runs entirely on simulated telemetry. Phase 1B replaces it with real
ingestion. The stated intent is that *"nothing drawn here is thrown away"* — the
screens must survive the swap untouched.

## Decision

All simulated data enters through a **typed adapter** in `src/lib/simulation/`
whose interface mirrors the eventual API shape. Components consume the adapter.
No component ever contains a literal reading.

Every value the simulator emits carries `provenance: 'simulated'` **stamped at
the source**.

## Why provenance belongs to the data, not the UI

D6's data-integrity NFR requires 100 % of figures to be labelled, and D8 adds
that an aggregate inherits the weakest provenance of its inputs. Both are
properties of a *value*, not of a *tile*. If the UI applies the label, then:

- every new screen is a fresh chance to forget it;
- aggregates cannot compute their own provenance, because the inputs have lost it;
- the 1B migration has to find and remove every hardcoded `"Simulated"` chip.

Carrying it on the value makes `weakestProvenance()` mechanical and makes the
migration a change of adapter rather than a sweep of the UI.

## Simulate the unhappy paths

A prototype where every unit is green demonstrates nothing. The simulator
deliberately emits offline units, stale readings, absent sensors, failed
commands, queued commands, a tamper event and a unit in each restriction step.

`unknown` is a first-class state that exists specifically because the interview
did not ask for it, and the product is judged on handling it honestly. It has to
be visible in the demo, not merely implemented.

## Consequences

- `src/lib/simulation/` is owned by the platform agent; feature agents read it.
- A hardcoded reading in a component is a review rejection, not a nit — it
  survives the 1B migration and silently reports a measurement nobody meters.
- The adapter interface is written **before** the screens, so it is shaped by
  the eventual API rather than by whatever the first screen found convenient.
