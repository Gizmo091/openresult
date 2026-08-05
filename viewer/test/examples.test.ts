import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { parse } from '@openresult/core';
import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import { applicableViews, buildViewModel, selectView } from '../src/index.js';

/**
 * The promise the whole format rests on: every conforming document renders
 * correctly with no per-document configuration and no domain knowledge.
 *
 * If one of these fails, the fix is in the format's semantics — not in a
 * special case here.
 */

// Vitest runs from the workspace root, which is where the example library
// lives. Deriving the path from import.meta.url breaks under the browser
// environment, where module URLs are served rather than absolute.
const repoRoot = `${process.cwd()}/`;
const files = globSync('examples/**/*.openresult.json', { cwd: repoRoot }).sort();

const load = (file: string) => parse(readFileSync(`${repoRoot}${file}`, 'utf8'));

function renderToString(template: unknown): string {
  const host = document.createElement('div');
  render(template as never, host);
  return host.textContent ?? '';
}

describe('the example library', () => {
  it('is discovered', () => {
    expect(files.length).toBeGreaterThanOrEqual(19);
  });
});

describe.each(files)('%s', (file) => {
  it('always has at least one applicable view', () => {
    const model = buildViewModel(load(file));
    expect(applicableViews(model).length).toBeGreaterThan(0);
  });

  it('can always fall back to the table view', () => {
    const model = buildViewModel(load(file));
    const table = applicableViews(model).find((candidate) => candidate.plugin.id === 'table');
    expect(table?.score).toBeGreaterThan(0);
  });

  it('renders without throwing, and produces content', () => {
    const model = buildViewModel(load(file));
    const plugin = selectView(model);
    expect(plugin).toBeDefined();

    const text = renderToString(plugin!.render({ model, selection: [], onSelect: () => {} }));

    // An announced event with no results legitimately renders nothing.
    if (model.ranked.length > 0) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).toContain(model.ranked[0]!.participant.name);
    }
  });

  it('renders in every applicable view', () => {
    const model = buildViewModel(load(file));
    for (const candidate of applicableViews(model)) {
      expect(() =>
        renderToString(candidate.plugin.render({ model, selection: [], onSelect: () => {} })),
      ).not.toThrow();
    }
  });

  it('ranks identically with and without the presentation layer', () => {
    const withHints = buildViewModel(load(file));
    const document = load(file);
    delete document.presentation;
    const without = buildViewModel(document);

    expect(without.ranked.map((entry) => [entry.participant.id, entry.rank])).toEqual(
      withHints.ranked.map((entry) => [entry.participant.id, entry.rank]),
    );
  });
});

describe('view selection', () => {
  it('honours a producer hint only when the view applies', () => {
    const document = load('examples/photo-contest/wildlife-open-2026.openresult.json');
    expect(document.presentation?.defaultView).toBe('cards');
    expect(selectView(buildViewModel(document))?.id).toBe('cards');

    document.presentation = { defaultView: 'constellation' };
    const chosen = selectView(buildViewModel(document));
    expect(chosen).toBeDefined();
    expect(chosen?.id).not.toBe('constellation');
  });

  it('lets an explicit request win over the hint', () => {
    const document = load('examples/photo-contest/wildlife-open-2026.openresult.json');
    expect(selectView(buildViewModel(document), 'table')?.id).toBe('table');
  });

  it('falls back to automatic selection when the request does not apply', () => {
    const document = load('examples/running/crest-trail-21k.openresult.json');
    const chosen = selectView(buildViewModel(document), 'nonexistent');
    expect(chosen).toBeDefined();
    expect(chosen?.id).not.toBe('nonexistent');
  });
});

describe('unknown content degrades quietly', () => {
  it('renders a document carrying extensions and unknown enum values', () => {
    const model = buildViewModel(
      load('examples/edge-cases/extensions-and-unknown-values.openresult.json'),
    );
    const plugin = selectView(model);

    expect(plugin).toBeDefined();
    const text = renderToString(plugin!.render({ model, selection: [], onSelect: () => {} }));
    expect(text).toContain('Competitor B');
    // The unknown defaultView must not leave the reader with nothing.
    expect(model.document.presentation?.defaultView).toBe('constellation');
  });

  it('shows non-rankable participants rather than dropping them', () => {
    const model = buildViewModel(
      load('examples/edge-cases/missing-values-and-statuses.openresult.json'),
    );
    const plugin = selectView(model);
    const text = renderToString(plugin!.render({ model, selection: [], onSelect: () => {} }));

    expect(text).toContain('did not finish');
    expect(text).toContain('disqualified');
    expect(model.ranked.filter((entry) => entry.rank === null).length).toBeGreaterThan(0);
  });
});
