# Working with other agents

## An argument against reflexive parallelism

Multi-agent is not free and it is not always better. Parallel agents burn
roughly an order of magnitude more tokens than a single session, and on a shared
React codebase most of that goes into re-deriving context and resolving write
conflicts that a single agent would never have created.

Parallelism pays where the work **fans out on reads and converges on one
writer**: exploring a codebase, auditing a screen from four angles, generating
design variants, reviewing a diff. It loses where several agents write into the
same tree with an incomplete picture of each other's work.

So the split used here:

- **Parallel** — exploration, review, audit, design variants, requirement tracing.
- **Serial, with strict directory ownership** — implementation.

If you were told to "use agents" and the task is one implementation change,
implement it. Spawning three agents to write one component is theatre.

## Before you start

1. Read `CLAUDE.md` (already loaded) and the **one** context file your task
   needs. Not all of them.
2. Check `npm run trace` — is your requirement already claimed by a file?
3. Confirm you own the directory you are about to write to (`40-architecture.md`).
   If you do not, say so and stop rather than editing across the line.

## While you work

- **Run `npm run verify` before you report anything as done.** It is the shared
  definition of "not broken". A branch that fails it is not ready to hand over.
- **Small, complete units.** One screen or one pattern, finished — including its
  `loading` / `empty` / `error` / `noData` states — beats four half-screens. A
  half-built screen reported as done is worse than an unbuilt one, because
  nobody checks it again.
- **Append to locale files, never edit another agent's keys.** Namespace yours:
  `client.overview.heroTitle`, not `heroTitle`.
- **Need something from an owned directory?** Ask for it, or write it against a
  documented interface and flag the dependency. Do not reach in.

## When you finish

Report in this shape. It is what the next agent needs and nothing more:

```
Requirement(s):  FR-10, FR-15
Files:           src/features/client/Overview.tsx (+3)
Verify:          pass
Not done:        empty state for the maintenance timeline — needs the
                 work-order shape from the platform agent
Decisions:       used a tinted severity chip rather than a filled badge
                 (no legal foreground across all four marks)
Open questions:  none
```

**"Not done" is the most valuable line.** Silence there is read as completeness,
and that is how a sprint arrives at a demo with three broken screens nobody
flagged.

## Conflicts between documents

D5, D6, D7 and D8 genuinely disagree in places — D8 itself found 36 such
findings. When you hit one:

1. **Stop. Do not silently pick.** The plausible choice is wrong about half the
   time, and a silent pick is undiscoverable later.
2. Check `context/decisions/` — it may already be adjudicated.
3. If not, write an ADR: what conflicts, what each document says, what you chose,
   **with evidence**, and how to reverse it. Then proceed.
4. Precedence when nothing else decides it:
   **D8 review > D7 (visual) > D6 (behavioural) > D5 (intent) > inference**.
   D8 is the adjudicating document; it is the most recent and it exists
   specifically to resolve the others.

Two conflicts are already recorded. Read `ADR-0001` and `ADR-0002` before
touching colour.

## Escalate rather than guess

Stop and ask when: a change needs a new token; a requirement contradicts an
invariant; the task needs one of the five recognised gaps in
`30-design-system.md`; or an open decision (`OD-01`, `OD-02`) blocks the work.

Guessing on these is not speed. It is rework with a delay fuse.
