import './site.css';
import './view.css';
import '@openresult/viewer';
import type { OpenResultViewer } from '@openresult/viewer';
import { parse, type ResultDocument } from '@openresult/core';
import { validate } from '@openresult/validate';
import { chrome, element } from './shell.js';

/**
 * The viewer page.
 *
 * A document arrives one of four ways: posted by another service, named in the
 * query string, pasted, or dropped on the page. All four converge on `show`.
 *
 * Rendering happens in the browser. A posted document is handed to this page and
 * never stored, and a URL is fetched through `/api/fetch` only because browsers
 * refuse cross-origin reads — the server passes bytes through and keeps none.
 */

const { main } = chrome();
const shell = element('div', { class: 'view-shell', id: 'main' });
main.replaceWith(shell);

function show(source: ResultDocument, origin: string): void {
  shell.replaceChildren();

  const bar = element('div', { class: 'result-bar' });
  bar.append(element('span', { class: 'title' }, source.title));
  bar.append(element('span', { class: 'tag' }, origin));

  const again = element('button', { type: 'button' }, 'Load another');
  again.addEventListener('click', () => {
    history.pushState({}, '', '/view/');
    renderLoader();
  });
  bar.append(again);

  const download = element('a', {
    class: 'button',
    download: 'document.openresult.json',
    href: URL.createObjectURL(
      new Blob([JSON.stringify(source, null, 2)], { type: 'application/json' }),
    ),
  });
  download.textContent = 'Download';
  bar.append(download);

  shell.append(bar);

  const report = validate(source);
  if (report.errors.length > 0 || report.warnings.length > 0) {
    const list = element('ul', { class: 'diagnostics' });
    for (const entry of [...report.errors, ...report.warnings]) {
      const item = element('li', { class: entry.severity });
      item.append(element('code', {}, `${entry.code} ${entry.path}`), ' ', entry.message);
      list.append(item);
    }
    shell.append(list);
  }

  const viewer = document.createElement('openresult-viewer') as OpenResultViewer;
  viewer.document = source;
  shell.append(viewer);
  shell.append(apiHelp());
}

function fail(message: string, detail?: string): void {
  const notice = element('div', { class: 'notice error' });
  notice.append(element('strong', {}, message));
  if (detail !== undefined) notice.append(document.createElement('br'), detail);
  shell.prepend(notice);
}

/** Parse text as a document, reporting what is wrong rather than throwing. */
function accept(text: string, origin: string): void {
  let source: ResultDocument;
  try {
    source = parse(text);
  } catch (error) {
    renderLoader();
    fail(
      'That is not an OpenResult document.',
      error instanceof Error ? error.message : String(error),
    );
    return;
  }
  show(source, origin);
}

function renderLoader(): void {
  shell.replaceChildren();

  const heading = element('h1', {}, 'Viewer');
  const lede = element(
    'p',
    { class: 'lede' },
    'Paste a document, drop a file, give it a URL — or post one from your own service. ' +
      'Rendering happens in your browser.',
  );
  shell.append(heading, lede);

  const loader = element('div', { class: 'loader' });

  // --- paste -----------------------------------------------------------
  const pasteCard = element('div', { class: 'card' });
  pasteCard.append(
    element('h2', {}, 'Paste a document'),
    element('p', { class: 'hint' }, 'The JSON itself. Nothing leaves the page.'),
  );
  const textarea = element('textarea', {
    spellcheck: 'false',
    'aria-label': 'OpenResult document',
    placeholder: '{ "openresult": "1.0", … }',
  });
  const pasteButton = element('button', { type: 'button', class: 'primary' }, 'Render');
  pasteButton.addEventListener('click', () => {
    if (textarea.value.trim() === '') {
      fail('Nothing to render.', 'Paste a document into the box first.');
      return;
    }
    accept(textarea.value, 'pasted');
  });
  pasteCard.append(textarea, element('div', { style: 'height:.75rem' }), pasteButton);

  // --- url and file ----------------------------------------------------
  const urlCard = element('div', { class: 'card' });
  urlCard.append(
    element('h2', {}, 'Fetch a URL'),
    element(
      'p',
      { class: 'hint' },
      'Fetched through this site, because browsers block cross-origin reads. Nothing is stored.',
    ),
  );

  const form = element('form');
  const field = element('label', { class: 'field' });
  field.append(element('span', {}, 'Document URL'));
  const input = element('input', {
    type: 'url',
    name: 'url',
    placeholder: 'https://example.org/results.json',
    required: 'required',
  });
  field.append(input);
  form.append(field);
  form.append(element('button', { type: 'submit', class: 'primary' }, 'Fetch and render'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void load(input.value);
  });
  urlCard.append(form);

  const drop = element('div', { class: 'dropzone' }, 'or drop a .json file here');
  const picker = element('input', { type: 'file', accept: '.json,application/json' });
  picker.style.display = 'none';
  drop.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    if (file !== undefined) void file.text().then((text) => accept(text, file.name));
  });

  for (const name of ['dragenter', 'dragover'] as const) {
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add('over');
    });
  }
  for (const name of ['dragleave', 'drop'] as const) {
    drop.addEventListener(name, () => drop.classList.remove('over'));
  }
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file !== undefined) void file.text().then((text) => accept(text, file.name));
  });

  urlCard.append(element('div', { style: 'height:1rem' }), drop, picker);

  loader.append(pasteCard, urlCard);
  shell.append(loader);
  shell.append(apiHelp());
}

