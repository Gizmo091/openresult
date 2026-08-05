import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const SEMANTICS = join(repoRoot, 'sdk/js/packages/core/src/semantics.ts');

/**
 * The default exclusion set is stated three times, and all three must agree.
 *
 * §7.2.1 gives it as a table column, §8.4.2 repeats it as a list, and the core
 * package holds it as an array. Adding `notClassified` to the first and the
 * third, and forgetting the second, made two conforming consumers rank the same
 * document differently — the one thing §8.5.6 forbids.
 *
 * The duplication is deliberate: an implementer reading §8.4 should not have to
 * jump back to §7.2 to learn which statuses are excluded. Duplication that
 * nobody checks is how the previous defect happened, so it is checked.
 */
export const defaultExclusionsAgree: Check = {
  name: 'default-exclusions',
  enforces: 'Every statement of the default exclusion set must name the same statuses',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const semantics = await readFile(SEMANTICS, 'utf8');

    const table = fromStatusTable(spec);
    const prose = fromDefaultSetSentence(spec);
    const code = fromCode(semantics);

    if (table === null) return fail(this.name, 'cannot read §7.2.1', ['status table not found']);
    if (prose === null)
      return fail(this.name, 'cannot read §8.4.2', ['default-set sentence not found']);
    if (code === null) return fail(this.name, 'cannot read the core package', ['array not found']);

    const problems = [
      ...describe('§7.2.1 (table)', table, '§8.4.2 (prose)', prose),
      ...describe('§8.4.2 (prose)', prose, 'the core package', code),
    ];

    if (problems.length > 0) {
      return fail(this.name, 'the three statements disagree', problems);
    }
    return pass(this.name, `${table.size} statuses, stated three times, all agreeing`);
  },
};

function describe(
  leftName: string,
  left: Set<string>,
  rightName: string,
  right: Set<string>,
): string[] {
  const problems: string[] = [];

  const onlyLeft = [...left].filter((value) => !right.has(value));
  const onlyRight = [...right].filter((value) => !left.has(value));

  if (onlyLeft.length > 0) {
    problems.push(
      `${leftName} excludes ${onlyLeft.map((v) => `"${v}"`).join(', ')} by default; ` +
        `${rightName} does not. Two consumers would rank the same document differently.`,
    );
  }
  if (onlyRight.length > 0) {
    problems.push(
      `${rightName} excludes ${onlyRight.map((v) => `"${v}"`).join(', ')} by default; ` +
        `${leftName} does not. Two consumers would rank the same document differently.`,
    );
  }

  return problems;
}

/** The statuses marked excluded in the §7.2.1 table. */
function fromStatusTable(spec: string): Set<string> | null {
  // Several tables start with "| Value"; the one wanted is the only one with
  // an "Excluded by default" column.
  const heading = spec.indexOf('| Excluded by default |');
  if (heading === -1) return null;

  const found = new Set<string>();
  for (const line of spec.slice(spec.lastIndexOf('\n| Value', heading) + 1).split('\n')) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').map((cell) => cell.trim());
    const status = (cells[1] ?? '').replace(/`/g, '');
    const excluded = (cells[3] ?? '').toLowerCase();
    if (status !== '' && excluded === 'yes') found.add(status);
  }
  return found;
}

/** The list §8.4.2 spells out. */
function fromDefaultSetSentence(spec: string): Set<string> | null {
  const start = spec.indexOf('**§8.4.2**');
  if (start === -1) return null;
  // To the end of the paragraph, not the first full stop — section references
  // like "§7.2.1" contain them.
  const paragraph = spec.slice(start, spec.indexOf('\n\n', start));
  return new Set(
    [...paragraph.matchAll(/`([a-zA-Z]+)`/g)]
      .map((match) => match[1] ?? '')
      // The sentence names the statuses it excludes, and the two it does not.
      .filter((status) => status !== 'finished' && status !== 'bye'),
  );
}

/** The array the core package derives rankings from. */
function fromCode(source: string): Set<string> | null {
  const declaration = /DEFAULT_EXCLUDED_STATUSES[^=]*=\s*\[([^\]]+)\]/.exec(source);
  if (declaration === null) return null;
  return new Set([...(declaration[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1] ?? ''));
}
