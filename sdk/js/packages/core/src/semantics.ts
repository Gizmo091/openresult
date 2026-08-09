import type {
  AttributeDefinition,
  BetterWhen,
  Category,
  DocumentStatus,
  Measure,
  Participant,
  Result,
  ResultDocument,
  ResultEvent,
  ResultStatus,
  TieHandling,
} from './types.js';

/**
 * Statuses excluded from ranking when a ranking does not say otherwise
 * (spec §8.4.2).
 */
export const DEFAULT_EXCLUDED_STATUSES: readonly ResultStatus[] = [
  'notClassified',
  'inProgress',
  'dnf',
  'dns',
  'dsq',
  'outOfTime',
  'withdrawn',
];

// `bye` sits with `finished`: a competitor who scored without playing still
// belongs in the standings (spec §7.2.5).
const KNOWN_STATUSES = new Set<string>([
  'finished',
  'bye',
  ...DEFAULT_EXCLUDED_STATUSES,
] satisfies string[]);

const KNOWN_BETTER_WHEN = new Set<string>(['lower', 'higher', 'none']);
const KNOWN_TIES = new Set<string>(['standard', 'dense', 'strict', 'resolved']);

/**
 * Unknown enumeration values fold onto the documented fallback rather than
 * failing (spec §11.3.1). This is what makes adding a value in a later minor
 * version a non-breaking change.
 */
export function normalizeStatus(status: string | undefined): ResultStatus {
  if (status === undefined) return 'finished';
  return KNOWN_STATUSES.has(status) ? (status as ResultStatus) : 'finished';
}

export function normalizeBetterWhen(betterWhen: string | undefined): BetterWhen {
  if (betterWhen === undefined) return 'none';
  return KNOWN_BETTER_WHEN.has(betterWhen) ? (betterWhen as BetterWhen) : 'none';
}

export function normalizeTies(ties: string | undefined): TieHandling {
  if (ties === undefined) return 'standard';
  return KNOWN_TIES.has(ties) ? (ties as TieHandling) : 'standard';
}

export function measure(document: ResultDocument, id: string): Measure | undefined {
  return document.measures?.find((candidate) => candidate.id === id);
}

export function attribute(document: ResultDocument, id: string): AttributeDefinition | undefined {
  return document.attributeDefinitions?.find((candidate) => candidate.id === id);
}

export function participant(document: ResultDocument, id: string): Participant | undefined {
  return document.participants.find((candidate) => candidate.id === id);
}

export function event(document: ResultDocument, id: string): ResultEvent | undefined {
  return document.events?.find((candidate) => candidate.id === id);
}

export function category(document: ResultDocument, id: string): Category | undefined {
  return document.categories?.find((candidate) => candidate.id === id);
}

export function participantsOf(document: ResultDocument, categoryId?: string): Participant[] {
  if (categoryId === undefined) return document.participants;
  const members = new Set(category(document, categoryId)?.participants ?? []);
  return document.participants.filter((candidate) => members.has(candidate.id));
}

export function resultsOf(
  document: ResultDocument,
  filter: { event?: string; participant?: string } = {},
): Result[] {
  return document.results.filter(
    (result) =>
      (filter.event === undefined || result.event === filter.event) &&
      (filter.participant === undefined || result.participant === filter.participant),
  );
}

/**
 * The set containing an event and every event descending from it, so that a
 * ranking scoped to an overall event also sees its heats (spec §8.1.1).
 *
 * Guards against a cycle in the `parent` graph: an invalid document must not
 * hang a consumer.
 */
export function eventWithDescendants(document: ResultDocument, eventId: string): Set<string> {
  const included = new Set<string>([eventId]);
  const events = document.events ?? [];

  let grew = true;
  while (grew) {
    grew = false;
    for (const candidate of events) {
      if (
        candidate.parent !== undefined &&
        included.has(candidate.parent) &&
        !included.has(candidate.id)
      ) {
        included.add(candidate.id);
        grew = true;
      }
    }
  }

  return included;
}

/** A result is rankable when its status permits it (spec §7.2.1). */
export function isRankable(result: Result, excludedStatuses?: readonly ResultStatus[]): boolean {
  const excluded = excludedStatuses ?? DEFAULT_EXCLUDED_STATUSES;
  return !excluded.includes(normalizeStatus(result.status));
}

/** Measures actually carried by at least one result, in declaration order. */
export function usedMeasures(document: ResultDocument): Measure[] {
  const used = new Set<string>();
  for (const result of document.results) {
    for (const key of Object.keys(result.values ?? {})) used.add(key);
  }
  return (document.measures ?? []).filter((candidate) => used.has(candidate.id));
}

/**
 * Whether `a` supersedes `b` among documents sharing an `id` (spec §4.4.3).
 *
 * The commonest real requirement in results publishing: the jury rules, the
 * standings change, and both documents exist in the wild. Every consumer had to
 * read §4.4.3 and implement it, which is what a reference implementation is for.
 *
 * Returns `undefined` where the rule does not decide, rather than guessing:
 *
 * - the two do not share an `id`, so §4.4.3 does not apply — including when
 *   either carries none, since a document with no `id` names no subject and can
 *   supersede nothing;
 * - the versions and the standings are equal, which is a producer publishing
 *   the same thing twice;
 * - either carries no `status` and the versions are equal. §4.4.3 ranks
 *   `official` and `amended` above `provisional` above `draft`; a document
 *   stating none is in none of those ranks. §4.4.4 covers an *unknown* status,
 *   which is a different thing from an absent one.
 *
 * A version that is absent ranks below any version that is present: §4.4.2 says
 * a republication increases it, so a document carrying none is not one.
 */
export function supersedes(a: ResultDocument, b: ResultDocument): boolean | undefined {
  if (a.id === undefined || b.id === undefined || a.id !== b.id) return undefined;

  const left = a.version ?? -1;
  const right = b.version ?? -1;
  if (left !== right) return left > right;

  if (a.status === undefined || b.status === undefined) return undefined;

  const authority = standingOf(a.status) - standingOf(b.status);
  return authority === 0 ? undefined : authority > 0;
}

/** Where a status sits in §4.4.3's order. `official` and `amended` are equal. */
function standingOf(status: DocumentStatus): number {
  if (status === 'official' || status === 'amended') return 2;
  if (status === 'provisional') return 1;
  return 0;
}
