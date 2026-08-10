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
| Examples                 | Fourteen realistic domains plus an edge-case library                                                                                             |
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
  thirty minutes, from the published documents alone. _Judged, not measured — see below._
- All fourteen domains are expressible without a proprietary extension. _`pnpm check examples`._
- Every example renders correctly in the viewer with no per-example configuration.
  _`viewer/test/examples.test.ts`._
- The conformance suite covers every normative rule. _`pnpm check rule-coverage`._
- A minimal reader fits in under 240 lines with no dependency, excluding its command-line front
  end. _`pnpm check minimal-reader-size`._

Four of the five hold by machine, and go on holding. The first cannot: it asks whether a stranger
can read the specification, which only a stranger can answer. It is tested by giving someone the
specification and the examples — nothing else, no code, no decision records — asking them to write
a document for a domain the corpus does not cover, and reading what they could not express. Every
normative change in §5.1.8, §5.3.7, §7.2.8, §8.1.2 and §8.3.5 came from one of those, and so did
finding that a published rank could not settle a tie.

_Raised from 220 to 240 on 2026-08-10, for §8.2.2: the rule forbade a measure in `sortBy` and never
said what a consumer does when one is there anyway — which §5.1.6 guarantees will happen, since it
folds every unknown direction onto `none`. Saying it costs about eighteen lines, and every
implementer now pays them because the alternative was each of them guessing._

_The reader's ceiling was two hundred when it was written, and nothing counted the lines. It
reached two hundred and sixty-seven while every addition was justified on its own: `scope`
accepting several events or categories, `ties: "resolved"` and the group it settles, the partition
that checks a value against its measure's kind, and the rounding rule. Those are about forty lines
of specification, not of reader — remove them and it is back at its original size. Two hundred and
ten of the current lines implement the format and fifty-seven are a command-line demo, which is
what the second figure separates. The ceiling is now enforced rather than stated, and raising it
means saying here what grew it._

---

## What a 1.x can still carry

**Every gap recorded below can be published in a 1.x.** That is the finding that made freezing 1.0
the right call rather than a hopeful one, and it is checkable: §11.2.2 says a MINOR version may add
optional members, enumeration values and warning-level rules, and may not add a required member,
remove one, narrow a value domain, or change the derivation algorithm. Each entry in **Known gaps**
was put to that test.

| Shape of the fix                                                                                                                                                                                                                     | Gaps it covers                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **An optional member.** Nothing existing changes; a document written today is unaffected because it does not carry it.                                                                                                               | The relation between measures. A member for the judge. Roles on `members`. An order on events. A time on a result. A co-holder of a result. A bracket. Marking a result excluded from an aggregate. Subtracting from the default exclusions. An entity that is paid without competing. Recording why a tie was resolved. A per-event precision. |
| **A value in an existing enumeration.** §11.2.2 names this explicitly, and §11.3.1 already requires a consumer to fold an unknown value onto its documented fallback — so a 1.0 reader handles a 1.1 document without being updated. | Three kinds of unplayed game. A status for a void performance. An attribute type that holds a list. An attribute type that references another entity. A unit for a dimensionless index.                                                                                                                                                         |
| **A warning-level rule.** Also named explicitly. A document that was valid stays valid; it merely gains an observation.                                                                                                              | Checking a declared relation between measures against the figures. A licence outside SPDX, which is already `OR-912`.                                                                                                                                                                                                                           |

One entry needed a second look. **`betterWhen` answers two questions with one member** looked like
it needed a MAJOR, because a direction chosen per ranking would change how a document sorts. It
does not: allowing a `sortBy` entry to carry its own direction _widens_ a value domain rather than
narrowing one, and no document written against 1.0 sorts differently for it. What stands in the way
is not the versioning policy but [ADR 0013](./decisions/0013-sort-direction-from-measure.md) —
a decision that direction has one source of truth, which a freeze does not make permanent and
evidence could still overturn.

So nothing recorded here forces a 2.0. The versioning policy was written for exactly this, and it
holds.

---

## v1.1 — What the corpus asked for

**Goal**: the additions six independent readers arrived at without being able to compare notes.

Nothing here changes a document written against 1.0. Ordered by how many readers hit it.

