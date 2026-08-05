import { describe, expect, it } from 'vitest';
import { rank, type ResultDocument } from '../src/index.js';

/**
 * Derivation runs on every render, in every view, on documents a viewer did not
 * choose. It has to stay cheap enough that nobody is tempted to cache it — a
 * cached ranking is a ranking that can go stale.
 *
 * Thresholds are generous, and deliberately so: this guards against an
 * accidental quadratic, not against a few microseconds. Typical figures here
 * are 8 ms, 20 ms and 450 ms — a budget set just above those would fail
 * whenever the rest of the suite runs alongside, and a gate that fires on load
 * teaches everyone to rerun it until it passes.
 */

function largeDocument(size: number, options: { ties?: boolean } = {}): ResultDocument {
  return {
    openresult: '1.0',
    title: `${size} results`,
    measures: [
      { id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' },
      { id: 'points', label: 'Points', kind: 'points', unit: 'pt', betterWhen: 'higher' },
    ],
    participants: Array.from({ length: size }, (_, index) => ({
      id: `p${index}`,
      name: `Competitor ${index}`,
    })),
    results: Array.from({ length: size }, (_, index) => ({
      participant: `p${index}`,
      // Deterministic spread, no randomness: a benchmark that varies run to run
      // cannot be a gate.
      values: {
        time: options.ties === true ? (index % 10) * 100 : ((index * 7919) % size) + index / size,
        points: (index * 31) % 1000,
      },
    })),
    rankings: [{ id: 'main', label: 'Main', sortBy: ['time', 'points'] }],
  };
}

function timed(work: () => unknown): number {
  work(); // warm up
  const started = performance.now();
  work();
  return performance.now() - started;
}

describe('derivation performance', () => {
  it('ranks 5,000 results in well under half a second', () => {
    const document = largeDocument(5_000);
    expect(timed(() => rank(document, 'main'))).toBeLessThan(500);
  });

  it('stays fast when almost everything ties', () => {
    // Tie grouping is the step most easily written as a quadratic scan.
    const document = largeDocument(5_000, { ties: true });
    expect(timed(() => rank(document, 'main'))).toBeLessThan(700);
  });

  it('handles 50,000 results, which rules out a quadratic', () => {
    // An absolute budget on a large input, rather than a ratio between two
    // small ones: at millisecond scale the ratio is dominated by GC and JIT
    // noise, and a flaky test erodes confidence in the whole suite. A quadratic
    // derivation would need minutes here, not milliseconds.
    const document = largeDocument(50_000);
    expect(timed(() => rank(document, 'main'))).toBeLessThan(4000);
  });
});
