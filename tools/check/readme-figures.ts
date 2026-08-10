import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const README = join(repoRoot, 'README.md');
const MANIFEST = join(repoRoot, 'conformance/manifest.json');
const REGISTRY = join(repoRoot, 'tools/check/index.ts');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const SITE = join(repoRoot, 'site/index.html');

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

/** Spelled-out figures the README uses. Beyond this, `word()` says so rather
 *  than answering "?" — a check that has quietly stopped counting reads exactly
 *  like one that counted and found nothing wrong. */
const WORDS: string[] = [
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
  'Thirty-one',
  'Thirty-two',
  'Thirty-three',
  'Thirty-four',
  'Thirty-five',
  'Thirty-six',
  'Thirty-seven',
  'Thirty-eight',
  'Thirty-nine',
  'Forty',
];

/** The word for a figure, or a sentence saying the list ran out. */
function word(count: number): string {
  return WORDS[count] ?? `(no word for ${count} — extend WORDS in this file)`;
}

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

    // The specification's own status line decides. A front page that still says
    // draft after 1.0 was tagged is the same defect as a stale count, and it is
    // the one a reader believes first.
    const status = /^\*\*Status\*\*: (\w+)/m.exec(await readFile(SPEC, 'utf8'));
    if (status?.[1] === 'Final') {
      for (const [where, text] of [
        ['README.md', readme],
        ['site/index.html', await readFile(SITE, 'utf8')],
      ] as const) {
        if (/\bdraft\b/i.test(text.replace(/draft 2020-12/gi, '').replace(/"draft"/g, ''))) {
          problems.push(
            `${where} still calls the format a draft, and the specification says Final. That is ` +
              `the first thing a reader believes and the last thing anyone thinks to change.`,
          );
        }
      }
    }

    expect(/conformance suite, ([\d]+) cases/, String(cases), 'conformance cases');
    expect(/^([\w-]+) repository checks run on every change/m, word(checks), 'checks');
    expect(/\| ([\d]+) realistic documents/, String(documents), 'example documents');
    expect(
      /realistic documents across ([\w-]+) unlike domains/,
      word(domains.size).toLowerCase(),
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
