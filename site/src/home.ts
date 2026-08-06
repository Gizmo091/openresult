import { packages } from './generated/packages.js';
import { element } from './shell.js';

/**
 * The one dynamic part of an otherwise static home page: the published
 * packages.
 *
 * Names and versions come from the manifests at build time, so the page cannot
 * advertise a version that was never released — or, more likely, keep
 * advertising one two releases after the fact.
 *
 * It imports the package list alone and not `content.ts`, which carries the
 * whole rendered specification. A reader of the home page has no business
 * downloading 170 kB of it to see four names.
 */

const slot = document.querySelector('#packages');

if (slot !== null && packages.length > 0) {
  const grid = element('div', { class: 'grid' });

  for (const entry of packages) {
    const card = element('article', { class: 'card' });

    const title = element('h3', { style: 'margin-top:0' });
    title.append(
      element(
        'a',
        { href: `https://www.npmjs.com/package/${entry.name}` },
        entry.name.replace('@openresult/', ''),
      ),
    );
    card.append(title);

    card.append(element('p', { class: 'small' }, entry.description));

    const install = element('pre', { style: 'margin:.75rem 0 .5rem' });
    install.append(element('code', {}, `npm i ${entry.name}`));
    card.append(install);

    const meta = element('p', { class: 'small muted', style: 'margin:0' });
    meta.append(element('span', { class: 'tag' }, `v${entry.version}`), ' ');
    meta.append(
      element(
        'a',
        { href: `https://github.com/Gizmo091/openresult/tree/main/${entry.path}` },
        'source',
      ),
    );
    card.append(meta);

    grid.append(card);
  }

  slot.replaceWith(grid);
}
