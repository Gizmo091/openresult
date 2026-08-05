# ADR 0002 — The presentation layer is non-normative

**Status**: Accepted
**Date**: 2026-08-05

## Context

A producer often knows how its results are best displayed: as a podium, a timeline, a comparison.
It is natural to let the document say so, and equally natural to expect consumers to obey.

The risk is well documented. GeoJSON deliberately refuses to carry styling, and that refusal is a
large part of why it has survived unchanged for over a decade. Display needs never stop evolving;
a format that encodes them cannot stabilise, and ends up as a private rendering language — the
exact coupling OpenResult exists to remove.

## Decision

Split the format into three layers: **data** and **semantics**, both normative; and
**presentation**, which is not.

A consumer that deletes the `presentation` object MUST still produce a correct interpretation and
a correct rendering. The specification MUST NOT require a conforming consumer to honour any
presentation hint.

## Consequences

- The core of the format can be frozen while display practice keeps moving.
- View selection is driven by semantics — measures, statuses, event structure — so a document
  renders sensibly even in a consumer that has never heard of it.
- A producer cannot _guarantee_ a particular rendering. This is intended: guaranteeing a rendering
  is what a rendering engine does, and depending on one is the problem being solved.
- The property is testable, and is tested: every conformance case runs twice, with and without
  the presentation layer, and both runs must yield the same ranking.

## Alternatives considered

**Defer presentation to v2** — smallest possible v1, easiest to freeze. Rejected narrowly: a
producer would have no way at all to express intent, and the layer costs nothing as long as it
stays ignorable.

**Make presentation normative** — predictable rendering, faithful to producer intent. Rejected:
it freezes a presentation language inside a standard meant to last a decade, and recreates the
coupling to a rendering engine.
