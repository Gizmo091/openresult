import { formatValue, normalizeBetterWhen, type Measure } from '@openresult/core';
import { html } from 'lit';
import type { RenderContext, ViewPlugin } from '../core/registry.js';
import type { ViewModel } from '../core/view-model.js';

/**
 * Side-by-side comparison, measure by measure.
 *
 * Worth showing when there is more than one measure to compare on. Which value
 * leads on each row comes from `betterWhen` — the same semantics the ranking
 * uses, so the view can never disagree with the standings.
 */
export const compareView: ViewPlugin = {
  id: 'compare',
  label: 'Compare',

  supports: (model) => {
    if (model.measures.filter((measure) => ranks(measure)).length < 2) return 0;
    return model.ranked.length >= 2 ? 0.6 : 0;
  },

  render({ model, selection, onSelect }: RenderContext) {
    const chosen = selection.length >= 2 ? selection : defaultSelection(model);
    const entries = chosen
      .map((id) => model.ranked.find((entry) => entry.participant.id === id))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

    if (entries.length < 2) {
      return html`<p class="empty">Select at least two participants to compare.</p>`;
    }

    return html`
      <div class="compare">
        <p class="compare-hint">
          Comparing ${entries.length} of ${model.ranked.length}. Select a participant in another
          view to change this.
        </p>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Measure</th>
                ${entries.map(
                  (entry) => html`
                    <th class="numeric" @click=${() => onSelect(entry.participant.id)}>
                      ${entry.participant.name}
                      ${entry.rank === null ? null : html`<span class="unit">#${entry.rank}</span>`}
                    </th>
                  `,
                )}
              </tr>
            </thead>
            <tbody>
              ${model.measures.map((measure) => {
                const values = entries.map((entry) => entry.values[measure.id]);
                const leader = bestIndex(values, measure);

                return html`
                  <tr>
                    <th scope="row">
                      ${measure.label}${
                        measure.unit === undefined
                          ? null
                          : html`<span class="unit">${measure.unit}</span>`
                      }
                    </th>
                    ${values.map((value, index) => {
                      const text =
                        value === undefined
                          ? '—'
                          : formatValue(value, measure, { locale: model.locale });
                      return html`<td class="numeric ${index === leader ? 'leading' : ''}">
                        ${text}
                      </td>`;
                    })}
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};

function ranks(measure: Measure): boolean {
  return normalizeBetterWhen(measure.betterWhen) !== 'none';
}

/** Without a selection, compare the leaders — the comparison a reader expects. */
function defaultSelection(model: ViewModel): string[] {
  return model.ranked
    .filter((entry) => entry.rank !== null)
    .slice(0, 3)
    .map((entry) => entry.participant.id);
}

/**
 * Which value leads on this row, or -1 when the question does not apply —
 * a directionless measure, or values that cannot be compared.
 */
function bestIndex(values: (number | string | boolean | undefined)[], measure: Measure): number {
  const direction = normalizeBetterWhen(measure.betterWhen);
  if (direction === 'none') return -1;

  let best = -1;
  let bestValue: number | undefined;

  values.forEach((value, index) => {
    if (typeof value !== 'number') return;
    if (
      bestValue === undefined ||
      (direction === 'lower' ? value < bestValue : value > bestValue)
    ) {
      bestValue = value;
      best = index;
    }
  });

  return best;
}
