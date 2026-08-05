# ADR 0008 — The viewer is a Web Component built with Lit

**Status**: Accepted
**Date**: 2026-08-05

## Context

The viewer has to be embeddable in any page — a club website, a league portal, a benchmark
report — none of which share a technology stack. It also has to survive years without becoming a
migration project.

## Decision

Build the viewer as a Web Component, `<openresult-viewer>`, using Lit 3, rendered in Shadow DOM.

## Consequences

- It embeds anywhere, with no style leakage in either direction and no framework conflict.
- Customisation goes through documented CSS custom properties, which become part of the contract.
- Lit adds roughly 5 kB and builds on platform APIs; should it be abandoned, porting to plain
  custom elements is mechanical.
- Contributors need to know custom elements, which is less common than knowing React.

## Alternatives considered

**React** — the richest ecosystem. Rejected: it imposes its runtime on the host page and ties the
widget to the integrator's stack, contradicting the independence requirement.

**Svelte** — compiles to minimal JavaScript and would work. Rejected narrowly: its components are
less naturally embeddable than a standard custom element.

**No library at all** — zero dependency. Rejected: it means maintaining a rendering engine, a
recurring cost that outweighs the benefit.
