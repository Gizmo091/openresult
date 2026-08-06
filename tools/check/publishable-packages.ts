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

    // `--filter @openresult/core` and friends, from the publish step only.
    const publishStep = workflow.slice(workflow.indexOf('name: Publish'));
    const published = new Set(
      [...publishStep.matchAll(/--filter\s+(@[\w-]+\/[\w-]+)/g)].map((match) => match[1] ?? ''),
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
