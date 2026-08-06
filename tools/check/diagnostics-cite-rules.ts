import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const CATALOGUE = join(repoRoot, 'sdk/js/packages/validate/src/diagnostics.ts');
const PUBLISHED = join(repoRoot, 'conformance/published-codes.json');

/**
 * Every diagnostic must cite a rule that exists.
 *
 * The whole design rests on rules being citable: §N.M.K identifiers are stable
 * across editorial revisions precisely so a diagnostic can point at one. Three
 * warnings pointed at "§12.2" instead — a section, not a rule — which tells a
 * producer that something is wrong and gives them a page to search rather than a
 * sentence to read. It is a real gap, and worth closing.
 *
 * This checks both directions of the same failure: a citation that names no
 * rule, and a citation that is only a section number.
 */
export const diagnosticsCiteRules: Check = {
  name: 'diagnostics-cite-rules',
  enforces: 'A diagnostic must cite a rule that exists, not a section',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const catalogue = await readFile(CATALOGUE, 'utf8');

    // Rules are written `**§8.1.1**` in most sections and `**§8.5.2 — Sort.**`
    // in the derivation algorithm, so the identifier is matched without
    // requiring what follows it — the same shape `spec-coherence` uses.
    const declared = new Set(
      [...spec.matchAll(/\*\*§(\d+\.\d+\.\d+)/g)].map((match) => match[1] ?? ''),
    );

    const problems: string[] = [];
    const codes: string[] = [];
    let checked = 0;

    for (const match of catalogue.matchAll(/'(OR-\d+)':\s*\{[^}]*rule:\s*'([^']*)'/g)) {
      const [, code = '', citation = ''] = match;
      checked += 1;
      codes.push(code);

      const rule = /^spec §(\d+\.\d+\.\d+)$/.exec(citation);
      if (rule === null) {
        problems.push(
          `${code} cites "${citation}", which is not a rule identifier. A producer reading this ` +
            `diagnostic gets a section to search instead of a sentence to read.`,
        );
        continue;
      }

      if (!declared.has(rule[1] ?? '')) {
        problems.push(
          `${code} cites §${rule[1]}, which the specification does not declare. Either the rule ` +
            `was renumbered and this was not, or the citation was never right.`,
        );
      }
    }

    problems.push(...checkACorrectionIsCompulsory(catalogue));
    problems.push(...(await checkCodesArePermanent(codes)));

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} problem(s) in the catalogue`, problems);
    }
    return pass(this.name, `${checked} diagnostics: rule cited, location and correction carried`);
  },
};

/**
 * §12.1.3 — a diagnostic carries a location, the rule in plain language, and at
 * least one concrete correction.
 *
 * The correction is held by the compiler: `diagnostic()` takes it as a required
 * parameter, so a call that omits it does not build. This checks the signature
 * has not quietly grown a `?` back — the first attempt at this check read the
 * call sites with a regular expression instead, passed, and had missed the one
 * call it was written to find.
 */
function checkACorrectionIsCompulsory(catalogue: string): string[] {
  const signature = /export function diagnostic\([^)]*\)/s.exec(catalogue);
  if (signature === null) {
    return ['diagnostic() is not where this check expects it, so nothing here can be trusted.'];
  }
  if (!/\n\s*suggestion: string,/.test(signature[0])) {
    return [
      `diagnostic() no longer requires a correction. §12.1.3 asks every diagnostic for the ` +
        `location, the rule in plain language, and at least one concrete thing to change; an ` +
        `optional parameter makes the third one advice.`,
    ];
  }
  return [];
}

/**
 * §12.2.1 — a published code is permanent.
 *
 * Removing or reassigning one is a breaking change: a consumer keyed on OR-908
 * does not find out that it now means something else until it acts on it. A
 * ratchet, like `rule-coverage`: what has been published stays published.
 */
async function checkCodesArePermanent(codes: string[]): Promise<string[]> {
  const published = JSON.parse(await readFile(PUBLISHED, 'utf8')) as {
    note: string;
    codes: string[];
  };
  const current = new Set(codes);

  const withdrawn = published.codes.filter((code) => !current.has(code));
  if (withdrawn.length > 0) {
    return [
      `${withdrawn.join(', ')} ${withdrawn.length === 1 ? 'was' : 'were'} published and ` +
        `${withdrawn.length === 1 ? 'no longer exists' : 'no longer exist'}. A code is permanent ` +
        `(§12.2.1): a consumer keyed on it finds out by acting on the wrong thing. Keep it, or ` +
        `accept that this is a breaking change.`,
    ];
  }

  const merged = [...new Set([...published.codes, ...codes])].sort();
  if (merged.length !== published.codes.length) {
    await writeFile(PUBLISHED, `${JSON.stringify({ ...published, codes: merged }, null, 2)}\n`);
  }
  return [];
}
