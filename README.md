# ARUSIQ Smart AC Intelligence Platform — Phase 1A

Clickable UI/UX prototype for split-unit air conditioners, on labelled simulated
data. Three role dashboards (Client · Technician · Admin/HQ), English and Bahasa
Indonesia. React 19 + TypeScript + Vite.

```bash
npm install
npm run dev        # http://localhost:5173
npm run verify     # the gate — run before every handoff
npm run trace      # requirement → code coverage
```

Requires **Node 22+** (the verifiers use `fs.globSync`).

## Repository map

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Agent router and the twelve non-negotiables. Start here. |
| `context/` | The distilled context pack — `00-INDEX.md` is the map |
| `context/requirements/requirements.json` | Machine-readable Phase 1A scope: 39 FRs, 24 screens, 14 invariants |
| `context/decisions/` | ADRs, including two adjudicated document conflicts |
| `src/design-system/` | Tokens. Owned; an ADR is required to change them |
| `src/lib/simulation/` | All simulated telemetry. The Phase 1B seam |
| `tools/` | The verification gate |
| `docs/` | Source documents (D5 URS, D6 PRD, D7 UI Guideline, D8 review) |
| `.claude/`, `.cursor/` | Agent definitions, commands, hooks, scoped rules |

## The gate

`npm run verify` runs seven checks in order of cost:

| Check | Enforces |
| --- | --- |
| `contrast` | Every colour token clears WCAG against all four legal surfaces |
| `tokens` | No raw hex, px, z-index; no layout transitions; no dark mode |
| `provenance` | Every figure declares its origin; ppm and kgCO₂e stay separated |
| `i18n` | No hardcoded strings, no concatenated formats, no English-sized controls |
| `types` · `lint` | TypeScript, ESLint |
| `trace` | Requirement → code coverage (reports; `--strict` to block) |

`npm run build` runs it first. These are not style preferences — each maps to a
requirement in D5/D6/D7 and is cited in the tool that enforces it.

## Working here

Read `CLAUDE.md`, then the one context file your task needs. Do not load the
whole pack, and do not read the PDFs unless the pack is genuinely missing
something — in which case distil what you learned back into the pack in the same
PR.
