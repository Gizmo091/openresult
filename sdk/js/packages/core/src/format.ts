import type { Measure, MeasureValue } from './types.js';

export interface FormatOptions {
  locale?: string;
  /** Render durations as h:mm:ss.sss rather than raw seconds. Default: true. */
  humanizeDuration?: boolean;
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

  const { locale, humanizeDuration = true } = options;
  const precision = measure.precision;

  if (measure.kind === 'duration' && humanizeDuration && isTimeUnit(measure.unit)) {
    return formatDuration(toSeconds(value, measure.unit), precision ?? 0);
  }

  const formatted =
    precision === undefined
      ? new Intl.NumberFormat(locale).format(value)
      : new Intl.NumberFormat(locale, {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);

  return measure.unit === undefined ? formatted : `${formatted} ${measure.unit}`;
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

  const secondsText = seconds.toFixed(precision);
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
