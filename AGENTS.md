# Agent instructions

This project's agent context lives in **`CLAUDE.md`** (router) and
**`context/`** (the pack). Read `CLAUDE.md` first, then the single context file
your task needs — `context/00-INDEX.md` is the map.

The gate is `npm run verify`. Run it before reporting work as done.

Cursor users: `.cursor/rules/` mirrors the same rules, scoped by glob so they
attach automatically to the files you have open.
