# Handoff — design refactor complete; three D7 §20 gaps closed; one live bug fixed

**Written** 2026-09-19 · **Status** ephemeral — delete once you've read it and
the next task is underway. Durable state lives in `CLAUDE.md`, `context/`,
and the ADRs.

## Why this handoff exists

This continues (and finishes) the 2026-09-19 design refactor. The prior
handoff (`2026-09-19-design-refactor.md`, now deleted per its own
instructions) covered Tasks B–E: recomposing the four archetype screens
(client Overview, admin Overview, shared Unit, shared WorkOrder) onto a new
`src/patterns/` library. That work is done. This session then:

1. Swept **every remaining destination screen** in the app onto the same
   pattern library.
2. Closed the two remaining genuinely-undrawn D7 §20 design gaps (the
   part-health diagram and the categorical chart ramp) — token/primitive work
   done by `design-system-guardian`, wired into features by the coordinator.
3. Did a live browser QA pass (not just tests) across all three roles and
   found **one real, user-facing bug** — fixed and regression-tested.

Everything below is either done-and-verified, or an explicit, deliberate
non-goal with its reasoning. There is no unfinished code-side design work
left for Phase 1A. What's left is three product decisions that are not
design's to make.

## State of the world (verified 2026-09-19)

- `npm run verify` **passes**: 256 tests (38 files), Must 31/31, Should 8/8,
  contrast 40/40 (includes the new CIEDE2000 categorical-ramp checks),
  tokens/provenance/i18n clean.
- Dev server confirmed working (`npm run dev`), QA'd live in a real browser
  across client/technician/admin roles — no console errors on any screen
  visited.

### Pattern library (`src/patterns/`)

`PageHeader`, `SectionHeader`, `MetricGrid`+`MetricTile`, `QuickActions`,
`PriorityList`, `CategoricalChart` (new this session). Every destination
screen in `src/features/` now imports from here — confirmed by grep, the
only files that don't are genuine panels (`Assign`, `Assistant`,
`LanguageSwitch`, `Method`, `NotAvailable`, `Pay`, `Profile`, `RoleShell`,
`Search`, `ServiceRequest`, `ViewTabs`) and the two auth screens
(`SignIn`, `ForgotPassword`), which correctly have their own layout.

Extensions made to the pattern contracts along the way (all additive,
backward-compatible, all tested):

- `PageHeader.title` / `PriorityItem.title` / `PriorityItem.detail` — free-text
  overrides that win over the `*Key` i18n variant, mirroring the pre-existing
  `PageHeader.context` override. Property/unit names are free text (D5
  UR-LANG-01's documented exception), not translatable strings.
- `PriorityItem.suspected` — threads through to `SeverityIndicator`'s dashed
  "suspected until verdict" treatment (FR-25). Missing this would have been a
  spec violation the first time a suspected-alert screen got recomposed.
- `PriorityItem.statusValues` — interpolated status text (technician Map's
  "Arrive by {{time}}").

### Screens recomposed this session (beyond Tasks B–E)

By role, all verified individually and via the final full-suite run:

- **Client**: Energy, Alerts (kept its own richer row shape — evidence
  Metrics + provenance + delivery state don't fit `PriorityList`'s row),
  Spaces (kept its own tree — genuine hierarchy, not a flat queue),
  Maintenance, Carbon, Billing (kept `SectionHeader` only — its rows are too
  rich for `PriorityList`).
- **Technician**: Queue (recomposed onto `PriorityList`, matches
  `tech-jobs-1024.png` — and fixes that wireframe's own bare-dot severity
  defect, which the ramp/severity invariant forbids), Map (inside its
  existing `MockBoundary` — the map itself stays a documented Phase 1A
  exclusion, only the list fallback got `PriorityList`), Me.
- **Admin**: Alerts, Fleet (kept its own tree), Dispatch (recomposed onto
  `PriorityList`, grouped by state — one real behavior change: unassigned
  rows now route straight to the Assign panel instead of the read-only work
  order, matching the "decisions first" pattern `admin/Overview` already
  established), Payments (kept its own cards — rows carry a `Metric` +
  multi-line restriction detail), EnergyPortfolio (see below), Mrv, Audit
  (kept its own list — no honest severity field on an audit-log entry),
  Settings (`SectionHeader` on its four sections).
- **Shared object**: Space.tsx — same header convention as `Unit`/`WorkOrder`
  (back button above `PageHeader`, free-text room name, severity in the
  trailing slot), body recomposed into a 2-card grid (not 4 — the content
  only supports two reading cards) plus a `PriorityList` for the room's unit
  list.

Every "kept its own layout" call above is a judgement call, not an omission —
each one is because the content's actual shape (a tree, or rows needing more
than title+severity+status) didn't fit the pattern, not because the work was
skipped. Don't revisit these without a reason; forcing `PriorityList` onto
`client/Alerts.tsx` or `admin/Fleet.tsx` would be a regression.

### The two closed D7 §20 gaps

**Categorical chart ramp** (`ADR-0011`, `ADR-0013`):

- `--color-chart-1`..`-6` in `tokens.css`. The ramp is **ordered**, not
  interchangeable — deuteranopia measurement (CIEDE2000 + Viénot-Brettel-Mollon
  projection, now a permanent check in `verify-contrast.mjs`) found only the
  first three series are colour-distinguishable for a deuteranope; every slot
  therefore also carries a distinct dash pattern and an end marker, bound
  together in one CSS class per slot so a screen cannot pick colour without
  dash.
