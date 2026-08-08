import { html } from 'lit';
import { describe, expect, it } from 'vitest';
import {
  applicableViews,
  buildViewModel,
  registerView,
  registeredViews,
  selectView,
} from '../src/index.js';
import type { ResultDocument } from '@openresult/core';

/**
 * The extension point, exercised by views that misbehave.
 *
 * "Views are extensible" is a promise about code this project did not write.
 * The built-in views are all well behaved, so every branch that exists to
 * survive one that is not had never run: a plugin that throws while scoring, one
 * that returns a number that is not a score, one that claims an id another
 * already holds.
 *
 * A viewer that dies because a third-party view threw has failed at the one
 * thing it must do — show the document.
 */

const DOCUMENT: ResultDocument = {
  openresult: '1.0',
  title: 'Registry fixture',
  measures: [{ id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' }],
  participants: [
    { id: 'ana', name: 'Ana Rivas' },
    { id: 'bo', name: 'Bo Lindqvist' },
  ],
  results: [
    { participant: 'ana', values: { time: 604.2 } },
    { participant: 'bo', values: { time: 598.7 } },
  ],
};

const model = buildViewModel(DOCUMENT);

/** A view that does nothing but report the score it was told to. */
const plugin = (id: string, supports: () => number) => ({
  id,
  label: id,
  supports,
  render: () => html`<p>${id}</p>`,
});

const scoreOf = (id: string): number | undefined =>
  applicableViews(model).find((candidate) => candidate.plugin.id === id)?.score;

describe('a view that misbehaves while scoring', () => {
  it('is skipped rather than taking the viewer down', () => {
    registerView(
      plugin('throws-on-score', () => {
        throw new Error('a third-party view with a bug in it');
      }),
    );

    expect(() => applicableViews(model)).not.toThrow();
    expect(scoreOf('throws-on-score')).toBeUndefined();
    // And the document still has a view to render in.
    expect(selectView(model)).toBeDefined();
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative score', -1],
    ['zero', 0],
  ])('treats %s as inapplicable', (name, score) => {
    const id = `scores-${name.replace(/\s+/g, '-')}`;
    registerView(plugin(id, () => score));

    // Infinity is not finite, so it is refused rather than winning everything.
    expect(scoreOf(id)).toBeUndefined();
  });

  it('caps a score above one instead of letting it outrank everything', () => {
    registerView(plugin('claims-a-hundred', () => 100));

    expect(scoreOf('claims-a-hundred')).toBe(1);
  });
});

describe('registering', () => {
  it('replaces a view claiming an id another already holds', () => {
    registerView(plugin('replaced-twice', () => 0.4));
    const before = registeredViews().length;

    registerView({ ...plugin('replaced-twice', () => 0.9), label: 'the second one' });

    // Replaced, not added: two views answering to one id would make the choice
    // depend on which was registered first.
    expect(registeredViews().length).toBe(before);
    expect(scoreOf('replaced-twice')).toBe(0.9);
    expect(registeredViews().find((view) => view.id === 'replaced-twice')?.label).toBe(
      'the second one',
    );
  });

  it('keeps a replaced view in its original position', () => {
    // Position is the tie-break between views scoring equally, so replacing one
    // must not quietly promote it past everything registered since.
    registerView(plugin('first-registered', () => 0.5));
    registerView(plugin('second-registered', () => 0.5));
    registerView(plugin('first-registered', () => 0.5));

    const order = applicableViews(model).map((candidate) => candidate.plugin.id);
    expect(order.indexOf('first-registered')).toBeLessThan(order.indexOf('second-registered'));
  });
});

describe('choosing between them', () => {
  it('orders by score, and by registration order at equal score', () => {
    registerView(plugin('scores-low', () => 0.2));
    registerView(plugin('scores-high', () => 0.95));

    const ranked = applicableViews(model).map((candidate) => candidate.plugin.id);
    expect(ranked.indexOf('scores-high')).toBeLessThan(ranked.indexOf('scores-low'));
  });

  it('prefers a request over a producer hint, and a hint over the best score', () => {
    registerView(plugin('requested-view', () => 0.1));
    registerView(plugin('hinted-view', () => 0.1));

    const hinted = buildViewModel({ ...DOCUMENT, presentation: { defaultView: 'hinted-view' } });

    expect(selectView(hinted, 'requested-view')?.id).toBe('requested-view');
    expect(selectView(hinted)?.id).toBe('hinted-view');
  });

  it('ignores a hint naming a view that scores nothing here', () => {
    // §10.1.3: a suggestion the consumer cannot honour leaves it to choose, and
    // must never leave the reader with a blank page.
    registerView(plugin('never-applies', () => 0));

    const hinted = buildViewModel({ ...DOCUMENT, presentation: { defaultView: 'never-applies' } });
    const chosen = selectView(hinted);

    expect(chosen).toBeDefined();
    expect(chosen?.id).not.toBe('never-applies');
  });
});
