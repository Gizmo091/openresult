# ADR 0017 — A bye is a status, and it is rankable

**Status**: Accepted
**Date**: 2026-08-05

## Context

An outside reader implementing a Swiss-system chess tournament from the specification alone found
he could not express a **bye**: a competitor who scores without playing, because the field is odd
or the draw left them unopposed.

Every existing status is wrong for it. `dnf`, `dns`, `dsq`, `outOfTime` and `withdrawn` are all
excluded from ranking by default — but a bye _scores_, and the points count towards the
standings. `finished` ranks correctly but asserts something false: the competitor did not
compete. The reader worked around it by choosing an even field of ten players, and said so:
_"a real distortion of the domain — a 9-round Swiss normally has an odd round somewhere."_

Byes are not chess exotica. They occur in every knockout draw with a non-power-of-two field, in
league scheduling with an odd number of teams, and wherever a walkover awards the win without a
contest.

## Decision

Add `bye` to the status enumeration. It is **not** excluded from ranking by default: a bye scores
and belongs in the standings.

It also covers a walkover — a competitor advancing because the opponent did not appear. The two
differ in cause, not in what the document must record: a score without a contest. `notes` carries
the distinction where it matters.

## Consequences

- The case is expressible without an extension, which matters because "did not play, still
  scored" is something _every_ consumer should be able to show. Behind an `x-` member it would be
  invisible to all but its author.
- `bye` is the first status that is neither `finished` nor excluded by default. That the
  enumeration previously split cleanly in two was an accident of the cases considered, not a
  property of the domain.
- **The forward-compatibility fallback happens to be exactly right.** A consumer written against
  the previous version folds `bye` onto `finished` (§11.3.1) and ranks the competitor — which is
  the correct behaviour, merely with the reason lost. An addition whose fallback degrades
  gracefully is the strongest evidence that it belongs in the enumeration rather than beside it.
- Adding an enumeration value is a MINOR change (§11.2.2). Existing documents are unaffected.

## Alternatives considered

**`finished` plus a note.** Costs nothing and ranks correctly. Rejected: §7.4.1 forbids parsing
`notes`, so the information is invisible to machines — a consumer cannot mark the row, and an
aggregator cannot count byes across a season. It also states something untrue about a competitor
who never played.

**An `x-bye` extension.** No permission needed, no specification change. Rejected on the
governance test: extensions are for what one domain needs, and this is needed by chess, cup
draws and league scheduling alike. A generic viewer would display "finished" for a game nobody
played.

**Two values, `bye` and `walkover`.** More precise. Rejected: they are identical in every respect
the format models — a score without a contest, ranked normally. A distinction no consumer can act
on is a distinction the enumeration should not carry.

**A boolean `played` member.** Orthogonal to status, and arguably cleaner. Rejected: it adds a
second axis every consumer must now check alongside status, to express one case. The
enumeration already exists for "what happened to this competitor".
