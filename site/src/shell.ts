/**
 * The bits every page repeats: the masthead, the footer, and marking the
 * current section.
 *
 * Written as DOM rather than a template string so that nothing on this site
 * builds HTML by concatenation. Pages here display documents that strangers
 * supply; getting into the habit of `innerHTML +=` is how one of them ends up
 * executing.
 */

interface Section {
  href: string;
  label: string;
}

const SECTIONS: Section[] = [
  { href: '/spec/', label: 'Specification' },
  { href: '/produce/', label: 'Produce' },
  { href: '/examples/', label: 'Examples' },
  { href: '/view/', label: 'Viewer' },
  { href: '/validate/', label: 'Validator' },
  { href: '/playground/', label: 'Playground' },
  { href: '/docs/', label: 'Docs' },
];

export function markCurrentSection(): void {
  const path = window.location.pathname;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.masthead nav a')) {
    const href = link.getAttribute('href') ?? '';
    if (href.length > 1 && path.startsWith(href)) link.setAttribute('aria-current', 'page');
  }
}

/** Build the shared chrome for a page that renders itself from script. */
export function chrome(): { main: HTMLElement } {
  const header = element('header', { class: 'masthead' });
  const bar = element('div');
  const wordmark = element('a', { class: 'wordmark', href: '/' });
  wordmark.append('Open', element('span', {}, 'Result'));
  bar.append(wordmark);

  const nav = element('nav');
  for (const section of SECTIONS) {
    nav.append(element('a', { href: section.href }, section.label));
  }
  bar.append(nav, element('span', { class: 'spacer' }));

  const right = element('nav');
  right.append(element('a', { href: 'https://github.com/Gizmo091/openresult' }, 'GitHub'));
  bar.append(right);
  header.append(bar);

  const main = element('main', { id: 'main' });

  const footer = element('footer', { class: 'site' });
  const footerRow = element('div');
  footerRow.append(
    element('span', {}, 'Specification and docs: CC BY 4.0. Code: Apache 2.0.'),
    element('a', { href: 'https://github.com/Gizmo091/openresult' }, 'Source'),
    element('a', { href: '/schema/openresult-1.0.schema.json' }, 'JSON Schema'),
  );
  footer.append(footerRow);

  document.body.append(header, main, footer);
  markCurrentSection();
  return { main };
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
