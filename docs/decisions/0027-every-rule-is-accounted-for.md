# ADR 0027 — Every rule is accounted for, by a case or by naming what holds it

**Status**: Accepted
**Date**: 2026-08-08

## Context

§12.3.1 says the conformance suite is the operational definition of conformance, and that every
normative rule must be exercised by at least one case. Fifty-seven of a hundred and thirty-nine
were. The specification was the one thing in this repository not holding to its own rule.

Most of the shortfall was clerical, and writing the cases closed it. What remained was a class the
suite cannot reach at all:

- rules about **a collection of documents** — which publication supersedes another;
- rules about **the specification itself** — what a future MINOR version may add;
- rules about **display** — how a duration or a bounded score renders, which the runner never
  looks at;
- rules that are **a producer's judgement** — which status is true of an aggregate event.

Leaving them uncounted made the figure meaningless in the other direction: `57/139` reads as a
project that is 41% done, when a fair share of the remainder was never a case's job. Worse, it left
no way to tell a rule waiting for a case from a rule nothing anywhere enforces — and there were
five of the latter, invisible among the eighty-two.

## Decision

**`conformance/rules-not-by-case.json`.** Every rule the suite cannot demonstrate has an entry
naming what holds it instead: a repository check, a test file, the compiler, the suite's own
structure, or `gap` where the honest answer is nothing.

**`rule-coverage` fails on a rule accounted for nowhere**, and on a rule accounted for twice. A
rule cannot be written without someone deciding how it is held.

**A case may cite more than one rule.** `alsoExercises` lists the others its document really
demonstrates: §11.3.2 is §5.4.3 addressed to the reader rather than the writer, and one document
shows both. A second copy would be coverage on paper.

## Consequences

- The figure means something: 117 rules by case, 22 otherwise, one gap.
- The gaps became visible, and four of the five closed within days of being written down. §5.2.6
  became `OR-111`, §9.2.2 became `OR-912`, §4.4.3 became `supersedes()` in the reference
  implementation, and §11.6.2 became tests that serve one document under three media types. The
  one left — §7.2.8 — is the one that cannot be otherwise: no validator can tell a considered
  choice of aggregate status from a lazy one.
- Closing §5.2.6 first required cleaning three conformance documents that modelled a bib as a
  measure, which is exactly what the rule forbids. The check enforcing it only swept `examples/`,
  so the suite that defines conformance had been breaking a rule it holds others to. Both checks
  now sweep both corpora.
- A published case is never rewritten, so those three were deprecated with a reason and replaced.
  That policy also forced an exemption to be named: an invalid case exists to break a rule, and a
  deprecated one records what the suite used to assert. Naming it is what let §5.2.6 have a case at
  all — the only document that can demonstrate it is the one the check would otherwise reject.

## Alternatives considered

**Demand a case for every rule.** The literal reading of §12.3.1. Rejected because it cannot be
met: no single document can demonstrate which of two supersedes the other, and pretending otherwise
would produce cases that pass without exercising anything. Two such cases already existed once,
declaring a level that had never been a level.

**Exempt the unreachable rules silently, by excluding them from the count.** Rejected on the
project's own terms: an exemption nobody has to justify is where the gaps hide. Each entry carries
a sentence saying why, and `gap` is a word that shows up in the check's own summary line.

**Relax §12.3.1 to "every rule a document can demonstrate".** Tempting, and it would make the rule
true by construction. Rejected: the rule as written is the one that produced this work, and
softening it would have removed the pressure that closed four gaps. The ledger records the
exception without weakening the expectation.
