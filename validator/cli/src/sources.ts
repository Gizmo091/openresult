import { glob, readFile } from 'node:fs/promises';
import { stat } from 'node:fs/promises';

export interface Source {
  /** How the source is named in output: a path, a URL, or `<stdin>`. */
  label: string;
  content: string;
}

export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}

/**
 * Resolve command-line arguments into readable sources.
 *
 * Accepts file paths, glob patterns, http(s) URLs and `-` for standard input,
 * so the same command works in a shell loop, in a publishing script and in a
 * CI job against a live URL.
 */
export async function resolveSources(args: string[]): Promise<Source[]> {
  if (args.length === 0) {
    throw new SourceError('No input given. Pass a file, a glob, a URL, or - for standard input.');
  }

  const sources: Source[] = [];

  for (const arg of args) {
    if (arg === '-') {
      sources.push({ label: '<stdin>', content: await readStdin() });
      continue;
    }

    if (/^https?:\/\//.test(arg)) {
      sources.push({ label: arg, content: await fetchUrl(arg) });
      continue;
    }

    if (/[*?[\]{}]/.test(arg)) {
      const matched: string[] = [];
      for await (const file of glob(arg)) matched.push(file);
      if (matched.length === 0) {
        throw new SourceError(`No file matches "${arg}".`);
      }
      matched.sort();
      for (const file of matched) {
        sources.push({ label: file, content: await readFile(file, 'utf8') });
      }
      continue;
    }

    const info = await stat(arg).catch(() => null);
    if (info === null) {
      throw new SourceError(`"${arg}" does not exist.`);
    }
    if (info.isDirectory()) {
      throw new SourceError(
        `"${arg}" is a directory. Point at a file, or use a glob such as "${arg}/**/*.json".`,
      );
    }
    sources.push({ label: arg, content: await readFile(arg, 'utf8') });
  }

  return sources;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchUrl(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new SourceError(`Could not reach ${url}: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new SourceError(`${url} returned ${response.status} ${response.statusText}.`);
  }
  return response.text();
}
