import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT, runValidate } from '../src/commands/validate.js';
import { runRank } from '../src/commands/rank.js';
import { runInfo } from '../src/commands/info.js';
import { SourceError } from '../src/sources.js';

const workdir = mkdtempSync(join(tmpdir(), 'openresult-cli-'));

function fixture(name: string, document: unknown): string {
  const path = join(workdir, name);
  writeFileSync(path, JSON.stringify(document), 'utf8');
  return path;
}

const VALID = {
  openresult: '1.0',
  title: 'Race',
  lang: 'en',
  measures: [
    { id: 'time', label: 'Time', kind: 'duration', unit: 's', precision: 2, betterWhen: 'lower' },
  ],
  participants: [
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Bo' },
    { id: 'c', name: 'Cy' },
  ],
  results: [
    { participant: 'a', values: { time: 20 } },
    { participant: 'b', values: { time: 10 } },
    { participant: 'c', status: 'dnf' },
  ],
  rankings: [{ id: 'scratch', label: 'Scratch', sortBy: ['time'] }],
};

let output: string;

beforeEach(() => {
  output = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exit codes', () => {
  it('returns 0 for a conforming document', async () => {
    const path = fixture('valid.json', VALID);
    expect(await runValidate([path], flags())).toBe(EXIT.conforming);
  });

  it('returns 1 when a document has errors', async () => {
    const path = fixture('broken.json', { ...VALID, results: [{ participant: 'ghost' }] });
    expect(await runValidate([path], flags())).toBe(EXIT.invalid);
  });

  it('returns 3 for an unsupported major version, distinct from invalid', async () => {
    const path = fixture('future.json', { ...VALID, openresult: '2.0' });
    expect(await runValidate([path], flags())).toBe(EXIT.unsupportedVersion);
  });

  it('returns 0 with warnings, and 1 under strict', async () => {
    const withWarning = {
      ...VALID,
      measures: [
        ...VALID.measures,
        { id: 'unused', label: 'Unused', kind: 'points', unit: 'pt', betterWhen: 'higher' },
      ],
    };
    const path = fixture('warned.json', withWarning);

    expect(await runValidate([path], flags())).toBe(EXIT.conforming);
    expect(await runValidate([path], flags({ strict: true }))).toBe(EXIT.invalid);
  });

  it('rejects a missing file as a usage error', async () => {
    await expect(runValidate([join(workdir, 'absent.json')], flags())).rejects.toBeInstanceOf(
      SourceError,
    );
  });
});

describe('human output', () => {
  it('shows location, message, fix and specification anchor', async () => {
    const path = fixture('dangling.json', { ...VALID, results: [{ participant: 'ghost' }] });
    await runValidate([path], flags());

    expect(output).toContain('OR-201');
    expect(output).toContain('/results/0/participant');
    expect(output).toContain('ghost');
    expect(output).toContain('spec §');
    expect(output).toContain('→');
  });

  it('stays quiet when asked', async () => {
    const path = fixture('quiet.json', VALID);
    await runValidate([path], flags({ quiet: true }));
    expect(output).toBe('');
  });

  it('totals multiple documents', async () => {
    const good = fixture('good.json', VALID);
    const bad = fixture('bad.json', { ...VALID, results: [{ participant: 'ghost' }] });
    await runValidate([good, bad], flags());
    expect(output).toContain('1/2 documents conforming');
  });
});

describe('machine output', () => {
  it('emits the documented shape', async () => {
    const path = fixture('json-out.json', { ...VALID, results: [{ participant: 'ghost' }] });
    await runValidate([path], flags({ format: 'json' }));

    const payload = JSON.parse(output) as Record<string, unknown>;
    expect(payload['valid']).toBe(false);
    expect(payload['formatVersion']).toBe('1.0');
    expect((payload['errors'] as { code: string }[])[0]?.code).toBe('OR-201');

    // The dangling result leaves the declared measure unused, so OR-901 rides
    // along — errors and warnings are counted separately, which is the point.
    expect(payload['summary']).toEqual({ errors: 1, warnings: 1 });
    expect((payload['warnings'] as { code: string }[])[0]?.code).toBe('OR-901');
  });
});

describe('rank', () => {
  it('derives standings from a document holding no rank', async () => {
    const path = fixture('rank.json', VALID);
    expect(JSON.stringify(VALID)).not.toContain('"rank"');

    await runRank([path], { format: 'table' });

    const lines = output.trim().split('\n');
    expect(lines[0]).toContain('Scratch');
    expect(lines.at(-3)).toContain('Bo');
    expect(lines.at(-2)).toContain('Ada');
    expect(lines.at(-1)).toContain('Cy');
    expect(lines.at(-1)).toContain('—');
  });

  it('formats durations for reading but exports raw values', async () => {
    const path = fixture('rank-csv.json', VALID);

    await runRank([path], { format: 'table' });
    expect(output).toContain('10.00');

    output = '';
    await runRank([path], { format: 'csv' });
    expect(output.split('\n')[0]).toBe('rank,participant,status,time');
    expect(output).toContain(',10');
  });

  it('rejects an unknown ranking id, listing what exists', async () => {
    const path = fixture('rank-unknown.json', VALID);
    await expect(runRank([path], { format: 'table', ranking: 'nope' })).rejects.toThrow(/scratch/);
  });
});

describe('info', () => {
  it('summarises without validating', async () => {
    const path = fixture('info.json', VALID);
    await runInfo([path]);

    expect(output).toContain('Race');
    expect(output).toContain('Participants    3');
    expect(output).toContain('better when lower');
    expect(output).toContain('scratch');
  });
});

function flags(overrides: Partial<Parameters<typeof runValidate>[1]> = {}) {
  return {
    format: 'human' as const,
    strict: false,
    schemaOnly: false,
    quiet: false,
    ...overrides,
  };
}
