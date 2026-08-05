import { coreDeps } from './core-deps.ts';
import { crossImplementation } from './cross-implementation.ts';
import { examples } from './examples.ts';
import { noDomainLogic } from './no-domain-logic.ts';
import { ruleCoverage } from './rule-coverage.ts';
import { schemaModule } from './schema-module.ts';
import type { Check, CheckResult } from './types.ts';

/**
 * Repository invariants, run on every change.
 *
 * These are what make the project's principles enforceable rather than
 * declarative. Checks are added as the corresponding artefacts appear:
 * `examples` with the example library, `presentation-optional` and
 * `rule-coverage` with the conformance suite, `spec-schema-sync` with the
 * specification.
 */
const CHECKS: Check[] = [
  coreDeps,
  noDomainLogic,
  examples,
  schemaModule,
  ruleCoverage,
  crossImplementation,
];

function report(results: CheckResult[]): boolean {
  let failed = false;

  for (const result of results) {
    const check = CHECKS.find((c) => c.name === result.name);
    if (result.ok) {
      console.log(`  ✓ ${result.name.padEnd(24)} ${result.summary}`);
    } else {
      failed = true;
      console.log(`  ✗ ${result.name.padEnd(24)} ${result.summary}`);
      if (check) console.log(`      enforces: ${check.enforces}`);
      for (const problem of result.problems) {
        console.log(`      ${problem}`);
      }
    }
  }

  return failed;
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const selected =
    requested.length > 0 ? CHECKS.filter((check) => requested.includes(check.name)) : CHECKS;

  if (requested.length > 0 && selected.length !== requested.length) {
    const known = CHECKS.map((c) => c.name).join(', ');
    const unknown = requested.filter((name) => !CHECKS.some((c) => c.name === name));
    console.error(`Unknown check(s): ${unknown.join(', ')}. Available: ${known}`);
    process.exitCode = 2;
    return;
  }

  console.log(`Repository checks (${selected.length}):`);

  const results: CheckResult[] = [];
  for (const check of selected) {
    try {
      results.push(await check.run());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: check.name,
        ok: false,
        problems: [`check crashed: ${message}`],
        summary: 'could not run',
      });
    }
  }

  const failed = report(results);
  console.log('');
  console.log(failed ? 'Some checks failed.' : 'All checks passed.');
  process.exitCode = failed ? 1 : 0;
}

await main();
