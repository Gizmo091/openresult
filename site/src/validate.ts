import './site.css';
import './view.css';
import { parse, type ResultDocument } from '@openresult/core';
import { validate, type Diagnostic } from '@openresult/validate';
import { chrome, element } from './shell.js';

/**
 * The validator.
 *
 * Runs entirely in the page: a document pasted here is never sent anywhere,
 * which matters because results are often embargoed until they are published.
 *
 * Every diagnostic cites the rule it comes from, and links to it. A validator
 * that says "invalid" and stops teaches nobody anything.
 */

const { main } = chrome();

main.append(
  element('h1', {}, 'Validator'),
  element(
    'p',
    { class: 'lede' },
    'Check a document against the specification. Every diagnostic names the rule behind it. ' +
      'Nothing you paste leaves your browser.',
  ),
);

const textarea = element('textarea', {
  spellcheck: 'false',
  'aria-label': 'OpenResult document',
  placeholder: '{ "openresult": "1.0", … }',
});
main.append(textarea);

const controls = element('div', { class: 'row', style: 'margin:1rem 0' });
const run = element('button', { type: 'button', class: 'primary' }, 'Validate');
const sample = element('button', { type: 'button' }, 'Load an example');
controls.append(run, sample);
main.append(controls);

const output = element('div');
main.append(output);

function ruleLink(rule: string): HTMLElement | null {
  if (rule === '') return null;
  // "spec §8.1.1" → the section anchor "81-scope" cannot be derived from the
  // rule number alone, so link to the specification and let the reader's find
  // do the rest. Better an honest link than a broken anchor.
  return element('a', { href: '/spec/', class: 'small' }, rule);
}

function renderDiagnostics(entries: Diagnostic[], severity: 'error' | 'warning'): HTMLElement {
  const list = element('ul', { class: 'diagnostics' });
  for (const entry of entries) {
    const item = element('li', { class: severity });
    item.append(element('code', {}, `${entry.code} ${entry.path}`));
    item.append(document.createElement('br'));
    item.append(entry.message);
    if (entry.suggestion !== undefined) {
      item.append(document.createElement('br'));
      item.append(element('span', { class: 'muted small' }, entry.suggestion));
    }
    const link = ruleLink(entry.rule);
    if (link !== null) {
      item.append(' ');
      item.append(link);
    }
    list.append(item);
  }
  return list;
}

function check(): void {
  output.replaceChildren();

  if (textarea.value.trim() === '') {
    output.append(element('div', { class: 'notice' }, 'Paste a document first.'));
    return;
  }

  let source: ResultDocument;
  try {
    source = parse(textarea.value);
  } catch (error) {
    const notice = element('div', { class: 'notice error' });
    notice.append(
      element('strong', {}, 'Not an OpenResult document.'),
      document.createElement('br'),
      error instanceof Error ? error.message : String(error),
    );
    output.append(notice);
    return;
  }

  const report = validate(source);

  if (report.errors.length === 0 && report.warnings.length === 0) {
    output.append(element('div', { class: 'notice ok' }, 'Valid. No errors, no warnings.'));
  } else if (report.errors.length === 0) {
    output.append(
      element(
        'div',
        { class: 'notice ok' },
        `Valid, with ${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}.`,
      ),
    );
  } else {
    output.append(
      element(
        'div',
        { class: 'notice error' },
        `${report.errors.length} error${report.errors.length === 1 ? '' : 's'}` +
          (report.warnings.length > 0 ? `, ${report.warnings.length} warning(s).` : '.'),
      ),
    );
  }

  if (report.errors.length > 0) {
    output.append(element('h2', {}, 'Errors'), renderDiagnostics(report.errors, 'error'));
  }
  if (report.warnings.length > 0) {
    output.append(element('h2', {}, 'Warnings'), renderDiagnostics(report.warnings, 'warning'));
  }

  if (report.errors.length === 0) {
    const row = element('div', { class: 'row', style: 'margin-top:1.5rem' });
    const view = element('button', { type: 'button', class: 'primary' }, 'Render it');
    view.addEventListener('click', () => {
      const form = element('form', { method: 'post', action: '/view' });
      const field = element('input', { type: 'hidden', name: 'json' });
      field.value = textarea.value;
      form.append(field);
      document.body.append(form);
      form.submit();
    });
    row.append(view);
    output.append(row);
  }
}

run.addEventListener('click', check);

sample.addEventListener('click', () => {
  void fetch('/examples/motocross/regional-round-3.openresult.json')
    .then((response) => response.text())
    .then((text) => {
      textarea.value = text;
      check();
    });
});
