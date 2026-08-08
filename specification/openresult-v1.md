# OpenResult Specification

**Version**: 1.0
**Status**: Draft
**Date**: 2026-08-05
**Schema**: `https://openresult.dev/schema/openresult-1.0.schema.json`

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
ranking; a validator **MUST** report a divergence as a warning, not an error. Under
`ties: "resolved"` the supplied positions take part in the derivation itself
([§8.3.4](#83-ties)), so a position that only settles a tie no longer diverges — one that
contradicts the measures still does.

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

_Non-normative: §4.4.3 ranks `official` and `amended` together, above `provisional`, above
`draft`. It ranks nothing else._ A document carrying no `status` is in none of those ranks, and
§4.4.4 is about an unknown value rather than an absent one, so where two documents share an `id`
and a `version` and either states no standing, the order is not defined and a consumer should keep
both rather than choose. The same holds for two documents that are `official` at the same version:
one of them was published in error, and guessing which would hide it.

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
  "min": 0, // OPTIONAL
  "max": 40, // OPTIONAL
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
**MUST NOT** affect ordering. Rounding applies to the number as the document writes it, and a
value falling exactly halfway **MUST** be rounded away from zero: `8.5` shown to no decimals is
`9`, `-8.5` is `-9`, and `2.675` to two decimals is `2.68`.

_Non-normative: the halfway case decides a published time, and two consumers disagreeing about it
by a second is the divergence this format exists to prevent._ It went unstated until the reference
implementation and the minimal reader rendered the same 1:28:08.5 as `1:28:09` and `1:28:08` —
neither wrong, because each language's default rounding is a defensible convention and the format
had chosen neither. The second sentence matters as much: `2.675` is not stored exactly, and
rounding what is stored gives `2.67` while rounding what the producer typed gives `2.68`. The
reference implementation did the first for durations and the second for everything else, so one
consumer rendered the same figure two ways.

**§5.1.6** A consumer encountering an unknown `kind` **MUST** treat it as `text`; an unknown
`betterWhen` **MUST** be treated as `none`.

**§5.1.7** A declared measure that no result carries a value for is reported as `OR-901`, a
warning. It is legal — a measure may be declared for a round that has not been swum yet — but the
commonest cause is a misspelling between the declaration and the results, which would otherwise
show up as a column that is always empty.

**§5.1.8** `min` and `max` **MAY** declare the bounds of the scale the measure is expressed on.
Both are numbers, both are optional, and each may be given without the other. `min` **MUST NOT**
exceed `max` (`OR-109`).

They bound the **scale**, never the ranking. A value outside them is reported as `OR-909` and
still takes part in derivation: refusing to order a document because one figure is out of range
would hide the standings in order to report a typo.

The bounds belong to the measure and therefore to **every** value of it in the document. A measure
carried both by a single round and by an aggregate of rounds has two scales, not one, and
**SHOULD** either omit the bounds or be declared as two measures.

_Non-normative: a jury score means nothing without its scale. 27 is excellent out of 30 and poor
out of 100, and a document declaring four criteria marked out of 10, 30, 40 and 20 cannot be
rendered as `36/40`, cannot put those criteria on one axis, and cannot notice `47` where the
maximum is 40. §5.2.5 argues that a duration needs no rendering hint because everything required
is already declared — which is true there and was false here, for the one kind that needs it most.
Without these members the maximum could only be written into `description`, which §6.1.6 says is
never parsed. Judged sport, model evaluation and examinations have the same shape._

### 5.2 Values and units

**§5.2.1** Every measured quantity **MUST** be a JSON number, expressed in the unit its measure
declares — except for measures of kind `text` (JSON string) and `boolean` (JSON boolean).

**§5.2.2** Durations **MUST** be expressed in the declared unit as a plain number. Structured
representations such as `PT21M24.532S` or `21:24.532` **MUST NOT** be used.

**§5.2.3** `unit` is never interpreted by a consumer, only displayed. This format performs no
unit conversion.

**§5.2.4** A unit **SHOULD** be drawn from the vocabulary its kind implies:

| Kind              | Unit                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `duration`        | `s`, `ms`, `min`, `h`                                                                                                   |
| `distance`        | `m`, `km`, `mi`                                                                                                         |
| `mass`            | `kg`, `g`, `lb`                                                                                                         |
| `points`, `score` | `pt`                                                                                                                    |
| `percentage`      | `%`                                                                                                                     |
| `money`           | an [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html) code                                                    |
| `count`           | the singular name of what is counted: `lap`, `goal`, `vote`, `core`                                                     |
| `rate`            | numerator and denominator joined by `/` — `ops/s`, `s/km` — or the conventional name of the ratio, such as `W` or `bpm` |

**§5.2.5** A consumer displaying a `duration` in a time unit — `s`, `ms`, `min`, `h` — **SHOULD**
render it in hours, minutes and seconds, dropping leading zero components and keeping the declared
`precision` on the seconds: `1:28:18.7`, `28:18.70`, `18.712`. Ordering is unaffected; comparison
always uses the stored number ([§5.1.5](#51-measures)).

_Non-normative: this is display, so it is a **SHOULD** — but it belongs here rather than in the
presentation layer, which a consumer may discard entirely (§3.1.1). Everything needed is already
declared: the kind says it is a duration, the unit says which one, the precision says how many
decimals survive. No producer has to add anything, and no consumer needs domain knowledge, which
is the promise §1.1 makes. Leaving it unwritten was expensive: §5.1.5 and all of §10.1 can be searched for a rendering hint
without finding one, which leads to the conclusion that the format cannot express `2:12.88` and to
the convention being written into a `description` that §6.1.6 says is never parsed. The reference
implementation had done this from the start; only the specification was silent._

**§5.2.6** A `count` unit **MUST** name what is counted. A dimensionless placeholder — `n`, `#`,
`no` — names nothing, and a figure that counts nothing is an allocated identifier, which belongs
in `attributes` ([§5.3.5](#53-attributes)).

**§5.2.7** A consumer displaying a `score` or `points` measure that declares a `max`
([§5.1.8](#51-measures)) **SHOULD** render it against that maximum — `36/40` — keeping the
declared precision on both halves. A `percentage` is excluded: its unit already carries the scale,
and `85/100 %` is worse than either half of it. A `max` of `1` is excluded on the same grounds: a
chess game point truthfully bounded at one would read `1.0/1.0`, and a producer should not have to
withhold a true bound to avoid an absurd rendering.

_Non-normative: this is the point of declaring the bound at all. A reader shown `27 pt` cannot
tell excellent from poor, which is the failure §1.1 exists to prevent, and the producer has no
other way to say it — §6.1.6 makes `description` unparsed on purpose. The rule is written here
rather than left to each consumer for the same reason as §5.2.5: what the format normalises, it
normalises for everyone, and a rendering left unstated is a rendering two implementations do
differently._

_Non-normative: the earlier form of §5.2.4 listed one flat vocabulary of twelve units, and
fifteen of the twenty-one units in this document's own examples fell outside it — every one of
them legitimately. A count and a rate cannot draw on a closed list: `goal`, `lap` and `samples/s`
are exactly as right as `kg`, and no vocabulary can enumerate what people count. Fixing the rule
was the correct repair, not fixing the corpus._

### 5.3 `attributes`

An attribute defines a descriptive property: a club, a nationality, a manufacturer, a model
version. Attributes are neither measured nor ranked.

```jsonc
{
  "id": "club", // REQUIRED
  "label": "Club", // REQUIRED
  "type": "text", // REQUIRED
  "unit": "km", // OPTIONAL, numbers only
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

**§5.3.5** An identifier the organisation allocates — a bib, a start number, a car number, a lane
— **MUST** be declared as an attribute, never as a measure. The test is one question: was this
figure read off an instrument or a judgement, or handed out beforehand? A measure exists to be
compared, and an allocated number compares to nothing.

_Non-normative: four of this document's own reference examples got this wrong, declaring bib and
car numbers as measures of `kind: "count"` with `betterWhen: "none"`. Reasoning from §5.3 — a lane
is allocated rather than observed — gives an attribute, and the corpus then said otherwise. For
someone learning the format the examples carry as much weight as the text, so the two pointing
different ways is the same defect as the text contradicting itself. A count needs a unit that
names what is counted; `"n"` names nothing, and was the tell in every one of the four._

_Non-normative: alpha-2 is fixed here rather than left open because a consumer rendering a flag
or grouping by nation cannot do either against a field that is alpha-2 in one document, alpha-3
in the next and a display name in the third. Domains that use another code — FIDE and the IOC use
alpha-3 — declare a second attribute of type `text` alongside._

_Non-normative: declaring attributes rather than leaving them free-form is what lets a consumer
display them correctly without knowing what they are._

**§5.3.6** A declared attribute that no entity carries a value for is reported as `OR-905`, on
the same terms and for the same reason as [§5.1.7](#51-measures).

**§5.3.7** An attribute of type `number` **MAY** declare a `unit`, naming what the number counts
or measures, and displayed the same way as a measure's. It **MUST NOT** be declared on any other
type, where it would describe nothing.

_Non-normative: [§5.2.4](#52-values-and-units)'s table is a useful guide — a length is `m`, `km`
or `mi` wherever it appears — but it is indexed by `kind`, and an attribute has no `kind`. Read it
by the quantity rather than by the row: an age is `year`, a bottle price is `EUR`, a class limit is
`kg`._

**§5.3.8** An attribute absent from an `attributes` object means **not recorded**, on the same
terms as an absent measure ([§7.3.2](#73-values)). It does not mean `false`, `zero` or `none`, and
a producer who needs to state that something is not the case **MUST** write the value.

_Non-normative: a document carrying a boolean measure and a boolean attribute of almost the same
meaning ended up writing the measure on all sixty-six results, because §7.3.2 said what silence
meant there, and the attribute on the two it applied to, because nothing said anything. Both
readings are defensible and only one can be right, which is the definition of an omission rather
than a decision._

_Non-normative: a stage distance, a summit altitude, a bottle price, an alcohol content and a time
limit all describe an entity rather than a performance, so they are attributes — and until this
existed, their unit could only be smuggled into the label, as `"Distance (km)"`. The gap turned up
independently in a cycling document and a wine one, both of which put the unit in a display string
no consumer can read. Measures had a whole section on unit vocabulary and attributes had nothing,
which was an omission rather than a decision._

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
  "description": "…",               // OPTIONAL
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

**§6.1.5** `label` names an entity for display, and is **REQUIRED** on measures, attributes,
rankings and categories — the four that a consumer must be able to name on screen. Participants
and events carry `name` instead, for the same purpose.

**§6.1.6** `description` **MAY** expand on a name or a label in prose, and is **OPTIONAL** on
every entity that carries one: measures, attribute definitions, participants, events, rankings,
categories, `source`, links, assets, and the document itself. Neither member is ever parsed.

**§6.1.7** A declared participant that holds no result and belongs to no team is reported as
`OR-910`, a warning — unless the document carries no results at all, which is an announced event
publishing its entry list in advance ([§7](#7-results)). A competitor who did not start still has a result — a status alone is enough
([§7.2](#72-status)) — so a participant with nothing attached is usually a name that was declared
and then never used.

_Non-normative: this is the counterpart of §5.1.7 and §5.3.6 for the one entity that lacked it.
A tasting panel declared as participants shows why: jurors can be added and carry no result at
all, with nothing to signal that the format is being used for something it does not model — a
juror does not compete (§2.2). The warning does not forbid it; it says the document is claiming
something it never shows._

### 6.2 `events`

```jsonc
{
  "id": "heat1",                    // REQUIRED
  "name": "Heat 1",                 // REQUIRED
  "description": "…",               // OPTIONAL
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

### 6.3 Five structures worth stating explicitly

_Non-normative._

**Heats feeding an overall standing.** Declare heat events with `parent` set to an `overall`
event. Each heat's results attach to that heat. Where the standing is a **computed** figure — a
points total, a sum of legs — publish it as results attached to the `overall` event and scope the
ranking there, as [§8.1.4](#81-scope) requires: a scoped ranking sees the events it names and
never their descendants.

Omitting those parent-event results is the commonest way to publish a standing that renders
empty: the ranking selects nothing, and a validator reports `OR-906`.

**A classification across several rounds of the same kind.** Where nothing is computed — a
qualifying classification ordering the same times that were swum in three heats — list the heats
in `scope.event` and leave the results where they were recorded
([§8.1.5](#81-scope)). Republishing them would put the same figure in the document twice, with
nothing to say the two copies are one swim.

The same shape answers the second question a multi-day meeting asks: an award spanning selected
events, or a session standing, is a ranking that lists the events it covers. `parent` gives an
event one place in one hierarchy; `scope.event` lets a ranking draw any set it likes across that
hierarchy, without the events having to agree on a single organising axis.

**Repeated attempts by one competitor.** Three lifts at a bar, six throws, four vaults: a
competitor produces several figures and one of them is the result. §7.1.3 allows one result per
competitor per event, so declare an event per attempt — `squat-1`, `squat-2`, `squat-3` — with
`parent` set to the event the discipline is judged on, and attach each attempt there. Selecting one
of them is computing within the meaning of [§8.1.4](#81-scope), so publish the best as a result on
the parent event and scope the standing there. [§8.1.5](#81-scope) does not apply: listing the
attempt events in `scope.event` would rank every attempt against every other, which is a different
question from who lifted most.

**Per-member figures inside a team result.** A relay leg, a rower's split, a player's line in a
team match: the member's performance is a result like any other. Declare a child event for the
legs, attach one result per member to it, and keep the team's own result on the parent event.
Each leg result carries its member as `participant`, its own measures — a time, a takeover, a
line — and attributes for what distinguishes it, such as its order or its stroke.

Nothing new is needed for this. The team is already a participant composed of participants
([§6.1.2](#61-participants)), and §8.1.1 keeps the leg results out of any ranking scoped to the
parent event, so the team standing is unaffected by their presence. What this avoids is the
alternative: one measure per position — `takeover2`, `takeover3`, `takeover4` — which is a single
measure indexed by a number, and grows a new declaration every time a team gets longer.

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

### 7.1 `participant` and `event`

**§7.1.1** `participant` **MUST** reference a declared participant.

**§7.1.2** `event`, when present, **MUST** reference a declared event. It **MUST** be present if
the document declares `events`.

**§7.1.3** The pair (`participant`, `event`) **MUST** be unique across `results`.

### 7.2 `status`

**§7.2.1** `status` **MUST** be one of:

| Value           | Meaning                   | Excluded by default |
| --------------- | ------------------------- | ------------------- |
| `finished`      | Completed                 | No                  |
| `bye`           | Scored without playing    | No                  |
| `notClassified` | Took part, not classified | Yes                 |
| `inProgress`    | Still competing           | Yes                 |
| `dnf`           | Did not finish            | Yes                 |
| `dns`           | Did not start             | Yes                 |
| `dsq`           | Disqualified              | Yes                 |
| `outOfTime`     | Outside the time limit    | Yes                 |
| `withdrawn`     | Withdrew or forfeited     | Yes                 |

**§7.2.2** An unknown `status` **MUST** be treated as `finished` when _reading_. Whether it is
also a validation error depends on the version the document declares, on the same terms as an
unknown member ([§10.2.4](#102-extensions)): a validator checks against the declared version, a
consumer reading a higher MINOR version folds what it does not recognise onto the documented
fallback. `OR-103` is a validation diagnostic and carries that same qualification.

**§7.2.3** Exclusion is a property of a **ranking**, not of a status. The column above gives the
default exclusion set of [§8.4.2](#84-excludestatuses); a ranking that declares its own
`excludeStatuses` replaces that set entirely ([§8.4.1](#84-excludestatuses)). The same result may
therefore be ranked by one ranking and unranked by another in the same document — a retired car
that still sets the fastest lap is the ordinary case, not an anomaly.

**§7.2.4** A result excluded from a ranking **MUST** remain available for display. A consumer
**SHOULD** show it without a rank rather than omit it.

**§7.2.5** `bye` marks a competitor who scored without a contest — an odd field in a Swiss
pairing, a knockout draw with no opponent, or a walkover. It ranks normally: the score counts.

_Non-normative: this version does not distinguish an unopposed pairing from a requested bye or an
absent opponent._ All three are `bye`, and in some domains they are treated differently — a chess
tie-break counts a played game and an unplayed one by different conventions. `notes` can tell a
person which happened; it cannot tell a consumer, because [§7.4.1](#74-notes) forbids parsing it.
Saying so is better than pointing at a member no machine may read, which reads as an answer and is
not one.

**§7.2.6** `notClassified` marks a competitor who took part, whose performance is recorded, and
who does not appear in the classification **of the event this result is attached to** — short of a
minimum distance, short of a qualifying standard, ranked outside a published field. It is excluded
by default, and unlike `dnf` it asserts nothing about whether they finished.

**§7.2.7** A status describes the result it sits on, never a later round. A competitor who
completes a heat and is not selected for the next one is `finished` in that heat: they are
classified there, at whatever position their performance earned. Their non-selection is the
absence of a result in the round that follows, not a status on the round they completed.

**§7.2.8** On an event that aggregates others, the status **MUST** be the most specific one that
is true **of the aggregate**. A rider who abandons a stage race did not finish it, so their result
on the overall event is `dnf`. `notClassified` is what remains when nothing more specific applies:
a competitor who did everything asked of them and still does not appear — short of a minimum
distance, short of a qualifying standard, outside a published field. A skier eliminated by the cut
after a clean first run is `finished` on that run and `notClassified` on the combined event; one
who abandons mid-course is `dnf` on both.

_Non-normative: every status named here is excluded by default (§8.4.2), so the derived standings
are identical whichever is chosen — the difference is invisible to a ranking and plain on screen.
Choosing `dnf` against the wording of §7.2.7 is correct here: two
conforming producers were otherwise free to publish "abandoned" and "not classified" for the same
fact, with no validator able to tell them apart. That is the divergence this format exists to
prevent, and it does not stop being one because the numbers agree._

_Non-normative: the earlier wording of §7.2.6 glossed the status as "eliminated in a heat", which
reads as an instruction to mark the eliminated swimmers of a qualifying heat `notClassified` —
and since §8.4.2 excludes that status by default, doing so erases them from the heat's own
standings, which is where they belong. It contradicted §7.2.3, which holds that exclusion is a
property of a ranking and not of a status, and §7.2.3 is the one to follow._

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
([§3.3.1](#33-ranks-are-derived)). The single exception is `ties: "resolved"`, where the ranking
declares that its residual ties are settled by these positions ([§8.3.4](#83-ties)); a document
using it still orders deterministically, but dropping `ranks` would change the order.

**§7.5.3** A key **MUST NOT** name a ranking that does not rank this result — whether its `scope`
never selected it ([§8.5.1](#85-derivation-algorithm)) or the partition left it unranked
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
  "description": "…", // OPTIONAL
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

**§8.1.1** `scope.event`, when present, **MUST** be a declared event identifier or an array of
them; only results attached to **those events** are considered. Descendant events are **not**
included: a listed event brings its own results and no others.

_Non-normative: the `parent` relation groups events for navigation and display; it does not
aggregate results. A standing scoped to an overall event must not absorb the results of its
heats — those are separate results, on a different scale, and mixing them would produce a
meaningless order._

_Non-normative: listing events is how a standing spanning several of them is expressed without
copying anything. A qualifying classification over three heats scopes to the three heats: the
times stay where they were swum, each heat keeps its own start time and its own order, and no
figure is published twice. Enumeration is deliberate — a consumer selects by reading a list, never
by evaluating a rule (§1.2)._

**§8.1.2** `scope.category`, when present, **MUST** be a declared category identifier or an array
of them; only results whose participant belongs to **at least one** of them are considered. A
category selects a set of competitors and says nothing about which of their results is meant, so a
standing over a document that decomposes into sub-events **SHOULD** name the event too; a scope
that does not is reported as `OR-913`.
Membership is the category's own `participants`: a scope sees the categories it names and never
their children, on the same terms as [§8.1.4](#81-scope) for events. A category's `parent`
([§9.1.2](#91-categories)) organises them for a reader and selects nothing.

_Non-normative: this expresses an axis built from ranges — "under €15", spanning two declared
price bands — without a third category that re-lists the wines the first two already contain. Such
a category is the duplication §8.1.5 warns about, moved from values to rosters and just as able to
drift._

_It does **not** express crossing two axes. Categories combine as a union, so listing a colour and
a price band selects everything in either. "The reds under €15" still needs a category of its own,
and the format offers no way to derive one from two others. That is a real limit, chosen over the
alternative: a scope that mixed unions and intersections would be a query language, and §1.2.2
says a consumer has nothing to evaluate._

**§8.1.3** `scope` absent means all results in the document. `scope` accepts `event` and
`category`; when both are present, a result **MUST** satisfy each of them.

**§8.1.4** A standing whose figures are **computed** from several events — a points total, a sum
of legs, a best-of — **MUST** be published as results attached to the event the ranking is scoped
to. Computing the aggregate is the producer's work; this format carries its outcome, never the
rule that produced it. A document that declares the parent event and omits those results declares
a ranking that selects nothing, reported as `OR-906`.

**§8.1.5** Where nothing is computed and the results are directly comparable, the events **SHOULD**
be listed in `scope.event` instead, and the results left where they were recorded. Publishing a
second copy of a figure that already exists creates two values that can drift apart, and no rule
in this format ties them together.

_Non-normative: the distinction is whether a new number exists. Three heats of a qualifying round
hold the times that the qualifying classification orders — the same times, nothing added, so the
classification lists the three heats. A championship standing after eight rounds holds a points
total that appears nowhere else; it has to be published, because no consumer can be asked to
compute it (§1.2). Getting this backwards is expensive: following the earlier text on a swimming meet meant
republishing 73 results out of 183, with nothing in the document saying that the two copies were
the same swim._

### 8.2 `sortBy`

**§8.2.1** `sortBy` **MUST** be a non-empty array of declared measure identifiers, in decreasing
order of priority — unless the ranking declares `ties: "resolved"`, where it **MAY** be empty and
the published positions order the whole set ([§8.3.5](#83-ties)).

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

| Value      | Produces   | Notes                                                                                                              |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `standard` | 1, 2, 2, 4 | Default. Prevailing competition convention.                                                                        |
| `dense`    | 1, 2, 2, 3 | No rank is skipped.                                                                                                |
| `strict`   | 1, 2, 2, 4 | No tie is expected; a residual tie is a validation **error** and still ranks as `standard` ([§8.3.3](#83-ties)).   |
| `resolved` | 1, 2, 3    | Ties are broken by the published positions, and fall back to `standard` where they cannot be ([§8.3.4](#83-ties)). |

**§8.3.2** An unknown `ties` value **MUST** be treated as `standard`.

**§8.3.3** `strict` declares an expectation, not a consumer behaviour. A consumer encountering a
residual tie under `strict` **MUST** assign ranks as though `standard` had been declared, so that
an order still exists and [§8.5.6](#85-derivation-algorithm) holds. Reporting the condition is the
validator's job (`OR-302`), not the reader's.

_Non-normative: without this, a document that turns out to contain a tie would have no defined
rendering at all, and two consumers could reasonably refuse or fall back differently — the exact
divergence §8.5.6 forbids._

**§8.3.4** Under `resolved`, a group of results comparing equal on every sorting measure **MUST**
be ordered by the positions the producer published for this ranking in `ranks`
([§7.5](#75-ranks)) — but only when every result in the group carries one and no two of them are
equal. The group then takes consecutive positions in that order. Otherwise the group stays tied
and is numbered as under `standard`. This is the one place a supplied rank takes part in
derivation, and the producer asks for it by declaring `resolved`.

_Non-normative: only the relative order of those positions is read, so a group landing at 16th and
17th could be published as `1` and `2` and still order correctly._ A producer **SHOULD** publish
the positions the competition actually awarded. Nothing here can tell the two apart — a rank that
merely sorts satisfies this rule and raises no diagnostic — but a document read by a person is
read for its numbers, and `1` against a competitor who finished sixteenth is wrong in the way
[§3.3.2](#33-ranks-are-derived) exists to prevent.

_Non-normative: using `resolved` well asks something of the producer that no other member does —
knowing which results form a tied group, which means having derived the ranking before writing the
document. §3.3 promises a producer need not compute ranks, and that stays true; but one who
publishes positions for a group that turns out not to be tied gets `OR-902`, and one who publishes
them for a result the ranking does not rank gets `OR-303`._

_All of the group or none of it, because a partial rule fails to order at all. If a
published position separated one pair and not another, the comparison would not be transitive and
the standings would depend on the sorting algorithm — the divergence §8.5.6 forbids. As for why
the rule exists: some tie-breaks are settled outside the document and measured by nothing in it —
a swim-off, a jury ruling, a drawn lot. The outcome is a fact no measure holds. Without
`resolved`, a producer had two options and both were bad: publish the position and carry a
divergence warning for ever ([§3.3.2](#33-ranks-are-derived)), or invent a measure whose only
purpose is to encode an answer already known._

**§8.3.5** A ranking declaring `resolved` **MAY** leave `sortBy` empty. Every selected result then
compares equal, so the whole set is one group and the published positions order it entirely
([§8.3.4](#83-ties)). Each selected result **SHOULD** carry a position for that ranking; where any
is missing, the rule of §8.3.4 applies unchanged and the set stays tied, which a validator reports
as `OR-911`.

### 8.4 `excludeStatuses`

_Non-normative: some results are an order and nothing else. A competitive examination publishes
"1. Berthier, 2. Ouazzani, 3. Vandenberghe" and is very often forbidden from publishing the marks
behind it; a jury publishes a palmarès; an administration publishes a list. Until this existed,
such a document could not be written at all — §8.2.1 required a measure, §8.5.2 then left every
result unranked for want of it, and §7.5.3 rejected the positions as belonging to a ranking that
does not rank them. An admission list of the kind institutions publish verbatim produced three `OR-303` errors._

_The alternative was to invent a measure holding the rank, which §8.3.4's own note names as the
thing it exists to avoid: "a measure whose only purpose is to encode an answer already known".
Determinism is untouched — the order is read from the document, and §8.5.6 holds._

**§8.4.1** `excludeStatuses`, when present, **MUST** be an array of status values excluded from
this ranking. It **replaces** the default set in full; it is not added to it. A ranking declaring
`excludeStatuses: ["dns"]` therefore ranks retired and disqualified competitors.

**§8.4.2** When absent, the default set applies: every status marked _excluded by default_ in
[§7.2.1](#72-status) — `notClassified`, `inProgress`, `dnf`, `dns`, `dsq`, `outOfTime`,
`withdrawn`. Equivalently: every status except `finished` and `bye`.

**§8.4.3** `excludeStatuses` **MAY** be an empty array, which excludes nothing and ranks every
selected result whatever its status. This is the ordinary shape for a race order that must place
retirements and disqualifications rather than omit them — in low-point sailing scoring, for
instance, a boat that does not finish scores and is classified last.

_Non-normative: replacement rather than union is what makes a "fastest lap" ranking
expressible at all — one that ranks competitors the overall standings exclude. It does not, on its
own, express "best attempt across rounds", which is [§6.3](#63-five-structures-worth-stating-explicitly).
The cost is that an author writing `excludeStatuses: ["dsq"]` gets only that exclusion, so the
common case is to omit the member entirely and take the default._

### 8.5 Derivation algorithm

**Normative.** Given a ranking declaration and a document, a consumer computes the ordered result
list as follows.

**§8.5.1 — Selection.** Retain results matching `scope`. Absent `scope`, retain all.

**§8.5.2 — Partition.** A retained result is **rankable** if _both_ hold:

- its `status` is not in `excludeStatuses`; and
- for every measure listed in `sortBy`, its `values` carries a value of the JSON type that
  measure's `kind` implies ([§5.2.1](#52-values-and-units)).

All others are **unranked**.

_Non-normative: the type is checked against the measure, not against the other result._ A document
recording a duration as `"10:04.200"` is not conforming ([§7.3.3](#73-values)), and a consumer must
still read it ([§11.3.1](#113-obligations-on-consumers)). Deciding the question pairwise — a number and
a string cannot be compared, so call them equal — costs transitivity: three results in one
declaration order fall into different tie groups than the same three in another, and two consumers
whose sort algorithms compare different pairs disagree, which [§8.5.6](#85-derivation-algorithm) forbids.
Checking against the declared kind is a property of a single result, so nothing it is compared with
can change it.

_A ranking that drops results this way is sometimes intended and sometimes a mistake._ A
classification sorting on `["round1Faults", "jumpOffFaults"]` leaves every competitor who did not
reach the jump-off unranked — a twelve-horse Grand Prix rendering as five. But an angler who
caught nothing has no heaviest fish, and a "heaviest fish" ranking is right to leave him out.

The two are distinguishable, and a validator **MUST** distinguish them (`OR-908`). It reports
`OR-908` only where a result is **status-eligible** for the ranking **and** carries _some_ of the
measures in `sortBy` but not all — the signature of a competitor who took part and whose record is
incomplete. A result carrying **none** of them has no place in that ranking, and is not reported.

The producer's remedy, where the omission was not intended, is to publish a measure every selected
result carries. Copying an earlier round's value forward suits a format where every competitor runs
the same course; it **MUST NOT** be used where a later round is a qualification cut, since it would
rank a non-qualifier among the classified and publish a false result.

That is not the duplication [§8.1.5](#81-scope) warns against, and the difference is worth
stating. §8.1.5 is about republishing the same figure of the same performance in two places, where
the copies can drift apart. Here the figure is deliberately carried into a different round, where
it is a **different** fact — the value this competitor brings forward — and where the alternative
is a standing that silently omits half its field.

**§8.5.3 — Sort.** Order the rankable results by successive comparison over `sortBy`. For each
measure, `betterWhen: "lower"` orders ascending and `betterWhen: "higher"` orders descending. The
sort **MUST** be **stable**: results comparing equal on every criterion retain their declaration
order in `results`.

**§8.5.4 — Assign.** Assign ranks according to `ties`. Two results are tied when they compare
equal on every measure in `sortBy`. Under `resolved`, a tied group is first ordered by the
positions its results publish, per [§8.3.4](#83-ties) — the stability of §8.5.3 orders the
_array_ and never the _rank_, so a mass finish where everyone shares a time needs `resolved` to
place anybody.

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
{
  "id": "mx2",
  "label": "MX2",
  "attributes": { "places": 3 }, // OPTIONAL
  "participants": ["p12", "p7"],
  "parent": "senior",
}
```

**§9.1.1** A category **MUST** carry `id` and `label`. `description`, `participants` and `parent`
are **OPTIONAL**. `participants`, when present, **MUST** reference declared participants; a
participant **MAY** belong to several categories. A category with no `participants` selects no
result, which a validator reports as `OR-907`.

**§9.1.2** `parent`, when present, **MUST** reference another declared category, and the graph
**MUST** be acyclic.

**§9.1.3** Categories **MUST NOT** duplicate results. A category standing is a ranking whose
`scope.category` names it.

**§9.1.4** A category **MAY** carry `attributes`, on the same terms as any other entity
([§5.3](#53-attributes)). A place count, an admission threshold, a medal quota and a field size
belong to the group rather than to any competitor in it, and had nowhere else to go.

_Non-normative: such figures used to end up in `description`, where §6.1.6 guarantees nothing will
read them — a wine competition's medal quota, an examination's number of places and its cut-off
mark. Both are numbers the organiser is often required to publish, and both are properties of a
category. Categories were the last entity whose member list was closed, which is the whole reason
they went into prose._

### 9.2 `source`

```jsonc
{
  "name": "Valley Motor Club", // REQUIRED when source is present
  "description": "…", // OPTIONAL
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
| `OR-103` | error    | Value outside its permitted domain, judged against the declared version (§5.1.2, §7.2.1, §7.2.2)                                                                                 |
| `OR-104` | error    | Identifier does not match the permitted character set (§5.4.1)                                                                                                                   |
| `OR-105` | error    | Unknown member, not prefixed `x-` (§10.2.4)                                                                                                                                      |
| `OR-106` | error    | Timestamp is not RFC 3339 with an offset, where §4.6.2 does not allow a full-date (§4.6.1)                                                                                       |
| `OR-107` | error    | `unit` missing for a kind that requires one (§5.1.3)                                                                                                                             |
| `OR-108` | error    | `null` used for an unavailable measure (§7.3.2)                                                                                                                                  |
| `OR-109` | error    | A measure declares `min` greater than `max` (§5.1.8)                                                                                                                             |
| `OR-110` | error    | A `unit` is declared on an attribute that is not a number (§5.3.7)                                                                                                               |
| `OR-111` | error    | A count unit names nothing — `n`, `#`, `no` (§5.2.6)                                                                                                                             |
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
| `OR-909` | warning  | A value falls outside the scale its measure declares (§5.1.8)                                                                                                                    |
| `OR-910` | warning  | A declared participant holds no result and belongs to no team (§6.1.7)                                                                                                           |
| `OR-911` | warning  | A ranking ordered by published positions has results that carry none (§8.3.5)                                                                                                    |
| `OR-912` | warning  | A licence is not an SPDX identifier (§9.2.2)                                                                                                                                     |
| `OR-913` | warning  | A standing gathers results from several events without naming one (§8.1.2)                                                                                                       |

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
