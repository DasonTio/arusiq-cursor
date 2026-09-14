# Architecture and file ownership

## Layout

```
src/
  design-system/     tokens.css · tokens.ts        ← OWNED. ADR required to change.
  components/        primitives shared by every role (Button, Textfield, Metric,
                     SeverityIndicator, ProvenanceChip, …)
  patterns/          the 14 product patterns (UnitCard, AlertWithEvidence,
                     RestrictionBanner, CommandControl, SavingsChart, …)
  features/
    auth/  client/  technician/  admin/            ← one owner each, see below
  lib/
    simulation/      ALL fake telemetry. The Phase 1B seam.
    i18n/            locale packs: en.json, id.json
    domain/          severity, rollUp, provenance, restriction — pure functions
  routes/            route table + role guards
tools/               the verification gate
context/             this pack
docs/                source documents. Authoritative, rarely read.
```

## Dependency direction

```
features → patterns → components → design-system
   ↓                                     ↑
  lib/domain, lib/simulation, lib/i18n ──┘
```

Never upward. A component that imports from `features/` is a component in the
wrong place. `lib/domain` imports nothing but `design-system/tokens.ts`.

## The simulation seam — the most important architectural decision here

Phase 1A runs on simulated data; Phase 1B swaps in real telemetry, and **the
screens must not change when it does**. That only holds if every fake reading
enters through one door.

- All simulated data lives in `src/lib/simulation/`, behind a typed adapter
  interface that mirrors the eventual API shape.
- **Never inline a fake reading into a component.** A hardcoded `28.5` in JSX is
  an invisible landmine: it survives the 1B migration and quietly reports a
  measurement nobody is metering.
- Every value the simulator emits is stamped `provenance: 'simulated'` **at the
  source**. Provenance is a property of the data, not a decoration the UI adds.
- Simulate the *unhappy* paths too — offline units, stale readings, missing
  sensors, failed commands, queued commands. A prototype where everything is
  green demonstrates nothing, and `unknown` is a first-class state that needs to
  be visible in the demo.

## Day-1 tasks, in order

The repo is a bare Vite scaffold plus this harness. These come before feature
work, and each unblocks several agents at once:

1. **i18n runtime** + `en.json` / `id.json` scaffolding. Every subsequent screen
   depends on it, and retrofitting `t()` across built screens is pure waste.
2. **Router** + role guards + the four role shells (bottom tabs / rail / sidebar).
3. **`lib/domain`** — severity, `rollUp`, provenance, restriction ladder,
   command lifecycle. Pure functions, unit-tested. Everything else consumes them.
4. **`lib/simulation`** — the asset tree, twelve parts per unit, telemetry
   generator including the unhappy paths.
5. **Core primitives** — `SeverityIndicator`, `ProvenanceChip`, `Metric`,
   `Button`, `Textfield`. Nothing in `features/` starts before these exist, or
   four agents will build four severity dots.
6. Then, and only then, screens.

## File ownership during the sprint

Parallel agents fail on write conflicts long before they fail on reasoning. So
ownership is by **directory, not by feature description**:

| Area | Owner | Everyone else |
| --- | --- | --- |
| `src/design-system/` | design-system agent | read-only; request via ADR |
| `src/components/`, `src/patterns/` | design-system agent | read-only; request additions |
| `src/lib/domain/`, `src/lib/simulation/` | platform agent | read-only |
| `src/lib/i18n/*.json` | **append-only for everyone** | add keys, never edit others' |
| `src/features/<role>/` | that role's feature agent | hands off |
| `tools/`, `context/` | whoever is doing harness work | propose, don't silently edit |

Locale files are the one shared write surface, and they are append-only for a
reason: two agents editing `en.json` simultaneously is the single most likely
merge conflict in this project.

## Conventions

- Every file implementing a requirement opens with a docblock carrying
  `@requirement FR-xx` (space-separated for several). `npm run trace` reads it.
- Components are function declarations, not arrow consts — they are easier to
  find in a stack trace and they hoist.
- Props interfaces are exported and named `<Component>Props`.
- No default exports except route-level screens.
- Domain logic never lives in a component. If a component contains a comparison
  between two severities, that comparison belongs in `lib/domain`.
- Tests sit beside the code. `lib/domain` needs real unit tests: `rollUp`,
  `weakestProvenance` and `isStepPermitted` are the three functions where a
  quiet bug becomes a false claim on a stakeholder's screen.
