# ADR 0011 — Extensions use the `x-` prefix

**Status**: Accepted
**Date**: 2026-08-05

## Context

No format anticipates every domain. Producers will need to carry information the specification
does not define — a licence number, an internal identifier, a discipline-specific detail. Without
a sanctioned mechanism they will invent one, and consumers will break on it.

The opposite risk matters just as much: if any unknown property is tolerated, a misspelled
`participants` becomes silently discarded data rather than an error.

## Decision

Extensions are properties prefixed with `x-`, allowed on the document and on every entity. The
schema permits them explicitly and **rejects every other unknown property**.

Consumers MUST ignore unknown extensions, and MUST preserve them when rewriting a document.

## Consequences

- Ignoring an extension is a prefix test — trivial in any language.
- A typo is a validation error, because it is neither a known property nor prefixed.
- The convention is immediately familiar: it is OpenAPI's.
- Collisions between two producers using `x-timing` remain possible. Accepted for v1; namespacing
  can be layered on later without breaking anything.

## Alternatives considered

**A single `extensions` object per entity** — tidier grouping. Rejected narrowly: it adds a level
of nesting and complicates preservation during partial rewrites.

**URI namespaces, JSON-LD style** — rigorous and collision-free. Rejected: conceptual weight out
of proportion to the problem, against the simplicity principle.

**Tolerate any unknown property** — maximum flexibility. Rejected: it removes typo detection
entirely, which is one of the main reasons to publish a schema.
