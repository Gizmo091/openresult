import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

/**
 * Render the repository's Markdown into fragments the pages include.
 *
 * The specification is the source of truth and lives in `specification/`. It is
 * not copied here and edited: it is rendered at build time, so the site can
 * never drift from the document the conformance suite cites.
 *
 * Heading anchors follow GitHub's slug rules, because the specification links to
 * itself in that style — `[§8.1.1](#81-scope)` has to land on `### 8.1 \`scope\``.
 * Getting this wrong breaks several hundred internal links silently.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const outDir = join(here, '..', 'src', 'generated');

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function renderer(): Marked {
  const marked = new Marked({ gfm: true, breaks: false });
  const seen = new Map<string, number>();

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const base = slug(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}">#</a>${text}</h${depth}>\n`;
      },
      // Wide tables must scroll inside their own box rather than push the page
      // sideways; the status and diagnostic tables are far too wide for a phone.
      table(token) {
        const header = `<thead><tr>${token.header
          .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
          .join('')}</tr></thead>`;
        const body = token.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`,
          )
          .join('');
        return `<div class="table-scroll"><table>${header}<tbody>${body}</tbody></table></div>\n`;
      },
    },
  });

  return marked;
}

interface Rendered {
  html: string;
  toc: { id: string; text: string; depth: number }[];
}

async function render(path: string): Promise<Rendered> {
  const source = await readFile(path, 'utf8');
  const html = await renderer().parse(source);

  const toc: Rendered['toc'] = [];
  for (const match of html.matchAll(/<h([23]) id="([^"]+)">.*?<\/a>(.*?)<\/h[23]>/g)) {
    toc.push({
      depth: Number(match[1]),
      id: match[2] ?? '',
      text: (match[3] ?? '').replace(/<[^>]+>/g, ''),
    });
  }

  return { html, toc };
}

const specification = await render(join(repoRoot, 'specification/openresult-v1.md'));

const docPages = await Promise.all(
  [
    ['vision', 'docs/VISION.md'],
    ['roadmap', 'docs/ROADMAP.md'],
  ].map(async ([key, relative]) => [key, await render(join(repoRoot, relative ?? ''))] as const),
);

const decisionsDir = join(repoRoot, 'docs/decisions');
const decisions = (await readdir(decisionsDir))
  .filter((name) => /^\d{4}-.*\.md$/.test(name))
  .sort();

const adrs = await Promise.all(
  decisions.map(async (name) => {
    const rendered = await render(join(decisionsDir, name));
    const source = await readFile(join(decisionsDir, name), 'utf8');
    const title = (/^#\s+(.+)$/m.exec(source)?.[1] ?? name).replace(/^ADR\s+\d+\s+—\s*/, '');
    return { id: name.slice(0, 4), slug: name.replace(/\.md$/, ''), title, html: rendered.html };
  }),
);

// --- the example library ------------------------------------------------
//
// Copied into `public/` rather than bundled: twenty documents is a megabyte of
// JSON, and a visitor reading the specification should not download it. The
// index carries only what the gallery lists.

interface ExampleEntry {
  path: string;
  domain: string;
  title: string;
  description: string;
  participants: number;
  results: number;
  rankings: number;
  measures: string[];
}

const examplesRoot = join(repoRoot, 'examples');
const publicExamples = join(here, '..', 'public', 'examples');

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.openresult.json')) yield full;
  }
}

const examples: ExampleEntry[] = [];
for await (const file of walk(examplesRoot)) {
  const raw = await readFile(file, 'utf8');
  const document = JSON.parse(raw) as {
    title: string;
    description?: string;
    participants?: unknown[];
    results?: unknown[];
    rankings?: unknown[];
    measures?: { label: string }[];
  };

  const relative = file.slice(examplesRoot.length + 1);
  const target = join(publicExamples, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, raw, 'utf8');

  examples.push({
    path: relative,
    domain: relative.split('/')[0] ?? '',
    title: document.title,
    description: document.description ?? '',
    participants: document.participants?.length ?? 0,
    results: document.results?.length ?? 0,
    rankings: document.rankings?.length ?? 0,
    measures: (document.measures ?? []).map((measure) => measure.label),
  });
}
examples.sort((a, b) => a.path.localeCompare(b.path));

// The schema is published at the `$id` the documents declare, so it has to be
// served from this site at exactly that path.
const schemaTarget = join(here, '..', 'public', 'schema');
await mkdir(schemaTarget, { recursive: true });
await writeFile(
  join(schemaTarget, 'openresult-1.0.schema.json'),
  await readFile(join(repoRoot, 'schema/openresult-1.0.schema.json'), 'utf8'),
  'utf8',
);

await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, 'examples.ts'),
  `// Generated by generate/render-markdown.ts. Do not edit.\n` +
    `export interface ExampleEntry {\n` +
    `  path: string; domain: string; title: string; description: string;\n` +
    `  participants: number; results: number; rankings: number; measures: string[];\n` +
    `}\n` +
    `export const examples: ExampleEntry[] = ${JSON.stringify(examples, null, 2)};\n`,
  'utf8',
);

await writeFile(
  join(outDir, 'content.ts'),
  `// Generated by generate/render-markdown.ts. Do not edit.\n` +
    `/* eslint-disable */\n` +
    `export const specification = ${JSON.stringify(specification)} as const;\n` +
    `export const docs = ${JSON.stringify(Object.fromEntries(docPages))} as const;\n` +
    `export const adrs = ${JSON.stringify(adrs)} as const;\n`,
  'utf8',
);

console.log(
  `Rendered the specification (${specification.toc.length} headings), ` +
    `${docPages.length} doc pages, ${adrs.length} decision records ` +
    `and indexed ${examples.length} examples.`,
);
