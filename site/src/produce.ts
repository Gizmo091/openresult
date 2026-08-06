import './site.css';
import './prose.css';
import { chrome, element } from './shell.js';

/**
 * How to emit a document.
 *
 * The page exists to make one claim concrete: there is no library to install.
 * Every snippet here builds an object and encodes it, which is why the same
 * fifteen lines work in languages that share nothing else.
 *
 * The snippets are held as data rather than markup so that nothing on this site
 * builds HTML by string concatenation.
 */

interface Snippet {
  id: string;
  label: string;
  code: string;
}

const SNIPPETS: Snippet[] = [
  {
    id: 'php',
    label: 'PHP',
    code: `<?php

$document = [
    'openresult' => '1.0',
    'title'      => 'Club meet — 100 m freestyle',
    'lang'       => 'en',
    'measures'   => [[
        'id'         => 'time',
        'label'      => 'Time',
        'kind'       => 'duration',
        'unit'       => 's',
        'precision'  => 2,
        'betterWhen' => 'lower',
    ]],
    'participants' => [
        ['id' => 'a', 'name' => 'Ana Ruiz'],
        ['id' => 'b', 'name' => 'Bea Nowak'],
    ],
    'results' => [
        ['participant' => 'a', 'values' => ['time' => 56.44]],
        ['participant' => 'b', 'values' => ['time' => 55.10]],
    ],
    'rankings' => [[
        'id'     => 'main',
        'label'  => 'Final',
        'sortBy' => ['time'],
    ]],
];

echo json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);`,
  },
  {
    id: 'python',
    label: 'Python',
    code: `import json

document = {
    "openresult": "1.0",
    "title": "Club meet — 100 m freestyle",
    "lang": "en",
    "measures": [
        {
            "id": "time",
            "label": "Time",
            "kind": "duration",
            "unit": "s",
            "precision": 2,
            "betterWhen": "lower",
        }
    ],
    "participants": [
        {"id": "a", "name": "Ana Ruiz"},
        {"id": "b", "name": "Bea Nowak"},
    ],
    "results": [
        {"participant": "a", "values": {"time": 56.44}},
        {"participant": "b", "values": {"time": 55.10}},
    ],
    "rankings": [{"id": "main", "label": "Final", "sortBy": ["time"]}],
}

print(json.dumps(document, ensure_ascii=False, indent=2))`,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    code: `const document = {
  openresult: '1.0',
  title: 'Club meet — 100 m freestyle',
  lang: 'en',
  measures: [
    {
      id: 'time',
      label: 'Time',
      kind: 'duration',
      unit: 's',
      precision: 2,
      betterWhen: 'lower',
    },
  ],
  participants: [
    { id: 'a', name: 'Ana Ruiz' },
    { id: 'b', name: 'Bea Nowak' },
  ],
  results: [
    { participant: 'a', values: { time: 56.44 } },
    { participant: 'b', values: { time: 55.1 } },
  ],
  rankings: [{ id: 'main', label: 'Final', sortBy: ['time'] }],
};

console.log(JSON.stringify(document, null, 2));`,
  },
  {
    id: 'go',
    label: 'Go',
    code: `package main

import (
	"encoding/json"
	"os"
)

func main() {
	document := map[string]any{
		"openresult": "1.0",
		"title":      "Club meet — 100 m freestyle",
		"lang":       "en",
		"measures": []any{map[string]any{
			"id": "time", "label": "Time", "kind": "duration",
			"unit": "s", "precision": 2, "betterWhen": "lower",
		}},
		"participants": []any{
			map[string]any{"id": "a", "name": "Ana Ruiz"},
			map[string]any{"id": "b", "name": "Bea Nowak"},
		},
		"results": []any{
			map[string]any{"participant": "a", "values": map[string]any{"time": 56.44}},
			map[string]any{"participant": "b", "values": map[string]any{"time": 55.10}},
		},
		"rankings": []any{map[string]any{
			"id": "main", "label": "Final", "sortBy": []string{"time"},
		}},
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	encoder.Encode(document)
}`,
  },
];

const { main } = chrome();
main.className = 'prose';

main.append(
  element('h1', {}, 'Producing a document'),
  element(
    'p',
    { class: 'lede' },
    'There is no library to install. A document is an object and a JSON encoder, which is why the ' +
      'same fifteen lines work in languages that share nothing else.',
  ),
);

