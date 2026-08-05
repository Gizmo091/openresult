import type { UserConfig } from 'vite';

/**
 * Shared Vite configuration for the workspace packages.
 *
 * `libraryConfig` builds a package as an ES module library; `appConfig` builds a
 * browser application. Both live here so the toolchain surface stays small — a
 * project meant to last years should not accumulate divergent build setups.
 */
export function libraryConfig(options: {
  entry: string;
  name: string;
  /**
   * Declared dependencies to keep out of the bundle. A published package must
   * not inline what it depends on: the consumer would end up with two copies
   * and no way to patch either.
   */
  external?: (string | RegExp)[];
}): UserConfig {
  return {
    build: {
      target: 'es2022',
      lib: {
        entry: options.entry,
        name: options.name,
        formats: ['es'],
        fileName: 'index',
      },
      rollupOptions: {
        external: options.external ?? [],
      },
      sourcemap: true,
      minify: false,
    },
  };
}

export function appConfig(options: { base?: string } = {}): UserConfig {
  return {
    base: options.base ?? '/',
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
}
