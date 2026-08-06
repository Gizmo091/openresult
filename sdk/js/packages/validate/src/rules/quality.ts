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

  // A declared scale has to be a scale (spec §5.1.8).
  (document.measures ?? []).forEach((measure, index) => {
    if (measure.min !== undefined && measure.max !== undefined && measure.min > measure.max) {
      found.push(
        diagnostic(
          'OR-109',
          pointer('measures', index, 'min'),
          `"${measure.label}" declares a minimum of ${measure.min} and a maximum of ` +
            `${measure.max}, so no value can satisfy both.`,
          `Swap them, or drop whichever bound was not meant.`,
        ),
      );
    }
  });

  // Values outside the scale their measure declares. A warning, not an error:
  // the document still orders, and refusing to render standings because one
  // figure is out of range would hide the result to report the typo.
  const scales = new Map(
    (document.measures ?? [])
      .filter((measure) => measure.min !== undefined || measure.max !== undefined)
      // A scale that contradicts itself is already reported as OR-109; adding a
      // warning per value would bury the error under its own consequences.
      .filter(
        (measure) =>
          !(measure.min !== undefined && measure.max !== undefined && measure.min > measure.max),
      )
      .map((measure) => [measure.id, measure]),
  );

  if (scales.size > 0) {
    document.results.forEach((result, index) => {
      for (const [id, value] of Object.entries(result.values ?? {})) {
        const measure = scales.get(id);
        if (measure === undefined || typeof value !== 'number') continue;

        const below = measure.min !== undefined && value < measure.min;
        const above = measure.max !== undefined && value > measure.max;
        if (!below && !above) continue;

        const bounds =
          measure.min !== undefined && measure.max !== undefined
            ? `${measure.min} to ${measure.max}`
            : measure.min !== undefined
              ? `${measure.min} or more`
              : `${measure.max} or less`;

        found.push(
          diagnostic(
            'OR-909',
            pointer('results', index, 'values', id),
            `${value} falls outside the scale "${measure.label}" declares (${bounds}).`,
            `Correct the value, or widen the scale if the bounds were wrong.`,
          ),
        );
      }
    });
  }

  // A participant nobody competed as. Measures, attributes, rankings and
  // categories all had a diagnostic for being declared and unused; participants
  // did not, and a wine competition that declared its jurors as participants —
  // because there was nowhere else to put them — passed in silence.
  const competed = new Set(document.results.map((result) => result.participant));
  const inTeam = new Set(document.participants.flatMap((participant) => participant.members ?? []));

  // Not when the document has no results at all. An announced event publishes
  // its entry list before anyone has competed, which is a documented and valid
  // shape — warning about every entrant there would be shouting at the normal
  // case, which is how a diagnostic teaches people to ignore it.
  const anyResults = document.results.length > 0;

  document.participants.forEach((participant, index) => {
    if (!anyResults) return;
    if (competed.has(participant.id) || inTeam.has(participant.id)) return;
    found.push(
      diagnostic(
        'OR-910',
        pointer('participants', index),
        `"${participant.name}" is declared but holds no result and belongs to no team, so ` +
          `nothing in this document says what they did.`,
        `Give them a result — a status is enough for someone who did not start — or remove them.`,
      ),
    );
  });

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

  (document.categories ?? []).forEach((category, index) => {
    const members = category.participants ?? [];
    const selects = document.results.some((result) => members.includes(result.participant));
    if (!selects) {
      found.push(
        diagnostic(
          'OR-907',
          pointer('categories', index),
          `Category "${category.label}" selects no result: none of its participants has one.`,
          `Populate it, remove it, or check that its participant ids are right.`,
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
