import { execFile } from 'node:child_process';
import { glob } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every source file the build needs must actually be in the repository.
 *
 * A working tree is not the repository. `.gitignore` carries `build/`, which is
 * right for output directories and quietly wrong for a directory someone names
 * `build/` and puts a generator in. That file existed, the build used it, every
 * local run was green — and CI, which clones rather than copies, failed on a
 * module that was never committed.
 *
 * The failure is cheap to cause and slow to diagnose, because the error names a
 * file that is right there on your disk.
 */
const SOURCE_GLOBS = [
  '{sdk,tools,viewer,playground,validator,site,conformance}/**/*.{ts,mjs,js,css,html,svg}',
  'specification/**/*.md',
  'schema/**/*.json',
  'examples/**/*.json',
];

const EXCLUDED = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  // Written at build time from things that are tracked.
  /^site\/(release|public\/examples|public\/schema|src\/generated)\//,
];

export const sourcesAreTracked: Check = {
  name: 'sources-are-tracked',
  enforces: 'A file the build reads must be committed, not merely present',
  async run() {
    const candidates: string[] = [];
    for (const pattern of SOURCE_GLOBS) {
      for await (const file of glob(pattern, { cwd: repoRoot })) {
        if (!EXCLUDED.some((pattern) => pattern.test(file))) candidates.push(file);
      }
    }

    // Paths as arguments, in batches, rather than on stdin: `execFile` has no
    // way to write to a child's stdin, so `--stdin` hangs waiting for input
    // that never arrives.
    const ignored: string[] = [];
    for (let start = 0; start < candidates.length; start += 400) {
      const batch = candidates.slice(start, start + 400);
      // `check-ignore` exits 1 when nothing matches, which is the good case.
      const { stdout } = await run('git', ['check-ignore', '--', ...batch], {
        cwd: repoRoot,
        maxBuffer: 8 * 1024 * 1024,
      }).catch((error: { stdout?: string; code?: number }) =>
        error.code === 1 ? { stdout: '' } : Promise.reject(error),
      );
      ignored.push(...stdout.split('\n').filter((line) => line.trim() !== ''));
    }

    if (ignored.length > 0) {
      return fail(this.name, `${ignored.length} source file(s) ignored by git`, [
        ...ignored
          .slice(0, 12)
          .map(
            (file) =>
              `${file} is on disk and .gitignore excludes it. A clean clone will not have it, ` +
              `so the build works here and fails everywhere else.`,
          ),
        ...(ignored.length > 12 ? [`…and ${ignored.length - 12} more.`] : []),
      ]);
    }

    return pass(this.name, `${candidates.length} source files, all tracked`);
  },
};
