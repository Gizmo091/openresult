import './site.css';
import './prose.css';
import { adrs, docs } from './generated/content.js';
import { chrome, element } from './shell.js';

/**
 * Vision, roadmap and the decision records.
 *
 * The ADRs are the part worth reading twice: each one carries the alternatives
 * that were turned down and why, which is the only honest way to explain a
 * format's shape. Several exist because an outside reader broke something.
 */

const { main } = chrome();
main.className = '';

const layout = element('div', { class: 'doc-layout' });
const nav = element('nav', { class: 'doc-nav', 'aria-label': 'Contents' });
const body = element('article', { class: 'doc-body' });
layout.append(nav, body);
main.replaceWith(layout);

type PageKey = 'vision' | 'roadmap' | string;

function navigate(key: PageKey): void {
  body.replaceChildren();

  if (key === 'vision' || key === 'roadmap') {
    // Trusted input: rendered from this repository's own Markdown at build time.
    body.innerHTML = docs[key].html;
  } else {
    const record = adrs.find((entry) => entry.slug === key);
    if (record === undefined) {
      body.append(element('h1', {}, 'Not found'));
      return;
    }
    body.innerHTML = record.html;
  }

  for (const link of nav.querySelectorAll('a')) {
    link.classList.toggle('current', link.dataset['key'] === key);
  }

  history.replaceState({}, '', `/docs/?p=${encodeURIComponent(key)}`);
  body.scrollIntoView({ block: 'start', behavior: 'instant' });
}

function navEntry(key: string, label: string): HTMLLIElement {
  const item = element('li');
  const link = element('a', { href: `/docs/?p=${encodeURIComponent(key)}` }, label);
  link.dataset['key'] = key;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(key);
  });
  item.append(link);
  return item;
}

const list = element('ol');
list.append(navEntry('vision', 'Vision'), navEntry('roadmap', 'Roadmap'));

const heading = element('li', { class: 'depth-2', style: 'margin-top:1rem' });
heading.append(element('strong', { class: 'small muted' }, 'Decision records'));
list.append(heading);

for (const record of adrs) {
  list.append(navEntry(record.slug, `${record.id} — ${record.title}`));
}
nav.append(list);

const requested = new URLSearchParams(window.location.search).get('p');
navigate(requested ?? 'vision');
