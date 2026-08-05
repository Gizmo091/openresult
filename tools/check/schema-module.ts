import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderSchemaModule, SCHEMA_MODULE } from '../generate/schema-module.ts';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The validator embeds the schema so it can run in a browser. Embedding is a
 * duplication, and a duplication nobody checks is a divergence waiting to
 * happen — so it is checked.
 */
export const schemaModule: Check = {
  name: 'schema-module',
  enforces: 'The specification is the source of truth — the embedded schema must match it',
  async run() {
    const expected = await renderSchemaModule();
    const actual = await readFile(SCHEMA_MODULE, 'utf8').catch(() => null);

    if (actual === null) {
      return fail(this.name, 'embedded schema missing', [
        `${relative(repoRoot, SCHEMA_MODULE)} does not exist. Run: pnpm generate:schema`,
      ]);
    }

    if (actual !== expected) {
      return fail(this.name, 'embedded schema is stale', [
        `${relative(repoRoot, SCHEMA_MODULE)} no longer matches ` +
          `schema/openresult-1.0.schema.json. Run: pnpm generate:schema`,
      ]);
    }

    return pass(this.name, 'embedded schema matches the published one');
  },
};
