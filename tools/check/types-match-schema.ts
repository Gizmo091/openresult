import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA = join(repoRoot, 'schema/openresult-1.0.schema.json');
const TYPES = join(repoRoot, 'sdk/js/packages/core/src/types.ts');

/**
 * The published TypeScript types must offer every value the format defines.
 *
 * `bye` spent a full pass missing from `ResultStatus` while the schema, the
 * specification, the validator and the conformance suite all carried it. Nothing
 * failed: the runtime holds statuses in a `Set<string>`, so the omission was
 * invisible to 252 tests. Only a consumer would have found it, by writing
 * `status: 'bye'` and being told it was not a valid status — by the library
 * whose own format defines it.
 */
const UNIONS: { schemaPath: string[]; typeName: string }[] = [
  { schemaPath: ['$defs', 'status', 'enum'], typeName: 'ResultStatus' },
  { schemaPath: ['$defs', 'measure', 'properties', 'kind', 'enum'], typeName: 'MeasureKind' },
  {
    schemaPath: ['$defs', 'measure', 'properties', 'betterWhen', 'enum'],
    typeName: 'BetterWhen',
  },
  {
    schemaPath: ['$defs', 'attributeDefinition', 'properties', 'type', 'enum'],
    typeName: 'AttributeType',
  },
  {
    schemaPath: ['$defs', 'participant', 'properties', 'type', 'enum'],
    typeName: 'ParticipantType',
  },
  { schemaPath: ['$defs', 'event', 'properties', 'type', 'enum'], typeName: 'EventType' },
  { schemaPath: ['$defs', 'ranking', 'properties', 'ties', 'enum'], typeName: 'TieHandling' },
  { schemaPath: ['properties', 'status', 'enum'], typeName: 'DocumentStatus' },
];

export const typesMatchSchema: Check = {
  name: 'types-match-schema',
  enforces: 'The published types must offer every value the format defines',
  async run() {
    const schema = JSON.parse(await readFile(SCHEMA, 'utf8')) as unknown;
    const source = await readFile(TYPES, 'utf8');
    const problems: string[] = [];
    let compared = 0;

    for (const { schemaPath, typeName } of UNIONS) {
      const values = resolve(schema, schemaPath);
      if (values === undefined) {
        problems.push(
          `The schema has no enum at ${schemaPath.join('.')}, expected for ${typeName}.`,
        );
        continue;
      }

      const declared = unionMembers(source, typeName);
      if (declared === undefined) {
        problems.push(`types.ts declares no union named ${typeName}.`);
        continue;
      }

      compared += 1;
      const missing = values.filter((value) => !declared.has(value));
      const extra = [...declared].filter((value) => !values.includes(value));

      if (missing.length > 0) {
        problems.push(
          `${typeName} is missing ${missing.map((v) => `"${v}"`).join(', ')}, which the schema ` +
            `accepts. A consumer writing that value is told by our own library that the format ` +
            `does not allow it.`,
        );
      }
      if (extra.length > 0) {
        problems.push(
          `${typeName} offers ${extra.map((v) => `"${v}"`).join(', ')}, which the schema rejects. ` +
            `A consumer would emit a document the validator refuses.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} type/schema divergence(s)`, problems);
    }
    return pass(this.name, `${compared} unions match their schema enum`);
  },
};

function resolve(node: unknown, path: string[]): string[] | undefined {
  let current: unknown = node;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return Array.isArray(current)
    ? current.filter((v): v is string => typeof v === 'string')
    : undefined;
}

/** The string literals of `export type Name = 'a' | 'b' | …;`, however it is wrapped. */
function unionMembers(source: string, typeName: string): Set<string> | undefined {
  const declaration = new RegExp(`export type ${typeName}\\s*=([^;]+);`).exec(source);
  if (declaration === null) return undefined;

  const body = declaration[1] ?? '';
  return new Set([...body.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? ''));
}
