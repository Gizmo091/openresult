import { validate } from '@openresult/validate';
import { resolveSources } from '../sources.js';
import { renderReport, renderTotals } from '../reporters/human.js';
import { renderJson, toJsonReport, type JsonReport } from '../reporters/json.js';

export interface ValidateFlags {
  format: 'human' | 'json';
  strict: boolean;
  schemaOnly: boolean;
  quiet: boolean;
}

/** Exit codes are part of the contract — see contracts/validator-cli.md. */
export const EXIT = {
  conforming: 0,
  invalid: 1,
  usage: 2,
  unsupportedVersion: 3,
} as const;

export async function runValidate(args: string[], flags: ValidateFlags): Promise<number> {
  const sources = await resolveSources(args);

  const outcomes = sources.map((source) => {
    const report = validate(source.content, {
      strict: flags.strict,
      schemaOnly: flags.schemaOnly,
    });
    return { source, report };
  });

  if (!flags.quiet) {
    if (flags.format === 'json') {
      const payloads: JsonReport[] = outcomes.map(({ source, report }) =>
        toJsonReport(source.label, report, readDeclaredVersion(source.content)),
      );
      process.stdout.write(renderJson(payloads));
    } else {
      for (const { source, report } of outcomes) {
        process.stdout.write(renderReport(source.label, report));
      }
      process.stdout.write(renderTotals(outcomes));
    }
  }

  // An unsupported major version gets its own exit code so a script can treat
  // it as "not for me" rather than "broken" (spec §11.4.1).
  const unsupported = outcomes.some(({ report }) =>
    report.errors.some((entry) => entry.code === 'OR-402'),
  );
  if (unsupported) return EXIT.unsupportedVersion;

  return outcomes.every(({ report }) => report.valid) ? EXIT.conforming : EXIT.invalid;
}

/** Best-effort: used for reporting only, so a malformed document just yields null. */
function readDeclaredVersion(content: string): string | null {
  try {
    const value: unknown = JSON.parse(content);
    if (value !== null && typeof value === 'object') {
      const declared = (value as Record<string, unknown>)['openresult'];
      if (typeof declared === 'string') return declared;
    }
  } catch {
    // Reported as OR-401 by the validator itself.
  }
  return null;
}
