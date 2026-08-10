# Conformance suite

The operational definition of "conforming". A rule the suite does not exercise is a rule nobody
actually implements.

The suite is declarative JSON and holds no code, so an implementation in any language can run it
the day it appears. A suite written in one language would only ever be executable by that
language's implementations, and the ports would each invent their own idea of what conforming
means.

## Layout

```
manifest.json          index of cases, with the normative rule each exercises
runner.py              a second runner, in a language the suite was not written in
runner.php             a third, in the language results are actually published in
coverage.json          which rules are covered — a ratchet, checked in CI
rules-not-by-case.json rules no document can demonstrate, and what holds them instead
published-codes.json   every diagnostic code published — permanent, a ratchet
valid/<case>/          document.json + expected.json
invalid/<case>/        document.json + expected.json
retired/<case>/        cases the suite no longer asserts, kept as a record
```

## Running it

```bash
pnpm conformance                      # everything
pnpm conformance --level reading      # only what a reading-level consumer must pass
pnpm conformance --filter ties        # cases whose id contains "ties"
pnpm conformance --verbose            # list passing cases too
```

Against your own implementation, follow
[the implementation guide](../docs/IMPLEMENTATION-GUIDE.md#7-proving-your-implementation).

## Case shape

**Valid** cases state the verdict, any expected warning codes, and the standings a conforming
consumer must derive:

```json
{
  "valid": true,
  "rankings": {
    "main": [
      { "participant": "a", "rank": 1 },
      { "participant": "b", "rank": 2 },
      { "participant": "c", "rank": 2 },
      { "participant": "d", "rank": 4 }
    ]
  }
}
```

Carrying the expected standings is what actually tests derived ranking. Without them the suite
would only confirm that a document is _acceptable_, never that it is _ordered correctly_ — and
ordering is the whole point.

The array order is significant: it is what verifies the stability of the sort, the last remaining
source of disagreement between two implementations.

**Invalid** cases state the diagnostics expected, by code and path:

```json
{
  "valid": false,
  "errors": [{ "code": "OR-201", "path": "/results/0/participant" }]
}
```

Only codes and paths are compared, never message text: rewording a diagnostic must not break the
suite, nor force every port to translate identically.

**An invalid case may also state standings.** That is not a contradiction — validity and
readability are different questions. A document carrying an enumeration value from a later
version is not conforming to 1.0, because a producer must not emit it; yet a consumer is still
required to read it, folding the unknown value onto its documented fallback. Stating both in one
case is what pins that distinction down.

## Every valid case runs twice

Once as published, once with `presentation` removed. Both runs must produce identical standings.

This is the operational proof that the presentation layer is ignorable — the property the
three-layer design rests on, and one that would otherwise erode quietly the first time a view
started depending on a hint.

## Compatibility

Suites are kept per format version. An implementation supporting 1.1 must pass the 1.0 suite in
full: that is how backward compatibility stops being a promise and starts being a test.

**A published case is never rewritten.** It can be marked `deprecated` with a reason, never
edited in place — otherwise a suite could be quietly bent to match a regression.

A retired case moves to `retired/`. It kept its old directory for a while, and two of them ended
up asserting `"valid": true` for a document a later rule made invalid — so a runner that did not
honour `deprecated` read them as live cases and was told three times that a count unit of `n` is
fine. The directory name says what the manifest says now.

The one exception is a deliberate change to the format itself, recorded in a decision record.
Renaming a member moves the pointers a case expects, and deprecating a case whose only change is a
JSON pointer would leave a dead document naming a member that no longer exists. What the policy
forbids is changing an expectation because the implementation changed; what it permits is following
the format when the format was changed on purpose. `attributeDefinitions` moved two pointers under
ADR 0028, and nothing else about those two cases changed.

## Two halves, and only one of them travels

A case states some mixture of three things: whether the document is conforming,
which diagnostics it raises, and what rankings it derives. The third is what a
consumer produces; the first two are what a validator produces, and they are
different programs.

`runner.py` and `runner.php` each drive a reader of their own from this
manifest. Both judge every case that states a ranking — 84 of them, comparing 98
rankings — and both skip the 47 that state only diagnostics, saying so rather
than reporting a pass they did not earn. So the ranking half of this suite is
verified in three languages and the diagnostic half in one.

That is worth knowing before reading "language-agnostic" as a finished claim.
Until `runner.py` existed the whole suite had been read by exactly one program,
written by the same people as the cases, in the same language as the reference
implementation. `pnpm check suite-runs-elsewhere` keeps it that way.

### What the third implementation cost

Three things bit while writing the PHP reader, and they are the things a fourth
implementer will meet:

**Sort stability is a runtime property.** §8.5.3 requires it, and PHP's `usort`
has only been stable since 8.0 — on an older runtime the same document would
reorder ties silently, with nothing to show for it. Python and JavaScript both
guarantee it, so nothing had made the requirement visible before.

**A missing key and a null value are the same thing in some languages.** PHP's
`isset` answers false for a member that exists and holds null, so
`array_key_exists` is what §8.1's scope checks need. §7.3.2 makes absent and
zero different facts; a language that blurs absent and null will blur those too.

**"Is this a number" is not one question.** `is_numeric` accepts `"12"`, and
§5.2.1 does not: a duration recorded as a string is not a duration. The type has
to be checked against the measure's declared kind, and against the language's
notion of a number rather than its notion of numeric-looking.

## Coverage

`coverage.json` records which normative rules the suite exercises. It is a ratchet, not a target:
a rule listed there must stay covered, and coverage grows as cases are added.

A case may name more than one rule. `alsoExercises` lists the others its document really
demonstrates — §11.3.2 is §5.4.3 addressed to the reader rather than the writer, and one document
shows both. A second copy of it would be coverage on paper only.

Some rules no document can demonstrate: they govern a collection of documents, the specification
itself, or a consumer's display. Each is accounted for in `rules-not-by-case.json`, which names
what holds it — a repository check, a test file, or `gap` where nothing does. Five are gaps today,
and saying so is the point: a rule nothing enforces is one a producer will break without ever being
told.

Every rule must appear in one place or the other. `pnpm check rule-coverage` reports the figures
and fails on a regression, on a rule accounted for twice, and on a rule accounted for nowhere — so
a rule cannot be written without someone deciding how it is held.
