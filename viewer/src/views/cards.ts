import { html } from 'lit';
import type { RenderContext, ViewPlugin } from '../core/registry.js';
import {
  attributeText,
  cellText,
  isHighlighted,
  statusLabel,
  visibleAttributes,
} from './shared.js';

/** Results carrying an image, which is what makes a card layout worth it. */
function withAssets(model: RenderContext['model']): number {
  return model.ranked.filter(
    (entry) =>
      (entry.participant.assets?.length ?? 0) > 0 || (entry.result.assets?.length ?? 0) > 0,
  ).length;
}

/**
 * Cards.
 *
 * Suited to small fields and to results that carry imagery. Both conditions are
 * read from the document's structure, never from what the competition is about.
 */
export const cardsView: ViewPlugin = {
  id: 'cards',
  label: 'Cards',

  supports: (model) => {
    if (model.ranked.length === 0) return 0;
    const illustrated = withAssets(model) / model.ranked.length;
    if (illustrated > 0.5) return 0.95;
    if (model.ranked.length <= 30) return 0.5;
    return 0.1;
  },

  render({ model, onSelect }: RenderContext) {
    const attributes = visibleAttributes(model);

    return html`
      <div class="cards">
        ${model.ranked.map((entry) => {
          const image =
            entry.participant.assets?.find((asset) => asset.type === 'image') ??
            entry.result.assets?.find((asset) => asset.type === 'image');

          return html`
            <article
              class="card ${isHighlighted(model, entry.participant.id) ? 'highlighted' : ''}"
              data-unranked=${entry.rank === null}
              @click=${() => onSelect(entry.participant.id)}
            >
              ${
                image === undefined
                  ? null
                  : html`<img
                      class="card-image"
                      src=${image.href}
                      alt=${image.label ?? entry.participant.name}
                      loading="lazy"
                    />`
              }

              <header class="card-head">
                <span class="position">${entry.rank ?? '—'}</span>
                <h3 class="name">${entry.participant.name}</h3>
              </header>

              ${
                attributes.length === 0
                  ? null
                  : html`
                      <dl class="card-attributes">
                        ${attributes.map((attribute) => {
                          const text = attributeText(entry, attribute, model.locale);
                          return text === ''
                            ? null
                            : html`<dt>${attribute.label}</dt>
                                <dd>${text}</dd>`;
                        })}
                      </dl>
                    `
              }

              <dl class="card-measures">
                ${model.measures.map(
                  (measure) => html`
                    <dt>${measure.label}</dt>
                    <dd>${cellText(model, entry, measure)}</dd>
                  `,
                )}
              </dl>

              ${
                entry.rank === null
                  ? html`<p class="status">${statusLabel(entry.result.status)}</p>`
                  : null
              }
              ${
                entry.result.notes === undefined
                  ? null
                  : html`<p class="notes">${entry.result.notes}</p>`
              }
            </article>
          `;
        })}
      </div>
    `;
  },
};
