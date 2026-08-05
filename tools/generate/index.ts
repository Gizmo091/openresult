import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { renderSchemaModule, SCHEMA_MODULE } from './schema-module.ts';

/** Regenerates the artefacts derived from the published schema. */
await writeFile(SCHEMA_MODULE, await renderSchemaModule(), 'utf8');
console.log(`Wrote ${relative(process.cwd(), SCHEMA_MODULE)}`);

// The precompiled validator reads the module written above, so it has to run
// after it — not beside it.
await import('./validator.ts');
