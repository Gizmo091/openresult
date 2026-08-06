import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { locate } from '../src/locate.js';

/**
 * Pointing a diagnostic at the right token is what makes the playground worth
 * using: a code and a path in a side panel would leave the reader counting
 * braces.
 */

const DOC = `{
  "openresult": "1.0",
  "title": "Race",
  "measures": [
    { "id": "time", "label": "Time", "kind": "duration", "unit": "s", "betterWhen": "lower" }
  ],
  "participants": [
    { "id": "a", "name": "Ada" },
    { "id": "b", "name": "Bo" }
  ],
  "results": [
    { "participant": "a", "values": { "time": 20 } },
    { "participant": "ghost", "values": { "time": 10 } }
  ]
}`;

function state(doc = DOC): EditorState {
  return EditorState.create({ doc, extensions: [json()] });
}

function textAt(pointer: string, doc = DOC): string | null {
  const editorState = state(doc);
  const range = locate(editorState, pointer);
  return range === null ? null : editorState.doc.sliceString(range.from, range.to);
}

describe('locating a JSON Pointer', () => {
  it('finds a top-level value', () => {
    expect(textAt('/title')).toBe('"Race"');
  });

  it('finds a value inside an array element', () => {
    expect(textAt('/results/1/participant')).toBe('"ghost"');
  });

  it('finds a nested object member', () => {
    expect(textAt('/results/0/values/time')).toBe('20');
  });

  it('finds an array element itself', () => {
    expect(textAt('/participants/1')).toBe('{ "id": "b", "name": "Bo" }');
  });

  it('returns the whole document for the root pointer', () => {
    expect(textAt('/')).toBe(DOC);
    expect(textAt('')).toBe(DOC);
  });

  it('falls back to the deepest node it could reach', () => {
    // `/results/0/values/missing` does not exist; pointing at `values` is
    // still more useful than pointing nowhere.
    expect(textAt('/results/0/values/missing')).toBe('{ "time": 20 }');
  });

  it('handles an out-of-range index without throwing', () => {
    expect(() => textAt('/results/99/participant')).not.toThrow();
  });

  it('unescapes ~1 and ~0 as RFC 6901 requires', () => {
    const doc = '{ "a/b": 1, "c~d": 2 }';
    expect(textAt('/a~1b', doc)).toBe('1');
    expect(textAt('/c~0d', doc)).toBe('2');
  });

  it('survives a document that does not parse', () => {
    expect(() => textAt('/title', '{ "title": ')).not.toThrow();
  });

  it('never points at the wrong token when the parse cannot finish', () => {
    // The editor parses only part of a long document up front, and the rest
    // lazily. Asking the tree for a pointer near the end used to resolve
    // against whatever had been parsed so far — highlighting an arbitrary
    // token, or the opening brace, with nothing to signal it had gone wrong.
    // It surfaced as a test that failed roughly one run in three, always under
    // load: the same race, on a much smaller document.
    const filler = Array.from(
      { length: 20_000 },
      (_, index) => `    { "id": "p${index}", "name": "Competitor ${index}" }`,
    ).join(',\n');
    const long = `{\n  "participants": [\n${filler}\n  ],\n  "title": "Last of all"\n}`;

    // Either the right answer or none. On a machine under load the parse can
    // exceed its budget, and the first version of this fix fell back to the
    // partial tree — which is how the original bug came back. Asserting the
    // exact value made the test flake; asserting that it is never *wrong* is
    // what the code actually promises.
    const found = textAt('/title', long);
    expect(found === null || found === '"Last of all"').toBe(true);
  });

  it('still resolves a long document when it has time', () => {
    const filler = Array.from(
      { length: 2_000 },
      (_, index) => `    { "id": "p${index}", "name": "Competitor ${index}" }`,
    ).join(',\n');
    const long = `{\n  "participants": [\n${filler}\n  ],\n  "title": "Last of all"\n}`;

    // Small enough that the budget is never the question, so this one asserts
    // the value: the feature has to work, not merely fail safely.
    expect(textAt('/title', long)).toBe('"Last of all"');
  });
});
