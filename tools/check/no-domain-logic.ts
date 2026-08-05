import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Source trees that consume documents. Tests are excluded: a test that loads the
 * example library legitimately names the domains it loads.
 */
const SOURCE_GLOBS = [
  'sdk/js/packages/*/src/**/*.ts',
  'viewer/src/**/*.ts',
  'validator/*/src/**/*.ts',
  'playground/src/**/*.ts',
];

/**
 * Names of competition domains. None of these may appear in code that consumes
 * documents: every display and ranking rule must follow from the semantics
 * declared in the document itself.
 *
 * A hit here is a design defect in the *format*, not in the code — the fix is to
 * enrich the semantics, never to add a special case.
 */
const DOMAIN_TERMS = [
  'motocross',
  'motorsport',
  'karting',
  'football',
  'soccer',
  'basketball',
  'handball',
  'volleyball',
  'tennis',
  'marathon',
  'triathlon',
  'cycling',
  'athletics',
  'swimming',
  'rally',
  'nascar',
  'golf',
  'esport',
  'e-sport',
  'hackathon',
  'photo-contest',
  'sales-ranking',
];

const pattern = new RegExp(`\\b(${DOMAIN_TERMS.join('|')})\\b`, 'i');

export const noDomainLogic: Check = {
  name: 'no-domain-logic',
  enforces: 'No domain knowledge in code — display rules follow from the document',
  async run() {
    const problems: string[] = [];
    let scanned = 0;

    for (const sourceGlob of SOURCE_GLOBS) {
      for await (const file of glob(sourceGlob, { cwd: repoRoot })) {
        const absolute = join(repoRoot, file);
        if (/\.test\.ts$/.test(file) || file.includes('/test/')) continue;
        scanned += 1;

        const content = await readFile(absolute, 'utf8');
        content.split('\n').forEach((line, index) => {
          const hit = pattern.exec(line);
          if (hit) {
            problems.push(
              `${relative(repoRoot, absolute)}:${index + 1} mentions "${hit[1]}". ` +
                `Consumers must not know about competition domains — enrich the format's ` +
                `semantics instead of special-casing.`,
            );
          }
        });
      }
    }

    if (problems.length > 0) {
      return fail(this.name, 'domain-specific logic found in consumer code', problems);
    }
    return pass(this.name, `${scanned} source files clean`);
  },
};
