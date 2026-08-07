import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { documentsExemptFromCorpusRules } from './conformance-documents.ts';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');

/**
 * The examples teach. When they contradict the text, the text loses.
 *
 * §5.3 says an attribute is a descriptive property, neither measured nor
 * ranked. Four reference examples declared the bib, the kart number, the race
 * number and the car number as **measures** — `kind: "count"`,
 * `betterWhen: "none"`. Reasoning from §5.3 — a lane is allocated rather than
 * observed — gives an attribute, and the corpus then said the opposite. It is
 * the sharpest interoperability divergence the format has had, and it was
 * backed by our own examples: two producers put the same datum in two different
 * places, and a consumer composing columns from `measureOrder`/`attributeOrder`
 * renders them differently.
 *
 * §5.3.5 now settles it. This checks the corpus obeys.
 *
 * The tell is the unit. A count must name what it counts — `core`, `match`,
 * `stop`, `person` — and every one of the four carried `"n"`, which names
 * nothing. That is a heuristic, not a theorem: a genuine tally could be declared
 * with a dimensionless unit. It fails in the useful direction, because the fix
 * for a false positive is to name what is being counted, which the example
 * wanted anyway.
 */
const DIMENSIONLESS = new Set(['n', '#', 'no', 'num', 'number', '']);

export const allocatedNumbersAreAttributes: Check = {
  name: 'allocated-numbers',
  enforces: 'An allocated identifier is an attribute, never a measure (spec §5.3.5)',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const problems: string[] = [];
    const exempt = await documentsExemptFromCorpusRules();
    let inspected = 0;

    if (!spec.includes('**§5.3.5**')) {
      problems.push(
        '§5.3.5 is gone. Either the rule was withdrawn — in which case this check should go ' +
          'with it — or a rule the corpus is held to has been lost.',
      );
    }

    // The conformance suite is a corpus too, and the rule it is held to is the
    // same one. Three of its own documents modelled a bib as a measure — the
    // very thing §5.3.5 forbids — because this only ever swept examples/.
    for await (const file of glob('{examples/**/*.openresult.json,conformance/**/document.json}', {
      cwd: repoRoot,
    })) {
      if (exempt.has(file)) continue;
      const document = JSON.parse(await readFile(join(repoRoot, file), 'utf8')) as {
        measures?: { id: string; kind?: string; unit?: string; betterWhen?: string }[];
      };

      for (const measure of document.measures ?? []) {
        inspected += 1;
        if (measure.kind !== 'count') continue;
        if (measure.betterWhen !== 'none') continue;
        if (!DIMENSIONLESS.has((measure.unit ?? '').toLowerCase())) continue;

        problems.push(
          `${file} declares "${measure.id}" as a measure counting "${measure.unit ?? ''}" that ` +
            `ranks nothing. A count names what it counts; this one names nothing, which is the ` +
            `shape of an allocated identifier. Declare it as an attribute of type "number" ` +
            `(§5.3.5), or give the unit a name if it really is a tally.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(
        this.name,
        `${problems.length} measure(s) that look allocated, not observed`,
        problems,
      );
    }
    return pass(this.name, `${inspected} measures inspected, none an allocated identifier`);
  },
};
