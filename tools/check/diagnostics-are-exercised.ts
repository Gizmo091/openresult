import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOGUE = join(repoRoot, 'sdk/js/packages/validate/src/diagnostics.ts');

/**
 * Every diagnostic must fire somewhere.
 *
 * A diagnostic nothing exercises has never been seen to work: its message may
 * name the wrong member, its pointer may address the wrong node, or the branch
 * may simply be unreachable. It looks like coverage in the catalogue and is
 * coverage nowhere.
 *
 * Seven were in that state at once, and three of them had been added the same
 * day — which is the ordinary way it happens. A rule, a code and a table row are
 * satisfying to write; the case that proves the code fires is not.
 *
 * A ratchet, like `rule-coverage`: what is exercised stays exercised.
 */
export const diagnosticsAreExercised: Check = {
  name: 'diagnostics-exercised',
  enforces: 'Every declared diagnostic must be asserted by a test or a conformance case',
  async run() {
    const catalogue = await readFile(CATALOGUE, 'utf8');
    const declared = [...new Set([...catalogue.matchAll(/'(OR-\d+)':/g)].map((m) => m[1] ?? ''))];

    const asserted = new Set<string>();
    for (const pattern of ['conformance/**/expected.json', '**/test/**/*.test.ts']) {
      for await (const file of glob(pattern, { cwd: repoRoot })) {
        if (file.includes('node_modules')) continue;
        const content = await readFile(join(repoRoot, file), 'utf8');
        for (const match of content.matchAll(/OR-\d+/g)) asserted.add(match[0]);
      }
    }

    const never = declared.filter((code) => !asserted.has(code));
    if (never.length > 0) {
      return fail(this.name, `${never.length} diagnostic(s) never fire in any test`, [
        `${never.join(', ')} are declared and nothing asserts them. A diagnostic that has never ` +
          `been seen to fire may name the wrong member, point at the wrong node, or sit behind a ` +
          `branch nothing reaches — and the catalogue makes it look covered.`,
      ]);
    }

    return pass(this.name, `${declared.length} diagnostics, all exercised`);
  },
};
