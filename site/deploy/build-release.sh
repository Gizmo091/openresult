#!/usr/bin/env bash
# Assemble everything openresult.dev serves into one directory.
#
# The site's own pages, plus the two applications that are built separately —
# the playground and the browser validator — plus the schema at the exact path
# documents declare as their `$id`.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
out="${1:-$repo/site/release}"

rm -rf "$out"
mkdir -p "$out/public"

cp -R "$repo/site/dist/." "$out/public/"
mkdir -p "$out/public/playground" "$out/public/validator"
cp -R "$repo/playground/dist/." "$out/public/playground/"
cp -R "$repo/validator/web/dist/." "$out/public/validator/"

mkdir -p "$out/server"
cp "$repo/site/server/index.mjs" "$out/server/"

# The specification and the schema are the artefacts people link to directly.
mkdir -p "$out/public/schema"
cp "$repo/schema/openresult-1.0.schema.json" "$out/public/schema/"
cp "$repo/specification/openresult-v1.md" "$out/public/openresult-v1.md"

printf '%s\n' "$(git -C "$repo" rev-parse HEAD)" > "$out/public/VERSION"

echo "Release assembled in $out"
du -sh "$out/public" | awk '{print "  " $1 " served"}'
