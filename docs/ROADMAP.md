# Roadmap

Three horizons. Each one only opens when the previous one has met its exit criteria — a standard
that keeps changing while people are adopting it is not a standard.

---

## v1 — The format

**Goal**: a format that a third party can implement from the published documents alone, without
contacting anyone.

### Scope

| Area                     | Deliverable                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Specification            | Normative RFC-style document: terminology, concepts, versioning, compatibility, required and optional fields, types, rules, validation, examples |
| Schema                   | Official JSON Schema (draft 2020-12), versioned and addressable                                                                                  |
| Examples                 | Eleven realistic domains plus an edge-case library                                                                                               |
| Conformance              | Declarative, language-agnostic suite, with expected derived rankings                                                                             |
| Reference implementation | TypeScript: read, rank, validate                                                                                                                 |
| Validator                | Command line and browser                                                                                                                         |
| Viewer                   | Embeddable web component, automatic view selection, four views                                                                                   |
| Playground               | Paste a document, see it rendered and validated as you type                                                                                      |
| Governance               | Evolution process, versioning policy, decision records                                                                                           |

### Deliberately out of v1

Multiple languages in one document, cross-document identity, live results, charts and timeline
views, ports beyond the reference implementation.

### Exit criteria

- A developer unfamiliar with the project produces a valid document for their own domain in under
  thirty minutes, from the published documents alone.
- All eleven domains are expressible without a proprietary extension.
- Every example renders correctly in the viewer with no per-example configuration.
- The conformance suite covers every normative rule.
- A minimal reader fits in under two hundred lines with no dependency.

---

## v2 — Adoption

**Goal**: many independent implementations, and the semantic gaps that only real usage reveals.

### Scope

**Ports.** PHP, Python, Go, C#, Java and Rust, each proven by the conformance suite. Nothing is
written before v1 freezes: an implementation built against a moving format is thrown away.

**More views.** Charts, timeline and statistics. The v1 viewer ships the extension mechanism and
four views that prove it works; the catalogue grows here.

**Multilingual documents.** v1 carries one language per document, declared. Multiple languages in
a single document is a real need for international events, and a real complication — it waits
until the core has stopped moving.

**Unit vocabulary.** v1 leaves `unit` a free string. A published, recommended vocabulary lets
consumers group and convert with confidence, without ever making conversion the format's job.

**Media type registration.** `application/vnd.openresult+json` with IANA.

**Partial and live results.** Ordering semantics for a competition still in progress, and how a
consumer should treat a document that will be superseded within minutes.

### Exit criteria

- At least three implementations, in three languages, from at least two independent authors, all
  passing the conformance suite.
- Documented production use by producers outside the project.
- No breaking change to the format since 1.0 — every v2 addition is optional.

---

## v3 — Ecosystem

**Goal**: what becomes possible once the format is everywhere.

### Scope

**Cross-document identity.** Linking the same participant across events and seasons, without a
central registry — the hard part is doing it without inventing an authority.

**Aggregation.** Deriving a season standing from a set of event documents, as a specified
operation rather than each consumer's private interpretation.

**Provenance and signature.** Verifiable attribution, so a consumer can establish that a document
genuinely comes from the organiser it claims. Increasingly relevant as results feed automated
systems.

**Large datasets.** v1 targets thousands of results. A compact encoding may become necessary for
orders of magnitude beyond, without changing the model.

**Reference services.** Public validation and rendering endpoints, so a producer can publish
without hosting anything.

### Exit criteria

Deliberately unset. v3 is a direction, not a commitment: what belongs there will be decided by
what v2 adoption actually demands, through the published evolution process.

---

## What will never be in scope

The exclusions in [VISION.md](./VISION.md) are permanent, not a backlog. Transport, storage,
business computation and visual styling stay outside the format regardless of demand. Crossing
any of them requires amending the project constitution, not filing an issue.

The rule of thumb: **if a change makes a minimal reader longer, it needs an extraordinary
justification.**
