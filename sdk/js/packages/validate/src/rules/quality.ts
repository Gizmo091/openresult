import type { ResultDocument } from '@openresult/core';
import { diagnostic, pointer, type Diagnostic } from '../diagnostics.js';

/**
 * Non-blocking observations.
 *
 * None of these makes a document invalid. They are reported separately from
 * errors (spec §12.1.2) so that a producer can act on them without being told
 * the document is broken when it is not.
 */
export function checkQuality(document: ResultDocument): Diagnostic[] {
  const found: Diagnostic[] = [];

  const usedMeasureIds = new Set<string>();
  const usedAttributeIds = new Set<string>();

  for (const result of document.results) {
    for (const key of Object.keys(result.values ?? {})) usedMeasureIds.add(key);
    for (const key of Object.keys(result.attributes ?? {})) usedAttributeIds.add(key);
  }
  for (const participant of document.participants) {
    for (const key of Object.keys(participant.attributes ?? {})) usedAttributeIds.add(key);
  }
  for (const event of document.events ?? []) {
    for (const key of Object.keys(event.attributes ?? {})) usedAttributeIds.add(key);
  }

  (document.measures ?? []).forEach((measure, index) => {
    if (!usedMeasureIds.has(measure.id)) {
      found.push(
        diagnostic(
          'OR-901',
          pointer('measures', index),
          `Measure "${measure.label}" is declared but no result carries a value for it.`,
          `Remove it, or populate it — consumers will show an empty column otherwise.`,
        ),
      );
    }
  });

  (document.attributes ?? []).forEach((attribute, index) => {
    if (!usedAttributeIds.has(attribute.id)) {
      found.push(
        diagnostic(
          'OR-905',
          pointer('attributes', index),
          `Attribute "${attribute.label}" is declared but never used.`,
          `Remove it, or attach it to the entities it describes.`,
        ),
      );
    }
  });

  const carriesText =
    document.description !== undefined ||
    document.results.some((result) => result.notes !== undefined);

  if (document.lang === undefined && carriesText) {
    found.push(
      diagnostic(
        'OR-903',
        pointer(),
        `The document carries prose but does not declare its language.`,
        `Add "lang" with a BCP 47 tag, for example "lang": "en".`,
      ),
    );
  }

  // An event may restrict its field. A result from outside that field is
  // suspicious rather than wrong — the field list is informative (spec §6.2.4).
  const fields = new Map(
    (document.events ?? [])
      .filter((event) => event.participants !== undefined)
      .map((event) => [event.id, new Set(event.participants)]),
  );

  document.results.forEach((result, index) => {
    if (result.event === undefined) return;
    const field = fields.get(result.event);
    if (field !== undefined && !field.has(result.participant)) {
      found.push(
        diagnostic(
          'OR-904',
          pointer('results', index, 'participant'),
          `"${result.participant}" has a result for event "${result.event}" but is absent from ` +
            `that event's declared field.`,
          `Add the participant to the event's "participants" list, or remove that list if the ` +
            `field is open.`,
        ),
      );
    }
  });

  return found;
}
