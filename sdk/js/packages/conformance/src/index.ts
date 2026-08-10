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
  /**
   * Other rules this same document demonstrates, e.g. ["spec §11.3.2"].
   *
   * Some rules restate one another for a different audience: §11.3.2 tells a
   * consumer not to read meaning into an identifier, which is §5.4.3 addressed
   * to the reader rather than the writer. One document demonstrates both, and a
   * second copy of it would be coverage on paper only.
   */
  alsoExercises?: string[];
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
  /**
   * Renderings a reading-level consumer must produce (spec §11.5.2).
   *
   * §5.1.5 and §5.2.5 are MUSTs about a printed figure — halfway rounds away
   * from zero, rounding applies to the literal the document writes rather than
   * the double it decodes to, an absent `precision` adds and removes no digit,
   * a duration decomposes into hours, minutes and seconds. Every one of them
   * decides a published time or score, and the suite could state none of them:
   * §5.1.5 was counted as covered by a case checking that `precision` is not
   * negative.
   *
   * `rendered` is the number alone — no unit, no scale, and a `.` for the
   * decimal separator wherever the consumer runs. What a consumer wraps around
   * it is its own business and the reader's locale's.
   */
  display?: ExpectedRendering[];
}

export interface ExpectedPlacement {
  participant: string;
  rank: number | null;
  /**
   * Index into `results`, where the participant alone does not say which row
   * this is.
   *
   * §8.5.7 says an element of the ordered list is a *selected result*, and this
   * file says `{ participant, rank }` — which identifies a row only while a
   * competitor holds at most one result in the ranking. A standing gathering an
   * overall event and its sub-events has three rows per competitor, and where
   * two of them are unranked the pair repeats: the expectation could then no
   * longer tell a correct implementation from one emitting the same result
   * twice and dropping another. Two implementers reported it independently.
   *
   * Optional, because it is noise on the cases that do not need it —
   * `expected-rows-are-identifiable` requires it exactly where the pair repeats.
   */
  result?: number;
}

export interface ExpectedRendering {
  /** Index into `results`. */
  result: number;
  /** Measure id, whose value in that result is the one rendered. */
  measure: string;
  rendered: string;
}

/**
 * Expected outcome for an invalid case. Only codes and paths are compared.
 *
 * `rankings` may be present alongside the errors, and the combination is not a
 * contradiction: validity and readability are different questions. A document
 * carrying an enumeration value from a later version is not conforming to this
 * one — a producer must not emit it — yet a consumer is still required to read
 * it, folding the unknown value onto its documented fallback (spec §11.3.1).
 * Stating both in one case is what pins that distinction down.
 */
export interface ExpectedInvalid {
  valid: false;
  errors: { code: string; path: string }[];
  rankings?: Record<string, ExpectedPlacement[]>;
}

export type Expected = ExpectedValid | ExpectedInvalid;

export function isValidCase(expected: Expected): expected is ExpectedValid {
  return expected.valid;
}

export { runSuite } from './runner.js';
export type { CaseOutcome, SuiteOutcome, RunOptions } from './runner.js';
