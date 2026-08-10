import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatNumber, rank, type ResultDocument } from '@openresult/core';
import { validate } from '@openresult/validate';
import type {
  ConformanceCase,
  ConformanceLevel,
  ConformanceManifest,
  Expected,
  ExpectedInvalid,
  ExpectedPlacement,
  ExpectedValid,
} from './index.js';

export interface CaseOutcome {
  case: ConformanceCase;
  passed: boolean;
  failures: string[];
  skipped?: string;
}

export interface SuiteOutcome {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  outcomes: CaseOutcome[];
}

export interface RunOptions {
  /** Directory holding manifest.json. */
  suiteDir: string;
  /** Levels the implementation under test claims to support. */
  levels?: ConformanceLevel[];
  /** Run only cases whose id contains this string. */
  filter?: string;
}

const ALL_LEVELS: ConformanceLevel[] = ['reading', 'ranking', 'rewriting'];

/**
 * Run the suite.
 *
 * A failing case never stops the others: a report saying which twelve cases
 * fail is worth more than one saying the first did.
 */
export async function runSuite(options: RunOptions): Promise<SuiteOutcome> {
  const manifest = JSON.parse(
    await readFile(join(options.suiteDir, 'manifest.json'), 'utf8'),
  ) as ConformanceManifest;

  const levels = new Set(options.levels ?? ALL_LEVELS);
  const outcomes: CaseOutcome[] = [];

  for (const entry of manifest.cases) {
    if (options.filter !== undefined && !entry.id.includes(options.filter)) continue;

    if (entry.deprecated !== undefined) {
      outcomes.push({ case: entry, passed: true, failures: [], skipped: entry.deprecated });
      continue;
    }
    if (!levels.has(entry.level)) {
      outcomes.push({
        case: entry,
        passed: true,
        failures: [],
        skipped: `level "${entry.level}" not claimed`,
      });
      continue;
    }

    outcomes.push(await runCase(options.suiteDir, entry));
  }

  const skipped = outcomes.filter((outcome) => outcome.skipped !== undefined).length;
  const failed = outcomes.filter((outcome) => !outcome.passed).length;

  return {
    total: outcomes.length,
    passed: outcomes.length - failed - skipped,
    failed,
    skipped,
    outcomes,
  };
}

async function runCase(suiteDir: string, entry: ConformanceCase): Promise<CaseOutcome> {
  const directory = join(suiteDir, entry.path);
  const source = await readFile(join(directory, 'document.json'), 'utf8');
  const expected = JSON.parse(await readFile(join(directory, 'expected.json'), 'utf8')) as Expected;

  const failures = expected.valid ? checkValid(source, expected) : checkInvalid(source, expected);

  return { case: entry, passed: failures.length === 0, failures };
}

function checkInvalid(source: string, expected: ExpectedInvalid): string[] {
  const report = validate(source);
  const failures: string[] = [];

  if (report.valid) {
    failures.push('expected the document to be rejected, but it validated');
  }

  // Codes and paths only — never message text. Rewording a diagnostic must not
  // break the suite, nor force ports to translate identically.
  const actual = report.errors.map((entry) => `${entry.code} ${entry.path}`);
  for (const wanted of expected.errors) {
    const key = `${wanted.code} ${wanted.path}`;
    if (!actual.includes(key)) {
      failures.push(`expected error ${key}; got ${actual.join(', ') || 'none'}`);
    }
  }

  // An invalid document may still have to be readable — that is the whole point
  // of forward compatibility. When the case states a ranking, the reader must
  // produce it despite the document being non-conforming.
  if (expected.rankings !== undefined) {
    const document = JSON.parse(source) as ResultDocument;
    for (const [rankingId, wanted] of Object.entries(expected.rankings)) {
      failures.push(...compareRanking(document, rankingId, wanted, 'read despite errors'));
    }
  }

  return failures;
}

/** §5.1.5 and §5.2.5: the figure a consumer prints, and only the figure. */
function compareRenderings(document: ResultDocument, wanted: ExpectedValid['display']): string[] {
  const failures: string[] = [];
  for (const expectation of wanted ?? []) {
    const measure = document.measures?.find((entry) => entry.id === expectation.measure);
    const value = document.results[expectation.result]?.values?.[expectation.measure];
    if (measure === undefined || typeof value !== 'number') {
      failures.push(
        `display: /results/${expectation.result} carries no number for "${expectation.measure}"`,
      );
      continue;
    }
    const got = formatNumber(value, measure);
    if (got !== expectation.rendered) {
      failures.push(
        `display: ${value} as "${expectation.measure}" renders "${got}", expected ` +
          `"${expectation.rendered}"`,
      );
    }
  }
  return failures;
}

function checkValid(source: string, expected: ExpectedValid): string[] {
  const failures: string[] = [];
  const report = validate(source);

  if (!report.valid) {
    failures.push(
      `expected the document to validate; got ${report.errors
        .map((entry) => `${entry.code} ${entry.path}`)
        .join(', ')}`,
    );
    return failures;
  }

  const warnings = new Set(report.warnings.map((entry) => entry.code));
  for (const wanted of expected.warnings ?? []) {
    if (!warnings.has(wanted)) {
      failures.push(`expected warning ${wanted}; got ${[...warnings].join(', ') || 'none'}`);
    }
  }

  const document = JSON.parse(source) as ResultDocument;
  failures.push(...compareRenderings(document, expected.display));

  if (expected.rankings === undefined) return failures;

  // Every case runs twice, with and without the presentation layer. Identical
  // rankings are the operational proof that the layer is ignorable — the
  // property the whole three-layer design rests on (spec §3.1.1).
  const stripped = JSON.parse(source) as ResultDocument;
  delete stripped.presentation;

  for (const [rankingId, wanted] of Object.entries(expected.rankings)) {
    failures.push(...compareRanking(document, rankingId, wanted, 'as published'));
    failures.push(...compareRanking(stripped, rankingId, wanted, 'without presentation'));
  }

  return failures;
}

function compareRanking(
  document: ResultDocument,
  rankingId: string,
  wanted: ExpectedPlacement[],
  label: string,
): string[] {
  const derived = rank(document, rankingId).map((entry) => ({
    participant: entry.participant.id,
    rank: entry.rank,
  }));

  // Sequence comparison, not set: the order is what verifies sort stability.
  const actual = JSON.stringify(derived);
  const target = JSON.stringify(wanted);

  return actual === target
    ? []
    : [`ranking "${rankingId}" (${label}): expected ${target}, got ${actual}`];
}
