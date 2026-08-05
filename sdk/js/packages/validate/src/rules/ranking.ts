import {
  DEFAULT_EXCLUDED_STATUSES,
  measure,
  normalizeBetterWhen,
  normalizeStatus,
  normalizeTies,
  rank,
  type ResultDocument,
} from '@openresult/core';
import { diagnostic, pointer, type Diagnostic } from '../diagnostics.js';

/**
 * Ranking coherence.
 *
 * These rules exist because a document can declare a ranking that cannot order
 * anything — sorting on a measure with no direction, or requiring no ties where
 * a tie exists. The schema cannot see any of it.
 */
export function checkRanking(document: ResultDocument): Diagnostic[] {
  const found: Diagnostic[] = [];

  (document.rankings ?? []).forEach((ranking, index) => {
    if (ranking.sortBy.length === 0) {
      found.push(
        diagnostic(
          'OR-304',
          pointer('rankings', index, 'sortBy'),
          `Ranking "${ranking.label}" lists no measure to sort on, so it cannot order anything.`,
          `Add at least one measure id to sortBy.`,
        ),
      );
    }

    ranking.sortBy.forEach((measureId, measureIndex) => {
      const definition = measure(document, measureId);
      if (definition === undefined) return; // Reported as OR-201 elsewhere.

      if (normalizeBetterWhen(definition.betterWhen) === 'none') {
        found.push(
          diagnostic(
            'OR-301',
            pointer('rankings', index, 'sortBy', measureIndex),
            `Ranking "${ranking.label}" sorts on "${definition.label}", which declares ` +
              `betterWhen: "none" — nothing says which direction wins.`,
            `Set betterWhen to "lower" or "higher" on the measure, or sort on a different one.`,
          ),
        );
      }
    });

    const entries = rank(document, ranking.id);

    if (entries.length === 0) {
      found.push(
        diagnostic(
          'OR-906',
          pointer('rankings', index),
          `Ranking "${ranking.label}" selects no result at all.`,
          `Check its scope: the event or category may hold no results.`,
        ),
      );
    }

    if (normalizeTies(ranking.ties) === 'strict') {
      const tied = entries.filter((entry) => entry.rank !== null && entry.tiedWith.length > 0);
      if (tied.length > 0) {
        const names = tied.map((entry) => entry.participant.name).join(', ');
        found.push(
          diagnostic(
            'OR-302',
            pointer('rankings', index, 'ties'),
            `Ranking "${ranking.label}" declares ties: "strict", but ${names} finish level ` +
              `on every sorting measure.`,
            `Add a tie-break measure to sortBy, or switch ties to "standard" or "dense".`,
          ),
        );
      }
    }
  });

  // A supplied rank is information, not instruction (spec §3.3.2): a divergence
  // is worth flagging, never fatal — a producer may apply a rule that lives
  // outside the document.
  const excluded = new Set(DEFAULT_EXCLUDED_STATUSES);
  const primary = (document.rankings ?? [])[0];

  document.results.forEach((result, index) => {
    const status = normalizeStatus(result.status);

    if (result.rank !== undefined && excluded.has(status)) {
      found.push(
        diagnostic(
          'OR-303',
          pointer('results', index, 'rank'),
          `This result carries rank ${result.rank} but its status is "${status}", which is not ` +
            `rankable.`,
          `Remove the "rank" member, or change the status if the participant was classified.`,
        ),
      );
    }
  });

  if (primary !== undefined) {
    const derived = new Map(
      rank(document, primary.id).map((entry) => [entry.result, entry.rank] as const),
    );

    document.results.forEach((result, index) => {
      const expected = derived.get(result);
      if (result.rank !== undefined && expected !== undefined && expected !== result.rank) {
        found.push(
          diagnostic(
            'OR-902',
            pointer('results', index, 'rank'),
            `The document states rank ${result.rank}, but "${primary.label}" derives ` +
              `${expected === null ? 'no rank' : expected} from the measures.`,
            `Check the tie-break rule, or drop the "rank" member and let it be derived.`,
          ),
        );
      }
    });
  }

  return found;
}
