# src/features/shared

Owner: **the shared-surfaces agent**

This directory holds:

- the D2 objects used by more than one role — unit, space, alert, work order
  and device;
- every action panel;
- the shell surfaces that every role opens — profile, assistant, search and
  method.

Each is one component set with role variants. Role agents compose them and
never copy one (ADR-0008). An object used by only one role stays in that role's
directory.

See `context/40-architecture.md` for the full ownership table and the
dependency direction (features → patterns → components → design-system).
