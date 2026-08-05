import { json } from '@codemirror/lang-json';
import { linter, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
// basicSetup already bundles history, the default keymap, bracket matching and
// autocompletion — no need to assemble them by hand.
import { basicSetup } from 'codemirror';
import type { Diagnostic } from '@openresult/validate';
import { locate } from './locate.js';

export interface EditorOptions {
  parent: HTMLElement;
  initialValue: string;
  /** Called when the text settles, not on every keystroke. */
  onChange: (value: string) => void;
}

/**
 * The editor.
 *
 * Diagnostics are shown where they happen, in the gutter and under the token —
 * a code and a JSON Pointer in a side panel would leave the reader counting
 * braces.
 */
export class DocumentEditor {
  readonly view: EditorView;
  #diagnostics: Diagnostic[] = [];
  #debounce: number | undefined;

  constructor(options: EditorOptions) {
    const onDocChanged = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      window.clearTimeout(this.#debounce);
      this.#debounce = window.setTimeout(() => {
        options.onChange(this.value);
      }, 300);
    });

    this.view = new EditorView({
      parent: options.parent,
      state: EditorState.create({
        doc: options.initialValue,
        extensions: [
          basicSetup,
          json(),
          lintGutter(),
          linter(() => this.#toCodeMirror()),
          EditorView.lineWrapping,
          onDocChanged,
        ],
      }),
    });
  }

  get value(): string {
    return this.view.state.doc.toString();
  }

  set value(text: string) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
    });
  }

  /** Replace the diagnostics and refresh the gutter. */
  setDiagnostics(diagnostics: Diagnostic[]): void {
    this.#diagnostics = diagnostics;
    // Nudge the linter without changing the document.
    this.view.dispatch({});
  }

  #toCodeMirror(): CmDiagnostic[] {
    return this.#diagnostics.flatMap((entry) => {
      const range = locate(this.view.state, entry.path);
      if (range === null) return [];

      const message =
        entry.suggestion === undefined
          ? `${entry.code}: ${entry.message}`
          : `${entry.code}: ${entry.message}\n→ ${entry.suggestion}`;

      const diagnostic: CmDiagnostic = {
        from: range.from,
        to: Math.max(range.to, range.from + 1),
        severity: entry.severity === 'error' ? 'error' : 'warning',
        message,
        source: entry.rule,
      };
      return [diagnostic];
    });
  }

  focus(): void {
    this.view.focus();
  }
}
