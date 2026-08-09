import {
  listRankings,
  rank,
  usedMeasures,
  type AttributeDefinition,
  type Category,
  type Measure,
  type RankedEntry,
  type RankingSummary,
  type ResultDocument,
  type ResultEvent,
} from '@openresult/core';

/**
 * The projection every view consumes.
 *
 * Views never derive a ranking themselves: they read `ranked`. That is what
 * guarantees a document produces the same order in every view, and it is the
 * only way the determinism the specification demands survives inside a single
 * application.
 */
export interface ViewModel {
  document: ResultDocument;
  /** The derived ranking for the active declaration. */
  ranked: RankedEntry[];
  rankings: RankingSummary[];
  activeRanking: string | undefined;
  /** Measures actually carried by results, in declaration order. */
  measures: Measure[];
  attributes: AttributeDefinition[];
  events: EventNode[];
  categories: Category[];
  locale: string;
}

export interface EventNode {
  event: ResultEvent;
  children: EventNode[];
}

export function buildViewModel(
  document: ResultDocument,
  options: { ranking?: string; locale?: string } = {},
): ViewModel {
  const rankings = listRankings(document);
  const activeRanking =
    options.ranking !== undefined && rankings.some((entry) => entry.id === options.ranking)
      ? options.ranking
      : rankings[0]?.id;

  return {
    document,
    ranked: rank(document, activeRanking),
    rankings,
    activeRanking,
    measures: orderMeasures(document),
    attributes: document.attributeDefinitions ?? [],
    events: buildEventTree(document.events ?? []),
    categories: document.categories ?? [],
    locale: options.locale ?? document.lang ?? 'en',
  };
}

/**
 * Measures in the order the producer suggested, when it suggested one.
 *
 * This is the one place a presentation hint is honoured, and it is safe: the
 * hint reorders columns and can never change what is displayed or how it is
 * ranked. Dropping the hint entirely still yields a correct view.
 */
function orderMeasures(document: ResultDocument): Measure[] {
  const used = usedMeasures(document);
  const preferred = document.presentation?.measureOrder;
  if (preferred === undefined) return used;

  const position = new Map(preferred.map((id, index) => [id, index]));
  return [...used].sort(
    (a, b) =>
      (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (position.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Resolves the parent relation into a tree, for navigation only. */
function buildEventTree(events: ResultEvent[]): EventNode[] {
  const nodes = new Map<string, EventNode>(
    events.map((event) => [event.id, { event, children: [] }]),
  );
  const roots: EventNode[] = [];

  for (const event of events) {
    const node = nodes.get(event.id);
    if (node === undefined) continue;

    const parent = event.parent === undefined ? undefined : nodes.get(event.parent);
    // A cycle or a dangling parent must not lose the event: it becomes a root.
    if (parent === undefined || parent === node || createsCycle(events, event.id)) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return roots;
}

function createsCycle(events: ResultEvent[], startId: string): boolean {
  const parents = new Map(events.map((event) => [event.id, event.parent]));
  const seen = new Set<string>([startId]);
  let current = parents.get(startId);

  while (current !== undefined) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}
