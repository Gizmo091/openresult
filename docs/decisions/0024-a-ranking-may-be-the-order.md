# ADR 0024 — A ranking may be the order itself

**Status**: Accepted
**Date**: 2026-08-06

## Context

Two more outside readers, in domains chosen because they attack what was still fragile: a
competitive examination, and a robotics tournament played by alliances.

**The examination could not be written at all.** A concours publishes "1. Berthier, 2. Ouazzani, 3. Vandenberghe" and is very often forbidden from publishing the marks behind it. The rank is not
informative there — it _is_ the published fact. Three rules combined to refuse it: §8.2.1 required
a non-empty `sortBy`, §8.5.2 then left every result unranked for want of those measures, and
§7.5.3 rejected the published positions as belonging to a ranking that does not rank them. The
reader did not assert this; they built the document and reported three `OR-303` errors on a
publication their institution issues verbatim.

**Figures that belong to a group had nowhere to live.** A number of places, a cut-off mark, a
medal quota. Not a competitor's performance, not a property of an event shared by several
categories — properties of the category. §9.1.1 closed the member list, so two readers
independently put those numbers into `description`, where §6.1.6 promises nothing will read them.

**The ties table contradicted its own prose.** The robotics reader found §8.3.1 saying `strict`
produces nothing where §8.3.3 says a consumer ranks as though `standard` had been declared, and
saying `resolved` produces 1, 2, 3 where §8.3.4 falls back to `standard` for a group it cannot
settle. They hesitated to use `strict` at all.

## Decision

**§8.3.5** — a ranking declaring `ties: "resolved"` may leave `sortBy` empty. Every result then
compares equal, the whole set is one group, and the published positions order it.

**§9.1.4** — categories carry `attributes`, on the same terms as every other entity.

**§8.3.1** — the table states what the prose actually does, and §8.3.4 says out loud that using
`resolved` well means having derived the ranking first.

**§5.1.8** — bounds belong to the measure and therefore to every value of it: a measure carried
both by one round and by an aggregate of rounds should omit them or be split in two.

**§5.3.8** — an absent attribute means "not recorded", as §7.3.2 already said for measures.

## Consequences

- **The derivation already did this.** With an empty `sortBy` under `resolved` the Python reader
  produced the right order before anything was changed; only validation refused. §8.3.5 is
  therefore declarative, and §8.5.6 holds because the order is read from the document rather than
  computed from it.
- Every publication whose underlying figures are confidential becomes expressible: examinations,
  juries, administrative lists. This was previously possible only by inventing a measure holding
  the rank — which §8.3.4's own note names as the thing it exists to avoid.
- `OR-911` covers how it fails: positions missing means the group stays tied, and a whole ranking
  collapsing to a shared first place is silent otherwise.
- Extending a feature and forgetting its checks is its own defect. `OR-905` briefly reported
  attributes used only on a category as unused, because the collector had not been told categories
  now carry them.
- The robotics reader's central finding is **recorded and not fixed**: a result belongs to one
  participant, so an alliance score forced them to invent a participant per match — 26 of 42, and
  growing with matches rather than teams. Their `coParticipants` proposal would remove the
  fictions, but `participant` stays required, so an alliance score would still have to name one of
  its three teams as holder. That is arbitrary in a way the format currently avoids by being
  honest about the fiction, and it is a design decision rather than a correction.

## Alternatives considered

**A dedicated `order: "published"` member on the ranking.** Clearer to read than an empty
`sortBy`. Rejected: `resolved` already means "the published positions decide", and a second member
saying nearly the same thing is a second member to keep consistent with the first. The empty array
is the honest statement that there is nothing to sort on.

**Allow an empty `sortBy` under any `ties` value.** Simpler rule. Rejected: under `standard` it
would produce a document where every result shares first place and nothing says that was intended.
Requiring `resolved` makes the producer state what they mean.

**Let a rank-holding measure remain the idiom.** It works today and needs no change. Rejected on
the specification's own argument: it encodes an answer already known as though it were an
observation, and it renders as "Merit: 1 pt", which is a contradiction in terms.

**Leave category figures to extensions.** `x-places` would work. Rejected for the same reason as
scales in ADR 0023: `examples/README.md` says a reference domain needing an extension reveals a
gap, and two readers hitting the same wall is that gap being reported twice.
