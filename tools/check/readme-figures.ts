import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const README = join(repoRoot, 'README.md');
const MANIFEST = join(repoRoot, 'conformance/manifest.json');
const REGISTRY = join(repoRoot, 'tools/check/index.ts');

/**
 * The front page must not quote a figure that has stopped being true.
 *
 * A README is the one document nothing exercises. This one claimed 37
 * conformance cases against 128, eight repository checks against twenty-six,
 * and 19 example documents against 22 — every one of them true when written.
 * A reader has no way to tell which numbers are current, so all of them stop
 * being evidence and become decoration.
 *
 * Counting is the whole job, so the check does the counting: it fails with the
 * figure to write rather than asking anyone to go and find it.
 */

const WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
  'Twenty-one',
  'Twenty-two',
  'Twenty-three',
  'Twenty-four',
  'Twenty-five',
  'Twenty-six',
  'Twenty-seven',
  'Twenty-eight',
  'Twenty-nine',
  'Thirty',
];

export const readmeFigures: Check = {
  name: 'readme-figures',
  enforces: 'Figures quoted on the front page must be the current ones',
  async run() {
    const readme = await readFile(README, 'utf8');

    const cases = (JSON.parse(await readFile(MANIFEST, 'utf8')) as { cases: unknown[] }).cases
      .length;

    // The registry lists each check once in its array, after importing it.
    const registry = await readFile(REGISTRY, 'utf8');
    const listed = /const CHECKS: Check\[\] = \[([\s\S]*?)\n\];/.exec(registry);
    const checks =
      listed === null ? 0 : (listed[1] ?? '').split(',').filter((n) => n.trim()).length;

    let documents = 0;
    const domains = new Set<string>();
    for await (const file of glob('examples/**/*.openresult.json', { cwd: repoRoot })) {
      documents += 1;
      const domain = file.split('/')[1];
      // `edge-cases` collects documents that exercise the format's corners; it
      // is not a domain the format was taken to.
      if (domain !== undefined && domain !== 'edge-cases') domains.add(domain);
    }

    const problems: string[] = [];

    const expect = (found: RegExp, actual: string, what: string): void => {
      const match = found.exec(readme);
      if (match === null) {
        problems.push(`The sentence quoting ${what} is not where this check looks for it.`);
      } else if (match[1] !== actual) {
        problems.push(`README says ${match[1]} ${what}; there are ${actual}.`);
      }
    };

    expect(/conformance suite, ([\d]+) cases/, String(cases), 'conformance cases');
    expect(/^([\w-]+) repository checks run on every change/m, WORDS[checks] ?? '?', 'checks');
    expect(/\| ([\d]+) realistic documents/, String(documents), 'example documents');
    expect(
      /realistic documents across ([\w-]+) unlike domains/,
      (WORDS[domains.size] ?? '?').toLowerCase(),
      'domains',
    );

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} figure(s) out of date`, problems);
    }
    return pass(
      this.name,
      `${cases} cases, ${checks} checks, ${documents} documents, ${domains.size} domains`,
    );
  },
};
