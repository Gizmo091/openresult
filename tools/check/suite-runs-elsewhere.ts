import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass, skip } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNNER = join(repoRoot, 'conformance/runner.py');

/**
 * The suite must run from a language it was not written in.
 *
 * "Language-agnostic" was a property of the design and not a fact about the
 * world: one runner had ever read the suite, written by the same people as the
 * cases, in the same language as the reference implementation. A format
 * declares itself implementable by others; a suite only readable by its author
 * proves nothing about that.
 *
 * `conformance/runner.py` drives the minimal reader from the manifest. It
 * claims the ranking level and judges every case that level can judge — the
 * ones stating a derived ranking, valid and invalid alike, since §11.3.1
 * requires a consumer to read a non-conforming document rather than refuse it.
 *
 * It cannot judge a case that states only diagnostics, and it says so instead
 * of reporting a pass. That is the same failure this project has already had
 * once, where a skip was counted as a pass and two cases were never run.
 */
export const suiteRunsElsewhere: Check = {
  name: 'suite-runs-elsewhere',
  enforces: 'The conformance suite must run from a second language, not only its own',
  async run() {
    const python = await detectPython();
    if (python === null) {
      return skip(this.name, 'no python3 on this machine');
    }

    const { stdout } = await run(python, [RUNNER], { cwd: repoRoot }).catch(
      (error: { stdout?: string; stderr?: string }) => ({
        stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`,
      }),
    );

    const summary = /(\d+)\/(\d+) cases passed, (\d+) rankings compared/.exec(stdout);
    if (summary === null) {
      return fail(this.name, 'the second runner said nothing this check understands', [
        `Expected a summary line from conformance/runner.py; got:\n${stdout.slice(0, 400)}`,
      ]);
    }

    const [, passed = '0', total = '0', rankings = '0'] = summary;
    if (passed !== total || stdout.includes('FAILED')) {
      return fail(this.name, `${Number(total) - Number(passed)} case(s) fail in Python`, [
        stdout
          .split('\n')
          .filter((line) => line.trim().startsWith('✗') || line.trim().startsWith('ranking'))
          .slice(0, 10)
          .join('\n'),
      ]);
    }

    return pass(
      this.name,
      `${passed}/${total} cases pass from Python, ${rankings} rankings compared`,
    );
  },
};

async function detectPython(): Promise<string | null> {
  for (const candidate of ['python3', 'python']) {
    try {
      await run(candidate, ['--version']);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}
