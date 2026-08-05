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
coverage.json          which rules are covered — a ratchet, checked in CI
valid/<case>/          document.json + expected.json
invalid/<case>/        document.json + expected.json
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

## Coverage

`coverage.json` records which normative rules the suite exercises. It is a ratchet, not a target:
a rule listed there must stay covered, and coverage grows as cases are added.

Demanding total coverage from day one would only produce a pile of hollow cases. `pnpm check
rule-coverage` reports the current figure and fails on any regression.
