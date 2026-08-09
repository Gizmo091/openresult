import { describe, expect, it } from 'vitest';
import { validate } from '../src/index.js';

/**
 * The translation from Ajv's vocabulary into a producer's.
 *
 * Ajv says "must match else schema" and "unevaluatedProperty"; a producer with a
 * typo in a participant id should never have to learn what either means. Each
 * keyword is therefore mapped onto the rule it actually enforces — and a mapping
 * nothing exercises is a message nobody has read, which is how a diagnostic ends
 * up naming the wrong member or pointing at the wrong node.
 *
 * These assert the code, the pointer and enough of the sentence to notice if it
 * starts describing something else.
 */

function base(): Record<string, unknown> {
  return {
    openresult: '1.0',
    title: 'Test',
    measures: [{ id: 'time', label: 'Time', kind: 'duration', unit: 's', betterWhen: 'lower' }],
    participants: [{ id: 'a', name: 'A' }],
    results: [{ participant: 'a', values: { time: 20 } }],
  };
}

/** Applies a mutation to a fresh document and returns what the validator said. */
function diagnose(mutate: (doc: Record<string, unknown>) => void) {
  const document = base();
  mutate(document);
  const report = validate(document);
  return [...report.errors, ...report.warnings];
}

function find(
  diagnostics: ReturnType<typeof diagnose>,
  code: string,
): (typeof diagnostics)[number] | undefined {
  return diagnostics.find((entry) => entry.code === code);
}

describe('a missing member', () => {
  it('names the member rather than the keyword (OR-101)', () => {
    const found = find(
      diagnose((doc) => {
        delete doc['title'];
      }),
      'OR-101',
    );
    expect(found?.message).toContain('"title" member is required');
    expect(found?.suggestion).toBe('Add "title".');
    expect(found?.path).toBe('/');
  });

  it('explains why a measure needs a unit rather than repeating "required" (OR-107)', () => {
    // Same Ajv keyword as above, different advice: the answer to a missing unit
    // is not "add unit", it is knowing that a bare number means nothing.
    const found = find(
      diagnose((doc) => {
        doc['measures'] = [{ id: 'time', label: 'Time', kind: 'duration', betterWhen: 'lower' }];
      }),
      'OR-107',
    );
    expect(found?.message).toContain('a value is a bare number');
    expect(found?.suggestion).toContain('"s" for a duration');
  });
});

describe('a value of the wrong type', () => {
  it('says what was expected and what arrived (OR-102)', () => {
    const found = find(
      diagnose((doc) => {
        doc['title'] = 42;
      }),
      'OR-102',
    );
    expect(found?.message).toBe('This value should be string but is 42.');
  });

  it('treats null as its own mistake (OR-108)', () => {
    // null is the tempting way to say "no time recorded", and it destroys the
    // difference between not recorded and recorded as nothing (spec §7.3.3).
    const found = find(
      diagnose((doc) => {
        doc['results'] = [{ participant: 'a', values: { time: null } }];
      }),
      'OR-108',
    );
    expect(found?.message).toContain('recorded as nothing');
    expect(found?.suggestion).toBe('Remove this key from "values".');
    expect(found?.path).toBe('/results/0/values/time');
  });

  it('lists both alternatives when a member accepts two types', () => {
    const found = find(
      diagnose((doc) => {
        doc['results'] = [{ participant: 'a', values: { time: { hours: 1 } } }];
      }),
      'OR-102',
    );
    expect(found?.message).toContain('number, string or boolean');
    expect(found?.message).toContain('is an object');
  });
});

describe('a value outside what the member allows', () => {
  it('lists the accepted values (OR-103)', () => {
    const found = find(
      diagnose((doc) => {
        doc['measures'] = [{ id: 'time', label: 'Time', kind: 'sundial', unit: 's' }];
      }),
      'OR-103',
    );
    expect(found?.message).toContain('"sundial" is not one of the values');
    expect(found?.suggestion).toContain('"duration"');
  });

  it('explains the one conditional in the schema in its own terms (OR-110)', () => {
    // Ajv reports this as a failed `const`, which reads as "must be equal to
    // constant" and helps nobody.
    const found = find(
      diagnose((doc) => {
        doc['attributeDefinitions'] = [{ id: 'club', label: 'Club', type: 'text', unit: 'km' }];
      }),
      'OR-110',
    );
    expect(found?.message).toContain('Only a number attribute may declare a "unit"');
    expect(found?.suggestion).toContain('change "type" to "number"');
  });
});

