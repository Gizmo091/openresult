import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = join(repoRoot, '.github/workflows/release.yml');

/**
 * Every package that can be published must be published, and nothing else.
 *
 * The release workflow used to glob `sdk/js/packages/*`, which silently omitted
 * the viewer — it lives in `viewer/`, and it is the package a consumer is most
 * likely to install — and silently included the conformance runner, whose sixty
 * cases live at the repository root and would not have travelled with it. Both
 * mistakes are invisible until someone runs `npm install` and finds a package
 * missing or useless.
 *
 * A package is publishable unless it says `private: true`. That is npm's own
 * rule, so this compares intent against what the workflow actually names.
 */
export const publishablePackages: Check = {
  name: 'publishable-packages',
  enforces: 'A package that is not private must be in the release workflow, and vice versa',
  async run() {
    const workflow = await readFile(WORKFLOW, 'utf8');

    // Package names as they appear in the workflow's commands, comments
    // stripped: the release names them in whichever step does the packing, and
    // that step has moved before. Matching commands rather than one step's
    // flags keeps this working when the mechanics change again.
    const commands = workflow
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    const published = new Set(
      [...commands.matchAll(/(@[\w-]+\/[\w-]+)/g)]
        .map((match) => match[1] ?? '')
        .filter((name) => name.startsWith('@openresult/')),
    );

    const problems: string[] = [];
    const publishable: string[] = [];

    for await (const file of glob(
      '{sdk/js/packages,validator,viewer,playground,site}/**/package.json',
      {
        cwd: repoRoot,
      },
    )) {
      if (file.includes('node_modules')) continue;

      const manifest = JSON.parse(await readFile(join(repoRoot, file), 'utf8')) as {
        name?: string;
        private?: boolean;
        repository?: { url?: string; directory?: string };
        files?: string[];
      };
      const name = manifest.name;
      if (name === undefined) continue;

      if (manifest.private === true) {
        if (published.has(name)) {
          problems.push(
            `${name} is marked private and the release workflow publishes it anyway. ` +
              `npm will refuse it and the release will fail halfway through.`,
          );
        }
        continue;
      }

      publishable.push(name);

      // npm refuses to attest provenance for a package that declares no
      // repository, and the release publishes with `--provenance`. The failure
      // lands at the very last step of a tagged release, after every check has
      // passed, which is the worst moment to discover a missing field.
      const repository = manifest.repository?.url;
      if (repository === undefined || !repository.includes('github.com/Gizmo091/openresult')) {
        problems.push(
          `${name} declares no repository pointing at this project. npm will refuse to attest ` +
            `provenance for it, and the release fails after publishing whatever came before it ` +
            `in the list.`,
        );
      }
      if (manifest.repository?.directory === undefined) {
        problems.push(
          `${name} declares a repository without a "directory". In a monorepo that sends every ` +
            `visitor to the root instead of the package.`,
        );
      }

      // A package listing README.md in `files` and not having one publishes a
      // blank page on npm — which is the first thing anyone deciding whether to
      // install it will see.
      if (manifest.files?.includes('README.md') === true) {
        const readme = join(repoRoot, dirname(file), 'README.md');
        const present = await readFile(readme, 'utf8').catch(() => null);
        if (present === null) {
          problems.push(
            `${name} lists README.md in "files" and has none, so its npm page is blank.`,
          );
        }
      }

      if (!published.has(name)) {
        problems.push(
          `${name} is publishable — no "private": true — but the release workflow never names ` +
            `it. Add it to the publish step, or mark the package private if it is not meant to ` +
            `reach npm.`,
        );
      }
    }

    for (const name of published) {
      if (!publishable.includes(name)) {
        problems.push(`The release workflow publishes ${name}, which is not a package here.`);
      }
    }

    if (problems.length > 0) {
      return fail(
        this.name,
        `${problems.length} package(s) out of step with the release`,
        problems,
      );
    }
    return pass(this.name, `${publishable.length} publishable packages, all in the release`);
  },
};
