import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = join(repoRoot, 'schema/openresult-1.0.schema.json');

/**
 * The edge-case library deliberately exercises extensions; the domain examples
 * must not need one. If a reference domain cannot be expressed without `x-`,
 * the format has a gap.
 */
const EXTENSIONS_ALLOWED_IN = 'examples/edge-cases/';

function findExtensionPaths(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findExtensionPaths(item, `${path}/${index}`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      key.startsWith('x-') ? [`${path}/${key}`] : findExtensionPaths(child, `${path}/${key}`),
    );
  }
  return [];
}

export const examples: Check = {
  name: 'examples',
  enforces: 'Every published example is valid, and no domain needs a proprietary extension',
  async run() {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats.default(ajv);
    const validate = ajv.compile(schema);

    const problems: string[] = [];
    let count = 0;

    // §11.6.3 recommends `.openresult.json`, and the glob below only finds
    // files that follow it — so a document named otherwise would be skipped in
    // silence rather than reported. Sweep the directory first.
    for await (const file of glob('examples/**/*.json', { cwd: repoRoot })) {
      if (!file.endsWith('.openresult.json')) {
        problems.push(
          `${file} does not end in ".openresult.json". §11.6.3 recommends that extension, and ` +
            `every check here selects documents by it — a file named otherwise is not validated ` +
            `by anything.`,
        );
      }
    }

    for await (const file of glob('examples/**/*.openresult.json', { cwd: repoRoot })) {
      count += 1;
      const raw = await readFile(join(repoRoot, file), 'utf8');

      let document: unknown;
      try {
        document = JSON.parse(raw);
      } catch (error) {
        problems.push(`${file} is not valid JSON: ${(error as Error).message}`);
        continue;
      }

      if (!validate(document)) {
        for (const error of validate.errors ?? []) {
          problems.push(
            `${file}${error.instancePath || '/'} ${error.message ?? 'is invalid'}` +
              (error.params && Object.keys(error.params).length > 0
                ? ` (${JSON.stringify(error.params)})`
                : ''),
          );
        }
      }

      if (!file.startsWith(EXTENSIONS_ALLOWED_IN)) {
        for (const extension of findExtensionPaths(document)) {
          problems.push(
            `${file}${extension} uses an extension. A reference domain that needs one ` +
              `reveals a gap in the format — extend the semantics instead.`,
          );
        }
      }
    }

    if (count === 0) {
      return fail(this.name, 'no example found', ['examples/ contains no document to validate']);
    }
    if (problems.length > 0) {
      return fail(this.name, `${problems.length} problem(s) across ${count} example(s)`, problems);
    }
    return pass(this.name, `${count} example(s) valid`);
  },
};
