import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validate } from '@openresult/validate';

/**
 * The snippets on /produce/ must actually produce a valid document.
 *
 * They are the first code anyone runs, on the page that claims a JSON encoder is
 * the only dependency. A snippet that does not compile, or that emits something
 * the validator rejects, refutes the claim in front of the person deciding
 * whether to adopt the format.
 *
 * Each language is run if its toolchain is on the machine and skipped otherwise,
 * so this stays useful on a laptop without Go and thorough in CI.
 */

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

async function available(command: string, args: string[]): Promise<boolean> {
  return run(command, args)
    .then(() => true)
    .catch(() => false);
}

/** The snippets, read from the page rather than copied — copies drift. */
async function snippets(): Promise<Map<string, string>> {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(join(here, '..', 'src', 'produce.ts'), 'utf8'),
  );

  const found = new Map<string, string>();
  for (const match of source.matchAll(
    /id: '([a-z]+)',\s*\n\s*label: '[^']+',\s*\n\s*code: `([\s\S]*?)`,\n {2}\},/g,
  )) {
    const [, id = '', code = ''] = match;
    // The snippets are template literals, so `${` would interpolate; none do,
    // but backslash escapes are still processed by the parser.
    found.set(id, code.replaceAll('\\`', '`').replaceAll('\\\\', '\\'));
  }
  return found;
}

let work: string;
let code: Map<string, string>;

// Resolved before the suite is defined: `it.skipIf` is evaluated during
// collection, where `await` is not available.
const hasPhp = await available('php', ['--version']);
const hasGo = await available('go', ['version']);

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), 'openresult-snippets-'));
  code = await snippets();
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

function expectValid(stdout: string): void {
  const document = JSON.parse(stdout) as unknown;
  const report = validate(document);
  expect(report.errors).toEqual([]);
  // The document is minimal, so it should be clean rather than merely legal.
  expect(report.warnings.map((entry) => entry.code)).toEqual([]);
}

describe('the /produce/ snippets emit a valid document', () => {
  it('has one snippet per advertised language', async () => {
    expect([...code.keys()].sort()).toEqual(['go', 'javascript', 'php', 'python']);
  });

  it('python', async () => {
    const file = join(work, 'snippet.py');
    await writeFile(file, code.get('python') ?? '', 'utf8');
    const { stdout } = await run('python3', [file]);
    expectValid(stdout);
  });

  it('javascript', async () => {
    const file = join(work, 'snippet.mjs');
    // `document` is a browser global; under Node it is an ordinary binding.
    await writeFile(file, code.get('javascript') ?? '', 'utf8');
    const { stdout } = await run('node', [file]);
    expectValid(stdout);
  });

  it.skipIf(!hasPhp)('php', async () => {
    const file = join(work, 'snippet.php');
    await writeFile(file, code.get('php') ?? '', 'utf8');
    const { stdout } = await run('php', [file]);
    expectValid(stdout);
  });

  it.skipIf(!hasGo)('go', async () => {
    const file = join(work, 'snippet.go');
    await writeFile(file, code.get('go') ?? '', 'utf8');
    const { stdout } = await run('go', ['run', file]);
    expectValid(stdout);
  });
});
