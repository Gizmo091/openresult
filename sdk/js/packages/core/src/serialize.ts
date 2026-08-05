import type { ResultDocument } from './types.js';

export interface SerializeOptions {
  /** Indentation width. 0 or undefined produces compact output. */
  indent?: number;
}

/**
 * Write a document back to JSON.
 *
 * Everything is preserved, including extensions and members this version does
 * not know about — the *rewriting* conformance level (spec §11.5.4). Nothing is
 * normalised on the way out: a consumer that quietly dropped what it did not
 * understand would make round-tripping lossy, and a producer could not trust
 * any tool that touched its documents.
 */
export function serialize(document: ResultDocument, options: SerializeOptions = {}): string {
  const indent = options.indent ?? 0;
  return JSON.stringify(document, null, indent > 0 ? indent : undefined);
}
