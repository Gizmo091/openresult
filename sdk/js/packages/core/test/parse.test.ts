import { describe, expect, it } from 'vitest';
import {
  formatVersion,
  isOpenResult,
  NotOpenResultError,
  parse,
  SUPPORTED_VERSION,
  UnsupportedVersionError,
} from '../src/index.js';

/**
 * Reading a document, and refusing what is not one.
 *
 * This is the first function every consumer calls and it was the least tested
 * thing in the package — 11% of its lines. It is also where a bad input has to
 * become a message someone can act on: a producer whose file is rejected gets
 * this text and nothing else.
 *
 * The major-version rule is the load-bearing part. A 2.0 document may mean
 * something different by the same member names, so reading it as 1.0 would
 * produce standings that look right and are not (spec §11.1).
 */

const MINIMAL = {
  openresult: '1.0',
  title: 'Test',
  participants: [{ id: 'a', name: 'A' }],
  results: [{ participant: 'a' }],
};

describe('parse accepts what it should', () => {
  it('reads a JSON string', () => {
    const document = parse(JSON.stringify(MINIMAL));
    expect(document.title).toBe('Test');
    expect(document.participants).toHaveLength(1);
  });

  it('reads an already-decoded value without re-serialising it', () => {
    const document = parse(MINIMAL);
    // The same object, not a copy: a caller that parsed the JSON itself should
    // not pay for a second decode.
    expect(document).toBe(MINIMAL);
  });

  it('reads a higher minor version, carrying members it does not know', () => {
    // §11.4: a 1.7 document is readable by a 1.0 consumer, and whatever it adds
    // travels along untouched.
    const future = { ...MINIMAL, openresult: '1.7', somethingNew: { nested: true } };
    const document = parse(future) as typeof future;

    expect(document.openresult).toBe('1.7');
    expect(document.somethingNew).toEqual({ nested: true });
  });

  it('accepts an empty field, which is an announced event', () => {
    expect(() => parse({ ...MINIMAL, participants: [], results: [] })).not.toThrow();
  });
});

describe('parse refuses what it must, and says why', () => {
  it('refuses a future major version rather than misreading it', () => {
    // The failure that matters: 2.0 may mean something else by the same names,
    // and standings that look right and are not are worse than a refusal.
    expect(() => parse({ ...MINIMAL, openresult: '2.0' })).toThrow(UnsupportedVersionError);

    try {
      parse({ ...MINIMAL, openresult: '2.0' });
    } catch (error) {
      expect((error as Error).message).toContain('2.0');
      expect((error as Error).message).toContain(
        `${SUPPORTED_VERSION.major}.${SUPPORTED_VERSION.minor}`,
      );
    }
  });

  it.each([
    ['malformed JSON', '{ "openresult": '],
    ['a JSON array', '[]'],
    ['a JSON string', '"just a string"'],
    ['a JSON number', '42'],
    ['null', 'null'],
  ])('refuses %s', (_what, input) => {
    expect(() => parse(input)).toThrow(NotOpenResultError);
  });

  it('names the missing version member rather than complaining abstractly', () => {
    try {
      parse({ title: 'No version', participants: [], results: [] });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('openresult');
      // The message shows what to write, because the reader is a producer who
      // has just had their file rejected.
      expect(message).toContain('"1.0"');
    }
  });

  it('refuses a version that is not MAJOR.MINOR, quoting what it found', () => {
    for (const declared of ['1', 'v1.0', '1.0.0', '', 'one.zero']) {
      expect(() => parse({ ...MINIMAL, openresult: declared })).toThrow(NotOpenResultError);
    }

    try {
      parse({ ...MINIMAL, openresult: 'v1.0' });
    } catch (error) {
      expect((error as Error).message).toContain('"v1.0"');
    }
  });

  it.each([
    ['participants', { openresult: '1.0', title: 'x', results: [] }],
    ['results', { openresult: '1.0', title: 'x', participants: [] }],
  ])('names %s when it is missing', (member, document) => {
    try {
      parse(document);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain(member);
    }
  });

  it('refuses a required member that is present but not an array', () => {
    expect(() => parse({ ...MINIMAL, participants: 'nobody' })).toThrow(NotOpenResultError);
    expect(() => parse({ ...MINIMAL, results: {} })).toThrow(NotOpenResultError);
  });
});

describe('isOpenResult is total', () => {
  it.each([
    [MINIMAL, true],
    [{ openresult: '1.7' }, true],
    [{ openresult: '2.0' }, true], // Recognisably one, just not readable here.
    [{ openresult: 'v1' }, false],
    [{ title: 'no version' }, false],
    [null, false],
    [undefined, false],
    ['a string', false],
    [42, false],
    [[], false],
  ])('returns %#', (value, expected) => {
    expect(isOpenResult(value)).toBe(expected);
  });

  it('never throws, whatever it is handed', () => {
    // The point of it: guarding a branch must not need a try/catch.
    const hostile = [Symbol('x'), () => {}, new Map(), Object.create(null), NaN, -0];
    for (const value of hostile) {
      expect(() => isOpenResult(value)).not.toThrow();
    }
  });
});

describe('formatVersion', () => {
  it('reads major and minor as numbers', () => {
    expect(formatVersion({ ...MINIMAL, openresult: '1.12' })).toEqual({ major: 1, minor: 12 });
  });

  it('throws on a version it cannot read', () => {
    expect(() => formatVersion({ ...MINIMAL, openresult: 'later' })).toThrow(NotOpenResultError);
  });
});
