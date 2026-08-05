# ADR 0016 — camelCase names, opaque identifiers

**Status**: Accepted
**Date**: 2026-08-05

## Context

Field naming in a standard matters less for its choice than for its consistency: an
inconsistently named format is unpleasant to write and error-prone to read.

Identifiers raise a separate question. Producers assign them, and they end up in URLs, document
fragments and CSS selectors — all places where an unconstrained string causes escaping problems.

## Decision

Field names are `camelCase`, in English, without abbreviations.

Producer-assigned identifiers — participant, event, measure, attribute, category — are **opaque
strings** limited to `[A-Za-z0-9_-]`, unique per collection within a document, and carry no
imposed meaning.

## Consequences

- One convention throughout; no exception to memorise.
- An identifier can appear in a URL or a selector without escaping.
- Consumers must not infer anything from an identifier's shape. This is enforced by keeping them
  opaque in the specification: any meaning would be an implicit semantics nothing validates.
- Identifiers are document-scoped only. Reconciling participants across documents is out of scope
  for v1.

## Alternatives considered

**`snake_case`** — more readable to some audiences. Rejected: no decisive advantage, and it
breaks with prevailing JSON practice.

**Structured identifiers such as `heat:1` or `p/12`** — self-describing. Rejected: they establish
an implicit convention nothing validates and every producer would read differently.

**Mandatory UUIDs** — guaranteed uniqueness. Rejected: they defeat the hand-readability
requirement. UUIDs remain permitted, simply not required.
