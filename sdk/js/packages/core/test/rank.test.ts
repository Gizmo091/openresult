import { describe, expect, it } from 'vitest';
import { eventWithDescendants, listRankings, rank } from '../src/index.js';
import type { ResultDocument } from '../src/index.js';

/**
 * Derivation is the load-bearing behaviour of the format: two consumers must
 * produce the same order for the same document, ties included. These tests
 * exercise the specification's §8.5 step by step.
 */

function document(overrides: Partial<ResultDocument> = {}): ResultDocument {
  return {
    openresult: '1.0',
    title: 'Test',
    measures: [
      { id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' },
      { id: 'points', label: 'Points', kind: 'points', unit: 'pt', betterWhen: 'higher' },
      { id: 'bib', label: 'Bib', kind: 'count', unit: 'n', betterWhen: 'none' },
    ],
    participants: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ],
    results: [],
    ...overrides,
  };
}

const order = (entries: ReturnType<typeof rank>) =>
  entries.map((entry) => [entry.participant.id, entry.rank] as const);

describe('sort direction comes from the measure', () => {
  it('orders a lower-is-better measure ascending', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { time: 30 } },
        { participant: 'b', values: { time: 10 } },
        { participant: 'c', values: { time: 20 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('orders a higher-is-better measure descending', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { points: 10 } },
        { participant: 'b', values: { points: 30 } },
        { participant: 'c', values: { points: 20 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['points'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('ignores a measure declared betterWhen none', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { bib: 3, time: 30 } },
        { participant: 'b', values: { bib: 1, time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['bib', 'time'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });
});

describe('tie handling', () => {
  const tied = (ties: 'standard' | 'dense' | 'strict') =>
    document({
      results: [
        { participant: 'a', values: { points: 30 } },
        { participant: 'b', values: { points: 24 } },
        { participant: 'c', values: { points: 24 } },
        { participant: 'd', values: { points: 19 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['points'], ties }],
    });

  it('standard lets a shared rank consume the next one', () => {
    expect(order(rank(tied('standard')))).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });

  it('dense skips no rank', () => {
    expect(order(rank(tied('dense')))).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 3],
    ]);
  });

  it('reports who shares a rank', () => {
    const entries = rank(tied('standard'));
    expect(entries[1]?.tiedWith).toEqual(['c']);
    expect(entries[2]?.tiedWith).toEqual(['b']);
    expect(entries[0]?.tiedWith).toEqual([]);
  });

  it('still assigns ranks under strict — the complaint belongs to the validator', () => {
    expect(order(rank(tied('strict')))).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });

  it('breaks a tie with the next sorting measure', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { points: 24, time: 30 } },
        { participant: 'b', values: { points: 24, time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['points', 'time'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });
});

/**
 * `ties: "resolved"` — spec §8.3.4.
 *
 * The published positions settle a tie the measures cannot: a swim-off, a jury
 * ruling, a drawn lot. It is the only place a supplied rank takes part in
 * derivation, so its edges matter more than most.
 */
describe('ties resolved by published positions', () => {
  const resolved = (results: ResultDocument['results']) =>
    document({ results, rankings: [{ id: 'r', label: 'R', sortBy: ['time'], ties: 'resolved' }] });

  it('orders a tied group by the positions the producer published', () => {
    const doc = resolved([
      { participant: 'a', values: { time: 10 } },
      { participant: 'b', values: { time: 20 }, ranks: { r: 3 } },
      { participant: 'c', values: { time: 20 }, ranks: { r: 2 } },
      { participant: 'd', values: { time: 30 } },
    ]);

    // c ahead of b, against declaration order: the positions decided, not the
    // stable sort.
    expect(order(rank(doc))).toEqual([
      ['a', 1],
      ['c', 2],
      ['b', 3],
      ['d', 4],
    ]);
  });

  it('clears tiedWith for a group it settles', () => {
    const doc = resolved([
      { participant: 'a', values: { time: 20 }, ranks: { r: 2 } },
      { participant: 'b', values: { time: 20 }, ranks: { r: 1 } },
    ]);

    expect(rank(doc).map((entry) => entry.tiedWith)).toEqual([[], []]);
  });

  it('leaves the tie standing when one of the group carries no position', () => {
    // All of the group or none of it. Settling only the pairs that carry two
    // positions would not be transitive, and the order would then depend on the
    // sorting algorithm — the divergence §8.5.6 forbids.
    const doc = resolved([
      { participant: 'a', values: { time: 20 }, ranks: { r: 2 } },
      { participant: 'b', values: { time: 20 } },
      { participant: 'c', values: { time: 20 }, ranks: { r: 1 } },
    ]);

    expect(order(rank(doc))).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 1],
    ]);
  });

  it('leaves the tie standing when two published positions are equal', () => {
    const doc = resolved([
      { participant: 'a', values: { time: 20 }, ranks: { r: 2 } },
      { participant: 'b', values: { time: 20 }, ranks: { r: 2 } },
    ]);

    expect(order(rank(doc))).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('reads only the positions published for this ranking', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { time: 20 }, ranks: { other: 2 } },
        { participant: 'b', values: { time: 20 }, ranks: { other: 1 } },
      ],
      rankings: [
        { id: 'r', label: 'R', sortBy: ['time'], ties: 'resolved' },
        { id: 'other', label: 'Other', sortBy: ['time'] },
      ],
    });

    // The positions belong to "other"; "r" has none and stays tied.
    expect(order(rank(doc, 'r'))).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('numbers what follows a settled group as standard does', () => {
    const doc = resolved([
      { participant: 'a', values: { time: 20 }, ranks: { r: 2 } },
      { participant: 'b', values: { time: 20 }, ranks: { r: 1 } },
      { participant: 'c', values: { time: 30 } },
    ]);

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ]);
  });
});

