import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corePackage = join(repoRoot, 'sdk/js/packages/core/package.json');
const coreBundle = join(repoRoot, 'sdk/js/packages/core/dist/index.js');

/** Maximum compressed size of the core bundle, in bytes. */
const MAX_GZIP_BYTES = 15 * 1024;

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

/**
 * The core package must stay free of runtime dependencies, so that reading and
 * ranking a document needs nothing but a JSON parser. Expressed as a property of
 * the dependency graph, the constraint cannot rot silently.
 */
export const coreDeps: Check = {
  name: 'core-deps',
  enforces: 'Radical simplicity — a minimal reader needs no dependency',
  async run() {
    const raw = await readFile(corePackage, 'utf8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const problems: string[] = [];

    for (const field of DEPENDENCY_FIELDS) {
      const declared = pkg[field];
      if (declared && typeof declared === 'object' && Object.keys(declared).length > 0) {
        const names = Object.keys(declared).join(', ');
        problems.push(
          `@openresult/core declares ${field}: ${names}. ` +
            `The core package is dependency-free by contract — move this to @openresult/validate ` +
            `or inline what is needed.`,
        );
      }
    }

    let sizeNote = 'bundle not built, size not checked';
    const built = await stat(coreBundle).catch(() => null);
    if (built) {
      const bundle = await readFile(coreBundle);
      const gzipped = gzipSync(bundle).byteLength;
      sizeNote = `${(gzipped / 1024).toFixed(1)} kB gzipped`;
      if (gzipped > MAX_GZIP_BYTES) {
        problems.push(
          `@openresult/core is ${sizeNote}, over the ${MAX_GZIP_BYTES / 1024} kB budget. ` +
            `The viewer embeds this bundle in third-party pages.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, 'core package constraints violated', problems);
    }
    return pass(this.name, `no runtime dependency, ${sizeNote}`);
  },
};
