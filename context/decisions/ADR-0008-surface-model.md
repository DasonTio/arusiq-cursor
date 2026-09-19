# ADR-0008 · D2 v2.1 decides the information architecture; D7 decides presentation

**Status** Accepted · 2026-09-18 · **Reverse cost** two blocks in
`requirements.json` and one ownership row — nothing built depends on this yet

## Conflict

**D7 R2 §8.3** (12 Sep), _Navigation shells_: _"All three roles share one
navigation model, adapted per frame."_ At 375 px that is **bottom tabs, maximum
five**, with a drawer for account, role switch and language. At 768 px it is a
collapsed icon rail, and at 1024 px and above a persistent sidebar with
breadcrumbs for the asset hierarchy.

**D2 v2.1** (16 Sep, `docs/ARUSIQ_D2_UI_UX_Flow_Sitemap_v2.1.html`), _Device
strategy_: _"Version 2.0 gave every role a mobile rail. That was wrong for HQ,
who work at a desk with two monitors, and only half right for technicians. The
split is not by role — it is by task and place."_ For HQ: _"No bottom tab bar,
no mobile console. The phone is reached from a notice and carries three
actions — approve, acknowledge, dispatch — as panels over a single object.
Everything else opens read-only and names the desktop."_

The two documents also differ in two smaller ways at 375 px:

- D7 puts account in the drawer. D2 makes **Account** the client's fifth tab.
- D7 puts language in the drawer. D2 lists the language switch as **always
  present**, alongside search, the assistant and profile.

The precedence line in `.claude/commands/adr.md` does not settle this, because
it does not list D2 at all.

A second gap follows from D2's surface model. D2 defines five kinds of surface:
destination, view, object, panel and setting. It says objects and panels have
_"one address and one component set, with role variants rather than a copy per
application."_ `40-architecture.md` only had per-role feature directories.
Under it, the client agent and the technician agent would each have built their
own unit screen — the per-application copy D2 is written to prevent.

## Decision

D2 v2.1 decides which surfaces exist, how each role reaches them, and which
width each is designed for. D7 decides how they look. Objects used by more than
one role, and every panel, live in `src/features/shared/`.

## Why

1. **D2 is the later document, and the one written for this question.** It
   exists to fix the information architecture — _"Version 1.0 turned every
   requirement family into a menu item and produced a fourteen-item
   sidebar"_ — and it was written four days after D7 R2. Its _What changed_
   table justifies each of its 13 moves. D7 §8.3 is a four-row table.
2. **D2 keeps D7's model everywhere D7's model has a user.** The client has five
   bottom tabs at 375, identical on desktop, exactly as §8.3 says. The
   technician has tabs on the phone and a sidebar at a desk, again as §8.3 says.
   The only frame D2 removes is the HQ tab bar at 375.
3. **The numbers do not fit five tabs.** D2 cut the rails from **33 items to
   13** across three roles. HQ's console still shows _"about nine items at
   1440 px"_: five sections, each with its views always visible. A 375 tab bar
   holds five flat items and no hierarchy (D7 §8.3, D2 _Rails_). That left two
   honest options at 375: a truncated console, or no console. D2 chose no
   console and kept on the phone only the three actions that cannot wait.
4. **UR-SYS-03 still holds.** D5 UR-SYS-03 (Must, 1A) requires that the product
   works on desktop, tablet and mobile. D2: _"Every surface still renders at
   375 px without horizontal scroll … What changed is the difference between
   rendering at a width and being designed for it."_ On a phone, HQ keeps
   A-1.1 _Decisions needed_ and the approve, acknowledge and dispatch panels
   fully working. Every other view opens read-only and says where the work gets
   finished, so INV-NO-DEAD-END is not broken.
5. **It removes design work the sprint cannot afford.** D2: _"One fully designed
   mobile layout instead of three."_ On sprint day 5, the Figma file has no
   technician frames and no admin frames that are not copies of client frames.

## Consequences

- **D7 §8.3's navigation table no longer applies to HQ at 375.** HQ has no tab
  bar there. D7 §8.3 still governs everything else: five tabs as the ceiling,
  labelled destinations (§7.1), and the 1024+ sidebar. **The 768 icon rail is
  superseded by ADR-0010** — destinations stay labelled at every breakpoint.
  Breadcrumbs with roll-up severity remain specified; they are unbuilt until
  Figma draws them.
- **The client's account moves from the drawer to a tab.** The language switch
  stays reachable from every screen (FR-04). Whether it sits in the header or
  the drawer is D7's call. The drawer still holds role switch, which D2 does not
  mention.
- **Everything visual in D7 is unchanged**, including how a tab, rail or
  sidebar looks.
- `requirements.json → navigation` is rewritten from D2. `screens` is re-cut to
  D2's surfaces, and every entry now names its D2 surface IDs.
  - Retired: `client.air-quality` (now `shared.space`), `shared.notifications`
    (now `client.alerts` and `admin.alerts`), and `tech.diagnostics` (now
    `shared.unit` Health, `shared.alert` and `shared.device`).
  - Renamed: `client.unit-detail` is now `shared.unit`, and `tech.work-order` is
    now `shared.work-order`.
- **`src/features/shared/` gets an owner** (`40-architecture.md`,
  `.cursor/rules/400-ownership.mdc`). Role agents compose shared objects and
  panels. They never copy them. An object used by one role stays in that role's
  directory: O-CASE and O-PACK are admin-only.
- **The precedence line in `.claude/commands/adr.md` now places D2** for
  information-architecture questions.

## Reversing

1. **To give HQ a phone rail**, add phone destinations to
   `navigation.admin` and a bottom-tab variant to the admin shell. The shell is
   not built yet.
2. **To fold shared surfaces back into role folders**, re-prefix the `shared.*`
   screen ids, delete `src/features/shared/`, and remove its ownership row. Each
   role then carries its own copy, and D2's _"one component set"_ is broken
   knowingly.
