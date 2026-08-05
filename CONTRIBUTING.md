# Contributing

Thank you for looking. This document is short on ceremony and specific about the two things that
matter here: **coherent changes** and **written reasoning**.

## Getting set up

```bash
pnpm install
pnpm build
pnpm check      # repository invariants
pnpm test
pnpm conformance
```

Node 22 or later, pnpm 9 or later. `python3` is optional — without it the
cross-implementation check skips rather than fails.

## The one rule that is not obvious

**A change to the format is a change to five things at once**, and they go in the same commit:

|                   |                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- |
| `specification/`  | The normative description. Always first — the specification is the source of truth. |
| `schema/`         | Its machine-readable expression.                                                    |
| `examples/`       | Anything affected.                                                                  |
| `conformance/`    | A case exercising the new rule.                                                     |
| `docs/decisions/` | Why, with the alternatives you weighed.                                             |

Two checks enforce parts of this: `spec-schema-sync` fails when the schema mentions something the
specification does not, and `rule-coverage` fails when a rule the suite exercised stops being
exercised.

If you are unsure whether your change is a format change: does it alter what a document may
contain, or how one is interpreted? Then yes.

## Before opening a pull request

- [ ] `pnpm check` passes
- [ ] `pnpm test` passes
- [ ] `pnpm conformance` passes
- [ ] `pnpm lint` and `pnpm format:check` pass
- [ ] Format changes carry all five artefacts above

## Commits

**Atomic**: one coherent change per commit. A commit that both fixes a bug and reformats a file
cannot be reverted cleanly.

**Explain the intent, not the diff.** The diff is already there. What it cannot say is why the
change was necessary, what you considered instead, and what breaks if someone undoes it.

```
spec: scope a ranking to exactly its event, never its descendants

Building the reference reader surfaced the defect: an overall standing
scoped to a parent event absorbed the results of the heats feeding it,
mixing points totals with race times and ordering nothing meaningful.
```

## Design constraints you will run into

These are not preferences, and a pull request crossing one will be refused however good the code
is. They are what keeps the format implementable in an afternoon.

**No evaluation.** No expression language, no formulas, no scoring rules a consumer must execute.

**No domain knowledge in consumers.** No view, no validator and no library may branch on what the
competition is. `pnpm check no-domain-logic` fails on any mention of a discipline in a source
file. If you need one, the format is missing a piece of semantics — fix that instead.

**The core package carries no runtime dependency.** `pnpm check core-deps` fails if it acquires
one, or if it grows past 15 kB compressed. Reading and ranking must never need more than a JSON
parser.

**The presentation layer is ignorable.** Removing it from a document must change no ranking. Every
conformance case runs twice to verify it.

## Proposing a format change

Read [GOVERNANCE.md](./docs/GOVERNANCE.md) first. In short: open an issue describing the problem
rather than the solution, show two producers who need it, and show it cannot be an `x-` extension.

## Reporting an ambiguity

The most valuable report you can file. If two implementers can read a rule two ways, the rule is
broken regardless of what it was meant to say. Quote the section and both readings.

## Adding an implementation in another language

Start with [the implementation guide](./docs/IMPLEMENTATION-GUIDE.md), then run the conformance
suite — it is declarative JSON and needs no support for your language. Open an issue to be
listed, stating the levels you implement and the suite version you pass.

There is no certification and no fee. A standard that charges for the right to claim conformance
is not open.

## Licences

Code contributions are under [Apache 2.0](./LICENSE); contributions to the specification, schema,
examples and documentation are under [CC BY 4.0](./LICENSE-DOCS). Opening a pull request means you
are able to license your contribution under those terms.
