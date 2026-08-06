import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSuite } from '../src/index.js';
import type { ConformanceCase } from '../src/index.js';

/**
 * The runner, made to fail on purpose.
 *
 * Everything the project claims about conformance is a claim about this file:
 * 126 cases pass, and that sentence is worth nothing unless a case that should
 * fail does. The one bug this has already had was of exactly that shape — an
 * unrecognised `level` was skipped, and a skip was counted as a pass, so two
 * cases were reported as passing without ever being run.
 *
 * So these do not check that correct cases pass. They check that incorrect ones
 * are caught, one expectation at a time.
 */

const DOCUMENT = {
  openresult: '1.0',
  title: 'Runner fixture',
  lang: 'en',
  measures: [{ id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' }],
  participants: [
    { id: 'ana', name: 'Ana Rivas' },
    { id: 'bo', name: 'Bo Lindqvist' },
  ],
  results: [
    { participant: 'ana', values: { time: 604.2 } },
    { participant: 'bo', values: { time: 598.7 } },
  ],
  rankings: [{ id: 'general', label: 'General', sortBy: ['time'] }],
};

const RANKED = [
  { participant: 'bo', rank: 1 },
  { participant: 'ana', rank: 2 },
];

/** Writes a one-case suite to a temporary directory and runs it. */
async function run(
  entry: Partial<ConformanceCase>,
  document: unknown,
  expected: unknown,
): Promise<{ passed: boolean; failures: string[]; skipped?: string }> {
  const suiteDir = mkdtempSync(join(tmpdir(), 'openresult-runner-'));
  const path = 'valid/only';
  mkdirSync(join(suiteDir, path), { recursive: true });
  writeFileSync(join(suiteDir, path, 'document.json'), JSON.stringify(document), 'utf8');
  writeFileSync(join(suiteDir, path, 'expected.json'), JSON.stringify(expected), 'utf8');
  writeFileSync(
    join(suiteDir, 'manifest.json'),
    JSON.stringify({
      cases: [
        { id: 'only', kind: 'valid', level: 'ranking', rule: 'spec §8.5.1', description: '', path },
      ].map((base) => ({ ...base, ...entry })),
    }),
    'utf8',
  );

  const outcome = await runSuite({ suiteDir });
  const only = outcome.outcomes[0];
  return {
    passed: only?.passed ?? false,
    failures: only?.failures ?? [],
    ...(only?.skipped === undefined ? {} : { skipped: only.skipped }),
  };
}

describe('a case whose expectations are met', () => {
  it('passes, which is the baseline everything below is measured against', async () => {
    const outcome = await run({}, DOCUMENT, { valid: true, rankings: { general: RANKED } });
    expect(outcome).toEqual({ passed: true, failures: [] });
  });
});

describe('a document that does not match its expectation', () => {
  it('fails when a document expected to validate does not', async () => {
    const broken = { ...DOCUMENT, participants: [{ id: 'ana' }] };
    const outcome = await run({}, broken, { valid: true });

    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(' ')).toContain('expected the document to validate');
  });

  it('fails when a document expected to be rejected validates', async () => {
    const outcome = await run({ kind: 'invalid' }, DOCUMENT, {
      valid: false,
      errors: [{ code: 'OR-101', path: '/' }],
    });

    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(' ')).toContain('expected the document to be rejected');
  });

  it('fails when the expected error is not among the ones reported', async () => {
    // A real error, the wrong code: the case must not pass merely because the
    // document was rejected for some reason.
    const broken = { ...DOCUMENT, participants: [{ id: 'ana' }] };
    const outcome = await run({ kind: 'invalid' }, broken, {
      valid: false,
      errors: [{ code: 'OR-999', path: '/participants/0' }],
    });

    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(' ')).toContain('expected error OR-999');
  });

  it('fails when the expected error is reported at another location', async () => {
    const broken = { ...DOCUMENT, participants: [{ id: 'ana' }] };
    const outcome = await run({ kind: 'invalid' }, broken, {
      valid: false,
      errors: [{ code: 'OR-101', path: '/somewhere/else' }],
    });

    expect(outcome.passed).toBe(false);
  });

  it('fails when an expected warning is not raised', async () => {
    const outcome = await run({}, DOCUMENT, { valid: true, warnings: ['OR-901'] });

    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(' ')).toContain('expected warning OR-901');
  });
});

