import {
  DEFAULT_EXCLUDED_STATUSES,
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
  const implicit = declared.length > 0 ? undefined : implicitRanking(document);

  if (rankingId !== undefined) {
    // The implicit ranking is addressable by id too: `listRankings` offers it,
    // so asking for it back must work. Without this, a caller that names the
    // ranking it was just handed gets nothing ranked.
    const found = declared.find((candidate) => candidate.id === rankingId);
    if (found !== undefined) return found;
    return implicit?.id === rankingId ? implicit : undefined;
  }

  return declared[0] ?? implicit;
}

/** Step 1 — selection (spec §8.5.1). */
function selectResults(document: ResultDocument, ranking: Ranking): Result[] {
  const scope = ranking.scope;
  if (scope === undefined) return document.results;

  // One category or several. Several is a union: belonging to any of them is
  // enough, which is what lets an axis made of ranges be expressed without a
  // category that re-lists its members (spec §8.1.2).
  const wantedCategories =
    scope.category === undefined
      ? undefined
      : new Set(Array.isArray(scope.category) ? scope.category : [scope.category]);

  const members =
    wantedCategories === undefined
      ? undefined
      : new Set(
          (document.categories ?? [])
            .filter((candidate) => wantedCategories.has(candidate.id))
            .flatMap((candidate) => candidate.participants ?? []),
        );

  // One event or several, never their descendants (spec §8.1.1). Listing events
  // is how a standing spanning them avoids copying results; descendants stay
  // out, because an overall standing must not absorb the heats feeding it —
  // different scale, and mixing them would order nothing meaningful.
  const events =
    scope.event === undefined
      ? undefined
      : new Set(Array.isArray(scope.event) ? scope.event : [scope.event]);

  return document.results.filter((result) => {
    if (events !== undefined && (result.event === undefined || !events.has(result.event)))
      return false;
    if (members !== undefined && !members.has(result.participant)) return false;
    return true;
  });
}

/**
 * The JSON type a measure's kind implies (spec §5.2.1).
 *
 * Everything is a number except `text`, which is a string, and `boolean`.
 */
const KNOWN_KINDS = new Set([
  'duration',
  'distance',
  'mass',
  'points',
  'score',
  'percentage',
  'count',
  'money',
  'rate',
  'text',
  'boolean',
]);

/**
 * The JSON type a kind implies, or `undefined` where this version does not know
 * the kind (spec §5.1.6, §8.5.2).
 *
 * `undefined` is the whole point. §5.1.6 folds an unknown kind onto `text` and
 * §11.2.2 lets a 1.1 add `temperature`; a 1.0 consumer that inferred `string`
 * from the fold would reject every number the document carries and publish an
 * empty standing, which is the opposite of what §11.2.1 promises.
 */
function expectedType(kind: string | undefined): 'number' | 'string' | 'boolean' | undefined {
  if (kind === undefined || !KNOWN_KINDS.has(kind)) return undefined;
  if (kind === 'text') return 'string';
  if (kind === 'boolean') return 'boolean';
  return 'number';
}

/**
 * Whether a result carries a usable value for a measure (spec §8.5.2).
 *
 * The type is checked against the measure's declared kind, never against the
 * other value being compared. That distinction is the whole point: deciding
 * pairwise — "a number and a string cannot be compared, so call them equal" —
 * makes the comparison non-transitive, and the same three results in a
 * different declaration order then fall into different tie groups. It does,
 * measurably: one document, six permutations, three different answers to who
 * was tied with whom. §8.5.6 requires two consumers to agree, and two sorting
 * algorithms comparing different pairs would not.
 *
 * Being a property of one result, this cannot depend on what it is compared
 * with, so the ordering it produces is the same everywhere.
 */
function carriesUsableValue(document: ResultDocument, result: Result, measureId: string): boolean {
  const value = result.values?.[measureId];
  if (value === undefined) return false;
  const wanted = expectedType(measure(document, measureId)?.kind);
  return wanted === undefined || typeof value === wanted;
}

/**
 * Compare two values of one measure. Returns a negative number when `a` ranks
 * ahead of `b`.
 *
 * Both are known to match the measure's kind by the time this runs, so the
 * remaining mismatch — a document declaring a kind this version does not know —
 * compares equal and leaves declaration order to the stable sort.
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
 * Order a tied group by the positions the producer published (spec §8.3.4).
 *
 * All of the group or none of it. A rule that separated one pair and left
 * another tied would not be transitive, and the standings would then depend on
 * the sorting algorithm — which is the divergence §8.5.6 forbids. Returns
 * undefined when the group cannot be settled, and the tie stands.
 */
function settleByPublishedRanks(group: Result[], rankingId: string): Result[] | undefined {
  const positions = group.map((result) => result.ranks?.[rankingId]);
  if (positions.some((position) => position === undefined)) return undefined;
  if (new Set(positions).size !== positions.length) return undefined;

  return [...group].sort((a, b) => (a.ranks?.[rankingId] ?? 0) - (b.ranks?.[rankingId] ?? 0));
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

  // Step 2 — partition (spec §8.5.2). A result missing any sorting measure —
  // or carrying something its kind does not admit — cannot be placed, so it is
  // unranked rather than sorted as if it were zero.
  const rankable: Result[] = [];
  const unranked: Result[] = [];
  for (const result of selected) {
    const statusAllows = !excluded.includes(normalizeStatus(result.status));
    const hasEveryMeasure = ranking.sortBy.every((measureId) =>
      carriesUsableValue(document, result, measureId),
    );
    (statusAllows && hasEveryMeasure ? rankable : unranked).push(result);
  }

  // Step 3 — sort (spec §8.5.3). Array.prototype.sort is stable, which is what
  // preserves declaration order among results comparing equal.
  const ties = normalizeTies(ranking.ties);
  const sorted = [...rankable].sort((a, b) => compareResults(document, ranking, a, b));

  // Step 4 — assign (spec §8.5.4).
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

    const settled =
      ties === 'resolved' && group.length > 1
        ? settleByPublishedRanks(group, ranking.id)
        : undefined;

    if (settled !== undefined) {
      // The group is no longer tied: it takes consecutive positions, and no
      // member is `tiedWith` any other (spec §8.3.4).
      settled.forEach((result, offset) => {
        entries.push(toEntry(result, groupStart + offset + 1, []));
      });
      groupNumber += settled.length - 1;
      groupStart = groupEnd;
      continue;
    }

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
