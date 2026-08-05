# OpenResult

**An open standard for describing results as JSON.**

A timing system, a benchmark harness, a league platform or a jury tool produces one OpenResult
document. Any compatible application can then rank it, chart it, export it, embed it or turn it
into a PDF — without knowing anything about the producer.

> **Status: work in progress.** The format is being specified. Nothing here is stable yet.

---

## The problem

Results are everywhere and interoperable nowhere. Every organiser, every timing vendor and every
benchmark platform publishes in its own shape, so every display is rebuilt from scratch and
locked to whoever produced the data.

Generic formats do not close the gap:

- **CSV** carries values but no meaning. Nothing says which column is the rank, whether a lower
  time beats a higher one, or what `DNF` means. No consumer can render it automatically.
- **Ad-hoc JSON** is readable only by the application that emitted it.
- **Vendor formats** are vertical, often paid, and never portable across disciplines.

OpenResult carries the results **and what they mean**, so that any consumer can rank and display
them correctly on its own.

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

There is no rank in this document. There does not need to be one: `betterWhen: "lower"` says a
smaller time is better, so any consumer derives the same ranking — and a derived rank is one you
can verify, unlike a rank you are handed.

## Design principles

- **Meaning travels with the data.** Units, kinds and sort direction are part of the document.
- **Nothing to evaluate.** No expression language, no scoring formulas. Reading a document means
  reading values and applying a deterministic sort — a minimal reader fits in 200 lines with no
  dependency beyond a JSON parser.
- **Presentation is optional.** A document may suggest how to display itself; a consumer is never
  required to listen. Drop the presentation layer and the ranking is unchanged.
- **Published documents keep working.** Anything added is optional; anything unknown is ignored
  and preserved.

## Repository layout

| Path             | Contents                                                            |
| ---------------- | ------------------------------------------------------------------- |
| `specification/` | The normative specification — the source of truth                   |
| `schema/`        | The official JSON Schema                                            |
| `examples/`      | Realistic documents across eleven very different domains            |
| `conformance/`   | Language-agnostic conformance test suite                            |
| `sdk/`           | Reference implementation                                            |
| `validator/`     | Command-line and browser validators                                 |
| `viewer/`        | Embeddable viewer — renders any document with no configuration      |
| `playground/`    | Paste a document, see it rendered and validated as you type         |
| `docs/`          | Vision, roadmap, implementation guide, governance, decision records |

## Getting started

```bash
pnpm install
pnpm build
pnpm check
```

## Licence

- Source code: [Apache License 2.0](./LICENSE)
- Specification, schema, examples, conformance suite and documentation:
  [CC BY 4.0](./LICENSE-DOCS)

A specification anyone may implement has to be freely redistributable and quotable.
