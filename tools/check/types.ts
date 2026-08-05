/**
 * Repository invariants.
 *
 * Each check enforces a project principle that would otherwise be a mere
 * intention. A principle nobody can violate by accident is a property; a
 * principle enforced by good will is a wish.
 */
export interface CheckResult {
  /** Identifier used on the command line, e.g. `core-deps`. */
  name: string;
  ok: boolean;
  /** Why the check failed. Empty when it passed. */
  problems: string[];
  /** One-line summary shown when the check passes. */
  summary: string;
  /** Set when the check could not run — reported, but not a failure. */
  skipped?: string;
}

export interface Check {
  name: string;
  /** The principle or requirement this check enforces, for the report. */
  enforces: string;
  run: () => Promise<CheckResult> | CheckResult;
}

export function pass(name: string, summary: string): CheckResult {
  return { name, ok: true, problems: [], summary };
}

export function fail(name: string, summary: string, problems: string[]): CheckResult {
  return { name, ok: false, problems, summary };
}

export function skip(name: string, reason: string): CheckResult {
  return { name, ok: true, problems: [], summary: reason, skipped: reason };
}
