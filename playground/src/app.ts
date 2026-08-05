import { parse, type ResultDocument } from '@openresult/core';
import { validate, type ValidationReport } from '@openresult/validate';
import '@openresult/viewer';
import type { OpenResultViewer } from '@openresult/viewer';
import { DocumentEditor } from './editor.js';
import { examples, findExample, STARTER } from './examples.js';
import { decodeFragment, encodeDocument } from './share.js';

/**
 * The playground.
 *
 * Paste a document, see it rendered and validated as you type. No button to
 * press: a format that takes a round-trip to try is a format people stop
 * trying.
 */

function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing element: ${selector}`);
  return found;
}

const editorHost = required<HTMLDivElement>('#editor');
const viewer = required<OpenResultViewer>('#viewer');
const picker = required<HTMLSelectElement>('#example');
const verdict = required<HTMLDivElement>('#verdict');
const problems = required<HTMLUListElement>('#problems');
const shareButton = required<HTMLButtonElement>('#share');
const shareNote = required<HTMLSpanElement>('#share-note');
const viewerPanel = required<HTMLDivElement>('#viewer-panel');

picker.append(
  ...examples.map((example) => {
    const option = document.createElement('option');
    option.value = example.path;
    option.textContent = example.path;
    return option;
  }),
);

const editor = new DocumentEditor({
  parent: editorHost,
  initialValue: STARTER,
  onChange: (value) => update(value),
});

function update(text: string): void {
  const trimmed = text.trim();

  if (trimmed === '') {
    setVerdict('idle', 'Nothing to check yet');
    editor.setDiagnostics([]);
    problems.replaceChildren();
    showViewer(undefined);
    return;
  }

  const report = validate(trimmed);
  editor.setDiagnostics([...report.errors, ...report.warnings]);
  renderProblems(report);

  // Render whatever can be read. A document with warnings — or with errors
  // that do not prevent reading — is still worth showing: seeing the effect of
  // a mistake is how the reader learns what the field means.
  showViewer(readQuietly(trimmed));
}

function readQuietly(text: string): ResultDocument | undefined {
  try {
    return parse(text);
  } catch {
    return undefined;
  }
}

function showViewer(document_: ResultDocument | undefined): void {
  if (document_ === undefined) {
    viewerPanel.dataset['state'] = 'empty';
    return;
  }
  viewerPanel.dataset['state'] = 'ready';
  viewer.view = undefined;
  viewer.document = document_;
}

function renderProblems(report: ValidationReport): void {
  const entries = [...report.errors, ...report.warnings];

  if (entries.length === 0) {
    setVerdict('ok', 'Conforming');
  } else if (report.errors.length > 0) {
    setVerdict(
      'error',
      `${report.errors.length} error${report.errors.length > 1 ? 's' : ''}` +
        (report.warnings.length > 0 ? `, ${report.warnings.length} warning` : ''),
    );
  } else {
    setVerdict('warn', `Conforming, with ${report.warnings.length} warning`);
  }

  problems.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement('li');
      item.className = `problem problem-${entry.severity}`;

      const code = document.createElement('span');
      code.className = 'problem-code';
      code.textContent = entry.code;

      const path = document.createElement('code');
      path.className = 'problem-path';
      path.textContent = entry.path;

      const message = document.createElement('p');
      message.className = 'problem-message';
      message.textContent = entry.message;

      item.append(code, path, message);

      if (entry.suggestion !== undefined) {
        const suggestion = document.createElement('p');
        suggestion.className = 'problem-suggestion';
        suggestion.textContent = entry.suggestion;
        item.append(suggestion);
      }

      return item;
    }),
  );
}

function setVerdict(state: 'idle' | 'ok' | 'warn' | 'error', text: string): void {
  verdict.className = `verdict verdict-${state}`;
  verdict.textContent = text;
}

picker.addEventListener('change', () => {
  void (async () => {
    const example = findExample(picker.value);
    if (example === undefined) return;
    const loaded = await example.load();
    editor.value = `${JSON.stringify(loaded, null, 2)}\n`;
    update(editor.value);
  })();
});

shareButton.addEventListener('click', () => {
  void (async () => {
    const fragment = await encodeDocument(editor.value);
    const url = `${window.location.origin}${window.location.pathname}${fragment}`;

    try {
      await navigator.clipboard.writeText(url);
      shareNote.textContent = 'Link copied';
    } catch {
      window.location.hash = fragment.slice(1);
      shareNote.textContent = 'Link is in the address bar';
    }
    window.setTimeout(() => {
      shareNote.textContent = '';
    }, 4000);
  })();
});

async function start(): Promise<void> {
  const shared = await decodeFragment(window.location.hash);
  if (shared !== null) {
    editor.value = shared;
  }
  update(editor.value);
  editor.focus();
}

void start();
