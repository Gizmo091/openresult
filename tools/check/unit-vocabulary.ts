import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The examples must use the units §5.2.4 recommends.
 *
 * This check exists because the rule was wrong, not the corpus. §5.2.4 used to
 * give one flat list of twelve units, and fifteen of the twenty-one units in the
 * examples fell outside it — every one legitimately, because a count names what
 * it counts and a rate names a ratio. No closed vocabulary can enumerate what
 * people count.
 *
 * So the rule now depends on the kind, and this keeps the two together: a
 * physical quantity draws on a fixed list, a count names something, money is a
 * currency code. Rates are left alone: `W` and `bpm` are ratios whose
 * conventional unit carries no slash, and the first version of this check
 * flagged both.
 */
const CLOSED: Record<string, string[]> = {
  duration: ['s', 'ms', 'min', 'h'],
  distance: ['m', 'km', 'mi'],
  mass: ['kg', 'g', 'lb'],
  points: ['pt'],
  score: ['pt'],
  percentage: ['%'],
};

/** Names nothing, so it cannot be the unit of a count (spec §5.2.6). */
const DIMENSIONLESS = new Set(['n', '#', 'no', 'num', 'number', '']);

export const unitVocabulary: Check = {
  name: 'unit-vocabulary',
  enforces: 'Example units must follow the vocabulary each kind implies (spec §5.2.4, §5.2.6)',
  async run() {
    const problems: string[] = [];
    let inspected = 0;

    for await (const file of glob('examples/**/*.openresult.json', { cwd: repoRoot })) {
      const document = JSON.parse(await readFile(join(repoRoot, file), 'utf8')) as {
        measures?: { id: string; kind?: string; unit?: string }[];
      };

      for (const measure of document.measures ?? []) {
        const kind = measure.kind ?? '';
        const unit = measure.unit;
        if (unit === undefined) continue; // text and boolean carry none.
        inspected += 1;

        const closed = CLOSED[kind];
        if (closed !== undefined && !closed.includes(unit)) {
          problems.push(
            `${file}: "${measure.id}" is a ${kind} measured in "${unit}", which §5.2.4 does not ` +
              `list. Use one of ${closed.map((value) => `"${value}"`).join(', ')}, or widen the ` +
              `rule if the domain genuinely needs another.`,
          );
        }

        if (kind === 'count' && DIMENSIONLESS.has(unit.toLowerCase())) {
          problems.push(
            `${file}: "${measure.id}" counts "${unit}", which names nothing (§5.2.6). Name what ` +
              `is counted, or declare it as an attribute if it is an allocated identifier.`,
          );
        }

        // A rate is deliberately not checked. Many ratios have a conventional
        // one-word unit — `W`, `bpm`, `Hz` — and requiring a slash would ask
        // producers to write something worse than what the domain already says.
        // The two attempts that flagged `W` and `bpm` were the check being
        // wrong, not the corpus.

        if (kind === 'money' && !/^[A-Z]{3}$/.test(unit)) {
          problems.push(
            `${file}: "${measure.id}" is money in "${unit}", which is not an ISO 4217 code. ` +
              `A consumer grouping by currency cannot match a symbol against a code.`,
          );
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} unit(s) outside the vocabulary`, problems);
    }
    return pass(this.name, `${inspected} units follow the vocabulary for their kind`);
  },
};
