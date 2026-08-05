import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = join(repoRoot, 'conformance/manifest.json');
const RUNNER = join(repoRoot, 'sdk/js/packages/conformance/src/runner.ts');

/**
 * A conformance case must actually run.
 *
 * The runner skips any case whose `level` it does not recognise, and reports a
 * skip as a pass. Two cases written tonight declared `level: "document"`, which
 * has never been a level — they were silently ignored and counted as passing,
 * which is worse than not having written them: the suite grew and the coverage
 * did not.
 *
 * The valid levels are read out of the runner rather than repeated here, so the
 * two cannot drift.
 */
export const conformanceManifest: Check = {
  name: 'conformance-manifest',
  enforces: 'Every conformance case must declare a level the runner runs',
  async run() {
    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as {
      cases: { id: string; level?: string; path?: string; kind?: string; rule?: string }[];
    };
    const runner = await readFile(RUNNER, 'utf8');

    const declared = /const ALL_LEVELS:[^=]*=\s*\[([^\]]*)\]/.exec(runner);
    if (declared === null) {
      return fail(this.name, 'cannot read the runner', [
        'ALL_LEVELS is not where this check expects it, so nothing here can be trusted.',
      ]);
    }
    const levels = new Set(
      [...(declared[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1] ?? ''),
    );

    const problems: string[] = [];
    const seen = new Set<string>();

    for (const entry of manifest.cases) {
      if (seen.has(entry.id)) {
        problems.push(`Two cases share the id "${entry.id}"; one of them shadows the other.`);
      }
      seen.add(entry.id);

      if (entry.level === undefined || !levels.has(entry.level)) {
        problems.push(
          `Case "${entry.id}" declares level "${entry.level ?? '(none)'}", which the runner does ` +
            `not run — so it is skipped, and a skip is reported as a pass. Use one of ` +
            `${[...levels].map((level) => `"${level}"`).join(', ')}.`,
        );
      }

      if (entry.path === undefined) {
        problems.push(`Case "${entry.id}" declares no path.`);
        continue;
      }

      for (const file of ['document.json', 'expected.json']) {
        const target = join(repoRoot, 'conformance', entry.path, file);
        const found = await stat(target).catch(() => null);
        if (found === null) {
          problems.push(`Case "${entry.id}" has no ${file} at conformance/${entry.path}.`);
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} problem(s) in the manifest`, problems);
    }
    return pass(this.name, `${manifest.cases.length} cases, all runnable`);
  },
};
