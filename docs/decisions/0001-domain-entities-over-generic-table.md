# ADR 0001 — Domain entities rather than a generic table

**Status**: Accepted
**Date**: 2026-08-05

## Context

Results are most often _displayed_ as a table, which makes `columns` and `rows` an obvious
starting point for a results format. It is also how the earliest sketches of OpenResult were
drawn.

But a flat table cannot express half of the cases the format must cover. A football match is two
participants each holding their own score, not one row. A motocross meeting is a set of heats
feeding an overall standing. A hackathon is several jury criteria per team. Flattening these
loses the structure that makes the data useful — at which point a CSV would do the same job.

## Decision

Model the domain explicitly: `participants`, `events`, `results` and `measures`. Rows and columns
are display concepts and MUST NOT structure the normative model.

A head-to-head match is an event with two results. Heats feeding an overall standing are events
with a `parent`. Neither is a special case.

## Consequences

- Every target domain is expressible without an extension.
- A consumer can reason about _who_ competed and _in what_, not only about cell values.
- Documents are more verbose than a table would be, and a producer exporting from a spreadsheet
  has slightly more work to do. That cost is paid once, by the producer; the benefit is collected
  by every consumer.

## Alternatives considered

**Generic table with a semantic layer** — `columns` carrying a role (rank, identity, primary
measure) and a sort direction. Simple to generate, close to CSV, and genuinely tempting. Rejected
because it forces matches and heats to be flattened, destroying exactly the structure that
distinguishes OpenResult from a spreadsheet export.

**Hybrid: domain entities plus a generated tabular projection** — best of both, but two
representations to keep in sync, doubling the specification surface and inviting divergence.
Rejected as premature; a projection can be added later as a non-normative convenience.
