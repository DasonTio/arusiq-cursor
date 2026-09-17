# Handoff — Figma and sitemap alignment review

**Written** 2026-09-17 · **Status** ephemeral — delete this file once its next
steps are done. Durable state lives in `CLAUDE.md` and `context/`.

## Start here

1. **Confirm the Figma tools are loaded** — search your tools for `figma`. If
   none come back, stop and tell the user. Do not work around it again.
   - Why this matters: this machine has two Figma connections to the same server —
     the Claude Code plugin (`plugin:figma:figma`) and the claude.ai connector
     (`claude.ai Figma`). A session loads the claude.ai one and ignores the
     plugin, so the claude.ai connector must be signed in.
   - `claude mcp list` health-checks each server separately, so it can say
     "Connected" while your session still has no Figma tools.
2. Before calling `get_design_context`, load the `figma:figma-design-to-code`
   skill. Before calling `use_figma`, load `figma:figma-use`. Both are mandatory.
3. Read `context/70-design-workflow.md`, then in
   `context/requirements/requirements.json` read the `navigation` block and
   `openDecisions`.

## Division of labour

This agent sets up the harness and reviews designs. Cursor agents turn
requirements and designs into code. Do not build screens here.

Phase 1A sprint: 14–25 Sep 2026. The workflow plan had design finishing on day 5
(18 Sep).

## Sources

**Sitemap** — `https://claude.ai/artifact/X5d8JDJXxwzCWjH3roQRtu`. The Claude Docs
`read` call was refused twice with `access`, so it is either not shared or not a
Doc. Never web-fetch it. Its "three rails" navigation section is embedded in the
Figma file as an image (node `176:1722`), and that section has been read and
recorded in `requirements.json → navigation`. **Its user flows have not been
read.** Ask the user to share the artifact or export it into `docs/`.

**Wireframe** — Figma file `g5e2UgJuHt7TX9QBdRdmjP`, canvas "Low Fidelity -
Wireframe", node `5:202`, 27 top-level nodes. `get_metadata` on the canvas
returns about 280k characters, so parse it with a script; don't read it.
`get_screenshot` returns a short-lived URL: download it at once, and pass
`maxDimension` for full resolution.

| Area                        | Frame                            | Node                                              | Reviewed via                   |
| --------------------------- | -------------------------------- | ------------------------------------------------- | ------------------------------ |
| Sitemap excerpt             | image 1                          | `176:1722`                                        | screenshot                     |
| Design system               | Colors                           | `25:371`                                          | screenshot + variables         |
|                             | Textfields · Buttons · Selectors | `25:494` · `25:607` · `55:1998`                   | text only                      |
| Customer web                | Login Page                       | `5:203`                                           | text only                      |
|                             | Dashboard - normal               | `22:204`                                          | screenshot                     |
|                             | Customer - My AC Units · Filter  | `25:780` · `55:2181`                              | text only                      |
|                             | Customer - Unit Detail           | `62:472`                                          | screenshot                     |
|                             | Customer - Energy                | `78:830`                                          | screenshot                     |
|                             | Customer - Carbon Saving         | `93:2178`                                         | screenshot                     |
|                             | Customer - Maintenance           | `95:810`                                          | text only                      |
| Customer mobile (402 × 874) | Login Page                       | `137:345`                                         | text only                      |
|                             | Home                             | `137:602`                                         | screenshot                     |
|                             | Spaces                           | `176:1417`                                        | screenshot                     |
|                             | Spaces - filter · Insights       | `176:2165` · `176:2405`                           | text only                      |
|                             | Group 125 · 245 · 255 · 193      | `176:2285` · `185:2813` · `185:2712` · `187:2996` | text only                      |
| Other                       | Dashboard - minimize · Group 118 | `9:270` · `44:1540`                               | text only — early explorations |
| Admin web                   | —                                | label `191:385` only                              | **no frames**                  |
| Technician                  | —                                | —                                                 | **no section**                 |

## Findings so far

**Coverage against the sitemap.** Client is partly drawn: Home and Spaces exist,
plus Unit detail and Filter. Insights is split into separate Energy and Carbon
pages. Alerts is missing. Account appears only as Maintenance, with no bills or
contract. Technician has no frames. Admin/HQ has a heading and no frames.

**Navigation contradicts the sitemap.** The web sidebar has 8 unlabelled icons
and the mobile tab bar has 4. The sitemap specifies 5 labelled destinations,
identical on both.

