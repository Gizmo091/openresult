import { normalizeBetterWhen } from './semantics.js';
import type { AttributeDefinition, AttributeValue, Measure, MeasureValue } from './types.js';

export interface FormatOptions {
  locale?: string;
  /** Render durations as h:mm:ss.sss rather than raw seconds. Default: true. */
  humanizeDuration?: boolean;
  /**
   * Render a bounded score against its maximum — `36/40` rather than `36 pt`.
   * Default: true.
   */
  showScale?: boolean;
}

/**
 * Render a value for display.
 *
 * This is the only locale-sensitive function in the package, and it never takes
 * part in ordering: sorting always compares raw values, so a ranking cannot
 * depend on where the consumer runs.
 */
export function formatValue(
  value: MeasureValue,
  measure: Measure,
  options: FormatOptions = {},
): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value;

  const { locale, humanizeDuration = true, showScale = true } = options;
  const precision = measure.precision;

  if (measure.kind === 'duration' && humanizeDuration && isTimeUnit(measure.unit)) {
    return formatDuration(toSeconds(value, measure.unit), precision ?? 0);
  }

  const formatted = decimal(value, precision, locale);

  // A jury score means nothing without its scale: 27 is excellent out of 30 and
  // poor out of 100 (spec §5.1.8). Only where a maximum is declared, and only
  // for judged kinds — a percentage already carries its scale in its unit, and
  // "85/100 %" would be worse than either half.
  // Three exclusions, each a case where the scale states something false: a
  // percentage carries its scale in its unit; a maximum of one reads `1.0/1.0`;
  // and where lower is better, a sailing race scored by finishing place out of
  // twenty-one shows the winner as `1.0/21.0`, which is the opposite of what
  // happened (spec §5.2.7).
  if (
    showScale &&
    measure.max !== undefined &&
    measure.max !== 1 &&
    normalizeBetterWhen(measure.betterWhen) === 'higher' &&
    (measure.kind === 'score' || measure.kind === 'points')
  ) {
    return `${formatted}/${decimal(measure.max, precision, locale)}`;
  }

  return measure.unit === undefined ? formatted : `${formatted} ${measure.unit}`;
}

/**
 * Render an attribute value.
 *
 * Attributes carry a unit too (spec §5.3.7) — a stage distance, a bottle price,
 * a time limit. Before that existed, producers put the unit in the label, where
 * no consumer could read it.
 */
export function formatAttribute(
  value: AttributeValue,
  attribute: AttributeDefinition,
  options: FormatOptions = {},
): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value !== 'number') return value;

  const formatted = decimal(value, undefined, options.locale);
  return attribute.unit === undefined ? formatted : `${formatted} ${attribute.unit}`;
}

/**
 * The most decimals `Intl.NumberFormat` accepts. Beyond it, it throws.
 *
 * §5.1.5 puts no ceiling on `precision` and the schema puts none either, so a
 * document may declare a hundred and one. A reader that threw on it would fail
 * to show results because the producer over-specified how to show them, which
 * is the one thing a consumer must never do (§11.3.1). A double carries about
 * seventeen significant digits, so everything past this point is zeros in any
 * case.
 */
const MOST_DECIMALS = 100;

function fractionDigits(precision: number): number {
  return Math.min(Math.max(Math.trunc(precision), 0), MOST_DECIMALS);
}

function decimal(value: number, precision: number | undefined, locale: string | undefined): string {
  return precision === undefined
    ? new Intl.NumberFormat(locale).format(value)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits(precision),
        maximumFractionDigits: fractionDigits(precision),
      }).format(value);
}

function isTimeUnit(unit: string | undefined): unit is 's' | 'ms' | 'min' | 'h' {
  return unit === 's' || unit === 'ms' || unit === 'min' || unit === 'h';
}

function toSeconds(value: number, unit: 's' | 'ms' | 'min' | 'h'): number {
  switch (unit) {
    case 'ms':
      return value / 1000;
    case 'min':
      return value * 60;
    case 'h':
      return value * 3600;
    default:
      return value;
  }
}

/**
 * A number to a fixed number of decimals, rounding a half away from zero
 * (spec §5.1.5).
 *
 * Not `toFixed`, which rounds the binary double: `2.675` is stored as
 * `2.67499…`, so `toFixed(2)` answers `2.67` while `Intl.NumberFormat` — which
 * every other value here goes through — answers `2.68`. The same figure
 * rendered two ways by one implementation, depending only on whether it was a
 * duration.
 *
 * `Intl` rounds the decimal the document wrote, which is the number a producer
 * typed and the one they will look for. Fixed to `en` so the digits carry `.`
 * and no grouping, exactly as the clock form needs; the locale-aware path is
 * `decimal()`.
 */
function toDecimalPlaces(value: number, precision: number): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: fractionDigits(precision),
    maximumFractionDigits: fractionDigits(precision),
    useGrouping: false,
  }).format(value);
}

/**
 * Seconds to a readable duration: `1:28:18.7`, `28:18.70`, `18.712`.
 *
 * Leading zero components are dropped, because a 12-second lap displayed as
 * `0:00:12.000` reads worse than `12.000`.
 */
function formatDuration(totalSeconds: number, precision: number): string {
  const negative = totalSeconds < 0;
  const absolute = Math.abs(totalSeconds);

  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const seconds = absolute % 60;

  const secondsText = toDecimalPlaces(seconds, precision);
  const padded = seconds < 10 ? `0${secondsText}` : secondsText;

  let text: string;
  if (hours > 0) {
    text = `${hours}:${String(minutes).padStart(2, '0')}:${padded}`;
  } else if (minutes > 0) {
    text = `${minutes}:${padded}`;
  } else {
    text = secondsText;
  }

  return negative ? `-${text}` : text;
}
