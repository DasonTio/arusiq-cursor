# ARUSIQ Smart AC Intelligence Platform — Phase 1A

Clickable UI/UX prototype for split-unit air conditioners, on **labelled
simulated data**. Three role dashboards. English + Bahasa Indonesia. Two-week
sprint. React 19 + TypeScript + Vite.

> This file is a **router**, not a specification. It is loaded into every
> session, so it stays short on purpose. Load the context file you need for the
> task in front of you — do not load them all.

## Where to look

| Question                                               | File                                     |
| ------------------------------------------------------ | ---------------------------------------- |
| What are we building, for whom, and why                | `context/10-product.md`                  |
| Domain model: severity, parts, roles, hierarchy        | `context/20-domain.md`                   |
| Any visual decision — colour, type, spacing, component | `context/30-design-system.md`            |
| Where code goes, who owns which files                  | `context/40-architecture.md`             |
| Working alongside other agents                         | `context/50-agent-protocol.md`           |
| Is this finished?                                      | `context/60-definition-of-done.md`       |
| Exact requirement text, screen→FR map, invariants      | `context/requirements/requirements.json` |
| Why a contested call was made the way it was           | `context/decisions/` (10 ADRs)           |
| Prop contracts for every primitive                     | `src/components/contracts.ts`            |
| Source of truth, when the above disagree               | `docs/*.pdf`, `docs/*.docx`              |

`context/00-INDEX.md` has the full map with token costs.

## The gate

```
npm run verify        # self-test · contrast · tokens · provenance · i18n
                      # · types · lint · tests · trace
npm run new:screen <id>   # scaffold a screen from its requirements
npm run trace             # requirement → code coverage
```

**Run it before you report work as done.** It is not advisory; `npm run build`
runs it first. If a check is wrong, fix the check in `tools/` and say so in the
PR — do not add an exemption comment to route around it.

## Non-negotiables

These are invariants, not preferences. Each is in `requirements.json` with its
source document and the tool that enforces it. Breaking one is a defect even if
the screen looks right.

1. **Every figure carries provenance** — Simulated | Estimated | Provisional |
   Verified, beside the figure, never in a page footer. An aggregate inherits
   the _weakest_ provenance of its inputs.
2. **Severity is colour + shape + label.** Never a bare coloured dot, including
   in charts. Roll-up precedence is `critical > warning > unknown > normal`.
3. **Grey is not a pass.** It means "we do not know", always carries a last-seen
   time, and never counts as green in a roll-up.
4. **Never fabricate a value.** Missing is not zero. An absent sensor is stated
   as absent; an unreported unit is grey, not `0 kWh`.
5. **Indoor CO₂ ppm and kgCO₂e emissions never share a card**, an axis, an icon
   or a tile group. They share a chemical symbol and nothing else.
6. **The word "credit" is Verified-only** — and Phase 1A has no verified data,
   so the word does not appear. Say _avoided emissions_.
7. **Restriction is a ladder, never a switch.** Notice → grace → dual approval
   at every step. `stop` is unreachable for health-sensitive spaces. If the
   interface presents step 4 as one toggle, the safety policy is not
   implemented regardless of what the backend does.
8. **A command is not a toggle that flips.** Sent → Acknowledged → Verified;
   only Verified settles the control into its new position.
9. **No hardcoded user-facing strings.** Numbers, currency and dates come from
   the locale, never concatenation. Indonesian runs 20–30 % longer — never size
   a control to its English label.
10. **No screen is a dead end.** Every alert leads to an action.
11. **Mark the mock as a mock.** An unlabelled screen of a system that does not
    exist yet will be mistaken for one that does.
12. **Light mode only.** A dark theme nobody has designed looks supported and
    is not.

## How to work here

- **Implement against the contracts.** `src/components/contracts.ts` holds the
  prop interfaces for every primitive. They are deliberately strict — a figure
  without provenance, a chart without a text alternative or a route without
  `allowedRoles` does not compile. Do not loosen one to make a screen easier.
- **Read before you write.** `context/30-design-system.md` before any UI;
  `requirements.json` before any feature. Guessing at a value that is already
  specified is the most expensive mistake available in this repo.
- **Tokens only.** No raw hex, no raw px, no raw z-index. `src/design-system/`
  is owned by the design system; feature agents do not edit it. Changing a
  token requires an ADR.
- **Tag your work.** Every file implementing a requirement carries
  `@requirement FR-xx` in its header docblock. `npm run trace` turns the sprint
  into a number instead of a feeling.
- **Simulated data lives behind `src/lib/simulation/`.** Never inline a fake
  reading into a component. Phase 1B swaps the adapter, not the screens.
- **When docs disagree, stop and write an ADR.** Do not silently pick. D5, D6,
  D7 and D8 genuinely conflict in two places, and D2's sitemap and D7 in a
  third — all three are recorded in `context/decisions/`.
- **State what you did not do.** A half-built screen reported as done is worse
  than an unbuilt one, because nobody checks it again.

## Scope discipline

Phase 1A is a **prototype on simulated data**. Out of scope: real devices, real
notifications, real payments, registry-grade credits, HVAC, dark mode, a backend.
Features marked `MOCKED` or `SIMULATED` in `requirements.json` are built as
convincing, clearly-labelled simulations — not as TODO stubs, and not as real
integrations.
