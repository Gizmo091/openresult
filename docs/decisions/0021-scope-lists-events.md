# ADR 0021 — A ranking scopes to a list of events; durations have a written rendering

**Status**: Accepted
**Date**: 2026-08-05

## Context

The swimming reader's report ended with four things the format could not express, or expressed
only through a workaround they described and disliked. All four came from the same session, and
three of them turned out to be one problem.

**40% of their results were copies.** §8.1.1 keeps a scoped ranking from seeing descendant events,
which is right — an overall standing must not absorb the heats feeding it. But the only way then
offered to classify across three heats was to republish every time on the parent event. They
measured it: 73 of 183 results were republications, and nothing in the document said that
`/results/12` and `/results/48` were the same swim. Two copies of one time can drift apart and no
validator would notice.

**A meeting has two axes and `parent` has one.** Events nest under rounds, and they also belong to
sessions — Friday evening, Saturday morning. `parent` is a single reference, so the second axis
was demoted to a text attribute that could group nothing: `scope` filters on `event` and
`category`, never on an attribute value. There was no way to express "the Saturday evening
session".

**A "best performance across all events" award was a third copy.** Same cause: a ranking sees one
event, or the whole document.

**A relay result is a small table.** Four swimmers, each with a leg, a time and a takeover. The
team's result has one flat `values` map, so the leg times went into `notes` — invisible to any
machine — and the takeovers became `takeover2`, `takeover3`, `takeover4`: one measure indexed by
position, gaining a declaration every time a team gets longer.

**And a duration could not be shown as `2:12.88`.** §5.2.2 requires a plain number, correctly.
`precision` counts decimals and says it "affects display only". The reader searched §5.1.5 and all
of §10.1 for a rendering hint, found none, concluded the format could not express it, and wrote
the convention into a `description` that §6.1.6 says is never parsed.

## Decision

**`scope.event` accepts an array.** A ranking may name several events; only results attached to
those events are selected, and descendants remain excluded. §8.1.5 says to prefer this over
republishing whenever nothing is computed.

**§8.1.4 now distinguishes ordering from aggregating.** A figure that is _computed_ from several
events — a points total, a sum of legs — has to be published as a result, because no consumer may
be asked to compute it (§1.2). A classification that merely _orders_ figures already recorded
lists their events and leaves them where they are.

**Per-member results go on a child event**, documented in §6.3. No new member was needed: a team
is already a participant composed of participants, and §8.1.1 keeps leg results out of any ranking
scoped to the parent.

**§5.2.5 states how to render a duration**: hours, minutes, seconds, leading zero components
dropped, declared precision kept on the seconds.

## Consequences

- The reader's 73 duplicate results become zero: the qualifying classification lists its three
  heats, each keeps its own start time and its own order. The session standing and the
  across-events award are the same shape.
- Listing is enumeration, not evaluation. A consumer selects by reading a list, which keeps
  constraint 2 of §1.2 intact — there is still nothing to execute. An attribute-value filter, the
  other candidate, would have been a predicate, and predicates grow into an expression language.
- Relay legs cost one measure instead of one per position, and the leg times become machine-
  readable rather than prose in `notes`.
- **§5.2.5 documents what the reference implementation already did.** `formatValue` had rendered
  `1:28:18.7` from the start. The specification's silence was the whole defect, and it cost a
  reader an hour. The Python minimal reader, written from the text alone, printed `132.88 s` — so
  the two implementations had disagreed about display for as long as both existed.
- `cross-implementation` now compares rendered durations as well as positions, which is what
  would have caught that. It compares durations only: thousands separators and default decimals
  follow the locale, and a reader in France should see `1 671,0` where one in the US sees
  `1,671.0`. Comparing those would enforce a rule the specification does not make.

## Alternatives considered

**`scope.attributes`, filtering on attribute values.** It answers the session question directly,
and the heat-number question too. Rejected: a set of attribute equality tests is a predicate, and
the first person to need "not equal" or "greater than" turns it into an expression language.
Listing events is duller and cannot grow that way.

**Let a scoped ranking include descendant events, optionally.** A flag such as
`scope.includeDescendants`. Rejected: it reintroduces exactly the scale-mixing §8.1.1 forbids, and
the producer who wants three heats but not a fourth is back where they started. An explicit list
is more typing and always says what it means.

**A `parts` member on a result, holding per-member figures.** Direct, and closest to how a relay
sheet looks. Rejected: it makes a result recursive, and everything that reads results — ranking,
validation, rendering, every SDK — would need to decide whether to descend. The child-event
pattern reuses machinery that already exists and that §8.1.1 already governs.

**Put the duration rendering in the presentation layer.** It is display, after all. Rejected: a
consumer may discard that layer entirely (§3.1.1), so the rendering would be optional in a way
that leaves `132.88 s` conforming. Everything §5.2.5 needs is already in the semantic layer.
