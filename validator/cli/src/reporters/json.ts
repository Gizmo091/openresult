import type { ValidationReport } from '@openresult/validate';

/**
 * Machine-readable output.
 *
 * This shape is part of the tool's contract: CI scripts depend on it, so it
 * follows the same compatibility rules as the format itself — members may be
 * added, never removed or renamed.
 */
export interface JsonReport {
  source: string;
  valid: boolean;
  formatVersion: string | null;
  errors: ValidationReport['errors'];
  warnings: ValidationReport['warnings'];
  summary: { errors: number; warnings: number };
}

export function toJsonReport(
  label: string,
  report: ValidationReport,
  formatVersion: string | null,
): JsonReport {
  return {
    source: label,
    valid: report.valid,
    formatVersion,
    errors: report.errors,
    warnings: report.warnings,
    summary: { errors: report.errors.length, warnings: report.warnings.length },
  };
}

export function renderJson(reports: JsonReport[]): string {
  return `${JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2)}\n`;
}