**A relation between measures** — three readers, three unrelated sports. A gymnastics routine
publishes a difficulty score, an execution score, a deduction and the score they make; a
powerlifting total is the sum of three lifts; a sailing series is the races minus a discard. The
arithmetic is the most-checked fact in each sport and the format drops it. Declaring that a
relation _exists_ asks the format to compute nothing, and lets a validator notice a total its own
components contradict.

**An order on events** — two readers. Nothing says a round is the third; §5.4.3 forbids reading it
out of the identifier, so both invented a number attribute no consumer has reason to read as an
ordinal.

**A status for a performance that happened and counts for nothing** — two readers. A mispunch, a
failed lift. Recorded, published, worth nothing, and none of the nine statuses fits, so two
producers reasonably choose differently and no validator can tell them apart.

**A member for the person who decided.** At a judged show the result _is_ one named judge's
opinion, and §6.1.7 closes the only other door without opening a replacement.

**Roles on `members`.** A boat's competitor is the boat; the person every entry list names is the
helm.

**An attribute that holds a list, and one that references an entity.** A prize schedule is five
numbers; a class runs a course, and nothing can say which.

### Exit criteria

- No addition breaks a 1.0 document, demonstrated by the conformance suite running unchanged.
- Each addition arrived from a real document somebody tried to publish, not from a design session.

---

## v2 — Adoption

**Goal**: many independent implementations, and the semantic gaps that only real usage reveals.

### Scope

**Ports.** PHP, Python, Go, C#, Java and Rust, each proven by the conformance suite. Nothing was
written before v1 froze: an implementation built against a moving format is thrown away.

The first step is taken, twice. `conformance/runner.py` and `conformance/runner.php` read the
manifest and drive readers of their own, and both pass every case a ranking-level implementation
can judge — 84 cases, 98 rankings, the PHP one on its first run. The suite reads cleanly from both,
which is what "language-agnostic" was worth.

**Both halves travel now.** `conformance/validator.py` produces the diagnostics — every code and
every JSON pointer — from the specification's text, and `runner.py` judges all 140 live cases with
it: validity, errors, warnings and rankings. It was the larger half and nobody had costed it; it
came to about four hundred lines and thirteen disagreements with the suite, each of which was the
validator being wrong.

What remains is **three languages by one author, which is not what this criterion asks for**. It
tests whether the specification is precise enough to reimplement, not whether it is clear enough
for a stranger.

Three outside implementers have now answered the second question, in Ruby, Go and Rust, each given
the specification and the conformance suite and nothing else. All three passed on a first run, and
all three found defects the suite could not:

- **Ruby** found the §5.1.6 defect that broke forward compatibility outright — an unknown `kind`
  folded onto `text`, then failing the type test on every number.
- **Go** found that the suite's stability cases tie the whole field, which an unstable sort can
  survive: Go's `sort.Slice` passes every one of them. It also found that §3.1's twice-run
  presentation check could not fail on this corpus, and that §8.4.1's no-folding rule had no case.
- **Rust** found that the first erratum's fix opened a second hole — a result rankable under an
  unrecognised kind whose value §8.5.3 has no rule for ordering — and that §14's generated index
  printed false statements by splicing two sentences together.

Between them they also found six readings the document left to be guessed at, each of which
changes a standing, and that the reference implementation rejected six of the seven ways §11.2.2
allows a MINOR to grow. Every one of those is closed, and every one is now a case.

The lesson is not that the specification was bad. It is that **the suite tests what its author
thought to test**, and only someone who has not read it finds the rest — including, three times
over, a check that had quietly stopped being able to fail.

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

**A figure that was recorded and must not be compared.** A failed lift has a weight — the bar was
loaded, the attempt is published, and it counts for nothing. §7.3.2 offers a value, zero, or
absent, and absent means _not available_, which a 305 kg failure is not. Writing the weight beside
a separate `good: false` leaves the two joined by nothing a consumer can read, so a conforming
reader renders "305 kg" for a lift that did not happen. Writing only successful lifts publishes
the same number twice under two measures, which §8.1.5 names as a defect in so many words. The
format offers a choice between an inexpressible coupling and a documented duplication, and no rule
for choosing. The same shape appears in every attempt sport: throws, vaults, archery ends.

