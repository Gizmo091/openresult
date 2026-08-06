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
  it('renders 500 results without a change of order in cost', () => {
    // A ratio, not a stopwatch.
    //
    // Two absolute budgets were tried here and both failed on a busy machine
    // rather than on a regression: 2 s, then 4 s. Running four suites at once
    // broke the second one three times out of four, which is a test measuring
    // the machine rather than the code.
    //
    // Ten times the input costs about fifteen times as much here — rendering is
    // not perfectly linear — and a quadratic would cost a hundred. The
    // threshold sits between those two, not near the measurement: this catches
    // a change of order, and makes no claim about a twenty percent drift.
    // Contention lifts both measurements together, which is what the two
    // absolute budgets could not survive.
    //
    // It is still a timing test, so it has a floor: running four full suites at
    // once — four browsers on one machine — breaks it about half the time. CI
    // runs one, and so does anyone working here. That is the honest limit
    // rather than a reason to widen the threshold until it means nothing.
    const small = document_(100);
    const large = document_(500);
    renderInto(small); // warm up
    renderInto(large);

    const time = (source: ResultDocument): number => {
      const started = performance.now();
      renderInto(source);
      return performance.now() - started;
    };

    // Floored at a millisecond: the small render can round to zero on a fast
    // machine, and dividing by it would report an infinite ratio.
    const ratio = time(large) / Math.max(time(small), 1);
    expect(ratio).toBeLessThan(50);
  }, 30_000); // Four renders in one test; the 5 s default is not enough for the work itself.

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
  }, 30_000); // only has to finish. // running. The budget assertion above is what guards the cost; this one // Around 3 s idle, so the 5 s default tips over whenever anything else is
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