describe('a ranking that does not match its expectation', () => {
  it('fails when the order differs', async () => {
    const outcome = await run({}, DOCUMENT, {
      valid: true,
      rankings: { general: [...RANKED].reverse() },
    });

    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(' ')).toContain('ranking "general"');
  });

  it('fails when a rank differs but the order does not', async () => {
    // Comparing as a set, or comparing only the order, would let this through —
    // and a tie reported as two firsts instead of a first and a second is the
    // difference the whole of §8.3 is about.
    const outcome = await run({}, DOCUMENT, {
      valid: true,
      rankings: {
        general: [
          { participant: 'bo', rank: 1 },
          { participant: 'ana', rank: 1 },
        ],
      },
    });

    expect(outcome.passed).toBe(false);
  });

  it('fails when a ranking is named that the document does not declare', async () => {
    const outcome = await run({}, DOCUMENT, { valid: true, rankings: { absent: RANKED } });

    expect(outcome.passed).toBe(false);
  });

  it('derives every ranking twice, with the presentation layer and without it', async () => {
    // That double run is the operational proof that the layer is ignorable
    // (§3.1.1). A document whose standings depended on a hint would pass one run
    // and fail the other — but only if both actually happen, and a wrong
    // expectation is what makes them both say so.
    const outcome = await run(
      {},
      { ...DOCUMENT, presentation: { defaultView: 'ranking' } },
      { valid: true, rankings: { general: [...RANKED].reverse() } },
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.failures.join(' ')).toContain('as published');
    expect(outcome.failures.join(' ')).toContain('without presentation');
  });
});

describe('a case the runner does not run', () => {
  it('reports a level it was not asked for as a skip, not a pass', async () => {
    const suiteDir = mkdtempSync(join(tmpdir(), 'openresult-runner-'));
    mkdirSync(join(suiteDir, 'valid/only'), { recursive: true });
    writeFileSync(join(suiteDir, 'valid/only/document.json'), JSON.stringify(DOCUMENT), 'utf8');
    writeFileSync(
      join(suiteDir, 'valid/only/expected.json'),
      JSON.stringify({ valid: true }),
      'utf8',
    );
    writeFileSync(
      join(suiteDir, 'manifest.json'),
      JSON.stringify({
        cases: [
          {
            id: 'only',
            kind: 'valid',
            level: 'ranking',
            rule: 'spec §8.5.1',
            description: '',
            path: 'valid/only',
          },
        ],
      }),
      'utf8',
    );

    const outcome = await runSuite({ suiteDir, levels: ['reading'] });

    // Counted apart from the passes. Reporting a skip as a pass is how two cases
    // declaring a level that never existed were counted without being run.
    expect(outcome.skipped).toBe(1);
    expect(outcome.passed).toBe(0);
    expect(outcome.outcomes[0]?.skipped).toContain('not claimed');
  });

  it('reports a deprecated case as a skip, with the reason given', async () => {
    const outcome = await run({ deprecated: 'superseded by another case' }, DOCUMENT, {
      valid: true,
    });

    expect(outcome.skipped).toBe('superseded by another case');
  });
});

describe('running the whole suite', () => {
  it('keeps going after a failure rather than stopping at the first', async () => {
    const suiteDir = mkdtempSync(join(tmpdir(), 'openresult-runner-'));
    for (const [name, expected] of [
      ['first', { valid: true, rankings: { general: [...RANKED].reverse() } }],
      ['second', { valid: true, rankings: { general: RANKED } }],
      ['third', { valid: true, warnings: ['OR-901'] }],
    ] as const) {
      mkdirSync(join(suiteDir, 'valid', name), { recursive: true });
      writeFileSync(
        join(suiteDir, 'valid', name, 'document.json'),
        JSON.stringify(DOCUMENT),
        'utf8',
      );
      writeFileSync(
        join(suiteDir, 'valid', name, 'expected.json'),
        JSON.stringify(expected),
        'utf8',
      );
    }
    writeFileSync(
      join(suiteDir, 'manifest.json'),
      JSON.stringify({
        cases: ['first', 'second', 'third'].map((name) => ({
          id: name,
          kind: 'valid',
          level: 'ranking',
          rule: 'spec §8.5.1',
          description: '',
          path: `valid/${name}`,
        })),
      }),
      'utf8',
    );

    const outcome = await runSuite({ suiteDir });

    // A report naming which two of three fail is worth more than one naming the
    // first.
    expect(outcome.total).toBe(3);
    expect(outcome.failed).toBe(2);
    expect(outcome.passed).toBe(1);
  });

  it('runs only the cases a filter names', async () => {
    const suiteDir = mkdtempSync(join(tmpdir(), 'openresult-runner-'));
    for (const name of ['keep-me', 'skip-me']) {
      mkdirSync(join(suiteDir, 'valid', name), { recursive: true });
      writeFileSync(
        join(suiteDir, 'valid', name, 'document.json'),
        JSON.stringify(DOCUMENT),
        'utf8',
      );
      writeFileSync(
        join(suiteDir, 'valid', name, 'expected.json'),
        JSON.stringify({ valid: true }),
        'utf8',
      );
    }
    writeFileSync(
      join(suiteDir, 'manifest.json'),
      JSON.stringify({
        cases: ['keep-me', 'skip-me'].map((name) => ({
          id: name,
          kind: 'valid',
          level: 'reading',
          rule: 'spec §4.1.1',
          description: '',
          path: `valid/${name}`,
        })),
      }),
      'utf8',
    );

    const outcome = await runSuite({ suiteDir, filter: 'keep' });

    expect(outcome.total).toBe(1);
    expect(outcome.outcomes[0]?.case.id).toBe('keep-me');
  });
});
