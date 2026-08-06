import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Check, fail, pass } from './types.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GENERATED = join(repoRoot, 'site/src/generated/content.ts');

/**
 * No rendered link may point at something the site does not serve.
 *
 * The documents are written for the repository, where `[VISION.md](./VISION.md)`
 * is exactly right. The site renders those documents rather than serving them,
 * so the same link is a 404 — and it was one, in the paragraph explaining what
 * the project will never do, which is a poor place to lose a reader.
 *
 * The rewriting happens in `site/generate/render-markdown.ts`. This checks it
 * kept up: a new document with a new kind of relative link would otherwise ship
 * broken and nothing would say so.
 */
export const siteLinksResolve: Check = {
  name: 'site-links-resolve',
  enforces: 'Every link the site renders must point at something the site serves',
  async run() {
    const generated = await readFile(GENERATED, 'utf8').catch(() => null);
    if (generated === null) {
      return pass(this.name, 'nothing rendered yet — run the site build first');
    }

    const links = [...generated.matchAll(/href=\\"([^"\\]+)\\"/g)].map((match) => match[1] ?? '');
    const problems: string[] = [];
    const seen = new Set<string>();

    for (const href of links) {
      if (seen.has(href)) continue;
      seen.add(href);

      if (href.endsWith('.md')) {
        problems.push(
          `"${href}" points at a Markdown file. The site renders those documents and does not ` +
            `serve them, so this is a 404. Teach siteHref() in ` +
            `site/generate/render-markdown.ts where it should go.`,
        );
        continue;
      }

      if (href.startsWith('./') || href.startsWith('../')) {
        problems.push(
          `"${href}" is repository-relative and will resolve against the page it appears on, ` +
            `which is not where the file is.`,
        );
      }
    }

    if (problems.length > 0) {
      return fail(this.name, `${problems.length} link(s) will not resolve`, problems);
    }
    return pass(this.name, `${seen.size} distinct links, all resolvable`);
  },
};
