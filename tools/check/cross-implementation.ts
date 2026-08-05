import { execFile } from 'node:child_process';
import { glob, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listRankings, parse, rank } from '../../sdk/js/packages/core/src/index.js';
import { type Check, fail, pass, skip } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const READER = join(repoRoot, 'docs/examples/minimal_reader.py');

/**
 * Two implementations, one answer.
 *
 * The reference implementation is TypeScript; the minimal reader is Python,
 * written from the specification alone. If they disagree about who won, the
 * specification is ambiguous — and an ambiguous specification is the failure
 * mode this project exists to avoid.
 *
 * This is the only check that proves the format is portable rather than merely
 * documented.
 */
export const crossImplementation: Check = {
  name: 'cross-implementation',
  enforces: 'Two conforming consumers must derive identical rankings (spec §8.5.6)',
  async run() {
    const python = await detectPython();
    if (python === null) {
      return skip(this.name, 'python3 not available — cross-implementation check skipped');
    }

    const problems: string[] = [];
    let compared = 0;

    for await (const file of glob('examples/**/*.openresult.json', { cwd: repoRoot })) {
      const absolute = join(repoRoot, file);
      const document = parse(await readFile(absolute, 'utf8'));

      for (const ranking of listRankings(document)) {
        compared += 1;

        const reference = rank(document, ranking.id).map((entry) => ({
          participant: entry.participant.id,
          rank: entry.rank,
        }));

        const { stdout } = await run(python, [READER, '--json', absolute, ranking.id]);
        const other = JSON.parse(stdout) as typeof reference;

        // Sequence comparison: the order is what verifies sort stability.
        if (JSON.stringify(other) !== JSON.stringify(reference)) {
          problems.push(
            `${file} · ranking "${ranking.id}": the two implementations disagree.\n` +
              `        reference: ${JSON.stringify(reference)}\n` +
              `        minimal:   ${JSON.stringify(other)}`,
          );
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, 'implementations disagree', problems);
    }
    return pass(this.name, `${compared} rankings identical across two implementations`);
  },
};

async function detectPython(): Promise<string | null> {
  try {
    await run('python3', ['--version']);
    return 'python3';
  } catch {
    return null;
  }
}