describe('stability and determinism', () => {
  it('keeps declaration order between results comparing equal', () => {
    const doc = document({
      results: [
        { participant: 'c', values: { points: 10 } },
        { participant: 'a', values: { points: 10 } },
        { participant: 'b', values: { points: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['points'] }],
    });

    expect(rank(doc).map((entry) => entry.participant.id)).toEqual(['c', 'a', 'b']);
  });

  it('produces the same output on repeated calls', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { time: 10 } },
        { participant: 'b', values: { time: 10 } },
        { participant: 'c', values: { time: 5 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'] }],
    });

    expect(order(rank(doc))).toEqual(order(rank(doc)));
  });

  it('does not mutate the document', () => {
    const doc = document({
      results: [
        { participant: 'b', values: { time: 20 } },
        { participant: 'a', values: { time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'] }],
    });
    const before = JSON.stringify(doc);

    rank(doc);

    expect(JSON.stringify(doc)).toEqual(before);
  });
});

describe('unranked results', () => {
  it('excludes non-rankable statuses but keeps them in the output', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { time: 30 } },
        { participant: 'b', status: 'dnf', values: { time: 5 } },
        { participant: 'c', values: { time: 20 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', null],
    ]);
  });

  it('leaves a result unranked when a sorting measure is missing', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { time: 30 } },
        { participant: 'b', values: {} },
        { participant: 'c', values: { time: 20 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', null],
    ]);
  });

  it('treats zero as a value, not as absent', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { points: 10 } },
        { participant: 'b', values: { points: 0 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['points'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('honours an explicit excludeStatuses list', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { time: 30 } },
        { participant: 'b', status: 'dnf', values: { time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], excludeStatuses: ['dns'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });
});

describe('scope', () => {
  it('restricts to exactly that event, never its descendants', () => {
    const doc = document({
      events: [
        { id: 'overall', name: 'Overall', type: 'overall' },
        { id: 'heat1', name: 'Heat 1', type: 'heat', parent: 'overall' },
        { id: 'other', name: 'Other', type: 'session' },
      ],
      results: [
        { participant: 'a', event: 'heat1', values: { time: 5 } },
        { participant: 'b', event: 'other', values: { time: 10 } },
        { participant: 'c', event: 'overall', values: { time: 20 } },
        { participant: 'd', event: 'overall', values: { time: 30 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], scope: { event: 'overall' } }],
    });

    // The heat result is faster but belongs to a different scale; an overall
    // standing that absorbed it would order nothing meaningful.
    expect(order(rank(doc))).toEqual([
      ['c', 1],
      ['d', 2],
    ]);
  });

  it('takes every event in a list, and still no descendant', () => {
    const doc = document({
      events: [
        { id: 'qualifying', name: 'Qualifying', type: 'round' },
        { id: 'heat1', name: 'Heat 1', type: 'heat', parent: 'qualifying' },
        { id: 'heat2', name: 'Heat 2', type: 'heat', parent: 'qualifying' },
        { id: 'final', name: 'Final', type: 'final' },
      ],
      results: [
        { participant: 'a', event: 'heat1', values: { time: 30 } },
        { participant: 'b', event: 'heat2', values: { time: 10 } },
        { participant: 'c', event: 'heat1', values: { time: 20 } },
        { participant: 'd', event: 'final', values: { time: 5 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], scope: { event: ['heat1', 'heat2'] } }],
    });

    // The two heats order together without either being republished; the final
    // is not listed, so its faster time stays out.
    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('selects nothing when the list names only a parent whose results were never published', () => {
    const doc = document({
      events: [
        { id: 'qualifying', name: 'Qualifying', type: 'round' },
        { id: 'heat1', name: 'Heat 1', type: 'heat', parent: 'qualifying' },
      ],
      results: [{ participant: 'a', event: 'heat1', values: { time: 30 } }],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], scope: { event: ['qualifying'] } }],
    });

    expect(order(rank(doc))).toEqual([]);
  });

  it('drops a result with no event when the scope names events', () => {
    const doc = document({
      events: [{ id: 'heat1', name: 'Heat 1', type: 'heat' }],
      results: [
        { participant: 'a', event: 'heat1', values: { time: 30 } },
        { participant: 'b', values: { time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], scope: { event: ['heat1'] } }],
    });

    expect(order(rank(doc))).toEqual([['a', 1]]);
  });

  it('restricts to a category', () => {
    const doc = document({
      categories: [{ id: 'cat', label: 'Cat', participants: ['a', 'c'] }],
      results: [
        { participant: 'a', values: { time: 30 } },
        { participant: 'b', values: { time: 10 } },
        { participant: 'c', values: { time: 20 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], scope: { category: 'cat' } }],
    });

    expect(order(rank(doc))).toEqual([
      ['c', 1],
      ['a', 2],
    ]);
  });

  it('survives a cycle in the event parent graph', () => {
    const doc = document({
      events: [
        { id: 'x', name: 'X', parent: 'y' },
        { id: 'y', name: 'Y', parent: 'x' },
      ],
      results: [{ participant: 'a', event: 'x', values: { time: 10 } }],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], scope: { event: 'x' } }],
    });

    expect(order(rank(doc))).toEqual([['a', 1]]);
  });

  it('walks the event tree for navigation, separately from ranking', () => {
    const doc = document({
      events: [
        { id: 'overall', name: 'Overall' },
        { id: 'heat1', name: 'Heat 1', parent: 'overall' },
        { id: 'heat2', name: 'Heat 2', parent: 'overall' },
        { id: 'other', name: 'Other' },
      ],
    });

    expect([...eventWithDescendants(doc, 'overall')].sort()).toEqual(['heat1', 'heat2', 'overall']);
  });
});

