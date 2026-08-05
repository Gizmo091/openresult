# ADR 0015 — pnpm workspaces and Vite

**Status**: Accepted
**Date**: 2026-08-05

## Context

Six packages share a repository: three libraries, a command-line tool, a viewer, a playground.
They need a workspace manager and a build chain that will still be maintainable in several years.

There is a specific requirement: [ADR 0006](./0006-dependency-free-core.md) makes the core
package's freedom from dependencies a hard constraint. A tool that lets a package import what it
has not declared would quietly neutralise it.

## Decision

pnpm workspaces for the repository, Vite 6 for builds (library mode for packages, application
mode for the interfaces), Vitest 3 for tests, ESLint 9 and Prettier for style.

## Consequences

- pnpm enforces a strict dependency graph: a package cannot use what it has not declared. This is
  what makes the dependency-free constraint actually enforceable rather than merely observed.
- Vite and Vitest share configuration and transform pipeline, keeping the toolchain surface small.
- Contributors need pnpm rather than npm. Documented in the getting-started instructions.

## Alternatives considered

**npm workspaces** — no extra tooling to install. Rejected: dependency hoisting lets undeclared
imports resolve, defeating the guard being sought.

**Nx or Turborepo** — better orchestration and caching. Rejected: oversized for six packages, and
another piece of tooling to keep alive over the project's lifetime.
