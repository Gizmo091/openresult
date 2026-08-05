# Implementation guide

How to write an OpenResult producer or consumer, in any language.

This guide is a companion to [the specification](../specification/openresult-v1.md), which is
normative. Where the two differ, the specification wins.

There is a worked example: [`minimal_reader.py`](./examples/minimal_reader.py) is a complete
reader in about 160 lines of Python with no dependencies, written from the specification alone.
A repository check runs it against every published example and compares its standings, ranking by
ranking, with the TypeScript reference implementation. If the two ever disagree, the
specification is ambiguous and that is a bug to be fixed in the specification.

---

## 1. Decide what you are building

| You want to                                                   | You need                           |
| ------------------------------------------------------------- | ---------------------------------- |
| Emit documents from a timing system, a benchmark, a jury tool | **Producer** (§2)                  |
| Show results someone else produced                            | **Consumer, reading level** (§3)   |
| Show standings                                                | **Consumer, ranking level** (§4)   |
| Edit or relay documents                                       | **Consumer, rewriting level** (§5) |
| Check documents                                               | **Validator** (§6)                 |

Each level builds on the previous one. Most work stops at ranking.

---

## 2. Writing a producer

A producer is mostly a serialiser. There is no library to write.

**Emit four members at minimum**: `openresult`, `title`, `participants`, `results`.

**Declare every measure you use.** A value with no measure is a bare number: nothing says what
it is, in what unit, or which direction wins. This is the single most common mistake, and the
validator catches it as `OR-205`.

```json
{
  "id": "time",
  "label": "Finish time",
  "kind": "duration",
  "unit": "s",
  "precision": 1,
  "betterWhen": "lower"
}
```

**Emit numbers, not formatted strings.** `1284.532`, never `"21:24.532"`. Formatting is the
consumer's job, and it has `kind`, `unit` and `precision` to do it with. A structured string
would force every consumer in every language to write a parser.

**Omit what you do not have.** A measure that was not recorded is absent from `values`. Never
`null` — otherwise nothing distinguishes "not recorded" from "recorded as nothing".

**You do not have to compute ranks.** Publishing measures is enough: any conforming consumer
derives the standings. If you do supply a `rank`, it is information rather than instruction, and
a validator will warn when it disagrees with what the measures imply.

**Say who did not finish.** `status` is what separates a real results document from a
spreadsheet. `dnf`, `dns`, `dsq`, `outOfTime`, `withdrawn` — each means something specific, and
consumers rely on the distinction.

### Checklist

- [ ] UTF-8, valid JSON, no comments
- [ ] Every measure and attribute used is declared
- [ ] Values are numbers in the declared unit
- [ ] Unavailable measures are omitted, not null
- [ ] Non-finishers carry a status and no rank
- [ ] `source` names who produced this, and under what licence
- [ ] The document validates without errors

---

## 3. Consumer: reading level

The minimum useful consumer. Around 60 lines.

**Check the major version first.**

```
declared = document["openresult"]          # "1.0"
major = int(declared.split(".")[0])
if major != 1: refuse, and say so distinctly from "invalid"
```

A _higher minor_ version is read normally — that is the whole point of the compatibility
promise. A different _major_ is refused rather than guessed at: the same member names may mean
different things.

**Fold unknown enumeration values onto their documented fallback.** This is what makes a later
minor version non-breaking, and it is three lines:

```
KNOWN = {"finished", "inProgress", "dnf", "dns", "dsq", "outOfTime", "withdrawn"}
status = value if value in KNOWN else "finished"
```

Fallbacks: `other` for `type`, `finished` for `status`, `none` for `betterWhen`, `text` for
attribute `type`, `standard` for `ties`, `provisional` for document `status`.

**Ignore what you do not recognise.** Members prefixed `x-` are extensions. Skip them without
comment. Never fail on one.

**Never read meaning into an identifier.** `p12`, `heat-1` and `a3f9` are opaque strings. A
producer may number them any way it likes.

---

## 4. Consumer: ranking level

Implement [§8.5](../specification/openresult-v1.md#85-derivation-algorithm) exactly. Five steps,
and each one matters.

1. **Select** the results in scope. `scope.event` means _that event_, never its descendants — an
   overall standing must not absorb the heats feeding it.
2. **Partition.** A result is rankable when its status is not excluded **and** it carries every
   measure in `sortBy`. Anything else is unranked, and stays in the output without a rank.
3. **Sort.** Direction comes from each measure's `betterWhen`, never from the ranking. **Use a
   stable sort** — this is not a detail: it is what makes two implementations agree on the order
   of results that tie on everything.
4. **Assign.** `standard` lets a shared rank consume the next (1, 2, 2, 4). `dense` skips none
   (1, 2, 2, 3).
5. **Append the unranked**, in declaration order.

### Three mistakes worth naming

**Treating a missing measure as zero.** It puts a competitor who was not measured at the top of
a lower-is-better ranking. They belong in the unranked group.

**Dropping non-finishers.** A retirement is a fact the document records deliberately. Show it
without a rank.

**Using a locale-aware comparison.** `localeCompare` gives different answers in different places.
Compare raw values.

---

## 5. Consumer: rewriting level

One additional rule: **preserve everything you did not understand.** Extensions, unknown
members, unknown enumeration values — they must survive a read-then-write cycle untouched.

A tool that silently drops what it does not recognise makes round-tripping lossy, and no producer
can trust any tool that has touched its documents.

---

## 6. Validators

Two layers, and the second is not optional.

**Schema conformance** is mechanical: run [the published schema](../schema/) with any JSON Schema
2020-12 implementation.

**Semantic rules** are what the schema cannot express: dangling references, duplicate
identifiers, cycles in a parent graph, a ranking sorting on a directionless measure, a value
whose type contradicts its measure's kind. The full list is specification §12.2, with a code for
each.

Every diagnostic must carry four things: **where** (a JSON Pointer), **what rule** in plain
language, **which section** of the specification, and **how to fix it**. A message that only says
"invalid" makes the reader open the specification, which is what the diagnostic exists to avoid.

Report warnings separately from errors. A document with warnings is conforming.

---

## 7. Proving your implementation

Run [the conformance suite](../conformance/). It is declarative JSON, so it needs no support for
your language:

1. Read `conformance/manifest.json`.
2. For each case at a level you support, load `document.json` and `expected.json`.
3. For invalid cases, compare **codes and paths only** — never message text.
4. For valid cases, compare the derived standings **as a sequence**; the order is what verifies
   sort stability.
5. Run every valid case **twice**: once as published, once with `presentation` removed. Both must
   yield the same standings.

A case failing does not stop the run: a report naming twelve failures is worth more than one
naming the first.

---

## 8. Publishing your implementation

Say which conformance levels you implement, and which suite version you pass. That is what lets
someone choose your library without reading its source.

Open an issue on the repository to be listed. There is no certification, no fee, and no
gatekeeper — an open standard that charges for the right to claim conformance is not open.
