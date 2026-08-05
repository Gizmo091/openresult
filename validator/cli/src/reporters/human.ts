import type { Diagnostic, ValidationReport } from '@openresult/validate';

/**
 * Human-readable output.
 *
 * The point of this reporter is that a producer can fix the document without
 * opening the specification: every diagnostic shows where, what, and how to
 * correct it.
 */

const useColour = process.stdout.isTTY === true && process.env['NO_COLOR'] === undefined;

const paint = (code: string, text: string) =>
  useColour ? `\u001b[${code}m${text}\u001b[0m` : text;
const red = (text: string) => paint('31', text);
const green = (text: string) => paint('32', text);
const yellow = (text: string) => paint('33', text);
const dim = (text: string) => paint('2', text);
const bold = (text: string) => paint('1', text);

export function renderReport(label: string, report: ValidationReport): string {
  const lines: string[] = [];
  const total = report.errors.length + report.warnings.length;

  if (total === 0) {
    return `${green('✓')} ${label}\n`;
  }

  lines.push(`${report.errors.length > 0 ? red('✗') : yellow('!')} ${bold(label)}`);
  lines.push('');

  for (const entry of [...report.errors, ...report.warnings]) {
    lines.push(...renderDiagnostic(entry));
    lines.push('');
  }

  lines.push(`  ${summary(report)}`);
  return `${lines.join('\n')}\n`;
}

function renderDiagnostic(entry: Diagnostic): string[] {
  const marker = entry.severity === 'error' ? red(entry.code) : yellow(entry.code);
  const lines = [`  ${marker}  ${dim(entry.path)}`, `          ${entry.message}`];

  if (entry.suggestion !== undefined) {
    lines.push(`          ${green('→')} ${entry.suggestion}`);
  }

  const tag = entry.severity === 'warning' ? `  ${yellow('[warning]')}` : '';
  lines.push(`          ${dim(entry.rule)}${tag}`);
  return lines;
}

function summary(report: ValidationReport): string {
  const parts: string[] = [];
  if (report.errors.length > 0) {
    parts.push(`${report.errors.length} error${report.errors.length > 1 ? 's' : ''}`);
  }
  if (report.warnings.length > 0) {
    parts.push(`${report.warnings.length} warning${report.warnings.length > 1 ? 's' : ''}`);
  }
  return parts.join(', ');
}

export function renderTotals(reports: { report: ValidationReport }[]): string {
  const errors = reports.reduce((sum, entry) => sum + entry.report.errors.length, 0);
  const warnings = reports.reduce((sum, entry) => sum + entry.report.warnings.length, 0);
  const clean = reports.filter((entry) => entry.report.errors.length === 0).length;

  if (reports.length === 1) return '';

  return (
    `\n${clean}/${reports.length} document${reports.length > 1 ? 's' : ''} conforming` +
    `${errors > 0 ? `, ${errors} error${errors > 1 ? 's' : ''}` : ''}` +
    `${warnings > 0 ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}\n`
  );
}
