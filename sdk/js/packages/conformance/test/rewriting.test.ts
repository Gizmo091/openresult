import { readFileSync, globSync } from 'node:fs';
import { parse, serialize, type ResultDocument } from '@openresult/core';
import { describe, expect, it } from 'vitest';

/**
 * The rewriting conformance level (spec §11.5.4).
 *
 * A tool that silently drops what it does not recognise makes round-tripping
 * lossy, and no producer can trust any tool that has touched its documents.
 * This is the property that lets a 1.0 implementation sit in the middle of a
 * pipeline carrying 1.4 documents without damaging them.
 */

const repoRoot = `${process.cwd()}/`;

function roundTrip(source: string): unknown {
  return JSON.parse(serialize(parse(source)));
}

describe('published examples survive a read-write cycle', () => {
  const files = globSync('examples/**/*.openresult.json', { cwd: repoRoot });

  it.each(files)('%s is unchanged', (file) => {
    const source = readFileSync(`${repoRoot}${file}`, 'utf8');
    expect(roundTrip(source)).toEqual(JSON.parse(source));
  });
});

describe('what a 1.0 implementation does not understand', () => {
  const forward = JSON.stringify({
    openresult: '1.4',
    title: 'From a later version',
    lang: 'en',
    // Members this version does not define.
    provenance: { signedBy: 'Timing Co.', signature: 'abc123' },
    measures: [
      {
        id: 'time',
        label: 'Time',
        kind: 'duration',
        unit: 's',
        betterWhen: 'lower',
        calibration: { device: 'photocell', driftMs: 2 },
      },
    ],
    participants: [
      { id: 'a', name: 'Ada', type: 'cyborg', 'x-licence': 'FR-2026-0148' },
      { id: 'b', name: 'Bo' },
    ],
    results: [
      { participant: 'a', values: { time: 20 }, 'x-splits': [10, 10] },
      { participant: 'b', status: 'teleported', values: { time: 10 } },
    ],
    rankings: [{ id: 'main', label: 'Main', sortBy: ['time'], ties: 'olympic' }],
  });

  it('preserves unknown members', () => {
    const written = roundTrip(forward) as Record<string, unknown>;
    expect(written['provenance']).toEqual({ signedBy: 'Timing Co.', signature: 'abc123' });
  });

  it('preserves unknown members nested inside known entities', () => {
    const written = roundTrip(forward) as { measures: Record<string, unknown>[] };
    expect(written.measures[0]?.['calibration']).toEqual({ device: 'photocell', driftMs: 2 });
  });

  it('preserves x- extensions at every level', () => {
    const written = roundTrip(forward) as {
      participants: Record<string, unknown>[];
      results: Record<string, unknown>[];
    };
    expect(written.participants[0]?.['x-licence']).toBe('FR-2026-0148');
    expect(written.results[0]?.['x-splits']).toEqual([10, 10]);
  });

  it('preserves unknown enumeration values verbatim, despite reading them as fallbacks', () => {
    const written = roundTrip(forward) as {
      participants: Record<string, unknown>[];
      results: Record<string, unknown>[];
      rankings: Record<string, unknown>[];
    };

    // Read as `other`, `finished` and `standard` respectively — but written back
    // exactly as received. Folding is an interpretation, not an edit.
    expect(written.participants[0]?.['type']).toBe('cyborg');
    expect(written.results[1]?.['status']).toBe('teleported');
    expect(written.rankings[0]?.['ties']).toBe('olympic');
  });

  it('is byte-identical when re-serialised at the same indentation', () => {
    const document = parse(forward);
    expect(serialize(document)).toBe(forward);
  });

  it('keeps collection order', () => {
    const written = roundTrip(forward) as { participants: { id: string }[] };
    expect(written.participants.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('a document is not normalised on the way out', () => {
  it('does not add members the producer omitted', () => {
    const minimal = JSON.stringify({
      openresult: '1.0',
      title: 'Minimal',
      participants: [{ id: 'a', name: 'Ada' }],
      results: [{ participant: 'a' }],
    });

    const written = roundTrip(minimal) as ResultDocument;
    expect(Object.keys(written)).toEqual(['openresult', 'title', 'participants', 'results']);
    expect(written.results[0]).toEqual({ participant: 'a' });
  });
});
