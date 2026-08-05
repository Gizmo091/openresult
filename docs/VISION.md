# Vision

## The problem

Results are produced everywhere — a club's timing software, a benchmark harness, a league
platform, a jury spreadsheet — and they are interoperable nowhere.

Every producer invents its own shape. So every display is rebuilt from scratch, and every display
is welded to whoever produced the data. A club that changes timing vendor loses its website. A
benchmark that wants a chart writes a chart. A league that wants a mobile widget commissions one.
The same work, redone, forever.

Generic formats do not close the gap.

**A spreadsheet carries values but no meaning.** A column of numbers says nothing about whether a
smaller value is better, what unit it is in, which column decides the winner, or what `DNF`
means. A consumer cannot render it automatically, because there is nothing to reason about.

**Ad-hoc JSON is readable only by its author.** It solves the transport problem and none of the
comprehension problem. Every third party still needs a bespoke integration.

**Vendor formats are vertical and closed.** They serve one discipline, often for a fee, and never
travel across domains — which is unfortunate, because a motocross meeting, a CPU benchmark and a
photo contest have far more in common than their respective industries assume.

## Why OpenResult exists

Because the missing piece is not a data format. It is a **semantic** format.

OpenResult carries results _and what they mean_: what was measured, in what unit, which direction
wins, who competed, who did not finish, what decides a tie. With that in the document, any
consumer can rank, render, chart or export it correctly — having never heard of the producer.

The producer stops owning the display. That is the whole point.

## Philosophy

**Meaning travels with the data.** A number without its unit and its direction is not a result,
it is a digit. Everything needed to interpret a document is inside the document.

**Nothing to evaluate.** No expression language, no scoring formulas, no rule engine. Reading a
document means reading values and applying a deterministic sort. A minimal reader fits in two
hundred lines with no dependency beyond a JSON parser — because a format that takes a week to
implement does not get implemented.

**The ranking is derived, not asserted.** A document may contain no rank at all. Ordering is
computed from the declared semantics, which means it can be _verified_ — a rank you are handed
must be taken on trust, a rank you derive can be checked. It also means every additional cut —
by category, by division, by team — costs nothing.

**Presentation is a suggestion, never a requirement.** A document may hint at how it would like
to be shown. A conforming consumer is free to ignore every hint and must still be right. GeoJSON
survived a decade by refusing to carry styling; that refusal is worth imitating.

**Published documents keep working.** Everything added is optional. Everything unknown is ignored
and preserved. A file published today is readable in ten years, or the standard has failed at the
only promise that matters.

**Boring on purpose.** JSON, camelCase, plain numbers, RFC 3339 dates. No clever encodings, no
micro-syntaxes, no conventions to memorise. Cleverness in a format is a tax paid by every
implementer in every language, forever.

## Use cases

**Sport.** A timing system exports one document. The club website, the federation portal, the
live screen and the printed results all consume the same file. Changing vendor changes nothing
downstream.

**Benchmarks.** A test harness publishes machine or model scores. Comparison sites, papers and
dashboards consume them without a scraper, and the derived ranking is reproducible by anyone.

**Competitions with juries.** Hackathons, photo contests, culinary events: multi-criteria scoring
with an aggregate, expressed once, rendered anywhere.

**Business rankings.** Sales leagues, supplier scorecards, internal leaderboards — same
structure, same tooling, no bespoke dashboard.

**Aggregators.** A service that collects results from many sources can display them all without
writing one integration per source.

**Archives.** A format that is self-describing and free of external dependencies is a format that
still means something in twenty years.

## What OpenResult deliberately does not cover

Saying no is what keeps a standard implementable. None of the following is an oversight.

**Transport.** OpenResult describes a document, not a protocol. No REST API, no pagination, no
authentication, no real-time streaming. Serve it however you like.

**Storage and aggregation.** No database, no central service, no registry of results.

**Business computation.** No scoring engine, no points tables, no handicaps, no qualification
rules. Measures arrive as measured; only the _ordering_ is derived, and only by deterministic
sort.

**Visual styling.** No colours, no fonts, no layout. A document may suggest _which kind of view_
suits it. Never how it should look.

**PDF, widgets and exports.** These are consumers of the format. Anyone can build them; they are
not the format's job.

**Registration, event management and timing.** Everything upstream of the result itself.

**Cross-document identity.** Participant identity is stable within a document. There is no global
registry of athletes, teams or machines. Reconciling identities across documents is a later
question, deliberately deferred.

**Computed statistics.** The format carries what is needed to compute them, not their results.

## Long-term goals

**Become the default answer.** When someone asks "how should I publish results?", the answer
should be OpenResult — the way OpenAPI became the answer for describing an API.

**Many independent implementations.** A standard with one implementation is a library. The
conformance suite exists so that a port in any language can prove itself on day one.

**Outlive its authors.** Written decisions, an explicit versioning policy, an evolution process
open to outside contributors, and a hard commitment to backward compatibility. The measure of
success is that a document written in the first year still works in the tenth.

**Stay small.** The strongest temptation for a successful format is to absorb every adjacent
problem. The exclusions above are not a starting position to be negotiated away; they are what
keeps the format implementable in an afternoon.
