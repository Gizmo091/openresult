import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * A workflow must build before it runs anything that reads what the build makes.
 *
 * This has now gone wrong twice. `check.yml` ran typecheck, the repository
 * checks and the conformance suite before `pnpm build`, and stayed red for
 * eleven runs while every local run was green — a working tree usually has a
 * stale `dist` lying around, and CI never does. `release.yml` had the identical
 * ordering and nobody noticed, because it only runs on a tag: it failed on the
 * first release, in the site's server tests, which serve `site/dist`.
 *
 * The second occurrence is what makes it worth a check rather than a second
 * careful fix.
 */

/** Steps that read the build output. */
const NEEDS_BUILD = ['pnpm check', 'pnpm test', 'pnpm conformance', 'pnpm typecheck'];

export const workflowsBuildFirst: Check = {
  name: 'workflows-build-first',
  enforces: 'A workflow must run `pnpm build` before anything that reads its output',
  async run() {
    const problems: string[] = [];
    let inspected = 0;

    for await (const file of glob('.github/workflows/*.yml', { cwd: repoRoot })) {
      const workflow = await readFile(join(repoRoot, file), 'utf8');

      // Commands as they appear, in order, ignoring commented-out lines.
      const commands = [...workflow.matchAll(/^\s*(?:-\s*)?run:\s*(?:>[-\s]*)?(.+)$/gm)]
        .map((match) => (match[1] ?? '').trim())
        .filter((command) => !command.startsWith('#'));

      const buildAt = commands.findIndex((command) => command.startsWith('pnpm build'));
      const dependents = commands
        .map((command, index) => ({ command, index }))
        .filter(({ command }) => NEEDS_BUILD.some((needle) => command.startsWith(needle)));

      if (dependents.length === 0) continue;
      inspected += 1;

      if (buildAt === -1) {
        problems.push(
          `${file} runs ${dependents.map((d) => `\`${d.command}\``).join(', ')} and never builds. ` +
            `On a fresh clone there is no dist to read.`,
        );
        continue;
      }

      for (const { command, index } of dependents) {
        if (index < buildAt) {
          problems.push(
            `${file} runs \`${command}\` before \`pnpm build\`. It passes locally, where a stale ` +
              `dist is lying around, and fails on a clean checkout — which is every CI run.`,
          );
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} step(s) run before the build`, problems);
    }
    return pass(this.name, `${inspected} workflows build before they read`);
  },
};
