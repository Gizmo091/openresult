import type { ResultDocument } from '@openresult/core';
import '../src/index.js';
import type { OpenResultViewer } from '../src/index.js';

/**
 * Development harness for the viewer.
 *
 * Loads the whole example library so a change can be checked against eleven
 * unlike domains at once — the fastest way to notice that a view has quietly
 * started to assume something.
 *
 * The "drop the presentation layer" switch is the interesting one: nothing on
 * screen should change except column order.
 */

const modules = import.meta.glob<{ default: ResultDocument }>(
  '../../examples/**/*.openresult.json',
  { eager: true },
);

const documents = Object.entries(modules)
  .map(([path, module]) => ({
    path: path.replace('../../examples/', ''),
    document: module.default,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) throw new Error(`Demo markup is missing ${selector}.`);
  return found;
}

const viewer = required<OpenResultViewer>('#viewer');
const picker = required<HTMLSelectElement>('#example');
const compact = required<HTMLInputElement>('#compact');
const strip = required<HTMLInputElement>('#strip');

picker.append(
  ...documents.map(({ path, document: source }) => {
    const option = document.createElement('option');
    option.value = path;
    option.textContent = `${path} — ${source.title}`;
    return option;
  }),
);

function show(): void {
  const chosen = documents.find((entry) => entry.path === picker.value) ?? documents[0];
  if (chosen === undefined) return;

  const copy = structuredClone(chosen.document);
  if (strip.checked) delete copy.presentation;

  viewer.view = undefined;
  viewer.document = copy;
}

picker.addEventListener('change', show);
strip.addEventListener('change', show);
compact.addEventListener('change', () => {
  viewer.compact = compact.checked;
});

viewer.addEventListener('or-error', (event) => {
  console.error('or-error', (event as CustomEvent).detail);
});

const requested = new URLSearchParams(window.location.search).get('src');
if (requested !== null) {
  const match = documents.find((entry) => requested.endsWith(entry.path));
  if (match !== undefined) picker.value = match.path;
}

show();