const intro = element('p');
intro.append(
  'That is a design constraint rather than an accident: the format carries figures and never ' +
    'formulas, so a producer has nothing to evaluate and no runtime to depend on. See ',
  element('a', { href: '/spec/#12-design-constraints' }, 'specification §1.2'),
  '.',
);
main.append(intro);

// --- tabs -------------------------------------------------------------

const tabs = element('div', { class: 'row', style: 'margin:1.5rem 0 .75rem' });
const panel = element('pre');
const code = element('code');
panel.append(code);

function show(snippet: Snippet): void {
  code.textContent = snippet.code;
  for (const button of tabs.querySelectorAll('button')) {
    const current = button.dataset['id'] === snippet.id;
    button.classList.toggle('primary', current);
    button.setAttribute('aria-pressed', String(current));
  }
}

for (const snippet of SNIPPETS) {
  const button = element('button', { type: 'button' }, snippet.label);
  button.dataset['id'] = snippet.id;
  button.addEventListener('click', () => show(snippet));
  tabs.append(button);
}

main.append(tabs, panel);

const first = SNIPPETS[0];
if (first !== undefined) show(first);

const after = element('p', { class: 'small muted' });
after.append(
  'Any language with a JSON encoder produces the same document — Java, C#, Rust, Ruby, Elixir. ',
  'Check what you emitted with the ',
  element('a', { href: '/validate/' }, 'validator'),
  ', or post it straight to the ',
  element('a', { href: '/view/' }, 'viewer'),
  '.',
);
main.append(after);

const libraries = element('p', { class: 'small muted' });
libraries.append(
  'Reading a document is the half where a library earns its place, and those are published: ',
  element('a', { href: 'https://www.npmjs.com/package/@openresult/core' }, '@openresult/core'),
  ' for ranking, ',
  element(
    'a',
    { href: 'https://www.npmjs.com/package/@openresult/validate' },
    '@openresult/validate',
  ),
  ' for checking, ',
  element('a', { href: 'https://www.npmjs.com/package/@openresult/viewer' }, '@openresult/viewer'),
  ' for rendering, and ',
  element('a', { href: 'https://www.npmjs.com/package/@openresult/cli' }, '@openresult/cli'),
  ' to validate from a build.',
);
main.append(libraries);

// --- the rules that matter when writing a producer ---------------------

main.append(element('h2', {}, 'Five things worth knowing before you start'));

const RULES: [string, string, string][] = [
  [
    'Do not publish ranks',
    'A ranking declares how to order; the consumer computes the positions. Publishing them is ' +
      'allowed and informative, and it is never what makes the standings.',
    '/spec/#33-ranks-are-derived',
  ],
  [
    'Absent is not zero, and null is an error',
    'A measure that does not exist is omitted. An angler who caught nothing has no heaviest ' +
      'fish; writing 0 asserts a fish weighing nothing.',
    '/spec/#73-values',
  ],
  [
    'Direction lives on the measure',
    'Declare betterWhen once, where the quantity is defined, not on every ranking that uses it. ' +
      'A direction declared twice is a direction that can be declared inconsistently.',
    '/spec/#82-sortby',
  ],
  [
    'A retirement is still shown',
    'Excluding a result from a ranking is not deleting it. A consumer shows it without a rank, ' +
      'because a field of twelve that renders as five misrepresents the race.',
    '/spec/#72-status',
  ],
  [
    'Compute your own aggregates',
    'A points total or a general classification is a figure only you can produce. Publish the ' +
      'outcome as results; the format carries no formula to evaluate.',
    '/spec/#81-scope',
  ],
];

for (const [title, body, href] of RULES) {
  const heading = element('h3', {});
  heading.append(element('a', { href }, title));
  main.append(heading, element('p', {}, body));
}

main.append(
  element('h2', {}, 'Then check it'),
  element(
    'p',
    {},
    'The schema catches structure; the validator also catches what a schema cannot express — a ' +
      'result naming a participant that does not exist, a ranking that selects nothing, a ' +
      'category with no members.',
  ),
);

const pre = element('pre');
pre.append(
  element(
    'code',
    {},
    `# In the browser, or from your build
curl -X POST https://openresult.dev/view \\
     -H 'Content-Type: application/json' \\
     --data-binary @results.json

# The schema, for editors and CI
https://openresult.dev/schema/openresult-1.0.schema.json`,
  ),
);
main.append(pre);
