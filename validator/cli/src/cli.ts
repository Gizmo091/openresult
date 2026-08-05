#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { UnsupportedVersionError } from '@openresult/core';
import { EXIT, runValidate } from './commands/validate.js';
import { runRank } from './commands/rank.js';
import { runInfo } from './commands/info.js';
import { SourceError } from './sources.js';

/**
 * The OpenResult command line.
 *
 * Implements no validation rule of its own: everything comes from
 * `@openresult/validate`. A rule living only here could not be arbitrated by
 * the conformance suite, and the tool would start to disagree with the library.
 *
 * Argument parsing uses node:util, so the package ships with no dependency
 * beyond the OpenResult ones.
 */

const USAGE = `openresult — validate and rank OpenResult documents

Usage
  openresult validate <source...> [options]
  openresult rank <source> [options]
  openresult info <source>

A source is a file path, a glob, an http(s) URL, or - for standard input.

Options for validate
  --format human|json   Readable output (default) or machine-readable
  --strict              Treat warnings as errors
  --schema-only         Check structure only, skip the semantic rules
  --quiet               Print nothing; rely on the exit code

Options for rank
  --format table|json|csv   Output shape (default: table)
  --ranking <id>            Which declared ranking to apply

Exit codes
  0  conforming
  1  validation errors
  2  usage error
  3  unsupported major format version

Examples
  openresult validate results.openresult.json
  openresult validate "examples/**/*.json" --format json
  openresult rank results.openresult.json --ranking scratch
  curl -s https://example.org/results.json | openresult validate -
`;

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(USAGE);
    return command === undefined ? EXIT.usage : EXIT.conforming;
  }

  if (command === '--version' || command === '-v') {
    process.stdout.write('openresult 0.1.0 (format 1.0)\n');
    return EXIT.conforming;
  }

  switch (command) {
    case 'validate': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          format: { type: 'string', default: 'human' },
          strict: { type: 'boolean', default: false },
          'schema-only': { type: 'boolean', default: false },
          quiet: { type: 'boolean', default: false },
        },
      });

      if (values.format !== 'human' && values.format !== 'json') {
        throw new SourceError(`--format must be "human" or "json", not "${values.format}".`);
      }

      return runValidate(positionals, {
        format: values.format,
        strict: values.strict,
        schemaOnly: values['schema-only'],
        quiet: values.quiet,
      });
    }

    case 'rank': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          format: { type: 'string', default: 'table' },
          ranking: { type: 'string' },
        },
      });

      if (values.format !== 'table' && values.format !== 'json' && values.format !== 'csv') {
        throw new SourceError(`--format must be "table", "json" or "csv", not "${values.format}".`);
      }

      return runRank(positionals, {
        format: values.format,
        ...(values.ranking === undefined ? {} : { ranking: values.ranking }),
      });
    }

    case 'info':
      return runInfo(rest);

    default:
      process.stderr.write(`Unknown command "${command}".\n\n${USAGE}`);
      return EXIT.usage;
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof UnsupportedVersionError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = EXIT.unsupportedVersion;
  } else if (error instanceof SourceError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = EXIT.usage;
  } else if (error instanceof Error && error.name === 'NotOpenResultError') {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = EXIT.invalid;
  } else {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = EXIT.usage;
  }
}
