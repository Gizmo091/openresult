import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUITE = join(repoRoot, 'conformance');

interface Placement {
  participant: string;
  rank: number | null;
  result?: number;
}

/**
 * Every row of an expected ranking must name exactly one derived row.
 *
 * §8.5.7 says an element of the ordered list is a *selected result*, and the
 * suite states `{ participant, rank }` — which identifies a row only while a
 * competitor holds at most one result in the ranking. A standing gathering an
 * overall event and its sub-events has three rows per competitor, and where two
 * of them are unranked the pair repeats. The expectation then cannot tell a
 * correct implementation from one that emitted the same result twice and
 * dropped another: both produce the same `{ participant, rank }` sequence.
 *
 * Two implementers found this independently, from the spec and the suite alone,
 * and both said the same thing — the suite format should carry the result
 * index. It does, optionally, and this is what makes it required exactly where
 * it decides something.
 */
export const expectedRowsAreIdentifiable: Check = {
  name: 'expected-rows-are-identifiable',
  enforces: 'Every expected ranking row names one derived row and no other',
  async run() {
    const manifest = JSON.parse(await readFile(join(SUITE, 'manifest.json'), 'utf8')) as {
      cases: { id: string; path: string }[];
    };

    const problems: string[] = [];
    let rows = 0;

    for (const entry of manifest.cases) {
      const expected = JSON.parse(
        await readFile(join(SUITE, entry.path, 'expected.json'), 'utf8'),
      ) as { rankings?: Record<string, Placement[]> };

      for (const [rankingId, placements] of Object.entries(expected.rankings ?? {})) {
        const seen = new Set<string>();
        for (const placement of placements) {
          rows += 1;
          const key =
            placement.result !== undefined
              ? `#${placement.result}`
              : `${placement.participant}\t${placement.rank}`;
          if (seen.has(key)) {
            problems.push(
              `${entry.id}, ranking "${rankingId}": two rows are "${placement.participant}" at ` +
                `rank ${placement.rank} and nothing tells them apart, so this expectation cannot ` +
                `distinguish a correct implementation from one emitting the same result twice. ` +
                `Add "result": <index into results> to each row of this ranking.`,
            );
          }
          seen.add(key);
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} ambiguous expectation(s)`, problems);
    }
    return pass(this.name, `${rows} expected rows, each naming one derived row`);
  },
};
