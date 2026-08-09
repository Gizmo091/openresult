# ADR 0028 — A document may state facts about itself, and `attributes` means one thing

**Status**: Accepted
**Date**: 2026-08-09

## Context

Four readers were given the specification and the examples, nothing else, and asked to publish a
competition from a domain the corpus does not cover: a powerlifting championship, a Swiss chess
tournament, an orienteering event, a county show's cattle judging.

Three of them independently found the same hole and each patched it differently. A championship's
equipment division, a tournament's time control and chief arbiter, a map scale and terrain: facts
about the competition rather than about any competitor in it, and nowhere to put them. One hung
them on an event chosen arbitrarily. One invented an event holding no results whose only purpose
was to carry three attributes. One wrote them into `description`, where §6.1.6 guarantees nothing
reads them.

They diverged because **the obvious name was taken**. On a participant, an event, a result and a
category, `attributes` holds values. On the document it held the _declarations_. So the document
was the one entity that could not carry its own attributes, and each reader had to invent
something.

§9.1.4 is the precedent and settles only half the question: categories were given `attributes` on
exactly this argument — that such figures had nowhere else to go — but a category's name was free.

## Decision

**The root's declaration array is `attributeDefinitions`.** It declares what it declares.

**The document carries `attributes`**, on the same terms as any other entity (§4.7.1).

`attributes` now means values everywhere, without exception.

## Consequences

- A venue, an equipment division, an edition of the rules in force, a map scale have a home. Two
  reference examples now use it, so the corpus shows the member rather than describing it.
- This is a breaking change to the format. It is taken because the format is a draft nobody has
  published against yet: no document exists that this invalidates. The same change after adoption
  would be a MAJOR version, and the ability to make it is the whole value of the period before
  1.0 is tagged.
- Twenty-nine documents, four code sites, the schema, the types and the specification changed
  together, and the check suite is what made that safe rather than frightening.
- The change surfaced a stale read the search missed: `references.ts` built its map of declared
  attributes from the root array and crashed on the first document carrying values instead. The
  conformance case written for the new rule is what found it, before anything else ran.

## Alternatives considered

**Rename the entity carrier instead — `attributes` → `properties`, following GeoJSON.** Cleaner in
the abstract: `measures`/`attributes` would both declare, `values`/`properties` would both carry.
Rejected on cost and on evidence. It touches roughly two hundred and thirteen sites across the
corpus against thirty, and no reader was confused by the carrier. All three expected the document's
`attributes` to hold values — the name they wanted was the one that was wrong.

**A differently named member for the document's own values** — `about`, `context`, `meta`.
Rejected: it leaves `attributes` meaning two things and adds a third word for the same idea. The
overload is the defect, and renaming the declaration array removes it rather than working around
it.

**Named members for the specific facts** — `venue`, `equipment`, `rules`. Rejected: the facts the
readers wanted were heterogeneous and domain-shaped, which is what the attribute mechanism exists
for. Adding a member per domain is the road §1.2.1 exists to close.

**Leave it, and record the gap.** What this repository did for a day, and the write-up is what made
the decision obvious. Rejected once the constraint was lifted: three independent findings against
one naming choice is not a balanced trade.
