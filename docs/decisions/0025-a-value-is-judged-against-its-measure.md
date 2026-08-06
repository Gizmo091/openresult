# ADR 0025 — A value is judged against its measure, never against another value

**Status**: Accepted
**Date**: 2026-08-06

## Context

§12.3.1 requires every normative rule to be exercised by at least one conformance case. Fifty-seven
of a hundred and thirty-nine were, so the specification was the one thing in the repository not
holding to its own rule. Writing the missing cases is mostly clerical. One of them was not.

The case asks what a consumer does with a value whose type contradicts its measure — a duration
recorded as `"10:04.200"`, a time recorded as `true`. The document is not conforming
(§7.3.3) and a consumer must still read it (§11.3.1), so the question has an answer and the suite
should state it.

The answer the implementation gave was: values of differing types compare equal. That was a
deliberate choice, and its comment said why — an ordering between a number and a string would be a
decision the document never made. It is also **not transitive**. A number and a boolean compare
equal; two numbers do not. Whether two results end up in the same tie group then depends on which
pairs the sorting algorithm happened to compare.

Three results, one measure, six declaration orders:

```
a=604.2  b=true  c=611.9

012 -> a=1 b=1 c=3
021 -> a=1 c=2 b=2
102 -> b=1 a=1 c=1
120 -> b=1 a=1 c=1
201 -> a=1 c=2 b=2
210 -> c=1 b=1 a=3
```

Three different answers to who was tied with whom, from one set of results. Sort stability is
allowed to reorder within a tie; it is not allowed to change the tie. §8.5.6 requires two consumers
to produce identical output, and two consumers using different sorting algorithms would not.

## Decision

**§8.5.2 gains a condition.** A retained result is rankable when, for every measure in `sortBy`, it
carries a value **of the JSON type that measure's `kind` implies** (§5.2.1). A value of any other
type leaves the result unranked, exactly as a missing one does.

The type is checked against the measure, which is a property of one result. Nothing it is compared
with can change the answer, so the comparison is transitive again and the six permutations give one
answer: `a=1 c=2 b=unranked`.

## Consequences

- A non-conforming value now removes a result from the standings instead of quietly dragging
  everything into one tie. Both the JavaScript reference and the Python minimal reader changed;
  `cross-implementation` verifies they still agree, over 118 rankings.
- The reader that mattered most here was the Python one — not because it disagreed, but because a
  sort key cannot express a pairwise exception at all. `sorted(key=…)` would have raised a
  `TypeError` on the string case. A pairwise comparator is expressive enough to be wrong quietly,
  which is the second time this session that porting to a sort key exposed a rule that only looked
  well defined.
- §5.2.6 stays unenforced. It says a `count` unit **MUST** name what is counted, and `n`, `#` and
  `no` name nothing; no diagnostic reports it. The case is not written, because a case that passes
  without exercising anything is worse than an acknowledged gap. Recorded in `docs/ROADMAP.md`.

## Alternatives considered

**Coerce the value.** `"10:04.200"` is obviously a time, and a lenient reader could parse it.
Rejected on §5.2.2, which forbids exactly that spelling: guessing would make the format's one
firm rule about durations advisory, and a consumer that guesses well makes producers stop caring.

**Report it and rank it anyway, in declaration order.** Keeps everyone in the standings. Rejected:
it is the behaviour that was there, and it is the one that is not transitive. Declaration order
would have to become a tiebreak of last resort applied to a group nobody can define consistently.

**Sort untyped values last, ordered among themselves by declaration order.** Transitive, and it
keeps every result visible. Rejected as a distinction without a difference: a result placed after
everyone else on the grounds that its value could not be read is unranked, and saying so is
clearer than giving it a number that means "unreadable".
