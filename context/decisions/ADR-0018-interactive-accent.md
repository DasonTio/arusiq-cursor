# ADR-0018 · An interactive accent, because navy is ink

**Status** Accepted · 2026-09-20 · **Reverse cost** one token and the
declarations that reference it — low; the gate measures it either way

## Context

After ADR-0017 every action in the product was `--color-brand-primary`
(`#0B1B48`). That token is **16.61:1 on white**. It is a text tone. A filled
button in it reads as a black rectangle, an active tab as a black pill, a link
as bold body text — so a reviewer looking at the product saw no accent at all,
only ink, and said so: _"most of the pages are still colorless."_

They were right, and it is a structural point rather than a taste one. A
dashboard communicates in three registers — **ink** (what it says), **accent**
(what responds to you) and **semantic colour** (what the data means). ARUSIQ
had a rich semantic register (severity, state, eco, six chart series) and a
strong ink register, and nothing in between. Every professional dashboard this
was benchmarked against carries a single saturated accent doing exactly that
middle job.

`--color-state-info` (`#2F80ED`) already exists and was the obvious candidate,
but it is documented as _"interface + form feedback ONLY"_. Borrowing it would
make every primary button a permanent informational message.

## Decision

Add one token:

```
--color-brand-accent: #1D4ED8;
```

Measured before it was chosen, against the surfaces ADR-0016 established:

| as                       | ratio  |
| ------------------------ | ------ |
| white text on the fill   | 6.70:1 |
| text on a white panel    | 6.70:1 |
| text on the grey canvas  | 6.15:1 |
| text on its own 10% tint | 5.72:1 |

It carries **interaction and the lead data series**: filled primary action,
outlined secondary, active navigation and view tabs, links, the confidence
bar, and the "with ARUSIQ" line on a comparison chart. `--color-brand-primary`
keeps what it was always good at — headings, the wordmark, the hero surface.

`verify-contrast` now measures the accent as both a fill and a text tone
(42 checks, up from 40), so it cannot drift below the bar unnoticed.

The same ADR introduces the **tinted icon chip** on `MetricTile`: a 12% tint
of a channel token with that channel's glyph on it. It is a focal point and a
domain cue, and explicitly **not** a status — a tile that must say "this is
bad" still renders a `SeverityIndicator`, because colour never travels alone
(D5 UR-MNT-01). `tone` therefore names a channel, and only names a severity
when the figure genuinely counts a severity.

## Consequences

- The product has a visible accent for the first time. Interaction is
  legible as interaction rather than as emphasis.
- Red is now unambiguous. After ADR-0017 removed it from buttons and this ADR
  gave actions their own hue, every red pixel on screen is a severity claim.
- One risk to watch: the accent sits near `--color-chart-1` (`#0168B2`, azure)
  and `--color-chart-5` (`#2F2A9E`, indigo). It must **not** join the
  categorical ramp — ADR-0011's discriminability guarantee is measured over
  those six and does not include this. It is chrome, plus the single
  actual-versus-baseline line, which is separated by dash pattern anyway.
- KPI figures moved from `--font-size-h3` to `h4` inside a tile. h3 clipped
  `1,645,629 IDR` in a five-up strip; h4 clears both the five-up and the
  four-up, measured.
