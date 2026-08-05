# ADR 0012 — One field declares the format version

**Status**: Accepted
**Date**: 2026-08-05

## Context

Two things need versioning and they are routinely confused: the **format** a document conforms
to, and the **content** of the document itself. Early sketches had a `spec` field and a `version`
field, with nothing indicating which was which.

Content versioning is not optional in this domain. Results are published provisionally, then
amended after a jury ruling. Two documents describing the same event will disagree, and something
has to say which one stands.

## Decision

The root field `openresult` carries the **format** version, as `MAJOR.MINOR` — `"1.0"`. A
separate optional `version` field carries the **content** version as a strictly increasing
integer, alongside `status` (`draft`, `provisional`, `official`, `amended`).

Between two documents sharing an `id`, the higher `version` wins; at equal `version`, `official`
or `amended` outranks `provisional`.

## Consequences

- No ambiguity: the field is named after the format.
- The provisional-to-official lifecycle is expressible, which no generic tabular format offers.
- Declaring only major and minor spares producers from republishing over editorial patches.
- A producer must manage its own content versioning to benefit from amendment semantics. Optional,
  and only needed by those who publish provisional results.

## Alternatives considered

**`spec` plus `version`, as first sketched** — rejected: ambiguous by construction.

**Full `1.0.0`** — rejected: patch-level precision buys nothing for a consumer and forces
producers to track releases that cannot affect them.

**Version in the media type only** — rejected: documents are shared as files as often as over
HTTP, and a file must be self-describing.
