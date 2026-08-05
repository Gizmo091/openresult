import { css } from 'lit';

/**
 * Styles live in the shadow root, so nothing leaks in either direction.
 * Everything a host page might want to change is exposed as a custom property;
 * those names are part of the element's contract.
 */
export const viewerStyles = css`
  :host {
    --or-font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    --or-font-mono: ui-monospace, 'SF Mono', Menlo, monospace;
    --or-color-bg: #ffffff;
    --or-color-surface: #f7f6f4;
    --or-color-border: #e3e1dd;
    --or-color-text: #1c1b19;
    --or-color-muted: #6c6965;
    --or-color-accent: #2f5d8a;
    --or-color-highlight: #fff4d6;
    --or-radius: 6px;
    --or-space: 0.75rem;

    display: block;
    font-family: var(--or-font-family);
    color: var(--or-color-text);
    background: var(--or-color-bg);
    container-type: inline-size;
  }

  :host([theme='dark']) {
    --or-color-bg: #18191b;
    --or-color-surface: #1f2124;
    --or-color-border: #35383c;
    --or-color-text: #e9e7e4;
    --or-color-muted: #9b9894;
    --or-color-accent: #7fb0dd;
    --or-color-highlight: #3a3320;
  }

  @media (prefers-color-scheme: dark) {
    :host([theme='auto']) {
      --or-color-bg: #18191b;
      --or-color-surface: #1f2124;
      --or-color-border: #35383c;
      --or-color-text: #e9e7e4;
      --or-color-muted: #9b9894;
      --or-color-accent: #7fb0dd;
      --or-color-highlight: #3a3320;
    }
  }

  :host([compact]) {
    --or-space: 0.4rem;
    font-size: 0.9rem;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--or-space);
    padding-bottom: var(--or-space);
    border-bottom: 1px solid var(--or-color-border);
  }

  .title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .meta {
    color: var(--or-color-muted);
    font-size: 0.82rem;
  }

  .status-badge {
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--or-color-border);
    border-radius: 999px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--or-color-muted);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--or-space);
    margin-left: auto;
  }

  select {
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--or-color-border);
    border-radius: var(--or-radius);
    background: var(--or-color-bg);
    color: var(--or-color-text);
    font: inherit;
    font-size: 0.82rem;
  }

  .body {
    padding-top: var(--or-space);
  }

  .scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }

  th,
  td {
    padding: 0.35rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--or-color-border);
    white-space: nowrap;
  }

  thead th {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--or-color-muted);
    font-weight: 600;
  }

  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    margin-left: 0.25rem;
    font-size: 0.85em;
    font-weight: 400;
    color: var(--or-color-muted);
  }

  .name {
    font-weight: 550;
    white-space: normal;
  }

  .status {
    color: var(--or-color-muted);
    font-size: 0.85em;
  }

  tr[data-unranked='true'] td,
  .standing[data-unranked='true'],
  .card[data-unranked='true'] {
    color: var(--or-color-muted);
  }

  .highlighted {
    background: var(--or-color-highlight);
  }

  .leading {
    font-weight: 650;
    color: var(--or-color-accent);
  }

  /* Ranking */
  .standings {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .standing {
    display: flex;
    align-items: center;
    gap: var(--or-space);
    padding: 0.45rem 0.5rem;
    border-bottom: 1px solid var(--or-color-border);
    cursor: pointer;
  }

  .standing:hover {
    background: var(--or-color-surface);
  }

  .position {
    min-width: 2.2rem;
    font-variant-numeric: tabular-nums;
    font-size: 1.05rem;
    font-weight: 650;
    text-align: right;
    color: var(--or-color-accent);
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .attributes {
    font-size: 0.8rem;
    color: var(--or-color-muted);
  }

  .figures {
    display: flex;
    gap: var(--or-space);
    margin-left: auto;
    text-align: right;
  }

  .figure {
    display: flex;
    flex-direction: column;
  }

  .value {
    font-variant-numeric: tabular-nums;
    font-weight: 550;
  }

  .measure-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--or-color-muted);
  }

  .tied {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--or-color-muted);
  }

  /* Cards */
  .cards {
    display: grid;
    gap: var(--or-space);
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem;
    border: 1px solid var(--or-color-border);
    border-radius: var(--or-radius);
    background: var(--or-color-surface);
    cursor: pointer;
  }

  .card-image {
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: calc(var(--or-radius) - 2px);
    background: var(--or-color-border);
  }

  .card-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .card-head .name {
    margin: 0;
    font-size: 1rem;
  }

  .card-attributes,
  .card-measures {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.1rem 0.6rem;
    margin: 0;
    font-size: 0.82rem;
  }

  .card-attributes dt,
  .card-measures dt {
    color: var(--or-color-muted);
  }

  .card-attributes dd,
  .card-measures dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .notes {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    color: var(--or-color-muted);
  }

  /* Compare */
  .compare-hint,
  .empty {
    margin: 0 0 var(--or-space);
    font-size: 0.82rem;
    color: var(--or-color-muted);
  }

  /* States */
  .message {
    padding: 1.25rem;
    border: 1px solid var(--or-color-border);
    border-radius: var(--or-radius);
    background: var(--or-color-surface);
    color: var(--or-color-muted);
    font-size: 0.9rem;
  }

  .message-error {
    border-color: #9c3232;
    color: #9c3232;
  }

  .footnote {
    margin-top: var(--or-space);
    font-size: 0.75rem;
    color: var(--or-color-muted);
  }

  @container (max-width: 34rem) {
    .figures .measure-label {
      display: none;
    }
  }
`;