describe('a value of the wrong shape', () => {
  it('explains what an identifier is for (OR-104)', () => {
    const found = find(
      diagnose((doc) => {
        doc['participants'] = [{ id: 'a b', name: 'A' }];
      }),
      'OR-104',
    );
    expect(found?.message).toContain('survive being placed in a');
    expect(found?.path).toBe('/participants/0/id');
  });

  it('shows the timestamp form rather than the regular expression (OR-106)', () => {
    const diagnostics = diagnose((doc) => {
      doc['generatedAt'] = '17/05/2026';
    });
    expect(find(diagnostics, 'OR-106')?.suggestion).toContain('2026-05-17T16:42:00+02:00');
    // The same value also fails `format` inside the anyOf. That translation is
    // the generic one, and it must still name the format rather than the branch.
    expect(find(diagnostics, 'OR-102')?.message).toMatch(/is not a valid date(-time)?/);
  });

  it('falls back to the specification for a form it cannot name', () => {
    // A language tag: too rare a mistake to be worth its own sentence, and the
    // generic reply still says which member is wrong.
    const found = find(
      diagnose((doc) => {
        doc['lang'] = 'english';
      }),
      'OR-102',
    );
    expect(found?.message).toContain('does not have the expected form');
    expect(found?.suggestion).toContain('specification');
    expect(found?.path).toBe('/lang');
  });

  it('never reaches the schema when the version itself is unreadable', () => {
    // The version gate runs first and stops there on purpose: a document whose
    // version cannot be read is not an OpenResult document, and answering with
    // thirty schema errors would bury the one that matters (spec §4.2.1).
    const diagnostics = diagnose((doc) => {
      doc['openresult'] = 'one.zero';
      doc['title'] = 42;
    });
    expect(diagnostics.map((entry) => entry.code)).toEqual(['OR-401']);
  });
});

describe('a member that does not belong', () => {
  it('reports the member by name (OR-105)', () => {
    const found = find(
      diagnose((doc) => {
        doc['titel'] = 'Test';
      }),
      'OR-105',
    );
    expect(found?.message).toContain('titel');
  });
});

describe('bounds', () => {
  it('reports an empty list as empty, not as "minItems" (OR-304)', () => {
    const found = find(
      diagnose((doc) => {
        doc['rankings'] = [{ id: 'general', label: 'General', sortBy: [] }];
      }),
      'OR-304',
    );
    expect(found?.message).toBe('This list must not be empty.');
    expect(found?.path).toBe('/rankings/0/sortBy');
  });

  it('reports empty text as empty (OR-102)', () => {
    const found = find(
      diagnose((doc) => {
        doc['title'] = '';
      }),
      'OR-102',
    );
    expect(found?.message).toBe('This text must not be empty.');
  });

  it('quotes the limit it broke (OR-102)', () => {
    const found = find(
      diagnose((doc) => {
        doc['version'] = -1;
      }),
      'OR-102',
    );
    expect(found?.message).toContain('is below the minimum this member allows (0)');
    expect(found?.suggestion).toBe('Use a value of at least 0.');
  });
});

describe('the suppressed keywords', () => {
  it('reports a bad key once, through the subschema that knows why', () => {
    // A ranking id with a space in it fails twice: the identifier pattern, which
    // explains itself, and `propertyNames`, whose reply is "property name must
    // be valid". Only the first is worth showing.
    const diagnostics = diagnose((doc) => {
      doc['results'] = [
        { participant: 'a', values: { time: 20 }, ranks: { 'general ranking': 1 } },
      ];
    });
    expect(find(diagnostics, 'OR-104')?.message).toContain('is not a valid identifier');
    expect(diagnostics.map((entry) => entry.message)).not.toContain('property name must be valid');
  });

  it('says nothing about anyOf, allOf, oneOf, if, then or else', () => {
    // Those keywords describe the schema's own structure. Reporting them would
    // hand a producer a second, unrelated error for every real one — the whole
    // reason this translation exists.
    const diagnostics = diagnose((doc) => {
      doc['generatedAt'] = 'yesterday';
    });
    for (const entry of diagnostics) {
      expect(entry.message).not.toMatch(/anyOf|allOf|oneOf|else schema|then schema/);
    }
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});

describe('a valid document', () => {
  it('produces nothing at all', () => {
    const report = validate(base());
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});
