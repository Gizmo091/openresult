import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');

/**
 * Internal coherence of the specification.
 *
 * Six defects were found at once, all the same mistake: a rule added without
 * checking what it contradicted elsewhere. A diagnostic code
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
    problems.push(...checkRulesSitUnderTheirSection(spec));
    problems.push(...checkProseIsNotOfferedAsAnAnswer(spec));

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} internal inconsistencies`, problems);
    }
    return pass(
      this.name,
      'codes unique, rules ordered and filed, index complete, links resolve, prose not load-bearing',
    );
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

/**
 * A rule must be printed under the section its number names.
 *
 * §8.3.5 was added in the wrong place and printed under `### 8.4`, so a reader
 * looking for the empty-`sortBy` rule where its number says it lives did not
 * find it and only met it while reading about something else. §7.1.1 to §7.1.3
 * had the opposite problem: §7.2 through §7.5 each had a heading and §7.1 had
 * none, so its rules read as belonging to the previous section.
 *
 * Ordering was already checked. Where a rule sits was not, and the two are
 * different questions: a rule can be in the right order and under the wrong
 * heading.
 */
function checkRulesSitUnderTheirSection(spec: string): string[] {
  const problems: string[] = [];
  let section: string | undefined;

  for (const line of spec.split('\n')) {
    const heading = /^### (\d+\.\d+)/.exec(line);
    if (heading !== null) {
      section = heading[1];
      continue;
    }

    const rule = /^\*\*§(\d+\.\d+)\.\d+/.exec(line);
    if (rule === null || section === undefined) continue;

    if (rule[1] !== section) {
      problems.push(
        `§${rule[1]}.x is printed under the heading for §${section}. A reader looking where the ` +
          `number says it lives will not find it. Move the rule, or give its section a heading.`,
      );
    }
  }

  return [...new Set(problems)];
}

/**
 * A normative rule must not offer prose as the answer to a machine's question.
 *
 * §7.2.5 said that where the difference between an unopposed pairing and an
 * absent opponent matters, "`notes` carries it" — and §7.4.1 forbids a consumer
 * to parse `notes`. The format was telling a producer to record a distinction
 * in the one place it guarantees nothing will read. It reads as an answer, and
 * a producer who takes it stores information no consumer can act on.
 *
 * `description` is the same trap by §6.1.6. Both members are legitimate and
 * both are for people; naming one as where information *goes* is what this
 * catches. The rules that define them are exempt, since defining a member means
 * naming it.
 */
function checkProseIsNotOfferedAsAnAnswer(spec: string): string[] {
  const CONVEY = '(carries|carry|holds|hold|goes in|record it in|write it in|put it in)';
  const before = new RegExp('`(notes|description)`[^.]{0,60}?' + CONVEY);
  const after = new RegExp(CONVEY + '[^.]{0,60}?`(notes|description)`');

  const problems: string[] = [];
  for (const block of spec.split('\n\n')) {
    const rule = /^\*\*§(\d+\.\d+\.\d+)/.exec(block.trim());
    if (rule === null) continue;

    const id = rule[1] ?? '';
    // §7.4 defines `notes` and §6.1.6 defines `description`.
    if (id.startsWith('7.4') || id === '6.1.6') continue;

    const flat = block.replace(/\s+/g, ' ');
    if (before.test(flat) || after.test(flat)) {
      problems.push(
        `§${id} names \`notes\` or \`description\` as where information goes. Both are addressed ` +
          `to a person — §7.4.1 forbids parsing one and §6.1.6 guarantees nothing parses the ` +
          `other — so a producer who follows this stores something no consumer can act on. Say ` +
          `the format does not express it, or give it a member.`,
      );
    }
  }

  return problems;
}
