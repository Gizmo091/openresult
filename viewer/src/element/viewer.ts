import { NotOpenResultError, parse, UnsupportedVersionError } from '@openresult/core';
import type { RankedEntry, ResultDocument } from '@openresult/core';
import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { applicableViews, selectView, type ViewPlugin } from '../core/registry.js';
import { buildViewModel, type ViewModel } from '../core/view-model.js';
import { viewerStyles } from './styles.js';

/**
 * `<openresult-viewer>` — renders any OpenResult document, with no configuration.
 *
 * The element knows the format and nothing else. Every display decision follows
 * from the semantics the document declares: which measures rank, what a status
 * means, how ties were handled. There is no branch on what the competition is
 * about, and a repository check fails if one appears.
 */
@customElement('openresult-viewer')
export class OpenResultViewer extends LitElement {
  static override styles = viewerStyles;

  /** Remote document to load. Ignored when `document` is set directly. */
  @property({ type: String }) src?: string;

  /** Force a view. Falls back to automatic selection when it does not apply. */
  @property({ type: String }) view?: string;

  /** Which declared ranking to apply. Defaults to the first. */
  @property({ type: String }) ranking?: string;

  /** BCP 47 tag for number formatting. Defaults to the document's `lang`. */
  @property({ type: String }) locale?: string;

  @property({ type: String, reflect: true }) theme: 'light' | 'dark' | 'auto' = 'auto';

  @property({ type: Boolean, reflect: true }) compact = false;

  /** A document already in memory. Set this to avoid any network access. */
  @property({ attribute: false })
  set document(value: ResultDocument | undefined) {
    this.#document = value;
    this.#error = undefined;
    this.#announceLoad();
  }
  get document(): ResultDocument | undefined {
    return this.#document;
  }

  @state() private _tick = 0;

  #document: ResultDocument | undefined;
  #error: { code: string; message: string } | undefined;
  #selection: string[] = [];
  #loadedSrc: string | undefined;

  /** Views applicable to the current document, best first. */
  get availableViews(): { id: string; label: string; score: number }[] {
    const model = this.#model();
    if (model === undefined) return [];
    return applicableViews(model).map((candidate) => ({
      id: candidate.plugin.id,
      label: candidate.plugin.label,
      score: candidate.score,
    }));
  }

  /** The ranking currently displayed. */
  get rankedEntries(): RankedEntry[] {
    return this.#model()?.ranked ?? [];
  }

