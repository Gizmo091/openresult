import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Ajv2020, _ } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA = join(repoRoot, 'schema/openresult-1.0.schema.json');
const COMPILED = join(repoRoot, 'sdk/js/packages/validate/src/schema.validator.generated.js');

/**
 * The precompiled validator must be the schema, compiled.
 *
 * Since the validator is generated ahead of time rather than built from the
 * schema on startup, nothing at runtime would notice the two drifting apart. A
 * rule added to the schema and never regenerated here means the published
 * validator quietly enforces the previous version — and every conformance case
 * still passes, because they run against the same stale code.
 *
 * `schema-module` catches the same class of drift for the embedded schema. This
 * is its counterpart for the compiled form.
 */
export const compiledValidator: Check = {
  name: 'compiled-validator',
  enforces: 'The precompiled validator must match the published schema',
  async run() {
    const schema = JSON.parse(await readFile(SCHEMA, 'utf8')) as object;
    const onDisk = await readFile(COMPILED, 'utf8');

    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      verbose: true,
      code: { source: true, esm: true, formats: _`formats` },
    });
    addFormats.default(ajv);

    const expected = standaloneCode
      .default(ajv, ajv.compile(schema))
      .replaceAll('require("ajv/dist/runtime/ucs2length").default', 'ucs2length');

    // Compare the generated body, not the header the generator writes around it.
    if (!onDisk.includes(expected)) {
      return fail(this.name, 'the compiled validator is out of date', [
        `${COMPILED.slice(repoRoot.length + 1)} is not what the current schema compiles to. ` +
          `Run \`pnpm generate:schema\`. Until then the published validator enforces an older ` +
          `schema, and nothing at runtime would tell you: the conformance suite runs against ` +
          `this same file.`,
      ]);
    }

    return pass(this.name, `${Math.round(expected.length / 1024)} kB, compiled from the schema`);
  },
};
