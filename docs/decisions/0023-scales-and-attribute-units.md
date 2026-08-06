# ADR 0023 — Measures declare a scale, attributes declare a unit

**Status**: Accepted
**Date**: 2026-08-06

## Context

Two documents were built from the specification alone, in domains the corpus does not cover: a
six-stage cycling race and a blind wine competition. Both documents validated with no error and no
warning, which had not happened before. What came back is therefore about what the format cannot
say rather than about what it says wrongly, and they arrived at two of the same conclusions
independently.

**A score has no scale.** A wine is marked out of 10 for appearance, 30 for nose, 40 for palate,
20 for harmony. `"nose": 27` is excellent out of 30 and poor out of 100. §5.1 offered `id`,
`label`, `kind`, `unit`, `precision`, `betterWhen`, `description` — nowhere to put the maximum. It
went into `description`, which §6.1.6 says is never parsed, and that is the exact scenario §5.2.5's
own note tells about durations: search §5.1.5, search §10.1, find nothing, write the convention
where nothing can read it.

**An attribute has no unit.** A stage distance, a summit altitude, an elimination time limit, a
bottle price, an alcohol content: all describe an entity rather than a performance, so all are
attributes. Attributes have a `type` and no `unit`. Both ended up with
`"label": "Distance (km)"` — the unit in a display string. Put another way, measures
got a whole section on unit vocabulary and two non-normative notes; attributes got nothing, which
reads as an omission rather than a decision.

Three smaller things came out of the same pair:

- **§8.5 never mentions `resolved`.** A mass finish in road cycling gives every rider in the group
  the same time, and they are still classified in the order they crossed the line — the normal case
  of an entire sport, not the exception §8.3.4's note describes. Establishing that sort stability
  (§8.5.3) orders the array and not the rank, and then finding `resolved` by reading §8.3 to the
  end, costs twenty-five minutes.
- **§7.2.7 forced `notClassified` on an aggregate event**, which destroys the difference between a
  rider who abandoned, one eliminated on time, and one disqualified. All are excluded by default,
  so the derived standings are identical and the screen is not.
- **`scope.category` was singular** while `scope.event` had just become a list.

## Decision

**`min` and `max` on a measure** (§5.1.8), bounding the scale and never the ranking. A value
outside them is `OR-909`, a warning, and still takes part in derivation.

**`unit` on a numeric attribute** (§5.3.7), from the same vocabulary as a measure's. Declaring it
on any other type is `OR-110`.

**§8.5.4 points at §8.3.4**, and says that stability orders the array rather than the rank.

**§7.2.8**: on an aggregate event the status is the most specific one that is true of the
aggregate. A rider who abandons is `dnf` there; `notClassified` is what remains when nothing more
specific applies.

**`scope.category` accepts a list**, selecting the union.

## Consequences

- Judged domains become expressible without prose: sports judging, model evaluation, examinations
  and competitions all mark against a maximum, and none of them could say so.
- A consumer can now render `36/40`, normalise four criteria onto one axis, and notice `47` where
  the maximum is 40 — the last of which no validator could previously catch.
- **A union is not an intersection, and getting that wrong nearly shipped.** The first draft of
  §8.1.2's note claimed that listing a colour and two price bands expressed "the reds under €15".
  It does not: categories combine as a union, so adding the colour widens the selection. The
  conformance case written to demonstrate the claim disproved it, and the rule now states the
  limit outright. Crossing two axes still requires a category of its own, which is the price of
  §1.2.2 — a scope mixing unions and intersections would be a query language.
- Two conformance cases written the same night declared `level: "document"`, which has never been a
  level. The runner skips an unknown level and reports the skip as a pass, so they were counted
  without running. `conformance-manifest` now reads the valid levels out of the runner itself.

## Alternatives considered

**Leave scales to `x-` extensions.** The format has an extension mechanism precisely for gaps.
Rejected on the corpus's own criterion: `examples/README.md` says a reference domain needing an
extension reveals a gap in the format. The wine document declined to use one for exactly that
reason, which is what made the gap visible.

**A single `scale` object, `{ "min": 0, "max": 40 }`.** Tidier to read. Rejected: it makes the
common case — a maximum with no meaningful minimum — carry a container for one value, and every
consumer has to check two levels of presence instead of one.

**Reject values outside the scale as errors.** Defensible: a 47 out of 40 is wrong data. Rejected:
the document still orders perfectly well, and refusing to render standings because one figure is
out of range hides the result in order to report the typo. It is a warning for the same reason
`OR-902` is.

**Give attributes the full measure vocabulary — `kind`, `precision`, `betterWhen`.** Rejected: an
attribute that could declare a direction would be a measure, and the distinction §5.3.5 draws
between what is observed and what is allocated would collapse. A unit is the one part that
describes the value rather than how to compare it.
