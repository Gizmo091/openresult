# ADR 0014 — The conformance suite is declarative

**Status**: Accepted
**Date**: 2026-08-05

## Context

A standard without a shared test suite produces as many interpretations as implementations, and
interoperability becomes a slogan. The suite has to be usable by ports that do not exist yet, in
languages not chosen yet.

## Decision

The suite is declarative JSON, free of any programming language. Each case pairs an input
document with an expected outcome: a verdict and diagnostic codes for invalid cases, and the
**expected derived ranking** for valid ones. A manifest indexes the cases and records, for each,
the normative rule it exercises.

## Consequences

- Any implementation in any language can run it. A port is checkable the day it appears.
- Carrying the expected ranking is what actually tests
  [ADR 0003](./0003-rank-is-optional-ranking-is-derived.md): without it, the suite would only
  confirm that a document is acceptable, never that it is ordered correctly.
- Ranking arrays are compared as sequences, which verifies the sort's stability — the last
  possible source of non-determinism.
- The rule cross-reference makes coverage measurable: a repository check fails when a normative
  rule is exercised by no case.
- Only codes and paths are compared, never message text, so rewording a diagnostic does not break
  the suite or force ports to translate identically.

## Alternatives considered

**Tests written in each implementation's language** — more expressive, better tooling. Rejected:
it guarantees divergence between implementations, which is the failure mode being prevented.

**Expected full output documents rather than verdicts** — stricter comparison. Rejected: any
editorial change to a diagnostic would break the suite.
