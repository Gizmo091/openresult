import { coreDeps } from './core-deps.ts';
import { allocatedNumbersAreAttributes } from './allocated-numbers-are-attributes.ts';
import { builtOutputIsCurrent } from './built-output-is-current.ts';
import { compiledValidator } from './compiled-validator.ts';
import { conformanceManifest } from './conformance-manifest.ts';
import { noSecrets } from './no-secrets.ts';
import { publishablePackages } from './publishable-packages.ts';
import { workflowsBuildFirst } from './workflows-build-first.ts';
import { diagnosticsAreExercised } from './diagnostics-are-exercised.ts';
import { diagnosticsCiteRules } from './diagnostics-cite-rules.ts';
import { siteLinksResolve } from './site-links-resolve.ts';
import { sourcesAreTracked } from './sources-are-tracked.ts';
import { unitVocabulary } from './unit-vocabulary.ts';
import { defaultExclusionsAgree } from './default-exclusions-agree.ts';
import { descriptionEverywhere } from './description-everywhere.ts';
import { crossImplementation } from './cross-implementation.ts';
import { examples } from './examples.ts';
import { noDomainLogic } from './no-domain-logic.ts';
import { presentationOptional } from './presentation-optional.ts';
import { ruleCoverage } from './rule-coverage.ts';
import { schemaKeywordsTranslated } from './schema-keywords-translated.ts';
import { schemaModule } from './schema-module.ts';
import { specCoherence } from './spec-coherence.ts';
import { specRequiredSync } from './spec-required-sync.ts';
import { specSchemaSync } from './spec-schema-sync.ts';
import { typesMatchSchema } from './types-match-schema.ts';
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
  specCoherence,
  specSchemaSync,
  specRequiredSync,
  typesMatchSchema,
  defaultExclusionsAgree,
  allocatedNumbersAreAttributes,
  compiledValidator,
  conformanceManifest,
  noSecrets,
  publishablePackages,
  workflowsBuildFirst,
  diagnosticsAreExercised,
  builtOutputIsCurrent,
  schemaKeywordsTranslated,
  diagnosticsCiteRules,
  siteLinksResolve,
  sourcesAreTracked,
  unitVocabulary,
  descriptionEverywhere,
  presentationOptional,
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
