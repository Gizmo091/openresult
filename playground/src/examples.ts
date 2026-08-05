import type { ResultDocument } from '@openresult/core';

export interface ExampleEntry {
  path: string;
  load: () => Promise<ResultDocument>;
}

/**
 * The example library, loaded on demand.
 *
 * Not eager: bundling nineteen documents into the initial payload would make
 * everyone pay for the one they open. The paths are descriptive enough to
 * choose from without loading anything.
 */
const modules = import.meta.glob<{ default: ResultDocument }>(
  '../../examples/**/*.openresult.json',
);

export const examples: ExampleEntry[] = Object.entries(modules)
  .map(([path, load]) => ({
    path: path.replace('../../examples/', '').replace('.openresult.json', ''),
    load: async () => (await load()).default,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

export function findExample(path: string): ExampleEntry | undefined {
  return examples.find((example) => example.path === path);
}

/** A minimal starting point: valid, and carrying no rank at all. */
export const STARTER = `{
  "openresult": "1.0",
  "title": "My first results",
  "lang": "en",
  "measures": [
    {
      "id": "time",
      "label": "Time",
      "kind": "duration",
      "unit": "s",
      "precision": 1,
      "betterWhen": "lower"
    }
  ],
  "participants": [
    { "id": "a", "name": "Ada Lovelace" },
    { "id": "b", "name": "Grace Hopper" },
    { "id": "c", "name": "Alan Turing" }
  ],
  "results": [
    { "participant": "a", "values": { "time": 512.4 } },
    { "participant": "b", "values": { "time": 498.7 } },
    { "participant": "c", "status": "dnf" }
  ],
  "rankings": [
    { "id": "scratch", "label": "Scratch", "sortBy": ["time"] }
  ]
}
`;
