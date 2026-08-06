import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Nothing committed here may be a credential.
 *
 * The repository is meant to be public, and it now carries deployment
 * configuration: an nginx file, a systemd unit, a script that talks to a server.
 * None of that is sensitive — it opens no door and hides no key — but it is
 * exactly the kind of directory a private key ends up in one tired evening,
 * beside the config it belongs to.
 *
 * A secret pushed to a public repository is not fixed by deleting it: it has to
 * be rotated, because it is in the history, in every clone and in the mirrors
 * that scrape new commits within minutes. That asymmetry is why this runs on
 * every check rather than at review time.
 */

/** Names that are a credential whatever they contain. */
const FORBIDDEN_NAMES = [
  /^id_(rsa|dsa|ecdsa|ed25519)$/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /\.keystore$/,
  /\.jks$/,
  /^\.npmrc$/,
  /^\.netrc$/,
  /^credentials(\.json)?$/,
  /^service-account.*\.json$/,
  /^\.env(\..*)?$/,
];

/** Names the rules above catch but which are legitimate. */
const ALLOWED_NAMES = [/^\.env\.example$/];

/** Shapes that are a credential whatever file they sit in. */
const FORBIDDEN_CONTENT: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/-----BEGIN OPENSSH PRIVATE KEY-----/, 'an SSH private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'a GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bsk-(ant-)?[A-Za-z0-9_-]{32,}/, 'an API key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'a signed JWT'],
];

/** Generated or vendored files, where a match would be a coincidence. */
const SKIP_CONTENT = [/\.generated\./, /pnpm-lock\.yaml$/, /^tools\/check\/no-secrets\.ts$/];

export const noSecrets: Check = {
  name: 'no-secrets',
  enforces: 'No committed file may be a credential',
  async run() {
    const { stdout } = await run('git', ['ls-files', '-z'], {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024,
    });
    const files = stdout.split('\0').filter((entry) => entry !== '');

    const problems: string[] = [];
    let scanned = 0;

    for (const file of files) {
      const name = basename(file);

      if (
        FORBIDDEN_NAMES.some((pattern) => pattern.test(name)) &&
        !ALLOWED_NAMES.some((pattern) => pattern.test(name))
      ) {
        problems.push(
          `${file} is named like a credential. If it is one, it is already public: remove it, ` +
            `rotate the key, and add the pattern to .gitignore. Deleting the file does not ` +
            `remove it from the history.`,
        );
        continue;
      }

      if (SKIP_CONTENT.some((pattern) => pattern.test(file))) continue;

      // Text files only, and only their first stretch: a key or token appears at
      // the top of whatever holds it, and reading whole bundles is wasted work.
      const content = await readFile(join(repoRoot, file), 'utf8').catch(() => null);
      if (content === null) continue;
      scanned += 1;

      for (const [pattern, what] of FORBIDDEN_CONTENT) {
        if (pattern.test(content)) {
          problems.push(
            `${file} contains what looks like ${what}. Rotate it first — it is in the history, ` +
              `in every clone, and in whatever scraped the commit — then remove it.`,
          );
          break;
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} possible credential(s) committed`, problems);
    }
    return pass(this.name, `${scanned} tracked files, no credential`);
  },
};
