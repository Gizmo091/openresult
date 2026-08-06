import { html } from 'lit';
import type { RenderContext, ViewPlugin } from '../core/registry.js';
import {
  attributeText,
  cellText,
  isHighlighted,
  rankingMeasures,
  statusLabel,
  visibleAttributes,
} from './shared.js';

/**
 * Standings.
 *
 * Applies as soon as a measure declares a direction — which is exactly when an
 * order exists. Shows the measures the ranking sorts on, because those are the
 * ones that justify the order; the rest belongs in the table view.
 *
 * Unranked results are shown, without a rank. Dropping a retirement would hide
 * a fact the document deliberately records.
 */
export const rankingView: ViewPlugin = {
  id: 'ranking',
  label: 'Ranking',

  supports: (model) => {
    if (model.rankings.length === 0) return 0;
    return model.ranked.some((entry) => entry.rank !== null) ? 0.9 : 0.3;
  },

  render({ model, onSelect }: RenderContext) {
    const measures = rankingMeasures(model);
    const attributes = visibleAttributes(model).slice(0, 2);

    return html`
      <ol class="standings">
        ${model.ranked.map(
          (entry) => html`
            <li
              class="standing ${isHighlighted(model, entry.participant.id) ? 'highlighted' : ''}"
              data-unranked=${entry.rank === null}
              @click=${() => onSelect(entry.participant.id)}
            >
              <span class="position">${entry.rank ?? '—'}</span>

              <span class="who">
                <span class="name">${entry.participant.name}</span>
                ${
                  attributes.length === 0
                    ? null
                    : html`
                        <span class="attributes">
                          ${attributes
                            .map((attribute) => attributeText(entry, attribute, model.locale))
                            .filter((text) => text !== '')
                            .join(' · ')}
                        </span>
                      `
                }
              </span>

              <span class="figures">
                ${
                  entry.rank === null
                    ? html`<span class="status">${statusLabel(entry.result.status)}</span>`
                    : measures.map(
                        (measure) => html`
                          <span class="figure">
                            <span class="value">${cellText(model, entry, measure)}</span>
                            <span class="measure-label">${measure.label}</span>
                          </span>
                        `,
                      )
                }
              </span>

              ${
                entry.tiedWith.length === 0
                  ? null
                  : html`<span class="tied" title="Level on every sorting measure">tied</span>`
              }
            </li>
          `,
        )}
      </ol>
    `;
  },
};
