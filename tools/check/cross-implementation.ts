import { execFile } from 'node:child_process';
import { glob, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  formatValue,
  listRankings,
  measure,
  parse,
  rank,
} from '../../sdk/js/packages/core/src/index.js';
import { type Check, fail, pass, skip } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const READER = join(repoRoot, 'docs/examples/minimal_reader.py');
/** The units §5.2.5 governs. */
const TIME_UNITS = new Set(['s', 'ms', 'min', 'h']);

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
 *
 * It reads the conformance corpus as well as the examples, and that is not a
 * detail. The examples are realistic documents, so they exercise what producers
 * commonly write; the conformance cases exercise the rules nobody writes by
 * accident. `ties: "resolved"` was added to the specification, to the reference
 * implementation, and to no example — the minimal reader ignored it, and the
 * examples-only sweep reported forty agreeing rankings while the two
 * implementations ordered a swim-off differently.
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

    const files: string[] = [];
    for await (const file of glob('examples/**/*.openresult.json', { cwd: repoRoot })) {
      files.push(file);
    }
    // Only the valid cases: an invalid document has no agreed ordering to
    // compare, which is the point of it being invalid.
    for await (const file of glob('conformance/valid/**/document.json', { cwd: repoRoot })) {
      files.push(file);
    }

    for (const file of files.sort()) {
      const absolute = join(repoRoot, file);
      const document = parse(await readFile(absolute, 'utf8'));

      for (const ranking of listRankings(document)) {
        compared += 1;

        const reference = rank(document, ranking.id).map((entry) => ({
          participant: entry.participant.id,
          rank: entry.rank,
          // Rendered durations as well as positions. Agreeing on the order and
          // disagreeing on what is printed is still a divergence: the reference
          // rendered a duration as `2:12.88` and the minimal reader as
          // `132.88 s`, and nothing noticed, because the specification
          // described neither. §5.2.5 now does, so the two must agree.
          //
          // What the specification actually normalises: durations (§5.2.5) and
          // bounded scores (§5.2.7). Everything else about display is left to
          // the consumer — thousands separators and default decimals follow the
          // locale, and a reader in France should see `1 671,0` where one in the
          // US sees `1,671.0`. Comparing those would enforce a rule the
          // specification does not make.
          display: Object.fromEntries(
            Object.keys(entry.values)
              .sort()
              .flatMap((id) => {
                const definition = measure(document, id);
                if (definition === undefined) return [];

                const isDuration =
                  definition.kind === 'duration' && TIME_UNITS.has(definition.unit ?? '');
                const isBoundedScore =
                  definition.max !== undefined &&
                  (definition.kind === 'score' || definition.kind === 'points');

                if (!isDuration && !isBoundedScore) return [];
                return [[id, formatValue(entry.values[id]!, definition)]];
              }),
          ),
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
