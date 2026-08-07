# OpenResult

**An open standard for describing results as JSON.**

A timing system, a benchmark harness, a league platform or a jury tool produces one OpenResult
document. Any compatible application can then rank it, chart it, export it, embed it or turn it
into a PDF — without knowing anything about the producer.

> **Status: draft.** The format is specified and implemented, and the tooling works. Field names
> and semantics may still change before 1.0 is declared final. Once it is, the compatibility
> guarantees in [specification §11](./specification/openresult-v1.md#11-versioning-and-compatibility)
> apply.

**[openresult.dev](https://openresult.dev)** — the specification, twenty worked examples, a
validator, a playground, and a viewer you can post a document to:

```sh
curl -X POST https://openresult.dev/view \
     -H 'Content-Type: application/json' \
     --data-binary @results.json
```

**Libraries**, published from CI with provenance attestations:

| Package                                                                      | For                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| [`@openresult/core`](https://www.npmjs.com/package/@openresult/core)         | Reading and ranking. No runtime dependencies      |
| [`@openresult/validate`](https://www.npmjs.com/package/@openresult/validate) | The schema plus the rules a schema cannot express |
| [`@openresult/viewer`](https://www.npmjs.com/package/@openresult/viewer)     | A web component that renders any document         |
| [`@openresult/cli`](https://www.npmjs.com/package/@openresult/cli)           | Validating and ranking from a shell or a build    |

---

## The problem

Results are everywhere and interoperable nowhere. Every organiser, every timing vendor and every
benchmark platform publishes in its own shape, so every display is rebuilt from scratch and
locked to whoever produced the data.

Generic formats do not close the gap. **A spreadsheet carries values but no meaning**: nothing
says which column is the rank, whether a lower time beats a higher one, or what `DNF` means.
**Ad-hoc JSON is readable only by its author.** **Vendor formats are vertical and closed.**

OpenResult carries the results **and what they mean**, so any consumer can rank and display them
correctly on its own.

## What it looks like

```json
{
  "openresult": "1.0",
  "title": "Crest Trail 2026 — 21 km",
  "measures": [
    {
      "id": "time",
      "label": "Time",
      "kind": "duration",
      "unit": "s",
      "precision": 1,
      "betterWhen": "lower"
    }
  ],
  "participants": [
    { "id": "p1", "name": "Léa Marchand" },
    { "id": "p2", "name": "Tomás Ferreira" },
    { "id": "p3", "name": "Nour Benali" }
  ],
  "results": [
    { "participant": "p1", "values": { "time": 5412.4 } },
    { "participant": "p2", "status": "dnf" },
    { "participant": "p3", "values": { "time": 5298.7 } }
  ],
  "rankings": [{ "id": "scratch", "label": "Scratch", "sortBy": ["time"] }]
}
```

There is no rank in this document. There does not need to be one — `betterWhen: "lower"` says a
smaller time wins, so any consumer derives the same standings:

```
$ openresult rank crest-trail.openresult.json

1  Nour Benali       1:28:18.7
2  Léa Marchand      1:30:12.4
—  Tomás Ferreira    did not finish
```

A derived rank is one you can verify. A rank you are handed must be taken on trust.

## Design principles

- **Meaning travels with the data.** Units, kinds and sort direction are part of the document.
- **Nothing to evaluate.** No expression language, no scoring formulas. Reading a document means
  reading values and applying a deterministic sort.
- **Presentation is a suggestion.** A document may hint at how it would like to be shown; a
  conforming consumer may ignore every hint and must still be right.
- **Published documents keep working.** Anything added is optional; anything unknown is ignored
  and preserved.

## Repository layout

| Path                                 | Contents                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| [`specification/`](./specification/) | The normative specification — the source of truth                   |
| [`schema/`](./schema/)               | The official JSON Schema (draft 2020-12)                            |
| [`examples/`](./examples/)           | 22 realistic documents across thirteen unlike domains               |
| [`conformance/`](./conformance/)     | Language-agnostic conformance suite, 133 cases                      |
| [`sdk/`](./sdk/)                     | Reference implementation in TypeScript                              |
| [`validator/`](./validator/)         | Command line and browser validators                                 |
| [`viewer/`](./viewer/)               | Embeddable viewer — renders any document with no configuration      |
| [`playground/`](./playground/)       | Paste a document, see it rendered and validated as you type         |
| [`docs/`](./docs/)                   | Vision, roadmap, implementation guide, governance, decision records |

## Getting started

```bash
pnpm install && pnpm build

pnpm openresult validate my-results.openresult.json   # check a document
pnpm openresult rank my-results.openresult.json       # see the derived standings
pnpm --filter @openresult/playground dev              # try the format live
```

Writing an implementation? Start with the
[implementation guide](./docs/IMPLEMENTATION-GUIDE.md), and see
[`minimal_reader.py`](./docs/examples/minimal_reader.py) — a complete reader in about 160 lines
of dependency-free Python.

## How the promises are kept

Twenty-eight repository checks run on every change. They exist because a principle nobody can
violate by accident is a property, while a principle enforced by good will is a wish.

```
$ pnpm check

✓ core-deps                no runtime dependency, 4.0 kB gzipped
✓ no-domain-logic          43 source files clean
✓ examples                 22 example(s) valid
✓ rule-coverage            117 rules by case, 22 otherwise (1 of them a gap), 139 declared
✓ spec-coherence           codes unique, rules ordered, index complete, links resolve
✓ conformance-manifest     133 cases, all runnable
✓ diagnostics-exercised    34 diagnostics, all exercised
✓ diagnostics-cite-rules   34 diagnostics: rule cited, location and correction carried
✓ schema-keywords-translated 18 schema keywords, all translated
✓ presentation-optional    185 rankings unchanged without hints (18 documents carry them)
✓ cross-implementation     131 rankings identical across two implementations
                           … and seventeen more
```

The last one is the one that matters most: the Python minimal reader and the TypeScript reference
implementation, written independently, agree on every ranking of every example. If they ever
disagree, the specification is ambiguous — and an ambiguous specification is the failure this
project exists to avoid.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/GOVERNANCE.md](./docs/GOVERNANCE.md). The most
valuable report you can file is an ambiguity: if two implementers can read a rule two ways, that
rule is broken regardless of what it was meant to say.

## Licence

- Source code: [Apache License 2.0](./LICENSE)
- Specification, schema, examples, conformance suite and documentation:
  [CC BY 4.0](./LICENSE-DOCS)

A specification anyone may implement has to be freely redistributable and quotable.
