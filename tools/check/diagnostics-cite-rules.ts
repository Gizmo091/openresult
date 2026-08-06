import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const CATALOGUE = join(repoRoot, 'sdk/js/packages/validate/src/diagnostics.ts');

/**
 * Every diagnostic must cite a rule that exists.
 *
 * The whole design rests on rules being citable: §N.M.K identifiers are stable
 * across editorial revisions precisely so a diagnostic can point at one. Three
 * warnings pointed at "§12.2" instead — a section, not a rule — which tells a
 * producer that something is wrong and gives them a page to search rather than a
 * sentence to read. It is a real gap, and worth closing.
 *
 * This checks both directions of the same failure: a citation that names no
 * rule, and a citation that is only a section number.
 */
export const diagnosticsCiteRules: Check = {
  name: 'diagnostics-cite-rules',
  enforces: 'A diagnostic must cite a rule that exists, not a section',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const catalogue = await readFile(CATALOGUE, 'utf8');

    // Rules are written `**§8.1.1**` in most sections and `**§8.5.2 — Sort.**`
    // in the derivation algorithm, so the identifier is matched without
    // requiring what follows it — the same shape `spec-coherence` uses.
    const declared = new Set(
      [...spec.matchAll(/\*\*§(\d+\.\d+\.\d+)/g)].map((match) => match[1] ?? ''),
    );

    const problems: string[] = [];
    let checked = 0;

    for (const match of catalogue.matchAll(/'(OR-\d+)':\s*\{[^}]*rule:\s*'([^']*)'/g)) {
      const [, code = '', citation = ''] = match;
      checked += 1;

      const rule = /^spec §(\d+\.\d+\.\d+)$/.exec(citation);
      if (rule === null) {
        problems.push(
          `${code} cites "${citation}", which is not a rule identifier. A producer reading this ` +
            `diagnostic gets a section to search instead of a sentence to read.`,
        );
        continue;
      }

      if (!declared.has(rule[1] ?? '')) {
        problems.push(
          `${code} cites §${rule[1]}, which the specification does not declare. Either the rule ` +
            `was renumbered and this was not, or the citation was never right.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} diagnostic(s) cite badly`, problems);
    }
    return pass(this.name, `${checked} diagnostics cite a declared rule`);
  },
};
