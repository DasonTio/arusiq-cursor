# Context index

The source documents (D5 URS, D6 PRD, D7 UI Guideline, D8 review) total roughly
**55,000 tokens**, before D2's sitemap and user flows (`docs/*D2*.html`) are
added. Loading them into an agent's context is not thoroughness, it
is sabotage: the middle of a long context is reliably the part a model stops
attending to, and a 55k-token preamble leaves no room for the actual work.

So the documents are **distilled once, here, by hand**, into task-shaped files.
Load the one file your task needs. The PDFs stay in `docs/` and remain
authoritative when a detail is missing or contested.

| File                             | ~tokens   | Load when                                                                                     |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `10-product.md`                  | 1.2k      | Starting a feature; deciding what "done" means for a screen                                   |
| `20-domain.md`                   | 1.6k      | Modelling data; naming things; anything involving severity, parts or roll-up                  |
| `30-design-system.md`            | 2.6k      | **Any** visual work. Non-optional before writing a component                                  |
| `35-dashboard-composition.md`    | 1.4k      | **Any screen layout.** Which shape the content wants, and which colour register it belongs to |
| `40-architecture.md`             | 1.4k      | Creating files; wiring routes; touching simulated data                                        |
| `50-agent-protocol.md`           | 1.3k      | More than one agent is active                                                                 |
| `60-definition-of-done.md`       | 0.8k      | Before reporting work complete, and in review                                                 |
| `70-design-workflow.md`          | 1.8k      | Any Figma work; deciding what gets drawn and what gets built from patterns                    |
| `requirements/requirements.json` | 11k       | Query it — don't read it end to end                                                           |
| `decisions/*.md`                 | 0.4k each | A value in the design system looks wrong, or a doc contradicts another                        |

Code-level context that is often the faster answer:

| File                          | Load when                                                 |
| ----------------------------- | --------------------------------------------------------- |
| `src/components/contracts.ts` | Building any component — the prop interfaces are the spec |
| `src/lib/simulation/types.ts` | Anything touching data                                    |
| `src/lib/domain/`             | Severity, provenance, commands, the restriction ladder    |

`handoff/` holds dated notes passed between sessions. They are ephemeral: read
the newest one if it exists, act on it, then delete it.

## Querying rather than reading

`requirements.json` is structured so you can pull the slice you need:

```bash
# what must this screen do?
node -e "const s=require('./context/requirements/requirements.json');
  const sc=s.screens.find(x=>x.id==='client.overview');
  console.log(sc.note??'');
  sc.satisfies.forEach(id=>console.log(s.requirements.find(r=>r.id===id)))"

# what must a D2 surface carry, and what does it do at 375 px?
# (a screen's `surfaces` field lists its IDs)
grep -o "id: 'C-1'[^}]*" docs/ARUSIQ_D2_UI_UX_Flow_Sitemap_v2.1.html

# what is still unbuilt?
npm run trace
```

A grep against the JSON beats reading the PDF every time. If you find yourself
opening `docs/*.pdf`, you are either doing genuinely novel work (fine — then
distil what you learned back into these files) or you skipped the index.

## Keeping this honest

These files are a **lossy compression** of the source documents. That is the
point, and it is also the risk. Two rules keep it safe:

1. Anything load-bearing — an exact threshold, a contrast ratio, a legal
   constraint — is either copied verbatim with its source ID, or encoded in
   `requirements.json` / `tokens.css` where a tool can check it. Prose summaries
   carry judgement, never numbers you would act on.
2. When you discover the distillation is wrong or thin, **fix the context file
   in the same PR as the code**. Context that drifts from the documents is worse
   than no context, because it is trusted.