**`betterWhen` answers two questions with one member.** A tie-break on bodyweight needs the
lighter lifter first, and that is a convention of one ranking, not a claim that being lighter is
better. §8.2.3 puts direction on the measure precisely so two rankings cannot contradict each
other, and §8.2.2 forbids a directionless measure in `sortBy` — so expressing the tie-break means
declaring, in the document, something about bodyweight that is false. The remedy §8.2.3 offers, a
second measure with the opposite direction, does not fit: what is wanted is no direction outside
this one comparison.

**A participant cannot be asked which categories they are in.** A category lists its members, and
nothing goes the other way, so a consumer rendering one competitor's row has no way to show their
weight class without the producer duplicating the roster into a text attribute. Every producer
will, and the two copies will drift.

**A result excluded from an aggregate by rule.** After five races a sailing boat discards her
worst score, so the series total is not the sum of what is published — and nothing marks which
score was dropped, or that a disqualification declared non-excludable must be carried anyway. The
reader wrote a boolean on all one hundred and twenty race results and no rule attaches behaviour to
it: `scope` selects on event and category only, so no ranking can exclude on an attribute. The same
shape is a discarded round in any series and a dropped worst judge in any panel.

**An event that was held and counts for nothing.** A sailing race abandoned and resailed produces
no results, so there is no status to carry it — §7.2.1 is per-result — and an event with no results
is invisible to any ranking, since scoping to it is `OR-906`. The fact that a fleet sailed a full
race that counted survives only in prose.

**`members` has no roles.** A boat's competitor is the boat; the person every entry list names is
the helm. Declaring her in `members` (§6.1.2) makes her an entity and loses which member she is,
and swells a twenty-boat regatta's participant list with twenty people who are not competing.

**A tie-break that is a rule, not a number.** Chess separates players on equal points by the game
they played against each other, or by wins with Black. `ties: "resolved"` (§8.3.4) carries the
outcome, so the document is deterministic — but it records _that_ the arbiter decided and never
_why_. A consumer recomputing after a later correction gets the order wrong, and two arbiters
publishing different Buchholz conventions under the same label are indistinguishable. The same
shape appears wherever a tie-break consults something the document does not measure.

**Three different unplayed games share one status.** A pairing bye, a requested half-point bye and
a forfeit win are all `status: "bye"` (§7.2.5), and §7.2.5's own answer is that `notes` carries the
difference — a member §7.4.1 forbids a consumer to parse. In chess an unplayed game is excluded
from rating reports and treated specially by every tie-break, so this is not cosmetic. It is the
one machine-readable bit the domain needs and the only one it cannot have.

**Stating that something is not the case.** §5.3.8 says an absent attribute means _not recorded_,
and that a producer needing to say something is not so must write the value — but for "holds no
FIDE title" there is no value to write. Omitting it asserts the titles were not looked up, which
is false. A boolean attribute per possibility grows with the domain.

**Events have no order of their own.** Nothing on an event says it is the third round. §5.4.3
forbids reading `3` out of the id `r3`, so the only ordering available is `occurredAt`, which
works only for a producer who timestamps every round. Both readers declared a number attribute
that no consumer has any reason to read as an ordinal.

**A dimensionless index still needs a unit.** §5.1.3 requires one for every kind but `text` and
`boolean`, and §5.2.4 offers `pt` for a score. A rating performance of 2231 is an index with no
unit at all, so it renders as "2231 pt". `money` and `percentage` got real vocabularies; a bare
index got nothing.

**The default exclusions cannot be subtracted from.** Chess classifies a withdrawn player — he
keeps his score and his line in the crosstable — and the only way to say so is
`excludeStatuses: []`, which by §8.4.1's replacement rule also stops excluding `dsq`, `dnf` and
the rest. It is safe until the first disqualification, which is then silently classified. §8.4.1's
note admits the cost; nothing removes it.

**No member for the person who decided.** A cattle show's result is one named judge's opinion, and
their name is the most load-bearing fact about the document's authority. There is no `judge`,
`officials` or `jury` member anywhere, and §6.1.7 closes the only other door — a juror does not
compete, and declaring one as a participant raises `OR-910` — without opening a replacement. The
same shape is every judged sport, every examination board and every jury.

