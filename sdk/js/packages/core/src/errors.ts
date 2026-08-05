/**
 * Errors raised while reading a document.
 *
 * The core is deliberately forgiving: it throws only when a document cannot be
 * read at all. A document that is structurally readable but semantically
 * questionable yields a defined result — typically an unranked entry — and the
 * complaint belongs to `@openresult/validate`.
 */

export class OpenResultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OpenResultError';
    this.code = code;
  }
}

/** The document declares a major version this implementation cannot interpret (spec §11.4.1). */
export class UnsupportedVersionError extends OpenResultError {
  readonly found: string;
  readonly supported: string;

  constructor(found: string, supported: string) {
    super(
      'OR-402',
      `This document declares OpenResult ${found}, but this implementation supports ` +
        `${supported}. A different major version may have incompatible semantics, so it is ` +
        `not interpreted rather than guessed at.`,
    );
    this.name = 'UnsupportedVersionError';
    this.found = found;
    this.supported = supported;
  }
}

/** The input is not an OpenResult document at all. */
export class NotOpenResultError extends OpenResultError {
  constructor(detail: string) {
    super('OR-401', `Not an OpenResult document: ${detail}`);
    this.name = 'NotOpenResultError';
  }
}
