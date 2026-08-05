/**
 * @openresult/conformance — the shared conformance suite.
 *
 * The suite is declarative JSON so that any implementation, in any language,
 * can run it: a suite written in one language would only ever be executable by
 * that language's implementations, and the ports would be left to invent their
 * own idea of "conforming".
 *
 * The runner lives here; the cases live in `conformance/` at the repository
 * root, alongside the specification they exercise.
 */

/** Which consumer level a case exercises (spec §11.5). */
export type ConformanceLevel = 'reading' | 'ranking' | 'rewriting';

export interface ConformanceManifest {
  suiteVersion: string;
  formatVersion: string;
  cases: ConformanceCase[];
}

export interface ConformanceCase {
  id: string;
  kind: 'valid' | 'invalid';
  level: ConformanceLevel;
  /** Normative rule the case exercises, e.g. "spec §8.4". */
  rule: string;
  description: string;
  /** Directory holding `document.json` and `expected.json`. */
  path: string;
  /** Set with a reason when a case is retired; never rewritten in place. */
  deprecated?: string;
}

/** Expected outcome for a valid case. */
export interface ExpectedValid {
  valid: true;
  /** Diagnostic codes expected as warnings. Compared as a set. */
  warnings?: string[];
  /**
   * Derived rankings, keyed by ranking id. Order is significant: it is what
   * verifies the stability of the sort.
   */
  rankings?: Record<string, ExpectedPlacement[]>;
}

export interface ExpectedPlacement {
  participant: string;
  rank: number | null;
}

/** Expected outcome for an invalid case. Only codes and paths are compared. */
export interface ExpectedInvalid {
  valid: false;
  errors: { code: string; path: string }[];
}

export type Expected = ExpectedValid | ExpectedInvalid;

export function isValidCase(expected: Expected): expected is ExpectedValid {
  return expected.valid;
}
