import { NotOpenResultError, UnsupportedVersionError } from './errors.js';
import type { ResultDocument } from './types.js';

/** The format version this implementation understands. */
export const SUPPORTED_VERSION = { major: 1, minor: 0 } as const;

const VERSION_PATTERN = /^(\d+)\.(\d+)$/;

export interface FormatVersion {
  major: number;
  minor: number;
}

/**
 * True when the value looks like an OpenResult document. Cheap and total: it
 * never throws, so it can guard a branch before committing to `parse`.
 */
export function isOpenResult(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['openresult'] === 'string' && VERSION_PATTERN.test(candidate['openresult']);
}

/**
 * Read the declared format version.
 *
 * @throws {NotOpenResultError} when `openresult` is absent or malformed.
 */
export function formatVersion(document: ResultDocument): FormatVersion {
  const declared = document.openresult;
  const match = typeof declared === 'string' ? VERSION_PATTERN.exec(declared) : null;
  if (!match) {
    return failVersion(declared);
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function failVersion(declared: unknown): never {
  throw new NotOpenResultError(
    declared === undefined
      ? 'the "openresult" member is missing. Every document must declare the format version it ' +
          'conforms to, for example "openresult": "1.0".'
      : `"openresult": ${JSON.stringify(declared)} is not a MAJOR.MINOR version string.`,
  );
}

/**
 * Read a document from a JSON string or an already-decoded value.
 *
 * Performs no schema validation — that is `@openresult/validate`'s job, and
 * keeping it out is what lets a consumer read and rank without a validator.
 * The one thing checked here is the major version: a document from a future
 * major may mean something different by the same members, so it is refused
 * rather than misread.
 *
 * A higher *minor* version is read normally; unknown members are simply carried
 * along (spec §11.4).
 *
 * @throws {NotOpenResultError} when the input is not a readable document.
 * @throws {UnsupportedVersionError} when the major version is unknown.
 */
export function parse(input: string | unknown): ResultDocument {
  let value: unknown = input;

  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new NotOpenResultError(`the input is not valid JSON (${(error as Error).message}).`);
    }
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new NotOpenResultError('the document must be a JSON object.');
  }

  const document = value as ResultDocument;
  const version = formatVersion(document);

  if (version.major !== SUPPORTED_VERSION.major) {
    throw new UnsupportedVersionError(
      document.openresult,
      `${SUPPORTED_VERSION.major}.${SUPPORTED_VERSION.minor}`,
    );
  }

  if (!Array.isArray(document.participants)) {
    throw new NotOpenResultError('the "participants" member is missing or is not an array.');
  }
  if (!Array.isArray(document.results)) {
    throw new NotOpenResultError('the "results" member is missing or is not an array.');
  }

  return document;
}