**Colours: the file disagrees with itself.** 5 of the 10 hex labels on the
Colors frame are wrong. What is painted matches the bound variables:

| Variable            | Painted                           | Label says |
| ------------------- | --------------------------------- | ---------- |
| `accent/primary`    | `#0B1B48` (matches the logo navy) | `#022465`  |
| `accent/secondary`  | `#2B407A`                         | `#0B1933`  |
| `accent/secondary2` | `#DB1217`                         | `#0B1933`  |
| `state/warning`     | `#FDCE3E`                         | `#E2B93B`  |
| `bc/white-2`        | `#F9F9F9`                         | `#F5F5F5`  |

Other painted values, which match their labels: Alert `#EC2B2B`, Info
`#2F80ED`, Gray 3 `#828282`. The logo accent is `#2F80ED`. ADR-0001's
`#1B2F6E` / `#D62027` appear nowhere in the file. This is recorded as
**OD-03**, with evidence and a recommendation.

**Must content missing from frames that exist**

- **Energy** — no normal-vs-actual savings and no method link (FR-61).
- **Unit detail** — no health for the 12 monitored parts (FR-20); mode buttons
  show no Sent → Acknowledged → Verified state (FR-40); no indoor CO₂ /
  air-quality card (FR-63, FR-66).
- **Carbon** — grid factor not shown (FR-70).
- **Every frame** — no language switch (FR-04); no provenance labels (not one
  "Simulated" in the file).
- **My AC Units** — the copy "live values refresh every 5 seconds" claims live
  data in a simulated prototype.

**Design-system violations**

- The Energy chart colours its series blue, green and red. D7 §12.1 forbids
  severity colours as series colours.
- Eco teal is used for Quick Actions and all four Mode buttons. Eco is the
  sustainability channel, and with every mode button filled, none shows as
  selected.
- KPI tiles are filled navy on Dashboard and Energy but white on Carbon and
  mobile Home.
- Mobile frames are 402 px wide. D7 designs at 375 first.
- Spaces (mobile) says "All Room"; web says "All rooms". Its "+ add" card is an
  admin capability under FR-13.
- The mobile "Insights" frame has the same text layers as Home — probably an
  unedited duplicate.

**What is working**

- The three-rails navigation (5 / 3 / 5) is strong, and better than the original
  screen list.
- The wording is careful: "CO₂e avoided", "priced at your tariff", and "credit"
  never appears.
- Each page has a title plus a one-line purpose.
- Counts are inspectable ("8 of 24 units running").
- The painted palette is internally consistent and passes contrast.

## Next steps, in order

1. **Finish the review with the Figma tools.** Screenshot the frames marked "text
   only" above. Update this file's findings where they change.
2. **Full sitemap.** If the user shares or exports it, compare its screens and
   user flows against `requirements.json` (`navigation` and `screens`). The
   destination → screen mapping there is inferred; correct it.
3. **OD-03** — only if the user says yes:
   1. Write ADR-0008 superseding ADR-0001's values.
   2. Set `brand-primary` `#0B1B48`, add `brand-secondary` `#2B407A`, and set
      `brand-red` `#DB1217`.
   3. Decide whether `--surface-inverse` moves to `#0B1B48` — every ADR-0005
      token was measured to still pass on it.
   4. Run `npm run verify`, then `npm run figma:tokens`, and commit.
   5. Tell the user to import `design/figma-tokens.json` into Figma, replacing
      the mislabelled Colors frame.
4. **Designer fix list** — ask the user where they want it before writing it.
   Priority order:
   1. Switch both navs to the 5 labelled destinations.
   2. Add the missing Must content listed above.
   3. Draw the technician work order and the admin overview, the two missing
      archetypes.
   4. Draw Alerts, then Account (billing and the restriction ladder).
   5. Resize the mobile frames to 375.
5. **Cursor can already build:** the app shell with the 5/3/5 rails and role
   checks; `lib/simulation`; the neutral primitives; and the Home, Spaces and Unit
   detail layouts, taking content from `requirements.json` rather than copying
   the wireframe as-is. Anything in brand colours waits for OD-03.

## Gotchas

- Every commit runs `npm run verify` through `.githooks/pre-commit`.
- `eslint-plugin-jsx-a11y` is installed with `--legacy-peer-deps` because it
  hasn't declared support for eslint 10.
- `tokens.css` is exempt from Prettier on purpose (column-aligned reference
  table).
- Don't write probe files into `src/`. Test rules with the fixtures in
  `tools/__fixtures__/` or with ESLint's RuleTester.
