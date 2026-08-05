import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SCHEMA_SOURCE = join(repoRoot, 'schema/openresult-1.0.schema.json');
export const SCHEMA_MODULE = join(repoRoot, 'sdk/js/packages/validate/src/schema.generated.ts');

/**
 * The validator has to carry the schema, not read it from disk: it runs in the
 * browser as well as in Node. The published JSON stays the source of truth and
 * this module is generated from it, with a repository check failing if the two
 * drift apart.
 */
export async function renderSchemaModule(): Promise<string> {
  const raw = await readFile(SCHEMA_SOURCE, 'utf8');
  const schema = JSON.parse(raw) as Record<string, unknown>;

  return (
    `// Generated from schema/openresult-1.0.schema.json — do not edit.\n` +
    `// Regenerate with: pnpm generate:schema\n` +
    `\n` +
    `export const OPENRESULT_1_0_SCHEMA = ${JSON.stringify(schema, null, 2)} as const;\n`
  );
}
