import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');

/**
 * Internal coherence of the specification.
 *
 * Two outside readers found six defects that were all the same mistake: a rule
 * added without checking what it contradicted elsewhere. A diagnostic code
 * defined twice, a rule with no code, sections out of order, an index that had
 * stopped matching its own document.
 *
 * None of these is catchable by testing the code against the specification —
 * they are the specification disagreeing with itself. Only reading it as a
 * whole finds them, which is exactly what nobody does on the fourth edit.
 */
export const specCoherence: Check = {
  name: 'spec-coherence',
  enforces: 'The specification must not contradict itself',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const problems: string[] = [];

    problems.push(...checkCodesDefinedOnce(spec));
    problems.push(...checkRulesInOrder(spec));
    problems.push(...checkIndexCoversEveryRule(spec));
    problems.push(...checkInternalLinks(spec));

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} internal inconsistencies`, problems);
    }
    return pass(this.name, 'codes unique, rules ordered, index complete, links resolve');
  },
};

/** A diagnostic code must be introduced by exactly one row of the §12.2 table. */
function checkCodesDefinedOnce(spec: string): string[] {
  const problems: string[] = [];
  const rows = [...spec.matchAll(/^\| `(OR-\d{3})` \|/gm)].map((match) => match[1]);
  const seen = new Map<string, number>();

  for (const code of rows) {
    if (code === undefined) continue;
    seen.set(code, (seen.get(code) ?? 0) + 1);
  }
  for (const [code, count] of seen) {
    if (count > 1) {
      problems.push(`${code} has ${count} rows in the diagnostics table; a code names one rule.`);
    }
  }

  // A code cited in prose but never tabled has no definition a reader can find.
  const cited = new Set(
    [...spec.matchAll(/`(OR-\d{3})`/g)].map((match) => match[1]).filter((c): c is string => !!c),
  );
  for (const code of cited) {
    if (!seen.has(code)) {
      problems.push(`${code} is cited in the prose but has no row in the diagnostics table.`);
    }
  }

  return problems;
}

/** Rule identifiers must appear in ascending order, as §14 promises. */
function checkRulesInOrder(spec: string): string[] {
  const rules = [...spec.matchAll(/\*\*§(\d+)\.(\d+)\.(\d+)/g)].map((match) => ({
    text: `§${match[1]}.${match[2]}.${match[3]}`,
    key: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
  }));

  const problems: string[] = [];
  for (let index = 1; index < rules.length; index += 1) {
    const previous = rules[index - 1];
    const current = rules[index];
    if (previous === undefined || current === undefined) continue;

    const [pa, pb, pc] = previous.key;
    const [ca, cb, cc] = current.key;
    const ordered = ca > pa || (ca === pa && (cb > pb || (cb === pb && cc > pc)));

    if (!ordered) {
      problems.push(
        `${current.text} is printed after ${previous.text}. Rule identifiers must read in ` +
          `ascending order — diagnostics and the conformance suite cite them as stable anchors.`,
      );
    }
  }
  return problems;
}

/** Every rule must fall inside a range the §14 index declares. */
function checkIndexCoversEveryRule(spec: string): string[] {
  const index = spec.slice(spec.indexOf('## 14. Normative rule index'));
  const ranges = [...index.matchAll(/§(\d+)\.(\d+)\.(\d+)\s*[–-]\s*§(\d+)\.(\d+)\.(\d+)/g)].map(
    (match) => ({
      from: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
      to: [Number(match[4]), Number(match[5]), Number(match[6])] as const,
    }),
  );

  if (ranges.length === 0) return ['§14 declares no rule ranges; the index is empty or malformed.'];

  const within = (key: readonly [number, number, number]) =>
    ranges.some((range) => compare(key, range.from) >= 0 && compare(key, range.to) <= 0);

  const problems: string[] = [];
  const uncovered = new Set<string>();

  for (const match of spec.matchAll(/\*\*§(\d+)\.(\d+)\.(\d+)/g)) {
    const key = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
    if (!within(key)) uncovered.add(`§${key[0]}.${key[1]}.${key[2]}`);
  }

  for (const rule of [...uncovered].sort()) {
    problems.push(
      `${rule} falls outside every range in the §14 index. The conformance suite is keyed on ` +
        `that index, so a rule missing from it is a rule nothing has to test.`,
    );
  }
  return problems;
}

function compare(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left - right;
  }
  return 0;
}

/** Internal anchors must match a heading actually present. */
function checkInternalLinks(spec: string): string[] {
  const anchors = new Set(
    [...spec.matchAll(/^#{2,4} (.+)$/gm)].map((match) =>
      (match[1] ?? '')
        .toLowerCase()
        .replace(/[`*]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-'),
    ),
  );

  const problems: string[] = [];
  for (const match of spec.matchAll(/\]\(#([a-z0-9-]+)\)/g)) {
    const target = match[1];
    if (target !== undefined && !anchors.has(target)) {
      problems.push(`Link to #${target} matches no heading in this document.`);
    }
  }
  return [...new Set(problems)];
}
