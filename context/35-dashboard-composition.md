# Dashboard composition — the shared brief

**Read this before touching any screen.** It is the working agreement between
everyone building ARUSIQ's UI, human or agent. `30-design-system.md` says what
a value may be; this says how a screen is put together and why.

The benchmark is
[Shopeers](https://dribbble.com/shots/26628350-Shopeers-AI-Powered-B2B-eCommerce-Analytics-Dashboard).
Do not copy its styling. Copy the four things that make it read as
professional, listed below.

---

## 1 · What actually makes a dashboard look professional

**Three colour registers, not one.** Every serious dashboard separates:

| register     | carries                               | ours                                |
| ------------ | ------------------------------------- | ----------------------------------- |
| **ink**      | structure and text                    | navy, gray-1/2, black-1             |
| **accent**   | "this responds to you", the lead line | `--color-brand-accent` (ADR-0018)   |
| **semantic** | what the data MEANS                   | severity · eco · state · chart ramp |

ARUSIQ had a rich semantic register and a strong ink register and **nothing in
between**, which is exactly why reviewers kept calling it colourless. If a
screen looks grey, the question is never "what colour should I add" — it is
**"which register does this element belong to, and am I using it?"**

**Colour encodes data; it is never decoration.** The reference looks colourful
because almost everything on it is a figure, a status or a control. Ours has
the same density of meaning and renders most of it as grey text.

**Tinted chips.** A small icon in a 12 % tint of its channel is the single
cheapest thing that separates a designed card from a bordered rectangle. Use
`MetricTile`'s `icon` + `tone`.

**Elevation over borders.** White panel on the grey canvas, `--radius-xl`,
`--shadow-sm`, `--space-4` padding at ≥1024. The border is emphasis, not the
only boundary.

---

## 2 · Which colour, and why

Pick the channel the **data** belongs to. Never pick a colour because a screen
looks dull.

- **Energy, power, consumption, anything metered** → `accent`.
- **Carbon, avoided emissions, savings** → `eco` (`--color-state-eco-text`).
  This is the sustainability channel and nothing else may borrow it.
- **Status of a thing** → severity, and it **always** renders mark + shape +
  label. There is no such thing as a red dot on its own here.
- **Money, accounts, billing** → `info`.
- **Which property / which series** → the chart ramp, 1-2-3 first. A series
  colour says _which_, never _how it is doing_.
- **Red is the mark and severity. It is never an action.** (ADR-0017.)

If nothing fits, it is ink. Grey is a legitimate answer; "colourful" is not a
goal in itself.

---

## 3 · Composition vocabulary

Pick the shape that fits the **content**, not the shape the generator emitted.

| the content is…                          | use                                      |
| ---------------------------------------- | ---------------------------------------- |
| 3–5 headline figures                     | `MetricGrid` + `MetricTile`, with chips  |
| rows sharing the same fields             | a **table** in one panel                 |
| a queue to triage                        | `PriorityList`, columns at ≥1024         |
| items moving through states              | a **board**, one column per state        |
| a hierarchy                              | a **tree**: indentation + hairlines      |
| one metric over time                     | `TrendChart`                             |
| several properties over time             | `CategoricalChart`                       |
| one idea made of a chart plus its totals | one **panel**, chart left, figures right |

### Anti-patterns, all observed in our own screens

- **Card-in-card.** A card inside a card inside a card is a tree drawn wrong.
  Nesting is indentation, not another border and shadow.
- **The text-dump card.** Label-and-value sentences stacked in a box, when the
  same fields repeat on every card. That is a table.
- **A button on every card.** Twelve cards with twelve identical buttons is
  twelve times the visual weight of one column of links. Use a row that is
  itself the link, with a chevron.
- **The unbalanced pair.** Two columns where one has half the content leaves a
  hole. Let items flow, or give the short side different content.
- **The uncapped chart.** An aspect-ratio box with no ceiling is a half-page
  void on a wide monitor (ADR-0019).

---

## 4 · The constraints that outrank aesthetics

These are not style preferences. Breaking one is a defect even if the screen
looks better for it.

1. **Severity is colour + shape + label.** Never a bare coloured dot.
2. **Every figure carries provenance**, beside the figure. Aggregates inherit
   the weakest.
3. **Grey is not a pass.** It means "we do not know" and carries a last-seen.
4. **Never fabricate.** No invented deltas, no placeholder trends, no sample
   values to make a chart look fuller. Missing is stated as missing.
5. **Tokens only.** No raw hex, px or z-index. A new token needs an ADR.
6. **No hardcoded user-facing strings**; Indonesian runs 20–30 % longer.
7. **No dead ends.** Every row leads somewhere.
8. **`npm run verify` before reporting anything done.** It is not advisory.

---

## 5 · How to work on a screen

1. Open it in a browser at **1280 and 375**, in **both locales**. Most faults
   in this product were invisible in the code and obvious on screen.
2. Ask what the content _is_ (§3), and whether the current shape matches.
3. Ask which register each element belongs to (§2).
4. Change the composition first, the colour second. Colour on a bad layout is
   still a bad layout — three rounds of this project proved it.
5. `npm run verify`, then screenshot before/after.

### A note on duplication

Before writing a component, grep for it. The trend chart existed **three
times** in this repo, and the copies had duplicated two live defects that were
fixed in only one of them. If a screen needs something that smells shared, put
it in `src/patterns/` with its own test — that is what makes the design system
real rather than a document.
