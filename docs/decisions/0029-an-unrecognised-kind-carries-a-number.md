# ADR 0029 — An unrecognised kind carries a number, and a later minor is not an error

**Status**: Accepted
**Date**: 2026-08-10

## Context

Three people were given the specification and the conformance suite, nothing else, and asked to
write a consumer: one in Ruby, one in Go, one in Rust. All three passed on a first run. All three
found defects the suite could not.

Two of them, independently, found the same one. The erratum of 2026-08-09 had corrected §5.1.6 —
an unknown `kind` folds onto `text` for display and implies no value type — because without it a
1.1 measure of kind `temperature` carrying numbers lost its whole standing to a 1.0 consumer. The
correction said a result under such a kind is rankable **whatever type its value has**. §8.5.3 then
has to order those values, and says nothing about how.

So the Rust implementation invented a total order: JSON type rank first, then bytes within type.
The Go implementation made every non-numeric pair compare equal. Both are defensible, both are
conforming, and they produce different standings for the same document. §8.5.6 requires two
consumers to agree.

The same erratum had been applied in one place and not the other. §5.3.1 folds an unknown attribute
`type` onto `text` exactly as §5.1.6 folded an unknown `kind`, and §5.3.4 then rejected every value
that was not a string — so a 1.1 attribute of type `duration` was `OR-102` on every entity carrying
it.

And the reference implementation, which had been correct about _reading_ since the first erratum,
was judging every enumeration against 1.0's domains whatever version the document declared. Six of
the seven ways §11.2.2 allows a MINOR to grow were rejected outright, in flat contradiction of
§11.4.2. Nothing caught it because no conformance case declared a version other than 1.0: the
entire compatibility chapter was tested against documents unable to exercise it.

## Decision

**A value under a kind this version does not define must be a number to be ranked** (§8.5.2), and
§8.5.3 states that every comparison in the derivation is numeric.

**An enumeration value this version does not define, in a document declaring a later MINOR, is a
warning — `OR-914` — not an error.** In a document declaring _this_ version it stays `OR-103`.

**An unrecognised attribute `type` implies no value type**, as an unrecognised `kind` already did.

## Consequences

A numeric measure added in a later 1.x still ranks for a 1.0 consumer, which is what the exception
exists for and covers every kind the format has: §5.2.1 makes everything a number except `text` and
`boolean`, and §8.2.2 keeps those two out of `sortBy` anyway. A string-valued kind added later
leaves the result **unranked** for a 1.0 consumer — the honest answer, since it cannot know that
`8b` beats `7a`, and a consumer that guesses publishes a wrong result confidently.

The reference lost its code-unit comparison for strings and its numeric one for booleans. A
mutation sweep found both unreachable afterwards: reversing the string comparison changed no case,
in either direction. They were unreachable for the reason that matters — dead code answering a
question the format declines to answer still reads as an answer.

`OR-914` is a warning rather than silence because a 1.0 validator genuinely cannot tell a
legitimate 1.1 value from a typo. Reporting nothing would hide the typo; reporting an error would
refuse the future §11.2.1 promises. Saying "this is not a value I know, and I will read it as the
fallback its domain fixes" is the only response that is true.

## Alternatives rejected

**Define a total order over JSON types**, so that any value is orderable. It makes every consumer
agree, and it makes them agree on a fiction: `"10a"` would sort before `"9a"`, and a climbing grade
would be published in an order nobody uses. The format would be asserting an order it was never
told.

**Fold the unrecognised kind to `text` and refuse to sort it** (§8.2.2's existing prohibition,
applied to the folded kind rather than the written one). This is the reading one implementer took,
and it is the 2026-08-09 defect returning one section earlier: every measure of a kind a later 1.x
adds would drop out of every `sortBy`, the standing would collapse to an all-tied field, and
§11.2.1 would break again. §8.2.2 now says "a `kind` **this version defines as** `text` or
`boolean`" for exactly this reason.

**Reject a later MINOR's enumeration values as errors and let producers deal with it.** This is
what the implementation did, and it makes §11.2.2 unusable: a MINOR could add a status that no
existing validator would accept, so no producer could adopt it, so the format could not grow
without a MAJOR. The compatibility guarantees would be words.

**Say nothing and let each consumer decide.** This was the state of the document, and the cost is
measurable: two implementations, two standings, one document.
