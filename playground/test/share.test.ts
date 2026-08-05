import { describe, expect, it } from 'vitest';
import { decodeFragment, encodeDocument } from '../src/share.js';

/**
 * A shared link must survive the round trip exactly: the reader on the other
 * end is meant to see the same document, not a lossy approximation.
 */
describe('sharing a document', () => {
  const document = JSON.stringify(
    {
      openresult: '1.0',
      title: 'Épreuve — 21 km',
      participants: [{ id: 'a', name: 'Léa Marchand' }],
      results: [{ participant: 'a' }],
    },
    null,
    2,
  );

  it('round-trips exactly, accents included', async () => {
    const fragment = await encodeDocument(document);
    expect(await decodeFragment(fragment)).toBe(document);
  });

  it('produces a fragment, which browsers never send to a server', async () => {
    const fragment = await encodeDocument(document);
    expect(fragment.startsWith('#doc=')).toBe(true);
  });

  it('uses URL-safe characters only', async () => {
    const fragment = await encodeDocument(document);
    expect(fragment.slice('#doc='.length)).toMatch(/^[A-Za-z0-9_-]*$/);
  });

  it('compresses repetitive documents well', async () => {
    const repetitive = JSON.stringify({
      openresult: '1.0',
      title: 'Big',
      participants: Array.from({ length: 200 }, (_, index) => ({
        id: `p${index}`,
        name: `Competitor ${index}`,
      })),
      results: [],
    });
    const fragment = await encodeDocument(repetitive);
    expect(fragment.length).toBeLessThan(repetitive.length / 2);
  });

  it('ignores a fragment that is not ours', async () => {
    expect(await decodeFragment('#section-3')).toBeNull();
    expect(await decodeFragment('')).toBeNull();
  });

  it('returns null on a truncated link rather than throwing', async () => {
    const fragment = await encodeDocument(document);
    expect(await decodeFragment(fragment.slice(0, fragment.length - 12))).toBeNull();
  });
});
