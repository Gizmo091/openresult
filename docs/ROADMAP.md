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

## Known gaps

Every entry here came from someone building a real document from the specification alone, in a
domain the corpus does not cover. They are recorded rather than fixed because each one is a
change to the model, not a correction, and v1 is meant to stabilise.

**A result belongs to one competitor.** A wine judged by six jurors is six facts about one wine,
and §7.1.3 allows one result per (participant, event) pair. The way out was to declare
each juror as an event — twenty-four of them — which works and reads badly, and which loses the
juror's identity to a text attribute. The same shape appears wherever an assessor is not a
competitor: inter-annotator agreement in model evaluation, panels in judged sport, marking in
examinations.

**A group of results that is deliberately unordered.** A wine competition publishes medals against
thresholds under a quota, and placing a wine fourth of six is what its rules forbid the organiser
to do. §8.6.1 makes a document without `rankings` rankable anyway, and §8.6.2 only escapes when
every measure is `betterWhen: "none"`, which then makes the medal thresholds inexpressible. A
consumer will render "3rd of 6" for a fact the competition does not publish.

**A standing after each round.** A stage race changes leader daily, and that is the story of the
race. §8.1.4 requires a computed standing to be published as results on the event it is scoped to,
so six intermediate general classifications cost six events and about a hundred and seventy
results, each republishing a cumulative time that already exists. All six were computed
six — they are needed to award the jerseys — and published none.

**An attribute holds one value.** A rider leading two classifications wears one jersey and is
entitled to another. `jersey` is a scalar, §5.3.1 has no list type, and §1.2.3 forbids
`"yellow,polka"`. The alternatives are a boolean attribute per jersey, growing with the race, or
prose in `notes`.

**`precision` belongs to the measure, not the event.** Road stages are timed to the second and an
individual time trial to the hundredth. One measure carries one precision, so a race with both
either loses the hundredths or shows `4:12:33.00` for five days. The time trial was removed
from their document rather than publish that.

**Zero against absent, when a ranking should list only those who scored.** A mountains
classification lists riders who took points, not the whole field on nought. Expressing that means
omitting the measure for non-scorers, but §7.3.2 says an absent measure is unavailable — and their
zero is perfectly available. Publishing the zeros means accepting a nine-way tie for
eighteenth.

**A relation between measures.** Nothing says that a retained score is the aggregate of four
criteria, or that an average is derived from what it averages. Producers dedupe by naming
convention, which no consumer can read.

**A result with more than one holder.** In alliance formats — FIRST Robotics, and the same shape in
doubles, crews, ropes and pairs — one score belongs to several competitors at once, and the
grouping is thrown away after the match. §2.2 and §7.1.3 make a result belong to exactly one
participant, so it forced a participant per alliance **per match**: 26 of their 42
participants did not exist, and the count grows with the number of matches rather than the number
of teams. At a real regional that is around 140 fictions for 40 teams.

One candidate is an optional, purely informative `coParticipants` on a result — additive, ignored by
derivation, exactly the status a published rank already has. It would remove the fictions. What it
does not solve is which competitor the result then belongs to: `participant` stays required, so an
alliance score still has to name one of its three teams as the holder, which is arbitrary in a way
the format currently avoids by being honest about the fiction. That is why this is recorded rather
than done.

**A link between a penalty and the points it awards.** Three fouls by one alliance credit eighteen
points to the other, and the format writes that single fact as two unrelated numbers on two
results. A consumer cannot render "18 pts (red alliance fouls)" without knowing the sport — which
is what §1.1 exists to prevent.

**A bracket.** Nothing says the winner of the first semi-final plays the final. `parent` is
containment, not progression, so a knockout draw cannot be drawn from the document. The same gap
affects tennis, judo and esport.

**"Not applicable", distinct from "not recorded".** In a play-off phase where no ranking points
are awarded, the bonus measures do not exist rather than being unknown. §7.3.2 offers a value,
zero, or absent — and absent means unknown.

**A ranking that skips results by an attribute.** A surrogate match is played, is real, and does
not count. `scope` selects by event and category only, so the document publishes five match lines
and a `matchesPlayed` of four, and the only thing explaining the gap is an attribute no rule
reads. The alternative — putting surrogate matches on their own event — takes them out of the
calendar they belong to.

## Rules nothing enforces

A normative rule the validator does not check is a rule a producer will break without ever being
told. These are the ones in that state, listed so that the gap is visible rather than discovered.

**§5.2.6 — a `count` unit must name what is counted.** `n`, `#` and `no` name nothing, and a
figure that counts nothing cannot be labelled. The rule is a MUST and no diagnostic reports it;
`unit-vocabulary` enforces the vocabulary over this repository's own documents, which catches it in
the corpus and nowhere else. Enforcing it needs a code of its own — a warning, since the document
still reads perfectly — and the judgement of what counts as a placeholder has to be a closed list
rather than a guess.

## What will never be in scope

The exclusions in [VISION.md](./VISION.md) are permanent, not a backlog. Transport, storage,
business computation and visual styling stay outside the format regardless of demand. Crossing
any of them requires amending the project constitution, not filing an issue.

The rule of thumb: **if a change makes a minimal reader longer, it needs an extraordinary
justification.**
