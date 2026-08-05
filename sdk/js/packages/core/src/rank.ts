import {
  DEFAULT_EXCLUDED_STATUSES,
  eventWithDescendants,
  measure,
  normalizeBetterWhen,
  normalizeStatus,
  normalizeTies,
} from './semantics.js';
import type {
  BetterWhen,
  MeasureValue,
  Participant,
  RankedEntry,
  Ranking,
  RankingSummary,
  Result,
  ResultDocument,
} from './types.js';

/**
 * Ranking derivation — specification §8.5, normative.
 *
 * Two conforming consumers must produce identical output for the same
 * document, ties included. Everything here is therefore deterministic: no
 * clock, no locale, no environment. The only ordering input is the document.
 */

/** Rankings a consumer can offer for this document, declared or implied. */
export function listRankings(document: ResultDocument): RankingSummary[] {
  const declared = document.rankings ?? [];
  if (declared.length > 0) {
    return declared.map((ranking) => ({
      id: ranking.id,
      label: ranking.label,
      implicit: false,
      sortBy: ranking.sortBy,
      ties: normalizeTies(ranking.ties),
    }));
  }

  const implicit = implicitRanking(document);
  return implicit === undefined
    ? []
    : [
        {
          id: implicit.id,
          label: implicit.label,
          implicit: true,
          sortBy: implicit.sortBy,
          ties: normalizeTies(implicit.ties),
        },
      ];
}

/**
 * The ranking used when a document declares none: the first measure whose
 * direction is meaningful, standard tie numbering, default exclusions
 * (spec §8.6.1). Returns undefined when no measure qualifies — such a document
 * simply has no ranking, and results keep their declaration order.
 */
function implicitRanking(document: ResultDocument): Ranking | undefined {
  const rankable = (document.measures ?? []).find(
    (candidate) => normalizeBetterWhen(candidate.betterWhen) !== 'none',
  );
  if (rankable === undefined) return undefined;

  return {
    id: rankable.id,
    label: rankable.label,
    sortBy: [rankable.id],
    ties: 'standard',
  };
}

function resolveRanking(document: ResultDocument, rankingId?: string): Ranking | undefined {
  const declared = document.rankings ?? [];
  if (rankingId !== undefined) {
    return declared.find((candidate) => candidate.id === rankingId);
  }
  return declared[0] ?? implicitRanking(document);
}

/** Step 1 — selection (spec §8.5.1). */
function selectResults(document: ResultDocument, ranking: Ranking): Result[] {
  const scope = ranking.scope;
  if (scope === undefined) return document.results;

  const members =
    scope.category === undefined
      ? undefined
      : new Set(
          document.categories?.find((candidate) => candidate.id === scope.category)?.participants ??
            [],
        );

  return document.results.filter((result) => {
    // Exactly that event, never its descendants (spec §8.1.1): an overall
    // standing must not absorb the heats feeding it — different scale, and
    // mixing them would order nothing meaningful.
    if (scope.event !== undefined && result.event !== scope.event) return false;
    if (members !== undefined && !members.has(result.participant)) return false;
    return true;
  });
}

/**
 * Compare two values of one measure. Returns a negative number when `a` ranks
 * ahead of `b`.
 *
 * Values of differing types are treated as equal rather than guessed at: an
 * arbitrary ordering between a number and a string would be a decision the
 * document never made, and the stable sort then preserves declaration order.
 */
function compareValues(a: MeasureValue, b: MeasureValue, betterWhen: BetterWhen): number {
  let ascending = 0;

  if (typeof a === 'number' && typeof b === 'number') {
    ascending = a - b;
  } else if (typeof a === 'string' && typeof b === 'string') {
    // Code-unit comparison, not locale-aware: the result must not depend on
    // where the consumer runs.
    ascending = a < b ? -1 : a > b ? 1 : 0;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    ascending = Number(a) - Number(b);
  } else {
    return 0;
  }

  if (ascending === 0) return 0;
  return betterWhen === 'higher' ? -ascending : ascending;
}

