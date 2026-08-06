import { describe, expect, it } from 'vitest';
import {
  attribute,
  eventWithDescendants,
  isRankable,
  measure,
  normalizeBetterWhen,
  normalizeStatus,
  normalizeTies,
  serialize,
  usedMeasures,
} from '../src/index.js';
import type { ResultDocument } from '../src/index.js';

/**
 * The lookups and normalisations everything else is built on.
 *
 * These are small functions, which is exactly why they went untested: each looks
 * too obvious to break. They are also where the documented fallbacks live — the
 * ones that let a 1.0 consumer read a 1.7 document instead of refusing it — and
 * a fallback nothing exercises is a promise nobody has checked.
 */

const document: ResultDocument = {
  openresult: '1.0',
  title: 'Test',
  measures: [
    { id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' },
    { id: 'unused', label: 'Unused', kind: 'points', unit: 'pt', betterWhen: 'higher' },
  ],
  attributes: [{ id: 'club', label: 'Club', type: 'text' }],
  participants: [{ id: 'a', name: 'A' }],
  results: [{ participant: 'a', values: { time: 55.1 } }],
};

describe('unknown values fold onto their documented fallback', () => {
  it.each([
    ['finished', 'finished'],
    ['dnf', 'dnf'],
    ['bye', 'bye'],
    ['notClassified', 'notClassified'],
    // Anything else reads as finished, so a status from a later version does not
    // silently drop its holder out of the standings (spec §7.2.2).
    ['provisionallyPlaced', 'finished'],
    ['', 'finished'],
    [undefined, 'finished'],
  ])('normalizeStatus(%s)', (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });

  it.each([
    ['lower', 'lower'],
    ['higher', 'higher'],
    ['none', 'none'],
    // `none` is the safe side: an unknown direction decides nothing rather than
    // deciding wrongly (spec §5.1.6).
    ['sideways', 'none'],
    [undefined, 'none'],
  ])('normalizeBetterWhen(%s)', (input, expected) => {
    expect(normalizeBetterWhen(input)).toBe(expected);
  });

  it.each([
    ['standard', 'standard'],
    ['dense', 'dense'],
    ['strict', 'strict'],
    ['resolved', 'resolved'],
    ['olympic', 'standard'],
    [undefined, 'standard'],
  ])('normalizeTies(%s)', (input, expected) => {
    expect(normalizeTies(input)).toBe(expected);
  });
});

describe('lookups', () => {
  it('finds a declared measure and an attribute', () => {
    expect(measure(document, 'time')?.label).toBe('Time');
    expect(attribute(document, 'club')?.type).toBe('text');
  });

  it('returns undefined rather than throwing on an unknown id', () => {
    expect(measure(document, 'ghost')).toBeUndefined();
    expect(attribute(document, 'ghost')).toBeUndefined();
  });

  it('copes with a document declaring neither', () => {
    // Built without them rather than with them set to undefined: under
    // `exactOptionalPropertyTypes` those are different types, and a document
    // that omits them is the one a producer actually writes.
    const bare: ResultDocument = {
      openresult: '1.0',
      title: 'Test',
      participants: document.participants,
      results: document.results,
    };
    expect(measure(bare, 'time')).toBeUndefined();
    expect(attribute(bare, 'club')).toBeUndefined();
  });

  it('lists only measures a result actually carries', () => {
    // A declared measure nobody uses would render as an empty column.
    expect(usedMeasures(document).map((entry) => entry.id)).toEqual(['time']);
  });
});

describe('isRankable', () => {
  it('follows the default exclusion set', () => {
    expect(isRankable({ participant: 'a' })).toBe(true);
    expect(isRankable({ participant: 'a', status: 'finished' })).toBe(true);
    expect(isRankable({ participant: 'a', status: 'bye' })).toBe(true);
    expect(isRankable({ participant: 'a', status: 'dnf' })).toBe(false);
    expect(isRankable({ participant: 'a', status: 'notClassified' })).toBe(false);
  });

  it('honours a replacement set rather than adding to the default', () => {
    // §8.4.1: a declared set replaces the default entirely, which is what lets
    // a low-point sailing race rank its retirements.
    expect(isRankable({ participant: 'a', status: 'dnf' }, [])).toBe(true);
    expect(isRankable({ participant: 'a', status: 'finished' }, ['finished'])).toBe(false);
  });
});

describe('eventWithDescendants', () => {
  const nested: ResultDocument = {
    ...document,
    events: [
      { id: 'overall', name: 'Overall', type: 'overall' },
      { id: 'day1', name: 'Day 1', type: 'round', parent: 'overall' },
      { id: 'heat1', name: 'Heat 1', type: 'heat', parent: 'day1' },
      { id: 'elsewhere', name: 'Elsewhere', type: 'session' },
    ],
  };

  it('collects a whole subtree, not just direct children', () => {
    expect([...eventWithDescendants(nested, 'overall')].sort()).toEqual([
      'day1',
      'heat1',
      'overall',
    ]);
  });

  it('returns just the event when it has no children', () => {
    expect([...eventWithDescendants(nested, 'heat1')]).toEqual(['heat1']);
  });

  it('does not hang on a cycle', () => {
    // An invalid document must not lock a consumer up: the validator reports the
    // cycle, the reader has to survive it.
    const cyclic: ResultDocument = {
      ...document,
      events: [
        { id: 'a', name: 'A', parent: 'b' },
        { id: 'b', name: 'B', parent: 'a' },
      ],
    };
    expect([...eventWithDescendants(cyclic, 'a')].sort()).toEqual(['a', 'b']);
  });
});

describe('serialize preserves everything', () => {
  it('round-trips a document unchanged', () => {
    const withExtras = {
      ...document,
      'x-vendor': { anything: [1, 2, 3] },
      futureMember: 'from a later minor version',
    };
    expect(JSON.parse(serialize(withExtras))).toEqual(withExtras);
  });

  it('indents when asked and stays compact otherwise', () => {
    expect(serialize(document)).not.toContain('\n');
    expect(serialize(document, { indent: 2 })).toContain('\n  ');
    expect(serialize(document, { indent: 0 })).not.toContain('\n');
  });
});
