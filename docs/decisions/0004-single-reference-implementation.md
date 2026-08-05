# ADR 0004 — One reference implementation for v1

**Status**: Accepted
**Date**: 2026-08-05

## Context

A standard needs implementations in many languages: PHP, JavaScript, Python, Go, C#, Java, Rust
are all on the horizon. Shipping several at once would prove the specification is portable.

It would also guarantee rewriting them. A format under active design changes; every
implementation written before it settles is throwaway work, multiplied by the number of
languages.

## Decision

Ship a single reference implementation in v1. Design the implementation architecture — the
responsibilities a library must carry, the conformance levels it must meet — so that ports can
follow without renegotiating anything.

## Consequences

- Effort stays where it matters in v1: the format itself.
- The specification's portability is not yet proven by a second implementation. The conformance
  suite mitigates this by being declarative and language-agnostic, so a port can be checked the
  day it appears.
- Early adopters get one library rather than seven. Acceptable: at this stage the specification
  and the schema are what adopters actually need.

## Alternatives considered

**Two implementations in deliberately distant languages** — the real portability test, since any
ambiguity in the specification surfaces immediately. Rejected for v1 on cost, and because a
double rewrite is likely while the format is still moving. This is the first thing to do once the
format freezes.

**No implementation: specification, schema and web tooling only** — freezes the format first,
zero rewriting. Rejected: the viewer and validator need a library anyway, and building one is
what surfaces the specification's blind spots.
