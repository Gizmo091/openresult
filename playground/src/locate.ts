import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

export interface Range {
  from: number;
  to: number;
}

/**
 * Resolve an RFC 6901 JSON Pointer to a range in the editor.
 *
 * Walks CodeMirror's syntax tree rather than parsing the text again: the tree
 * is already there, it survives a document that does not parse as JSON, and it
 * gives exact offsets. A diagnostic that cannot point at the offending token is
 * a diagnostic the reader has to hunt for.
 */
export function locate(state: EditorState, pointer: string): Range | null {
  const segments = parsePointer(pointer);
  const tree = syntaxTree(state);

  let node = tree.topNode.firstChild;
  if (node === null) return null;

  for (const segment of segments) {
    const next = descend(state, node, segment);
    if (next === null) {
      // As deep as we could go: pointing at the parent still beats pointing
      // at nothing.
      return { from: node.from, to: node.to };
    }
    node = next;
  }

  return { from: node.from, to: node.to };
}

function parsePointer(pointer: string): string[] {
  if (pointer === '' || pointer === '/') return [];
  return pointer
    .replace(/^\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

type Node = NonNullable<ReturnType<typeof syntaxTree>['topNode']['firstChild']>;

function descend(state: EditorState, node: Node, segment: string): Node | null {
  if (node.name === 'Array') return arrayItem(node, Number(segment));
  if (node.name === 'Object') return objectValue(state, node, segment);
  return null;
}

function arrayItem(array: Node, index: number): Node | null {
  if (!Number.isInteger(index) || index < 0) return null;

  let position = 0;
  for (let child = array.firstChild; child !== null; child = child.nextSibling) {
    if (child.name === '[' || child.name === ']' || child.name === ',') continue;
    if (position === index) return child;
    position += 1;
  }
  return null;
}

function objectValue(state: EditorState, object: Node, key: string): Node | null {
  for (let child = object.firstChild; child !== null; child = child.nextSibling) {
    if (child.name !== 'Property') continue;

    const name = child.firstChild;
    if (name === null) continue;

    // The property name node includes its quotes.
    const text = state.doc.sliceString(name.from, name.to);
    if (unquote(text) !== key) continue;

    // The value is the last child of the property.
    const value = child.lastChild;
    return value === null || value === name ? child : value;
  }
  return null;
}

function unquote(text: string): string {
  if (!text.startsWith('"')) return text;
  try {
    return JSON.parse(text) as string;
  } catch {
    return text.slice(1, -1);
  }
}
