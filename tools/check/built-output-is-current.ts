import { glob, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass, skip } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * A stale `dist` makes every other answer untrustworthy.
 *
 * Packages resolve each other through `dist/index.d.ts`, so `pnpm typecheck`
 * checks a consumer against whatever the producer last emitted. Change a type in
 * one package, typecheck before rebuilding, and it passes against the old
 * declarations — which is how a required `suggestion` reached CI as a green
 * local run and a red remote one.
 *
 * `check.yml` builds first and `workflows-build-first` keeps it that way. This
 * is the same ordering, enforced where it was actually broken: on a working
 * copy, where nothing sequences the two commands.
 */
export const builtOutputIsCurrent: Check = {
  name: 'built-output-is-current',
  enforces: 'A package must not be typechecked against declarations older than its source',
  async run() {
    const packages = new Set<string>();
    for await (const file of glob('**/dist/index.d.ts', { cwd: repoRoot })) {
      if (file.includes('node_modules')) continue;
      packages.add(dirname(dirname(file)));
    }

    if (packages.size === 0) {
      return skip(this.name, 'nothing built yet — run pnpm build');
    }

    const problems: string[] = [];
    for (const pkg of [...packages].sort()) {
      const source = await newest(join(pkg, 'src', '**', '*.ts'));
      const built = await newest(join(pkg, 'dist', '**', '*.d.ts'));
      if (source === undefined || built === undefined) continue;

      if (source > built) {
        problems.push(
          `${pkg}/src is newer than ${pkg}/dist. Anything reading this package reads the old ` +
            `declarations, so a type error in a consumer will not appear until CI. Run ` +
            `\`pnpm build\`.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} package(s) built from older source`, problems);
    }
    return pass(this.name, `${packages.size} built packages, all current`);
  },
};

/** Most recent modification time under a glob, or undefined if it matches nothing. */
async function newest(pattern: string): Promise<number | undefined> {
  let latest: number | undefined;
  for await (const file of glob(pattern, { cwd: repoRoot })) {
    const info = await stat(join(repoRoot, file));
    if (latest === undefined || info.mtimeMs > latest) latest = info.mtimeMs;
  }
  return latest;
}