async function load(url: string): Promise<void> {
  shell.replaceChildren(element('p', { class: 'muted' }, `Fetching ${url}…`));

  let target: URL;
  try {
    // Relative URLs are how the example gallery links here, and they are also
    // what someone types first. Resolving against this page makes both work.
    target = new URL(url, window.location.href);
  } catch {
    renderLoader();
    fail('That is not a URL.', url);
    return;
  }

  // Same origin needs no proxy: the browser may read it directly, and the
  // detour would only add a hop and an SSRF check for our own files.
  const request =
    target.origin === window.location.origin
      ? target.href
      : `/api/fetch?url=${encodeURIComponent(target.href)}`;

  try {
    const response = await fetch(request);
    const text = await response.text();
    if (!response.ok) {
      renderLoader();
      fail('That URL could not be fetched.', text.slice(0, 300));
      return;
    }
    accept(text, target.hostname === window.location.hostname ? target.pathname : target.hostname);
  } catch (error) {
    renderLoader();
    fail('That URL could not be fetched.', error instanceof Error ? error.message : String(error));
  }
}

function apiHelp(): HTMLElement {
  const details = element('details', { class: 'api' });
  details.append(element('summary', {}, 'Posting a document from your own service'));

  const intro = element(
    'p',
    { class: 'small muted' },
    'Both forms return a rendered page. Nothing is stored: the document is rendered into the ' +
      'response and forgotten.',
  );

  const pre = element('pre');
  pre.append(
    element(
      'code',
      {},
      `# The document itself
curl -X POST https://openresult.dev/view \\
     -H 'Content-Type: application/json' \\
     --data-binary @results.json

# A URL to fetch
curl -X POST https://openresult.dev/view \\
     -d 'url=https://example.org/results.json'

# Or as a link
https://openresult.dev/view?url=https%3A%2F%2Fexample.org%2Fresults.json`,
    ),
  );

  const html = element('p', { class: 'small muted' });
  html.append(
    'From a page of your own, an ordinary form works too: ',
    element('code', {}, '<form method="post" action="https://openresult.dev/view">'),
    ' with a ',
    element('code', {}, 'json'),
    ' or ',
    element('code', {}, 'url'),
    ' field.',
  );

  details.append(intro, pre, html);
  return details;
}

// --- entry -------------------------------------------------------------

const island = document.querySelector('#posted-document');
const posted = island?.textContent?.trim() ?? '';
const requested = new URLSearchParams(window.location.search).get('url');

if (posted !== '') {
  accept(posted, 'posted');
} else if (requested !== null && requested !== '') {
  void load(requested);
} else {
  renderLoader();
}

window.addEventListener('popstate', () => {
  if (window.location.pathname === '/view/' && window.location.search === '') renderLoader();
});
