import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Conformance documents that must not be held to the rules they carry.
 *
 * Two kinds, for the same reason: neither is a document the project publishes
 * as correct.
 *
 * An **invalid** case exists to break a rule and say what a validator answers.
 * A check that refused it would leave the rule with no case at all — which is
 * exactly what happened to §5.2.6, recorded as unenforceable for a while
 * because the only document that could demonstrate it was the one the check
 * would reject.
 *
 * A **deprecated** case is never rewritten — it is marked with a reason and
 * replaced — so its directory stays as the record of what the suite used to
 * assert. Holding it to today's rules would force the choice that policy exists
 * to prevent: edit the old case, or leave the new rule unenforced.
 */
export async function documentsExemptFromCorpusRules(): Promise<Set<string>> {
  const manifest = JSON.parse(
    await readFile(join(repoRoot, 'conformance/manifest.json'), 'utf8'),
  ) as { cases: { path: string; kind?: string; deprecated?: string }[] };

  return new Set(
    manifest.cases
      .filter((entry) => entry.kind === 'invalid' || entry.deprecated !== undefined)
      .map((entry) => `conformance/${entry.path}/document.json`),
  );
}
