import './site.css';
import { examples, type ExampleEntry } from './generated/examples.js';
import { chrome, element } from './shell.js';

/**
 * The example gallery.
 *
 * Twenty documents across unlike domains, and the point of listing them together
 * is that the same viewer renders all of them with no configuration. Each entry
 * links to the viewer rather than showing a preview: a page holding twenty
 * rendered tables would take a second to load and tell the reader less.
 */

const { main } = chrome();

main.append(
  element('h1', {}, 'Examples'),
  element(
    'p',
    { class: 'lede' },
    'Twenty documents, twenty domains, one viewer and no configuration. Every one of them is ' +
      'valid against the published schema, and the repository refuses a commit that changes that.',
  ),
);

const byDomain = new Map<string, ExampleEntry[]>();
for (const entry of examples) {
  const list = byDomain.get(entry.domain) ?? [];
  list.push(entry);
  byDomain.set(entry.domain, list);
}

const DOMAIN_LABELS: Record<string, string> = {
  'ai-benchmark': 'AI benchmark',
  'cpu-benchmark': 'CPU benchmark',
  'edge-cases': 'Edge cases',
  esport: 'Esport',
  football: 'Football',
  hackathon: 'Hackathon',
  karting: 'Karting',
  motocross: 'Motocross',
  motorsport: 'Motorsport',
  'photo-contest': 'Photo contest',
  running: 'Running',
  sales: 'Sales',
  chess: 'Chess',
};

function label(domain: string): string {
  return (
    DOMAIN_LABELS[domain] ??
    domain.replace(/-/g, ' ').replace(/^./, (character) => character.toUpperCase())
  );
}

for (const [domain, entries] of [...byDomain].sort(([a], [b]) => a.localeCompare(b))) {
  main.append(element('h2', {}, label(domain)));

  const grid = element('div', { class: 'grid' });
  for (const entry of entries) {
    const card = element('article', { class: 'card' });

    const title = element('h3', { style: 'margin-top:0' });
    title.append(
      element(
        'a',
        { href: `/view/?url=${encodeURIComponent(`/examples/${entry.path}`)}` },
        entry.title,
      ),
    );
    card.append(title);

    if (entry.description !== '') {
      const text =
        entry.description.length > 260 ? `${entry.description.slice(0, 257)}…` : entry.description;
      card.append(element('p', { class: 'small' }, text));
    }

    const facts = element('p', { class: 'small muted' });
    facts.textContent =
      `${entry.participants} participants · ${entry.results} results · ` +
      `${entry.rankings} ranking${entry.rankings === 1 ? '' : 's'}`;
    card.append(facts);

    if (entry.measures.length > 0) {
      const measures = element('p', { class: 'small muted' });
      measures.textContent = `Measures: ${entry.measures.join(', ')}`;
      card.append(measures);
    }

    const row = element('div', { class: 'row', style: 'margin-top:.75rem' });
    row.append(
      element(
        'a',
        {
          class: 'button',
          href: `/view/?url=${encodeURIComponent(`/examples/${entry.path}`)}`,
        },
        'View',
      ),
      element('a', { class: 'button', href: `/examples/${entry.path}` }, 'Raw JSON'),
    );
    card.append(row);

    grid.append(card);
  }
  main.append(grid);
}
