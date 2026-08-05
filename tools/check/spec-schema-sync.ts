import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const SCHEMA = join(repoRoot, 'schema/openresult-1.0.schema.json');

/**
 * The specification is normative; the schema is its machine-readable
 * expression. Nothing keeps them together except attention — and attention is
 * exactly what fails on the fourth edit of a long afternoon.
 *
 * This checks the direction that actually goes wrong: something added to the
 * schema and never written down. A member no reader can find is a member no
 * producer will use, and a value domain nobody documented is a trap.
 */
export const specSchemaSync: Check = {
  name: 'spec-schema-sync',
  enforces: 'The specification is the source of truth — the schema must not outrun it',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const schema = JSON.parse(await readFile(SCHEMA, 'utf8')) as unknown;

    const problems: string[] = [];
    const members = new Set<string>();
    const enumValues = new Set<string>();

    collect(schema, members, enumValues);

    for (const member of [...members].sort()) {
      // Members are written in backticks throughout the specification.
      if (!spec.includes(`\`${member}\``)) {
        problems.push(
          `The schema defines the member "${member}", which the specification never mentions. ` +
            `Document it, or remove it from the schema.`,
        );
      }
    }

    for (const value of [...enumValues].sort()) {
      if (!spec.includes(`\`${value}\``)) {
        problems.push(
          `The schema allows the value "${value}", which the specification never mentions. ` +
            `Document what it means, or remove it.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, 'the schema and the specification disagree', problems);
    }

    return pass(
      this.name,
      `${members.size} members and ${enumValues.size} enum values all documented`,
    );
  },
};

/** Walk the schema, gathering declared property names and enum values. */
function collect(node: unknown, members: Set<string>, enumValues: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, members, enumValues);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const object = node as Record<string, unknown>;

  const properties = object['properties'];
  if (properties !== null && typeof properties === 'object') {
    for (const name of Object.keys(properties)) members.add(name);
  }

  const values = object['enum'];
  if (Array.isArray(values)) {
    for (const value of values) {
      if (typeof value === 'string') enumValues.add(value);
    }
  }

  for (const [key, child] of Object.entries(object)) {
    // Skip the annotation keywords: their text is prose, not structure.
    if (key === 'description' || key === 'title' || key === '$comment') continue;
    collect(child, members, enumValues);
  }
}
