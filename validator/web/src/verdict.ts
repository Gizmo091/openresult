import type { ValidationReport } from '@openresult/validate';

export type VerdictState = 'idle' | 'ok' | 'warn' | 'error';

export interface Verdict {
  state: VerdictState;
  text: string;
}

export const MARKS: Record<VerdictState, string> = {
  idle: '·',
  ok: '✓',
  warn: '!',
  error: '✗',
};

/**
 * Summarise a report in one line.
 *
 * Kept apart from the DOM wiring so the wording — the part that actually
 * carries meaning for the reader — can be tested without a browser.
 */
export function summarise(report: ValidationReport, strict: boolean): Verdict {
  if (report.errors.length > 0) {
    const tail =
      report.warnings.length === 0 ? '' : `, ${count(report.warnings.length, 'warning')}`;
    return { state: 'error', text: `${count(report.errors.length, 'error')}${tail}` };
  }

  if (report.warnings.length > 0) {
    const text = count(report.warnings.length, 'warning');
    return strict
      ? { state: 'error', text: `${text} — treated as errors` }
      : { state: 'warn', text: `Conforming, with ${text}` };
  }

  return { state: 'ok', text: 'Conforming' };
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value > 1 ? 's' : ''}`;
}
