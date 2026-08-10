import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = join(repoRoot, 'conformance/manifest.json');
const FINGERPRINTS = join(repoRoot, 'conformance/suite-versions.json');

/**
 * The suite's version must move when the suite does.
 *
 * §12.3.1 makes the conformance suite the operational definition of
 * conformance. An implementer who says "passes the suite" is making a claim
 * that means nothing unless the suite can be named — and `suiteVersion` sat at
 * `1.0` while the case count went from 146 to 178, twice inside one working
 * session, which two outside implementers noticed and reported independently.
 * One of them wrote down the manifest's hash to have something to cite.
 *
 * A version number nobody is forced to change does not change. So this records
 * a fingerprint of the case set for each published `suiteVersion`: adding,
 * removing or renaming a case makes the current version's fingerprint stop
 * matching, and the only way through is to bump the version and record the new
 * one.
 *
 * The fingerprint covers case identity — ids, kinds and levels — not the
 * documents. Correcting a typo in a description does not force a version; a
 * case appearing, vanishing or changing what it claims to judge does.
 */
export const suiteVersionMoves: Check = {
  name: 'suite-version-moves',
  enforces: 'The conformance suite carries a version that moves when the case set does',
  async run() {
    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as {
      suiteVersion?: string;
      cases: { id: string; kind: string; level: string }[];
    };
    const version = manifest.suiteVersion;

    if (version === undefined) {
      return fail(this.name, 'the manifest declares no suiteVersion', [
        'An implementer reporting "passes the conformance suite" has to be able to say which one.',
      ]);
    }

    const fingerprint = createHash('sha256')
      .update(
        manifest.cases
          .map((entry) => `${entry.id}\t${entry.kind}\t${entry.level}`)
          .sort()
          .join('\n'),
      )
      .digest('hex')
      .slice(0, 16);

    const published = JSON.parse(await readFile(FINGERPRINTS, 'utf8')) as Record<string, string>;
    const recorded = published[version];

    if (recorded === undefined) {
      return fail(this.name, `suite ${version} has no recorded fingerprint`, [
        `Add "${version}": "${fingerprint}" to conformance/suite-versions.json.`,
      ]);
    }

    if (recorded !== fingerprint) {
      const previous = Object.keys(published).filter((key) => key !== version);
      return fail(this.name, `the case set changed under suite ${version}`, [
        `Suite ${version} was published with fingerprint ${recorded}; the cases now fingerprint ` +
          `${fingerprint}. A consumer citing "${version}" would be citing a different suite than ` +
          `the one they ran.`,
        `Bump suiteVersion in conformance/manifest.json and record the new fingerprint in ` +
          `conformance/suite-versions.json. Published versions stay: ${previous.join(', ')}.`,
      ]);
    }

    return pass(
      this.name,
      `suite ${version}, ${manifest.cases.length} cases, fingerprint ${fingerprint}`,
    );
  },
};
