# ADR 0026 — Rounding is defined, and defined on the number as written

**Status**: Accepted
**Date**: 2026-08-08

## Context

`precision` said how many decimals to show and said nothing about what happens to a value falling
between two of them. That looked like an omission too small to matter. It is a second on a
published time.

A conformance case written for an unrelated rule carried a time of 5288.5 seconds. The
cross-implementation check refused it: the TypeScript reference rendered `1:28:09` and the Python
minimal reader `1:28:08`. Neither was wrong. JavaScript rounds a half away from zero, Python rounds
it to the nearest even digit, and each is a defensible convention that the format had not chosen
between. §8.5.6 asks two conforming consumers for identical output; here they were reading the same
document and disagreeing about the answer, with nothing in the specification to appeal to.

Chasing that turned up a second divergence **inside one implementation**. Durations went through
`Number.prototype.toFixed`, which rounds the binary double; every other value went through
`Intl.NumberFormat`, which rounds the decimal the producer typed. `2.675` is stored as
`2.67499…`, so the same figure rendered `2.67` as a duration and `2.68` as points, in the same
consumer, on the same page.

## Decision

**§5.1.5 gains two sentences.** Rounding applies to the number as the document writes it, and a
value falling exactly halfway is rounded **away from zero**: `8.5` to no decimals is `9`, `-8.5` is
`-9`, `2.675` to two decimals is `2.68`.

Both implementations changed. The reference's duration path uses the same decimal rounding as
everything else; the minimal reader converts through the value's shortest round-tripping decimal
before quantising, rather than through the double.

## Consequences

- The two implementations agree on 134 rankings, including the case that exposed this.
- A producer who types `2.675` and expects `2.68` gets it. The alternative reading — round what is
  stored — is defensible arithmetic and indefensible to explain to the person holding the
  scoresheet.
- Adding a requirement to a published 1.0 rule is not something to do lightly. This one narrows
  nothing a document may contain and changes no ordering; it settles a question two consumers were
  already answering differently, which is worse than either answer.
- The rule is now the kind that a test can hold, and both implementations have one. Display had no
  unit test at all until this session, which is part of why the disagreement survived as long as
  both readers did.

## Alternatives considered

**Round half to even.** The statistician's convention, and the default in Python, C# and IEEE 754
itself: it does not bias a long series upward. Rejected because results are not a long series. Each
figure is read once, by someone who wants the same answer their stopwatch gave, and explaining that
`8.5` seconds is `8` while `9.5` is `10` would cost more trust than the bias saves.

**Round the stored double.** What `toFixed` does, and arguably the truthful reading: the document
carries a double, and that double is below the halfway point. Rejected because it makes the rule
unpredictable from the document's own text. A producer cannot tell by looking at `2.675` whether it
will round up, and neither can a reviewer reading the JSON.

**Leave it unspecified and let consumers differ.** Defensible for a display concern, which §5.2.5
already treats as a SHOULD. Rejected on what actually happened: two implementations of this project,
written from the same document, disagreed about a published time. A format whose whole claim is
that a document means one thing cannot leave that to the language a consumer happens to use.

**Specify a rounding mode without specifying what it applies to.** The first draft of the rule did
exactly this, and it would have left the reference implementation still rendering one figure two
ways — the half is only half the question.
