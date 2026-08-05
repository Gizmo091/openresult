# Governance

How OpenResult changes, and what it promises not to.

A format is only worth adopting if its future is predictable. This document exists so that a
producer can answer, without asking anyone: _will the document I publish today still work in five
years?_

---

## The promise

**A document valid under 1.0 stays valid and interpretable under every later 1.x version.**

That is the one commitment everything else serves. It is not a goal, it is a constraint: a change
that breaks it is not accepted, however good the idea.

The promise is tested, not asserted. An implementation supporting a later version must pass the
1.0 conformance suite in full, and suites are kept per version precisely so that this stays
checkable.

---

## What may change, and how

| Change                                 | Version                 |
| -------------------------------------- | ----------------------- |
| Adding an optional member              | MINOR                   |
| Adding a value to an enumeration       | MINOR                   |
| Adding a warning-level validation rule | MINOR                   |
| Clarifying wording, fixing a typo      | none — no republication |
| Making an optional member required     | **MAJOR**               |
| Removing a member                      | **MAJOR**               |
| Narrowing a value domain               | **MAJOR**               |
| Changing the derivation algorithm      | **MAJOR**               |
| Turning a warning into an error        | **MAJOR**               |

Adding an enumeration value is compatible only because consumers are required to fold unknown
values onto a documented fallback (§11.3.1). That rule is what buys the format room to grow, and
it is why it is not negotiable.

A MAJOR version is a serious event. It means every existing document and every implementation
needs attention. None is planned.

---

## Proposing a change

1. **Open an issue** describing the problem, not the solution. A format changes because something
   cannot be expressed, not because a member would be convenient.
2. **Show two producers who need it.** One producer's need is a use case; two is a pattern. A
   format that absorbs every individual request stops being implementable.
3. **Show it cannot be an extension.** Anything domain-specific belongs in an `x-` member, which
   needs no permission from anyone. The bar for the core is that _every_ consumer benefits.
4. **Discussion.** Publicly, on the issue.
5. **Decision**, recorded as an [ADR](./decisions/) with its context, the alternatives weighed and
   the reason. A decision without its reasoning is indistinguishable from an oversight, and a
   successor will undo it.
6. **Implementation**, as one coherent change: specification, schema, examples, conformance cases
   and the decision record, together. A repository check enforces the specification and the
   schema staying in step.

## Grounds for refusal

These are not judgements on the idea; they are what keeps the format implementable.

- **It needs evaluation.** No expression language, no formulas, no scoring rules a consumer must
  execute. Ordering is a deterministic sort over declared values, and it stays that way.
- **It is presentation.** Colours, fonts, layout. The format may suggest _which kind of view_
  suits a document; never how it should look.
- **It crosses a stated exclusion.** Transport, storage, business computation, cross-document
  identity. Those are listed in [VISION.md](./VISION.md) and are permanent, not a backlog.
- **It makes the minimal reader longer.** The 200-line promise is what makes the format
  implementable in an afternoon. Crossing it needs an extraordinary justification.
- **It could be an extension.** If one domain needs it, `x-` is the answer.

---

## Who decides

The project currently has a single maintainer, and this document says so rather than implying a
committee that does not exist.

That is a weakness, and the mitigations are deliberate: decisions are recorded with their
reasoning, the specification is normative and self-contained, the conformance suite is
language-agnostic, and everything is published under licences that permit forking. The project
should be inheritable, whatever happens to its author.

As independent implementations appear, their authors are the natural people to widen this. An
implementer who has passed the conformance suite has demonstrated the only qualification that
matters: they have read the specification closely enough to find its gaps.

---

## Deprecation

**Nothing is removed within a major version.** A member that turns out to be a mistake is marked
deprecated in the specification, with the reason and what to use instead. It keeps working.

**Published diagnostic codes are permanent.** A retired code stays listed and is never reused —
`OR-403` is retired precisely this way. Reusing a code would silently change the meaning of
someone's error handling.

**Published conformance cases are never rewritten.** A case can be marked deprecated with a
reason; editing one in place would let a suite be bent to match a regression.

---

## Releases

The format and the packages version independently. A package's version tracks its own evolution;
the format version it supports is stated in its README and returned by its API.

A release publishes only after the repository invariants, the tests and the conformance suite
have all passed. Publishing to npm cannot be undone — a bad version can be deprecated but never
withdrawn.

---

## Reporting a problem in the specification

Ambiguity is a defect, and the most valuable kind of report. If two implementers can read a rule
two ways, that rule is broken regardless of what it was meant to say.

Open an issue quoting the section and both readings. It will be fixed by making the specification
say one thing — and, where the ambiguity could produce two different rankings, by adding the
conformance case that would have caught it.
