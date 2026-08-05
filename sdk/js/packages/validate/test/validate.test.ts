import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/index.js';

const repoRoot = new URL('../../../../../', import.meta.url).pathname;

function base(): Record<string, unknown> {
  return {
    openresult: '1.0',
    title: 'Test',
    lang: 'en',
    measures: [{ id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' }],
    participants: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
    results: [
      { participant: 'a', values: { time: 20 } },
      { participant: 'b', values: { time: 10 } },
    ],
  };
}

const codes = (report: ReturnType<typeof validate>) => [
  ...report.errors.map((entry) => entry.code),
  ...report.warnings.map((entry) => entry.code),
];

describe('published examples', () => {
  const files = globSync('examples/**/*.openresult.json', { cwd: repoRoot });

  it('finds the example library', () => {
    expect(files.length).toBeGreaterThanOrEqual(19);
  });

  it.each(files)('%s validates without error', (file) => {
    const report = validate(readFileSync(`${repoRoot}${file}`, 'utf8'));
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });
});

describe('reading failures stop early', () => {
  it('reports malformed JSON', () => {
    const report = validate('{ "openresult": "1.0", }');
    expect(report.errors[0]?.code).toBe('OR-401');
    expect(report.errors).toHaveLength(1);
  });

  it('reports a document that is not OpenResult at all', () => {
    const report = validate({ hello: 'world' });
    expect(report.errors[0]?.code).toBe('OR-401');
  });

  it('reports an unsupported major version distinctly', () => {
    const report = validate({ ...base(), openresult: '2.0' });
    expect(report.errors[0]?.code).toBe('OR-402');
    expect(report.errors[0]?.message).toContain('2.0');
    expect(report.errors[0]?.message).toContain('1.0');
  });

  it('reads a higher minor version normally', () => {
    const report = validate({ ...base(), openresult: '1.7' });
    expect(report.errors).toEqual([]);
  });
});

describe('structural rules', () => {
  it('reports a missing required member', () => {
    const document = base();
    delete document['title'];
    expect(codes(validate(document))).toContain('OR-101');
  });

  it('rejects an unknown member and suggests the extension prefix', () => {
    const report = validate({ ...base(), participant: [] });
    const found = report.errors.find((entry) => entry.code === 'OR-105');
    expect(found?.path).toBe('/participant');
    expect(found?.suggestion).toContain('x-participant');
  });

  it('accepts an x- extension anywhere', () => {
    const report = validate({
      ...base(),
      'x-vendor': { name: 'ChronoX' },
      participants: [
        { id: 'a', name: 'A', 'x-licence': '123' },
        { id: 'b', name: 'B' },
      ],
    });
    expect(report.errors).toEqual([]);
  });

  it('rejects null for an unavailable measure', () => {
    const document = base();
    (document['results'] as { values: Record<string, unknown> }[])[0]!.values['time'] = null;
    const found = validate(document).errors.find((entry) => entry.code === 'OR-108');
    expect(found?.suggestion).toContain('Remove this key');
  });

  it('requires a unit for a kind that needs one', () => {
    const document = base();
    delete (document['measures'] as Record<string, unknown>[])[0]!['unit'];
    expect(codes(validate(document))).toContain('OR-107');
  });

  it('rejects an identifier with unusable characters', () => {
    const document = base();
    (document['participants'] as Record<string, unknown>[])[0]!['id'] = 'a/b';
    expect(codes(validate(document))).toContain('OR-104');
  });

  it('rejects a timestamp without an offset', () => {
    expect(codes(validate({ ...base(), generatedAt: '2026-05-17T16:42:00' }))).toContain('OR-106');
  });
});

describe('referential integrity', () => {
  it('reports a result pointing at an undeclared participant', () => {
    const document = base();
    (document['results'] as Record<string, unknown>[])[0]!['participant'] = 'ghost';
    const found = validate(document).errors.find((entry) => entry.code === 'OR-201');
    expect(found?.path).toBe('/results/0/participant');
    expect(found?.suggestion).toContain('ghost');
  });

  it('reports a duplicate identifier', () => {
    const document = base();
    (document['participants'] as Record<string, unknown>[])[1]!['id'] = 'a';
    expect(codes(validate(document))).toContain('OR-202');
  });

  it('reports two results for the same participant and event', () => {
    const document = base();
    (document['results'] as Record<string, unknown>[])[1]!['participant'] = 'a';
    expect(codes(validate(document))).toContain('OR-203');
  });

  it('reports a cycle in the event hierarchy', () => {
    const report = validate({
      ...base(),
      events: [
        { id: 'x', name: 'X', parent: 'y' },
        { id: 'y', name: 'Y', parent: 'x' },
      ],
      results: [{ participant: 'a', event: 'x', values: { time: 10 } }],
      participants: [{ id: 'a', name: 'A' }],
    });
    expect(codes(report)).toContain('OR-204');
  });

  it('reports a value keyed on an undeclared measure', () => {
    const document = base();
    (document['results'] as { values: Record<string, unknown> }[])[0]!.values['speed'] = 12;
    expect(codes(validate(document))).toContain('OR-205');
  });

  it('reports an undeclared attribute', () => {
    const document = base();
    (document['participants'] as Record<string, unknown>[])[0]!['attributes'] = { club: 'X' };
    expect(codes(validate(document))).toContain('OR-206');
  });
});

describe('ranking coherence', () => {
  it('rejects sorting on a measure with no direction', () => {
    const report = validate({
      ...base(),
      measures: [{ id: 'bib', label: 'Bib', kind: 'count', unit: 'n', betterWhen: 'none' }],
      results: [
        { participant: 'a', values: { bib: 1 } },
        { participant: 'b', values: { bib: 2 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['bib'] }],
    });
    expect(codes(report)).toContain('OR-301');
  });

  it('reports a residual tie under strict', () => {
    const report = validate({
      ...base(),
      results: [
        { participant: 'a', values: { time: 10 } },
        { participant: 'b', values: { time: 10 } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['time'], ties: 'strict' }],
    });
    const found = report.errors.find((entry) => entry.code === 'OR-302');
    expect(found?.suggestion).toContain('tie-break');
  });

  it('rejects a position published in a ranking that excludes the result', () => {
    const document = base();
    document['rankings'] = [{ id: 'r', label: 'R', sortBy: ['time'] }];
    (document['results'] as Record<string, unknown>[])[0]!['status'] = 'dnf';
    (document['results'] as Record<string, unknown>[])[0]!['ranks'] = { r: 2 };
    expect(codes(validate(document))).toContain('OR-303');
  });

  it('rejects a position published in an undeclared ranking', () => {
    const document = base();
    document['rankings'] = [{ id: 'r', label: 'R', sortBy: ['time'] }];
    (document['results'] as Record<string, unknown>[])[0]!['ranks'] = { ghost: 1 };
    expect(codes(validate(document))).toContain('OR-201');
  });

  it('warns when a supplied position disagrees with the derived one', () => {
    const document = base();
    // 'a' runs 20s and 'b' runs 10s, so 'a' derives 2, not 1.
    (document['results'] as Record<string, unknown>[])[0]!['ranks'] = { r: 1 };
    document['rankings'] = [{ id: 'r', label: 'R', sortBy: ['time'] }];
    const report = validate(document);
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((entry) => entry.code)).toContain('OR-902');
    expect(report.valid).toBe(true);
  });

  it('accepts positions in several rankings at once', () => {
    const document = base();
    document['categories'] = [{ id: 'junior', label: 'Junior', participants: ['b'] }];
    document['rankings'] = [
      { id: 'overall', label: 'Overall', sortBy: ['time'] },
      { id: 'junior', label: 'Junior', scope: { category: 'junior' }, sortBy: ['time'] },
    ];
    (document['results'] as Record<string, unknown>[])[1]!['ranks'] = { overall: 1, junior: 1 };
    const report = validate(document);
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((entry) => entry.code)).not.toContain('OR-902');
  });

  it('rejects sorting on a text measure', () => {
    const report = validate({
      ...base(),
      measures: [{ id: 'grade', label: 'Grade', kind: 'text', betterWhen: 'higher' }],
      results: [
        { participant: 'a', values: { grade: '7a' } },
        { participant: 'b', values: { grade: '8b' } },
      ],
      rankings: [{ id: 'r', label: 'R', sortBy: ['grade'] }],
    });
    expect(codes(report)).toContain('OR-301');
  });

  it('rejects an attribute value contradicting its declared type', () => {
    const document = base();
    document['attributes'] = [{ id: 'elo', label: 'Rating', type: 'number' }];
    (document['participants'] as Record<string, unknown>[])[0]!['attributes'] = { elo: '2478' };
    const found = validate(document).errors.find((entry) => entry.code === 'OR-102');
    expect(found?.path).toBe('/participants/0/attributes/elo');
    expect(found?.message).toContain('number');
  });

  it('rejects a country code that is not ISO 3166-1 alpha-2', () => {
    const document = base();
    document['attributes'] = [{ id: 'country', label: 'Country', type: 'country' }];
    (document['participants'] as Record<string, unknown>[])[0]!['attributes'] = { country: 'FRA' };
    expect(codes(validate(document))).toContain('OR-102');
  });
});

describe('severity and options', () => {
  it('keeps a document with warnings valid by default', () => {
    const document = base();
    document['measures'] = [
      ...(document['measures'] as unknown[]),
      { id: 'unused', label: 'Unused', kind: 'points', unit: 'pt', betterWhen: 'higher' },
    ];
    const report = validate(document);
    expect(report.warnings.map((entry) => entry.code)).toContain('OR-901');
    expect(report.valid).toBe(true);
  });

  it('fails the same document under strict', () => {
    const document = base();
    document['measures'] = [
      ...(document['measures'] as unknown[]),
      { id: 'unused', label: 'Unused', kind: 'points', unit: 'pt', betterWhen: 'higher' },
    ];
    expect(validate(document, { strict: true }).valid).toBe(false);
  });

  it('skips semantic rules under schemaOnly', () => {
    const document = base();
    (document['results'] as Record<string, unknown>[])[0]!['participant'] = 'ghost';
    expect(codes(validate(document, { schemaOnly: true }))).not.toContain('OR-201');
  });
});

describe('every diagnostic is actionable', () => {
  it('carries a location, a rule and a suggestion', () => {
    const document = base();
    (document['results'] as Record<string, unknown>[])[0]!['participant'] = 'ghost';
    for (const entry of validate(document).errors) {
      expect(entry.path).not.toBe('');
      expect(entry.rule).toMatch(/^spec §/);
      expect(entry.message.length).toBeGreaterThan(20);
      expect(entry.suggestion).toBeDefined();
    }
  });

  it('never exposes schema vocabulary to the reader', () => {
    const document = base();
    delete document['title'];
    (document['results'] as Record<string, unknown>[])[0]!['participant'] = 'ghost';
    for (const entry of validate(document).errors) {
      expect(entry.message).not.toMatch(/unevaluated|schema|keyword|anyOf|allOf/i);
    }
  });
});
