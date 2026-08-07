/**
 * @openresult/core — read, inspect and rank OpenResult documents.
 *
 * No runtime dependency, by contract: reading and ranking a document must never
 * require more than a JSON parser. Schema validation lives in
 * `@openresult/validate` and is never needed to interpret a document.
 */

export { parse, isOpenResult, formatVersion, SUPPORTED_VERSION } from './parse.js';
export type { FormatVersion } from './parse.js';

export { rank, listRankings } from './rank.js';

export {
  measure,
  attribute,
  participant,
  event,
  category,
  participantsOf,
  resultsOf,
  eventWithDescendants,
  isRankable,
  usedMeasures,
  supersedes,
  normalizeStatus,
  normalizeBetterWhen,
  normalizeTies,
  DEFAULT_EXCLUDED_STATUSES,
} from './semantics.js';

export { formatValue, formatAttribute } from './format.js';
export type { FormatOptions } from './format.js';

export { serialize } from './serialize.js';
export type { SerializeOptions } from './serialize.js';

export { OpenResultError, UnsupportedVersionError, NotOpenResultError } from './errors.js';

export type * from './types.js';