function compareResults(document: ResultDocument, ranking: Ranking, a: Result, b: Result): number {
  for (const measureId of ranking.sortBy) {
    const definition = measure(document, measureId);
    const betterWhen = normalizeBetterWhen(definition?.betterWhen);
    if (betterWhen === 'none') continue;

    const left = a.values?.[measureId];
    const right = b.values?.[measureId];
    if (left === undefined || right === undefined) continue;

    const comparison = compareValues(left, right, betterWhen);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

/**
 * Derive the ranking.
 *
 * Pure: the same document and ranking id always yield the same array. Unranked
 * results are not dropped — they follow the ranked ones with `rank: null`, so a
 * retirement stays visible (spec §7.2.4, §8.5.5).
 */
export function rank(document: ResultDocument, rankingId?: string): RankedEntry[] {
  const ranking = resolveRanking(document, rankingId);
  const participants = new Map(document.participants.map((entry) => [entry.id, entry]));

  const toEntry = (result: Result, entryRank: number | null, tiedWith: string[]): RankedEntry => ({
    rank: entryRank,
    participant: participants.get(result.participant) ?? unknownParticipant(result.participant),
    result,
    values: result.values ?? {},
    tiedWith,
  });

  if (ranking === undefined) {
    return document.results.map((result) => toEntry(result, null, []));
  }

  const excluded = ranking.excludeStatuses ?? DEFAULT_EXCLUDED_STATUSES;
  const selected = selectResults(document, ranking);

  // Step 2 — partition (spec §8.5.2). A result missing any sorting measure
  // cannot be placed, so it is unranked rather than sorted as if it were zero.
  const rankable: Result[] = [];
  const unranked: Result[] = [];
  for (const result of selected) {
    const statusAllows = !excluded.includes(normalizeStatus(result.status));
    const hasEveryMeasure = ranking.sortBy.every(
      (measureId) => result.values?.[measureId] !== undefined,
    );
    (statusAllows && hasEveryMeasure ? rankable : unranked).push(result);
  }

  // Step 3 — sort (spec §8.5.3). Array.prototype.sort is stable, which is what
  // preserves declaration order among results comparing equal.
  const sorted = [...rankable].sort((a, b) => compareResults(document, ranking, a, b));

  // Step 4 — assign (spec §8.5.4).
  const ties = normalizeTies(ranking.ties);
  const entries: RankedEntry[] = [];
  let groupStart = 0;
  let groupNumber = 0;

  while (groupStart < sorted.length) {
    groupNumber += 1;
    const first = sorted[groupStart];
    if (first === undefined) break;

    let groupEnd = groupStart + 1;
    while (groupEnd < sorted.length) {
      const next = sorted[groupEnd];
      if (next === undefined || compareResults(document, ranking, first, next) !== 0) break;
      groupEnd += 1;
    }

    const group = sorted.slice(groupStart, groupEnd);
    // `standard` lets a shared rank consume the ones behind it (1, 2, 2, 4);
    // `dense` numbers distinct positions (1, 2, 2, 3). See spec §8.3.1.
    const assigned = ties === 'dense' ? groupNumber : groupStart + 1;
    const tiedIds = group.length > 1 ? group.map((result) => result.participant) : [];

    for (const result of group) {
      entries.push(
        toEntry(
          result,
          assigned,
          tiedIds.filter((id) => id !== result.participant),
        ),
      );
    }

    groupStart = groupEnd;
  }

  // Step 5 — unranked results follow, in declaration order (spec §8.5.5).
  for (const result of unranked) {
    entries.push(toEntry(result, null, []));
  }

  return entries;
}

/**
 * A result may reference a participant the document never declares. That is a
 * validation error, not a reason for the reader to crash, so a placeholder is
 * returned and the diagnostic is left to `@openresult/validate`.
 */
function unknownParticipant(id: string): Participant {
  return { id, name: id };
}
