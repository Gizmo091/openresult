import { describe, expect, it } from 'vitest';
import type { Diagnostic, ValidationReport } from '@openresult/validate';
import { summarise } from '../src/verdict.js';

const entry = (severity: Diagnostic['severity']): Diagnostic => ({
  code: severity === 'error' ? 'OR-201' : 'OR-901',
  severity,
  path: '/results/0',
  message: 'Something to fix.',
  rule: 'spec §7.1.1',
});

const report = (errors: number, warnings: number): ValidationReport => ({
  valid: errors === 0,
  errors: Array.from({ length: errors }, () => entry('error')),
  warnings: Array.from({ length: warnings }, () => entry('warning')),
});

describe('verdict wording', () => {
  it('says conforming when nothing is wrong', () => {
    expect(summarise(report(0, 0), false)).toEqual({ state: 'ok', text: 'Conforming' });
  });

  it('keeps a document with warnings conforming', () => {
    expect(summarise(report(0, 1), false)).toEqual({
      state: 'warn',
      text: 'Conforming, with 1 warning',
    });
  });

  it('escalates warnings under strict', () => {
    expect(summarise(report(0, 2), true)).toEqual({
      state: 'error',
      text: '2 warnings — treated as errors',
    });
  });

  it('leads with errors and mentions warnings after', () => {
    expect(summarise(report(2, 1), false)).toEqual({
      state: 'error',
      text: '2 errors, 1 warning',
    });
  });

  it('agrees in number', () => {
    expect(summarise(report(1, 0), false).text).toBe('1 error');
    expect(summarise(report(3, 0), false).text).toBe('3 errors');
  });
});
