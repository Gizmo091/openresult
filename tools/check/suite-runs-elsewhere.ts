import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass, skip } from './types.ts';

const run = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Each runner: the command to look for, and the script it runs. */
const RUNNERS = [
  { language: 'Python', commands: ['python3', 'python'], script: 'conformance/runner.py' },
  { language: 'PHP', commands: ['php'], script: 'conformance/runner.php' },
];

/**
 * The suite must run from a language it was not written in.
 *
 * "Language-agnostic" was a property of the design and not a fact about the
 * world: one runner had ever read the suite, written by the same people as the
 * cases, in the same language as the reference implementation. A format
 * declares itself implementable by others; a suite only readable by its author
 * proves nothing about that.
 *
 * Two runners answer it now, in Python and in PHP. Each claims the ranking
 * level and judges every case that level can judge — the ones stating a derived
 * ranking, valid and invalid alike, since §11.3.1 requires a consumer to read a
 * non-conforming document rather than refuse it.
 *
 * Neither can judge a case that states only diagnostics, and both say so
 * instead of reporting a pass. That is the same failure this project has
 * already had once, where a skip was counted as a pass and two cases were never
 * run.
 *
 * What this does not prove is independent authorship, which is what v2's exit
 * criterion asks for. Three languages by one author tests whether the
 * specification is precise enough to reimplement; it does not test whether it
 * is clear enough for a stranger.
 */
export const suiteRunsElsewhere: Check = {
  name: 'suite-runs-elsewhere',
  enforces: 'The conformance suite must run from a second language, not only its own',
  async run() {
    const summaries: string[] = [];
    const problems: string[] = [];
    const absent: string[] = [];
    let ran = 0;

    for (const runner of RUNNERS) {
      const command = await detect(runner.commands);
      if (command === null) {
        // A contributor's laptop may reasonably lack PHP, and failing there
        // would be hostile. CI is where this invariant is authoritative, and a
        // runner quietly dropping out of it would leave the check reporting a
        // pass for half the work — the failure this whole file is about.
        absent.push(runner.language);
        continue;
      }
      ran += 1;

      const { stdout } = await run(command, [join(repoRoot, runner.script)], {
        cwd: repoRoot,
      }).catch((error: { stdout?: string; stderr?: string }) => ({
        stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`,
      }));

      const summary = /(\d+)\/(\d+) cases passed, (\d+) rankings compared/.exec(stdout);
      if (summary === null) {
        problems.push(
          `${runner.language} said nothing this check understands:\n${stdout.slice(0, 300)}`,
        );
        continue;
      }

      const [, passed = '0', total = '0', rankings = '0'] = summary;
      if (passed !== total || stdout.includes('FAILED')) {
        problems.push(
          `${runner.language}: ${Number(total) - Number(passed)} case(s) fail.\n` +
            stdout
              .split('\n')
              .filter((line) => line.trim().startsWith('✗') || line.trim().startsWith('ranking'))
              .slice(0, 8)
              .join('\n'),
        );
        continue;
      }
      summaries.push(`${runner.language} ${passed}/${total}, ${rankings} rankings`);
    }

    if (absent.length > 0 && process.env['CI'] !== undefined) {
      problems.push(
        `${absent.join(' and ')} missing from the CI image, so ${
          absent.length === 1 ? 'that runner' : 'those runners'
        } did not run. Half a check reporting a pass is how a suite stops being ` +
          `language-agnostic without anyone noticing. Install ${absent.join(' and ')} in the ` +
          `workflow, or remove the runner from this check and say why.`,
      );
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} problem(s) running the suite elsewhere`, problems);
    }
    if (ran === 0) {
      return skip(this.name, 'neither python3 nor php on this machine');
    }
    return pass(
      this.name,
      summaries.join(' · ') + (absent.length > 0 ? ` (${absent.join(', ')} absent here)` : ''),
    );
  },
};

async function detect(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await run(candidate, ['--version']);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}
