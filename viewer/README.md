# @openresult/viewer

Render any [OpenResult](https://openresult.dev) document, with no configuration.

```sh
npm install @openresult/viewer
```

```html
<script type="module">
  import '@openresult/viewer';
</script>

<openresult-viewer src="https://example.org/results.json"></openresult-viewer>
```

Or with a document already in memory, which touches the network not at all:

```js
const viewer = document.createElement('openresult-viewer');
viewer.document = source;
document.body.append(viewer);
```

## It picks the view

A standings list, a table, cards, a comparison — the element scores each against the document and
renders the one that fits. A benchmark with two competing rankings, a photo contest with images, a
league table and a heat sheet all arrive as the same element, and none of them needs to be told
what it is.

```html
<openresult-viewer src="…" view="table" ranking="final" theme="dark" compact></openresult-viewer>
```

| Attribute | Effect                                                               |
| --------- | -------------------------------------------------------------------- |
| `src`     | Document to fetch. Ignored when `document` is set directly           |
| `view`    | Force a view; falls back to automatic selection when it does not fit |
| `ranking` | Which declared ranking to apply. Defaults to the first               |
| `locale`  | BCP 47 tag for number formatting. Defaults to the document's `lang`  |
| `theme`   | `light`, `dark` or `auto`                                            |
| `compact` | Denser layout                                                        |

## Accessibility

Tables are tables, so a screen reader announces the header and navigates by column. Standings are
ordered lists, because they are ordered. Unranked rows are marked in the DOM and their status is
written out, not implied by colour. Images take their alt text from the document.

## Adding a view

```js
import { registerView } from '@openresult/viewer';

registerView({
  id: 'timeline',
  label: 'Timeline',
  // 0 means inapplicable, 1 means ideal. The element renders the highest score.
  supports: (model) => (model.events.filter((event) => event.occurredAt).length > 3 ? 0.8 : 0),
  render: ({ model, selection, onSelect }) => html`…`,
});
```

## Licence

Apache-2.0.
