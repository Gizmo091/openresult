#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { runSuite } from './runner.js';
import type { ConformanceLevel } from './index.js';

const defaultSuite = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
  'conformance',
);

const { values } = parseArgs({
  options: {
    suite: { type: 'string' },
    level: { type: 'string', multiple: true },
    filter: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
});

const suiteDir = resolve(values.suite ?? defaultSuite);
const levels = values.level as ConformanceLevel[] | undefined;

const outcome = await runSuite({
  suiteDir,
  ...(levels === undefined ? {} : { levels }),
  ...(values.filter === undefined ? {} : { filter: values.filter }),
});

for (const entry of outcome.outcomes) {
  if (entry.skipped !== undefined) {
    if (values.verbose) console.log(`  ○ ${entry.case.id} — ${entry.skipped}`);
    continue;
  }
  if (entry.passed) {
    if (values.verbose) console.log(`  ✓ ${entry.case.id}  ${entry.case.rule}`);
    continue;
  }
  console.log(`  ✗ ${entry.case.id}  ${entry.case.rule}`);
  console.log(`      ${entry.case.description}`);
  for (const failure of entry.failures) console.log(`      ${failure}`);
}

const summary =
  `${outcome.passed}/${outcome.total - outcome.skipped} cases passed` +
  (outcome.skipped > 0 ? `, ${outcome.skipped} skipped` : '');

console.log(outcome.failed === 0 ? `\n${summary}` : `\n${summary}, ${outcome.failed} FAILED`);
process.exitCode = outcome.failed === 0 ? 0 : 1;
