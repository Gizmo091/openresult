import { describe, expect, it } from 'vitest';
import { validate } from '../src/index.js';

/**
 * The sentences a producer actually reads.
 *
 * Two warnings list the results they are about and stop at three, then say how
 * many more there were. That truncation had never rendered: every document that
 * raises them has one or two offenders, so the branch describing a longer list
 * had never been seen — which is how "property name must be valid" reached a
 * producer, and how `result(s)` survived in a project that writes prose
 * everywhere else.
 *
 * Counting is where a message stops sounding like a person, so these check the
 * count and the wording around it rather than the code alone.
 */

function document(results: unknown[], participants: unknown[]): Record<string, unknown> {
  return {
    openresult: '1.0',
    title: 'Two-round trial',
    lang: 'en',
    measures: [
      { id: 'round1', label: 'Round 1', kind: 'points', unit: 'pt', betterWhen: 'higher' },
      { id: 'round2', label: 'Round 2', kind: 'points', unit: 'pt', betterWhen: 'higher' },
    ],
    participants,
    results,
    rankings: [{ id: 'overall', label: 'Overall', sortBy: ['round1', 'round2'] }],
  };
}

/** `count` competitors, the first `partial` of them missing the second round. */
function withPartialResults(count: number, partial: number): Record<string, unknown> {
  const names = ['Ana', 'Bo', 'Cai', 'Dee', 'Eli', 'Fay', 'Gus'];
  const people = Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: names[index] ?? `P${index}`,
  }));
  const results = people.map((person, index) => ({
    participant: person.id,
    values: index < partial ? { round1: 10 - index } : { round1: 10 - index, round2: 8 },
  }));
  return document(results, people);
}

function warning(report: ReturnType<typeof validate>, code: string): string {
  return report.warnings.find((entry) => entry.code === code)?.message ?? '';
}

describe('a ranking that drops results for a missing measure (OR-908)', () => {
  it('speaks of one result in the singular', () => {
    const message = warning(validate(withPartialResults(3, 1)), 'OR-908');

    expect(message).toContain('leaves 1 result unranked because it lacks a measure');
    expect(message).toContain('It is not excluded by status');
    expect(message).not.toContain('result(s)');
  });

  it('speaks of several in the plural', () => {
    const message = warning(validate(withPartialResults(4, 2)), 'OR-908');

    expect(message).toContain('leaves 2 results unranked because they lack a measure');
    expect(message).toContain('They are not excluded by status');
  });

  it('names three and counts the rest', () => {
    // The branch that had never rendered. A list of every competitor in a field
    // of two hundred is not a message, it is a dump.
    const message = warning(validate(withPartialResults(6, 5)), 'OR-908');

    expect(message).toContain('Ana, Bo, Cai, and 2 more');
    expect(message).not.toContain('Dee');
  });

  it('names all three without adding a count when there are exactly three', () => {
    const message = warning(validate(withPartialResults(5, 3)), 'OR-908');

    expect(message).toContain('Ana, Bo, Cai.');
    expect(message).not.toContain('more');
  });
});

describe('a ranking ordered by positions that are not all published (OR-911)', () => {
  const resolved = (count: number, published: number): Record<string, unknown> => {
    const names = ['Ana', 'Bo', 'Cai', 'Dee', 'Eli'];
    const people = Array.from({ length: count }, (_, index) => ({
      id: `p${index}`,
      name: names[index] ?? `P${index}`,
    }));
    return {
      openresult: '1.0',
      title: 'Judged final',
      lang: 'en',
      measures: [{ id: 'score', label: 'Score', kind: 'score', unit: 'pt', betterWhen: 'higher' }],
      participants: people,
      results: people.map((person, index) => ({
        participant: person.id,
        values: { score: 90 },
        ...(index < published ? { ranks: { final: index + 1 } } : {}),
      })),
      rankings: [{ id: 'final', label: 'Final', sortBy: [], ties: 'resolved' }],
    };
  };

  it('names up to three of the results carrying no position', () => {
    const message = warning(validate(resolved(3, 1)), 'OR-911');

    expect(message).toContain('2 of them carry none');
    expect(message).toContain('"Bo", "Cai"');
    expect(message).not.toContain('and others');
  });

  it('says "and others" rather than listing a whole field', () => {
    // The other branch that had never rendered.
    const message = warning(validate(resolved(5, 0)), 'OR-911');

    expect(message).toContain('5 of them carry none');
    expect(message).toContain('"Ana", "Bo", "Cai" and others');
    expect(message).not.toContain('"Dee"');
  });
});
