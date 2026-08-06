import { describe, expect, it } from 'vitest';
import { formatAttribute, formatValue } from '../src/index.js';
import type { AttributeDefinition, Measure } from '../src/index.js';

/**
 * Display, which the specification governs more than it looks.
 *
 * §5.2.5 fixes how a duration renders and §5.1.8 how a bounded score does, and
 * until now neither had a unit test — which is part of why the reference
 * implementation and the minimal Python reader disagreed about durations for as
 * long as both existed, with nothing to notice.
 *
 * The locale is pinned in every case: these assertions are about the format's
 * rules, not about where the test runs.
 */

const measure = (overrides: Partial<Measure>): Measure => ({
  id: 'm',
  label: 'M',
  kind: 'score',
  unit: 'pt',
  betterWhen: 'higher',
  ...overrides,
});

describe('durations render in hours, minutes and seconds (§5.2.5)', () => {
  const time = measure({ kind: 'duration', unit: 's', precision: 2 });

  it.each([
    [55.1, '55.10'],
    [132.88, '2:12.88'],
    [5298.7, '1:28:18.70'],
    [0, '0.00'],
  ])('renders %s as %s', (value, expected) => {
    expect(formatValue(value, time, { locale: 'en-GB' })).toBe(expected);
  });

  it('drops leading zero components rather than padding them', () => {
    // A 12-second lap shown as 0:00:12.00 reads worse than 12.00.
    expect(formatValue(12, time, { locale: 'en-GB' })).toBe('12.00');
  });

  it('keeps the sign on a negative duration', () => {
    // A takeover before the incoming swimmer touches is negative, and it is a
    // fault worth seeing rather than a stray minus.
    expect(formatValue(-0.03, measure({ kind: 'duration', unit: 's', precision: 2 }))).toBe(
      '-0.03',
    );
  });

  it('converts to seconds first, whatever time unit is declared', () => {
    expect(formatValue(90, measure({ kind: 'duration', unit: 'min' }), { locale: 'en-GB' })).toBe(
      '1:30:00',
    );
    expect(formatValue(1500, measure({ kind: 'duration', unit: 'ms' }), { locale: 'en-GB' })).toBe(
      '2',
    );
  });

  it('leaves a duration in an unrecognised unit alone', () => {
    // `lap` is not a time unit, so there is nothing to convert and guessing
    // would be worse than showing the number as declared.
    const laps = measure({ kind: 'duration', unit: 'lap', precision: 0 });
    expect(formatValue(4, laps, { locale: 'en-GB' })).toBe('4 lap');
  });
});

describe('a bounded score renders against its maximum (§5.1.8)', () => {
  it('shows the scale when one is declared', () => {
    const nose = measure({ kind: 'score', max: 30 });
    expect(formatValue(27, nose, { locale: 'en-GB' })).toBe('27/30');
  });

  it('keeps the declared precision on both halves', () => {
    const palate = measure({ kind: 'score', max: 40, precision: 1 });
    expect(formatValue(36.5, palate, { locale: 'en-GB' })).toBe('36.5/40.0');
  });

  it('falls back to the unit when no maximum is declared', () => {
    expect(formatValue(27, measure({ kind: 'score' }), { locale: 'en-GB' })).toBe('27 pt');
  });

  it('leaves a percentage alone, which already carries its scale', () => {
    // "85/100 %" is worse than either half.
    const share = measure({ kind: 'percentage', unit: '%', max: 100, precision: 1 });
    expect(formatValue(85.4, share, { locale: 'en-GB' })).toBe('85.4 %');
  });

  it('leaves a duration alone even where a maximum exists', () => {
    const limit = measure({ kind: 'duration', unit: 's', precision: 0, max: 300 });
    expect(formatValue(132, limit, { locale: 'en-GB' })).toBe('2:12');
  });

  it('can be turned off for a caller that wants the bare figure', () => {
    const nose = measure({ kind: 'score', max: 30 });
    expect(formatValue(27, nose, { locale: 'en-GB', showScale: false })).toBe('27 pt');
  });
});

describe('attributes carry their unit (§5.3.7)', () => {
  const attribute = (overrides: Partial<AttributeDefinition>): AttributeDefinition => ({
    id: 'a',
    label: 'A',
    type: 'number',
    ...overrides,
  });

  it('appends the declared unit to a number', () => {
    expect(formatAttribute(182.4, attribute({ unit: 'km' }), { locale: 'en-GB' })).toBe('182.4 km');
  });

  it('leaves a number with no unit as a number', () => {
    expect(formatAttribute(4, attribute({}), { locale: 'en-GB' })).toBe('4');
  });

  it('passes text through untouched', () => {
    expect(formatAttribute('Malmö SS', attribute({ type: 'text' }))).toBe('Malmö SS');
  });

  it('renders a boolean as a word rather than true or false', () => {
    expect(formatAttribute(true, attribute({ type: 'boolean' }))).toBe('yes');
    expect(formatAttribute(false, attribute({ type: 'boolean' }))).toBe('no');
  });
});

describe('formatting never decides an order', () => {
  it('is locale-sensitive where ranking is not', () => {
    const throughput = measure({ kind: 'rate', unit: 'samples/s', precision: 1 });
    const english = formatValue(1671, throughput, { locale: 'en-GB' });
    const french = formatValue(1671, throughput, { locale: 'fr-FR' });

    expect(english).toBe('1,671.0 samples/s');
    // French groups with a narrow no-break space and separates with a comma.
    expect(french).not.toBe(english);
    expect(french).toContain('samples/s');
  });
});
