import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const READER = join(repoRoot, 'docs/examples/minimal_reader.py');
const ROADMAP = join(repoRoot, 'docs/ROADMAP.md');

/**
 * The minimal reader must stay small enough to read in one sitting.
 *
 * It is the v1 exit criterion that says the format is implementable: a whole
 * conforming consumer, in a language the reference is not written in, short
 * enough that someone can check it against the specification line by line. A
 * reader nobody can read proves nothing.
 *
 * The criterion said two hundred lines and nothing counted them, so it drifted
 * to two hundred and sixty-seven while every addition was justified on its own.
 * That is how a stated goal becomes decoration.
 *
 * Two figures, because they answer different questions. The reader is what
 * implements the specification. `main()` is a command-line front end — argument
 * parsing and a printed table — which the criterion was never about, and which
 * would otherwise make the number depend on how nicely the demo prints.
 */

/** Code lines the reader may carry, excluding its command-line front end. */
const CEILING = 220;

export const minimalReaderSize: Check = {
  name: 'minimal-reader-size',
  enforces: 'The minimal reader stays readable in one sitting, with no dependency',
  async run() {
    const source = await readFile(READER, 'utf8');
    const lines = source.split('\n');

    let inFrontEnd = false;
    let reader = 0;
    let frontEnd = 0;

    for (const line of lines) {
      if (/^def main\b/.test(line)) inFrontEnd = true;
      const code = line.trim().length > 0 && !line.trim().startsWith('#');
      if (!code) continue;
      if (inFrontEnd) frontEnd += 1;
      else reader += 1;
    }

    const problems: string[] = [];

    if (reader > CEILING) {
      problems.push(
        `The reader is ${reader} code lines against a ceiling of ${CEILING}. Either the addition ` +
          `belongs in the reference implementation rather than here, or the specification grew ` +
          `something that costs every implementer this much — in which case raise the ceiling in ` +
          `this file and say in docs/ROADMAP.md what grew it.`,
      );
    }

    // The other half of the criterion: no dependency. A reader that needs a
    // package is not evidence that the format can be read from the document
    // alone — it is evidence that somebody solved the hard part already.
    const STANDARD = new Set(['json', 'sys', 'decimal', 'math', 're', 'itertools', 'functools']);
    for (const match of source.matchAll(/^(?:import|from) (\w+)/gm)) {
      const module = match[1] ?? '';
      if (!STANDARD.has(module)) {
        problems.push(
          `The reader imports "${module}", which is not in the standard library it is allowed. ` +
            `The criterion is a reader with no dependency: one that needs a package proves that ` +
            `somebody else solved the hard part, not that the format can be read.`,
        );
      }
    }

    // The figure lives in two places, and a ceiling nobody publishes is a
    // private target rather than a criterion.
    const roadmap = await readFile(ROADMAP, 'utf8');
    if (!roadmap.includes(`${CEILING} lines`)) {
      problems.push(
        `docs/ROADMAP.md does not state the ${CEILING}-line ceiling this check enforces, so the ` +
          `exit criterion and the check disagree about what has to be true.`,
      );
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} problem(s) with the minimal reader`, problems);
    }
    return pass(
      this.name,
      `${reader}/${CEILING} code lines, plus ${frontEnd} for the command line, no dependency`,
    );
  },
};
