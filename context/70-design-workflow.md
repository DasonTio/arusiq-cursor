# Figma ↔ code workflow

For a ten-day sprint with 24 screens and a design system that is already
specified to the pixel.

## The mistake to avoid

The default move is: design all 24 screens in Figma, then build them. On this
timeline that fails, and not because of effort — because most of that work is
**transcription, not design**.

D7 already fixes the palette, the type ramp, the eleven spacing levels, six
radii, three elevations, the navigation shell at each breakpoint, and fourteen
product components. Redrawing a KPI tile in Figma does not decide anything; it
re-types a decision, in a tool that cannot check it, into a file that will drift
from the build.

So the question is not "Figma or code". It is **which decisions each tool owns**,
with no overlap.

## Division of authority

| Figma owns                                                             | Code owns                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Composition — what appears on a screen, in what order                  | Every **value**: colour, spacing, type, radius, motion |
| Hierarchy — what the eye hits first                                    | Component behaviour and all four data states           |
| Density — how much fits before it stops being scannable                | Accessibility, contrast, focus, targets                |
| The genuinely undrawn: dark hero, part-health diagram, map, chart ramp | Anything already in `tokens.css`                       |
| Both locales side by side, to find what breaks                         | Enforcement                                            |

**Neither re-derives the other's territory.** A Figma file that invents a grey is
wrong even if it looks fine; a screen that invents a layout because the spec was
silent is fine.

## Direction of truth: code → Figma

`npm run figma:tokens` generates `design/figma-tokens.json` (DTCG format) from
`tokens.css`. Import it into Figma as Variables.

Code is upstream because it holds work Figma cannot reproduce: a contrast matrix
measured against every legal surface, seven ADRs, and the finding that D7 §4.1's
own severity fills miss D7 §19.1's 3:1 bar. Build the palette in Figma first and
that evidence is gone.

The **rules travel with the values** — each variable's description carries its
measured ratio and its constraint, so a designer selecting
`color/severity/warning/mark` reads _"3.98:1 · shape: triangle"_ at the point of
use rather than in a PDF nobody opens.

`npm run verify` fails if the export goes stale. D8 finding F-06 was two
palettes in three artefacts; this is how that does not happen twice.

## Design four archetypes, not twenty-four screens

Pick screens that between them exercise every pattern. Everything else is
recomposition, and recomposition belongs in code where the tokens are enforced.

| Archetype            | Why this one                  | Covers                                                       |
| -------------------- | ----------------------------- | ------------------------------------------------------------ |
| `client.overview`    | The hardest and the most seen | Dark hero, KPI tiles, severity roll-up, sparkline, timeline  |
| `client.unit-detail` | Densest data screen           | Part health, command lifecycle, charts, the two carbon cards |
| `tech.work-order`    | The only heavy input screen   | Checklist, evidence, forms, photo capture                    |
| `admin.overview`     | Fleet scale                   | Dense tables, approval queue, map, portfolio chart           |

Draw each **at 375 and at 1024**, and **in both locales**. Indonesian runs
20–30 % longer; that is the single highest-value thing Figma gives you here,
because no verifier will ever catch a truncation.

## Code Connect is the bridge

`.figma.ts` files map a Figma component to the real code component. Selecting a
node then yields the actual snippet — `<SeverityIndicator severity="critical" />`
— instead of an agent inferring one from a picture and quietly inventing props.

Map only the primitives that repeat: `SeverityIndicator`, `ProvenanceChip`,
`Metric`, `Button`, `Textfield`, `UnitCard`. Six mappings remove most of the
translation cost across all 24 screens.

Without it, "design to code" means re-implementing a component every time it
appears in a comp. With it, composition is the only thing left to do.

## Where Figma time is genuinely worth spending

The three open D7 §20 gaps are real design work and the tokens cannot decide them:

1. **Part-level health diagram** — twelve components across indoor, outdoor and
   electrical. Lucide has no compressor or evaporator-coil glyph. This is
   illustration, it blocks `tech.diagnostics`, and it has the longest lead time.
   **Start it first.**
2. **Categorical chart ramp** — six series, tuned for adjacent-colour
   discrimination and checked for deuteranopia. Blocks `admin.energy-portfolio`.
3. **Map treatment** — style, markers, clustering, routes. Blocks `admin.fleet`.

Each closes with an ADR and a token update, then `npm run figma:tokens`.

## Sequence

| Day | Figma                                             | Code                                 |
| --- | ------------------------------------------------- | ------------------------------------ |
| 1   | Import variables · start the part-health diagram  | Primitives against `contracts.ts`    |
| 2–3 | The four archetypes at 375 and 1024, both locales | Primitives, `lib/simulation`, routes |
| 3   | Code Connect for the six repeating primitives     | —                                    |
| 4–5 | Chart ramp · map treatment                        | Build the four archetype screens     |
| 6–9 | Review built screens, not new comps               | The remaining 20, from patterns      |
| 10  | Both locales, 375 and 1536, keyboard pass         | Fix what that finds                  |

Figma work **front-loads and then stops**. From day 6 the designer reviews
running software, which catches things no static comp can — motion, focus order,
what a real Indonesian string does to a real card.

## The honest trade-off

You will not get 24 pixel-perfect comps. You will get four that are right, a
system both tools share, and twenty screens built from proven patterns and
reviewed live.

If a stakeholder specifically needs a comp of a screen nobody has built yet,
that is a real reason to draw one — but say so deliberately, rather than
drifting into drawing all of them.
