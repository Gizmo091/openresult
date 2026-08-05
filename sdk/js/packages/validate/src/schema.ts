import type { ErrorObject } from 'ajv';
import { diagnostic, type Diagnostic, type DiagnosticCode } from './diagnostics.js';
// Compiled from the schema at build time by `pnpm generate:schema`, not here.
//
// Ajv's `compile()` builds its validator with `new Function`, which a page
// served under a Content Security Policy without `'unsafe-eval'` may not do —
// and that is the policy any site rendering documents from strangers should
// have. Precompiling also keeps Ajv itself out of every browser bundle.
import validateSchema from './schema.validator.generated.js';

interface CompiledValidator {
  (document: unknown): boolean;
  errors?: ErrorObject[] | null;
}

const validator = validateSchema as unknown as CompiledValidator;

/** Structural validation against the published schema. */
export function checkSchema(document: unknown): Diagnostic[] {
  if (validator(document)) return [];
  return (validator.errors ?? []).flatMap(translate);
}

/**
 * Turns an Ajv error into a diagnostic a producer can act on.
 *
 * Ajv speaks schema — "must match else schema", "unevaluatedProperty". A
 * producer should never have to learn that vocabulary to fix a typo, so each
 * keyword is mapped onto the rule it actually enforces.
 */
function translate(error: ErrorObject): Diagnostic[] {
  const path = error.instancePath;

  switch (error.keyword) {
    case 'required': {
      const missing = String(error.params['missingProperty']);
      const isUnit = missing === 'unit';
      return [
        make(
          isUnit ? 'OR-107' : 'OR-101',
          path,
          isUnit
            ? `This measure has no "unit". Every kind except text and boolean needs one, ` +
                `otherwise a value is a bare number.`
            : `The "${missing}" member is required here and is missing.`,
          isUnit
            ? `Add "unit", for example "s" for a duration or "pt" for points.`
            : `Add "${missing}".`,
        ),
      ];
    }

    case 'type': {
      const expected = formatExpected(error.params['type']);
      if (error.data === null) {
        return [
          make(
            'OR-108',
            path,
            `This value is null. An unavailable measure is omitted, not set to null — ` +
              `otherwise nothing distinguishes "not recorded" from "recorded as nothing".`,
            `Remove this key from "values".`,
          ),
        ];
      }
      return [
        make(
          'OR-102',
          path,
          `This value should be ${expected} but is ${describe(error.data)}.`,
          `Provide ${expected}.`,
        ),
      ];
    }

    // The one conditional in the schema: `unit` on an attribute forces the type
    // to `number`. Ajv reports it as a failed `const`, which reads as "must be
    // equal to constant" and helps nobody.
    case 'const': {
      if (path.endsWith('/type')) {
        return [
          make(
            'OR-110',
            path,
            `Only a number attribute may declare a "unit": a unit describes a quantity, and ` +
              `this attribute is ${describe(error.data)}.`,
            `Drop the "unit", or change "type" to "number" if the values really are numbers.`,
          ),
        ];
      }
      return [
        make(
          'OR-103',
          path,
          `${describe(error.data)} is not the value required here.`,
          `Use the value the schema fixes for this member.`,
        ),
      ];
    }

    case 'enum': {
      const allowed = (error.params['allowedValues'] as unknown[]).map((v) => `"${String(v)}"`);
      return [
        make(
          'OR-103',
          path,
          `${describe(error.data)} is not one of the values this member accepts.`,
          `Use one of: ${allowed.join(', ')}.`,
        ),
      ];
    }

    case 'pattern': {
      const pattern = String(error.params['pattern']);
      if (pattern.includes('A-Za-z0-9_-')) {
        return [
          make(
            'OR-104',
            path,
            `${describe(error.data)} is not a valid identifier. Identifiers may contain only ` +
              `letters, digits, hyphens and underscores, so that they survive being placed in a ` +
              `URL or a selector.`,
            `Replace any other character, for example with a hyphen.`,
          ),
        ];
      }
      if (pattern.includes('\\d{4}-\\d{2}-\\d{2}')) {
        return [
          make(
            'OR-106',
            path,
            `${describe(error.data)} is not an RFC 3339 timestamp with a UTC offset.`,
            `Use a form like "2026-05-17T16:42:00+02:00", or "2026-05-17" for a bare date.`,
          ),
        ];
      }
      return [
        make(
          'OR-102',
          path,
          `${describe(error.data)} does not have the expected form.`,
          `Check the specification for this member's format.`,
        ),
      ];
    }

    case 'unevaluatedProperties':
    case 'additionalProperties': {
      const name = String(
        error.params['unevaluatedProperty'] ?? error.params['additionalProperty'],
      );
      return [
        make(
          'OR-105',
          `${path}/${name}`,
          `"${name}" is not a member this specification defines. Unknown members are rejected ` +
            `rather than ignored, so that a typo does not become silently discarded data.`,
          `Correct the spelling, or prefix it with "x-" if it is a deliberate extension: ` +
            `"x-${name}".`,
        ),
      ];
    }

    // Structural keywords that only exist to route validation. Reporting them
    // would tell a producer about the schema's internals, not about the mistake.
    case 'if':
    case 'else':
    case 'then':
    case 'anyOf':
    case 'allOf':
    case 'oneOf':
      return [];

    case 'minItems':
      return [make('OR-304', path, `This list must not be empty.`, `Add at least one entry.`)];

    case 'minLength':
      return [make('OR-102', path, `This text must not be empty.`, `Provide a value.`)];

    case 'minimum':
      return [
        make(
          'OR-102',
          path,
          `${describe(error.data)} is below the minimum this member allows ` +
            `(${String(error.params['limit'])}).`,
          `Use a value of at least ${String(error.params['limit'])}.`,
        ),
      ];

    case 'format':
      return [
        make(
          'OR-102',
          path,
          `${describe(error.data)} is not a valid ${String(error.params['format'])}.`,
          `Provide a well-formed ${String(error.params['format'])}.`,
        ),
      ];

    default:
      return [
        make('OR-102', path, error.message ?? `This value does not satisfy the schema.`, undefined),
      ];
  }
}

function make(
  code: DiagnosticCode,
  path: string,
  message: string,
  suggestion: string | undefined,
): Diagnostic {
  return diagnostic(code, path === '' ? '/' : path, message, suggestion);
}

function formatExpected(type: unknown): string {
  if (Array.isArray(type)) {
    const names = type.map(String);
    const last = names.pop();
    return `${names.join(', ')} or ${last ?? ''}`;
  }
  return String(type);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'object') return 'an object';
  return String(value);
}
