import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const MANIFEST = join(repoRoot, 'conformance/manifest.json');
const RATCHET = join(repoRoot, 'conformance/coverage.json');

/**
 * Rule identifiers as the specification writes them. Most are bare —
 * `**§7.2.1**` — but the derivation steps carry a name: `**§8.5.3 — Sort.**`.
 */
const RULE_PATTERN = /\*\*§(\d+\.\d+\.\d+)(?=[\s*—])/g;

interface Ratchet {
  covered: string[];
  note: string;
}

interface Manifest {
  cases: { id: string; rule: string }[];
}

/**
 * Conformance coverage, as a ratchet.
 *
 * The suite is the operational definition of "conforming" (principle VII), so
 * a normative rule nobody exercises is a rule nobody actually implements.
 *
 * Rather than demand total coverage on day one — which would invite a pile of
 * empty exemptions — this records which rules are covered and fails when one
 * stops being. Coverage can only go up.
 */
export const ruleCoverage: Check = {
  name: 'rule-coverage',
  enforces: 'Conformance is verified by machine — covered rules stay covered',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const declared = new Set<string>();
    for (const match of spec.matchAll(RULE_PATTERN)) {
      if (match[1] !== undefined) declared.add(match[1]);
    }

    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as Manifest;
    const exercised = new Set<string>();
    for (const entry of manifest.cases) {
      const rule = entry.rule.replace(/^spec §/, '');
      exercised.add(rule);
    }

    const problems: string[] = [];

    // A case citing a rule the specification does not define is a broken
    // reference in either direction — usually a renumbered section.
    for (const rule of exercised) {
      if (!declared.has(rule)) {
        problems.push(
          `The suite cites §${rule}, which the specification does not define. ` +
            `Either the case references the wrong section, or the section was renumbered.`,
        );
      }
    }

    const ratchet = JSON.parse(await readFile(RATCHET, 'utf8')) as Ratchet;
    for (const rule of ratchet.covered) {
      if (!exercised.has(rule)) {
        problems.push(
          `§${rule} was covered by the suite and no longer is. ` +
            `Restore a case for it, or state why the rule went away.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, 'conformance coverage regressed', problems);
    }

    // Record any newly covered rules so the ratchet tightens on its own.
    const merged = [...new Set([...ratchet.covered, ...exercised])].sort();
    if (merged.length !== ratchet.covered.length) {
      await writeFile(
        RATCHET,
        `${JSON.stringify({ ...ratchet, covered: merged }, null, 2)}\n`,
        'utf8',
      );
    }

    const uncovered = [...declared].filter((rule) => !exercised.has(rule)).length;
    return pass(
      this.name,
      `${exercised.size}/${declared.size} normative rules exercised, ${uncovered} still open`,
    );
  },
};
