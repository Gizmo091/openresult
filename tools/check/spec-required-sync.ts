import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const SCHEMA = join(repoRoot, 'schema/openresult-1.0.schema.json');

/**
 * Do the specification's skeletons agree with the schema about what is required?
 *
 * The JSONC skeletons are what a producer copies. When one marks a member
 * OPTIONAL that the schema requires, the producer emits a document the
 * validator rejects — and the specification told them to.
 *
 * `spec-coherence` catches structural drift; this catches disagreement about
 * requiredness. Neither catches a prose sentence contradicting a skeleton in
 * another section: that needs reading two passages together, which is what
 * outside review is for. An earlier attempt to detect it by pattern produced
 * more noise than signal, so this checks only what can be checked exactly.
 */
export const specRequiredSync: Check = {
  name: 'spec-required-sync',
  enforces: 'A skeleton must not contradict the schema about what is required',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const schema = JSON.parse(await readFile(SCHEMA, 'utf8')) as SchemaNode;
    const problems: string[] = [];
    let compared = 0;

    for (const { entity, members } of skeletons(spec)) {
      const required = new Set(requiredOf(schema, entity));

      for (const [member, annotation] of members) {
        // `unit` is required conditionally — on every kind but text and
        // boolean — which the schema expresses with if/then rather than
        // `required`. Exact comparison cannot see that.
        if (member === 'unit') continue;
        compared += 1;

        if (annotation === 'OPTIONAL' && required.has(member)) {
          problems.push(
            `The ${entity} skeleton marks "${member}" OPTIONAL; the schema requires it. ` +
              `A producer copying the skeleton emits a document the validator rejects.`,
          );
        }
        if (annotation === 'REQUIRED' && !required.has(member)) {
          problems.push(
            `The ${entity} skeleton marks "${member}" REQUIRED; the schema does not. ` +
              `Either the schema is too permissive or the skeleton overstates the rule.`,
          );
        }
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} disagreement(s) about requiredness`, problems);
    }
    return pass(this.name, `${compared} skeleton members agree with the schema`);
  },
};

interface SchemaNode {
  required?: string[];
  properties?: Record<string, SchemaNode>;
  $defs?: Record<string, SchemaNode>;
  [key: string]: unknown;
}

/** Headings that introduce a skeleton, and the schema definition it describes. */
const SECTION_ENTITY: [RegExp, string][] = [
  [/^### 4\.1 /, 'document'],
  [/^### 5\.1 /, 'measure'],
  [/^### 5\.3 /, 'attributeDefinition'],
  [/^### 6\.1 /, 'participant'],
  [/^### 6\.2 /, 'event'],
  [/^## 7\. /, 'result'],
  [/^## 8\. /, 'ranking'],
  [/^### 9\.1 /, 'category'],
  [/^### 9\.2 /, 'source'],
  [/^### 10\.1 /, 'presentation'],
];

interface Skeleton {
  entity: string;
  members: [string, 'REQUIRED' | 'OPTIONAL'][];
}

/** Each annotated skeleton, tied to the entity whose section holds it. */
function skeletons(spec: string): Skeleton[] {
  const found: Skeleton[] = [];
  let entity: string | undefined;
  let current: Skeleton | undefined;

  for (const line of spec.split('\n')) {
    const heading = SECTION_ENTITY.find(([pattern]) => pattern.test(line));
    if (heading !== undefined) {
      entity = heading[1];
      current = undefined;
      continue;
    }

    const member = /^\s*"([a-zA-Z]+)":.*\/\/\s*(REQUIRED|OPTIONAL)/.exec(line);
    if (member === null || entity === undefined) continue;

    if (current === undefined) {
      current = { entity, members: [] };
      found.push(current);
    }
    current.members.push([member[1] ?? '', (member[2] ?? 'OPTIONAL') as 'REQUIRED' | 'OPTIONAL']);
  }

  return found;
}

function requiredOf(schema: SchemaNode, entity: string): string[] {
  if (entity === 'document') return schema.required ?? [];
  return schema.$defs?.[entity]?.required ?? [];
}
