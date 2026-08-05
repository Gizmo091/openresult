import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listRankings, parse, rank } from '../../sdk/js/packages/core/src/index.js';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The presentation layer must be ignorable — entirely.
 *
 * This is the property the three-layer design rests on, and the one that would
 * erode most quietly: a view starts reading a hint, then depends on it, and one
 * day a document without hints ranks differently. Nobody would notice until a
 * producer that never wrote hints complained about the order.
 *
 * So every published document is ranked twice, with and without the layer, and
 * the two must agree.
 */
export const presentationOptional: Check = {
  name: 'presentation-optional',
  enforces: 'The presentation layer is non-normative — removing it changes no ranking',
  async run() {
    const problems: string[] = [];
    let compared = 0;
    let carryingHints = 0;

    for await (const file of glob(
      ['examples/**/*.openresult.json', 'conformance/**/document.json'],
      { cwd: repoRoot },
    )) {
      const source = await readFile(join(repoRoot, file), 'utf8');

      let document;
      try {
        document = parse(source);
      } catch {
        // Conformance holds documents that deliberately do not parse.
        continue;
      }

      const stripped = parse(source);
      delete stripped.presentation;
      if (document.presentation !== undefined) carryingHints += 1;

      for (const ranking of listRankings(document)) {
        compared += 1;

        const withHints = rank(document, ranking.id).map((entry) => [
          entry.participant.id,
          entry.rank,
        ]);
        const without = rank(stripped, ranking.id).map((entry) => [
          entry.participant.id,
          entry.rank,
        ]);

        if (JSON.stringify(withHints) !== JSON.stringify(without)) {
          problems.push(
            `${file} · ranking "${ranking.id}" changes when the presentation layer is removed.\n` +
              `        with hints: ${JSON.stringify(withHints)}\n` +
              `        without:    ${JSON.stringify(without)}`,
          );
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, 'a presentation hint is affecting a ranking', problems);
    }
    return pass(
      this.name,
      `${compared} rankings unchanged without hints (${carryingHints} documents carry them)`,
    );
  },
};
