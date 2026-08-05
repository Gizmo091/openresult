import { formatValue, normalizeStatus, type Measure, type RankedEntry } from '@openresult/core';
import type { ViewModel } from '../core/view-model.js';

/**
 * Wording shared by the views.
 *
 * These labels describe *format* concepts — participation statuses, absent
 * measures — never competition domains. A status means the same thing in a
 * trail race and in a benchmark run, which is precisely why the format defines
 * it rather than leaving it to prose.
 */
const STATUS_LABELS: Record<string, string> = {
  finished: 'finished',
  bye: 'bye',
  inProgress: 'in progress',
  dnf: 'did not finish',
  dns: 'did not start',
  dsq: 'disqualified',
  outOfTime: 'outside the time limit',
  withdrawn: 'withdrawn',
};

export function statusLabel(status: string | undefined): string {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] ?? normalized;
}

export function isRanked(entry: RankedEntry): boolean {
  return entry.rank !== null;
}

/** A cell: the formatted value, or the reason there is none. */
export function cellText(model: ViewModel, entry: RankedEntry, measure: Measure): string {
  const value = entry.values[measure.id];
  if (value === undefined) {
    return isRanked(entry) ? '—' : statusLabel(entry.result.status);
  }
  return formatValue(value, measure, { locale: model.locale });
}

export function attributeText(entry: RankedEntry, attributeId: string): string {
  const value =
    entry.result.attributes?.[attributeId] ?? entry.participant.attributes?.[attributeId];
  if (value === undefined) return '';
  return typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
}

/** Attributes carried by at least one visible participant or result. */
export function visibleAttributes(model: ViewModel): ViewModel['attributes'] {
  const order = model.document.presentation?.attributeOrder;
  const used = model.attributes.filter((attribute) =>
    model.ranked.some((entry) => attributeText(entry, attribute.id) !== ''),
  );
  if (order === undefined) return used;

  const position = new Map(order.map((id, index) => [id, index]));
  return [...used].sort(
    (a, b) =>
      (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (position.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function isHighlighted(model: ViewModel, participantId: string): boolean {
  return model.document.presentation?.highlight?.includes(participantId) ?? false;
}

/** Measures the active ranking sorts on — the ones that decide the order. */
export function rankingMeasures(model: ViewModel): Measure[] {
  const active = model.rankings.find((entry) => entry.id === model.activeRanking);
  if (active === undefined) return [];
  return active.sortBy
    .map((id) => model.measures.find((measure) => measure.id === id))
    .filter((measure): measure is Measure => measure !== undefined);
}
