import {
  formatValue,
  listRankings,
  measure,
  parse,
  rank,
  type RankedEntry,
  type ResultDocument,
} from '@openresult/core';
import { resolveSources, SourceError } from '../sources.js';

export interface RankFlags {
  format: 'table' | 'json' | 'csv';
  ranking?: string;
}

/**
 * Show the ranking a consumer derives from a document.
 *
 * This is the manual check on derived ranking: point it at a document with no
 * `rank` member anywhere and read the standings it produces.
 */
export async function runRank(args: string[], flags: RankFlags): Promise<number> {
  const [source] = await resolveSources(args);
  if (source === undefined) throw new SourceError('No input given.');

  const document = parse(source.content);
  const available = listRankings(document);

  if (flags.ranking !== undefined && !available.some((entry) => entry.id === flags.ranking)) {
    const names = available.map((entry) => entry.id).join(', ');
    throw new SourceError(
      `No ranking called "${flags.ranking}" in this document.` +
        (names === '' ? ' It declares none.' : ` Available: ${names}.`),
    );
  }

  const chosen = flags.ranking ?? available[0]?.id;
  const entries = rank(document, chosen);
  const columns = rankedColumns(document, chosen);

  switch (flags.format) {
    case 'json':
      process.stdout.write(`${JSON.stringify(toJson(entries), null, 2)}\n`);
      break;
    case 'csv':
      process.stdout.write(renderCsv(document, entries, columns));
      break;
    default:
      process.stdout.write(renderTable(document, entries, columns, available, chosen));
  }

  return 0;
}

function rankedColumns(document: ResultDocument, rankingId: string | undefined): string[] {
  const declared = document.rankings?.find((entry) => entry.id === rankingId);
  if (declared !== undefined) return declared.sortBy;
  return listRankings(document)[0]?.sortBy ?? [];
}

function toJson(entries: RankedEntry[]) {
  return entries.map((entry) => ({
    rank: entry.rank,
    participant: { id: entry.participant.id, name: entry.participant.name },
    status: entry.result.status ?? 'finished',
    values: entry.values,
    ...(entry.tiedWith.length > 0 ? { tiedWith: entry.tiedWith } : {}),
  }));
}

function cell(document: ResultDocument, entry: RankedEntry, measureId: string): string {
  const value = entry.values[measureId];
  if (value === undefined) return entry.result.status ?? '';
  const definition = measure(document, measureId);
  return definition === undefined ? String(value) : formatValue(value, definition);
}

function renderTable(
  document: ResultDocument,
  entries: RankedEntry[],
  columns: string[],
  available: ReturnType<typeof listRankings>,
  chosen: string | undefined,
): string {
  const current = available.find((entry) => entry.id === chosen);
  const lines: string[] = [];

  if (current !== undefined) {
    lines.push(
      `${current.label}${current.implicit ? ' (implicit)' : ''} — ` +
        `sorted by ${current.sortBy.join(', ')}, ties: ${current.ties}`,
    );
    lines.push('');
  }

  const rows = entries.map((entry) => [
    entry.rank === null ? '—' : String(entry.rank),
    entry.participant.name,
    ...columns.map((measureId) => cell(document, entry, measureId)),
  ]);

  const widths = rows.reduce<number[]>(
    (acc, row) => row.map((value, index) => Math.max(acc[index] ?? 0, value.length)),
    [],
  );

  for (const row of rows) {
    lines.push(
      row
        .map((value, index) =>
          index === 0 ? value.padStart(widths[index] ?? 0) : value.padEnd(widths[index] ?? 0),
        )
        .join('  ')
        .trimEnd(),
    );
  }

  return `${lines.join('\n')}\n`;
}

function renderCsv(document: ResultDocument, entries: RankedEntry[], columns: string[]): string {
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const header = ['rank', 'participant', 'status', ...columns].map(escape).join(',');
  const rows = entries.map((entry) =>
    [
      entry.rank === null ? '' : String(entry.rank),
      entry.participant.name,
      entry.result.status ?? 'finished',
      ...columns.map((measureId) => {
        const value = entry.values[measureId];
        return value === undefined ? '' : String(value);
      }),
    ]
      .map(escape)
      .join(','),
  );

  return `${[header, ...rows].join('\n')}\n`;
}
