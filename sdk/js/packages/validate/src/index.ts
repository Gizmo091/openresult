/**
 * @openresult/validate — schema conformance plus the semantic rules a schema
 * cannot express.
 *
 * A document that passes the schema is not necessarily conforming: referential
 * integrity, ranking coherence and cycle detection all live here.
 */

import {
  isOpenResult,
  parse,
  SUPPORTED_VERSION,
  UnsupportedVersionError,
  type ResultDocument,
} from '@openresult/core';
import { diagnostic, type Diagnostic, type ValidationReport } from './diagnostics.js';
import { checkSchema } from './schema.js';
import { checkReferences } from './rules/references.js';
import { checkRanking } from './rules/ranking.js';
import { checkQuality } from './rules/quality.js';

export type { Diagnostic, ValidationReport, Severity, DiagnosticCode } from './diagnostics.js';
export { CATALOGUE } from './diagnostics.js';

export interface ValidateOptions {
  /** Treat warnings as errors. Default: false. */
  strict?: boolean;
  /** Skip the semantic rules and check structure only. Default: false. */
  schemaOnly?: boolean;
}

/**
 * Validate a document.
 *
 * Stops early when the input cannot be read at all — reporting a hundred
 * structural errors for something that is not an OpenResult document helps
 * nobody.
 */
export function validate(input: unknown, options: ValidateOptions = {}): ValidationReport {
  const { strict = false, schemaOnly = false } = options;

  const decoded = decode(input);
  if ('fatal' in decoded) {
    return report([decoded.fatal], strict);
  }

  const value = decoded.value;
  const found: Diagnostic[] = [...checkSchema(value)];

  if (!schemaOnly) {
    let document: ResultDocument | undefined;
    try {
      document = parse(value);
    } catch {
      // Unreadable beyond what the schema already reported; structural
      // diagnostics stand on their own.
      document = undefined;
    }

    if (document !== undefined) {
      found.push(...checkReferences(document));
      found.push(...checkRanking(document));
      found.push(...checkQuality(document));
    }
  }

  return report(found, strict);
}

function decode(input: unknown): { value: unknown } | { fatal: Diagnostic } {
  let value = input;

  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      return {
        fatal: diagnostic(
          'OR-401',
          '/',
          `The input is not valid JSON: ${(error as Error).message}`,
          `Check for a trailing comma, an unquoted key, or a truncated file.`,
        ),
      };
    }
  }

  if (!isOpenResult(value)) {
    return {
      fatal: diagnostic(
        'OR-401',
        '/openresult',
        `This is not an OpenResult document: the "openresult" member is missing or is not a ` +
          `MAJOR.MINOR version string.`,
        `Add "openresult": "${SUPPORTED_VERSION.major}.${SUPPORTED_VERSION.minor}" at the top ` +
          `level.`,
      ),
    };
  }

  try {
    parse(value);
  } catch (error) {
    if (error instanceof UnsupportedVersionError) {
      return {
        fatal: diagnostic(
          'OR-402',
          '/openresult',
          error.message,
          `Use a consumer that supports ${error.found}, or ask the producer for a ${error.supported} document.`,
        ),
      };
    }
    // Anything else is structural and the schema will describe it precisely.
  }

  return { value };
}

function report(found: Diagnostic[], strict: boolean): ValidationReport {
  const errors = found.filter((entry) => entry.severity === 'error');
  const warnings = found.filter((entry) => entry.severity === 'warning');
  return {
    valid: strict ? errors.length === 0 && warnings.length === 0 : errors.length === 0,
    errors,
    warnings,
  };
}
