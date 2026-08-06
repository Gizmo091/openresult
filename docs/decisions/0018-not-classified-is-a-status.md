# ADR 0018 — `notClassified` is a status, and `OR-908` only warns on partial records

**Status**: Accepted
**Date**: 2026-08-05

## Context

Giant slalom and competitive angling reach the same
seam from opposite sides.

The skier who runs the first leg cleanly and misses the cut for the second has **taken part** and
has a recorded time, but does not appear in the classification. No status fitted: `finished` is
false, `dnf` is false — he finished his run — and `outOfTime` is a different thing. The choice made under duress was `outOfTime` and added an `x-classificationCode: "DNQ"` extension, then pointed out that the
examples README claims no reference domain has ever needed one. Giant slalom needed one.

The angler who blanks has caught nothing. He declares `weight: 0` — a real measurement, a net
lifted and weighed empty — and omits `biggest`, because a fish that does not exist has no weight.
That is §7.3.2 applied exactly. And `OR-908`, introduced one pass earlier, warned about him.

## Decision

**Add `notClassified`**: took part, performance recorded, not in the classification. Excluded by
default. It asserts nothing about finishing, which is what separates it from `dnf`.

**Narrow `OR-908`**: warn only where a result is status-eligible **and** carries _some_ of a
ranking's sorting measures but not all. A result carrying none of them has no place in that
ranking and is not reported.

## Consequences

- Heats to finals, qualification cuts, minimum distances and apparatus finals become expressible
  without an extension. The cut-based format is far more common than the odd Swiss field that
  earned `bye` a status one pass earlier.
- The angler's document is now clean, and the skier's is expressible. The previous state punished
  the correct producer and offered the incorrect one no help.
- **This averted a worse outcome than a spurious warning.** A producer chasing a clean report
  would have written `biggest: 0` — asserting a fish weighing nothing — which destroys the
  absent-versus-zero distinction the format rests on. A diagnostic that pressures producers into
  falsifying data is worse than no diagnostic.
- `notClassified` folds onto `finished` for a consumer written against an earlier version, per
  §11.3.1. That fallback is _wrong_ here — it would rank a non-qualifier — where the same fallback
  was exactly right for `bye`. The compatibility rule is uniform; its aptness is not.

## Alternatives considered

**Leave it to a partial measure set.** A racer with a first-leg time and no combined time is
already unranked by §8.5.2, so no status is strictly needed. Rejected: it conflates "excluded on
purpose" with "the record happens to be incomplete", and it is exactly the conflation that made
`OR-908` unusable.

**Reuse `outOfTime`.** What the constraint forces. Rejected: it is a specific outcome — over
a time limit — and a consumer rendering "outside the time limit" for a skier who missed a
placings cut publishes something false.

**Drop `OR-908` entirely.** Removes the false positive at a stroke. Rejected: the twelve-horse
Grand Prix rendering as five is a genuine and silent failure, and it was worth catching. The fault
was the trigger, not the diagnostic.

**A `deliberatelyAbsent` marker on the result.** Lets a producer silence the warning explicitly.
Rejected: it asks every producer to annotate the normal case so that tooling can stay simple, and
the distinction is derivable from the data — some measures present versus none.
