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
    problems.push(...checkNotesDoNotPrescribe(spec));
    problems.push(...checkDefaultsAreRules(spec));

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

/**
 * §14 must list every rule, and list it as it currently reads.
 *
 * It used to be a table of section ranges — the table of contents again, in a
 * document that already has one. Someone implementing from this specification
 * put it plainly: it cannot be used to find a rule, and the question a reader
 * arrives with is "how do I place a retirement rather than drop it", whose
 * answer is §8.4.3.
 *
 * It is generated now, so this checks it against what the generator would
 * produce. A summary that has drifted from its rule is worse than none: it
 * sends a reader to a rule that no longer says that.
 */
function checkIndexCoversEveryRule(spec: string): string[] {
  const start = spec.indexOf('<!-- rule-index:start -->');
  const end = spec.indexOf('<!-- rule-index:end -->');
  if (start < 0 || end < 0) {
    return ['§14 has no generated index block; run `pnpm generate:rule-index`.'];
  }

  const listed = new Set(
    [...spec.slice(start, end).matchAll(/^\| \[§(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1] ?? ''),
  );
  const declared = new Set([...spec.matchAll(/\*\*§(\d+\.\d+\.\d+)/g)].map((m) => m[1] ?? ''));

  const missing = [...declared].filter((rule) => !listed.has(rule));
  if (missing.length > 0) {
    return [
      `§14 lists ${listed.size} rules and the document declares ${declared.size}; ` +
        `${missing
          .slice(0, 6)
          .map((r) => `§${r}`)
          .join(', ')}${missing.length > 6 ? ' and more' : ''} ` +
        `${missing.length === 1 ? 'is' : 'are'} absent. Run \`pnpm generate:rule-index\`.`,
    ];
  }

  return [];
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

/**
 * A non-normative note must not prescribe.
 *
 * §6.3 is marked non-normative and was, for a while, the only place that said
 * how a competition with repeated attempts should be shaped — and it
 * contradicted a normative rule. A reader followed it and published eighteen
 * figures twice. §8.3.4's note carried a `SHOULD` of its own, which is either a
 * requirement in the wrong place or advice dressed as one.
 *
 * A note explaining why a rule is a SHOULD is fine and common — "this is
 * display, so it is a **SHOULD**" — so the keyword is only a problem when
 * something follows it. That is what the lookbehind separates.
 */
function checkNotesDoNotPrescribe(spec: string): string[] {
  const problems: string[] = [];

  for (const block of spec.split('\n\n')) {
    const flat = block.replace(/\s+/g, ' ').trim();
    if (!flat.slice(0, 40).includes('_Non-normative')) continue;

    for (const match of block.matchAll(/\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/g)) {
      const before = block.slice(Math.max(0, match.index - 14), match.index).replace(/\s+/g, ' ');
      // "is a **SHOULD**" names the keyword; "**SHOULD** publish" uses it.
      if (/(is a|it is|than a|a) $/.test(before)) continue;

      problems.push(
        `A non-normative note prescribes with ${match[1]}: "${flat.slice(0, 90)}…". Either it is a ` +
          `requirement, and belongs in a numbered rule where the conformance suite can reach it, ` +
          `or it is advice and should not borrow the word.`,
      );
    }
  }

  return [...new Set(problems)];
}

/**
 * A default announced in a comment must also be a rule.
 *
 * §2.3 says JSONC comments are annotation only and a conforming document has
 * none. Three defaults were stated in one and nowhere else — an absent
 * `status`, an absent participant `type`, an absent event `type` — so the only
 * statement of them sat in the one place the specification says carries no
 * weight. §7.2.2 covered an *unknown* status and not an absent one, and the two
 * are different questions with different answers.
 *
 * Found by the first person to write an implementation from this document, who
 * assumed the value from the comment and then went looking for the rule to cite.
 */
function checkDefaultsAreRules(spec: string): string[] {
  const rules = spec.split('\n\n').filter((block) => block.trim().startsWith('**§'));
  const problems: string[] = [];

  for (const match of spec.matchAll(/^\s*"(\w+)":.*\/\/.*default\s+[`"]([^`"]+)[`"]/gm)) {
    const [, member = '', value = ''] = match;
    const covered = rules.some(
      (rule) =>
        rule.includes(`\`${member}\``) &&
        rule.includes(value) &&
        (rule.includes('absent') || rule.includes('means')),
    );
    if (!covered) {
      problems.push(
        `The skeleton says \`${member}\` defaults to "${value}" and no rule says so. §2.3 makes a ` +
          `comment annotation only, so that default is stated in the one place this document ` +
          `declares carries no weight.`,
      );
    }
  }

  return [...new Set(problems)];
}
