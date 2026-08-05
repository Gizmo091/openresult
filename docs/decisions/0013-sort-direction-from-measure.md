# ADR 0013 — Sort direction comes from the measure

**Status**: Accepted
**Date**: 2026-08-05

## Context

Deriving a ranking ([ADR 0003](./0003-rank-is-optional-ranking-is-derived.md)) requires knowing,
for each criterion, whether a higher or a lower value wins. The conventional design puts that
direction in the sort clause: `sortBy: [{ measure: "time", direction: "asc" }]`.

That allows a document to declare `betterWhen: "lower"` on a duration and then sort it
descending. Nothing in the document can settle which of the two is right, so no validator can
arbitrate.

## Decision

A ranking declares only an ordered list of measures: `sortBy: ["points", "time"]`. Direction
comes exclusively from `betterWhen` on each measure. A measure with `betterWhen: "none"` may not
appear in a `sortBy`.

## Consequences

- One source of truth for direction; the contradiction cannot be expressed.
- The meaning travels with the measure, so it is available everywhere the measure is used — in
  ranking, in display, in comparison views.
- Derivation reduces to a stable sort over declared values, which makes the required determinism
  demonstrable rather than hoped for.
- An unusual case that needs the opposite direction must declare a separate measure. This is more
  verbose, and deliberately so: it is a declarative solution rather than an evaluated one.

## Alternatives considered

**Direction per sort criterion** — more flexible. Rejected: it permits contradictions no
validator can resolve, and weakens the semantics carried by the measure.

**A compact sort expression such as `"-points,time"`** — terse and familiar from query strings.
Rejected: it introduces a micro-syntax requiring a parser in all seven target languages, which is
exactly what the simplicity principle forbids.
