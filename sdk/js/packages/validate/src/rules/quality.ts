import type { ResultDocument } from '@openresult/core';
import { diagnostic, pointer, type Diagnostic } from '../diagnostics.js';

/**
 * What a document says about itself, checked against itself.
 *
 * Mostly non-blocking observations — reported separately from errors
 * (spec §12.1.2) so that a producer can act on them without being told the
 * document is broken when it is not. Two are errors, and both are declarations
 * that contradict themselves rather than data that disappoints: a scale whose
 * minimum exceeds its maximum, and a count whose unit names nothing.
 */
/**
 * The shape of an SPDX identifier or expression (spec §9.2.2).
 *
 * Shape, not membership: the licence list runs to several hundred entries and
 * grows, so checking against a copy would report a new identifier as wrong. A
 * shape can only fail on something that could not be an identifier at all —
 * "Creative Commons Attribution 4.0 International", "All rights reserved" —
 * which is the mistake producers actually make.
 */
const SPDX_SHAPE = /^[A-Za-z0-9.+()-]+(?: (?:AND|OR|WITH) [A-Za-z0-9.+()-]+)*$/;

/** The placeholders §5.2.6 names. Not a wider guess: see the rule's own text. */
const NAMES_NOTHING = new Set(['n', '#', 'no']);

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
  // Categories carry attributes too since §9.1.4. Without this, an attribute
  // used only there is reported as unused — the check contradicting the feature
  // it was extended for.
  for (const category of document.categories ?? []) {
    for (const key of Object.keys(category.attributes ?? {})) usedAttributeIds.add(key);
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

  // A count must name what it counts (spec §5.2.6). The rule names the three
  // placeholders it means, and this reports exactly those: a validator that
  // guessed at a wider list would reject documents the specification accepts.
  // `tools/check/unit-vocabulary.ts` holds this repository's own examples to a
  // longer one, which is a house style rather than the rule.
  (document.measures ?? []).forEach((measure, index) => {
    if (measure.kind !== 'count') return;
    if (!NAMES_NOTHING.has((measure.unit ?? '').toLowerCase())) return;
    found.push(
      diagnostic(
        'OR-111',
        pointer('measures', index, 'unit'),
        `"${measure.label}" counts "${measure.unit}", which names nothing. A count says what it ` +
          `counts — laps, matches, faults — and a figure counting nothing is an identifier ` +
          `somebody allocated rather than something anybody measured.`,
        `Name what is counted, or declare it in "attributes" with type "number" if it is a bib, ` +
          `a lane or a start number.`,
      ),
    );
  });

  // A licence a machine can act on (spec §9.2.2). A warning: the terms are
  // stated either way, and refusing a document over the spelling of its licence
  // would withhold the results to complain about the metadata.
  const license = document.source?.license;
  if (license !== undefined && !SPDX_SHAPE.test(license)) {
    found.push(
      diagnostic(
        'OR-912',
        '/source/license',
        `"${license}" is not an SPDX identifier, so nothing can tell whether the data may be ` +
          `reused without a person reading it.`,
        `Use the identifier for these terms — "CC-BY-4.0", "CC0-1.0", "ODbL-1.0" — or an SPDX ` +
          `expression such as "CC-BY-4.0 OR ODbL-1.0".`,
      ),
    );
  }

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
