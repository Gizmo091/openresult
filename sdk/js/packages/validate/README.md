# @openresult/validate

Validate [OpenResult](https://openresult.dev) documents against the published schema **and** the
rules a schema cannot express.

```sh
npm install @openresult/validate
```

A document can be structurally perfect and still be wrong: a result naming a participant that does
not exist, a ranking that selects nothing, a category with no members, a cycle in an event
hierarchy. Those are the interesting failures, and they are what this package finds.

```js
import { validate } from '@openresult/validate';

const report = validate(document);

if (!report.valid) {
  for (const problem of report.errors) {
    console.error(problem.code, problem.path, problem.message);
    console.error('  →', problem.suggestion);
    console.error('  ', problem.rule); // e.g. "spec §7.1.1"
  }
}
```

Every diagnostic carries an RFC 6901 pointer into the document, a suggestion, and **the rule it
comes from**. A validator that says "invalid" and stops teaches nobody anything, so each of the 32
codes names a numbered rule you can read.

Warnings are separate from errors: a document that warns is still a valid document. `OR-902` — a
published position that disagrees with the derived one — is a warning because the producer may
have applied a tie-break the document cannot express.

## Content Security Policy

The schema is compiled ahead of time rather than with `new Function`, so this works under
`script-src 'self'` without `'unsafe-eval'` — the policy any page rendering documents from
strangers should have.

## Options

```js
validate(document, { strict: true }); // warnings become errors
validate(document, { schemaOnly: true }); // structure only, no semantic rules
```

The full diagnostic catalogue is at
[specification §12.2](https://openresult.dev/spec/#122-diagnostics).

## Licence

Apache-2.0.
