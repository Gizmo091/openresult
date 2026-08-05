# ADR 0022 — openresult.dev is one Node process, and the schema is precompiled

**Status**: Accepted
**Date**: 2026-08-05

## Context

The format needed a home: somewhere the specification could be read, the examples browsed, a
document validated, and — the part that made a static host insufficient — a viewer that another
service can **post a document to**, either the JSON itself or a URL naming it.

Posting rules out a purely static site. Fetching a URL on the visitor's behalf rules it out twice,
because browsers refuse cross-origin reads and the fetch has to happen somewhere.

## Decision

**One Node process behind nginx**, no dependencies in the server. The site's subject is a format
whose core package carries no runtime dependency; needing eighty packages to serve that claim
would be a poor advertisement, and every one would be another thing to patch.

**nginx terminates TLS and serves nothing itself.** The application already decides what may be
cached and which security headers each response carries. Two places deciding that is how they come
to disagree.

**A posted document becomes an inert JSON island.** It goes inside
`<script type="application/json">`, which browsers do not execute, and the page reads it with
`textContent`. `</`, `<!--`, U+2028 and U+2029 are escaped, and the document is parsed and
re-serialised first, so what reaches the page is JSON we produced rather than a string a stranger
wrote.

**The URL fetcher refuses anything off the public internet**, re-resolving and re-checking at
every redirect, with a size ceiling read from the stream rather than trusted from a header.

**The schema is compiled ahead of time**, not at startup.

**Nothing is stored.** A posted document is rendered into the response and forgotten. There is no
database and no cache, which is also why there is no privacy policy to write: results are often
embargoed until publication, and the safest place to keep a document is nowhere.

## Consequences

- **Precompiling the schema was forced by the CSP and turned out to be right anyway.**
  `ajv.compile()` builds its validator with `new Function`, which a page under
  `script-src 'self'` may not do — and that is the policy a site rendering documents from
  strangers should have. The playground broke the first time the policy was applied. Compiling at
  build time fixes it for every consumer of `@openresult/validate`, not just this site, drops Ajv
  out of the browser bundle, and removes the pause before the first validation.
- Nothing at runtime would notice the compiled validator drifting from the schema — the
  conformance suite runs against the same file, so a stale validator agrees with itself all the
  way through a green build. `compiled-validator` compares the two on every run.
- The specification on the site is rendered from `specification/openresult-v1.md` at build time
  rather than copied, so the page and the document the conformance suite cites cannot diverge. The
  example gallery is generated from `examples/` the same way.
- The schema had to move from `openresult.org`, which nobody owns, to `openresult.dev`, which
  answers. A `$id` that does not resolve is a broken promise to every tool that follows it.
- `MemoryDenyWriteExecute` cannot be used in the systemd unit even though every other hardening
  option can: V8 compiles JavaScript to machine code and needs pages that are writable and then
  executable. It cost a core dump to find, so the reason is written in the unit file itself.

## Alternatives considered

**A static site on a CDN, with the viewer reading only query strings.** Cheapest, and nothing to
operate. Rejected: it cannot accept a POST, which was the requirement, and every cross-origin URL
would fail on CORS with nothing the site could do about it.

**Add `'unsafe-eval'` to the Content Security Policy.** One line, and Ajv works. Rejected: the
page it would weaken is the one that renders documents from strangers, which is exactly the page
that needs the policy. Precompiling took an afternoon and made the library better.

**Store posted documents and redirect to a short URL.** It would make a posted document
shareable and bookmarkable, which is a real convenience. Rejected for now: it turns a stateless
renderer into a store of other people's unpublished results, with retention, deletion and abuse
questions attached. Rendering into the response keeps all of that from existing.

**Docker, or a process manager.** Rejected: systemd is already there, already supervises, already
restarts, and already offers the sandboxing this process wants. A container would add a layer
without removing a problem.
