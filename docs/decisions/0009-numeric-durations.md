# ADR 0009 — Durations are plain numbers, not ISO 8601

**Status**: Accepted
**Date**: 2026-08-05

## Context

Durations are the most common measure in results, and the most tempting to encode as text:
`21:24.532` reads naturally, `PT21M24.532S` is standardised.

Both require a parser. The format has to be generatable — and consumable — in any language
without one.

## Decision

Every quantity is a **JSON number**, expressed in the unit its measure declares. Durations are
decimal seconds (`1284.532`). No structured strings, no ISO 8601 durations, no `mm:ss.SSS`.

## Consequences

- Producing a document requires nothing beyond a JSON encoder, in any language.
- Values are directly comparable, so sorting needs no conversion step.
- Display formatting is the consumer's job, and it has what it needs: `kind`, `unit` and
  `precision`.
- Documents are slightly less readable raw — `1284.532` is not obviously 21 minutes. Accepted:
  readability of a _rendered_ result matters more than readability of the wire format, and the
  tooling formats it.
- Precision holds: one millisecond over a 24-hour duration stays far inside double-precision
  range.

## Alternatives considered

**ISO 8601 durations** — standardised and explicit. Rejected: costly to produce and to consume,
and unusable in arithmetic without conversion.

**Integer milliseconds** — sidesteps floating point entirely. Rejected: it forces an arbitrary
unit onto quantities that are not durations, and hurts raw readability further.

**Human-formatted strings** — readable as-is. Rejected: it merges data with presentation, which
the format exists to separate.
