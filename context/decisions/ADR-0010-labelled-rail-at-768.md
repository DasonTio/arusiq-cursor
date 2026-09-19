# ADR-0010 · Destinations stay labelled at every breakpoint; Figma chrome is composition, not IA

**Status** Accepted · 2026-09-19 · **Reverse cost** RoleShell CSS + two
characterization tests — no destination list changes

## Conflict

Four sources disagree on what the rail looks like, and two of them disagree
with themselves.

**D7 R2 §8.3** (12 Sep): at 768 px the shell is a _collapsed icon rail_; at
1024 px a persistent sidebar with breadcrumbs. **D7 §7.1** in the same
document: destinations carry visible labels, not icons alone.

**ADR-0008** kept both sentences: labelled destinations _and_ the 768 icon
rail. An icon rail is not labelled. Code currently shows a labelled sidebar
from 768.

**D2 v2.1** (16 Sep, embedded in the Figma file as node `176:1722`) names the
destinations. Client: Home, Spaces, Alerts, Insights, Account — identical on
phone tabs and desktop sidebar. Technician: Work, Map, Me. HQ: Overview,
Fleet, Service, Accounts, Reporting. Always present: search, assistant,
language, profile.

**Figma file `g5e2UgJuHt7TX9QBdRdmjP`** (live 19 Sep, page `5:202`):

| Frame                         | Node                  | What it draws                                                                                                              |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Client Home (402 × 874)       | `137:602`             | Four unlabelled tab icons (house, vent, leaf, bell). No Account. Header: logo, search, profile. No language, no assistant. |
| Client sidebar at 1440        | `112:891` / `22:204`  | Eight unlabelled icons + sign-out.                                                                                         |
| Client “Dashboard - minimize” | `9:270`               | Five unlabelled icons at **1440 × 1024** — not a 768 frame.                                                                |
| Later client dashboard        | `216:1652`            | Six unlabelled icons.                                                                                                      |
| Technician sidebar            | `277:506` / `230:431` | **Labelled** row items: jobs, map, history, profile + sign-out. Logo in the rail.                                          |
| Technician at 375             | —                     | **No phone frames.**                                                                                                       |
| HQ                            | —                     | **No frames.** Brand Guideline page `98:563` is logo only.                                                                 |
| 768 rail                      | —                     | **No 768-wide frame exists** in the file.                                                                                  |

Evidence (downloaded 19 Sep):
`context/handoff/figma-nav-evidence/client-tabbar-375.png`,
`client-sidebar-isolated.png`, `client-dashboard-minimize-rail.png`,
`tech-sidebar-1024.png`, `sitemap-three-rails.png`.

The 17 Sep review already called the eight unlabelled client icons a defect.
The user later asked the sidebar to be _like Figma_. Those two instructions
collide unless “like Figma” means the **technician** labelled rail and the
**sitemap** destinations, not the client icon column.

## Decision

**Destinations stay labelled at every breakpoint.** The 768 treatment is a
narrower labelled sidebar, not an icon rail. Figma owns rail _composition_
(logo in the rail, icon + label, footer action, active pill). D2 owns _which
destinations exist_. Client wireframe icon columns are density sketches, not
IA.

## Why

1. **The same Figma file already contains D2.** Node `176:1722` is the three
   rails excerpt. It says five labelled client destinations, identical on
   sidebar and tabs. Implementing the client wireframe’s four unlabelled tabs
   or eight unlabelled icons would contradict the sitemap sitting on the same
   page.
2. **There is no 768 evidence to implement.** D7’s icon rail is a table cell.
   Figma never drew a 768 frame. “Dashboard - minimize” is 1440 px with icons
   only — the same defect as the 17 Sep review, at desktop width. Treating
   that as a tablet spec invents a breakpoint the file does not have.
3. **An icon rail fails D7 §7.1 and `requirements.json → navigation`.** Both
   say destinations carry visible labels. ADR-0008 cannot keep both of D7’s
   sentences; the later, load-bearing one is the label rule (also D2’s
   “five is the ceiling” — a ceiling on _named_ destinations, not glyphs).
4. **The technician sidebar is the composition the user pointed at.** It
   already draws icon + visible label, logo in the rail, and a footer action.
   That is what “sidebar like Figma” refers to once the client icon column is
   discarded as a sketch.
5. **Technician IA stays D2, not the wireframe labels.** Figma names jobs,
   map, history, profile. D2 names Work, Map, Me. History (`T-3`) is a Figma
   frame and an unbuilt view — promoting it to a live destination is a dead
   end (INV-NO-DEAD-END). Profile is already Me / the avatar. Jobs is Work.
   Disabled History was considered and rejected: D2 cut the technician rail
   to three destinations on purpose.
6. **HQ has nothing to copy.** No HQ chrome exists in Figma. The two-level
   labelled sidebar in code stays. Unbuilt second-level views (Fleet Map /
   Devices / Activity, Service Technicians / Preventive, Accounts Customers /
   Restriction cases) are **not** added as live links. They are also not
   added as disabled mocks, because Figma does not draw them.
7. **Header tools stay.** D2’s always-present set (search, assistant,
   language, profile) is FR-04. Figma omits language and the assistant; that
   is the file being behind, not a product decision.
8. **Breadcrumbs stay unbuilt.** D7 §8.3 and ADR-0008 specify them at 1024+
   with roll-up severity. Figma does not draw them. Do not invent a
   breadcrumb component to satisfy a sentence the comps do not show.

## Consequences

- **ADR-0008’s “768 icon rail” is superseded.** Its IA ruling stands: D2
  decides surfaces and which width each is designed for; D7 decides how a
  tab or sidebar _looks_ (colour, type, spacing). The look of the 768 rail
  is now “labelled, narrower”, not “icons only”.
- **`context/30-design-system.md` navigation sentence** is updated to match.
- **RoleShell** keeps the current destination lists. Composition changes:
  brand wordmark in the desktop rail, sign-out as a footer _action_ (not a
  destination), active destination as a tokenised pill. Phone tabs stay
  five labelled items for the client and three for the technician.
- **No new tokens.** Sidebar width stays on the existing rem columns.

## Reversing

1. To restore a 768 icon rail, revert this ADR, restore the D7 §8.3 sentence
   in `30-design-system.md`, and hide rail labels between 768 and 1023 with
   accessible names on the icons. That re-opens the §7.1 defect.
2. To adopt Figma’s technician labels (jobs / history / profile), change
   `navigation.ts` and the locale keys, and either build History or mark it
   a labelled mock. That is a D2 change and needs its own ADR.
