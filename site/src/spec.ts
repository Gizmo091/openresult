import './site.css';
import './prose.css';
import { specification } from './generated/content.js';
import { chrome, element } from './shell.js';

/**
 * The specification, rendered from the repository's own Markdown at build time.
 *
 * The sidebar tracks which section is on screen, because the document is long
 * and the commonest way to arrive is a link to one rule inside it.
 */

const { main } = chrome();
main.className = '';
main.removeAttribute('style');

const layout = element('div', { class: 'doc-layout' });

const nav = element('nav', { class: 'doc-nav', 'aria-label': 'Table of contents' });
const list = element('ol');
for (const entry of specification.toc) {
  const item = element('li', { class: `depth-${entry.depth}` });
  item.append(element('a', { href: `#${entry.id}` }, entry.text));
  list.append(item);
}
nav.append(list);

const body = element('article', { class: 'doc-body' });
// Trusted input: this string is the repository's own specification, converted at
// build time. Nothing a visitor supplies reaches here.
body.innerHTML = specification.html;

layout.append(nav, body);
main.replaceWith(layout);

// Highlight the section currently in view.
const links = new Map<string, HTMLAnchorElement>();
for (const link of nav.querySelectorAll('a')) {
  links.set((link.getAttribute('href') ?? '').slice(1), link);
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of links.values()) link.classList.remove('current');
      links.get(entry.target.id)?.classList.add('current');
    }
  },
  // Only headings near the top of the viewport count as "where you are";
  // without the negative bottom margin every heading on a tall screen fights
  // for the highlight. Pixels, not rem: rootMargin accepts px and % only, and
  // anything else throws when the observer is constructed.
  { rootMargin: '-64px 0px -75% 0px', threshold: 0 },
);

for (const heading of body.querySelectorAll('h2[id], h3[id]')) observer.observe(heading);
