# @openresult/core

Read [OpenResult](https://openresult.dev) documents, and derive their rankings.

No runtime dependencies, 3.8 kB gzipped. The derivation is the normative one from
[specification §8.5](https://openresult.dev/spec/#85-derivation-algorithm): pure, deterministic,
and checked on every commit against a second implementation written in Python from the
specification alone.

```sh
npm install @openresult/core
```

## Ranking

```js
import { parse, rank, listRankings } from '@openresult/core';

const document = parse(await fetch('https://example.org/results.json').then((r) => r.text()));

for (const entry of rank(document, 'final')) {
  console.log(entry.rank, entry.participant.name, entry.values.time);
}
```

`rank()` returns every selected result, in order. A result that cannot be placed — a retirement, a
missing measure — comes back with `rank: null` rather than being dropped, because a field of twelve
that renders as five misrepresents the race
([§7.2.4](https://openresult.dev/spec/#72-status)).

Ties are shared and reported: an entry that ties carries the others in `tiedWith`.

## Formatting

```js
import { formatValue, measure } from '@openresult/core';

formatValue(5298.7, measure(document, 'renderTime')); // "1:28:18.70"
formatValue(1671, measure(document, 'throughput')); // "1,671.0 samples/s"
```

Both outputs come from the measure: the duration is rendered in hours, minutes and seconds and the
throughput keeps its unit, and each carries exactly the decimals its `precision` declares.
Durations render this way with the declared precision
([§5.2.5](https://openresult.dev/spec/#52-values-and-units)). Sorting always uses the raw number,
so a ranking never depends on where the consumer runs.

## What is here

| Export                               | For                                                       |
| ------------------------------------ | --------------------------------------------------------- |
| `parse`, `isOpenResult`              | Reading a document, with a clear error when it is not one |
| `rank`, `listRankings`               | Deriving standings                                        |
| `formatValue`                        | Rendering a value for display                             |
| `measure`, `attribute`, `normalize*` | Looking up semantics, with the documented fallbacks       |
| `serialize`                          | Writing a document back out                               |

Validation lives in [`@openresult/validate`](https://www.npmjs.com/package/@openresult/validate),
and rendering in [`@openresult/viewer`](https://www.npmjs.com/package/@openresult/viewer).

## Licence

Apache-2.0. The specification and documentation are CC BY 4.0.
