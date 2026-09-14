---
description: Build one Phase 1A screen end to end, from its requirements
argument-hint: <screen-id, e.g. client.overview>
---

Build the screen `$1` completely.

1. Pull its spec:
   ```bash
   node -e "const s=require('./context/requirements/requirements.json');
     const sc=s.screens.find(x=>x.id==='$1');
     if(!sc){console.error('unknown screen. options:');s.screens.forEach(x=>console.error(' ',x.id));process.exit(1)}
     console.log(JSON.stringify(sc,null,2));
     sc.satisfies.forEach(id=>console.log(JSON.stringify(s.requirements.find(r=>r.id===id),null,2)))"
   ```
2. Read `context/30-design-system.md` and `context/20-domain.md`.
3. Check `src/components/` and `src/patterns/` for existing primitives. Request
   anything missing from design-system-guardian — do not build a local variant.
4. Build it: all four data states, both locales, data via `src/lib/simulation/`,
   `@requirement` tags in the header.
5. `npm run verify`, then report using the shape in
   `context/50-agent-protocol.md` — with a specific **Not done** line.