- `src/patterns/CategoricalChart.tsx` (+`categoricalSeries.ts` for the
  `asChartSeries` helper — split out to satisfy the fast-refresh
  component-only-exports lint rule, same reason `PartIcon.tsx` keeps its glyph
  data in `partGlyphs.ts`). Six-series structural cap (`CategoricalSeriesSet`
  is a 1..6 tuple union — a seventh does not compile). Mandatory legend,
  mandatory `textAlternative` (table or non-blank summary), gaps break the
  line rather than interpolating, `provenance` required.
- **Wired into `admin/EnergyPortfolio.tsx`**, replacing the "not in this
  prototype" `MockBoundary`. Verified live in browser: two series (Rumah
  Bintaro solid blue, SCBD Office dashed brown), legend, data-table disclosure
  all render correctly. The screen's own `purpose` copy said "until a
  categorical ramp exists" — updated since it now does (append-only was
  waived here deliberately: leaving factually wrong UI copy is worse than the
  rule it would have violated).
- Caps at 6 series gracefully: `asChartSeries()` returns `null` for 0 or 7+,
  and the screen falls back to a text note (only 2 properties exist in the
  current fixtures, so this path is inactive today but exercised in tests).

**Part-health glyphs** (`ADR-0012`):

- `src/components/PartIcon.tsx` (+`partGlyphs.ts`, `PartIcon.module.css`).
  Twelve hand-drawn schematic line icons (Lucide has no compressor/coil/fan
  glyphs), on Lucide's own 24px grid and shared `--icon-stroke-width` token.
  `<PartIcon part="compressor" />` — throws on an unknown id, same convention
  as `partDefinition()` in `catalogue.ts`.
- **Wired into `Unit.tsx`'s `PartRow`** (Health view). Verified live: every
  one of the twelve parts now shows a distinct, readable glyph next to its
  name; severity colour/shape/label unaffected (glyphs carry no colour by
  construction — `GlyphShape` has no fill/stroke slot, so a glyph physically
  cannot contradict the `SeverityIndicator` beside it).

**Map treatment** — deliberately **not** built. `admin/Fleet.tsx` and
`technician/Map.tsx` already say so in their own locale strings ("A fleet map
is not drawn in Phase 1A", "A geographic map is not drawn in Phase 1A (design
gap)"), correctly wrapped in `MockBoundary`. This is a shipped product
decision, not an oversight — building it now would contradict decided scope.
Don't revisit without a product decision to do so.

### The one real bug found and fixed

**Cross-role sign-in redirect** (`src/features/auth/SignIn.tsx`,
`src/routes/navigation.ts`). Reproduced live: sign out from any page, then
sign in as a **different role**'s demo account → landed on the old role's
`RequireAuth`-captured `from` path, which the new role can't see, and hit
`NotAvailable` immediately. Root cause: `SignIn.tsx` trusted
`location.state.from` unconditionally. Fixed by adding
`isNavReachable(path, role)` to `navigation.ts` (checks the path against the
signing-in role's own nav model — cycle-safe, since importing
`routes/catalog.ts` directly into `SignIn.tsx` would create an import cycle,
`catalog.ts` imports `SignIn.tsx`) and gating the redirect on it. Tests in
`SignIn.test.tsx` and new `navigation.test.ts` cover both the regression and
the positive case (same-role `from` still honoured).

**Also fixed in passing**: `index.html`'s `theme-color` meta tag still had
the old, ADR-0009-superseded brand hex (`#1B2F6E`) — `verify-tokens` never
scans `index.html` (outside `src/`), so this survived undetected until an
actual page-load smoke test caught it. Now `#0B1B48`, with a comment
explaining why the automated gate can't catch this class of drift.

## Open items — not design's to close

- **OD-01 / OD-02 / OD-04** (`context/requirements/requirements.json`):
  who may flag a space health-sensitive, one- vs two-approver restriction
  steps, which D5/D6 revision is authoritative. Block FR-52/53/73. Product
  decisions, not implementation questions — do not guess at these in code.
- **Breadcrumbs at 1024+**: deliberately unbuilt per ADR-0010 (Figma doesn't
  draw them at any evidenced width; inventing the component to satisfy a
  sentence with no comp would be exactly the mistake ADR-0010 exists to
  prevent). Don't build until a comp exists.
- **Map** (see above): shipped exclusion, not a gap.

## If you're picking this up cold

1. Read `CLAUDE.md` (router), then this file.
2. `npm run verify` — should be green (256/256, all gates). If it isn't,
   something changed since this was written; find out what before doing
   anything else.
3. The two ADRs worth reading before touching charts or icons again:
   `ADR-0011-categorical-chart-ramp.md` (why the ramp is ORDERED and why
   colour always carries a dash pattern), `ADR-0012-part-health-glyphs.md`.
4. If you add a screen with a multi-series chart or a new monitored part,
   the structural caps (`CategoricalSeriesSet`'s 1..6 tuple, `PART_GLYPHS`'
   twelve keys) will fail loudly rather than silently — that's intentional,
   fix the cap deliberately (new ADR) rather than working around it.
5. Everything in "the one real bug found and fixed" above was caught by
   **actually running the app in a browser**, not by the test suite or
   `npm run verify` — both were green the whole time the redirect bug
   existed. Don't skip a live QA pass before calling a session done, even
   when every automated gate is green.

## Verify

```
npm run verify        # 256 tests, all gates — this is the bar, not a suggestion
```