  override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('src') && this.src !== undefined && this.src !== this.#loadedSrc) {
      void this.#load(this.src);
    }
  }

  override render(): TemplateResult {
    if (this.#error !== undefined) {
      return html`<div class="message message-error" role="alert">${this.#error.message}</div>`;
    }

    const model = this.#model();
    if (model === undefined) {
      return html`<div class="message">Nothing loaded yet.</div>`;
    }

    const plugin = selectView(model, this.view);

    return html`
      ${this.#renderHead(model, plugin)}
      <div class="body">${this.#renderBody(model, plugin)}</div>
    `;
  }

  #renderHead(model: ViewModel, plugin: ViewPlugin | undefined): TemplateResult {
    const document = model.document;
    const candidates = applicableViews(model);

    return html`
      <header class="head">
        <h2 class="title">${document.title}</h2>
        ${
          document.status === undefined
            ? nothing
            : html`<span class="status-badge">${document.status}</span>`
        }
        ${
          document.source?.name === undefined
            ? nothing
            : html`<span class="meta">${document.source.name}</span>`
        }

        <div class="controls">
          ${
            model.rankings.length > 1
              ? html`
                  <select
                    aria-label="Ranking"
                    .value=${model.activeRanking ?? ''}
                    @change=${(event: Event) => {
                      this.ranking = (event.target as HTMLSelectElement).value;
                    }}
                  >
                    ${model.rankings.map(
                      (entry) => html`
                        <option value=${entry.id} ?selected=${entry.id === model.activeRanking}>
                          ${entry.label}
                        </option>
                      `,
                    )}
                  </select>
                `
              : nothing
          }
          ${
            candidates.length > 1
              ? html`
                  <select
                    aria-label="View"
                    @change=${(event: Event) => this.#changeView((event.target as HTMLSelectElement).value)}
                  >
                    ${candidates.map(
                      (candidate) => html`
                        <option
                          value=${candidate.plugin.id}
                          ?selected=${candidate.plugin.id === plugin?.id}
                        >
                          ${candidate.plugin.label}
                        </option>
                      `,
                    )}
                  </select>
                `
              : nothing
          }
        </div>
      </header>
    `;
  }

  #renderBody(model: ViewModel, plugin: ViewPlugin | undefined): TemplateResult {
    if (model.ranked.length === 0) {
      return html`<div class="message">
        No results yet. The entry list and the ranking rule are published; the results are not.
      </div>`;
    }

    if (plugin === undefined) {
      return html`<div class="message">No registered view can render this document.</div>`;
    }

    // A view that throws must not take the whole element down with it: the rest
    // of the document is still worth showing (spec §FR-043).
    try {
      return html`
        ${plugin.render({
          model,
          selection: this.#selection,
          onSelect: (participantId) => this.#select(participantId),
        })}
        ${this.#renderFootnote(model)}
      `;
    } catch (error) {
      console.error(error);
      return html`<div class="message message-error" role="alert">
        The “${plugin.label}” view could not render this document. Try another view.
      </div>`;
    }
  }

  #renderFootnote(model: ViewModel): TemplateResult | typeof nothing {
    const active = model.rankings.find((entry) => entry.id === model.activeRanking);
    if (active === undefined) return nothing;

    return html`<p class="footnote">
      Ranked by ${active.sortBy.join(', ')} · ties:
      ${active.ties}${active.implicit ? ' · derived, the document declares no ranking' : ''}
    </p>`;
  }

  #model(): ViewModel | undefined {
    if (this.#document === undefined) return undefined;
    void this._tick;
    return buildViewModel(this.#document, {
      ...(this.ranking === undefined ? {} : { ranking: this.ranking }),
      ...(this.locale === undefined ? {} : { locale: this.locale }),
    });
  }

  #changeView(id: string): void {
    const from = this.view;
    this.view = id;
    this.dispatchEvent(
      new CustomEvent('or-viewchange', { detail: { from, to: id }, bubbles: true, composed: true }),
    );
  }

  #select(participantId: string): void {
    this.#selection = this.#selection.includes(participantId)
      ? this.#selection.filter((id) => id !== participantId)
      : [...this.#selection, participantId];
    this._tick += 1;
    this.dispatchEvent(
      new CustomEvent('or-select', {
        detail: { participantId, selection: [...this.#selection] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #announceLoad(): void {
    this._tick += 1;
    if (this.#document === undefined) return;
    this.dispatchEvent(
      new CustomEvent('or-load', {
        detail: { document: this.#document, views: this.availableViews },
        bubbles: true,
        composed: true,
      }),
    );
  }

  async #load(src: string): Promise<void> {
    this.#loadedSrc = src;
    this.#error = undefined;

    try {
      const response = await fetch(src);
      if (!response.ok) {
        this.#fail(
          'http-error',
          `Could not load ${src}: ${response.status} ${response.statusText}.`,
        );
        return;
      }
      this.document = parse(await response.text());
    } catch (error) {
      if (error instanceof UnsupportedVersionError) {
        this.#fail('unsupported-version', error.message);
      } else if (error instanceof NotOpenResultError) {
        this.#fail('not-openresult', error.message);
      } else {
        // Usually CORS. Naming the likely cause beats a stack trace.
        this.#fail(
          'network',
          `Could not load ${src}. The server may not allow cross-origin requests.`,
        );
        console.error(error);
      }
    }
  }

  #fail(code: string, message: string): void {
    this.#error = { code, message };
    this.#document = undefined;
    this._tick += 1;
    this.dispatchEvent(
      new CustomEvent('or-error', { detail: { code, message }, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'openresult-viewer': OpenResultViewer;
  }
}
