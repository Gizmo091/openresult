# Schema

The official JSON Schema for OpenResult.

| File                                                         | Format version | Dialect                   |
| ------------------------------------------------------------ | -------------- | ------------------------- |
| [`openresult-1.0.schema.json`](./openresult-1.0.schema.json) | 1.0            | JSON Schema draft 2020-12 |

## The specification is normative, the schema is not

Where the two disagree, [`specification/openresult-v1.md`](../specification/openresult-v1.md)
wins and the schema is the bug. A repository check verifies that every member described in the
specification appears in the schema and vice versa, so the disagreement should be caught before
it is published.

A schema cannot express the semantic rules — referential integrity, ranking coherence, cycle
detection. Those live in the validator and are listed in specification §12.2. **A document that
passes the schema is not necessarily conforming.**

## Addressing

Each format version has its own file and its own permanent `$id`:

```
https://openresult.org/schema/openresult-1.0.schema.json
```

A published schema is **never modified in place**. A MINOR version that adds optional members
gets a new file and a new `$id`; the previous file stays reachable forever, because documents in
the wild reference it.

## Versioning policy

| Change                             | Version impact          |
| ---------------------------------- | ----------------------- |
| Adding an optional member          | MINOR                   |
| Adding an enumeration value        | MINOR                   |
| Adding a warning-level rule        | MINOR                   |
| Making an optional member required | **MAJOR**               |
| Removing a member                  | **MAJOR**               |
| Narrowing a value domain           | **MAJOR**               |
| Changing the derivation algorithm  | **MAJOR**               |
| Editorial change, description text | none — no republication |

Any document valid under 1.0 stays valid under every later 1.x (specification §11.2.1).

## Extensions

Members prefixed `x-` are permitted on the document and on every entity. Every other unknown
member is rejected, which is deliberate: it turns a misspelled `participants` into a validation
error rather than silently discarded data.

The mechanism is `patternProperties: { "^x-": true }` combined with
`unevaluatedProperties: false` — the reason the schema requires draft 2020-12 rather than an
older dialect.

## Usage

```bash
# With the project validator, which also applies the semantic rules
openresult validate my-results.openresult.json

# With any generic JSON Schema tool — structural conformance only
ajv validate -s schema/openresult-1.0.schema.json -d my-results.openresult.json --spec=draft2020
```

## Licence

[CC BY 4.0](../LICENSE-DOCS).
