import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = join(repoRoot, 'specification/openresult-v1.md');
const SCHEMA = join(repoRoot, 'schema/openresult-1.0.schema.json');
const TYPES = join(repoRoot, 'sdk/js/packages/core/src/types.ts');

/**
 * §6.1.6 promises `description` on every entity that carries a name or a label.
 * The schema must keep that promise, and so must the published types.
 *
 * It did not. `description` was accepted on the document, measures and attribute
 * definitions, and rejected on the six other named entities. A document written from §6.1.6
 * alone carried 31 of them — on participants, events, rankings and a category —
 * and every one was rejected by our own validator. The specification promised what the format did not deliver, which
 * is worse than a format that never promised: the producer followed the rules
 * and was punished for it.
 *
 * A promise of universal scope is exactly the kind of sentence that rots, because
 * nothing breaks when a new entity is added without honouring it.
 */
export const descriptionEverywhere: Check = {
  name: 'description-everywhere',
  enforces: 'Every entity that carries a name or a label must accept a description',
  async run() {
    const spec = await readFile(SPEC, 'utf8');
    const schema = JSON.parse(await readFile(SCHEMA, 'utf8')) as SchemaNode;
    const types = await readFile(TYPES, 'utf8');
    const problems: string[] = [];

    // The prose must still make the promise. If someone narrows §6.1.6 instead
    // of narrowing the schema, this check has to notice rather than pass on a
    // technicality. Whitespace is flattened first: the rule spans two lines
    // today and will span one the next time the formatter rewraps it.
    const rule = flatten(spec, '**§6.1.6**');
    if (rule === null || !rule.includes('**OPTIONAL** on every entity that carries one')) {
      problems.push(
        `§6.1.6 no longer states that "description" is optional on every entity that carries a ` +
          `name or a label. Either restore the promise, or this check is enforcing a rule the ` +
          `specification has dropped.`,
      );
    }

    const named = Object.entries(schema.$defs ?? {}).filter(([, definition]) => {
      const properties = definition.properties ?? {};
      return 'name' in properties || 'label' in properties;
    });

    for (const [entity, definition] of named) {
      if (!('description' in (definition.properties ?? {}))) {
        problems.push(
          `The schema's "${entity}" carries a name or a label but rejects "description", which ` +
            `§6.1.6 promises. A producer following the specification emits a document our own ` +
            `validator refuses.`,
        );
      }

      const typeName = INTERFACE_OF[entity];
      if (typeName === undefined) {
        problems.push(
          `"${entity}" is a named entity with no entry in this check's interface table. Add it, ` +
            `so its published type is checked too.`,
        );
        continue;
      }
      if (!declaresDescription(types, typeName)) {
        problems.push(
          `types.ts declares no optional "description" on ${typeName}. The schema accepts one, ` +
            `so a consumer writing it in TypeScript is told by our own library that it is not a ` +
            `member — the shape the "bye" defect took.`,
        );
      }
    }

    // The document itself carries `title`, not `name`, so the loop above misses
    // it. It is the one place `description` was never in doubt, which is exactly
    // why it is worth pinning: it is the example every producer copies.
    if (!('description' in (schema.properties ?? {}))) {
      problems.push('The root object rejects "description", which §4.1 documents as OPTIONAL.');
    }

    if (problems.length > 0) {
      return fail(
        this.name,
        `${problems.length} entity/entities break the §6.1.6 promise`,
        problems,
      );
    }
    return pass(
      this.name,
      `${named.length} named entities accept a description, plus the document`,
    );
  },
};

interface SchemaNode {
  properties?: Record<string, SchemaNode>;
  $defs?: Record<string, SchemaNode>;
  [key: string]: unknown;
}

/** Schema definition to the interface the core package publishes for it. */
const INTERFACE_OF: Record<string, string> = {
  measure: 'Measure',
  attributeDefinition: 'AttributeDefinition',
  participant: 'Participant',
  event: 'ResultEvent',
  ranking: 'Ranking',
  category: 'Category',
  source: 'Source',
  link: 'Link',
  asset: 'Asset',
};

/** One rule of the specification, as a single line. */
function flatten(spec: string, marker: string): string | null {
  const start = spec.indexOf(marker);
  if (start === -1) return null;
  const end = spec.indexOf('\n\n', start);
  return spec.slice(start, end === -1 ? undefined : end).replace(/\s+/g, ' ');
}

function declaresDescription(source: string, typeName: string): boolean {
  // `\b` matters: without it, "Ranking" matches the declaration of
  // "RankingScope" first, and the check reports a missing member on the wrong
  // interface.
  const declaration = new RegExp(`export interface ${typeName}\\b[^{]*\\{([^}]*)\\}`).exec(source);
  if (declaration === null) return false;
  return /^\s*description\?:\s*string;/m.test(declaration[1] ?? '');
}
