/**
 * Diagnostics.
 *
 * Every diagnostic carries four things (spec §12.1.3): where the problem is,
 * what rule it breaks in plain language, which section of the specification
 * says so, and how to fix it. A message that only says "invalid" makes the
 * reader open the specification, which is the failure this catalogue exists to
 * prevent.
 *
 * Published codes are permanent: removing or reassigning one is a breaking
 * change (spec §12.2.1).
 */

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  severity: Severity;
  /** RFC 6901 JSON Pointer into the document. */
  path: string;
  message: string;
  /** Reference into the normative specification, e.g. "spec §7.3.1". */
  rule: string;
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

interface CatalogueEntry {
  severity: Severity;
  rule: string;
}

/** Codes and their normative anchors. Kept in one place so the two never drift. */
export const CATALOGUE = {
  'OR-101': { severity: 'error', rule: 'spec §4.1.1' },
  'OR-102': { severity: 'error', rule: 'spec §5.2.1' },
  'OR-103': { severity: 'error', rule: 'spec §5.1.2' },
  'OR-104': { severity: 'error', rule: 'spec §5.4.1' },
  'OR-105': { severity: 'error', rule: 'spec §10.2.4' },
  'OR-106': { severity: 'error', rule: 'spec §4.6.1' },
  'OR-107': { severity: 'error', rule: 'spec §5.1.3' },
  'OR-108': { severity: 'error', rule: 'spec §7.3.2' },
  'OR-109': { severity: 'error', rule: 'spec §5.1.8' },
  'OR-110': { severity: 'error', rule: 'spec §5.3.7' },
  'OR-201': { severity: 'error', rule: 'spec §7.1.1' },
  'OR-202': { severity: 'error', rule: 'spec §5.4.2' },
  'OR-203': { severity: 'error', rule: 'spec §7.1.3' },
  'OR-204': { severity: 'error', rule: 'spec §6.2.2' },
  'OR-205': { severity: 'error', rule: 'spec §7.3.1' },
  'OR-206': { severity: 'error', rule: 'spec §5.3.2' },
  'OR-301': { severity: 'error', rule: 'spec §8.2.2' },
  'OR-302': { severity: 'error', rule: 'spec §8.3.1' },
  'OR-303': { severity: 'error', rule: 'spec §7.2.3' },
  'OR-304': { severity: 'error', rule: 'spec §8.2.1' },
  'OR-305': { severity: 'error', rule: 'spec §8.2.2' },
  'OR-401': { severity: 'error', rule: 'spec §4.2.1' },
  'OR-402': { severity: 'error', rule: 'spec §11.4.1' },
  // OR-403 was reserved for "version must strictly increase for the same id".
  // Writing the conformance suite showed it cannot exist: the rule compares two
  // documents, and a validator sees one. The code stays retired rather than
  // reused — a published code is permanent (spec §12.2.1).
  'OR-901': { severity: 'warning', rule: 'spec §5.1.7' },
  'OR-902': { severity: 'warning', rule: 'spec §3.3.2' },
  'OR-903': { severity: 'warning', rule: 'spec §4.5.1' },
  'OR-904': { severity: 'warning', rule: 'spec §6.2.4' },
  'OR-905': { severity: 'warning', rule: 'spec §5.3.6' },
  'OR-906': { severity: 'warning', rule: 'spec §8.1.4' },
  'OR-907': { severity: 'warning', rule: 'spec §9.1.1' },
  'OR-908': { severity: 'warning', rule: 'spec §8.5.2' },
  'OR-909': { severity: 'warning', rule: 'spec §5.1.8' },
  'OR-910': { severity: 'warning', rule: 'spec §6.1.7' },
  'OR-911': { severity: 'warning', rule: 'spec §8.3.5' },
} as const satisfies Record<string, CatalogueEntry>;

export type DiagnosticCode = keyof typeof CATALOGUE;

export function diagnostic(
  code: DiagnosticCode,
  path: string,
  message: string,
  suggestion?: string,
): Diagnostic {
  const entry = CATALOGUE[code];
  return {
    code,
    severity: entry.severity,
    path,
    message,
    rule: entry.rule,
    ...(suggestion === undefined ? {} : { suggestion }),
  };
}

/** Builds an RFC 6901 pointer, escaping `~` and `/` as the standard requires. */
export function pointer(...segments: (string | number)[]): string {
  if (segments.length === 0) return '';
  return `/${segments
    .map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/')}`;
}
