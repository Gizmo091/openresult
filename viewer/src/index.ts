/**
 * @openresult/viewer — an embeddable viewer for any OpenResult document.
 *
 * Importing this module registers `<openresult-viewer>` and the four views
 * shipped with it. Adding a view is a `registerView` call: neither the element
 * nor the format changes.
 */

import { registerView } from './core/registry.js';
import { tableView } from './views/table.js';
import { rankingView } from './views/ranking.js';
import { cardsView } from './views/cards.js';
import { compareView } from './views/compare.js';

// Registration order breaks ties between equal scores, so the most generally
// useful view comes first and `table` last — it is the floor, not a preference.
registerView(rankingView);
registerView(cardsView);
registerView(compareView);
registerView(tableView);

export { OpenResultViewer } from './element/viewer.js';
export { registerView, registeredViews, applicableViews, selectView } from './core/registry.js';
export type { ViewPlugin, RenderContext, ViewCandidate } from './core/registry.js';
export { buildViewModel } from './core/view-model.js';
export type { ViewModel, EventNode } from './core/view-model.js';
export { tableView, rankingView, cardsView, compareView };
