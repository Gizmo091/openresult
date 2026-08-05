# ADR 0005 — TypeScript as the reference language

**Status**: Accepted
**Date**: 2026-08-05

## Context

The reference implementation could be written in any language. Rust would be faster, Python
friendlier to data producers, Go simpler to deploy.

But the viewer, the web validator and the playground all run in a browser, where the language is
imposed. Choosing a different language for the library means writing the ranking derivation
**twice** — and the specification requires that two consumers produce identical rankings. A
duplicated engine is the first place that guarantee would break, and it would break inside the
project's own tools.

## Decision

Write the reference implementation in TypeScript, targeting ES2022, running on Node.js 22 LTS and
evergreen browsers.

## Consequences

- One derivation engine, shared by the library, the validator and the viewer. Determinism is
  structural rather than aspirational.
- Types can be derived from the schema and used to keep the specification honest.
- Distribution through npm reaches both server and browser without a port.
- Raw throughput is lower than a compiled language would give. Irrelevant at the target scale:
  thousands of results, not millions.

## Alternatives considered

**Rust compiled to WebAssembly** — one engine, better performance, memory safety. Rejected: the
payload is incompatible with an embeddable widget, and the contribution barrier is high for a
project whose success depends on adoption.

**Python** — excellent for the producing side, unusable in the browser. Rejected.

**Go** — same limitation as Rust without its WebAssembly payload advantage. Rejected.
