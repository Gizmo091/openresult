# OpenResult Specification

**Version**: 1.0
**Status**: Draft
**Date**: 2026-08-05
**Schema**: `https://openresult.org/schema/openresult-1.0.schema.json`

## Abstract

OpenResult is a JSON format for describing the results of competitions and evaluations. A
document carries the results **and their meaning**, so that any consumer can rank, render, export
or analyse them without knowing anything about the producer.

## Status of this document

This is a draft. Field names and semantics may change before 1.0 is declared final. Once 1.0 is
published, the compatibility guarantees in [§11](#11-versioning-and-compatibility) apply.

## Table of contents

1. [Introduction](#1-introduction)
2. [Conventions and terminology](#2-conventions-and-terminology)
3. [Concepts](#3-concepts)
4. [Document](#4-document)
5. [Measures and attributes](#5-measures-and-attributes)
6. [Participants and events](#6-participants-and-events)
7. [Results](#7-results)
8. [Rankings](#8-rankings)
9. [Categories, source and resources](#9-categories-source-and-resources)
10. [Presentation and extensions](#10-presentation-and-extensions)
11. [Versioning and compatibility](#11-versioning-and-compatibility)
12. [Validation](#12-validation)
13. [Examples](#13-examples)
14. [Normative rule index](#14-normative-rule-index)

---

## 1. Introduction

### 1.1 Purpose

A results document answers four questions: who competed, what was measured, how those
measurements compare, and what happened to those who did not finish. Existing generic formats
answer only the second. OpenResult answers all four, which is what allows a consumer to display a
correct ranking without domain knowledge.

### 1.2 Design constraints

The format is bound by four constraints, and every rule in this document follows from them.

1. **Interpretable from the document alone.** No external resource is required.
2. **Nothing to evaluate.** No expression language, no formula, no scoring rule a consumer must
   execute. Ordering is a deterministic sort over declared values.
3. **Generatable anywhere.** A JSON encoder is sufficient. No structured strings, no
   micro-syntaxes.
4. **Stable.** Everything added is optional; everything unknown is ignored and preserved.

### 1.3 Audience

Implementers of producers and consumers. Reading §2 through §8 is enough to build either.

---

## 2. Conventions and terminology

### 2.1 Requirement levels

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY** and **OPTIONAL** are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174),
when and only when they appear in all capitals.

Text marked _non-normative_ is explanatory and imposes no requirement.

### 2.2 Terminology

**Document** — a single JSON value conforming to this specification. The unit of exchange.

**Participant** — an entity that competes: a person, a team, a machine, a product, a software
model or an organisation.

**Event** — a unit of competition: a race, a heat, a match, a round, a benchmark run.

**Result** — the performance of one participant in one event.

**Measure** — the typed definition of an observed quantity: its kind, unit, precision and sort
direction.

**Attribute** — the typed definition of a descriptive property that is neither measured nor
ranked.

**Ranking** — a declared way of ordering a set of results. A ranking contains no ranks: it
contains what is needed to compute them.

**Derivation** — the deterministic computation that turns a ranking declaration and a set of
results into an ordered list with ranks.

**Producer** — software that emits a document. **Consumer** — software that reads one.

### 2.3 Notation

JSON examples use JSONC comments for annotation only; a conforming document is plain JSON and
**MUST NOT** contain comments.

Paths to document locations use [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointer
syntax, e.g. `/results/3/values/time`.

---

## 3. Concepts

### 3.1 Three layers

A document is made of three layers.

| Layer            | Members                                            | Normative | May a consumer ignore it? |
| ---------------- | -------------------------------------------------- | --------- | ------------------------- |
| **Data**         | `participants`, `events`, `results`                | Yes       | No                        |
| **Semantics**    | `measures`, `attributes`, `rankings`, `categories` | Yes       | No                        |
| **Presentation** | `presentation`                                     | **No**    | **Yes, entirely**         |

**§3.1.1** A consumer that discards the presentation layer **MUST** still produce a correct
interpretation and a correct ranking.

**§3.1.2** This specification **MUST NOT** require a conforming consumer to honour any
presentation hint.

_Non-normative: this separation is what allows the format to stay stable while display practice
evolves. It is also testable, and is tested: every conformance case runs twice, with and without
the presentation layer, and both runs must produce the same ranking._

### 3.2 The semantic layer is what distinguishes this format

A spreadsheet carries values. This format carries values **plus** the information needed to
interpret them: what each quantity is, in what unit, and which direction wins. That is what makes
automatic ranking and rendering possible.

### 3.3 Ranks are derived

**§3.3.1** A document **MAY** omit ranks entirely. A conforming consumer **MUST** be able to
compute a correct ranking from the declared semantics alone, per [§8.5](#85-derivation-algorithm).

**§3.3.2** When a producer supplies a rank, it is informative and **MUST** name the ranking it
belongs to ([§7.5](#75-ranks)). A consumer **MAY** compare it against the rank it derives for that
ranking; a validator **MUST** report a divergence as a warning, not an error.

_Non-normative: a producer may legitimately apply a tie-break rule that lives outside the
document — a jury decision, a regulation. The supplied rank records that outcome without making
the document uninterpretable to a consumer that computes its own._

---

## 4. Document

### 4.1 Root object

```jsonc
{
  "openresult": "1.0",              // REQUIRED
  "id": "mx-regional-2026-r3",      // OPTIONAL
  "version": 2,                     // OPTIONAL
  "status": "official",             // OPTIONAL
  "title": "Regional Championship — Round 3",   // REQUIRED
  "description": "…",               // OPTIONAL
  "lang": "en",                     // OPTIONAL
  "generatedAt": "2026-05-17T18:04:00+02:00",   // OPTIONAL
  "occurredAt": { "start": "…", "end": "…" },   // OPTIONAL
  "source": { … },                  // OPTIONAL
  "measures": [ … ],                // OPTIONAL
  "attributes": [ … ],              // OPTIONAL
  "participants": [ … ],            // REQUIRED
  "events": [ … ],                  // OPTIONAL
  "results": [ … ],                 // REQUIRED
  "rankings": [ … ],                // OPTIONAL
  "categories": [ … ],              // OPTIONAL
  "links": [ … ],                   // OPTIONAL
  "assets": [ … ],                  // OPTIONAL
  "presentation": { … }             // OPTIONAL, non-normative
}
```

**§4.1.1** A document **MUST** contain `openresult`, `title`, `participants` and `results`.

**§4.1.2** All other members are **OPTIONAL**.

**§4.1.3** `results` **MAY** be an empty array. An announced competition whose results are not
yet available is a valid document.

**§4.1.4** A document **MUST** be encoded in UTF-8.

### 4.2 `openresult`

**§4.2.1** `openresult` **MUST** be a string matching `^\d+\.\d+$`, declaring the format version
the document conforms to. A document conforming to this specification declares `"1.0"`.

**§4.2.2** The patch level is not expressed. Editorial corrections to this specification do not
require producers to republish.

### 4.3 `id`

**§4.3.1** `id`, when present, **MUST** be an identifier as defined in
[§5.4.1](#54-identifiers), naming the subject of the document across publications. Two documents
describing the same event **SHOULD** share the same `id`.

### 4.4 Content lifecycle: `status` and `version`

**§4.4.1** `status`, when present, **MUST** be one of:

| Value         | Meaning                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `draft`       | Preparatory, carries no authority.                                     |
| `provisional` | Published but subject to revision — jury sitting, protest window open. |
| `official`    | Authoritative.                                                         |
| `amended`     | Official results revised after publication.                            |

**§4.4.2** `version`, when present, **MUST** be a non-negative integer that strictly increases
with each republication of the same `id`.

**§4.4.3** Among documents sharing an `id`, the one with the highest `version` supersedes the
others. At equal `version`, `official` or `amended` supersedes `provisional`, which supersedes
`draft`.

**§4.4.4** A consumer that encounters an unknown `status` value **MUST** treat it as
`provisional`.

_Non-normative: this is the answer to the most common real-world requirement in results
publishing — the standings change after the jury rules, and both documents exist in the wild._

### 4.5 `lang`

**§4.5.1** `lang`, when present, **MUST** be a [BCP 47](https://www.rfc-editor.org/info/bcp47)
language tag describing the language of the human-readable text in the document.

**§4.5.2** A document carries text in a single language. Producers needing several languages
**SHOULD** publish one document per language, sharing an `id`.

### 4.6 Dates and times

**§4.6.1** Every timestamp **MUST** be an [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339)
date-time **including a UTC offset**: `2026-05-17T16:42:00+02:00`.

**§4.6.2** A full-date (`2026-05-17`) **MAY** be used in `occurredAt.start`, `occurredAt.end`
and in attribute values of type `date`. Everywhere else — `generatedAt` in particular — a
date-time with an offset is **REQUIRED**.

**§4.6.3** `generatedAt` records when the document was produced. `occurredAt` records the period
the results cover, as an object with **OPTIONAL** `start` and `end` members.

---

## 5. Measures and attributes

### 5.1 `measures`

A measure defines an observed quantity and how it orders. It is the central carrier of semantics.

```jsonc
{
  "id": "time", // REQUIRED
  "label": "Time", // REQUIRED
  "kind": "duration", // REQUIRED
  "unit": "s", // REQUIRED, except for text and boolean
  "precision": 3, // OPTIONAL
  "betterWhen": "lower", // REQUIRED
  "description": "…", // OPTIONAL
}
```

**§5.1.1** `id` **MUST** be unique among measures ([§5.4](#54-identifiers)).

**§5.1.2** `kind` **MUST** be one of `duration`, `distance`, `mass`, `points`, `score`,
`percentage`, `count`, `money`, `rate`, `text`, `boolean`.

`mass` covers a weight lifted, a bodyweight class, a catch, a payload — any physical mass. It
exists because a barbell load is not "awarded by a rule", and forcing it into `points` made a
consumer render "505 kg points".

Two of these are easily confused. **`points`** are awarded by a rule and accumulate — championship
points, match points, a chess score. **`score`** is a judgement on a scale — a jury mark, a
composite rating, a benchmark index. If competitors' values would sensibly be added together
across events, it is `points`; if they would be averaged or compared, it is `score`.

**§5.1.3** `unit` **MUST** be present when `kind` is anything other than `text` or `boolean`.

**§5.1.4** `betterWhen` **MUST** be one of `lower`, `higher`, `none`. A measure declaring `none`
is descriptive and **MUST NOT** appear in a ranking's `sortBy` ([§8.2](#82-sortby)).

**§5.1.5** `precision`, when present, **MUST** be a non-negative integer giving the number of
digits to show **after the decimal point** — not significant figures. It affects display only and
**MUST NOT** affect ordering.

**§5.1.6** A consumer encountering an unknown `kind` **MUST** treat it as `text`; an unknown
`betterWhen` **MUST** be treated as `none`.

### 5.2 Values and units

**§5.2.1** Every measured quantity **MUST** be a JSON number, expressed in the unit its measure
declares — except for measures of kind `text` (JSON string) and `boolean` (JSON boolean).

**§5.2.2** Durations **MUST** be expressed in the declared unit as a plain number. Structured
representations such as `PT21M24.532S` or `21:24.532` **MUST NOT** be used.

**§5.2.3** `unit` is never interpreted by a consumer, only displayed. This format performs no
unit conversion.

**§5.2.4** Producers **SHOULD** draw units from the recommended vocabulary: `s`, `ms`, `min`,
`h`, `m`, `km`, `mi`, `pt`, `%`, `ops/s`, `W`, `kg`, and ISO 4217 codes for `money`.

### 5.3 `attributes`

An attribute defines a descriptive property: a club, a nationality, a manufacturer, a model
version. Attributes are neither measured nor ranked.

```jsonc
{
  "id": "club", // REQUIRED
  "label": "Club", // REQUIRED
  "type": "text", // REQUIRED
  "description": "…", // OPTIONAL
}
```

**§5.3.1** `type` **MUST** be one of `text`, `number`, `date`, `url`, `country`, `boolean`. An
unknown value **MUST** be treated as `text`.

**§5.3.2** Every key used in any `attributes` object on an entity **MUST** reference a declared
attribute `id`.

**§5.3.3** An attribute value **MUST** match its declared `type`, on the same terms as a measured
value matches its `kind` ([§5.2.1](#52-values-and-units)):

| `type`    | JSON type | Format                                                        |
| --------- | --------- | ------------------------------------------------------------- |
| `text`    | string    | none                                                          |
| `number`  | number    | none — a number, never a numeric string                       |
| `boolean` | boolean   | none                                                          |
| `date`    | string    | RFC 3339 full-date or date-time ([§4.6](#46-dates-and-times)) |
| `url`     | string    | absolute URI                                                  |
| `country` | string    | ISO 3166-1 **alpha-2**, uppercase — `FR`, `GH`, `JP`          |

**§5.3.4** A value contradicting its declared type is reported as `OR-102`.

_Non-normative: alpha-2 is fixed here rather than left open because a consumer rendering a flag
or grouping by nation cannot do either against a field that is alpha-2 in one document, alpha-3
in the next and a display name in the third. Domains that use another code — FIDE and the IOC use
alpha-3 — declare a second attribute of type `text` alongside._

_Non-normative: declaring attributes rather than leaving them free-form is what lets a consumer
display them correctly without knowing what they are._

### 5.4 Identifiers

**§5.4.1** Every producer-assigned identifier — the document `id`, and those of measures,
attributes, participants, events, categories and rankings — **MUST** match `^[A-Za-z0-9_-]+$`.

**§5.4.2** Identifiers **MUST** be unique within their own collection.

**§5.4.3** Identifiers are **opaque**. A consumer **MUST NOT** infer meaning from an identifier's
shape or content.

---

## 6. Participants and events

### 6.1 `participants`

```jsonc
{
  "id": "p12",                      // REQUIRED
  "name": "Léa Marchand",           // REQUIRED
  "shortName": "L. Marchand",       // OPTIONAL
  "type": "person",                 // OPTIONAL, default "person"
  "members": ["p31", "p32"],        // OPTIONAL
  "attributes": { "club": "…" },    // OPTIONAL
  "links": [ … ], "assets": [ … ]   // OPTIONAL
}
```

**§6.1.1** `type` **MUST** be one of `person`, `team`, `machine`, `product`, `model`,
`organization`, `other`. An unknown value **MUST** be treated as `other`.

**§6.1.2** `members`, when present, **MUST** reference declared participant identifiers in the
same document. A team is a participant composed of participants.

**§6.1.3** Participant identity is scoped to the document. This specification defines no identity
across documents.

**§6.1.4** `name` is the participant's full display name and is **REQUIRED**. `shortName`, when
present, is an abbreviated form a consumer **MAY** prefer where space is tight; it **MUST NOT**
carry information absent from `name`.

**§6.1.5** `label` names an entity for display wherever it appears — on a measure, an attribute,
a ranking or a category — and `description` **MAY** expand on it in prose. Both are **OPTIONAL**
members of measures, attributes, rankings, categories, events and participants alike, and neither
is ever parsed.

### 6.2 `events`

```jsonc
{
  "id": "heat1",                    // REQUIRED
  "name": "Heat 1",                 // REQUIRED
  "type": "heat",                   // OPTIONAL, default "other"
  "parent": "overall",              // OPTIONAL
  "occurredAt": { … },              // OPTIONAL
  "participants": ["p12", "p7"],    // OPTIONAL
  "attributes": { … },              // OPTIONAL
  "links": [ … ], "assets": [ … ]   // OPTIONAL
}
```

**§6.2.1** `type` **MUST** be one of `heat`, `match`, `round`, `stage`, `session`, `final`,
`overall`, `other`. An unknown value **MUST** be treated as `other`.

**§6.2.2** `parent`, when present, **MUST** reference another declared event. The parent graph
**MUST** be acyclic.

**§6.2.3** `events` **MAY** be absent. When it is, every result belongs to a single implicit
event.

**§6.2.4** `participants`, when present, restricts the field for that event. It is informative:
a result referencing a participant absent from this list is valid, and validators **SHOULD** warn.

### 6.3 Two structures worth stating explicitly

_Non-normative._

**Heats feeding an overall standing.** Declare heat events with `parent` set to an `overall`
event. Results attach to the heats; the overall standing is a ranking whose `scope.event` is the
parent.

**Head-to-head matches.** Declare a `match` event and **two** results, one per participant, each
carrying its own score. A match is not a special case in this model: it is an event with two
results.

---

## 7. Results

```jsonc
{
  "participant": "p12",             // REQUIRED
  "event": "heat1",                 // OPTIONAL
  "status": "finished",             // OPTIONAL, default "finished"
  "ranks": { "overall": 4, "gt4": 1 },          // OPTIONAL
  "values": { "time": 1284.532 },   // OPTIONAL
  "attributes": { … },              // OPTIONAL
  "notes": "5 s penalty applied",   // OPTIONAL
  "links": [ … ], "assets": [ … ]   // OPTIONAL
}
```

**§7.1.1** `participant` **MUST** reference a declared participant.

**§7.1.2** `event`, when present, **MUST** reference a declared event. It **MUST** be present if
the document declares `events`.

**§7.1.3** The pair (`participant`, `event`) **MUST** be unique across `results`.

### 7.2 `status`

**§7.2.1** `status` **MUST** be one of:

| Value        | Meaning                | Excluded by default |
| ------------ | ---------------------- | ------------------- |
| `finished`   | Completed              | No                  |
| `bye`        | Scored without playing | No                  |
| `inProgress` | Still competing        | Yes                 |
| `dnf`        | Did not finish         | Yes                 |
| `dns`        | Did not start          | Yes                 |
| `dsq`        | Disqualified           | Yes                 |
| `outOfTime`  | Outside the time limit | Yes                 |
| `withdrawn`  | Withdrew or forfeited  | Yes                 |

**§7.2.2** An unknown `status` **MUST** be treated as `finished`.

**§7.2.3** Exclusion is a property of a **ranking**, not of a status. The column above gives the
default exclusion set of [§8.4.2](#84-excludestatuses); a ranking that declares its own
`excludeStatuses` replaces that set entirely ([§8.4.1](#84-excludestatuses)). The same result may
therefore be ranked by one ranking and unranked by another in the same document — a retired car
that still sets the fastest lap is the ordinary case, not an anomaly.

**§7.2.4** A result excluded from a ranking **MUST** remain available for display. A consumer
**SHOULD** show it without a rank rather than omit it.

**§7.2.5** `bye` marks a competitor who scored without a contest — an odd field in a Swiss
pairing, a knockout draw with no opponent, or a walkover. It ranks normally: the score counts.
Where the distinction between an unopposed pairing and an absent opponent matters, `notes`
carries it.

### 7.3 `values`

**§7.3.1** Every key in `values` **MUST** reference a declared measure `id`.

**§7.3.2** A measure absent from `values` means **not available**. `null` **MUST NOT** be used,
and `0` means zero.

**§7.3.3** The type of each value **MUST** match its measure's `kind`, per
[§5.2.1](#52-values-and-units).

### 7.4 `notes`

**§7.4.1** `notes` is free text addressed to a human reader. A consumer **MUST NOT** parse it to
derive machine behaviour.

### 7.5 `ranks`

**§7.5.1** `ranks`, when present, **MUST** be an object whose keys are declared ranking
identifiers and whose values are positive integers.

**§7.5.2** A supplied rank is **informative**: it records the position the producer published. It
is never required, and a consumer **MUST** be able to derive the same ordering without it
([§3.3.1](#33-ranks-are-derived)).

**§7.5.3** A key **MUST NOT** name a ranking that excludes this result
([§8.5.2](#85-derivation-algorithm)). Publishing a position in a ranking the result does not
belong to is a contradiction, and is reported as `OR-303`.

**§7.5.4** A key naming an undeclared ranking is a reference error (`OR-201`).

_Non-normative: a single scalar rank cannot serve a document that declares several rankings — a
GT4 car finishing fourth overall and first in class has two positions, and both are facts the
producer may want to publish. Keying by ranking also gives a validator something unambiguous to
compare against, which a bare number never did._

---

## 8. Rankings

A ranking declares **how to order**, never the order itself.

```jsonc
{
  "id": "general", // REQUIRED
  "label": "Overall standings", // REQUIRED
  "scope": {
    // OPTIONAL
    "event": "overall",
    "category": "mx2",
  },
  "sortBy": ["points", "time"], // REQUIRED
  "ties": "standard", // OPTIONAL, default "standard"
  "excludeStatuses": ["dnf", "dns"], // OPTIONAL
}
```

### 8.1 `scope`

**§8.1.1** `scope.event`, when present, **MUST** reference a declared event; only results
attached to **that event** are considered. Descendant events are **not** included.

_Non-normative: the `parent` relation groups events for navigation and display; it does not
aggregate results. A standing scoped to an overall event must not absorb the results of its
heats — those are separate results, on a different scale, and mixing them would produce a
meaningless order. Aggregating across events is the producer's job, and its outcome is expressed
as results attached to the parent event._

**§8.1.2** `scope.category`, when present, **MUST** reference a declared category; only results
whose participant belongs to it are considered.

**§8.1.3** `scope` absent means all results in the document. `scope` accepts `event` and
`category`; when both are present, a result **MUST** satisfy each of them.

### 8.2 `sortBy`

**§8.2.1** `sortBy` **MUST** be a non-empty array of declared measure identifiers, in decreasing
order of priority.

**§8.2.2** `sortBy` **MUST NOT** contain a measure whose `betterWhen` is `none`, nor one whose
`kind` is `text` or `boolean`. Only numeric kinds may decide an order.

_Non-normative: "ascending" over text has no single answer — code points, locale collation and
case folding all disagree, and the choice would vary with where the consumer runs. Rather than
mandate one, the format declines to order text at all. A domain that ranks by grade declares a
numeric measure and keeps the letter as an attribute._

**§8.2.3** Sort direction **MUST NOT** be declared in the ranking. It comes exclusively from each
measure's `betterWhen`.

_Non-normative: a direction declared in two places can be declared inconsistently, and nothing in
the document would settle which one is right. Tying direction to the measure leaves one source of
truth. A case genuinely needing the opposite direction declares a second measure._

### 8.3 `ties`

**§8.3.1** `ties` **MUST** be one of:

| Value      | Produces   | Notes                                                       |
| ---------- | ---------- | ----------------------------------------------------------- |
| `standard` | 1, 2, 2, 4 | Default. Prevailing competition convention.                 |
| `dense`    | 1, 2, 2, 3 | No rank is skipped.                                         |
| `strict`   | —          | No tie permitted; a residual tie is a validation **error**. |

**§8.3.2** An unknown `ties` value **MUST** be treated as `standard`.

**§8.3.3** `strict` declares an expectation, not a consumer behaviour. A consumer encountering a
residual tie under `strict` **MUST** assign ranks as though `standard` had been declared, so that
an order still exists and [§8.5.6](#85-derivation-algorithm) holds. Reporting the condition is the
validator's job (`OR-302`), not the reader's.

_Non-normative: without this, a document that turns out to contain a tie would have no defined
rendering at all, and two consumers could reasonably refuse or fall back differently — the exact
divergence §8.5.6 forbids._

### 8.4 `excludeStatuses`

**§8.4.1** `excludeStatuses`, when present, **MUST** be an array of status values excluded from
this ranking. It **replaces** the default set in full; it is not added to it. A ranking declaring
`excludeStatuses: ["dns"]` therefore ranks retired and disqualified competitors.

**§8.4.2** When absent, the default set applies: `inProgress`, `dnf`, `dns`, `dsq`, `outOfTime`,
`withdrawn`.

_Non-normative: replacement rather than union is what makes a "fastest lap" ranking
expressible at all — one that ranks competitors the overall standings exclude. It does not, on its
own, express "best attempt across rounds": a ranking sees one event ([§8.1.1](#81-scope)), so a
producer comparing attempts held in separate events publishes the best as a result on their parent
event. The
cost is that an author writing `excludeStatuses: ["dsq"]` gets only that exclusion, so the common
case is to omit the member entirely and take the default._

### 8.5 Derivation algorithm

**Normative.** Given a ranking declaration and a document, a consumer computes the ordered result
list as follows.

**§8.5.1 — Selection.** Retain results matching `scope`. Absent `scope`, retain all.

**§8.5.2 — Partition.** A retained result is **rankable** if _both_ hold:

- its `status` is not in `excludeStatuses`; and
- its `values` contains every measure listed in `sortBy`.

All others are **unranked**.

_A ranking that drops results this way is valid and often wrong._ A classification sorting on
`["round1Faults", "jumpOffFaults"]` leaves every competitor who did not reach the jump-off
unranked — a twelve-horse Grand Prix rendering as five. The producer's remedy is to publish
measures every selected result carries, copying earlier values forward where a later round did
not happen. A validator reports the condition as `OR-908`, because the document cannot say whether
the omission was deliberate.

**§8.5.3 — Sort.** Order the rankable results by successive comparison over `sortBy`. For each
measure, `betterWhen: "lower"` orders ascending and `betterWhen: "higher"` orders descending. The
sort **MUST** be **stable**: results comparing equal on every criterion retain their declaration
order in `results`.

**§8.5.4 — Assign.** Assign ranks according to `ties`. Two results are tied when they compare
equal on every measure in `sortBy`.

**§8.5.5 — Unranked.** Unranked results follow the ranked ones, in declaration order, with no
rank.

**§8.5.6 — Determinism.** The result depends only on the document. Two conforming consumers
processing the same document **MUST** produce identical output, ties included.

### 8.6 Implicit ranking

**§8.6.1** A document declaring no `rankings` remains rankable. A consumer **MUST** apply an
implicit ranking: `sortBy` is the first declared measure whose `betterWhen` is not `none`, `ties`
is `standard`, and `excludeStatuses` is the default of [§8.4.2](#84-excludestatuses).

**§8.6.2** If no measure qualifies, the document has no ranking, and results are presented in
declaration order.

---

## 9. Categories, source and resources

### 9.1 `categories`

```jsonc
{ "id": "mx2", "label": "MX2", "participants": ["p12", "p7"], "parent": "senior" }
```

**§9.1.1** A category **MUST** carry `id` and `label`. `participants` and `parent` are
**OPTIONAL**. `participants`, when present, **MUST** reference declared participants; a
participant **MAY** belong to several categories. A category with no `participants` selects no
result, which a validator reports as `OR-907`.

**§9.1.2** `parent`, when present, **MUST** reference another declared category, and the graph
**MUST** be acyclic.

**§9.1.3** Categories **MUST NOT** duplicate results. A category standing is a ranking whose
`scope.category` names it.

### 9.2 `source`

```jsonc
{
  "name": "Valley Motor Club", // REQUIRED when source is present
  "system": "ChronoX 4.2", // OPTIONAL
  "url": "https://…", // OPTIONAL
  "license": "CC-BY-4.0", // OPTIONAL
  "contact": "results@…", // OPTIONAL
}
```

**§9.2.1** `name` identifies the organisation answerable for the results and is **REQUIRED**
whenever `source` is present. `system` names the software that produced the document, `contact`
gives an address for questions about the data, and `url` points at the canonical publication.

**§9.2.2** `license`, when present, **SHOULD** be an [SPDX](https://spdx.org/licenses/)
identifier, and states the terms under which the _data_ may be reused.

### 9.3 `links` and `assets`

```jsonc
"links":  [ { "rel": "official", "href": "https://…", "label": "Official results" } ],
"assets": [ { "type": "image", "href": "https://…", "label": "Podium" } ]
```

**§9.3.1** Both **MAY** appear on the document and on any entity. A link **MUST** carry `href`;
`rel` and `label` are **OPTIONAL**. An asset **MUST** carry `href`; `type` and `label` are
**OPTIONAL**.

**§9.3.2** `href` **MUST** be an absolute URI.

**§9.3.3** Their absence **MUST NOT** prevent interpretation. A consumer unable to fetch a
resource **MUST** continue without it.

**§9.3.4** `rel` describes what a link points at, as free text; `label` is its display text.
A consumer **MUST NOT** make behaviour depend on `rel`, whose vocabulary this version does not
constrain.

**§9.3.5** An asset's `type` **MUST** be one of `image`, `video`, `audio`, `document` or `other`.
An unknown value **MUST** be treated as `other`. The member is a hint about how the resource
might be presented; a consumer is never required to fetch it.

---

## 10. Presentation and extensions

### 10.1 `presentation`

```jsonc
{
  "defaultView": "ranking",
  "measureOrder": ["time", "laps"],
  "attributeOrder": ["club"],
  "highlight": ["p12"],
}
```

**§10.1.1** Every member of `presentation` is **OPTIONAL** and **non-normative**.

**§10.1.2** A consumer **MAY** ignore the entire object. Removing it from a document **MUST NOT**
change any derived ranking.

**§10.1.3** `defaultView` is a suggestion. A consumer that does not implement the named view
**MUST** select its own.

**§10.1.4** `measureOrder` and `attributeOrder` suggest a display order; identifiers they omit
**MUST** still be displayable, and identifiers they name but the document does not declare
**MUST** be ignored. `highlight` names participants a consumer **MAY** emphasise. None of these
**MUST** affect the derived ranking.

### 10.2 Extensions

**§10.2.1** Any member whose name begins with `x-` is an extension. Extensions **MAY** appear on
the document and on any entity.

**§10.2.2** A consumer **MUST** ignore extensions it does not understand, without error.

**§10.2.3** A consumer that rewrites a document **MUST** preserve extensions unchanged.

**§10.2.4** Any member that is neither defined by this specification nor prefixed `x-` is a
validation **error**, _for the version the document declares_. A validator checks a document
against its declared version; a consumer reading a higher MINOR version ignores what it does not
recognise ([§11.4.2](#114-version-negotiation)). The two rules govern different acts — validating
and reading — and a tool doing both applies each to its own.

_Non-normative: without this, a 1.0 validator handed a 1.1 document holding a member added in 1.1
would face two mandatory and opposite instructions. Rejecting the unknown member is right when
checking a 1.0 document and wrong when reading a 1.1 one; the declared version tells them apart._

_Non-normative: rejecting unprefixed unknown members is what turns a misspelled `participants`
into an error rather than silently discarded data._

---

## 11. Versioning and compatibility

### 11.1 Version numbering

**§11.1.1** The format is versioned `MAJOR.MINOR`. A MAJOR increment signals a break; a MINOR
increment is backward compatible.

### 11.2 Guarantees to producers

**§11.2.1** A document valid under 1.0 **MUST** remain valid and identically interpretable under
every later 1.x version.

**§11.2.2** A MINOR version **MAY** add optional members, enumeration values, and warning-level
rules. It **MUST NOT** add a required member, remove a member, narrow a value domain, or change
the derivation algorithm.

### 11.3 Obligations on consumers

**§11.3.1** A consumer **MUST** ignore unknown members prefixed `x-`, and **MUST** treat unknown
enumeration values as the fallback defined for that domain: `other` for `type`, `finished` for
`status`, `none` for `betterWhen`, `text` for attribute `type`, `standard` for `ties`,
`provisional` for document `status`.

**§11.3.2** A consumer **MUST NOT** derive meaning from identifiers ([§5.4.3](#54-identifiers)).

**§11.3.3** A consumer **MUST NOT** make interpretation depend on the presentation layer.

### 11.4 Version negotiation

| Situation                                | Required behaviour                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `openresult` absent                      | **Error**: not an OpenResult document.                                        |
| MAJOR known, MINOR higher than supported | Process the document; ignore what is unknown.                                 |
| MAJOR unknown                            | **Reject explicitly**, naming both the encountered and the supported version. |
| Malformed value                          | Validation **error**.                                                         |

**§11.4.1** A consumer encountering an unknown MAJOR version **MUST NOT** attempt to interpret
the document, and **MUST** report the situation distinctly from an invalid document.

**§11.4.2** A consumer encountering a known MAJOR version with a higher MINOR version **MUST**
process the document normally, ignoring what it does not recognise.

### 11.5 Conformance levels

**§11.5.1 — Producer.** Emits UTF-8 JSON; populates the required members; declares every measure
and attribute it uses; expresses values in declared units; omits unavailable measures rather than
emitting `null`; produces documents that validate without error.

**§11.5.2 — Consumer, _reading_ level.** Reads `openresult` and rejects an unknown MAJOR;
presents participants, results and values with their units; distinguishes rankable from
non-rankable statuses; ignores extensions and unknown enumeration values; distinguishes an absent
measure from a zero.

**§11.5.3 — Consumer, _ranking_ level.** Everything above, plus [§8.5](#85-derivation-algorithm)
implemented exactly, including sort stability and tie handling.

**§11.5.4 — Consumer, _rewriting_ level.** Everything above, plus preservation of every member it
does not understand.

### 11.6 Media type and file extension

**§11.6.1** The proposed media type is `application/vnd.openresult+json`, optionally
parameterised `; version=1.0`. Registration is pending.

**§11.6.2** Consumers **MUST** also accept `application/json`.

**§11.6.3** The recommended file extension is `.openresult.json`.

---

## 12. Validation

Validation has two parts: structural conformance to the schema, and the semantic rules a schema
cannot express.

### 12.1 Severity

**§12.1.1** An **error** means the document is not conforming. A **warning** means it is
conforming but questionable.

**§12.1.2** A validator **MUST** report both, distinctly.

**§12.1.3** Every diagnostic **MUST** carry the location in the document, the rule violated in
plain language, and at least one concrete correction.

### 12.2 Diagnostic codes

| Code     | Severity | Rule                                                                                                                                                                             |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OR-101` | error    | Required member missing (§4.1.1)                                                                                                                                                 |
| `OR-102` | error    | Member has the wrong type (§5.2.1, §7.3.3)                                                                                                                                       |
| `OR-103` | error    | Value outside its permitted domain (§5.1.2, §7.2.1)                                                                                                                              |
| `OR-104` | error    | Identifier does not match the permitted character set (§5.4.1)                                                                                                                   |
| `OR-105` | error    | Unknown member, not prefixed `x-` (§10.2.4)                                                                                                                                      |
| `OR-106` | error    | Timestamp is not RFC 3339 with an offset, where §4.6.2 does not allow a full-date (§4.6.1)                                                                                       |
| `OR-107` | error    | `unit` missing for a kind that requires one (§5.1.3)                                                                                                                             |
| `OR-108` | error    | `null` used for an unavailable measure (§7.3.2)                                                                                                                                  |
| `OR-201` | error    | Reference to an undeclared entity (§6.1.2, §7.1.1, §7.1.2, §8.1.1)                                                                                                               |
| `OR-202` | error    | Duplicate identifier within a collection (§5.4.2)                                                                                                                                |
| `OR-203` | error    | Duplicate (`participant`, `event`) pair (§7.1.3)                                                                                                                                 |
| `OR-204` | error    | Cycle in a `parent` graph (§6.2.2, §9.1.2)                                                                                                                                       |
| `OR-205` | error    | `values` key does not reference a declared measure (§7.3.1)                                                                                                                      |
| `OR-206` | error    | `attributes` key does not reference a declared attribute (§5.3.2)                                                                                                                |
| `OR-301` | error    | `sortBy` contains a measure whose `betterWhen` is `none` (§8.2.2)                                                                                                                |
| `OR-302` | error    | Residual tie under `ties: "strict"` (§8.3.1)                                                                                                                                     |
| `OR-303` | error    | `ranks` names a ranking that excludes this result (§7.5.3)                                                                                                                       |
| `OR-304` | error    | `sortBy` is empty (§8.2.1)                                                                                                                                                       |
| `OR-305` | error    | `sortBy` contains a `text` or `boolean` measure (§8.2.2)                                                                                                                         |
| `OR-401` | error    | `openresult` absent or malformed (§4.2.1)                                                                                                                                        |
| `OR-402` | error    | Unsupported MAJOR version (§11.4.1)                                                                                                                                              |
| `OR-403` | —        | **Retired.** Reserved for a rule comparing `version` across two documents sharing an `id`. A validator sees one document, so the rule cannot be checked. The code is not reused. |
| `OR-901` | warning  | A declared measure is used by no result                                                                                                                                          |
| `OR-902` | warning  | A supplied rank diverges from the one derived for that ranking (§3.3.2)                                                                                                          |
| `OR-903` | warning  | `lang` absent although the document carries text (§4.5.1)                                                                                                                        |
| `OR-904` | warning  | A result references a participant absent from its event's field (§6.2.4)                                                                                                         |
| `OR-905` | warning  | A declared attribute is used by no entity                                                                                                                                        |
| `OR-906` | warning  | A declared ranking selects no result                                                                                                                                             |
| `OR-907` | warning  | A declared category selects no result (§9.1.1)                                                                                                                                   |
| `OR-908` | warning  | A ranking leaves selected results unranked for want of a sorting measure (§8.5.2)                                                                                                |

**§12.2.1** A published code is permanent. Removing or reassigning one is a breaking change.

### 12.3 Conformance suite

**§12.3.1** The conformance suite is the operational definition of conformance. Every normative
rule in this specification **MUST** be exercised by at least one case.

---

## 13. Examples

### 13.1 Minimal document

Valid, and containing no rank at all: the ordering is entirely derived.

```json
{
  "openresult": "1.0",
  "title": "Crest Trail 2026 — 21 km",
  "lang": "en",
  "measures": [
    {
      "id": "time",
      "label": "Time",
      "kind": "duration",
      "unit": "s",
      "precision": 1,
      "betterWhen": "lower"
    }
  ],
  "participants": [
    { "id": "p1", "name": "Léa Marchand" },
    { "id": "p2", "name": "Tomás Ferreira" },
    { "id": "p3", "name": "Nour Benali" }
  ],
  "results": [
    { "participant": "p1", "values": { "time": 5412.4 } },
    { "participant": "p2", "status": "dnf" },
    { "participant": "p3", "values": { "time": 5298.7 } }
  ],
  "rankings": [{ "id": "scratch", "label": "Scratch", "sortBy": ["time"] }]
}
```

Derived ranking: **1.** Nour Benali (5298.7 s) — **2.** Léa Marchand (5412.4 s). Tomás Ferreira
is displayed without a rank, marked _did not finish_.

### 13.2 Head-to-head

Two results, one event, one score each.

```json
{
  "openresult": "1.0",
  "title": "Matchday 14",
  "measures": [
    { "id": "goals", "label": "Goals", "kind": "count", "unit": "goal", "betterWhen": "higher" }
  ],
  "participants": [
    { "id": "t1", "name": "AS Rivière", "type": "team" },
    { "id": "t2", "name": "FC Colline", "type": "team" }
  ],
  "events": [{ "id": "m1", "name": "AS Rivière – FC Colline", "type": "match" }],
  "results": [
    { "participant": "t1", "event": "m1", "values": { "goals": 2 } },
    { "participant": "t2", "event": "m1", "values": { "goals": 1 } }
  ]
}
```

### 13.3 Ties

Under `ties: "standard"`, two results tied for second produce ranks 1, 2, 2, 4. Under `dense`,
1, 2, 2, 3. Under `strict`, the same document is invalid with `OR-302`.

Further examples, covering all eleven reference domains and the edge cases, are published in
`examples/`.

---

## 14. Normative rule index

Every rule carries a section identifier of the form §N.M.K, stable across editorial revisions of
this document. Diagnostics reference these identifiers, and the conformance suite records, for
each case, the rule it exercises.

| Area                          | Sections          |
| ----------------------------- | ----------------- |
| Layers and derivability       | §3.1.1 – §3.3.2   |
| Document structure            | §4.1.1 – §4.6.3   |
| Measures and attributes       | §5.1.1 – §5.4.3   |
| Participants and events       | §6.1.1 – §6.2.4   |
| Results                       | §7.1.1 – §7.5.4   |
| Rankings and derivation       | §8.1.1 – §8.6.2   |
| Categories, source, resources | §9.1.1 – §9.3.5   |
| Presentation and extensions   | §10.1.1 – §10.2.4 |
| Versioning and compatibility  | §11.1.1 – §11.6.3 |
| Validation                    | §12.1.1 – §12.3.1 |

---

## References

- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — Key words for requirement levels
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) — Date and time on the Internet
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) — JSON Pointer
- [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) — Ambiguity of uppercase requirement keywords
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) — JSON
- [BCP 47](https://www.rfc-editor.org/info/bcp47) — Tags for identifying languages
- [JSON Schema draft 2020-12](https://json-schema.org/specification-links#2020-12)

## Licence

This specification is published under [CC BY 4.0](../LICENSE-DOCS).
