# ADR 0003 — Rank is optional; ranking is derived by the consumer

**Status**: Accepted
**Date**: 2026-08-05

## Context

The obvious design has the producer compute ranks and the consumer display them. It is how nearly
every results feed works, and it makes the consumer trivial.

It also makes the rank an assertion that cannot be checked. A consumer receiving `rank: 3` has no
way to know whether it is right, whether it accounts for the penalty in the notes, or whether it
was computed before the jury ruled. And because a producer can only precompute the standings it
thought of, every additional cut — by category, by team, by age group — has to be materialised in
advance or is simply unavailable.

## Decision

Make `rank` **optional**, and require that a ranking be **derivable from the document alone**.

A valid document may contain nothing but raw measures. The semantics needed to order them —
which measure decides, which direction wins, how ties break, which statuses are excluded — are
part of the document, so any consumer can compute the standings itself.

When a producer does supply a rank, it is information rather than instruction: a consumer may
compare it against the rank it derives, and a validator reports a divergence as a warning, not an
error. A producer may legitimately apply a tie-break rule that lives outside the document.

## Consequences

- **A derived rank is verifiable.** Two independent consumers applying the specification to the
  same document must produce the same order, ties included — a property the conformance suite
  checks explicitly.
- **Sub-rankings cost nothing.** Ranking by category, by division or by team is a different
  `scope` over the same results, with no data duplication.
- **Producing results gets simpler.** Emitting measurements is enough; no ranking engine is
  required on the producing side.
- The consumer carries more work — but it is bounded work: a stable sort over declared measures,
  around 200 lines with no dependency.
- Derivation must be _strictly_ deterministic. Any latitude left in the algorithm would surface
  as consumers disagreeing about who won, so the specification pins down the sort's stability and
  the tie behaviour rather than leaving them to implementations.

## Alternatives considered

**Producer-supplied ranks, consumer displays them** — trivial consumers, matches existing
practice. Rejected: the rank cannot be verified, and every unanticipated sub-ranking is
impossible without republishing.

**Ranks supplied but recomputable, with the supplied rank authoritative** — a compromise that
keeps verification while preserving producer control. Rejected because it leaves two sources of
truth: when they disagree, nothing in the document says which one wins.

**Rules expressed as executable scoring formulas** — maximum expressiveness. Rejected outright:
it would require an expression evaluator in all seven target languages, and adoption dies at that
point. See [ADR 0013](./0013-sort-direction-from-measure.md).
