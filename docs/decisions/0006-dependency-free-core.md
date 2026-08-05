# ADR 0006 — The core package carries no runtime dependency

**Status**: Accepted
**Date**: 2026-08-05

## Context

The format promises that a minimal reader — one that loads a document and displays a correct
ranking — fits in about 200 lines with nothing but a JSON parser. That promise is easy to state
and easy to erode: one convenient dependency at a time, until reading a document means installing
a tree.

Schema validation genuinely needs a library. Reading and ranking do not.

## Decision

Split the reference implementation into three packages. `@openresult/core` — reading, semantic
access, ranking derivation — declares **no runtime dependency**. `@openresult/validate` holds
schema validation and its dependencies. `@openresult/conformance` runs the suite.

The constraint is enforced by a repository check that fails if `core` acquires a dependency or
exceeds 15 kB minified and compressed.

## Consequences

- The constraint is a property of the dependency graph, not an intention. It cannot rot silently.
- A consumer that trusts its source can read and rank without shipping a validator.
- The viewer stays small enough to embed in a third-party page.
- Slightly more packaging work, and users must know which package they need. A negligible cost
  against a guarantee that would otherwise be unenforceable.

## Alternatives considered

**A single package with conditional exports** — simpler to publish and to consume. Rejected: the
dependency-free property becomes declarative again, and nothing prevents a future contributor
from importing a helper into the read path.

**Validation built into the core** — convenient, one import. Rejected: it breaks the 200-line
promise and multiplies the payload for every consumer, including those that never validate.