**No array-valued anything.** A show class publishes its prize schedule — 1st £50, 2nd £35, down
to 5th — before entries open. §5.3.3's attribute types are text, number, date, url, country and
boolean, so five numbers that decide every payment in the document end up in `description`. The
alternative, `prize1` through `prize5`, is the indexed-measure pattern §6.3 names by hand.

**A competitor cannot belong to an entity that does not compete.** The animal is placed and the
exhibitor is paid. `members` (§6.1.2) runs the other way — a team composed of competitors — so six
exhibitors were spelled out thirty-seven times as a text attribute, and one typo makes seven of
them. The same gap covers a club in an individual sport and a school in an examination.

**A result contaminated by an earlier one.** An orienteering runner who misses control 7 has valid
splits at 8, 9 and 10 and a void run. §7.2.7 says a status describes the result it sits on, so
read literally those three are `finished`, and a consumer then places a competitor first at three
controls of a run that does not count. The reader marked them `notClassified` against the rule to
keep the standings honest.

**No status for a void performance that was completed.** A mispunch, a failed lift, a gymnastics
routine outside the apparatus rules: recorded, published, and worth nothing. §7.2.1's list is
closed and none of its nine fits, so two producers reasonably choose `notClassified` and `dsq` for
the same fact, which is the divergence §7.2.8's note says the format exists to prevent. The unit
vocabulary was opened up when the corpus showed a closed list did not fit; the same evidence now
exists for statuses.

**A result has no time of its own.** `occurredAt` sits on the document and on events, not on
results, and orienteering starts are individual. The same fact is a first-class member in one
place and an ad-hoc attribute in another.

**An attribute cannot reference anything.** A class runs a course; a category cannot name the
event it is run on. §5.3.1 has no reference type, and §5.4.3 makes an identifier written into a
text attribute unresolvable by construction — so the relation exists only as a side effect of a
ranking's scope.

**A relation between measures.** _Found independently by three readers — powerlifting, sailing and
gymnastics — and it is the largest thing this file records._ A gymnastics routine publishes a
difficulty score, an execution score, a neutral deduction and the apparatus score they make; a
powerlifting total is the sum of three best lifts; a sailing series total is the sum of the races
minus a discard. In each the arithmetic is the most-checked fact in the sport, and the format
carries the figures and drops every relation between them. A consumer cannot show `5.4 + 8.050 −
0.100`, cannot verify one score, and cannot notice a producer who publishes a total its components
contradict.

§1.2.2 refuses formulas, and refusing to _evaluate_ one is right — a format that computed would
have to agree with every federation's rules for ever. Declaring that a relation _exists_ is a
different thing: it is checkable by a validator, renderable by a consumer, and asks the format to
compute nothing. That distinction is what a fix would turn on.

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
told. One is left, and it is the one that cannot be otherwise:

**§7.2.8 — the status of an aggregate event** must be the most specific one true of the aggregate.
Which status is true depends on the sport: a rider who abandons stage four is `dnf` on the general
classification, and whether the same is true of a swimmer disqualified in a heat is a question the
document cannot answer. No validator can tell a considered choice from a lazy one, so a case would
show the recommended shape and demonstrate nothing.

The other four closed while this file was being kept honest. §5.2.6 became `OR-111` and §9.2.2
became `OR-912`; §4.4.3 became `supersedes()` in the reference implementation, since the suite runs
one document at a time and supersession is about two; §11.6.2 became tests serving one document
under three media types, so that discriminating on the header would have to be a decision.

Closing §5.2.6 meant first cleaning three conformance documents that modelled a bib as a measure —
the very thing the rule points at — which had gone unnoticed because the check enforcing it only
swept `examples/`.

## What will never be in scope

The exclusions in [VISION.md](./VISION.md) are permanent, not a backlog. Transport, storage,
business computation and visual styling stay outside the format regardless of demand. Crossing
any of them requires amending the project constitution, not filing an issue.

The rule of thumb: **if a change makes a minimal reader longer, it needs an extraordinary
justification.**
