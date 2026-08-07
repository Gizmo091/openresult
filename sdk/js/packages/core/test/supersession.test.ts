import { describe, expect, it } from 'vitest';
import { supersedes } from '../src/index.js';
import type { DocumentStatus, ResultDocument } from '../src/index.js';

/**
 * Which of two publications of the same results is the current one (§4.4.3).
 *
 * The specification calls this the commonest real requirement in results
 * publishing: the jury rules, the standings change, and both documents exist in
 * the wild. It was also the only rule in §4 that no conformance case could
 * reach, because the suite runs one document at a time — so it went unwritten
 * until someone needed it, which is the opposite of what a reference
 * implementation is for.
 *
 * Half of these are about the cases §4.4.3 does not decide. Answering them
 * would mean inventing a rule and calling it the specification.
 */

function published(overrides: Partial<ResultDocument> = {}): ResultDocument {
  return {
    openresult: '1.0',
    id: 'vallonne-tt-2026',
    title: 'Vallonne time trial',
    participants: [{ id: 'ana', name: 'Ana Rivas' }],
    results: [{ participant: 'ana', values: {} }],
    ...overrides,
  };
}

describe('version decides first', () => {
  it('prefers the higher version whatever the standings say', () => {
    // A provisional republication supersedes an official one it followed: the
    // jury has reopened the matter, and the newer document is the current fact.
    const newer = published({ version: 4, status: 'provisional' });
    const older = published({ version: 3, status: 'official' });

    expect(supersedes(newer, older)).toBe(true);
    expect(supersedes(older, newer)).toBe(false);
  });

  it('ranks a document carrying no version below any that carries one', () => {
    // §4.4.2 says a republication increases the version, so a document without
    // one is not a republication.
    expect(supersedes(published({ version: 0 }), published())).toBe(true);
    expect(supersedes(published(), published({ version: 0 }))).toBe(false);
  });
});

describe('standing decides at equal version', () => {
  const at = (status: DocumentStatus): ResultDocument => published({ version: 2, status });

  it.each([
    ['official', 'provisional'],
    ['amended', 'provisional'],
    ['official', 'draft'],
    ['provisional', 'draft'],
  ] as const)('%s supersedes %s', (higher, lower) => {
    expect(supersedes(at(higher), at(lower))).toBe(true);
    expect(supersedes(at(lower), at(higher))).toBe(false);
  });

  it('does not separate official from amended', () => {
    // §4.4.3 names them together. An amendment that did not increase the
    // version is a producer error, not an ordering this can resolve.
    expect(supersedes(at('official'), at('amended'))).toBeUndefined();
    expect(supersedes(at('amended'), at('official'))).toBeUndefined();
  });
});

describe('what the rule does not decide', () => {
  it('says nothing about documents that do not share an id', () => {
    const one = published({ id: 'vallonne-tt-2026', version: 9 });
    const other = published({ id: 'vallonne-road-2026', version: 1 });

    expect(supersedes(one, other)).toBeUndefined();
  });

  it('says nothing when either carries no id', () => {
    // A document with no id names no subject, so it can supersede nothing —
    // including another document with no id, which is not the same publication
    // merely because both are anonymous.
    // Built without the key rather than with it set to undefined: under
    // `exactOptionalPropertyTypes` those are different types, and a document
    // that omits an id is the one a producer actually writes.
    const anonymous: ResultDocument = {
      openresult: '1.0',
      title: 'Vallonne time trial',
      version: 2,
      participants: [{ id: 'ana', name: 'Ana Rivas' }],
      results: [{ participant: 'ana', values: {} }],
    };

    expect(supersedes(anonymous, published({ version: 1 }))).toBeUndefined();
    expect(supersedes(published({ version: 1 }), anonymous)).toBeUndefined();
    expect(supersedes(anonymous, anonymous)).toBeUndefined();
  });

  it('says nothing when a status is absent and the versions are equal', () => {
    // §4.4.3 ranks official and amended above provisional above draft. A
    // document stating no status is in none of those ranks, and §4.4.4 covers
    // an *unknown* status, which is a different thing from an absent one.
    const stated = published({ version: 2, status: 'official' });
    const silent = published({ version: 2 });

    expect(supersedes(stated, silent)).toBeUndefined();
    expect(supersedes(silent, stated)).toBeUndefined();
  });

  it('says nothing about a document and itself', () => {
    const only = published({ version: 2, status: 'official' });

    expect(supersedes(only, only)).toBeUndefined();
  });
});
