import { validate, type Diagnostic } from '@openresult/validate';
import { MARKS, summarise, type VerdictState } from './verdict.js';

/**
 * Browser validator.
 *
 * Everything runs locally: the document is never sent anywhere. That is not a
 * detail — results are routinely provisional, and a producer should be able to
 * check one before deciding to publish it.
 *
 * Like the command line, this holds no validation rule of its own.
 */

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing element: ${id}`);
  return found as T;
};

const editor = el<HTMLTextAreaElement>('document');
const dropzone = el<HTMLDivElement>('dropzone');
const filePicker = el<HTMLInputElement>('file');
const urlForm = el<HTMLFormElement>('url-form');
const urlInput = el<HTMLInputElement>('url');
const strict = el<HTMLInputElement>('strict');
const schemaOnly = el<HTMLInputElement>('schema-only');
const clearButton = el<HTMLButtonElement>('clear');
const verdict = el<HTMLDivElement>('verdict');
const verdictText = el<HTMLSpanElement>('verdict-text');
const verdictMark = verdict.querySelector<HTMLSpanElement>('.verdict-mark');
const diagnostics = el<HTMLUListElement>('diagnostics');

let debounce: number | undefined;

function scheduleRun(): void {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(run, 250);
}

function run(): void {
  const content = editor.value.trim();

  if (content === '') {
    setVerdict('idle', 'Waiting for a document');
    diagnostics.replaceChildren();
    return;
  }

  const report = validate(content, {
    strict: strict.checked,
    schemaOnly: schemaOnly.checked,
  });

  render(report);
}

function render(report: ReturnType<typeof validate>): void {
  const entries = [...report.errors, ...report.warnings];
  const summary = summarise(report, strict.checked);

  setVerdict(summary.state, summary.text);
  diagnostics.replaceChildren(...entries.map(renderDiagnostic));
}

function setVerdict(state: VerdictState, text: string): void {
  verdict.className = `verdict verdict-${state}`;
  if (verdictMark !== null) {
    verdictMark.textContent = MARKS[state];
  }
  verdictText.textContent = text;
}

function renderDiagnostic(entry: Diagnostic): HTMLLIElement {
  const item = document.createElement('li');
  item.className = `diagnostic diagnostic-${entry.severity}`;

  const head = document.createElement('div');
  head.className = 'diagnostic-head';

  const code = document.createElement('span');
  code.className = 'diagnostic-code';
  code.textContent = entry.code;

  const path = document.createElement('code');
  path.className = 'diagnostic-path';
  path.textContent = entry.path;

  head.append(code, path);

  const message = document.createElement('p');
  message.className = 'diagnostic-message';
  message.textContent = entry.message;

  item.append(head, message);

  if (entry.suggestion !== undefined) {
    const suggestion = document.createElement('p');
    suggestion.className = 'diagnostic-suggestion';
    suggestion.textContent = entry.suggestion;
    item.append(suggestion);
  }

  const rule = document.createElement('p');
  rule.className = 'diagnostic-rule';
  rule.textContent = entry.rule;
  item.append(rule);

  return item;
}

async function loadFile(file: File): Promise<void> {
  editor.value = await file.text();
  run();
}

// Drag and drop, click, and keyboard all reach the same picker: a file input
// alone is unusable with a pointer, and a dropzone alone is unusable without.
dropzone.addEventListener('click', () => filePicker.click());
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    filePicker.click();
  }
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dropzone-active');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone-active'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dropzone-active');
  const file = event.dataTransfer?.files[0];
  if (file !== undefined) void loadFile(file);
});

filePicker.addEventListener('change', () => {
  const file = filePicker.files?.[0];
  if (file !== undefined) void loadFile(file);
});

urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadUrl(urlInput.value.trim());
});

async function loadUrl(url: string): Promise<void> {
  if (url === '') return;

  setVerdict('idle', `Loading ${url}…`);
  diagnostics.replaceChildren();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      setVerdict('error', `${url} returned ${response.status} ${response.statusText}`);
      return;
    }
    editor.value = await response.text();
    run();
  } catch (error) {
    // Almost always CORS. Saying so saves the reader a long detour through
    // their network tab.
    setVerdict(
      'error',
      `Could not load ${url}. The server may not allow cross-origin requests — ` +
        `download the file and drop it here instead.`,
    );
    console.error(error);
  }
}

clearButton.addEventListener('click', () => {
  editor.value = '';
  urlInput.value = '';
  run();
  editor.focus();
});

editor.addEventListener('input', scheduleRun);
strict.addEventListener('change', run);
schemaOnly.addEventListener('change', run);

run();
