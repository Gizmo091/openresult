import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSources, SourceError } from '../src/sources.js';

/**
 * How a document reaches the command line.
 *
 * Everything else in the CLI has already been handed a string; this is the part
 * that goes and gets one, and the part a first-time user meets first. Its
 * failures are all user error — a path that does not exist, a glob that matches
 * nothing, a directory where a file was meant — so what it says when it fails is
 * the whole of its behaviour.
 */

const workdir = mkdtempSync(join(tmpdir(), 'openresult-sources-'));

function file(name: string, content: string): string {
  const path = join(workdir, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('nothing to read', () => {
  it('says what the command accepts rather than that an argument is missing', async () => {
    await expect(resolveSources([])).rejects.toThrow(SourceError);
    await expect(resolveSources([])).rejects.toThrow(
      'Pass a file, a glob, a URL, or - for standard input',
    );
  });
});

describe('files', () => {
  it('reads one and labels it by its path', async () => {
    const path = file('one.openresult.json', '{"openresult":"1.0"}');

    const sources = await resolveSources([path]);

    expect(sources).toEqual([{ label: path, content: '{"openresult":"1.0"}' }]);
  });

  it('reads several in the order given, not sorted', async () => {
    // A shell loop passes them in a deliberate order; re-sorting would silently
    // reorder a report the caller arranged.
    const second = file('b.openresult.json', '{"n":2}');
    const first = file('a.openresult.json', '{"n":1}');

    const sources = await resolveSources([second, first]);

    expect(sources.map((source) => source.label)).toEqual([second, first]);
  });

  it('names the path that does not exist', async () => {
    await expect(resolveSources([join(workdir, 'absent.json')])).rejects.toThrow(
      /"[^"]*absent\.json" does not exist/,
    );
  });

  it('suggests a glob when handed a directory', async () => {
    // The commonest mistake, and the one where a bare "is a directory" leaves a
    // caller to guess what the command wanted instead.
    const directory = join(workdir, 'nested');
    mkdirSync(directory, { recursive: true });

    await expect(resolveSources([directory])).rejects.toThrow(/use a glob such as/);
  });
});

describe('globs', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    process.chdir(workdir);
  });

  // chdir moves the whole worker process, not this file.
  afterEach(() => {
    process.chdir(cwd);
  });

  it('expands to every match, sorted, so a report reads the same twice', async () => {
    mkdirSync(join(workdir, 'glob'), { recursive: true });
    for (const name of ['c', 'a', 'b']) {
      writeFileSync(join(workdir, 'glob', `${name}.openresult.json`), '{}', 'utf8');
    }

    const sources = await resolveSources(['glob/*.openresult.json']);

    expect(sources.map((source) => source.label.replace(/\\/g, '/'))).toEqual([
      'glob/a.openresult.json',
      'glob/b.openresult.json',
      'glob/c.openresult.json',
    ]);
  });

  it('refuses a pattern that matches nothing instead of doing nothing', async () => {
    // Silence would read as "all clear" — a CI job validating a directory that
    // has been renamed would pass while checking nothing.
    await expect(resolveSources(['glob/*.missing.json'])).rejects.toThrow(
      'No file matches "glob/*.missing.json".',
    );
  });
});

describe('standard input', () => {
  const original = Object.getOwnPropertyDescriptor(process, 'stdin');

  afterEach(() => {
    if (original !== undefined) Object.defineProperty(process, 'stdin', original);
  });

  it('reads a document piped in and labels it <stdin>', async () => {
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      value: Readable.from([Buffer.from('{"openresult":'), Buffer.from('"1.0"}')]),
    });

    expect(await resolveSources(['-'])).toEqual([
      { label: '<stdin>', content: '{"openresult":"1.0"}' },
    ]);
  });

  it('joins chunks without splitting a multi-byte character', async () => {
    // A UTF-8 character straddling two chunks is the classic way a pipe corrupts
    // a name. Decoding per chunk would turn "é" into two replacement characters.
    const encoded = Buffer.from('{"title":"Championnat régional"}', 'utf8');
    // Split *inside* the two bytes of "é" — computed rather than counted, since
    // a hand-picked offset landing on the space next to it would pass without
    // testing anything.
    const split = encoded.indexOf(Buffer.from('é', 'utf8')) + 1;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      value: Readable.from([encoded.subarray(0, split), encoded.subarray(split)]),
    });

    const [source] = await resolveSources(['-']);

    expect(source?.content).toBe('{"title":"Championnat régional"}');
  });
});

describe('urls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a document and labels it by its url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"openresult":"1.0"}', { status: 200 })),
    );

    expect(await resolveSources(['https://example.org/r.json'])).toEqual([
      { label: 'https://example.org/r.json', content: '{"openresult":"1.0"}' },
    ]);
  });

  it('reports the status rather than a parse failure further down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Not found</html>', { status: 404 })),
    );

    await expect(resolveSources(['https://example.org/gone.json'])).rejects.toThrow(/returned 404/);
  });

  it('keeps the reason a request never arrived', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND example.invalid');
      }),
    );

    await expect(resolveSources(['https://example.invalid/r.json'])).rejects.toThrow(
      'Could not reach https://example.invalid/r.json: getaddrinfo ENOTFOUND example.invalid',
    );
  });

  it.each(['application/json', 'application/vnd.openresult+json', 'text/plain'])(
    'accepts a document served as %s',
    async (type) => {
      // §11.6.2: a consumer must accept `application/json`. The proposed media
      // type is not registered and most servers will not send it, so a consumer
      // that discriminated on the header would reject nearly every document
      // published today. This one does not look at the header at all, and these
      // are here so that adding a check would have to be a decision.
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response('{"openresult":"1.0"}', {
              status: 200,
              headers: { 'content-type': type },
            }),
        ),
      );

      const [source] = await resolveSources(['https://example.org/r.json']);

      expect(source?.content).toBe('{"openresult":"1.0"}');
    },
  );

  it('treats only http and https as urls', async () => {
    // Anything else is a path. `file:///etc/passwd` must not become a fetch.
    await expect(resolveSources(['ftp://example.org/r.json'])).rejects.toThrow('does not exist');
  });
});
