/**
 * Pure domain logic. Imports nothing but types — no React, no components.
 * `context/40-architecture.md`: if a component contains a comparison between
 * two severities, that comparison belongs here.
 */
export * from './severity.ts';
export * from './provenance.ts';
export * from './command.ts';
export * from './restriction.ts';
export * from './loadState.ts';
export * from './role.ts';
export * from './freshness.ts';
export * from './comfort.ts';
