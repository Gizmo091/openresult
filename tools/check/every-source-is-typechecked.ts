import { glob, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * No TypeScript file may sit outside every project.
 *
 * `pnpm typecheck` runs `tsc` once per workspace package. Everything else is
 * simply not checked, and `tsx` strips types rather than verifying them, so a
 * file outside every project is checked by nothing at all — it just behaves
 * oddly one day.
 *
 * All twenty-seven repository checks were in that state: `tools/` is not a
 * workspace package and had no `tsconfig.json`. The first run after adding one
 * found a real defect in the schema compiler, where a CommonJS function was
 * reached through a `.default` the published types say is not there.
 */
export const everySourceIsTypechecked: Check = {
  name: 'every-source-is-typechecked',
  enforces: 'Every TypeScript file must belong to a project that pnpm typecheck runs',
  async run() {
    const projects = await typecheckedProjects();
    if (projects.length === 0) {
      return fail(this.name, 'cannot read the typecheck script', [
        'package.json no longer runs tsc the way this check expects, so nothing here is trusted.',
      ]);
    }

    const covered = new Set<string>();
    for (const project of projects) {
      for (const file of await filesIn(project)) covered.add(file);
    }

    const { stdout } = await run('git', ['ls-files', '*.ts'], { cwd: repoRoot });
    const tracked = stdout.split('\n').filter((line) => line.length > 0);

    const orphans = tracked.filter((file) => !covered.has(file) && !file.endsWith('.d.ts'));

    if (orphans.length > 0) {
      const shown = orphans.slice(0, 5);
      return fail(this.name, `${orphans.length} file(s) no project checks`, [
        `${shown.join(', ')}${orphans.length > shown.length ? `, and ${orphans.length - shown.length} more` : ''} ` +
          `${orphans.length === 1 ? 'belongs' : 'belong'} to no tsconfig that ` +
          `\`pnpm typecheck\` runs. tsx strips types rather than ` +
          `checking them, so nothing verifies these until they misbehave. Add them to a project's ` +
          `\`include\`, or give the directory a tsconfig.json and run it from the typecheck script.`,
      ]);
    }

    return pass(this.name, `${tracked.length} TypeScript files across ${projects.length} projects`);
  },
};

/**
 * The tsconfigs `pnpm typecheck` will actually run.
 *
 * Read out of the script and the workspace file rather than listed here: a
 * package added to the workspace is checked from that moment, and a check that
 * had to be told would be one more thing to keep in step.
 */
async function typecheckedProjects(): Promise<string[]> {
  const manifest = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const script = manifest.scripts['typecheck'] ?? '';
  const projects: string[] = [];

  if (script.includes('pnpm -r')) {
    const workspace = await readFile(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
    for (const match of workspace.matchAll(/^\s*-\s*'([^']+)'/gm)) {
      const pattern = match[1] ?? '';
      // The workspace globs one level deep at most, e.g. `sdk/js/packages/*`.
      if (pattern.endsWith('/*')) {
        const parent = pattern.slice(0, -2);
        const { stdout } = await run('ls', [join(repoRoot, parent)]).catch(() => ({ stdout: '' }));
        for (const child of stdout.split('\n').filter(Boolean)) {
          projects.push(join(parent, child, 'tsconfig.json'));
        }
      } else {
        projects.push(join(pattern, 'tsconfig.json'));
      }
    }
  }

  // Anything named explicitly, such as `tsc --noEmit -p tsconfig.repo.json`.
  // Any `.json`, not only a file called `tsconfig.json`: the first version
  // insisted on the latter and reported the thirty-four files that project had
  // just been created to cover.
  for (const match of script.matchAll(/-p\s+(\S+\.json)/g)) {
    const path = match[1] ?? '';
    if (!projects.includes(path)) projects.push(path);
  }

  return projects;
}

/** Files a project's `include` covers, as repository-relative paths. */
async function filesIn(project: string): Promise<string[]> {
  const raw = await readFile(join(repoRoot, project), 'utf8').catch(() => null);
  if (raw === null) return [];

  // Comments are legal in a tsconfig and JSON.parse does not know that.
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')) as { include?: string[] };
  const base = dirname(join(repoRoot, project));
  const found: string[] = [];

  // `glob`, not `git ls-files`: git's pathspec reads `src/**/*.ts` as one
  // directory deep, so half the repository looked unchecked when it is not.
  for (const pattern of config.include ?? []) {
    for await (const file of glob(pattern, { cwd: base })) {
      found.push(relative(repoRoot, join(base, file)));
    }
  }

  return found;
}
