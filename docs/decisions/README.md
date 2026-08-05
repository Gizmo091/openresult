# Architecture Decision Records

Every structural decision about OpenResult is recorded here with its context, the alternatives
weighed, and the reason for the choice. A decision whose rationale has been lost is
indistinguishable from an oversight — and a successor will "fix" it, reopening a settled debate
and breaking something in the process.

Records are never edited in place. Superseding one means writing a new record and marking the old
one `Superseded by`.

## Format decisions

| ADR                                                   | Title                                                               | Status   |
| ----------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| [0001](./0001-domain-entities-over-generic-table.md)  | Domain entities rather than a generic table                         | Accepted |
| [0002](./0002-presentation-is-non-normative.md)       | The presentation layer is non-normative                             | Accepted |
| [0003](./0003-rank-is-optional-ranking-is-derived.md) | Rank is optional; ranking is derived by the consumer                | Accepted |
| [0009](./0009-numeric-durations.md)                   | Durations are plain numbers, not ISO 8601                           | Accepted |
| [0010](./0010-rfc3339-dates.md)                       | Dates use RFC 3339 with a mandatory offset                          | Accepted |
| [0011](./0011-x-prefix-extensions.md)                 | Extensions use the `x-` prefix                                      | Accepted |
| [0012](./0012-version-declaration.md)                 | One field declares the format version                               | Accepted |
| [0013](./0013-sort-direction-from-measure.md)         | Sort direction comes from the measure                               | Accepted |
| [0016](./0016-naming-and-identifiers.md)              | camelCase names, opaque identifiers                                 | Accepted |
| [0017](./0017-bye-is-a-status.md)                     | `bye` is a status, and it ranks                                     | Accepted |
| [0018](./0018-not-classified-is-a-status.md)          | `notClassified` is a status; `OR-908` only warns on partial records | Accepted |
| [0019](./0019-ties-resolved-outside-the-document.md)  | `ties: "resolved"`; `description` on every named entity             | Accepted |

## Project decisions

| ADR                                               | Title                                          | Status   |
| ------------------------------------------------- | ---------------------------------------------- | -------- |
| [0004](./0004-single-reference-implementation.md) | One reference implementation for v1            | Accepted |
| [0005](./0005-typescript-reference-language.md)   | TypeScript as the reference language           | Accepted |
| [0006](./0006-dependency-free-core.md)            | The core package carries no runtime dependency | Accepted |
| [0007](./0007-json-schema-2020-12.md)             | JSON Schema draft 2020-12, validated with Ajv  | Accepted |
| [0008](./0008-web-components-for-viewer.md)       | The viewer is a Web Component built with Lit   | Accepted |
| [0014](./0014-declarative-conformance-suite.md)   | The conformance suite is declarative           | Accepted |
| [0015](./0015-pnpm-workspaces.md)                 | pnpm workspaces and Vite                       | Accepted |

Use [_template.md](./_template.md) for new records.
