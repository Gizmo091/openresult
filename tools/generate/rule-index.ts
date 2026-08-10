import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');

const START = '<!-- rule-index:start -->';
const END = '<!-- rule-index:end -->';

/**
 * Build §14's index of rules from the rules themselves.
 *
 * §14 was called an index and was a table of section ranges — the table of
 * contents again, in a document that already has one. Someone implementing from
 * this specification said it plainly: it cannot be used to find a rule. The
 * question a reader arrives with is "how do I place a retirement rather than
 * drop it", and the answer is §8.4.3, which no range table will ever surface.
 *
 * Generated, because a hundred and forty-one hand-written summaries would be
 * wrong within a week and nobody would know which ones.
 */
export function buildRuleIndex(spec: string): string {
  const rows: string[] = [];

  // Parse the specification without the index, or §12.3.1 — the last rule in the
  // document — swallows §13, §14 and the previous index, and its row comes back
  // carrying this generator's own markers. It read its own output as prose.
  const body = withoutIndex(spec);

  // Every rule marker, wherever it sits: several share a paragraph, and the
  // derivation steps carry a name — `**§8.5.2 — Partition.**`.
  const markers = [...body.matchAll(/\*\*§(\d+\.\d+\.\d+)(?:\s*—\s*([^*]+?))?\*\*/g)];

  for (const [index, marker] of markers.entries()) {
    const rule = marker[1] ?? '';
    const name = (marker[2] ?? '').trim().replace(/\.$/, '');
    const from = (marker.index ?? 0) + marker[0].length;
    const next = markers[index + 1]?.index ?? body.length;
    // A section's last rule otherwise absorbs the prose of the section after it.
    const heading = body.slice(from, next).search(/\n#{2,4} /);
    const to = heading < 0 ? next : from + heading;

    let text = body.slice(from, to).replace(/\s+/g, ' ');
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY|REQUIRED|OPTIONAL)\*\*/g, '$1');
    text = text.replace(/[*_`]/g, '').trim();

    // The rule's own first sentence, whole and verbatim.
    //
    // This used to carry a second sentence too — the one with the strongest
    // keyword — joined with a `·`, on the reasoning that §8.5.3 opens "Order the
    // rankable results by successive comparison" and says "The sort MUST be
    // stable" two sentences later, and a reader searching for "stable" should
    // find it. The reasoning was sound and the result was false statements: a
    // sentence lifted away from its subject means something else. §6.1.4 came
    // out as "name is the participant's full display name · it MUST NOT carry
    // information absent from name" — the elided subject was shortName, and the
    // row as printed is nonsense. An index that misquotes rules is worse than
    // one that is merely incomplete, because a normative document is quoting
    // itself. Where a rule's first sentence buries what it requires, the fix is
    // to rewrite the rule.
    const sentence = (text.split(/(?<=[.;:])\s/)[0] ?? '').replace(/[.;:]$/, '').trim();
    const summary = name === '' ? sentence : `**${name}** — ${sentence}`;
    rows.push(`| [§${rule}](#${anchorFor(rule, spec)}) | ${summary} |`);
  }

  return ['| Rule | What it says |', '| ---- | ------------ |', ...rows].join('\n');
}

/** The specification with any previously generated index removed. */
function withoutIndex(spec: string): string {
  const start = spec.indexOf(START);
  const end = spec.indexOf(END);
  if (start < 0 || end < 0) return spec;
  return spec.slice(0, start + START.length) + spec.slice(end);
}

/** The heading a rule lives under, so the index links somewhere. */
function anchorFor(rule: string, spec: string): string {
  const section = rule.split('.').slice(0, 2).join('.');
  const heading = new RegExp(`^### ${section.replace('.', '\\.')} (.+)$`, 'm').exec(spec);
  const title = heading?.[1] ?? '';
  return `${section.replace('.', '')}-${title
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')}`;
}

const spec = await readFile(SPEC, 'utf8');
const start = spec.indexOf(START);
const end = spec.indexOf(END);
if (start < 0 || end < 0) {
  console.error(`${SPEC} has no ${START} … ${END} block to fill.`);
  process.exit(1);
}

const rebuilt =
  spec.slice(0, start + START.length) + '\n\n' + buildRuleIndex(spec) + '\n\n' + spec.slice(end);
await writeFile(SPEC, rebuilt, 'utf8');
console.log(`§14 rebuilt: ${buildRuleIndex(spec).split('\n').length - 2} rules`);
