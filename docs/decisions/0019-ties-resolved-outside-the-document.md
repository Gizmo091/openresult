# ADR 0019 — `ties: "resolved"`, and `description` on every named entity

**Status**: Accepted
**Date**: 2026-08-05

## Context

A three-day swimming meet was encoded from the specification alone. Two findings came out of validating what they
wrote, and neither was their mistake.

**Thirty-one rejections, one cause.** §6.1.6 states that `description` "is **OPTIONAL** on every
entity that carries one" — a label or, per §6.1.5, a name. The schema accepted it on three: the
document, measures, attribute definitions. Believing the specification meant writing
`description` on eighteen participants, seven events, five rankings and a category. Every one was
rejected by our own validator, with a code that suggests the member is a typo. A producer followed
the rules and was punished for it. This is worse than a format that never promised: the promise is
what they acted on.

**One warning that could never be cleared.** Two swimmers touched in the same hundredth for the
last place in the final. Under World Aquatics rules the tie is broken by swimming it again. The
reader published positions 8 and 9 in `ranks`, and `OR-902` reported a divergence — correctly, by
§3.3.2, since the measures derive 8 for both. No measure in the document holds the swim-off, so
the warning was permanent. Put plainly: a pipeline treating warnings as
failures pushes the producer either to erase the swim-off, or to invent a fictitious tie-break
measure. Their explanation of all this sat in the ranking's `description` — itself rejected by the
first defect.

## Decision

**Make the schema keep §6.1.6's promise.** `description` is accepted on all nine named entities —
measures, attribute definitions, participants, events, rankings, categories, `source`, links,
assets — plus the document. §6.1.6 now enumerates them, the skeletons show it, and
`description-everywhere` checks schema, published types and prose together.

**Add `ties: "resolved"`.** A ranking declaring it states that residual ties are settled outside
the document, and that the positions in `ranks` record the outcome. A group comparing equal on
every sorting measure is ordered by those positions — but only when every result in the group
carries one and no two are equal. Otherwise the group stays tied and is numbered as under
`standard`.

## Consequences

- Swim-offs, jury rulings and drawn lots are expressible, and a document using one validates
  clean. The producer no longer chooses between falsifying data and living with a warning.
- `ranks` stops being purely informative in exactly one place, and the producer opts into it
  explicitly. §7.5.2 and §3.3.2 both say so; dropping `ranks` from such a document changes its
  order, which is true of nothing else in the format.
- **All of the group or none of it, and this was not the first design.** The rule initially broke
  ties pairwise: lower published position wins, absent position does not separate. That is not
  transitive — three results tied on time, one without a position, and the comparison contradicts
  itself, leaving the standings to depend on the sorting algorithm. §8.5.6 forbids precisely that.
  The flaw surfaced only when porting the rule to the Python reader, where a sort key cannot
  express a pairwise exception; the TypeScript comparator had accepted it silently.
- `cross-implementation` now reads the conformance corpus as well as the examples. Examples show
  what producers commonly write; conformance cases exercise the rules nobody writes by accident.
  `resolved` existed in the specification and the reference implementation and in no example, so
  the examples-only sweep reported forty agreeing rankings while the two implementations ordered a
  swim-off differently.

## Alternatives considered

**Silence `OR-902` under a flag on the ranking.** A member saying "the positions here are
deliberate". Rejected: it turns off a diagnostic without making the document mean more. A consumer
still derives 8 and 8, so the standings a reader renders still contradict the ones published — the
disagreement is hidden rather than resolved.

**A tie-break measure the producer invents.** What the format forced before. Rejected on the
reader's own argument: it encodes an answer already known as though it were an observation, and
every producer invents a different one.

**Treat an absent position as ranking last within the group.** Total and transitive, so it would
have worked. Rejected: it answers a question the document never asked. A producer who supplies two
positions out of three has not said where the third belongs, and guessing is how formats acquire
behaviour nobody documented.

**Narrow §6.1.6 to the three entities that already worked.** Cheaper, and the schema would have
been right by construction. Rejected: the promise was the better design. Three separate documents assumed
`description` was general, and the rule "everything that carries a name carries a description" is
one an implementer retains — a list of three exceptions is not.
