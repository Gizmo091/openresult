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

  // Every rule marker, wherever it sits: several share a paragraph, and the
  // derivation steps carry a name — `**§8.5.2 — Partition.**`.
  const markers = [...spec.matchAll(/\*\*§(\d+\.\d+\.\d+)(?:\s*—\s*([^*]+?))?\*\*/g)];

  for (const [index, marker] of markers.entries()) {
    const rule = marker[1] ?? '';
    const name = (marker[2] ?? '').trim().replace(/\.$/, '');
    const from = (marker.index ?? 0) + marker[0].length;
    const to = markers[index + 1]?.index ?? spec.length;

    let text = spec.slice(from, to).replace(/\s+/g, ' ');
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY|REQUIRED|OPTIONAL)\*\*/g, '$1');
    text = text.replace(/[*_`]/g, '').trim();

    // What it opens with, and what it requires, when those differ. §8.5.3 opens
    // "Order the rankable results by successive comparison" and says "The sort
    // MUST be stable" two sentences later — and stability is the half a reader
    // has to write by hand in a language whose sort is not. An index is for
    // finding a rule from the words you have in mind, so it carries both.
    const sentences = text.split(/(?<=[.;:])\s/);
    const opening = (sentences[0] ?? '').replace(/[.;:]$/, '').trim();
    const requirement = strongest(sentences);
    const sentence = requirement === opening ? opening : `${opening} · ${requirement}`;
    const summary = name === '' ? sentence : `**${name}** — ${sentence}`;
    rows.push(`| [§${rule}](#${anchorFor(rule, spec)}) | ${clip(summary)} |`);
  }

  return ['| Rule | What it says |', '| ---- | ------------ |', ...rows].join('\n');
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

/** The sentence with the strongest normative keyword, or the first. */
function strongest(sentences: string[]): string {
  const rank = (sentence: string): number => {
    if (/\bMUST NOT\b/.test(sentence)) return 4;
    if (/\bMUST\b/.test(sentence)) return 3;
    if (/\bSHOULD( NOT)?\b/.test(sentence)) return 2;
    if (/\bMAY\b/.test(sentence)) return 1;
    return 0;
  };

  let best = sentences[0] ?? '';
  let bestRank = rank(best);
  for (const sentence of sentences.slice(1)) {
    if (rank(sentence) > bestRank) {
      best = sentence;
      bestRank = rank(sentence);
    }
  }
  return best.replace(/[.;:]$/, '').trim();
}

function clip(text: string): string {
  return text.length <= 120 ? text : `${text.slice(0, 117).trimEnd()}…`;
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