describe('implicit ranking', () => {
  it('uses the first measure with a meaningful direction', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { bib: 1, time: 30 } },
        { participant: 'b', values: { bib: 2, time: 10 } },
      ],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
    expect(listRankings(doc)[0]?.implicit).toBe(true);
  });

  it('leaves results in declaration order when no measure can rank', () => {
    const doc = document({
      measures: [{ id: 'bib', label: 'Bib', kind: 'count', unit: 'n', betterWhen: 'none' }],
      results: [
        { participant: 'b', values: { bib: 2 } },
        { participant: 'a', values: { bib: 1 } },
      ],
    });

    expect(order(rank(doc))).toEqual([
      ['b', null],
      ['a', null],
    ]);
    expect(listRankings(doc)).toEqual([]);
  });
});

describe('the presentation layer never affects the ranking', () => {
  it('produces the same order with and without it', () => {
    const results = [
      { participant: 'a', values: { time: 30 } },
      { participant: 'b', values: { time: 10 } },
    ];
    const rankings = [{ id: 'r', label: 'R', sortBy: ['time'] }];

    const withHints = document({
      results,
      rankings,
      presentation: { defaultView: 'cards', measureOrder: ['time'], highlight: ['a'] },
    });
    const without = document({ results, rankings });

    expect(order(rank(withHints))).toEqual(order(rank(without)));
  });
});

describe('unknown enumeration values fold onto the documented fallback', () => {
  it('treats an unknown status as finished', () => {
    const doc = document({
      results: [
        { participant: 'a', status: 'teleported' as never, values: { time: 30 } },
        { participant: 'b', values: { time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'] }],
    });

    expect(order(rank(doc))).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('treats an unknown ties value as standard', () => {
    const doc = document({
      results: [
        { participant: 'a', values: { points: 10 } },
        { participant: 'b', values: { points: 10 } },
        { participant: 'c', values: { points: 5 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['points'], ties: 'olympic' as never }],
    });

    expect(order(rank(doc))).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });
});
