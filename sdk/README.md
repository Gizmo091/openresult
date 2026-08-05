# SDKs

The reference implementation, and the shape ports should take.

## What exists

| Package                                                | Responsibility                 | Dependencies  |
| ------------------------------------------------------ | ------------------------------ | ------------- |
| [`@openresult/core`](./js/packages/core)               | Read, inspect, derive rankings | **none**      |
| [`@openresult/validate`](./js/packages/validate)       | Schema and semantic validation | Ajv           |
| [`@openresult/conformance`](./js/packages/conformance) | Run the shared suite           | the two above |

TypeScript was chosen because the viewer and the playground run in a browser, where the language
is imposed. Any other choice would mean writing the ranking derivation twice — and a duplicated
derivation is the first place "two consumers must agree" would break.

## What a port must provide

Three responsibilities, in this order. Most users need the first two.

**Reading.** Load a document, refuse an unknown major version distinctly from an invalid one,
expose participants, results, measures and statuses. Fold unknown enumeration values onto their
documented fallback.

**Ranking.** Implement specification §8.5 exactly, stable sort included. This is where two
implementations most easily drift apart, and where the conformance suite bites hardest.

**Validation.** Optional, and deliberately separable — reading and ranking must never require it.
A consumer that trusts its source should not have to ship a validator.

## The one architectural rule

**Keep reading and ranking free of dependencies.**

The format promises that a minimal reader fits in about 200 lines with nothing but a JSON parser.
That promise is what makes the format implementable in an afternoon, and it erodes one convenient
dependency at a time.

In this repository the rule is enforced rather than trusted: `pnpm check core-deps` fails if the
core package acquires a runtime dependency or grows past 15 kB compressed. A port should find its
own equivalent.

There is a worked demonstration of the promise:
[`minimal_reader.py`](../docs/examples/minimal_reader.py) — a complete reader in about 160 lines
of dependency-free Python, checked in CI against the reference implementation on every example.

## Writing a port

1. Read [the implementation guide](../docs/IMPLEMENTATION-GUIDE.md).
2. Implement reading, then ranking.
3. Run [the conformance suite](../conformance/). It is declarative JSON; no support for your
   language is needed.
4. Open an issue to be listed, stating the levels you implement and the suite version you pass.

Ports are welcome in PHP, Python, Go, C#, Java and Rust. None were written before the format
settled, because an implementation built against a moving format is thrown-away work.

## Publishing

Packages are published to npm under `@openresult`, from a tagged release, with provenance.
Version numbers follow the package's own evolution, not the format's — the format version a
package supports is stated in its README and returned by its API.
