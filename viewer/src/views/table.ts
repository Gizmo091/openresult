import { html } from 'lit';
import type { RenderContext, ViewPlugin } from '../core/registry.js';
import {
  attributeText,
  cellText,
  isHighlighted,
  statusLabel,
  visibleAttributes,
} from './shared.js';

/**
 * Universal fallback.
 *
 * Scores low but never zero, so no conforming document can end up with nothing
 * to render — the condition the specification's rendering promise rests on.
 * Shows every measure and every used attribute, in one grid.
 */
export const tableView: ViewPlugin = {
  id: 'table',
  label: 'Table',

  supports: () => 0.2,

  render({ model }: RenderContext) {
    const attributes = visibleAttributes(model);
    const ranked = model.ranked.some((entry) => entry.rank !== null);

    return html`
      <div class="scroll">
        <table>
          <thead>
            <tr>
              ${ranked ? html`<th class="numeric">#</th>` : null}
              <th>Participant</th>
              ${attributes.map((attribute) => html`<th>${attribute.label}</th>`)}
              ${model.measures.map(
                (measure) => html`
                  <th class="numeric">
                    ${measure.label}${
                      measure.unit === undefined
                        ? null
                        : html`<span class="unit">${measure.unit}</span>`
                    }
                  </th>
                `,
              )}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${model.ranked.map(
              (entry) => html`
                <tr
                  class=${isHighlighted(model, entry.participant.id) ? 'highlighted' : ''}
                  data-unranked=${entry.rank === null}
                >
                  ${ranked ? html`<td class="numeric rank">${entry.rank ?? '—'}</td>` : null}
                  <td class="name">${entry.participant.name}</td>
                  ${attributes.map(
                    (attribute) => html`<td>${attributeText(entry, attribute, model.locale)}</td>`,
                  )}
                  ${model.measures.map(
                    (measure) => html`<td class="numeric">${cellText(model, entry, measure)}</td>`,
                  )}
                  <td class="status">${statusLabel(entry.result.status)}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  },
};
