import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import type { ResultDocument } from '@openresult/core';
import { applicableViews, buildViewModel, selectView } from '../src/index.js';

/**
 * Rendering budget and accessibility.
 *
 * The viewer is embedded in pages it does not control, next to content it does
 * not own. It has to be quick, and it has to be usable by someone who is not
 * looking at it.
 */

function document_(size: number): ResultDocument {
  return {
    openresult: '1.0',
    title: `${size} results`,
    lang: 'en',
    measures: [
      { id: 'time', label: 'Time', kind: 'duration', unit: 's', precision: 2, betterWhen: 'lower' },
      { id: 'laps', label: 'Laps', kind: 'count', unit: 'lap', betterWhen: 'higher' },
    ],
    attributes: [{ id: 'club', label: 'Club', type: 'text' }],
    participants: Array.from({ length: size }, (_, index) => ({
      id: `p${index}`,
      name: `Competitor ${index}`,
      attributes: { club: `Club ${index % 12}` },
    })),
    results: Array.from({ length: size }, (_, index) => ({
      participant: `p${index}`,
      values: { time: 1000 + ((index * 7919) % size), laps: 18 },
    })),
    rankings: [{ id: 'main', label: 'Main', sortBy: ['time'] }],
  };
}

function renderInto(source: ResultDocument): HTMLElement {
  const model = buildViewModel(source);
  const plugin = selectView(model);
  const host = window.document.createElement('div');
  render(plugin!.render({ model, selection: [], onSelect: () => {} }) as never, host);
  return host;
}

describe('rendering budget', () => {
  it('renders 500 results well inside the 2 s budget', () => {
    const source = document_(500);
    renderInto(source); // warm up

    const started = performance.now();
    renderInto(source);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('renders every applicable view of a 500-result document', () => {
    const model = buildViewModel(document_(500));
    for (const candidate of applicableViews(model)) {
      const host = window.document.createElement('div');
      expect(() =>
        render(
          candidate.plugin.render({ model, selection: [], onSelect: () => {} }) as never,
          host,
        ),
      ).not.toThrow();
    }
  });
});

describe('accessibility', () => {
  it('renders the table view as a real table with a header row', () => {
    const model = buildViewModel(document_(10));
    const table = applicableViews(model).find((entry) => entry.plugin.id === 'table');
    const host = window.document.createElement('div');
    render(table!.plugin.render({ model, selection: [], onSelect: () => {} }) as never, host);

    // A grid of divs is unreadable with a screen reader; a table announces its
    // header and lets the reader navigate by column.
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelectorAll('thead th').length).toBeGreaterThan(2);
    expect(host.querySelectorAll('tbody tr').length).toBe(10);
  });

  it('renders standings as an ordered list, because they are ordered', () => {
    const model = buildViewModel(document_(10));
    const ranking = applicableViews(model).find((entry) => entry.plugin.id === 'ranking');
    const host = window.document.createElement('div');
    render(ranking!.plugin.render({ model, selection: [], onSelect: () => {} }) as never, host);

    expect(host.querySelector('ol')).not.toBeNull();
    expect(host.querySelectorAll('ol > li').length).toBe(10);
  });

  it('gives images an alt text drawn from the document', () => {
    const source = document_(3);
    source.participants[0]!.assets = [
      { type: 'image', href: 'https://example.org/a.jpg', label: 'On the podium' },
    ];
    source.presentation = { defaultView: 'cards' };

    const host = renderInto(source);
    const image = host.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('On the podium');
  });

  it('falls back to the participant name when an image has no label', () => {
    const source = document_(3);
    source.participants[0]!.assets = [{ type: 'image', href: 'https://example.org/a.jpg' }];
    source.presentation = { defaultView: 'cards' };

    const host = renderInto(source);
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('Competitor 0');
  });

  it('marks unranked rows so they are distinguishable without colour', () => {
    const source = document_(5);
    source.results[2]!.status = 'dnf';
    delete source.results[2]!.values;

    const host = renderInto(source);
    const unranked = host.querySelectorAll('[data-unranked="true"]');
    expect(unranked.length).toBe(1);
    // The status is written out, not implied by styling alone.
    expect(host.textContent).toContain('did not finish');
  });
});
