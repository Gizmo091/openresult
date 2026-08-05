import { listRankings, parse, usedMeasures } from '@openresult/core';
import { resolveSources, SourceError } from '../sources.js';

/** Summarise a document without validating it. */
export async function runInfo(args: string[]): Promise<number> {
  const [source] = await resolveSources(args);
  if (source === undefined) throw new SourceError('No input given.');

  const document = parse(source.content);
  const lines: string[] = [];

  const field = (label: string, value: string) => lines.push(`${label.padEnd(16)}${value}`);

  field('Title', document.title);
  field('Format', document.openresult);
  if (document.id !== undefined) field('Id', document.id);
  if (document.version !== undefined) field('Content version', String(document.version));
  if (document.status !== undefined) field('Status', document.status);
  if (document.lang !== undefined) field('Language', document.lang);
  if (document.generatedAt !== undefined) field('Generated', document.generatedAt);
  if (document.source?.name !== undefined) {
    field(
      'Source',
      document.source.system === undefined
        ? document.source.name
        : `${document.source.name} (${document.source.system})`,
    );
  }
  if (document.source?.license !== undefined) field('Data licence', document.source.license);

  lines.push('');
  field('Participants', String(document.participants.length));
  field('Events', String((document.events ?? []).length));
  field('Results', String(document.results.length));
  field('Categories', String((document.categories ?? []).length));

  const measures = usedMeasures(document);
  if (measures.length > 0) {
    lines.push('');
    lines.push('Measures in use');
    for (const measure of measures) {
      const unit = measure.unit === undefined ? '' : ` in ${measure.unit}`;
      lines.push(
        `  ${measure.id.padEnd(16)}${measure.label}${unit} — better when ${measure.betterWhen}`,
      );
    }
  }

  const rankings = listRankings(document);
  lines.push('');
  if (rankings.length === 0) {
    lines.push('No ranking available: no measure declares a direction.');
  } else {
    lines.push('Rankings');
    for (const ranking of rankings) {
      lines.push(
        `  ${ranking.id.padEnd(16)}${ranking.label}${ranking.implicit ? ' (implicit)' : ''} — ` +
          `by ${ranking.sortBy.join(', ')}, ties: ${ranking.ties}`,
      );
    }
  }

  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
