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

    expect([...eventWithDescendants(doc, 'overall')].sort()).toEqual([
      'heat1',
      'heat2',
      'overall',
    ]);
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
