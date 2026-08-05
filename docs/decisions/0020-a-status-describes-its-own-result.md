# ADR 0020 — A status describes its own result; aggregation is normative; allocated numbers are attributes

**Status**: Accepted
**Date**: 2026-08-05

## Context

Three findings from the same swimming reader, all of them about the specification disagreeing
with itself or with its own examples.

**§7.2.6 contradicted §7.2.3.** It glossed `notClassified` as covering a competitor "eliminated in
a heat, outside a qualification cut". A swimmer placed seventeenth in a qualifying heat is
eliminated in a heat by those words — but §8.4.2 excludes `notClassified` by default, so marking
her erases her from the heat's own standings, which is exactly where she belongs, at seventeenth.
Meanwhile §7.2.3 holds that exclusion is a property of a ranking and never of a status. The two
cannot both stand. The reader followed §7.2.3 and wrote `finished`, and said the phrase would
mislead any producer of results with rounds.

**§6.3 carried an obligation it had no authority to impose.** §8.1.1 forbids a scoped ranking from
seeing descendant events. The only place saying what to do instead was §6.3, whose heading reads
_Non-normative_ and which nonetheless said the cumulative figures "**must** exist as results
attached to that event". §2.1 says non-normative text imposes no requirement. So the answer to the
first question every rounds-based domain asks was, formally, not a rule at all.

**Four reference examples contradicted §5.3.** `bib`, `kartNumber`, `number` and `carNumber` were
declared as measures of `kind: "count"`, `unit: "n"`, `betterWhen: "none"`. The reader reasoned
from §5.3 — an attribute is descriptive, neither measured nor ranked; a lane is allocated, not
observed — chose an attribute, and then found the corpus doing the opposite. For someone learning
the format the examples carry as much authority as the text.

## Decision

**Split §7.2.6 in two.** §7.2.6 now scopes the status to the event its result is attached to.
§7.2.7 states the general rule: a status describes the result it sits on, never a later round. A
competitor who completes a heat and is not selected is `finished` in that heat; the non-selection
is the absence of a result in the round that follows. The skier is `finished` on the first leg and
`notClassified` on the combined event, which has no combined time.

**Promote the aggregation rule to §8.1.4.** A standing aggregating several events must be
published as results attached to the event the ranking is scoped to. §6.3 keeps the worked example
and cites the rule instead of asserting it.

**Add §5.3.5.** An identifier the organisation allocates is an attribute, never a measure, and the
test is one question: was this figure read off an instrument or a judgement, or handed out
beforehand? The four examples were converted.

## Consequences

- Heats-to-finals is expressible without erasing anyone, in the domain where it is most common.
  The conformance case that covered `notClassified` was itself teaching the error — it marked the
  status on the leg the competitor had cleanly completed — and now shows both halves.
- `OR-906` gained the case it never had: a parent event declared with no results attached, which
  the reader called the commonest way to publish a standing that renders empty.
- The corpus lost five measures and gained five attributes. `no-ranking-declared` needed more than
  a conversion: it was built so that its **first** measure had no direction, to prove the implicit
  ranking skips such measures, and that first measure was the bib. It now carries an average heart
  rate — observed, never ranked — which makes the point the example exists to make, and makes it
  more honestly.
- `allocated-numbers` is a heuristic, and knowingly so: it flags a `count` whose unit names
  nothing. A genuine tally could be declared that way. It fails in the useful direction, since the
  fix for a false positive is to name what is being counted.

## Alternatives considered

**Keep "eliminated in a heat" and let producers infer the scope.** Rejected: the reader inferred
correctly and still lost time on it, and the sentence read as an instruction. A gloss that has to
be reasoned around is a defect whatever the surrounding rules say.

**Drop `notClassified` again.** It has now been the subject of two ADRs in two passes. Rejected:
the status is right and its description was wrong. The skier with no combined time needs it, and
nothing else expresses "took part, recorded, not in this classification".

**Mark §6.3 normative wholesale.** Cheapest fix. Rejected: §6.3 is a section of worked patterns,
and most of it genuinely imposes nothing. Promoting the section to make one sentence binding would
make the rest binding by accident.

**Allow allocated numbers as measures and say so.** Defensible — `betterWhen: "none"` exists
precisely for quantities that are not ranked. Rejected: a measure carries a unit and a precision
because it is a quantity to be compared, and an allocated number compares to nothing. The
distinction also has to hold for a consumer composing columns, which is where two producers
choosing differently becomes visible.
