import type { TemplateResult } from 'lit';
import type { ViewModel } from './view-model.js';

/**
 * View registry.
 *
 * A view is a self-contained module. Adding one must change neither the viewer's
 * core nor the format — which is why views are chosen by *score* rather than
 * enumerated in a switch.
 *
 * `supports` must decide from semantics alone: how many measures rank, whether
 * events exist, how many results there are. Referring to a competition domain
 * there would mean the format failed to express something, and the fix belongs
 * in the format.
 */
export interface ViewPlugin {
  id: string;
  label: string;
  /** 0 means inapplicable; 1 means ideal. */
  supports: (model: ViewModel) => number;
  render: (context: RenderContext) => TemplateResult;
}

export interface RenderContext {
  model: ViewModel;
  /** Participant ids the reader has selected, for views that compare. */
  selection: string[];
  onSelect: (participantId: string) => void;
}

const registry: ViewPlugin[] = [];

/**
 * Add a view, or replace the one already answering to its id.
 *
 * Replacing rather than appending is deliberate: two views under one id would
 * make the choice depend on which was registered first, and overriding a
 * built-in — a host that wants its own `table` — is a thing a viewer should let
 * you do. The replacement keeps the original's position, because position is
 * the tie-break between views scoring equally and re-registering one should not
 * quietly promote it past everything added since.
 */
export function registerView(plugin: ViewPlugin): void {
  const existing = registry.findIndex((entry) => entry.id === plugin.id);
  if (existing >= 0) {
    registry[existing] = plugin;
    return;
  }
  registry.push(plugin);
}

export function registeredViews(): readonly ViewPlugin[] {
  return registry;
}

export interface ViewCandidate {
  plugin: ViewPlugin;
  score: number;
}

/** Views applicable to this document, best first. */
export function applicableViews(model: ViewModel): ViewCandidate[] {
  return registry
    .map((plugin) => ({ plugin, score: safeScore(plugin, model) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || registry.indexOf(a.plugin) - registry.indexOf(b.plugin));
}

/**
 * Pick the view to show.
 *
 * A requested view wins if it applies. Otherwise the producer's suggestion wins
 * — but only if that view is registered and applicable, so a hint can never
 * leave the reader with nothing (spec §10.1.3). Failing both, the highest score
 * wins.
 */
export function selectView(model: ViewModel, requested?: string): ViewPlugin | undefined {
  const candidates = applicableViews(model);
  if (candidates.length === 0) return undefined;

  const byId = (id: string | undefined) =>
    id === undefined ? undefined : candidates.find((candidate) => candidate.plugin.id === id);

  return (
    byId(requested)?.plugin ??
    byId(model.document.presentation?.defaultView)?.plugin ??
    candidates[0]?.plugin
  );
}

/** A view that throws while scoring is treated as inapplicable, never fatal. */
function safeScore(plugin: ViewPlugin, model: ViewModel): number {
  try {
    const score = plugin.supports(model);
    return Number.isFinite(score) && score > 0 ? Math.min(score, 1) : 0;
  } catch {
    return 0;
  }
}
