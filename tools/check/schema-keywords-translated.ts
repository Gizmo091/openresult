import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA = join(repoRoot, 'schema/openresult-1.0.schema.json');
const TRANSLATION = join(repoRoot, 'sdk/js/packages/validate/src/schema.ts');

/**
 * Every schema keyword must have a sentence a producer can act on.
 *
 * Ajv reports in the schema's vocabulary: "must match else schema", "must be
 * equal to constant", "unevaluatedProperty". Nobody with a typo in a
 * participant id should have to learn any of it, so `schema.ts` maps each
 * keyword onto the rule it enforces. The mapping ends in a fallback that repeats
 * Ajv verbatim — correct as a last resort, and silent when it happens.
 *
 * Adding a keyword to the schema is a one-line change; noticing that it now
 * speaks Ajv to strangers takes reading a document that fails. This closes that
 * gap: a keyword the schema uses and the translation does not name is a failure
 * here rather than a puzzling error message in the wild.
 */

/** JSON Schema 2020-12 keywords that can produce a validation error. */
const REPORTING = new Set([
  'type',
  'enum',
  'const',
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum',
  'maxLength',
  'minLength',
  'pattern',
  'maxItems',
  'minItems',
  'uniqueItems',
  'maxContains',
  'minContains',
  'maxProperties',
  'minProperties',
  'required',
  'dependentRequired',
  'format',
  'additionalProperties',
  'unevaluatedProperties',
  'additionalItems',
  'unevaluatedItems',
  'contains',
  'propertyNames',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'dependentSchemas',
]);

/** Keyword → the value is a map of name to subschema. */
const SCHEMA_MAPS = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'];
/** Keyword → the value is one subschema. */
const SUBSCHEMAS = [
  'items',
  'not',
  'if',
  'then',
  'else',
  'additionalProperties',
  'unevaluatedProperties',
  'additionalItems',
  'unevaluatedItems',
  'contains',
  'propertyNames',
];
/** Keyword → the value is a list of subschemas. */
const SCHEMA_LISTS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'];

type Json = Record<string, unknown>;

/**
 * Collects the keywords a schema actually uses.
 *
 * Walks structurally rather than by key name, because this schema has a member
 * literally called `type` — `{"properties": {"type": {"const": "number"}}}` is
 * an attribute's type, not a `type` keyword, and grepping cannot tell them
 * apart.
 */
function keywordsUsed(node: unknown, into: Set<string>): void {
  if (Array.isArray(node) || typeof node !== 'object' || node === null) return;
  const schema = node as Json;

  for (const [key, value] of Object.entries(schema)) {
    if (REPORTING.has(key)) into.add(key);

    if (SCHEMA_MAPS.includes(key)) {
      for (const child of Object.values(value as Json)) keywordsUsed(child, into);
    } else if (SCHEMA_LISTS.includes(key)) {
      for (const child of (value as unknown[]) ?? []) keywordsUsed(child, into);
    } else if (SUBSCHEMAS.includes(key)) {
      // `items` may be a list in older drafts; both shapes walk the same way.
      if (Array.isArray(value)) for (const child of value) keywordsUsed(child, into);
      else keywordsUsed(value, into);
    }
  }
}

export const schemaKeywordsTranslated: Check = {
  name: 'schema-keywords-translated',
  enforces: 'Every schema keyword must map to a message written for a producer',
  async run() {
    const schema: unknown = JSON.parse(await readFile(SCHEMA, 'utf8'));
    const translation = await readFile(TRANSLATION, 'utf8');

    const used = new Set<string>();
    keywordsUsed(schema, used);

    const named = new Set([...translation.matchAll(/case '([A-Za-z]+)':/g)].map((m) => m[1] ?? ''));
    const untranslated = [...used].filter((keyword) => !named.has(keyword)).sort();

    if (untranslated.length > 0) {
      return fail(this.name, `${untranslated.length} keyword(s) speak Ajv to producers`, [
        `The schema uses ${untranslated.join(', ')}, which sdk/js/packages/validate/src/schema.ts ` +
          `does not name. Those fall through to the last case, which repeats Ajv's own wording — ` +
          `"must match else schema" and the like. Add a case saying what the rule requires, in ` +
          `the words of someone who wrote the document rather than the schema.`,
      ]);
    }

    return pass(this.name, `${used.size} schema keywords, all translated`);
  },
};
