import {
  DEFAULT_EXCLUDED_STATUSES,
  measure,
  normalizeBetterWhen,
  normalizeStatus,
  normalizeTies,
  rank,
  type Result,
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
      } else if (definition.kind === 'text' || definition.kind === 'boolean') {
        // "Ascending" over text has no single answer, so two consumers would
        // disagree — the divergence spec §8.5.6 forbids.
        found.push(
          diagnostic(
            'OR-305',
            pointer('rankings', index, 'sortBy', measureIndex),
            `Ranking "${ranking.label}" sorts on "${definition.label}", a ${definition.kind} ` +
              `measure. Only numeric kinds may decide an order: text has no ordering two ` +
              `consumers would agree on.`,
            `Declare a numeric measure for the ordering and keep "${definition.id}" as an attribute.`,
          ),
        );
      }
    });

    const entries = rank(document, ranking.id);

    // Warn only where the record is *partial* — some sorting measures present,
    // not all. That is a competitor who took part and whose record is
    // incomplete, which is usually a mistake.
    //
    // A result carrying none of them is a different thing: an angler who caught
    // nothing has no heaviest fish, and a "heaviest fish" ranking is right to
    // leave him out. Warning there would push producers to write `0` for a fish
    // that does not exist, destroying the absent-versus-zero distinction the
    // format rests on (spec §8.5.2).
    const droppedForMeasure = entries.filter((entry) => {
      if (entry.rank !== null) return false;

      const excluded = ranking.excludeStatuses ?? DEFAULT_EXCLUDED_STATUSES;
      if (excluded.includes(normalizeStatus(entry.result.status))) return false;

      const present = ranking.sortBy.filter((id) => entry.values[id] !== undefined).length;
      return present > 0 && present < ranking.sortBy.length;
    });
    if (droppedForMeasure.length > 0) {
      const names = droppedForMeasure
        .slice(0, 3)
        .map((entry) => entry.participant.name)
        .join(', ');
      const more = droppedForMeasure.length > 3 ? `, and ${droppedForMeasure.length - 3} more` : '';
      found.push(
        diagnostic(
          'OR-908',
          pointer('rankings', index),
          `Ranking "${ranking.label}" leaves ${droppedForMeasure.length} result(s) unranked ` +
            `because they lack a measure it sorts on — ${names}${more}. They are not excluded by ` +
            `status, so this is probably not intended.`,
          `Publish a value every selected result carries, copying earlier rounds forward where a ` +
            `later one did not happen — or narrow the ranking's scope.`,
        ),
      );
    }

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

  // A supplied rank is information, not instruction (spec §3.3.2). Now that it
  // names its ranking, both checks below have something unambiguous to compare
  // against — a bare number never did.
  const declared = new Map((document.rankings ?? []).map((entry) => [entry.id, entry]));
  const derivedByRanking = new Map<string, Map<Result, number | null>>();

  const derivedFor = (rankingId: string): Map<Result, number | null> => {
    let cached = derivedByRanking.get(rankingId);
    if (cached === undefined) {
      cached = new Map(rank(document, rankingId).map((entry) => [entry.result, entry.rank]));
      derivedByRanking.set(rankingId, cached);
    }
    return cached;
  };

  document.results.forEach((result, index) => {
    for (const [rankingId, supplied] of Object.entries(result.ranks ?? {})) {
      const ranking = declared.get(rankingId);

      if (ranking === undefined) {
        found.push(
          diagnostic(
            'OR-201',
            pointer('results', index, 'ranks', rankingId),
            `This result publishes a position in "${rankingId}", which is not a declared ranking.`,
            `Declare a ranking with id "${rankingId}", or remove this entry.`,
          ),
        );
        continue;
      }

      const derived = derivedFor(rankingId).get(result);

      if (derived === undefined || derived === null) {
        const status = normalizeStatus(result.status);
        found.push(
          diagnostic(
            'OR-303',
            pointer('results', index, 'ranks', rankingId),
            `This result publishes position ${supplied} in "${ranking.label}", but that ranking ` +
              `does not rank it — its status is "${status}", or it lacks a measure the ranking ` +
              `sorts on.`,
            `Remove this entry, or adjust the ranking's excludeStatuses if the result belongs in it.`,
          ),
        );
        continue;
      }

      if (derived !== supplied) {
        found.push(
          diagnostic(
            'OR-902',
            pointer('results', index, 'ranks', rankingId),
            `The document states position ${supplied} in "${ranking.label}", but the measures ` +
              `derive ${derived}.`,
            `Check the tie-break rule, or drop the entry and let the position be derived.`,
          ),
        );
      }
    }
  });

  return found;
}
